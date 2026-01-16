import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconAdd } from './icons';
import dayjs from 'dayjs';
import { useTranslation } from '../i18n/useTranslation';

interface CyclesViewProps {
  onCreateCycle: () => void;
  onCyclePress: (cycleId: string) => void;
}

export function CyclesView({ onCreateCycle, onCyclePress }: CyclesViewProps) {
  const { cycles } = useStore();
  const { t } = useTranslation();
  
  // Sort cycles by date (newest first)
  const sortedCycles = [...cycles].sort((a, b) => 
    dayjs(b.startDate).valueOf() - dayjs(a.startDate).valueOf()
  );
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Create Cycle Button */}
      <TouchableOpacity 
        style={styles.createButton} 
        onPress={onCreateCycle}
        activeOpacity={1}
      >
        <View style={styles.createIconContainer}>
          <IconAdd size={24} color={COLORS.text} />
        </View>
        <Text style={styles.createButtonText}>{t('newCycleButton')}</Text>
      </TouchableOpacity>
      
      {/* Cycles List */}
      {sortedCycles.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{t('noCyclesYet')}</Text>
          <Text style={styles.emptySubtext}>{t('noCyclesYetSubtext')}</Text>
        </View>
      ) : (
        sortedCycles.map((cycle) => {
          const currentWeek = Math.floor(
            dayjs().diff(dayjs(cycle.startDate), 'week')
          ) + 1;
          const isComplete = currentWeek > cycle.lengthInWeeks;
          
          return (
            <TouchableOpacity
              key={cycle.id}
              style={[styles.cycleCard, cycle.isActive && styles.cycleCardActive]}
              onPress={() => onCyclePress(cycle.id)}
              activeOpacity={1}
            >
              {/* Header */}
              <View style={styles.cycleHeader}>
                <View style={styles.cycleTitleRow}>
                  <Text style={styles.cycleName}>
                    {t('cycleNumber').replace('{number}', String(cycle.cycleNumber))}
                  </Text>
                  {cycle.isActive && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>{t('activeBadge')}</Text>
                    </View>
                  )}
                  {isComplete && !cycle.isActive && (
                    <View style={styles.completeBadge}>
                      <Text style={styles.completeBadgeText}>{t('completeBadge')}</Text>
                    </View>
                  )}
                </View>
              </View>
              
              {/* Week Progress */}
              {cycle.isActive && !isComplete && (
                <View style={styles.weekProgress}>
                  <Text style={styles.weekText}>
                    Week {currentWeek} of {cycle.lengthInWeeks}
                  </Text>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressBarFill, 
                        { width: `${(currentWeek / cycle.lengthInWeeks) * 100}%` }
                      ]} 
                    />
                  </View>
                </View>
              )}
              
              {/* Stats Row */}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{cycle.lengthInWeeks}</Text>
                  <Text style={styles.statLabel}>{t('weeks')}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{cycle.workoutsPerWeek}</Text>
                  <Text style={styles.statLabel}>{t('perWeekLabel')}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{cycle.workoutTemplates.length}</Text>
                  <Text style={styles.statLabel}>{t('workoutsCountLabel')}</Text>
                </View>
              </View>
              
              {/* Dates */}
              <Text style={styles.cycleDate}>
                {dayjs(cycle.startDate).format('MMM D')} - {dayjs(cycle.endDate).format('MMM D, YYYY')}
              </Text>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: 100, // Space for FAB
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.canvas,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
  },
  createIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  createButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.textPrimary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl * 2,
  },
  emptyText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    textAlign: 'center',
    paddingHorizontal: SPACING.xxxl,
  },
  cycleCard: {
    backgroundColor: COLORS.canvas,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cycleCardActive: {
    borderColor: COLORS.primary,
  },
  cycleHeader: {
    marginBottom: SPACING.md,
  },
  cycleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  cycleName: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    marginRight: SPACING.sm,
  },
  activeBadge: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  activeBadgeText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.primary,
    fontSize: 11,
  },
  completeBadge: {
    backgroundColor: COLORS.container,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  completeBadgeText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.textMeta,
    fontSize: 11,
  },
  cycleGoal: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  weekProgress: {
    marginBottom: SPACING.md,
  },
  weekText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.container,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    gap: SPACING.lg,
  },
  stat: {
    flex: 1,
  },
  statValue: {
    ...TYPOGRAPHY.number,
    color: COLORS.textPrimary,
  },
  statLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  cycleDate: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
});


