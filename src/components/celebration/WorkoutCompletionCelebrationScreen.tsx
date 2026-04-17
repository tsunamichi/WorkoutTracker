/**
 * Full-screen workout completion celebration — editorial / recap-poster direction.
 * Prototype: mocked data + staged Reanimated motion. Wire to completion flow later.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAppTheme } from '../../theme/useAppTheme';
import { SPACING, TYPOGRAPHY } from '../../constants';
import {
  MOCK_WORKOUT_COMPLETION,
  CELEBRATION_TIMING,
  CELEBRATION_TYPE,
  CELEBRATION_SHAPES,
  CELEBRATION_LAYOUT,
} from './workoutCompletionCelebration.constants';
import {
  CelebrationStackedDigits,
  celebrationStatUnitTypography,
} from './CelebrationAnimatedNumber';

export type WorkoutCompletionCelebrationData = {
  completionLabel: string;
  headerLiftSummary: string;
  streakIntro: string;
  streakNumber: string;
  streakDetail: string;
  prIntro: string;
  prMain: string;
  prDetail: string;
  /** When false, the PR stat block is hidden (e.g. no new PR today). */
  showPr?: boolean;
};

export type WorkoutCompletionCelebrationScreenProps = {
  /** Defaults to MOCK_WORKOUT_COMPLETION */
  data?: Partial<WorkoutCompletionCelebrationData>;
  /** Runs entrance sequence on mount */
  autoPlay?: boolean;
  /** Shows a top-right Done control when set (e.g. after navigating from a finished workout). */
  onRequestClose?: () => void;
};

