import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../constants';
import { Sparkline } from '../common/Sparkline';
import { IconAdd } from '../icons';
import { formatWeight } from '../../utils/weight';
import type { BodyWeightEntry } from '../../types';

interface WeeklyWeightCardProps {
  latestEntry: BodyWeightEntry | null;
  previousWeekEntry: BodyWeightEntry | null;
  weightTrend: number[];
  useKg: boolean;
  onLogWeight: () => void;
}

export function WeeklyWeightCard({
  latestEntry,
  previousWeekEntry,
  weightTrend,
  useKg,
  onLogWeight,
}: WeeklyWeightCardProps) {
  if (!latestEntry) {
    return (
      <TouchableOpacity testID="progress-body-weekly-card" style={styles.emptyCard} onPress={onLogWeight} activeOpacity={0.7}>
        <IconAdd size={18} color={COLORS.textMeta} />
        <Text style={styles.emptyText}>Log weight</Text>
      </TouchableOpacity>
    );
  }

  const delta = previousWeekEntry
    ? latestEntry.weight - previousWeekEntry.weight
    : null;
  const unit = useKg ? 'kg' : 'lb';

  return (
    <View testID="progress-body-weekly-card" style={styles.card}>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text testID="progress-body-weekly-card-weight" style={styles.weight}>
            {formatWeight(latestEntry.weight, useKg)} {unit}
          </Text>
          {delta !== null ? (
            <Text style={[styles.delta, { color: delta <= 0 ? COLORS.successBright : COLORS.textMeta }]}>
              {delta > 0 ? '+' : ''}{formatWeight(Math.abs(delta), useKg)} {unit} vs last week
            </Text>
          ) : (
            <Text style={styles.deltaLabel}>This week</Text>
          )}
        </View>
        {weightTrend.length >= 2 && (
          <View testID="progress-body-weight-trend">
            <Sparkline
              data={weightTrend}
              width={72}
              height={28}
              color={COLORS.textMeta}
              strokeWidth={1.5}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderDimmed,
    padding: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
    marginRight: SPACING.md,
  },
  weight: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    marginBottom: 2,
  },
  delta: {
    ...TYPOGRAPHY.meta,
  },
  deltaLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  emptyCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderDimmed,
    borderStyle: 'dashed',
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  emptyText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
});
