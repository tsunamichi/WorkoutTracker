import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../../constants';

export type CoreProgramProgressStripProps = {
  /** Total completed sessions that count toward the program */
  completedCount: number;
  /** Total expected sessions (e.g. 18 for 6 weeks * 3/week) */
  totalExpected: number;
};

export function CoreProgramProgressStrip({
  completedCount,
  totalExpected,
}: CoreProgramProgressStripProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Total:</Text>
        <Text style={styles.totalText}>
          {completedCount} / {totalExpected} sessions
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    gap: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  label: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    minWidth: 72,
  },
  totalText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.text,
  },
});
