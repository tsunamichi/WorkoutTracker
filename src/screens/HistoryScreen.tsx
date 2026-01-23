import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconArrowLeft, IconCheck } from '../components/icons';
import { useTranslation } from '../i18n/useTranslation';
import dayjs from 'dayjs';

// Light theme colors
const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  secondary: '#1B1B1B',
  textMeta: '#817B77',
  border: '#C7C7CC',
  accentPrimary: '#FD6B00',
};

export function HistoryScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { cycles, workoutAssignments, detailedWorkoutProgress } = useStore();
  const { t } = useTranslation();

  // Get all cycles sorted by start date (newest first)
  const allCycles = [...cycles].sort((a, b) => 
    dayjs(b.startDate).unix() - dayjs(a.startDate).unix()
  );

  // Calculate completion percentage for a cycle
  const getCycleCompletion = (cycleId: string) => {
    const cycle = cycles.find(c => c.id === cycleId);
    if (!cycle) return 0;
    
    const cycleAssignments = workoutAssignments.filter(
      assignment => assignment.cycleId === cycleId
    );
    
    if (cycleAssignments.length === 0) return 0;
    
    let totalSets = 0;
    let completedSets = 0;
    
    cycleAssignments.forEach(assignment => {
      const template = cycle.workoutTemplates.find(t => t.id === assignment.workoutTemplateId);
      if (!template) return;
      
      const workoutKey = `${assignment.workoutTemplateId}-${assignment.date}`;
      const progress = detailedWorkoutProgress[workoutKey];
      
      template.exercises.forEach(ex => {
        totalSets += ex.targetSets;
      });
      
      if (progress) {
        Object.values(progress.exercises).forEach(exerciseProgress => {
          if (!exerciseProgress.skipped) {
            completedSets += exerciseProgress.sets.filter(set => set.completed).length;
          }
        });
      }
    });
    
    if (totalSets === 0) return 0;
    return Math.round((completedSets / totalSets) * 100);
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleCyclePress = (cycleId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    (navigation as any).navigate('CycleDetail', { cycleId });
  };

  const formatDateRange = (startDate: string, lengthInWeeks: number) => {
    const start = dayjs(startDate);
    const end = start.add(lengthInWeeks, 'week');
    return `${start.format('MMM D')} – ${end.format('MMM D, YYYY')}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <IconArrowLeft size={24} color={LIGHT_COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('history')}</Text>
        <View style={styles.backButton} />
      </View>

      {/* Cycles List */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {allCycles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('noCyclesYet')}</Text>
            <Text style={styles.emptySubtext}>{t('cyclesWillAppearHere')}</Text>
          </View>
        ) : (
          allCycles.map((cycle) => {
            const completion = getCycleCompletion(cycle.id);
            const isActive = cycle.isActive;

            return (
              <TouchableOpacity
                key={cycle.id}
                style={styles.cycleCard}
                onPress={() => handleCyclePress(cycle.id)}
              >
                <View style={styles.cycleCardInner}>
                  {/* Cycle Header */}
                  <View style={styles.cycleHeader}>
                    <View style={styles.cycleHeaderLeft}>
                      <Text style={styles.cycleName}>
                        {t('cycleNumber').replace('{number}', String(cycle.cycleNumber))}
                      </Text>
                      {isActive && (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>{t('active')}</Text>
                        </View>
                      )}
                    </View>
                    {completion === 100 && !isActive && (
                      <View style={styles.completedBadge}>
                        <IconCheck size={16} color={COLORS.backgroundCanvas} />
                      </View>
                    )}
                  </View>

                  {/* Date Range */}
                  <Text style={styles.cycleDate}>
                    {formatDateRange(cycle.startDate, cycle.lengthInWeeks)}
                  </Text>

                  {/* Cycle Details */}
                  <View style={styles.cycleDetails}>
                    <Text style={styles.cycleDetailText}>
                      {cycle.lengthInWeeks} {cycle.lengthInWeeks === 1 ? t('week') : t('weeks')}
                    </Text>
                    <Text style={styles.cycleDetailSeparator}>•</Text>
                    <Text style={styles.cycleDetailText}>
                      {cycle.workoutsPerWeek} {t('perWeek')}
                    </Text>
                  </View>

                  {/* Progress */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${completion}%` }]} />
                    </View>
                    <Text style={styles.progressText}>{completion}%</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
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
    paddingBottom: SPACING.xl,
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
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
  },
  cycleCard: {
    marginBottom: SPACING.lg,
    backgroundColor: CARDS.cardDeepDimmed.outer.backgroundColor,
    borderRadius: CARDS.cardDeepDimmed.outer.borderRadius,
    borderCurve: CARDS.cardDeepDimmed.outer.borderCurve,
    borderWidth: CARDS.cardDeepDimmed.outer.borderWidth,
    borderColor: CARDS.cardDeepDimmed.outer.borderColor,
    overflow: CARDS.cardDeepDimmed.outer.overflow,
  },
  cycleCardInner: {
    ...CARDS.cardDeepDimmed.inner,
    padding: SPACING.xxl,
  },
  cycleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  cycleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  cycleName: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
  },
  activeBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: LIGHT_COLORS.accentPrimary,
    borderRadius: BORDER_RADIUS.sm,
  },
  activeBadgeText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.backgroundCanvas,
  },
  completedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: LIGHT_COLORS.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleDate: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
    marginBottom: SPACING.md,
  },
  cycleDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  cycleDetailText: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
  },
  cycleDetailSeparator: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
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
    backgroundColor: LIGHT_COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: LIGHT_COLORS.accentPrimary,
  },
  progressText: {
    ...TYPOGRAPHY.metaBold,
    color: LIGHT_COLORS.secondary,
    minWidth: 40,
    textAlign: 'right',
  },
});
