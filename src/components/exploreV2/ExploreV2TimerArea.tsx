/**
 * Fixed-height timer strip — time is the hero; never shifts the card stack.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated as RNAnimated } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  SharedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { TYPOGRAPHY } from '../../constants';
import { useAppTheme } from '../../theme/useAppTheme';
import { EXPLORE_V2 } from './exploreV2Tokens';
import { EXPLORE_V2_CHROME } from './exploreV2ColorSystem';

type Props = {
  /** Omit to fill parent (e.g. 25% flex band). */
  height?: number;
  /**
   * `band` — fill the animated timer strip (legacy).
   * `overlay` — compact block; parent positions absolute at a fixed % of explore root (center between header & stack).
   */
  layoutVariant?: 'band' | 'overlay';
  active: boolean;
  /** 0 = idle layout, 1 = rest fully entered — drives emergence + color (synced with band in parent) */
  layoutProgress: SharedValue<number>;
  timeLeftSec: number;
  paused: boolean;
  onPauseToggle: () => void;
  /** 0–1 progress for border / track */
  progress: RNAnimated.Value;
  /** Short line under the time (e.g. Rest, Left side) — overlay layout only in practice */
  contextLabel?: string | null;
  /** Work / switch-sides hero: digits + context label use header ink (`inkCharcoal`) on timer tint */
  workTimerVisualActive?: boolean;
  exploreV2WorkBlueProgress?: SharedValue<number>;
};

const TIMER_MOTION = EXPLORE_V2.motion.timer;
const TIMER_DIGIT_EASE = Easing.bezier(...TIMER_MOTION.timerDigitEase);
const DIGIT_TRAVEL_Y = Math.max(12, TIMER_MOTION.timerEnterTranslateY);
const TIMER_LABEL_WIDTH = 236;
const TIMER_DIGIT_SLOT_HEIGHT = 82;
const TIMER_TEXT_Y_OFFSET = 6;

const REST_MS = EXPLORE_V2.motion.rest.colorMs;
/** Fraction of layout progress before hero digits read as fully visible (≈ stagger ms / REST_MS) */
const VALUE_START = Math.min(0.45, EXPLORE_V2.motion.rest.timerValueStaggerMs / REST_MS + 0.08);

const TIMER_SHELL_HAIRLINE = StyleSheet.hairlineWidth;

function DigitSlot({ char, color }: { char: string; color: string }) {
  const previousRef = useRef(char);
  const [fromChar, setFromChar] = useState(char);
  const [toChar, setToChar] = useState(char);
  const [isAnimating, setIsAnimating] = useState(false);
  const t = useSharedValue(1);

  useEffect(() => {
    const prev = previousRef.current;
    if (char === prev) return;
    previousRef.current = char;

    if (char === ' ') {
      setFromChar(' ');
      setToChar(' ');
      setIsAnimating(false);
      t.value = 1;
      return;
    }

    setFromChar(prev);
    setToChar(char);
    setIsAnimating(true);
    t.value = 0;
    t.value = withTiming(
      1,
      {
        duration: TIMER_MOTION.timerDigitChangeMs,
        easing: TIMER_DIGIT_EASE,
      },
      finished => {
        if (finished) runOnJS(setIsAnimating)(false);
      },
    );
  }, [char, t]);

  const outgoing = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.5, 1], [1, 0, 0]),
    transform: [
      {
        translateY:
          TIMER_TEXT_Y_OFFSET + interpolate(t.value, [0, 1], [0, -DIGIT_TRAVEL_Y]),
      },
    ],
  }));

  const incoming = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.25, 1], [0, 1, 1]),
    transform: [
      {
        translateY:
          TIMER_TEXT_Y_OFFSET + interpolate(t.value, [0, 1], [DIGIT_TRAVEL_Y, 0]),
      },
    ],
  }));

  const digitStyle = [styles.timeHero, styles.timeHeroOffset, { color }];

  if (char === ' ') {
    return (
      <View style={styles.digitSlot}>
        <Text style={[styles.timeHero, styles.timeHeroOffset, { color }, styles.slotGhost]}>0</Text>
      </View>
    );
  }

  return (
    <View style={styles.digitSlot}>
      {!isAnimating ? (
        <Text style={digitStyle}>{toChar}</Text>
      ) : (
        <>
          <Animated.Text style={[styles.timeHero, styles.digitOverlay, outgoing, { color }]}>{fromChar}</Animated.Text>
          <Animated.Text style={[styles.timeHero, styles.digitOverlay, incoming, { color }]}>{toChar}</Animated.Text>
        </>
      )}
    </View>
  );
}

