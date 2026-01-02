import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconArrowLeft, IconShare } from '../components/icons';
import type { WorkoutTemplate } from '../types';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

interface CycleDetailScreenProps {
  route: {
    params: {
      cycleId: string;
    };
  };
  navigation: any;
}

// Light theme colors
const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  backgroundContainer: '#CDCABB',
  secondary: '#1B1B1B',
  textSecondary: '#3C3C43',
  textMeta: '#817B77',
  border: '#C7C7CC',
  accentPrimary: '#FF6B35',
  success: '#227132',
  error: '#FF3B30',
};

export function CycleDetailScreen({ route, navigation }: CycleDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { cycleId } = route.params;
  const { cycles, exercises, deleteCycle, getExerciseProgress, workoutAssignments } = useStore();
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutTemplate | null>(null);
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number>(1);
  
  const handleDeleteCycle = () => {
    Alert.alert(
      'Delete Cycle',
      `Are you sure you want to delete Cycle ${cycle?.cycleNumber}? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCycle(cycleId);
            navigation.goBack();
          },
        },
      ]
    );
  };
  
  const cycle = cycles.find(c => c.id === cycleId);
  
  const handleExportData = async () => {
    if (!cycle) return;
    
    let exportText = `CYCLE ${cycle.cycleNumber}\n`;
    exportText += `Period: ${dayjs(cycle.startDate).format('MMM D, YYYY')} - ${cycle.endDate ? dayjs(cycle.endDate).format('MMM D, YYYY') : 'In Progress'}\n`;
    exportText += `Status: ${cycle.isActive ? 'Active' : 'Completed'}\n`;
    exportText += `\n${'='.repeat(50)}\n\n`;
    
    // Export data for each week
    for (let weekIndex = 0; weekIndex < cycle.lengthInWeeks; weekIndex++) {
      const weekStartDate = dayjs(cycle.startDate).add(weekIndex, 'week');
      const weekEndDate = weekStartDate.add(6, 'days');
      
      exportText += `WEEK ${weekIndex + 1}\n`;
      exportText += `${weekStartDate.format('MMM D')} - ${weekEndDate.format('MMM D, YYYY')}\n`;
      exportText += `${'-'.repeat(50)}\n\n`;
      
      // Get workouts for this week
      const weekWorkouts = cycle.workoutTemplates.filter(
        workout => workout.week === weekIndex + 1 || !workout.week
      );
      
      for (const workout of weekWorkouts) {
        exportText += `  ${workout.name}\n`;
        
        // Find assignments for this workout in this week
        const weekAssignments = workoutAssignments.filter(assignment => {
          const assignmentDate = dayjs(assignment.date);
          return assignment.workoutId === workout.id &&
                 (assignmentDate.isAfter(weekStartDate, 'day') || assignmentDate.isSame(weekStartDate, 'day')) &&
                 (assignmentDate.isBefore(weekEndDate, 'day') || assignmentDate.isSame(weekEndDate, 'day'));
        });
        
        // Export exercises
        for (const exercise of workout.exercises) {
          const exerciseData = exercises.find(e => e.id === exercise.exerciseId);
          exportText += `    - ${exerciseData?.name || 'Unknown Exercise'}\n`;
          exportText += `      Target: ${exercise.targetSets} sets × ${exercise.targetReps} reps\n`;
          
          // Check if there's saved progress for any assignment
          let foundProgress = false;
          for (const assignment of weekAssignments) {
            const workoutKey = `${workout.id}-${assignment.date}`;
            const progress = getExerciseProgress(workoutKey, exercise.id);
            
            if (progress && progress.sets && progress.sets.length > 0) {
              foundProgress = true;
              exportText += `      Completed (${dayjs(assignment.date).format('MMM D')}):\n`;
              progress.sets.forEach((set, idx) => {
                exportText += `        Set ${idx + 1}: ${set.weight}lbs × ${set.reps} reps${set.completed ? ' ✓' : ''}\n`;
              });
            }
          }
          
          if (!foundProgress) {
            exportText += `      No logged data\n`;
          }
          
          exportText += `\n`;
        }
        
        exportText += `\n`;
      }
      
      exportText += `\n`;
    }
    
    try {
      await Share.share({
        message: exportText,
        title: `Cycle ${cycle.cycleNumber} Data`
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to export data');
    }
  };
  
  if (!cycle) {
    return (
      <LinearGradient
        colors={['#E3E6E0', '#D4D6D1']}
        style={styles.gradient}
      >
        <View style={styles.container}>
          <Text style={styles.errorText}>Cycle not found</Text>
        </View>
      </LinearGradient>
    );
  }
  
  return (
    <LinearGradient
      colors={['#E3E6E0', '#D4D6D1']}
      style={styles.gradient}
    >
      <View style={styles.container}>
        {/* Header (includes topBar with back button + title) */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          {/* Back Button and Export Button */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <IconArrowLeft size={24} color={LIGHT_COLORS.text} />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={handleExportData} style={styles.exportButton}>
              <Text style={styles.exportButtonText}>Export Data</Text>
              <IconShare size={16} color={LIGHT_COLORS.secondary} />
            </TouchableOpacity>
          </View>
          
          {/* Page Title */}
          <View style={styles.pageTitleContainer}>
            <Text style={styles.pageTitle}>Cycle {cycle.cycleNumber}</Text>
          </View>
        </View>
      
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        stickyHeaderIndices={cycle.workoutTemplates.length === 0 ? [] : Array.from({ length: cycle.lengthInWeeks }, (_, i) => i * 2)}
      >
        
        {/* Workouts */}
        {cycle.workoutTemplates.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No workouts yet</Text>
            <Text style={styles.emptySubtext}>Create a cycle to see workouts</Text>
          </View>
        ) : (
          Array.from({ length: cycle.lengthInWeeks }).flatMap((_, weekIndex) => {
            const weekStartDate = dayjs(cycle.startDate).add(weekIndex, 'week');
            const isLastWeek = weekIndex === cycle.lengthInWeeks - 1;
            
            return [
              /* Week Label - Sticky Header that looks like top of card */
              <View key={`week-header-${weekIndex}`} style={styles.stickyWeekHeaderWrapper}>
                <View style={styles.stickyWeekHeader}>
                  <View style={styles.weekLabelContainer}>
                    <Text style={styles.weekLabel}>
                      Week {weekIndex + 1}
                    </Text>
                    <Text style={styles.weekDate}>
                      {weekStartDate.format('MMM D, YYYY')}
                    </Text>
                  </View>
                  {/* Divider after week label */}
                  <View style={styles.weekDividerContainer}>
                    <View style={styles.dividerTop} />
                    <View style={styles.dividerBottom} />
                  </View>
                </View>
              </View>,
              
              /* Workouts Container - Appears connected to header */
              <View key={`week-content-${weekIndex}`} style={styles.weekContainer}>
                <View style={styles.weekWorkoutsWrapper}>
                  <View style={styles.weekWorkoutsCard}>
                    <View style={styles.weekWorkoutsInner}>
                          {/* Workouts */}
                          {cycle.workoutTemplates
                            .filter(workout => workout.week === weekIndex + 1 || !workout.week)
                            .map((workout, workoutIndex, filteredWorkouts) => {
                            const isLastWorkout = workoutIndex === filteredWorkouts.length - 1;
                            const isFirstWorkout = workoutIndex === 0;
                            
                            return (
                              <View key={workout.id}>
                                <TouchableOpacity
                                  style={[
                                    styles.workoutRow, 
                                    isFirstWorkout && styles.workoutRowFirst,
                                    isLastWorkout && styles.workoutRowLast
                                  ]}
                                  onPress={() => {
                                    setSelectedWorkout(workout);
                                    setSelectedWeekNumber(weekIndex + 1);
                                  }}
                                  activeOpacity={1}
                                >
                                  <View style={styles.workoutInfo}>
                                    <Text style={styles.workoutName}>{workout.name}</Text>
                                  </View>
                                  <View style={styles.workoutTriangle} />
                                </TouchableOpacity>
                                {!isLastWorkout && (
                                  <View style={styles.dividerContainer}>
                                    <View style={styles.dividerTop} />
                                    <View style={styles.dividerBottom} />
                                  </View>
                                )}
                              </View>
                            );
                          })}
                    </View>
                  </View>
                </View>
              </View>
            ];
          })
        )}
      </ScrollView>
      
      {/* Delete Button - Sticky at bottom */}
      <View style={styles.deleteButtonContainer}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteCycle}
          activeOpacity={1}
        >
          <Text style={styles.deleteButtonText}>Delete Cycle</Text>
        </TouchableOpacity>
      </View>
      
      {/* Workout Details Bottom Sheet */}
      <Modal
        visible={!!selectedWorkout}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedWorkout(null)}
      >
        <View style={styles.bottomSheetOverlay}>
          <TouchableOpacity 
            style={styles.overlayTouchable} 
            activeOpacity={1} 
            onPress={() => setSelectedWorkout(null)}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.handle} />
            
            <View style={styles.sheetContent}>
              <Text style={styles.sheetTitle}>{selectedWorkout?.name}</Text>
              <Text style={styles.sheetSubtitle}>Week {selectedWeekNumber}</Text>
              
              {selectedWorkout?.exercises.length === 0 ? (
                <View style={styles.emptyExercises}>
                  <Text style={styles.emptyExercisesText}>No exercises added yet</Text>
                </View>
              ) : (
                <ScrollView style={styles.exercisesList}>
                  {selectedWorkout?.exercises.map((exercise, idx) => {
                    const exerciseData = exercises.find(e => e.id === exercise.exerciseId);
                    
                    // Find workout assignments for the selected week
                    const weekStartDate = dayjs(cycle.startDate).add(selectedWeekNumber - 1, 'week');
                    const weekEndDate = weekStartDate.add(6, 'day');
                    
                    const weekAssignments = workoutAssignments.filter(a => {
                      if (a.workoutTemplateId !== selectedWorkout.id || a.cycleId !== cycleId) {
                        return false;
                      }
                      const assignmentDate = dayjs(a.date);
                      return (assignmentDate.isAfter(weekStartDate, 'day') || assignmentDate.isSame(weekStartDate, 'day')) &&
                             (assignmentDate.isBefore(weekEndDate, 'day') || assignmentDate.isSame(weekEndDate, 'day'));
                    });
                    
                    // Find the assignment that has progress (completed workout)
                    let assignmentWithProgress = null;
                    let savedProgress = undefined;
                    
                    for (const assignment of weekAssignments) {
                      const workoutKey = `${selectedWorkout.id}-${assignment.date}`;
                      const progress = getExerciseProgress(workoutKey, exercise.id);
                      if (progress && progress.sets && progress.sets.length > 0) {
                        assignmentWithProgress = assignment;
                        savedProgress = progress;
                        break;
                      }
                    }
                    
                    console.log(`📊 Exercise ${exerciseData?.name} (Week ${selectedWeekNumber}):`, {
                      hasProgress: !!savedProgress,
                      sets: savedProgress?.sets || [],
                      weekAssignments: weekAssignments.length,
                      assignmentDate: assignmentWithProgress?.date,
                    });
                    
                    const isLastExercise = idx === selectedWorkout.exercises.length - 1;
                    
                    return (
                      <View key={exercise.id} style={[
                        styles.exerciseItem,
                        isLastExercise && { borderBottomWidth: 0 }
                      ]}>
                        <Text style={styles.exerciseName}>
                          {exerciseData?.name || 'Unknown Exercise'}
                        </Text>
                        {savedProgress?.sets && savedProgress.sets.length > 0 ? (
                          // Group consecutive sets with same weight and reps
                          <Text style={styles.exerciseDetails}>
                            {(() => {
                              const groupedSets: Array<{ count: number; reps: number; weight: number; completed: boolean }> = [];
                              
                              savedProgress.sets.forEach((set, idx) => {
                                const lastGroup = groupedSets[groupedSets.length - 1];
                                
                                // Check if this set matches the previous group
                                if (
                                  lastGroup &&
                                  lastGroup.reps === set.reps &&
                                  lastGroup.weight === set.weight &&
                                  lastGroup.completed === set.completed
                                ) {
                                  // Add to existing group
                                  lastGroup.count += 1;
                                } else {
                                  // Create new group
                                  groupedSets.push({
                                    count: 1,
                                    reps: set.reps,
                                    weight: set.weight,
                                    completed: set.completed,
                                  });
                                }
                              });
                              
                              return groupedSets.map((group, idx) => (
                                <Text 
                                  key={idx} 
                                  style={{ 
                                    color: group.completed ? '#000000' : LIGHT_COLORS.textMeta,
                                    fontSize: 15,
                                  }}
                                >
                                  {idx > 0 ? ', ' : ''}{group.count}×{group.reps} @{group.weight}
                                </Text>
                              ));
                            })()}
                          </Text>
                        ) : (
                          // Show template values if no progress
                          <Text style={styles.exerciseDetails}>
                            {exercise.targetSets}×{exercise.targetRepsMin}
                            {exercise.targetRepsMax && exercise.targetRepsMax !== exercise.targetRepsMin 
                              ? `-${exercise.targetRepsMax}` 
                              : ''}
                            {exercise.targetWeight ? ` @${exercise.targetWeight}` : ''}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
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
    marginLeft: -4,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  exportButtonText: {
    ...TYPOGRAPHY.bodySmall,
    color: LIGHT_COLORS.secondary,
    fontWeight: '600',
  },
  pageTitleContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  pageTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    paddingBottom: 100, // Space for delete button
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyText: {
    ...TYPOGRAPHY.bodyBold,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.xs,
  },
  emptySubtext: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
  },
  workoutsList: {
    // Container for workout rows
  },
  weekContainer: {
    marginTop: -1, // Overlap to connect with sticky header
    marginBottom: SPACING.xxl, // 24px space between weeks
  },
  stickyWeekHeaderWrapper: {
    backgroundColor: COLORS.backgroundCanvas,
    width: '100%',
  },
  stickyWeekHeaderBlackShadow: {
    // Black shadow: -1, -1, 8% opacity, 1px blur
    shadowColor: '#000000',
    shadowOffset: { width: -1, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 2,
  },
  stickyWeekHeaderWhiteShadow: {
    // White shadow: 1, 1, 100% opacity, 1px blur
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 1,
    elevation: 1,
  },
  stickyWeekHeader: {
    backgroundColor: '#E3E3DE',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    overflow: 'hidden',
  },
  weekLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#E2E3DF',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderCurve: 'continuous',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.75)',
    borderLeftColor: 'rgba(255, 255, 255, 0.75)',
    borderRightColor: 'rgba(0, 0, 0, 0.08)',
  },
  weekLabel: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.secondary,
  },
  weekDate: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
  },
  weekDividerContainer: {
    height: 2,
    backgroundColor: '#E2E3DF',
  },
  weekSpacer: {
    height: SPACING.xxl,
  },
  weekWorkoutsWrapper: {
    width: '100%',
    overflow: 'hidden',
  },
  weekWorkoutsBlackShadow: {
    // Black shadow: -1, -1, 8% opacity, 1px blur
    shadowColor: '#000000',
    shadowOffset: { width: -1, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 2,
    overflow: 'hidden',
  },
  weekWorkoutsWhiteShadow: {
    // Bottom-right shadow: 1, 1, 100% opacity, 1px blur
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 1,
    elevation: 1,
    overflow: 'hidden',
  },
  weekWorkoutsCard: {
    backgroundColor: '#E3E3DE',
    borderRadius: 12,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  weekWorkoutsInner: {
    backgroundColor: '#E2E3DF',
    borderRadius: 12,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderCurve: 'continuous',
    borderTopWidth: 0,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: 'transparent',
    borderLeftColor: 'rgba(255, 255, 255, 0.75)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.08)',
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
  },
  workoutRowFirst: {
    paddingTop: 16,
  },
  workoutRowLast: {
    paddingBottom: 16,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.secondary,
  },
  workoutTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 4.5,
    borderRightWidth: 4.5,
    borderTopWidth: 8,
    borderBottomWidth: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#000000',
    borderBottomColor: 'transparent',
  },
  dividerContainer: {
    height: 2,
    marginHorizontal: 18,
  },
  dividerTop: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  dividerBottom: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  errorText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.error,
    textAlign: 'center',
    padding: SPACING.xl,
  },
  
  // Delete Button
  deleteButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    padding: SPACING.xxl,
    paddingBottom: SPACING.lg,
  },
  deleteButton: {
    backgroundColor: LIGHT_COLORS.error,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  deleteButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Bottom Sheet
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: SPACING.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: LIGHT_COLORS.textMeta,
    borderRadius: 2,
    borderCurve: 'continuous',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  sheetContent: {
    paddingHorizontal: SPACING.xxl,
  },
  sheetTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.xs,
  },
  sheetSubtitle: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
    marginBottom: SPACING.lg,
  },
  
  // Empty State
  emptyExercises: {
    paddingVertical: SPACING.xxxl,
    alignItems: 'center',
  },
  emptyExercisesText: {
    fontSize: 16,
    color: LIGHT_COLORS.textMeta,
  },
  
  // Exercises List
  exercisesList: {
    maxHeight: 400,
  },
  exerciseItem: {
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: LIGHT_COLORS.border,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: '600',
    color: LIGHT_COLORS.secondary,
    marginBottom: 2,
  },
  exerciseDetails: {
    fontSize: 15,
    color: LIGHT_COLORS.textMeta,
  },
});


