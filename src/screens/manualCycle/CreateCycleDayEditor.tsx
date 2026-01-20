import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCreateCycleDraftStore } from '../../store/useCreateCycleDraftStore';
import { formatWeekdayFull, getExerciseSummary } from '../../utils/manualCycleUtils';
import { Weekday, ExerciseBlock } from '../../types/manualCycle';
import { COLORS, SPACING, TYPOGRAPHY, CARDS, BORDER_RADIUS } from '../../constants';
import { IconAdd, IconTrash, IconArrowLeft, IconChevronDown, IconEdit } from '../../components/icons';
import { ExerciseEditorBottomSheet } from '../../components/manualCycle/ExerciseEditorBottomSheet';
import { useStore } from '../../store';
import { BottomDrawer } from '../../components/common/BottomDrawer';
import { useTranslation } from '../../i18n/useTranslation';

interface CreateCycleDayEditorProps {
  navigation: any;
  route: {
    params: {
      weekday: Weekday;
    };
  };
}

export function CreateCycleDayEditor({ navigation, route }: CreateCycleDayEditorProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { weekday } = route.params;

  const { workouts, setWorkoutDayName, addExerciseToDay, removeExerciseFromDay } =
    useCreateCycleDraftStore();

  const { exercises: exerciseLibrary } = useStore();

  const workout = workouts.find((w) => w.weekday === weekday);

  const [workoutName, setWorkoutName] = useState(workout?.name || formatWeekdayFull(weekday));
  const [isEditingName, setIsEditingName] = useState(false);
  const [showExerciseDrawer, setShowExerciseDrawer] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMuscles, setExpandedMuscles] = useState<Record<string, boolean>>({});
  const [selectedExercise, setSelectedExercise] = useState<ExerciseBlock | null>(null);
  const [showExerciseEditor, setShowExerciseEditor] = useState(false);
  const nameInputRef = useRef<TextInput>(null);
  const hasFocusedInitialNameRef = useRef(false);

  useEffect(() => {
    if (hasFocusedInitialNameRef.current) return;
    const defaultName = formatWeekdayFull(weekday);
    if (!workout?.name || workout?.name === defaultName) {
      hasFocusedInitialNameRef.current = true;
      setIsEditingName(true);
      requestAnimationFrame(() => {
        nameInputRef.current?.focus();
      });
    }
  }, [weekday, workout?.name]);

  const handleSaveDay = () => {
    if (workoutName.trim()) {
      setWorkoutDayName(weekday, workoutName.trim());
    }
    navigation.goBack();
  };

  const handleAddExercise = (exerciseId: string) => {
    const newExercise = addExerciseToDay(weekday, exerciseId);
    setShowExerciseDrawer(false);
    setShowSearchInput(false);
    setSearchQuery('');
    setExpandedMuscles({});
    if (newExercise) {
      setSelectedExercise(newExercise);
      setShowExerciseEditor(true);
    }
  };

  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) {
      return exerciseLibrary;
    }
    const query = searchQuery.toLowerCase();
    return exerciseLibrary.filter((exercise) =>
      exercise.name.toLowerCase().includes(query)
    );
  }, [exerciseLibrary, searchQuery]);

  const groupedExercises = useMemo(() => {
    const groups: Record<string, typeof filteredExercises> = {};
    filteredExercises.forEach(exercise => {
      const muscle = exercise.category || 'Other';
      if (!groups[muscle]) {
        groups[muscle] = [];
      }
      groups[muscle].push(exercise);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredExercises]);

  const handleEditExercise = (exercise: ExerciseBlock) => {
    setSelectedExercise(exercise);
    setShowExerciseEditor(true);
  };

  const handleDeleteExercise = (exerciseBlockId: string) => {
    Alert.alert(t('deleteExerciseTitle'), t('deleteExerciseMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => removeExerciseFromDay(weekday, exerciseBlockId),
      },
    ]);
  };

  const handleCloseEditor = () => {
    setSelectedExercise(null);
    setShowExerciseEditor(false);
  };

  return (
    <View style={styles.gradient}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              activeOpacity={1}
            >
              <IconArrowLeft size={24} color={COLORS.text} />
            </TouchableOpacity>
            <View style={{ width: 48 }} />
          </View>
          <TouchableOpacity
            style={styles.pageTitleContainer}
            onPress={() => setIsEditingName(true)}
            activeOpacity={1}
          >
            {isEditingName ? (
              <TextInput
                ref={nameInputRef}
                style={styles.pageTitleInput}
                value={workoutName}
                onChangeText={setWorkoutName}
                onBlur={() => setIsEditingName(false)}
                autoFocus
                placeholder={t('workoutNamePlaceholder')}
                placeholderTextColor={COLORS.textMeta}
              />
            ) : (
              <View style={styles.pageTitleRow}>
                <Text style={styles.pageTitle}>{workoutName}</Text>
                <IconEdit size={20} color={COLORS.textMeta} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} bounces={false}>
          {/* Exercises */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('exercises')}</Text>
            {workout?.exercises.map((exercise) => {
              const exerciseData = exerciseLibrary.find((e) => e.id === exercise.exerciseId);
              const summary = getExerciseSummary(exercise.weeks);

              return (
                <TouchableOpacity
                  key={exercise.id}
                  style={styles.exerciseCard}
                  onPress={() => handleEditExercise(exercise)}
                  activeOpacity={1}
                >
                  <View style={styles.exerciseCardContent}>
                    <Text style={styles.exerciseName}>
                      {exerciseData?.name || t('unknownExercise')}
                    </Text>
                    <Text style={styles.exerciseSummary}>{summary}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteExercise(exercise.id)}
                    activeOpacity={1}
                  >
                    <IconTrash size={18} color={COLORS.textMeta} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.addExerciseCardButton}
              onPress={() => setShowExerciseDrawer(true)}
              activeOpacity={1}
            >
              <IconAdd size={20} color={COLORS.text} />
              <Text style={styles.addExerciseCardText}>{t('addExercise')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={styles.stickyFooter}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveDay}
            activeOpacity={1}
          >
            <Text style={styles.saveButtonText}>{t('saveDay')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Exercise Picker Drawer */}
      <BottomDrawer
        visible={showExerciseDrawer}
        onClose={() => setShowExerciseDrawer(false)}
        maxHeight="90%"
        fixedHeight={true}
        bottomOffset={8}
        showHandle={false}
        scrollable={false}
        contentStyle={styles.drawerContent}
      >
        <View style={styles.drawerContent}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>{t('addExerciseTitle')}</Text>
            <TouchableOpacity
              onPress={() => {
                setShowSearchInput(prev => !prev);
                if (showSearchInput) {
                  setSearchQuery('');
                }
              }}
              style={styles.searchButton}
              activeOpacity={1}
            >
              <Text style={styles.searchButtonText}>🔍</Text>
            </TouchableOpacity>
          </View>

          {showSearchInput && (
            <View style={styles.swapSearchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.swapSearchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('searchExercisesPlaceholder')}
                placeholderTextColor={COLORS.textMeta}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  activeOpacity={1}
                >
                  <Text style={styles.clearIcon}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerScrollContent} bounces={true}>
            {groupedExercises.map(([muscle, muscleExercises]) => {
              const isExpanded = !!expandedMuscles[muscle];
              return (
                <View key={muscle} style={styles.muscleSection}>
                  <View style={styles.muscleCard}>
                    <TouchableOpacity
                      style={styles.muscleHeader}
                      onPress={() =>
                        setExpandedMuscles(prev => ({ ...prev, [muscle]: !isExpanded }))
                      }
                      activeOpacity={1}
                    >
                      <Text style={styles.muscleTitle}>{muscle}</Text>
                      <IconChevronDown
                        size={20}
                        color={COLORS.textMeta}
                        style={{
                          transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
                        }}
                      />
                    </TouchableOpacity>
                    {isExpanded && (
                      <View style={styles.muscleContent}>
                        {muscleExercises.map((exercise, exerciseIndex) => (
                          <View key={exercise.id}>
                            <TouchableOpacity
                              style={styles.swapExerciseItem}
                              onPress={() => handleAddExercise(exercise.id)}
                              activeOpacity={1}
                            >
                              <Text style={styles.swapExerciseName}>{exercise.name}</Text>
                            </TouchableOpacity>
                            {exerciseIndex < muscleExercises.length - 1 && (
                              <View style={styles.muscleExerciseDivider} />
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </BottomDrawer>

      {/* Exercise Editor Bottom Sheet */}
      {selectedExercise && (
        <ExerciseEditorBottomSheet
          weekday={weekday}
          exerciseBlock={selectedExercise}
          visible={showExerciseEditor}
          onClose={handleCloseEditor}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: SPACING.lg,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  backButton: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -4,
  },
  pageTitleContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  pageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
  },
  pageTitleInput: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.xxl,
    paddingBottom: 140,
  },
  section: {
    marginBottom: SPACING.xxxl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: SPACING.lg,
  },
  addExerciseCardButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.textMeta,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.sm,
  },
  addExerciseCardText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  exerciseCard: {
    ...CARDS.cardDeep.outer,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  exerciseCardContent: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  exerciseSummary: {
    fontSize: 13,
    color: COLORS.textMeta,
  },
  deleteButton: {
    padding: 8,
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.md,
  },
  saveButton: {
    backgroundColor: COLORS.accentPrimary,
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  saveButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    fontWeight: '600',
    color: COLORS.backgroundCanvas,
  },
  drawerContent: {
    flex: 1,
    minHeight: 0,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  drawerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  searchButton: {
    padding: SPACING.xs,
  },
  searchButtonText: {
    fontSize: 20,
    color: COLORS.text,
  },
  swapSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundCanvas,
    borderRadius: BORDER_RADIUS.md,
    borderCurve: 'continuous',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginHorizontal: SPACING.xxl,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  searchIcon: {
    fontSize: 18,
    color: COLORS.textMeta,
  },
  swapSearchInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  clearIcon: {
    fontSize: 16,
    color: COLORS.textMeta,
  },
  drawerScroll: {
    flex: 1,
    minHeight: 0,
  },
  drawerScrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xl,
  },
  muscleSection: {
    marginBottom: 12,
  },
  muscleCard: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  muscleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  muscleTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
  },
  muscleContent: {},
  swapExerciseItem: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  swapExerciseName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  muscleExerciseDivider: {
    height: 1,
    backgroundColor: COLORS.borderDimmed,
    marginHorizontal: SPACING.lg,
    marginVertical: 4,
  },
});

