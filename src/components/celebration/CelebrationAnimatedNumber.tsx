/**
 * Shared animated metric numerals for workout completion — one motion pattern, one type scale.
 */
import React from 'react';
import { Platform, StyleSheet, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import type { AppTheme } from '../../theme/appTheme';
import {
  CELEBRATION_TIMING,
  CELEBRATION_TYPE,
  HERO_TRAIL_STACK,
  type TrailLayerSpec,
} from './workoutCompletionCelebration.constants';

export function celebrationTrailColor(
  role: TrailLayerSpec['role'],
  themeColors: AppTheme['colors'],
): { color: string; opacity?: number } {
  switch (role) {
    case 'tertiary':
      return { color: themeColors.canvasLight };
    case 'accent':
      return { color: themeColors.celebrationTrailMid };
    case 'front':
      return { color: themeColors.containerSecondary };
    default:
      return { color: themeColors.containerSecondary };
  }
}

/** 3-layer trail + front — same as total-weight hero, for streak / PR digits */
export function CelebrationStackedDigits({
  value,
  colors,
  stackFront,
  stackAccent,
  stackTertiary,
  travel = CELEBRATION_TIMING.heroFrontTranslateStart,
  style,
}: {
  value: string;
  colors: AppTheme['colors'];
  stackFront: SharedValue<number>;
  stackAccent: SharedValue<number>;
  stackTertiary: SharedValue<number>;
  travel?: number;
  style?: ViewStyle;
}) {
  /** Render the in-flow (relative) layer first so the container gets correct width/height in flex rows. */
  return (
    <View style={[style, { flexGrow: 0, flexShrink: 0, alignSelf: 'flex-start' }]}>
      <CelebrationAnimatedNumber
        key="front"
        value={value}
        color={colors.containerSecondary}
        progress={stackFront}
        position="relative"
        zIndex={10}
        travel={travel}
      />
      {HERO_TRAIL_STACK.filter(layer => layer.role !== 'front').map(layer => {
        const trailProgress = layer.stackIndex === 1 ? stackAccent : stackTertiary;
        const { color, opacity } = celebrationTrailColor(layer.role, colors);
        return (
          <CelebrationAnimatedNumber
            key={`trail-${layer.stackIndex}`}
            value={value}
            color={color}
            progress={trailProgress}
            position="absolute"
            opacity={opacity ?? 1}
            travel={travel}
          />
        );
      })}
    </View>
  );
}

const digitBase: TextStyle = {
  fontVariant: ['tabular-nums'],
  ...(Platform.OS === 'ios' ? { fontFamily: 'System' } : {}),
};

/** Same typography as `CelebrationAnimatedUnit` (e.g. lb) — for static `Text` elsewhere */
export const celebrationUnitTypography: TextStyle = {
  ...digitBase,
  fontSize: CELEBRATION_TYPE.heroUnitSize,
  fontWeight: CELEBRATION_TYPE.heroUnitWeight,
  letterSpacing: 0.5,
};

/** Same size/weight as stacked metric numerals — for paired static labels (e.g. “day streak”) */
export const celebrationMetricValueTypography: TextStyle = {
  ...digitBase,
  fontSize: CELEBRATION_TYPE.heroMainSize,
  lineHeight: CELEBRATION_TYPE.heroMainLineHeight,
  fontWeight: CELEBRATION_TYPE.heroMainWeight,
  letterSpacing: CELEBRATION_TYPE.heroLetterSpacing,
};

/** Third-row unit copy — same weight/tracking family as metrics */
export const celebrationStatUnitTypography: TextStyle = {
  ...digitBase,
  fontSize: CELEBRATION_TYPE.statUnitSize,
  lineHeight: CELEBRATION_TYPE.statUnitLineHeight,
  fontWeight: CELEBRATION_TYPE.heroMainWeight,
  letterSpacing: CELEBRATION_TYPE.heroLetterSpacing,
};

export function CelebrationAnimatedNumber({
  value,
  color,
  progress,
  travel = CELEBRATION_TIMING.heroFrontTranslateStart,
  position = 'relative',
  zIndex,
  opacity = 1,
}: {
  value: string;
  color: string;
  progress: SharedValue<number>;
  /** Horizontal slide distance (px), from right toward rest; default matches trail */
  travel?: number;
  position?: 'absolute' | 'relative';
  zIndex?: number;
  /** Static opacity (e.g. trail role tint) */
  opacity?: number;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [travel, 0]) }],
  }));

  return (
    <Animated.Text
      style={[
        styles.largeNumber,
        { color, opacity },
        position === 'absolute' && styles.absoluteFill,
        zIndex != null && { zIndex },
        animatedStyle,
      ]}
      allowFontScaling={false}
      {...(Platform.OS === 'android' ? { includeFontPadding: false } : {})}
    >
      {value}
    </Animated.Text>
  );
}

/** Unit label (lb) — same slide as paired number, smaller type */
export function CelebrationAnimatedUnit({
  unit,
  color,
  progress,
  travel = 20,
  style,
}: {
  unit: string;
  color: string;
  progress: SharedValue<number>;
  travel?: number;
  style?: TextStyle;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [travel, 0]) }],
  }));

  return (
    <Animated.Text
      style={[
        styles.unit,
        { color },
        styles.unitSpacing,
        style,
        animatedStyle,
      ]}
      allowFontScaling={false}
      {...(Platform.OS === 'android' ? { includeFontPadding: false } : {})}
    >
      {unit}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  largeNumber: {
    ...celebrationMetricValueTypography,
  },
  absoluteFill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  unit: {
    ...celebrationUnitTypography,
  },
  unitSpacing: {
    marginLeft: 6,
  },
});
