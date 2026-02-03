import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform, UIManager } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS, BUTTONS } from '../constants';
import { IconArrowLeft, IconCalendar, IconTrash, IconEdit, IconAdd } from '../components/icons';
import { useTranslation } from '../i18n/useTranslation';
import type { WorkoutTemplateExercise } from '../types/training';
import { DraggableExerciseList, type DraggableExerciseItem, ExerciseSettingsSheet, AddToCycleSheet } from '../components/exercises';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type RouteParams = {
  WorkoutTemplateDetail: {
    templateId: string;
  };
};

export function WorkoutTemplateDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'WorkoutTemplateDetail'>>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  
  const { workoutTemplates, getWorkoutTemplate, deleteWorkoutTemplate, updateWorkoutTemplate, scheduleWorkout, exercises } = useStore();
  
  const templateId = route.params?.templateId;
  const template = getWorkoutTemplate(templateId);
  
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [addToCycleExerciseId, setAddToCycleExerciseId] = useState<string | null>(null);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleReorderExercises = async (reorderedExercises: DraggableExerciseItem[]) => {
    if (!template) return;
    
    // Sort original items to match the order we used when creating exerciseDetails
    const sortedItems = [...template.items].sort((a, b) => a.order - b.order);
    
    // Map back to WorkoutTemplateExercise format
    // The ID format is `${exerciseId}-${originalIndex}`, so extract the index
    const updatedItems = reorderedExercises.map((item, newIndex) => {
      // Extract original index from the composite ID (format: "exerciseId-index")
      const originalIndex = parseInt(item.id.split('-').pop() || '0', 10);
      const originalItem = sortedItems[originalIndex];
      
      return {
        ...originalItem,
        order: newIndex,
      };
    });
    
    await updateWorkoutTemplate(template.id, { items: updatedItems });
  };

  const handleEditExercise = (compositeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingExerciseId(compositeId);
    setSelectedExerciseId(null); // Close the action icons
  };

  const handleSaveExercise = async (compositeId: string, updates: Partial<WorkoutTemplateExercise>) => {
    if (!template) return;
    
    // Extract original index from composite ID
    const originalIndex = parseInt(compositeId.split('-').pop() || '0', 10);
    
    // Sort items to match the order we used when creating exerciseDetails
    const sortedItems = [...template.items].sort((a, b) => a.order - b.order);
    
    // Update the specific exercise at that index
    const updatedItems = sortedItems.map((item, idx) => {
      if (idx === originalIndex) {
        return {
          ...item,
          ...updates,
        };
      }
      return item;
    });
    
    await updateWorkoutTemplate(template.id, { items: updatedItems });
    setEditingExerciseId(null);
  };

  const handleAddToCycle = (compositeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddToCycleExerciseId(compositeId);
  };

  const handleAddExerciseToCycle = async (compositeId: string, newExercise: Omit<WorkoutTemplateExercise, 'id' | 'order'>) => {
    if (!template) return;
    
    // Extract original index from composite ID
    const originalIndex = parseInt(compositeId.split('-').pop() || '0', 10);
    
    // Sort items to match the order we used when creating exerciseDetails
    const sortedItems = [...template.items].sort((a, b) => a.order - b.order);
    const targetExercise = sortedItems[originalIndex];
    
    // Determine cycleId and cycleOrder
    let cycleId = targetExercise.cycleId;
    let cycleOrder = 0;
    
    if (!cycleId) {
      // Create new cycle
      cycleId = `cycle-${Date.now()}`;
      // Update target exercise to be part of the cycle
      sortedItems[originalIndex] = {
        ...targetExercise,
        cycleId,
        cycleOrder: 0,
      };
      cycleOrder = 1;
    } else {
      // Find the highest cycleOrder in this cycle and add 1
      const cycleExercises = sortedItems.filter(item => item.cycleId === cycleId);
      cycleOrder = Math.max(...cycleExercises.map(ex => ex.cycleOrder ?? 0)) + 1;
    }
    
    // Create the new exercise with cycle info
    const newItem: WorkoutTemplateExercise = {
      id: `exercise-${Date.now()}-${Math.random()}`,
      ...newExercise,
      cycleId,
      cycleOrder,
      order: originalIndex + 1, // Insert right after the target exercise
    };
    
    // Insert the new exercise right after the target
    const updatedItems = [
      ...sortedItems.slice(0, originalIndex + 1),
      newItem,
      ...sortedItems.slice(originalIndex + 1),
    ].map((item, idx) => ({
      ...item,
      order: idx,
    }));
    
    await updateWorkoutTemplate(template.id, { items: updatedItems });
    setAddToCycleExerciseId(null);
  };


  const handleEditWorkoutName = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(t('editWorkoutTitle'), t('featureComingSoon'));
  };

  const handleDeleteExercise = (compositeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      t('deleteExerciseTitle'),
      t('deleteExerciseMessage'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            if (template) {
              // Extract original index from composite ID (format: "exerciseId-index")
              const originalIndex = parseInt(compositeId.split('-').pop() || '0', 10);
              
              // Sort items to match the order we used when creating exerciseDetails
              const sortedItems = [...template.items].sort((a, b) => a.order - b.order);
              
              // Remove the specific exercise at that index
              const updatedItems = sortedItems
                .filter((_, idx) => idx !== originalIndex)
                .map((item, newIndex) => ({
                  ...item,
                  order: newIndex, // Re-index after deletion
                }));
              
              await updateWorkoutTemplate(template.id, {
                items: updatedItems,
              });
              
              // If no exercises left, delete the template
              if (updatedItems.length === 0) {
                Alert.alert(
                  t('noExercisesLeft'),
                  t('deleteTemplateInstead'),
                  [
                    { text: t('cancel'), style: 'cancel' },
                    {
                      text: t('deleteWorkout'),
                      style: 'destructive',
                      onPress: async () => {
                        await deleteWorkoutTemplate(template.id);
                        navigation.goBack();
                      },
                    },
                  ]
                );
              }
            }
          },
        },
      ]
    );
  };

  const handleMoveExercise = async (exerciseId: string, direction: 'up' | 'down') => {
    if (!template) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const currentItems = [...template.items].sort((a, b) => a.order - b.order);
    const currentIndex = currentItems.findIndex(item => item.exerciseId === exerciseId);
    
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === currentItems.length - 1) return;
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    // Swap items
    [currentItems[currentIndex], currentItems[targetIndex]] = 
      [currentItems[targetIndex], currentItems[currentIndex]];
    
    // Update order values
    const updatedItems = currentItems.map((item, index) => ({
      ...item,
      order: index,
    }));
    
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await updateWorkoutTemplate(template.id, { items: updatedItems });
  };

  const handleSchedule = async () => {
    if (!template) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // For v1, just schedule for today
    const today = dayjs().format('YYYY-MM-DD');
    
    const result = await scheduleWorkout(today, template.id, 'manual');
    
    if (!result.success && result.conflict) {
      Alert.alert(
        t('conflictExists'),
        t('workoutExistsOn').replace('{date}', today),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('replaceIt'),
            onPress: async () => {
              await scheduleWorkout(today, template.id, 'manual', undefined, 'replace');
              Alert.alert(t('workoutScheduled'), t('workoutScheduledFor').replace('{date}', t('today')));
              navigation.goBack();
            },
          },
        ]
      );
    } else {
      Alert.alert(
        t('workoutScheduled'),
        t('workoutScheduledFor').replace('{date}', t('today')),
        [{ text: t('ok'), onPress: () => navigation.goBack() }]
      );
    }
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      t('deleteWorkout'),
      t('deleteWorkoutMessage'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            if (template) {
              await deleteWorkoutTemplate(template.id);
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  if (!template) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <IconArrowLeft size={24} color={COLORS.text} />
            </TouchableOpacity>
            <View style={styles.backButton} />
          </View>
          <View style={styles.pageTitleContainer}>
            <Text style={styles.pageTitle}>{t('workoutNotFound')}</Text>
          </View>
        </View>
      </View>
    );
  }

  // Get exercise details
  // Format exercises for DraggableExerciseList
  // Sort by order first to get a stable array
  const sortedItems = [...template.items].sort((a, b) => a.order - b.order);
  
  const exerciseDetails: DraggableExerciseItem[] = sortedItems.map((item, index) => {
    const exercise = exercises.find(e => e.id === item.exerciseId);
    return {
      id: `${item.exerciseId}-${index}`, // Unique ID: exerciseId + position in sorted array
      exerciseId: item.exerciseId,
      name: exercise?.name || t('unknownExercise'),
      order: index,
      cycleId: item.cycleId,
      cycleOrder: item.cycleOrder,
    };
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        {/* Top Bar with Back and Delete buttons */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <IconArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.headerDeleteButton}>
            <Text style={styles.deleteLabel}>{t('deleteWorkout')}</Text>
            <IconTrash size={24} color={COLORS.error} />
          </TouchableOpacity>
        </View>
        
        {/* Page Title */}
        <TouchableOpacity 
          style={styles.pageTitleContainer}
          onPress={handleEditWorkoutName}
          activeOpacity={0.7}
        >
          <View style={styles.pageTitleRow}>
            <Text style={styles.pageTitle}>{template.name}</Text>
            <IconEdit size={20} color={COLORS.textMeta} />
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>{t('timesCompleted')}</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>
              {dayjs(template.createdAt).format('MMM D, YYYY')}
            </Text>
            <Text style={styles.statLabel}>{t('created')}</Text>
          </View>
        </View>

        {/* Exercises List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('listOfExercises')}</Text>
          
          <DraggableExerciseList
            exercises={exerciseDetails}
            onReorder={handleReorderExercises}
            onEdit={handleEditExercise}
            onDelete={handleDeleteExercise}
            selectedExerciseId={selectedExerciseId}
            onSelectExercise={setSelectedExerciseId}
            actionButtons={['edit', 'delete']}
            scrollEnabled={scrollEnabled}
            onScrollEnabledChange={setScrollEnabled}
            onAddToCycle={handleAddToCycle}
          />
          
          {/* Add Exercise Button */}
          <TouchableOpacity
            style={styles.addExerciseButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert(t('addExercise'), t('featureComingSoon'));
            }}
            activeOpacity={1}
          >
            <IconAdd size={20} color={COLORS.text} />
            <Text style={styles.addExerciseText}>{t('addExercise')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomCTA, { paddingBottom: insets.bottom || 16 }]}>
        <TouchableOpacity style={styles.scheduleButton} onPress={handleSchedule}>
          <IconCalendar size={20} color={COLORS.backgroundCanvas} />
          <Text style={styles.scheduleButtonText}>{t('scheduleForToday')}</Text>
        </TouchableOpacity>
      </View>

      {/* Exercise Settings Sheet */}
      {editingExerciseId && (() => {
        const originalIndex = parseInt(editingExerciseId.split('-').pop() || '0', 10);
        const sortedItems = [...template.items].sort((a, b) => a.order - b.order);
        const editingItem = sortedItems[originalIndex];
        const exerciseData = exercises.find(e => e.id === editingItem?.exerciseId);
        
        if (!editingItem || !exerciseData) return null;
        
        return (
          <ExerciseSettingsSheet
            exercise={{
              ...editingItem,
              name: exerciseData.name,
            }}
            visible={true}
            onClose={() => setEditingExerciseId(null)}
            onSave={(updates) => handleSaveExercise(editingExerciseId, updates)}
          />
        );
      })()}

      {/* Add to Cycle Sheet */}
      {addToCycleExerciseId && (() => {
        const originalIndex = parseInt(addToCycleExerciseId.split('-').pop() || '0', 10);
        const sortedItems = [...template.items].sort((a, b) => a.order - b.order);
        const targetExercise = sortedItems[originalIndex];
        
        if (!targetExercise) return null;
        
        return (
          <AddToCycleSheet
            visible={true}
            onClose={() => setAddToCycleExerciseId(null)}
            onAdd={(newExercise) => handleAddExerciseToCycle(addToCycleExerciseId, newExercise)}
            cycleSets={targetExercise.sets}
          />
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  header: {
    paddingBottom: SPACING.md,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -12,
  },
  headerDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    height: 48,
    marginRight: -12,
  },
  deleteLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.error,
  },
  pageTitleContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    marginBottom: SPACING.xxxl + SPACING.sm, // 40px between title and stats
  },
  pageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  pageTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.xxxl,
    marginBottom: SPACING.xxxl,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    textAlign: 'center',
  },
  section: {
    marginBottom: SPACING.xxxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  addExerciseButton: {
    width: '100%',
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.textMeta,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  addExerciseText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
  },
  scheduleButton: {
    ...BUTTONS.primaryButtonLabeled,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  scheduleButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.backgroundCanvas,
  },
});
