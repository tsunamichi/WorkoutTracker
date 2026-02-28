import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconArrowLeft, IconCheck } from '../components/icons';
import { useTranslation } from '../i18n/useTranslation';
import dayjs from 'dayjs';
import { addSampleHistoryData } from '../utils/addSampleHistory';

export function HistoryScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { scheduledWorkouts, getWorkoutCompletionPercentage } = useStore();
  const { t } = useTranslation();
  const [isAddingSample, setIsAddingSample] = useState(false);

  // Group workouts by programId (for cycles/plans)
  const groupWorkoutsByPlan = () => {
    const planGroups = new Map<string, any[]>();
    const singleWorkouts: any[] = [];

    scheduledWorkouts.forEach(workout => {
      if (workout.source === 'cycle' && workout.programId) {
        // Group by programId
        if (!planGroups.has(workout.programId)) {
          planGroups.set(workout.programId, []);
        }
        planGroups.get(workout.programId)!.push(workout);
      } else {
        // Single workout (not part of a plan)
        singleWorkouts.push(workout);
      }
    });

    return { planGroups, singleWorkouts };
  };

  const { planGroups, singleWorkouts } = groupWorkoutsByPlan();

  // Create plan cards
  const planCards = Array.from(planGroups.entries()).map(([programId, workouts]) => {
    const sortedWorkouts = workouts.sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix());
    const firstWorkout = sortedWorkouts[0];
    const lastWorkout = sortedWorkouts[sortedWorkouts.length - 1];
    
    // Check if any workout is completed (status or isLocked so history is correct after ending cycle)
    const hasCompletedWorkouts = workouts.some(w => w.status === 'completed' || w.isLocked === true);
    const allCompleted = workouts.every(w => w.status === 'completed' || w.isLocked === true);
    const hasInProgress = workouts.some(w => w.status === 'in_progress' && !w.isLocked);
    
    // Determine status
    let status: 'active' | 'in_progress' | 'completed';
    if (allCompleted) {
      status = 'completed';
    } else if (hasInProgress || hasCompletedWorkouts) {
      status = 'in_progress';
    } else {
      status = 'active';
    }

    // Calculate total completion percentage for completed plans
    let totalCompletion = 0;
    if (status === 'completed') {
      const completions = workouts.map(w => {
        const workoutKey = `${w.templateId}-${w.date}`;
        let totalSets = 0;
        if (w.exercisesSnapshot) {
          w.exercisesSnapshot.forEach((ex: any) => {
            totalSets += ex.sets || 0;
          });
        }
        return totalSets > 0 ? getWorkoutCompletionPercentage(workoutKey, totalSets) : 0;
      });
      totalCompletion = Math.round(completions.reduce((sum, val) => sum + val, 0) / completions.length);
    }

    return {
      id: programId,
      type: 'plan' as const,
      name: firstWorkout.programName || 'Workout Plan',
      workoutCount: workouts.length,
      startDate: firstWorkout.date,
      endDate: lastWorkout.date,
      status,
      completion: totalCompletion,
      workouts: sortedWorkouts,
    };
  });

  // Create single workout cards (not part of a plan)
  const singleWorkoutCards = singleWorkouts
    .filter(sw => sw.status === 'completed' && sw.completedAt)
    .sort((a, b) => dayjs(b.completedAt!).unix() - dayjs(a.completedAt!).unix())
    .map(workout => {
      const workoutKey = `${workout.templateId}-${workout.date}`;
      let totalSets = 0;
      if (workout.exercisesSnapshot) {
        workout.exercisesSnapshot.forEach((ex: any) => {
          totalSets += ex.sets || 0;
        });
      }
      const completion = totalSets > 0 ? getWorkoutCompletionPercentage(workoutKey, totalSets) : 0;

      return {
        id: workout.id,
        type: 'single' as const,
        name: workout.titleSnapshot,
        workoutCount: 1,
        date: workout.date,
        status: 'completed' as const,
        completion,
        exerciseCount: workout.exercisesSnapshot?.length || 0,
        workout,
      };
    });

  // Sort plan cards: only one active at top, then completed
  const sortedPlanCards = planCards.sort((a, b) => {
    const aIsActive = a.status === 'active' || a.status === 'in_progress';
    const bIsActive = b.status === 'active' || b.status === 'in_progress';
    
    // Only one active workout should be at the top
    if (aIsActive && !bIsActive) return -1;
    if (!aIsActive && bIsActive) return 1;
    
    // Both active or both completed
    if (aIsActive && bIsActive) {
      // For multiple active, pick the earliest start date (only one will show)
      return dayjs(a.startDate).unix() - dayjs(b.startDate).unix();
    }
    
    // Both completed - sort by most recent end date
    return dayjs(b.endDate).unix() - dayjs(a.endDate).unix();
  });
  
  // Take only the first active workout (if any exist)
  const firstActiveIndex = sortedPlanCards.findIndex(card => 
    card.status === 'active' || card.status === 'in_progress'
  );
  const filteredPlanCards = firstActiveIndex >= 0 
    ? [
        sortedPlanCards[firstActiveIndex], // First active workout at top
        ...sortedPlanCards.filter((card, idx) => 
          idx !== firstActiveIndex && card.status === 'completed'
        )
      ]
    : sortedPlanCards; // All completed if no active

  // Combine: plans first, then single workouts
  const allCards = [...filteredPlanCards, ...singleWorkoutCards];

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleCardPress = (card: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (card.type === 'plan') {
      // For plans, navigate to the plan detail screen showing all workouts
      (navigation as any).navigate('PlanHistoryDetail', { 
        programId: card.id,
        programName: card.name
      });
    } else {
      // For single workouts, navigate directly to exercise execution (main)
      (navigation as any).navigate('ExerciseExecution', { 
        workoutKey: card.workout.id, // Use workout ID as workoutKey
        workoutTemplateId: card.workout.templateId,
        type: 'main', // Go directly to main exercises page
      });
    }
  };

  const formatWorkoutDate = (date: string) => {
    return dayjs(date).format('MMM D, YYYY');
  };

  const handleAddSampleData = async () => {
    setIsAddingSample(true);
    try {
      await addSampleHistoryData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to add sample data:', error);
    } finally {
      setIsAddingSample(false);
    }
  };

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
          <Text style={styles.pageTitle}>{t('history')}</Text>
        </View>
      </View>

        {/* Workouts List */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {allCards.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('noWorkoutsYet')}</Text>
              <Text style={styles.emptySubtext}>{t('completedWorkoutsWillAppearHere')}</Text>
              
              {/* DEV: Add sample data button */}
              <TouchableOpacity
                style={styles.sampleButton}
                onPress={handleAddSampleData}
                disabled={isAddingSample}
                activeOpacity={1}
              >
                <Text style={styles.sampleButtonText}>
                  {isAddingSample ? 'Adding...' : 'Add Sample Data (Dev)'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            allCards.map((card) => {
              const isActive = card.status === 'active' || card.status === 'in_progress';
              const isInProgress = card.status === 'in_progress';
              const isPlan = card.type === 'plan';

              return (
                <TouchableOpacity
                  key={card.id}
                  style={styles.workoutCard}
                  onPress={() => handleCardPress(card)}
                  activeOpacity={1}
                >
                  <View style={styles.workoutCardInner}>
                    {/* Card Header */}
                    <View style={styles.workoutHeader}>
                      <Text style={styles.workoutName}>{card.name}</Text>
                      {isActive ? (
                        <View style={[styles.activeBadge, isInProgress && styles.inProgressBadge]}>
                          <Text style={styles.activeBadgeText}>
                            {isInProgress ? t('inProgress') : t('active')}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.completedBadge}>
                          <IconCheck size={16} color={COLORS.backgroundCanvas} />
                        </View>
                      )}
                    </View>

                    {/* Date */}
                    {isPlan ? (
                      <Text style={styles.workoutDate}>
                        {isActive ? `${t('startDate')}: ` : ''}{formatWorkoutDate(card.startDate)}
                        {card.startDate !== card.endDate && ` - ${formatWorkoutDate(card.endDate)}`}
                      </Text>
                    ) : (
                      <Text style={styles.workoutDate}>
                        {formatWorkoutDate(card.date)}
                      </Text>
                    )}

                    {/* Card Details */}
                    <View style={styles.workoutDetails}>
                      {isPlan ? (
                        <>
                          <Text style={styles.workoutDetailText}>
                            {card.workoutCount} {t('workouts').toLowerCase()}
                          </Text>
                          <Text style={styles.workoutDetailSeparator}>•</Text>
                          <Text style={styles.workoutDetailText}>{t('workoutPlan')}</Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.workoutDetailText}>
                            {card.exerciseCount} {t('exercises')}
                          </Text>
                          <Text style={styles.workoutDetailSeparator}>•</Text>
                          <Text style={styles.workoutDetailText}>{t('singleWorkout')}</Text>
                        </>
                      )}
                    </View>

                    {/* Progress */}
                    {!isActive && (
                      <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                          <View style={[styles.progressFill, { width: `${card.completion}%` }]} />
                        </View>
                        <Text style={styles.progressText}>{card.completion}%</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}

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
    marginBottom: SPACING.xxxl + SPACING.sm,
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
    paddingBottom: SPACING.xxxl,
  },
  emptyState: {
    paddingTop: 100,
    alignItems: 'center',
  },
  emptyText: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    marginBottom: SPACING.xl,
  },
  sampleButton: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.accentPrimary,
    borderRadius: BORDER_RADIUS.md,
  },
  sampleButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.backgroundCanvas,
  },
  workoutCard: {
    marginBottom: SPACING.lg,
    backgroundColor: CARDS.cardDeepDimmed.outer.backgroundColor,
    borderRadius: CARDS.cardDeepDimmed.outer.borderRadius,
    borderCurve: CARDS.cardDeepDimmed.outer.borderCurve,
    borderWidth: CARDS.cardDeepDimmed.outer.borderWidth,
    borderColor: CARDS.cardDeepDimmed.outer.borderColor,
    overflow: CARDS.cardDeepDimmed.outer.overflow,
  },
  workoutCardInner: {
    ...CARDS.cardDeepDimmed.inner,
    padding: SPACING.xxl,
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  workoutName: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    flex: 1,
  },
  completedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.signalPositive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.accentPrimary,
  },
  inProgressBadge: {
    backgroundColor: '#007AFF', // iOS blue for in-progress
  },
  activeBadgeText: {
    ...TYPOGRAPHY.meta,
    fontWeight: '600',
    color: COLORS.backgroundCanvas,
  },
  workoutDate: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    marginBottom: 20,
  },
  workoutDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workoutDetailText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  workoutDetailSeparator: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginHorizontal: SPACING.sm,
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
