import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../constants';
import { DeltaBadge } from '../common/DeltaBadge';
import { Sparkline } from '../common/Sparkline';
import { IconPR } from '../icons';
import { formatWeight } from '../../utils/weight';
import type { KeyLift } from '../../hooks/useProgressMetrics';

interface KeyLiftCardProps {
  lift: KeyLift;
  useKg: boolean;
  onPress: () => void;
  testID?: string;
}

export function KeyLiftCard({ lift, useKg, onPress, testID }: KeyLiftCardProps) {
  return (
    <TouchableOpacity
      testID={testID}
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.topRow}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{lift.exerciseName}</Text>
          {lift.isPR && (
            <View style={styles.prBadge}>
              <IconPR size={12} color={COLORS.accentPrimary} />
              <Text style={styles.prText}>PR</Text>
            </View>
          )}
        </View>
        {lift.sparklineData.length >= 2 && (
          <Sparkline
            data={lift.sparklineData}
            width={64}
            height={24}
            color={COLORS.accentPrimary}
            strokeWidth={1.5}
          />
        )}
      </View>
      <View style={styles.bottomRow}>
        <Text style={styles.stat}>
          {formatWeight(lift.latestWeight, useKg)} {useKg ? 'kg' : 'lb'} × {lift.latestReps}
        </Text>
        <DeltaBadge value={lift.deltaPercent} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDimmed,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
    marginRight: SPACING.md,
  },
  name: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    flexShrink: 1,
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.accentPrimaryDimmed,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  prText: {
    ...TYPOGRAPHY.note,
    color: COLORS.accentPrimary,
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stat: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
});
