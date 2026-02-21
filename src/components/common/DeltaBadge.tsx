import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY } from '../../constants';

interface DeltaBadgeProps {
  value: number | null;
  suffix?: string;
}

export function DeltaBadge({ value, suffix }: DeltaBadgeProps) {
  if (value === null) return <Text style={styles.neutral}>—</Text>;

  const isPositive = value > 0;
  const color = isPositive ? COLORS.successBright : COLORS.textMeta;
  const prefix = isPositive ? '+' : '';

  return (
    <Text style={[styles.text, { color }]}>
      {prefix}{value}%{suffix ? ` ${suffix}` : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    ...TYPOGRAPHY.meta,
    fontWeight: '600',
  },
  neutral: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMetaSoft,
  },
});
