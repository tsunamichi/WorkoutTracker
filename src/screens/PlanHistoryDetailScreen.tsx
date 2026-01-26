import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconArrowLeft, IconCheck, IconPlay } from '../components/icons';
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
  const { scheduledWorkouts, getWorkoutCompletionPercentage } = useStore();
  const { t } = useTranslation();

  // Get all workouts for this plan
  const planWorkouts = scheduledWorkouts
    .filter(sw => sw.programId === programId)
    .sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix());

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleWorkoutPress = (workout: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('WorkoutExecution', {
      cycleId: workout.programId,
      workoutTemplateId: workout.templateId,
      date: workout.date,
    });
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

        {/* Workouts List */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {planWorkouts.map((workout, index) => {
            const completion = getWorkoutCompletion(workout);
            const isCompleted = workout.status === 'completed';
            const isInProgress = workout.status === 'in_progress';
            const isPending = workout.status === 'planned';

            return (
              <TouchableOpacity
                key={workout.id}
                style={styles.workoutCard}
                onPress={() => handleWorkoutPress(workout)}
                activeOpacity={1}
              >
                <View style={styles.workoutCardInner}>
                  {/* Workout Header */}
                  <View style={styles.workoutHeader}>
                    <View style={styles.workoutTitleContainer}>
                      <Text style={styles.dayLabel}>
                        {t('dayNumber').replace('{number}', String(index + 1))}
                      </Text>
                      <Text style={styles.workoutName}>{workout.titleSnapshot}</Text>
                    </View>
                    {isCompleted && (
                      <View style={styles.completedBadge}>
                        <IconCheck size={16} color={COLORS.backgroundCanvas} />
                      </View>
                    )}
                    {isInProgress && (
                      <View style={styles.inProgressBadge}>
                        <IconPlay size={14} color={COLORS.backgroundCanvas} />
                      </View>
                    )}
                  </View>

                  {/* Date */}
                  <Text style={styles.workoutDate}>
                    {formatWorkoutDate(workout.date)}
                  </Text>

                  {/* Exercise Count */}
                  <Text style={styles.exerciseCount}>
                    {workout.exercisesSnapshot?.length || 0} {t('exercises')}
                  </Text>

                  {/* Progress Bar (only for completed or in-progress) */}
                  {(isCompleted || isInProgress) && (
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${completion}%` }]} />
                      </View>
                      <Text style={styles.progressText}>{completion}%</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
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
    paddingBottom: SPACING.xxxl,
  },
  workoutCard: {
    marginBottom: SPACING.lg,
    backgroundColor: CARDS.cardDeepDimmed.outer.backgroundColor,
    borderRadius: CARDS.cardDeepDimmed.outer.borderRadius,
    borderCurve: CARDS.cardDeepDimmed.outer.borderCurve as any,
    borderWidth: CARDS.cardDeepDimmed.outer.borderWidth,
    borderColor: CARDS.cardDeepDimmed.outer.borderColor,
    overflow: CARDS.cardDeepDimmed.outer.overflow as any,
  },
  workoutCardInner: {
    ...CARDS.cardDeepDimmed.inner,
    padding: SPACING.xl,
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  workoutTitleContainer: {
    flex: 1,
    marginRight: SPACING.md,
  },
  dayLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  workoutName: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  completedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.signalPositive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inProgressBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutDate: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    marginBottom: SPACING.xs,
  },
  exerciseCount: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: SPACING.md,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.borderDimmed,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.signalPositive,
  },
  progressText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
    minWidth: 40,
    textAlign: 'right',
  },
});