export function ExploreV2TimerArea({
  height: heightProp,
  layoutVariant = 'band',
  active,
  layoutProgress,
  timeLeftSec,
  paused,
  onPauseToggle,
  progress: _progress,
  contextLabel,
  workTimerVisualActive = false,
  exploreV2WorkBlueProgress,
}: Props) {
  const { colors: themeColors } = useAppTheme();
  const isOverlay = layoutVariant === 'overlay';
  /** Match explore-v2 header title ink (`inkCharcoal` / `#1F1F1F`) on lime work + switch-sides band */
  const heroInk = workTimerVisualActive ? themeColors.inkCharcoal : EXPLORE_V2_CHROME.timerHeroText;
  const totalSec = Math.max(0, timeLeftSec);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const showMinuteTens = minutes >= 10;
  const mTens = String(Math.floor(minutes / 10) % 10);
  const mOnes = String(minutes % 10);
  const sTens = String(Math.floor(seconds / 10));
  const sOnes = String(seconds % 10);

  /** Fade only — no vertical motion so the clock stays visually stable while the stack resizes. */
  const containerStyle = useAnimatedStyle(() => {
    const p = layoutProgress.value;
    return {
      opacity: interpolate(p, [0, 0.12, 1], [0, 1, 1]),
    };
  });

  /** Digits fade in slightly after shell; no translate — anchored with stack seam */
  const valueStyle = useAnimatedStyle(() => {
    const p = layoutProgress.value;
    return {
      opacity: interpolate(p, [0, VALUE_START, Math.min(1, VALUE_START + 0.2), 1], [0, 0, 1, 1]),
    };
  });

  /** Hairline chrome for rest; width → 0 on work blue so no soft box around the hero */
  const innerBorderStyle = useAnimatedStyle(() => {
    const p = layoutProgress.value;
    const w = exploreV2WorkBlueProgress?.value ?? 0;
    const widthWhenUp = interpolate(w, [0, 1], [TIMER_SHELL_HAIRLINE, 0]);
    return {
      borderWidth: interpolate(p, [0, 1], [0, widthWhenUp]),
      borderColor: interpolateColor(
        p,
        [0, 1],
        ['transparent', EXPLORE_V2_CHROME.timerActiveBorder],
      ),
    };
  });

  const contentPointerEvents =
    !active ? 'none' : isOverlay ? 'box-none' : 'auto';

  return (
    <View
      pointerEvents={isOverlay ? 'box-none' : 'auto'}
      style={[
        isOverlay ? styles.wrapOverlay : styles.wrap,
        !isOverlay && (heightProp != null ? { height: heightProp } : { flex: 1 }),
        !isOverlay && { marginHorizontal: EXPLORE_V2.margin },
      ]}
    >
      <Animated.View
        pointerEvents={isOverlay ? 'box-none' : 'auto'}
        style={[isOverlay ? styles.innerOverlay : styles.inner, innerBorderStyle]}
      >
        <Animated.View
          style={[isOverlay ? styles.timerContentOverlay : styles.timerContent, containerStyle]}
          pointerEvents={contentPointerEvents}
        >
          <>
            <View style={isOverlay ? styles.timerRowOverlay : styles.timerRow} pointerEvents="box-none">
              <Pressable
                onPress={active ? onPauseToggle : undefined}
                disabled={!active}
                style={({ pressed }) => [styles.timerValuePressable, pressed && active && styles.timerValuePressablePressed]}
                accessibilityRole="button"
                accessibilityLabel={
                  contextLabel
                    ? paused
                      ? `Resume timer, ${contextLabel}`
                      : `Pause timer, ${contextLabel}`
                    : paused
                      ? 'Resume rest timer'
                      : 'Pause rest timer'
                }
              >
                <View
                  style={[
                    styles.timerHeroCluster,
                    contextLabel ? styles.timerHeroClusterWithLabel : null,
                  ]}
                >
                  <Animated.View style={[styles.timerValueWrap, valueStyle]}>
                    <View style={styles.slotRow}>
                      {showMinuteTens ? <DigitSlot char={mTens} color={heroInk} /> : null}
                      <DigitSlot char={mOnes} color={heroInk} />
                      <View style={styles.colonSlot}>
                        <Text style={[styles.timeHero, styles.timeHeroOffset, { color: heroInk }]}>:</Text>
                      </View>
                      <DigitSlot char={sTens} color={heroInk} />
                      <DigitSlot char={sOnes} color={heroInk} />
                    </View>
                  </Animated.View>
                  {contextLabel ? (
                    <Animated.View
                      style={[styles.contextLabelWrap, valueStyle]}
                      pointerEvents="none"
                    >
                      <Text
                        style={[styles.contextLabelText, { color: heroInk }]}
                        numberOfLines={1}
                      >
                        {contextLabel}
                      </Text>
                    </Animated.View>
                  ) : null}
                </View>
              </Pressable>
            </View>
          </>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: 'flex-end',
  },
  /** Fixed slot: parent positions absolute; no flex fill — digits stay put while stack resizes */
  wrapOverlay: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    flex: 1,
    borderRadius: 20,
    flexDirection: 'column',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  innerOverlay: {
    alignSelf: 'stretch',
    width: '100%',
    borderRadius: 20,
    flexDirection: 'column',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  timerContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  timerContentOverlay: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerRow: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 12,
    paddingBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Overlay: no horizontal padding so digits sit on true horizontal center of screen band */
  timerRowOverlay: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 0,
    paddingBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerHeroCluster: {
    position: 'relative',
    width: TIMER_LABEL_WIDTH,
    alignItems: 'center',
    alignSelf: 'center',
  },
  /** Room for absolutely positioned subtitle aligned to timer column */
  timerHeroClusterWithLabel: {
    paddingBottom: 22,
    minHeight: TIMER_DIGIT_SLOT_HEIGHT + 18,
  },
  contextLabelWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  contextLabelText: {
    ...TYPOGRAPHY.body,
    opacity: 0.92,
    textAlign: 'center',
  },
  timerValuePressable: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  timerValuePressablePressed: {
    opacity: 0.88,
  },
  timerValueWrap: {
    width: TIMER_LABEL_WIDTH,
    height: TIMER_DIGIT_SLOT_HEIGHT,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitSlot: {
    width: 50,
    height: TIMER_DIGIT_SLOT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  colonSlot: {
    width: 18,
    height: TIMER_DIGIT_SLOT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitOverlay: {
    position: 'absolute',
  },
  slotGhost: {
    opacity: 0,
  },
  timeHero: {
    fontSize: 80,
    lineHeight: 80,
    fontWeight: '400',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  timeHeroOffset: {
    transform: [{ translateY: TIMER_TEXT_Y_OFFSET }],
  },
  trackWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: EXPLORE_V2_CHROME.timerTrack,
  },
  trackFill: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});
