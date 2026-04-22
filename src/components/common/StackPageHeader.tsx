import React from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BackTextButton } from './BackTextButton';
import { SPACING, TYPOGRAPHY } from '../../constants';
import { useAppTheme } from '../../theme/useAppTheme';

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
  /**
   * When true, the full header (back row + large title) is a single press target; `onBackPress` is invoked.
   * Use for sheets where the user expects tapping the title to dismiss.
   */
  unifiedHeaderPressable?: boolean;
};

type UnifiedHeaderInnerProps = Omit<StackPageHeaderProps, 'unifiedHeaderPressable'>;

function StackPageHeaderUnified({
  paddingTop,
  backLabel,
  onBackPress,
  title,
  titleColor,
  backTextStyle,
  backChevronPointsLeft = false,
  style,
}: UnifiedHeaderInnerProps) {
  const { colors: themeColors } = useAppTheme();
  return (
    <View style={[{ paddingTop }, style]}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onBackPress();
        }}
        style={({ pressed }) => [unifiedPressStyles.hit, pressed && unifiedPressStyles.pressed]}
      >
        <View style={unifiedBackStyles.backButton}>
          <View style={unifiedBackStyles.row}>
            <View style={unifiedBackStyles.chevronBox}>
              <Text
                style={[
                  unifiedBackStyles.text,
                  { color: themeColors.textMeta },
                  backTextStyle,
                  !backChevronPointsLeft && unifiedBackStyles.chevron,
                ]}
              >
                ‹
              </Text>
            </View>
            <Text
              style={[
                unifiedBackStyles.text,
                { color: themeColors.textMeta },
                backTextStyle,
                unifiedBackStyles.label,
              ]}
              numberOfLines={1}
            >
              {backLabel}
            </Text>
          </View>
        </View>
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        </View>
      </Pressable>
    </View>
  );
}

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
  unifiedHeaderPressable = false,
}: StackPageHeaderProps) {
  if (unifiedHeaderPressable) {
    return (
      <StackPageHeaderUnified
        paddingTop={paddingTop}
        backLabel={backLabel}
        onBackPress={onBackPress}
        title={title}
        titleColor={titleColor}
        backTextStyle={backTextStyle}
        backChevronPointsLeft={backChevronPointsLeft}
        style={style}
      />
    );
  }

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

const unifiedPressStyles = StyleSheet.create({
  hit: {
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.88,
  },
});

/** Mirrors `BackTextButton` layout (non-pressable row) for unified header. */
const unifiedBackStyles = StyleSheet.create({
  backButton: {
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
  },
});
