import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import dayjs from 'dayjs';
import { SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../constants';
import { useAppTheme } from '../../theme/useAppTheme';
import { formatWeight } from '../../utils/weight';
import type { ExerciseWeightProgressRow as Row } from '../../types/exerciseWeightProgress';

type Props = {
  row: Row;
  useKg: boolean;
  mainLiftBadgeLabel: string;
  weightUnitLabel: string;
};

function WeightStatColumn({
  weightLbs,
  dateIso,
  useKg,
  weightUnitLabel,
  primaryColor,
  secondaryColor,
}: {
  weightLbs: number;
  dateIso: string;
  useKg: boolean;
  weightUnitLabel: string;
  primaryColor: string;
  secondaryColor: string;
}) {
  return (
    <View style={styles.statColumn}>
      <Text style={[styles.weightLine, { color: primaryColor }]}>
        {formatWeight(weightLbs, useKg)} {weightUnitLabel}
      </Text>
      <Text style={[styles.date, { color: secondaryColor }]}>{dayjs(dateIso).format('MMM D, YYYY')}</Text>
    </View>
  );
}

export function ExerciseWeightProgressRowView({
  row,
  useKg,
  mainLiftBadgeLabel,
  weightUnitLabel,
}: Props) {
  const { colors: themeColors } = useAppTheme();
  const primaryColor = themeColors.containerPrimary;
  const secondaryColor = themeColors.textMeta;

  const weightDeltaLabel = useMemo(() => {
    const deltaLbs = row.highestLoggedWeightLbs - row.firstLoggedWeightLbs;
    if (deltaLbs <= 0) {
      return `0 ${weightUnitLabel}`;
    }
    return `+${formatWeight(deltaLbs, useKg)} ${weightUnitLabel}`;
  }, [row.firstLoggedWeightLbs, row.highestLoggedWeightLbs, useKg, weightUnitLabel]);

  return (
    <View style={styles.row}>
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: primaryColor }]} numberOfLines={2}>
            {row.exerciseName}
          </Text>
          {row.isKeyLift ? (
            <View style={[styles.badge, { backgroundColor: themeColors.containerPrimaryDark }]}>
              <Text style={[styles.badgeText, { color: secondaryColor }]}>{mainLiftBadgeLabel}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <WeightStatColumn
            weightLbs={row.firstLoggedWeightLbs}
            dateIso={row.firstLoggedDate}
            useKg={useKg}
            weightUnitLabel={weightUnitLabel}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
          />
          <WeightStatColumn
            weightLbs={row.highestLoggedWeightLbs}
            dateIso={row.highestLoggedDate}
            useKg={useKg}
            weightUnitLabel={weightUnitLabel}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
          />
        </View>
      </View>

      <View style={styles.deltaColumn}>
        <Text style={[styles.delta, { color: primaryColor }]}>{weightDeltaLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginBottom: SPACING.xs,
  },
  content: {
    flex: 1,
    minWidth: 0,
    paddingRight: SPACING.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  /** Matches `ExploreV2CurrentCard` `exerciseName` (workout logging current card). */
  name: {
    ...TYPOGRAPHY.h2,
    flex: 1,
  },
  badge: {
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  badgeText: {
    ...TYPOGRAPHY.meta,
    fontSize: 11,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.xxl,
  },
  statColumn: {
    alignItems: 'flex-start',
  },
  weightLine: {
    ...TYPOGRAPHY.h2,
  },
  date: {
    ...TYPOGRAPHY.meta,
    marginTop: 4,
  },
  deltaColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  delta: {
    ...TYPOGRAPHY.h2,
  },
});