export function WorkoutCompletionCelebrationScreen({
  data: dataProp,
  autoPlay = true,
  onRequestClose,
}: WorkoutCompletionCelebrationScreenProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const data: WorkoutCompletionCelebrationData = {
    ...MOCK_WORKOUT_COMPLETION,
    ...dataProp,
    showPr: dataProp?.showPr !== false,
  };

  const blobAScale = useSharedValue(0.22);
  const blobBScale = useSharedValue(0.18);
  const streakStackFront = useSharedValue(0);
  const streakStackAccent = useSharedValue(0);
  const streakStackTertiary = useSharedValue(0);
  const prStackFront = useSharedValue(0);
  const prStackAccent = useSharedValue(0);
  const prStackTertiary = useSharedValue(0);

  useEffect(() => {
    if (!autoPlay) return;

    const t = CELEBRATION_TIMING;
    const ease = Easing.out(Easing.cubic);

    blobAScale.value = withTiming(1, { duration: t.blobADurationMs, easing: ease });
    blobBScale.value = withDelay(
      t.blobBDelayMs,
      withTiming(1, { duration: t.blobBDurationMs, easing: ease }),
    );

    const bg = t.backgroundReadyMs;
    const D = t.chainDurationMs;
    const δ = t.layerStaggerMs;

    const streakBase = bg + t.supportStartDelayMs;
    streakStackFront.value = withDelay(streakBase, withTiming(1, { duration: D, easing: ease }));
    streakStackAccent.value = withDelay(streakBase + δ, withTiming(1, { duration: D, easing: ease }));
    streakStackTertiary.value = withDelay(streakBase + 2 * δ, withTiming(1, { duration: D, easing: ease }));

    const prBase = streakBase + t.supportStaggerMs;
    prStackFront.value = withDelay(prBase, withTiming(1, { duration: D, easing: ease }));
    prStackAccent.value = withDelay(prBase + δ, withTiming(1, { duration: D, easing: ease }));
    prStackTertiary.value = withDelay(prBase + 2 * δ, withTiming(1, { duration: D, easing: ease }));
  }, [
    autoPlay,
    blobAScale,
    blobBScale,
    streakStackFront,
    streakStackAccent,
    streakStackTertiary,
    prStackFront,
    prStackAccent,
    prStackTertiary,
  ]);

  const pageBg = colors.containerPrimary;

  const blobAStyle = useAnimatedStyle(() => ({
    transform: [{ scale: blobAScale.value }],
    opacity: CELEBRATION_SHAPES.blobAOpacity,
  }));

  const blobBStyle = useAnimatedStyle(() => ({
    transform: [{ scale: blobBScale.value }],
    opacity: CELEBRATION_SHAPES.blobBOpacity,
  }));

  /** Matches TodayScreen `scheduleHeaderTitle` / `scheduleHeaderDateLabel` (displayLarge + role color). */
  const headerTitleStyle = [TYPOGRAPHY.displayLarge, { color: colors.containerSecondary }] as const;
  const headerSubtitleStyle = [TYPOGRAPHY.displayLarge, { color: colors.containerTertiary }] as const;
  const statIntroStyle = [TYPOGRAPHY.body, { color: colors.containerTertiary }] as const;

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      <StatusBar style="light" />

      {onRequestClose ? (
        <Pressable
          onPress={onRequestClose}
          hitSlop={12}
          style={[styles.doneButton, { top: insets.top + 8, right: CELEBRATION_LAYOUT.screenPaddingH }]}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={[styles.doneButtonText, { color: colors.containerSecondary }]}>Done</Text>
        </Pressable>
      ) : null}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.blob,
          {
            top: CELEBRATION_SHAPES.blobATop,
            right: CELEBRATION_SHAPES.blobARight,
            width: CELEBRATION_SHAPES.blobASize,
            height: CELEBRATION_SHAPES.blobASize,
            borderRadius: CELEBRATION_SHAPES.blobASize / 2,
            backgroundColor: colors.accentPrimary,
          },
          blobAStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.blob,
          {
            bottom: CELEBRATION_SHAPES.blobBBottom,
            left: CELEBRATION_SHAPES.blobBLeft,
            width: CELEBRATION_SHAPES.blobBSize,
            height: CELEBRATION_SHAPES.blobBSize,
            borderRadius: CELEBRATION_SHAPES.blobBSize / 2,
            backgroundColor: colors.containerTertiary,
          },
          blobBStyle,
        ]}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + CELEBRATION_LAYOUT.safeTopExtra,
            paddingHorizontal: CELEBRATION_LAYOUT.screenPaddingH,
            paddingBottom: 0,
          },
        ]}
      >
        <View style={styles.mainColumn}>
          {/* Header — same type scale as Today “Workout of the day” (displayLarge); static copy only */}
          <View style={styles.headerStack}>
            <Text style={headerTitleStyle} allowFontScaling={false}>
              {data.completionLabel}
            </Text>
            <Text style={headerSubtitleStyle} allowFontScaling={false}>
              {data.headerLiftSummary}
            </Text>
          </View>

          {/* Stats — each type: intro row → value row → unit row */}
          <View style={styles.supportBlock}>
            <View style={styles.statBlock}>
              <Text style={[statIntroStyle, styles.statIntroSpacing]} allowFontScaling={false}>
                {data.streakIntro}
              </Text>
              <CelebrationStackedDigits
                value={data.streakNumber}
                colors={colors}
                stackFront={streakStackFront}
                stackAccent={streakStackAccent}
                stackTertiary={streakStackTertiary}
                style={styles.statValueStack}
              />
              <Text
                style={[celebrationStatUnitTypography, styles.statUnitOffset, { color: colors.containerSecondary }]}
                allowFontScaling={false}
              >
                {data.streakDetail}
              </Text>
            </View>

            {data.showPr !== false ? (
              <View style={styles.statBlock}>
                <Text style={[statIntroStyle, styles.statIntroSpacing]} allowFontScaling={false}>
                  {data.prIntro}
                </Text>
                <CelebrationStackedDigits
                  value={data.prMain}
                  colors={colors}
                  stackFront={prStackFront}
                  stackAccent={prStackAccent}
                  stackTertiary={prStackTertiary}
                  style={styles.statValueStack}
                />
                <Text
                  style={[celebrationStatUnitTypography, styles.statUnitOffset, { color: colors.containerSecondary }]}
                  allowFontScaling={false}
                >
                  {data.prDetail}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  doneButton: {
    position: 'absolute',
    zIndex: 20,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  doneButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  blob: {
    position: 'absolute',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  mainColumn: {
    flex: 1,
  },
  headerStack: {
    alignSelf: 'stretch',
    marginBottom: CELEBRATION_LAYOUT.gapHeaderToStats,
    paddingBottom: SPACING.lg,
    gap: 4,
  },
  statBlock: {
    width: '100%',
    alignItems: 'flex-start',
  },
  /** Space before the animated value */
  statIntroSpacing: {
    marginBottom: SPACING.xxl,
  },
  statValueStack: {
    position: 'relative',
    minHeight: CELEBRATION_TYPE.heroMainLineHeight + 16,
    overflow: 'visible',
  },
  statUnitOffset: {
    marginTop: -20,
  },
  supportBlock: {
    marginTop: 0,
    width: '100%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: CELEBRATION_LAYOUT.statSectionGap,
  },
});
