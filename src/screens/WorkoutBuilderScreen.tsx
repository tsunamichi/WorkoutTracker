import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconArrowLeft, IconAdd, IconClose, IconSearch, IconCheck } from '../components/icons';
import { WarmupItemEditor } from '../components/WarmupItemEditor';
import { useTranslation } from '../i18n/useTranslation';
import type { Exercise, ExerciseCategory } from '../types';
import type { WorkoutTemplate, WarmupItem } from '../types/training';

// Light theme colors
const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  secondary: '#1B1B1B',
  textMeta: '#817B77',
  border: '#C7C7CC',
  accentPrimary: '#FD6B00',
  buttonBg: '#F2F2F7',
};

const MUSCLE_GROUPS: ExerciseCategory[] = [
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Arms',
  'Core',
  'Full Body',
  'Cardio',
];

export function WorkoutBuilderScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params as { selectedDate?: string; shouldScheduleAfterCreate?: boolean } | undefined);
  const insets = useSafeAreaInsets();
  const { exercises, addWorkoutTemplate, scheduleWorkout, getScheduledWorkout } = useStore();
  const { t } = useTranslation();

  const [workoutName, setWorkoutName] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [warmupItems, setWarmupItems] = useState<WarmupItem[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<ExerciseCategory | 'All'>('All');

  const handleBack = () => {
    if (selectedExercises.length > 0) {
      Alert.alert(
        t('discardWorkout'),
        t('discardWorkoutMessage'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('discard'),
            style: 'destructive',
            onPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              navigation.goBack();
            },
          },
        ]
      );
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.goBack();
    }
  };

  const handleToggleExercise = (exerciseId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedExercises(prev =>
      prev.includes(exerciseId)
        ? prev.filter(id => id !== exerciseId)
        : [...prev, exerciseId]
    );
  };

  const handleRemoveExercise = (exerciseId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedExercises(prev => prev.filter(id => id !== exerciseId));
  };

  const handleContinue = () => {
    if (selectedExercises.length === 0) {
      Alert.alert(t('noExercisesSelected'), t('pleaseAddExercises'));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowExercisePicker(false);
  };

  const handleSaveWorkout = async () => {
    if (!workoutName.trim()) {
      Alert.alert(t('enterWorkoutName'), t('pleaseEnterWorkoutName'));
      return;
    }

    if (selectedExercises.length === 0) {
      Alert.alert(t('noExercisesSelected'), t('pleaseAddExercises'));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Create workout template
    const templateId = `wt-${Date.now()}`;
    const now = new Date().toISOString();
    
    const template: WorkoutTemplate = {
      id: templateId,
      name: workoutName.trim(),
      createdAt: now,
      updatedAt: now,
      kind: 'workout',
      warmupItems: warmupItems,
      items: selectedExercises.map((exerciseId, index) => ({
        exerciseId,
        order: index,
        sets: 3, // Default values
        reps: 10,
      })),
      lastUsedAt: null,
      usageCount: 0,
    };

    await addWorkoutTemplate(template);
    
    console.log('📝 Workout saved. Params:', params);
    console.log('  - shouldScheduleAfterCreate:', params?.shouldScheduleAfterCreate);
    console.log('  - selectedDate:', params?.selectedDate);
    
    // If should schedule after create, check if day is empty
    if (params?.shouldScheduleAfterCreate && params?.selectedDate) {
      const dateStr = dayjs(params.selectedDate).format('MMM D');
      const existingWorkout = getScheduledWorkout(params.selectedDate);
      
      console.log('  - existingWorkout:', existingWorkout);
      
      if (!existingWorkout) {
        // Day is empty - ask if they want to use it today
        Alert.alert(
          t('workoutSaved'),
          t('useWorkoutToday').replace('{date}', dateStr),
          [
            {
              text: t('notNow'),
              style: 'cancel',
              onPress: () => {
                navigation.goBack();
              },
            },
            {
              text: t('useIt'),
              onPress: async () => {
                const result = await scheduleWorkout(params.selectedDate, templateId, 'manual');
                if (result.success) {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                navigation.goBack();
              },
            },
          ]
        );
      } else {
        // Day has a workout - explain it was saved to library but not scheduled
        Alert.alert(
          t('workoutSaved'),
          t('workoutSavedNotScheduled').replace('{date}', dateStr),
          [
            {
              text: t('ok'),
              onPress: () => {
                navigation.goBack();
              },
            },
          ]
        );
      }
    } else {
      // Default behavior: just show success and go back (creating template only)
      Alert.alert(
        t('workoutSaved'),
        t('workoutSavedToLibrary'),
        [
          {
            text: t('ok'),
            onPress: () => {
              navigation.goBack();
            },
          },
        ]
      );
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleMuscleFilter = (muscle: ExerciseCategory | 'All') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMuscle(muscle);
  };

  // Filter and search exercises
  const filteredExercises = useMemo(() => {
    let result = exercises;

    if (selectedMuscle !== 'All') {
      result = result.filter(ex => ex.category === selectedMuscle);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(ex => ex.name.toLowerCase().includes(query));
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, selectedMuscle, searchQuery]);

  const selectedExerciseObjects = useMemo(() => {
    return selectedExercises
      .map(id => exercises.find(ex => ex.id === id))
      .filter(Boolean) as Exercise[];
  }, [selectedExercises, exercises]);

  if (showExercisePicker) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <IconArrowLeft size={24} color={LIGHT_COLORS.secondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('selectExercises')}</Text>
          <View style={styles.backButton} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <IconSearch size={20} color={LIGHT_COLORS.textMeta} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('searchExercisesPlaceholder')}
              placeholderTextColor={LIGHT_COLORS.textMeta}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch}>
                <IconClose size={20} color={LIGHT_COLORS.textMeta} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Muscle Group Filters */}
        <View style={styles.filtersContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContent}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedMuscle === 'All' && styles.filterChipActive,
              ]}
              onPress={() => handleMuscleFilter('All')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedMuscle === 'All' && styles.filterChipTextActive,
                ]}
              >
                {t('all')}
              </Text>
            </TouchableOpacity>

            {MUSCLE_GROUPS.map((muscle) => (
              <TouchableOpacity
                key={muscle}
                style={[
                  styles.filterChip,
                  selectedMuscle === muscle && styles.filterChipActive,
                ]}
                onPress={() => handleMuscleFilter(muscle)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedMuscle === muscle && styles.filterChipTextActive,
                  ]}
                >
                  {muscle}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Exercise List */}
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isSelected = selectedExercises.includes(item.id);

            return (
              <TouchableOpacity
                style={[styles.exerciseCard, isSelected && styles.exerciseCardSelected]}
                onPress={() => handleToggleExercise(item.id)}
              >
                <View style={styles.exerciseCardInner}>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{item.name}</Text>
                    <View style={styles.exerciseMeta}>
                      <Text style={styles.exerciseMetaText}>{item.category}</Text>
                      {item.equipment && (
                        <>
                          <Text style={styles.exerciseMetaSeparator}>•</Text>
                          <Text style={styles.exerciseMetaText}>{item.equipment}</Text>
                        </>
                      )}
                    </View>
                  </View>

                  <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                    {isSelected && <IconCheck size={16} color={COLORS.backgroundCanvas} />}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />

        {/* Bottom CTA */}
        {selectedExercises.length > 0 && (
          <View style={[styles.bottomCTA, { paddingBottom: insets.bottom || 16 }]}>
            <TouchableOpacity style={styles.ctaButton} onPress={handleContinue}>
              <Text style={styles.ctaButtonText}>
                {t('continue')} ({selectedExercises.length})
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // Configure screen
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => setShowExercisePicker(true)} style={styles.backButton}>
          <IconArrowLeft size={24} color={LIGHT_COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('configureWorkout')}</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Workout Name Input */}
        <View style={styles.section}>
          <Text style={styles.label}>{t('workoutName')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('workoutNamePlaceholder')}
            placeholderTextColor={LIGHT_COLORS.textMeta}
            value={workoutName}
            onChangeText={setWorkoutName}
            autoFocus
          />
        </View>

        {/* Warm-up Section */}
        <View style={styles.section}>
          <WarmupItemEditor 
            warmupItems={warmupItems}
            onUpdate={setWarmupItems}
          />
        </View>

        {/* Selected Exercises */}
        <View style={styles.section}>
          <Text style={styles.label}>
            {t('exercises')} ({selectedExerciseObjects.length})
          </Text>

          {selectedExerciseObjects.map((exercise) => (
            <View key={exercise.id} style={styles.selectedExerciseCard}>
              <View style={styles.selectedExerciseCardInner}>
                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseMetaText}>{exercise.category}</Text>
                </View>

                <TouchableOpacity onPress={() => handleRemoveExercise(exercise.id)}>
                  <IconClose size={20} color={LIGHT_COLORS.textMeta} />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={styles.addMoreButton}
            onPress={() => setShowExercisePicker(true)}
          >
            <IconAdd size={20} color={LIGHT_COLORS.accentPrimary} />
            <Text style={styles.addMoreButtonText}>{t('addMoreExercises')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save Button */}
      <View style={[styles.bottomCTA, { paddingBottom: insets.bottom || 16 }]}>
        <TouchableOpacity style={styles.ctaButton} onPress={handleSaveWorkout}>
          <Text style={styles.ctaButtonText}>{t('saveWorkout')}</Text>
        </TouchableOpacity>
      </View>
      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIGHT_COLORS.backgroundCanvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.h1,
    color: LIGHT_COLORS.secondary,
  },
  searchContainer: {
    paddingHorizontal: SPACING.xxl,
    marginBottom: SPACING.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LIGHT_COLORS.buttonBg,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    height: 48,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.secondary,
  },
  filtersContainer: {
    marginBottom: SPACING.lg,
  },
  filtersContent: {
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: LIGHT_COLORS.buttonBg,
  },
  filterChipActive: {
    backgroundColor: LIGHT_COLORS.accentPrimary,
  },
  filterChipText: {
    ...TYPOGRAPHY.metaBold,
    color: LIGHT_COLORS.secondary,
  },
  filterChipTextActive: {
    color: COLORS.backgroundCanvas,
  },
  listContent: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 120,
  },
  exerciseCard: {
    marginBottom: SPACING.md,
    backgroundColor: CARDS.cardDeepDimmed.outer.backgroundColor,
    borderRadius: CARDS.cardDeepDimmed.outer.borderRadius,
    borderCurve: CARDS.cardDeepDimmed.outer.borderCurve,
    borderWidth: CARDS.cardDeepDimmed.outer.borderWidth,
    borderColor: CARDS.cardDeepDimmed.outer.borderColor,
    overflow: CARDS.cardDeepDimmed.outer.overflow,
  },
  exerciseCardSelected: {
    borderColor: LIGHT_COLORS.accentPrimary,
    borderWidth: 2,
  },
  exerciseCardInner: {
    ...CARDS.cardDeepDimmed.inner,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.xs,
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseMetaText: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
  },
  exerciseMetaSeparator: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
    marginHorizontal: SPACING.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: LIGHT_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: LIGHT_COLORS.accentPrimary,
    borderColor: LIGHT_COLORS.accentPrimary,
  },
  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    backgroundColor: LIGHT_COLORS.backgroundCanvas,
  },
  ctaButton: {
    height: 56,
    backgroundColor: LIGHT_COLORS.secondary,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.backgroundCanvas,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 120,
  },
  section: {
    marginBottom: SPACING.xxxl,
  },
  label: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.lg,
  },
  input: {
    height: 56,
    backgroundColor: LIGHT_COLORS.buttonBg,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.secondary,
  },
  selectedExerciseCard: {
    marginBottom: SPACING.md,
    backgroundColor: CARDS.cardDeepDimmed.outer.backgroundColor,
    borderRadius: CARDS.cardDeepDimmed.outer.borderRadius,
    borderCurve: CARDS.cardDeepDimmed.outer.borderCurve,
    borderWidth: CARDS.cardDeepDimmed.outer.borderWidth,
    borderColor: CARDS.cardDeepDimmed.outer.borderColor,
    overflow: CARDS.cardDeepDimmed.outer.overflow,
  },
  selectedExerciseCardInner: {
    ...CARDS.cardDeepDimmed.inner,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    height: 48,
    backgroundColor: LIGHT_COLORS.buttonBg,
    borderRadius: BORDER_RADIUS.md,
  },
  addMoreButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: LIGHT_COLORS.accentPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  modalContent: {
    width: '100%',
    backgroundColor: COLORS.backgroundCanvas,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
  },
  modalSubtitle: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
    marginBottom: SPACING.xl,
  },
  modalButton: {
    height: 56,
    backgroundColor: LIGHT_COLORS.secondary,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  modalButtonSecondary: {
    backgroundColor: LIGHT_COLORS.buttonBg,
  },
  modalButtonText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.backgroundCanvas,
  },
  modalButtonTextSecondary: {
    color: LIGHT_COLORS.secondary,
  },
  modalButtonTextLink: {
    ...TYPOGRAPHY.metaBold,
    color: LIGHT_COLORS.accentPrimary,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});
