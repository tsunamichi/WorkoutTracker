import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconArrowLeft, IconCheck } from '../components/icons';
import { useTranslation } from '../i18n/useTranslation';
import dayjs from 'dayjs';

interface PlanHistoryDetailScreenProps {
  route: {
    params: {
      programId: string;
      programName: string;
    };
  };
  navigation: any;
}

export function PlanHistoryDetailScreen({ route, navigation }: PlanHistoryDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { programId, programName } = route.params;
  const { scheduledWorkouts, getWorkoutCompletionPercentage, sessions, settings, exercises: exercisesLibrary, detailedWorkoutProgress } = useStore();
  const { t } = useTranslation();
  const useKg = settings.useKg;
  const [expandedWorkouts, setExpandedWorkouts] = React.useState<Set<string>>(new Set());

  // Get all workouts for this plan, with active at the top
  const planWorkouts = scheduledWorkouts
    .filter(sw => sw.programId === programId)
    .sort((a, b) => {
      // Sort: active/in-progress first, then by date
      const aIsActive = a.status !== 'completed';
      const bIsActive = b.status !== 'completed';
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;
      return dayjs(a.date).unix() - dayjs(b.date).unix();
    });

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const toggleWorkoutExpansion = (workoutId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedWorkouts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(workoutId)) {
        newSet.delete(workoutId);
      } else {
        newSet.add(workoutId);
      }
      return newSet;
    });
  };

  const getExerciseProgress = (workout: any, exerciseId: string) => {
    const workoutDate = workout.date;
    
    // 1. PRIMARY SOURCE: detailedWorkoutProgress (keyed by scheduled workout ID)
    // This is the most reliable source as it's saved during workout execution
    const workoutKey = workout.id; // scheduledWorkout ID, e.g. sw-planId-2026-02-12
    const detailedProgress = detailedWorkoutProgress[workoutKey];
    
    if (detailedProgress) {
      // Find matching exercise in detailed progress
      // exercisesSnapshot uses template exercise IDs, detailedWorkoutProgress uses library exercise IDs
      // Try matching by the exerciseId directly, or by looking through all exercises
      let exerciseProgress = detailedProgress.exercises[exerciseId];
      
      if (!exerciseProgress) {
        // Try matching: the snapshot has template item IDs, detailed progress might use exerciseId
        const templateExercise = (workout.exercisesSnapshot || []).find(
          (ex: any) => ex.exerciseId === exerciseId
        );
        if (templateExercise) {
          exerciseProgress = detailedProgress.exercises[templateExercise.id] || 
                            detailedProgress.exercises[templateExercise.exerciseId];
        }
      }
      
      if (exerciseProgress && !exerciseProgress.skipped) {
        const completedSets = exerciseProgress.sets.filter((s: any) => s.completed);
        if (completedSets.length > 0) {
          return {
            exerciseId,
            sets: completedSets.map((set: any) => ({
              weight: set.weight,
              reps: set.reps,
              completed: set.completed,
            })),
          };
        }
      }
    }
    
    // 2. FALLBACK: Check sessions (for backward compatibility)
    let matchingSessions = sessions.filter(session => 
      (session as any).workoutKey === workout.id
    );
    
    if (matchingSessions.length === 0) {
      matchingSessions = sessions.filter(session => 
        session.workoutTemplateId === workout.templateId && session.date === workoutDate
      );
    }
    
    if (matchingSessions.length === 0) {
      // Broader fallback: match by templateId only (handles date mismatch from old bug)
      matchingSessions = sessions.filter(session => 
        session.workoutTemplateId === workout.templateId
      );
    }
    
    // Use only the latest session to avoid duplicates
    if (matchingSessions.length > 1) {
      matchingSessions = [matchingSessions.reduce((latest, s) => s.id > latest.id ? s : latest)];
    }
    
    const completedSets = matchingSessions
      .flatMap(session => session.sets)
      .filter(set => set.exerciseId === exerciseId && set.isCompleted);
    
    return completedSets.length > 0 
      ? { 
          exerciseId, 
          sets: completedSets.map(set => ({
            weight: set.weight,
            reps: set.reps,
            completed: set.isCompleted
          }))
        } 
      : null;
  };

  const formatWorkoutDate = (date: string) => {
    return dayjs(date).format('MMM D, YYYY');
  };

  const getWorkoutCompletion = (workout: any) => {
    const workoutKey = `${workout.templateId}-${workout.date}`;
    let totalSets = 0;
    
    if (workout.exercisesSnapshot) {
      workout.exercisesSnapshot.forEach((ex: any) => {
        totalSets += ex.sets || 0;
      });
    }
    
    return totalSets > 0 ? getWorkoutCompletionPercentage(workoutKey, totalSets) : 0;
  };

  // Calculate overall plan completion
  const completedWorkouts = planWorkouts.filter(w => w.status === 'completed' || w.isLocked === true).length;
  const totalWorkouts = planWorkouts.length;
  const overallProgress = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <IconArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.backButton} />
        </View>
        
        <View style={styles.pageTitleContainer}>
          <Text style={styles.pageTitle} numberOfLines={1}>{programName}</Text>
        </View>
      </View>

        {/* Plan Summary */}
        <View style={styles.summarySection}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{completedWorkouts}/{totalWorkouts}</Text>
                <Text style={styles.summaryLabel}>Completed workouts</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{overallProgress}%</Text>
                <Text style={styles.summaryLabel}>{t('progress')}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Workouts List - Expanded with All Exercises */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {planWorkouts.map((workout, workoutIndex) => {
            const isCompleted = workout.status === 'completed' || workout.isLocked === true;
            const isActive = !isCompleted;
            const exercises = workout.exercisesSnapshot || [];

            // Check if workout has any completed sets
            const workoutHasLogs = exercises.some((ex: any) => {
              const progress = getExerciseProgress(workout, ex.exerciseId);
              return progress?.sets?.some((s: any) => s.completed);
            });
            
            const isExpanded = expandedWorkouts.has(workout.id);
            const shouldShowExercises = workoutHasLogs || isExpanded;

            return (
              <View key={workout.id} style={styles.workoutSection}>
                {/* Workout Header */}
                <TouchableOpacity 
                  style={styles.workoutHeaderSection}
                  onPress={() => toggleWorkoutExpansion(workout.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.workoutHeaderLeft}>
                    <Text style={styles.workoutTitle}>{workout.titleSnapshot}</Text>
                    <View style={styles.workoutMetaRow}>
                      <Text style={styles.workoutDayLabel}>
                        {t('dayNumber').replace('{number}', String(workoutIndex + 1))}
                      </Text>
                      <Text style={styles.workoutMetaDot}>·</Text>
                      <Text style={styles.workoutDate}>
                        {formatWorkoutDate(workout.date).toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  {isCompleted && (
                    <View style={styles.completedBadge}>
                      <Text style={styles.completedText}>{t('completed')}</Text>
                      <IconCheck size={24} color={COLORS.successBright} />
                    </View>
                  )}
                </TouchableOpacity>

                {/* All Exercises for this Workout */}
                {shouldShowExercises && exercises.map((exercise: any, exerciseIndex: number) => {
                  const exerciseProgress = getExerciseProgress(workout, exercise.exerciseId);
                  const completedSets = exerciseProgress?.sets?.filter((s: any) => s.completed) || [];
                  const totalSets = exercise.sets || 0;
                  const setsCompleted = completedSets.length;
                  const undoneSets = totalSets - setsCompleted;
                  
                  // Look up exercise name from library
                  const exerciseData = exercisesLibrary.find(e => e.id === exercise.exerciseId);
                  const exerciseName = exerciseData?.name || 'Unknown Exercise';

                  return (
                    <View key={exercise.id} style={styles.exerciseRow}>
                      {/* Exercise Name Column */}
                      <View style={styles.exerciseNameColumn}>
                        <Text style={styles.exerciseName} numberOfLines={2}>
                          {exerciseName}
                        </Text>
                      </View>

                      {/* Exercise Data Column */}
                      <View style={styles.exerciseDataColumn}>
                        {completedSets.length > 0 ? (
                          <>
                            {completedSets.map((set: any, setIndex: number) => (
                              <View key={setIndex} style={styles.setDataRow}>
                                <View style={styles.setValueGroup}>
                                  <Text style={styles.setValue}>{set.weight}</Text>
                                  <Text style={styles.setUnit}>{useKg ? 'kg' : 'lb'}</Text>
                                </View>
                                <View style={styles.setValueGroup}>
                                  <Text style={styles.setValue}>{set.reps}</Text>
                                  <Text style={styles.setUnit}>reps</Text>
                                </View>
                              </View>
                            ))}
                            {undoneSets > 0 && (
                              <View style={styles.setDataRow}>
                                <Text style={styles.undoneText}>
                                  +{undoneSets} not logged
                                </Text>
                              </View>
                            )}
                          </>
                        ) : (
                          <Text style={styles.noDataText}>Not logged</Text>
                        )}
                      </View>
                    </View>
                  );
                })}

                {/* Divider between workouts */}
                {workoutIndex < planWorkouts.length - 1 && (
                  <View style={styles.workoutDivider} />
                )}
              </View>
            );
          })}

          <View style={{ height: 100 }} />
        </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  header: {
    paddingBottom: 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xxl,
    height: 48,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -12,
  },
  pageTitleContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
  pageTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
  },
  summarySection: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xl,
  },
  summaryCard: {
    backgroundColor: CARDS.cardDeepDimmed.outer.backgroundColor,
    borderRadius: CARDS.cardDeepDimmed.outer.borderRadius,
    borderCurve: CARDS.cardDeepDimmed.outer.borderCurve as any,
    borderWidth: CARDS.cardDeepDimmed.outer.borderWidth,
    borderColor: CARDS.cardDeepDimmed.outer.borderColor,
    overflow: CARDS.cardDeepDimmed.outer.overflow as any,
  },
  summaryRow: {
    ...CARDS.cardDeepDimmed.inner,
    flexDirection: 'row',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  summaryLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    textTransform: 'capitalize',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: COLORS.borderDimmed,
    marginHorizontal: SPACING.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  workoutSection: {
    marginBottom: SPACING.xxxl,
  },
  workoutHeaderSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.xl,
  },
  workoutHeaderLeft: {
    flex: 1,
  },
  workoutTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  workoutMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  workoutDayLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  workoutMetaDot: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  workoutDate: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    letterSpacing: 1,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  completedText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.successBright,
    textTransform: 'capitalize',
  },
  exerciseRow: {
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDimmed,
    alignItems: 'flex-start',
  },
  exerciseNameColumn: {
    flex: 1,
    paddingRight: SPACING.lg,
  },
  exerciseName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  exerciseSetsInfo: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  exerciseDataColumn: {
    minWidth: 120,
    alignItems: 'flex-end',
  },
  setDataRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.lg,
    paddingVertical: 2,
  },
  setValueGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  setValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  setUnit: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  noDataText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  undoneText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    fontStyle: 'italic',
  },
  workoutDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: SPACING.xl,
    marginHorizontal: -SPACING.xxl,
  },
});
