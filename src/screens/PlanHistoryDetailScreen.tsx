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
  const { scheduledWorkouts, getWorkoutCompletionPercentage, detailedWorkoutProgress } = useStore();
  const { t } = useTranslation();

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

  const getExerciseProgress = (workout: any, exerciseId: string) => {
    const workoutKey = workout.id; // Use scheduled workout ID
    const progress = detailedWorkoutProgress[workoutKey];
    if (!progress || !progress.exercises) return null;
    return progress.exercises[exerciseId];
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
  const completedWorkouts = planWorkouts.filter(w => w.status === 'completed').length;
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
                <Text style={styles.summaryValue}>{totalWorkouts}</Text>
                <Text style={styles.summaryLabel}>{t('workouts')}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{completedWorkouts}</Text>
                <Text style={styles.summaryLabel}>{t('completed')}</Text>
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
            const isCompleted = workout.status === 'completed';
            const isActive = workout.status !== 'completed';
            const exercises = workout.exercisesSnapshot || [];

            return (
              <View key={workout.id} style={styles.workoutSection}>
                {/* Workout Header */}
                <View style={styles.workoutHeaderSection}>
                  <View style={styles.workoutHeaderLeft}>
                    <Text style={styles.workoutDayLabel}>
                      {t('dayNumber').replace('{number}', String(workoutIndex + 1))}
                    </Text>
                    <Text style={styles.workoutTitle}>{workout.titleSnapshot}</Text>
                    <Text style={styles.workoutDate}>
                      {formatWorkoutDate(workout.date)}
                    </Text>
                  </View>
                  {isCompleted && (
                    <View style={styles.statusBadge}>
                      <IconCheck size={16} color={COLORS.backgroundCanvas} />
                    </View>
                  )}
                </View>

                {/* All Exercises for this Workout */}
                {exercises.map((exercise: any, exerciseIndex: number) => {
                  const exerciseProgress = getExerciseProgress(workout, exercise.id);
                  const completedSets = exerciseProgress?.sets?.filter((s: any) => s.completed) || [];
                  const totalSets = exercise.sets || 0;
                  const setsCompleted = completedSets.length;
                  const undoneSets = totalSets - setsCompleted;

                  return (
                    <View key={exercise.id} style={styles.exerciseRow}>
                      {/* Exercise Name Column */}
                      <View style={styles.exerciseNameColumn}>
                        <Text style={styles.exerciseName} numberOfLines={2}>
                          {exercise.name}
                        </Text>
                        <Text style={styles.exerciseSetsInfo}>
                          {setsCompleted}/{totalSets} {t('sets')}
                        </Text>
                      </View>

                      {/* Exercise Data Column */}
                      <View style={styles.exerciseDataColumn}>
                        {completedSets.length > 0 ? (
                          <>
                            {completedSets.map((set: any, setIndex: number) => (
                              <View key={setIndex} style={styles.setDataRow}>
                                <Text style={styles.setData}>
                                  {set.weight}lb × {set.reps}
                                </Text>
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
  workoutDayLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  workoutTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  workoutDate: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.signalPositive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseRow: {
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDimmed,
  },
  exerciseNameColumn: {
    flex: 1,
    paddingRight: SPACING.lg,
  },
  exerciseName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    marginBottom: SPACING.xs,
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
    paddingVertical: 2,
  },
  setData: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
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
  },
});
