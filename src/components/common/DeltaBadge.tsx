import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { TYPOGRAPHY } from '../../constants';
import { useAppTheme } from '../../theme/useAppTheme';
import { getAppThemeFromStore } from '../../theme/getAppThemeFromStore';

interface DeltaBadgeProps {
  value: number | null;
  suffix?: string;
}

export function DeltaBadge({ value, suffix }: DeltaBadgeProps) {
  if (value === null) return <Text style={styles.neutral}>—</Text>;

  const isPositive = value > 0;
  const color = isPositive ? themeColors.successBright : themeColors.textMeta;
  const prefix = isPositive ? '+' : '';

  return (
    <Text style={[styles.text, { color }]}>
      {prefix}{value}%{suffix ? ` ${suffix}` : ''}
    </Text>
  );
}

const themeColors = getAppThemeFromStore().colors;
const styles = StyleSheet.create({
  text: {
    ...TYPOGRAPHY.meta,
    fontWeight: '600',
  },
  neutral: {
    ...TYPOGRAPHY.meta,
    color: themeColors.textMetaSoft,
  },
});