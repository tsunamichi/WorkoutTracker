import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconArrowLeft, IconMenu } from '../components/icons';
import { DropdownMenu } from '../components/DropdownMenu';
import { BottomDrawer } from '../components/common/BottomDrawer';
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
  const [menuVisible, setMenuVisible] = useState(false);
  
  // Helper function to get ordinal suffix
  const getOrdinalSuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  
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
      <View style={styles.gradient}>
        <View style={styles.container}>
          <Text style={styles.errorText}>Cycle not found</Text>
        </View>
      </View>
    );
  }
  
  return (
    <View style={styles.gradient}>
      <View style={styles.container}>
        {/* Header (includes topBar with back button + title) */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          {/* Back Button and Menu Button */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <IconArrowLeft size={24} color={LIGHT_COLORS.text} />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuButton}>
              <IconMenu size={24} color={LIGHT_COLORS.text} />
            </TouchableOpacity>
          </View>
          
          {/* Page Title */}
          <View style={styles.pageTitleContainer}>
            <Text style={styles.pageTitle}>Cycle {cycle.cycleNumber}</Text>
          </View>
        </View>

        {/* Dropdown Menu */}
        <DropdownMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          top={insets.top + 48}
          right={18}
          items={[
            { label: 'Export Data', onPress: handleExportData },
            { label: 'Delete Cycle', onPress: handleDeleteCycle, destructive: true },
          ]}
        />
      
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
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
            const weekWorkouts = cycle.workoutTemplates.filter(
              workout => workout.week === weekIndex + 1 || !workout.week
            );
            
            return [
              /* Week Label */
              <View key={`week-header-${weekIndex}`} style={styles.weekHeader}>
                <Text style={styles.weekHeaderText}>
                  Week {weekIndex + 1} — {weekStartDate.format('MMM D, YYYY')}
                </Text>
              </View>,
              
              /* Workouts as compact cards */
              ...weekWorkouts.map((workout) => (
                <View key={workout.id} style={styles.workoutCardWrapper}>
                  <View style={CARDS.cardDeep.outer}>
                    <TouchableOpacity
                      style={{ ...CARDS.cardDeep.inner, ...styles.workoutCardInner }}
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
                  </View>
                </View>
              ))
            ];
          })
        )}
      </ScrollView>
      
      {/* Workout Details Bottom Sheet */}
      <BottomDrawer
        visible={!!selectedWorkout}
        onClose={() => setSelectedWorkout(null)}
        maxHeight="40%"
        expandable={true}
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>{selectedWorkout?.name}</Text>
              <Text style={styles.sheetSubtitle}>
                Week {selectedWeekNumber} — {dayjs(cycle.startDate).add(selectedWeekNumber - 1, 'week').format('MMM D, YYYY')}
              </Text>
              
              {selectedWorkout?.exercises.length === 0 ? (
                <View style={styles.emptyExercises}>
                  <Text style={styles.emptyExercisesText}>No exercises added yet</Text>
                </View>
              ) : (
                <View style={styles.exercisesList}>
                  {(() => {
                    if (!selectedWorkout) return null;
                    
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
                    
                    // Filter assignments that have any completed exercises
                    const completedAssignments = weekAssignments.filter(assignment => {
                      const workoutKey = `${selectedWorkout.id}-${assignment.date}`;
                      return selectedWorkout.exercises.some(exercise => {
                        const progress = getExerciseProgress(workoutKey, exercise.id);
                        return progress && progress.sets && progress.sets.length > 0;
                      });
                    });
                    
                    if (completedAssignments.length === 0) {
                      return (
                        <View style={styles.emptyExercises}>
                          <Text style={styles.emptyExercisesText}>No logged data for this week</Text>
                        </View>
                      );
                    }
                    
                    const reversedAssignments = completedAssignments.slice().reverse();
                    return reversedAssignments.map((assignment, assignmentIndex) => {
                      const workoutKey = `${selectedWorkout.id}-${assignment.date}`;
                      const isLastAssignment = assignmentIndex === reversedAssignments.length - 1;
                      
                      const exercisesWithProgress = selectedWorkout.exercises
                        .map((exercise) => {
                          const exerciseData = exercises.find(e => e.id === exercise.exerciseId);
                          const progress = getExerciseProgress(workoutKey, exercise.id);
                          
                          if (!progress || !progress.sets || progress.sets.length === 0) {
                            return null;
                          }
                          
                          return {
                            exercise,
                            exerciseData,
                            progress,
                          };
                        })
                        .filter(Boolean);
                      
                      return (
                        <View 
                          key={assignment.date}
                          style={isLastAssignment ? { paddingBottom: 16 } : undefined}
                        >
                          {exercisesWithProgress.map((item, exerciseIndex) => (
                            <View key={item.exercise.id}>
                              <View style={styles.historyWorkoutGroup}>
                                {/* Exercise name on the left */}
                                <View style={styles.historyDateColumn}>
                                  <Text style={styles.historyExerciseName}>
                                    {item.exerciseData?.name || 'Unknown Exercise'}
                                  </Text>
                                </View>
                                
                                {/* Sets column on the right */}
                                <View style={styles.historySetsColumn}>
                                  {item.progress.sets.slice().reverse().map((set, setIndex) => (
                                    <View key={setIndex} style={styles.historySetRow}>
                                      <View style={styles.historyValueColumn}>
                                        <Text style={styles.historyValueText}>{set.weight}</Text>
                                        <Text style={styles.historyUnitText}>lbs</Text>
                                      </View>
                                      <View style={styles.historyValueColumn}>
                                        <Text style={styles.historyValueText}>{set.reps}</Text>
                                        <Text style={styles.historyUnitText}>reps</Text>
                                      </View>
                                    </View>
                                  ))}
                                </View>
                              </View>
                              
                              {exerciseIndex < exercisesWithProgress.length - 1 && (
                                <View style={styles.historyDividerContainer}>
                                  <View style={styles.historyDividerTop} />
                                  <View style={styles.historyDividerBottom} />
                                </View>
                              )}
                            </View>
                          ))}
                          
                          {assignmentIndex < reversedAssignments.length - 1 && (
                            <View style={[styles.historyDividerContainer, { marginVertical: SPACING.lg }]}>
                              <View style={styles.historyDividerTop} />
                              <View style={styles.historyDividerBottom} />
                            </View>
                          )}
                        </View>
                      );
                    });
                  })()}
                </View>
              )}
            </View>
      </BottomDrawer>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    backgroundColor: '#E2E3DF',
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
  menuButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginRight: -4,
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
  weekHeader: {
    marginTop: 40,
    marginBottom: SPACING.lg, // 16px
  },
  weekHeaderText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
  },
  workoutCardWrapper: {
    marginBottom: SPACING.md, // 12px
  },
  workoutCardInner: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    ...TYPOGRAPHY.body,
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
  errorText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.error,
    textAlign: 'center',
    padding: SPACING.xl,
  },
  
  
  // Bottom Sheet
  sheetContent: {
    paddingHorizontal: SPACING.xxl,
  },
  sheetTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
    marginBottom: 4,
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
    marginHorizontal: -SPACING.xxl, // Remove parent's horizontal padding
  },
  
  // History Layout (same as exercise history drawer)
  historyWorkoutGroup: {
    flexDirection: 'row',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
    gap: 32,
  },
  historyDateColumn: {
    flex: 1,
  },
  historyDateText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
  },
  historySetsColumn: {
    flex: 1,
    gap: SPACING.md,
    alignItems: 'flex-end', // Right-align the entire column
  },
  historyExerciseName: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.secondary,
  },
  historySetRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 16,
    justifyContent: 'flex-end', // Right-align the row
  },
  historyValueColumn: {
    width: 64,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end', // Right-align content
    gap: 4,
  },
  historyValueText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.secondary,
  },
  historyUnitText: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
  },
  historyDividerContainer: {
    height: 2,
    marginHorizontal: SPACING.xxl, // 24px padding on sides
  },
  historyDividerTop: {
    height: 1,
    backgroundColor: '#CBC8C7', // metaSoft
  },
  historyDividerBottom: {
    height: 1,
    backgroundColor: '#FFFFFF',
  },
});


