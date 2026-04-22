import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle, TextStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SPACING, TYPOGRAPHY } from '../../constants';
import { useAppTheme } from '../../theme/useAppTheme';

type Props = {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  /** When true, `‹` is not rotated (points left). Default false = rotated 90° to read as "up". */
  chevronPointsLeft?: boolean;
};

/**
 * Lightweight back affordance (stack headers, etc.).
 * By default the chevron is rotated 90° clockwise so it reads as "up" beside the label.
 */
export function BackTextButton({ label, onPress, style, textStyle, chevronPointsLeft = false }: Props) {
  const { colors: themeColors } = useAppTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          alignSelf: 'flex-start',
          paddingHorizontal: SPACING.xxl,
          paddingTop: SPACING.sm,
          paddingBottom: SPACING.md,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        chevronBox: {
          width: 14,
          height: 18,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 6,
        },
        chevron: {
          transform: [{ rotate: '90deg' }],
        },
        label: {
          flexShrink: 1,
        },
        text: {
          ...TYPOGRAPHY.meta,
          color: themeColors.textMeta,
        },
      }),
    [themeColors]
  );
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.button, style]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <View style={styles.row}>
        <View style={styles.chevronBox}>
          <Text style={[styles.text, textStyle, !chevronPointsLeft && styles.chevron]}>‹</Text>
        </View>
        <Text style={[styles.text, textStyle, styles.label]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}
