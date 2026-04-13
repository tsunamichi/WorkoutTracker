import React from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { BackTextButton } from './BackTextButton';
import { SPACING, TYPOGRAPHY } from '../../constants';

export type StackPageHeaderProps = {
  /** Safe-area top inset (typically `insets.top`). */
  paddingTop: number;
  backLabel: string;
  onBackPress: () => void;
  title: string;
  titleColor: string;
  /** Optional override for the back row (defaults to `BackTextButton` meta styling). */
  backTextStyle?: TextStyle;
  /** Settings only: pass true for a left-pointing chevron. Extras sheets keep default “up” chevron. */
  backChevronPointsLeft?: boolean;
  style?: ViewStyle;
};

/**
 * Large-title stack header: back affordance + display title (matches Profile / Settings).
 */
export function StackPageHeader({
  paddingTop,
  backLabel,
  onBackPress,
  title,
  titleColor,
  backTextStyle,
  backChevronPointsLeft = false,
  style,
}: StackPageHeaderProps) {
  return (
    <View style={[{ paddingTop }, style]}>
      <BackTextButton
        label={backLabel}
        onPress={onBackPress}
        textStyle={backTextStyle}
        chevronPointsLeft={backChevronPointsLeft}
      />
      <View style={styles.titleWrap}>
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleWrap: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: 0,
    marginBottom: SPACING.xxxl + SPACING.sm,
  },
  title: {
    ...TYPOGRAPHY.displayLarge,
  },
});
