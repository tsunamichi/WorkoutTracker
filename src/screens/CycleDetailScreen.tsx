import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { formatWeightForLoad } from '../utils/weight';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconArrowLeft, IconMenu, IconShare, IconTrash, IconCheck } from '../components/icons';
import { ActionSheet } from '../components/common/ActionSheet';
import { BottomDrawer } from '../components/common/BottomDrawer';
import type { WorkoutAssignment, WorkoutTemplate } from '../types';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { useTranslation } from '../i18n/useTranslation';

dayjs.extend(isoWeek);

interface CycleDetailScreenProps {
  route: {
    params: {
      cycleId: string;
    };
  };
  navigation: any;
}

// Dark theme colors
const LIGHT_COLORS = {
  backgroundCanvas: '#0D0D0D',
  backgroundContainer: '#1C1C1E',
  secondary: '#FFFFFF',
  textSecondary: '#AEAEB2',
  textMeta: '#8E8E93',
  border: '#38383A',
  accentPrimary: COLORS.accentPrimary,
  success: COLORS.signalPositive,
  error: COLORS.signalNegative,
};

export function CycleDetailScreen({ route, navigation }: CycleDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { cycleId } = route.params;
  const {
    cycles,
    exercises,
    deleteCycle,
    getExerciseProgress,
    workoutAssignments,
    settings,
    getWorkoutCompletionPercentage,
  } = useStore();
  const { t } = useTranslation();
  const useKg = settings.useKg;
  const weightUnit = useKg ? 'kg' : 'lb';
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutTemplate | null>(null);
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number>(1);
  const [menuVisible, setMenuVisible] = useState(false);
  
  const handleWorkoutPress = (workout: WorkoutTemplate, weekNumber: number) => {
    setSelectedWorkout(workout);
    setSelectedWeekNumber(weekNumber);
  };

  const getTotalSetsForWorkout = (workout: WorkoutTemplate, workoutKey: string | null) => {
    return workout.exercises.reduce((sum, exercise) => {
      const progress = workoutKey ? getExerciseProgress(workoutKey, exercise.id) : undefined;
      const completedSets = progress?.sets?.filter(set => set.completed).length || 0;
      const loggedSets = progress?.sets?.length || 0;
      const targetSets = exercise.targetSets || 0;
      return sum + Math.max(targetSets, loggedSets, completedSets);
    }, 0);
  };

  const getWeekCompletionForWorkout = (
    workout: WorkoutTemplate,
    assignments: WorkoutAssignment[]
  ) => {
    let bestPercentage = 0;
    let bestWorkoutKey: string | null = null;

    assignments.forEach(assignment => {
      const workoutKey = `${workout.id}-${assignment.date}`;
      const totalSets = getTotalSetsForWorkout(workout, workoutKey);
      const percentage = totalSets > 0 ? getWorkoutCompletionPercentage(workoutKey, totalSets) : 0;

      if (percentage > bestPercentage) {
        bestPercentage = percentage;
        bestWorkoutKey = workoutKey;
      }
    });

    if (!bestWorkoutKey && assignments.length > 0) {
      const latestAssignment = assignments.reduce((latest, current) =>
        dayjs(current.date).isAfter(dayjs(latest.date)) ? current : latest
      );
      const fallbackKey = `${workout.id}-${latestAssignment.date}`;
      const totalSets = getTotalSetsForWorkout(workout, fallbackKey);
      bestPercentage = totalSets > 0 ? getWorkoutCompletionPercentage(fallbackKey, totalSets) : 0;
      bestWorkoutKey = fallbackKey;
    }

    return { percentage: bestPercentage, workoutKey: bestWorkoutKey };
  };
  
  const handleDeleteCycle = () => {
    Alert.alert(
      t('deleteCycleTitle'),
      t('deleteCycleMessage').replace('{number}', String(cycle?.cycleNumber || '')),
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('delete'),
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
          exportText += `      Target: ${exercise.targetSets} sets × ${exercise.targetReps} ${t('reps')}\n`;
          
          // Check if there's saved progress for any assignment
          let foundProgress = false;
          for (const assignment of weekAssignments) {
            const workoutKey = `${workout.id}-${assignment.date}`;
            const progress = getExerciseProgress(workoutKey, exercise.id);
            
            if (progress && progress.sets && progress.sets.length > 0) {
              foundProgress = true;
              exportText += `      Completed (${dayjs(assignment.date).format('MMM D')}):\n`;
              progress.sets.forEach((set, idx) => {
          exportText += `        Set ${idx + 1}: ${formatWeightForLoad(set.weight, useKg)} ${weightUnit} × ${set.reps} ${t('reps')}${set.completed ? ' ✓' : ''}\n`;
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
        title: t('cycleDataTitle').replace('{number}', String(cycle.cycleNumber))
      });
    } catch (error) {
      Alert.alert(t('alertErrorTitle'), t('failedToExportData'));
    }
  };
  
  if (!cycle) {
    return (
      <View style={styles.gradient}>
        <View style={styles.container}>
          <Text style={styles.errorText}>{t('cycleNotFound')}</Text>
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
            <Text style={styles.pageTitle}>
              {t('cycleNumber').replace('{number}', String(cycle.cycleNumber))}
            </Text>
          </View>
        </View>

        {/* Action Sheet Menu */}
        <ActionSheet
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          items={[
            { 
              icon: <IconTrash size={24} color={COLORS.signalNegative} />,
              label: t('deleteCycleTitle'), 
              onPress: handleDeleteCycle, 
              destructive: true 
            },
            { 
              icon: <IconShare size={24} color={LIGHT_COLORS.secondary} />,
              label: t('exportData'), 
              onPress: handleExportData
            },
          ]}
        />
      
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        
        {/* Workouts */}
        {cycle.workoutTemplates.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('noWorkoutsYet')}</Text>
            <Text style={styles.emptySubtext}>{t('createCycleToSeeWorkouts')}</Text>
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
                  {t('weekLabel').replace('{number}', String(weekIndex + 1))}
                </Text>
              </View>,
              
              /* Workouts as cards */
              ...weekWorkouts.map((workout, workoutIndex) => {
                const weekNumber = weekIndex + 1;
                const workoutKey = `${workout.id}-week-${weekNumber}`;
                
                // Find workout assignments for this week
                const weekEndDate = weekStartDate.add(6, 'day');
                const weekAssignments = workoutAssignments.filter(a => {
                  if (a.workoutTemplateId !== workout.id || a.cycleId !== cycleId) {
                    return false;
                  }
                  const assignmentDate = dayjs(a.date);
                  return (assignmentDate.isAfter(weekStartDate, 'day') || assignmentDate.isSame(weekStartDate, 'day')) &&
                         (assignmentDate.isBefore(weekEndDate, 'day') || assignmentDate.isSame(weekEndDate, 'day'));
                });
                
                // Get the most recent assignment date for display
                const latestAssignment = weekAssignments.length > 0 
                  ? weekAssignments.sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))[0]
                  : null;
                
                const dateDisplay = latestAssignment 
                  ? dayjs(latestAssignment.date).format('ddd, MMM D')
                  : weekStartDate.format('ddd, MMM D');
                
                return (
                  <TouchableOpacity
                    key={`workout-${workoutKey}`}
                    onPress={() => handleWorkoutPress(workout, weekNumber)}
                    activeOpacity={1}
                    style={styles.workoutCardWrapper}
                  >
                    <View style={styles.workoutCard}>
                      <View style={styles.workoutCardInner}>
                        <View style={styles.workoutCardHeader}>
                        <Text style={styles.workoutName}>{workout.name}</Text>
                          {(() => {
                            const { percentage: completionPercentage } = getWeekCompletionForWorkout(
                              workout,
                              weekAssignments
                            );
                            const progress = completionPercentage / 100;
                            return (
                              <View style={styles.progressIndicator}>
                                {progress >= 0.999 ? (
                                  <View style={styles.progressCheckCircle}>
                                    <IconCheck size={24} color={COLORS.successBright} />
                                  </View>
                                ) : (
                                  <>
                                    <Text style={styles.progressText}>{completionPercentage}%</Text>
                                    <Svg height="16" width="16" viewBox="0 0 16 16" style={styles.progressCircle}>
                                      <Circle cx="8" cy="8" r="8" fill={COLORS.backgroundCanvas} />
                                      {progress > 0 ? (
                                        <Path
                                          d={`M 8 8 L 8 0 A 8 8 0 ${progress > 0.5 ? 1 : 0} 1 ${
                                            8 + 8 * Math.sin(2 * Math.PI * progress)
                                          } ${
                                            8 - 8 * Math.cos(2 * Math.PI * progress)
                                          } Z`}
                                          fill={COLORS.signalWarning}
                                        />
                                      ) : null}
                                    </Svg>
                                  </>
                                )}
                              </View>
                            );
                          })()}
                        </View>
                        <Text style={styles.workoutDate}>{dateDisplay}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ];
          })
        )}
      </ScrollView>
      
      {/* Workout Details Bottom Sheet */}
      <BottomDrawer
        visible={!!selectedWorkout}
        onClose={() => setSelectedWorkout(null)}
        maxHeight="90%"
        expandable={false}
        scrollable={false}
        fixedHeight={true}
      >
        <View style={styles.sheetContent}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderRow}>
          <Text style={styles.sheetTitle}>{selectedWorkout?.name}</Text>
              {(() => {
                if (!selectedWorkout) return null;
                const weekStartDate = dayjs(cycle.startDate).add(selectedWeekNumber - 1, 'week');
                const weekEndDate = weekStartDate.add(6, 'day');
                const weekAssignments = workoutAssignments
                  .filter(a => {
                    if (a.workoutTemplateId !== selectedWorkout.id || a.cycleId !== cycleId) {
                      return false;
                    }
                    const assignmentDate = dayjs(a.date);
                    return (
                      (assignmentDate.isAfter(weekStartDate, 'day') ||
                        assignmentDate.isSame(weekStartDate, 'day')) &&
                      (assignmentDate.isBefore(weekEndDate, 'day') ||
                        assignmentDate.isSame(weekEndDate, 'day'))
                    );
                  });
                const { percentage: completionPercentage } = getWeekCompletionForWorkout(
                  selectedWorkout,
                  weekAssignments
                );
                const progress = completionPercentage / 100;
                return (
                  <View style={styles.progressIndicator}>
                    {progress >= 0.999 ? (
                      <View style={styles.progressCheckCircle}>
                        <IconCheck size={24} color={COLORS.successBright} />
                      </View>
                    ) : (
                      <>
                        <Text style={styles.progressText}>{completionPercentage}%</Text>
                        <Svg height="16" width="16" viewBox="0 0 16 16" style={styles.progressCircle}>
                          <Circle cx="8" cy="8" r="8" fill={COLORS.activeCard} />
                          {progress > 0 ? (
                            <Path
                              d={`M 8 8 L 8 0 A 8 8 0 ${progress > 0.5 ? 1 : 0} 1 ${
                                8 + 8 * Math.sin(2 * Math.PI * progress)
                              } ${
                                8 - 8 * Math.cos(2 * Math.PI * progress)
                              } Z`}
                              fill={COLORS.signalWarning}
                            />
                          ) : null}
                        </Svg>
                      </>
                    )}
                  </View>
                );
              })()}
            </View>
              <Text style={styles.sheetSubtitle}>
              {t('weekWithDate')
                .replace('{number}', String(selectedWeekNumber))
                .replace(
                  '{date}',
                  dayjs(cycle.startDate).add(selectedWeekNumber - 1, 'week').format('MMM D, YYYY')
                )}
              </Text>
          </View>
          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.sheetBodyContent}
            bounces={false}
          >
              {selectedWorkout?.exercises.length === 0 ? (
                <View style={styles.emptyExercises}>
                <Text style={styles.emptyExercisesText}>{t('noExercisesAddedYet')}</Text>
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
                        <Text style={styles.emptyExercisesText}>{t('noLoggedDataThisWeek')}</Text>
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
                                      <Text style={styles.historyValueText}>
                                        {formatWeightForLoad(set.weight, useKg)}
                                      </Text>
                                      <Text style={styles.historyUnitText}>{weightUnit}</Text>
                                      </View>
                                      <View style={styles.historyValueColumn}>
                                        <Text style={styles.historyValueText}>{set.reps}</Text>
                                      <Text style={styles.historyUnitText}>{t('reps')}</Text>
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
          </ScrollView>
            </View>
      </BottomDrawer>
      </View>
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
  
  // Workout Cards
  workoutCardWrapper: {
    marginBottom: SPACING.sm,
  },
  workoutCard: CARDS.cardDeepDimmed.outer,
  workoutCardInner: {
    ...CARDS.cardDeepDimmed.inner,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  workoutCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  workoutName: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.secondary,
    marginBottom: 2,
    flex: 1,
  },
  workoutDate: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressCircle: {
    // No additional styling needed
  },
  progressCheckCircle: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  errorText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.error,
    textAlign: 'center',
    padding: SPACING.xl,
  },
  
  
  // Bottom Sheet
  sheetContent: {
    flex: 1,
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xl,
  },
  sheetHeader: {
    backgroundColor: COLORS.backgroundCanvas,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetBody: {
    flex: 1,
  },
  sheetBodyContent: {
    paddingBottom: SPACING.xl,
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
    backgroundColor: COLORS.borderDimmed,
  },
  historyDividerBottom: {
    height: 1,
    backgroundColor: 'transparent',
  },
});


