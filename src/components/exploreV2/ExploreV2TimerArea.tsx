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

function DigitSlot({ char }: { char: string }) {
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

  if (char === ' ') {
    return (
      <View style={styles.digitSlot}>
        <Text style={[styles.timeHero, styles.timeHeroOffset, styles.slotGhost]}>0</Text>
      </View>
    );
  }

  return (
    <View style={styles.digitSlot}>
      {!isAnimating ? (
        <Text style={[styles.timeHero, styles.timeHeroOffset]}>{toChar}</Text>
      ) : (
        <>
          <Animated.Text style={[styles.timeHero, styles.digitOverlay, outgoing]}>{fromChar}</Animated.Text>
          <Animated.Text style={[styles.timeHero, styles.digitOverlay, incoming]}>{toChar}</Animated.Text>
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
}: Props) {
  const isOverlay = layoutVariant === 'overlay';
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

  const innerBorderStyle = useAnimatedStyle(() => {
    const p = layoutProgress.value;
    return {
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
                accessibilityLabel={paused ? 'Resume rest timer' : 'Pause rest timer'}
              >
                <Animated.View style={[styles.timerValueWrap, valueStyle]}>
                  <View style={styles.slotRow}>
                    {showMinuteTens ? <DigitSlot char={mTens} /> : null}
                    <DigitSlot char={mOnes} />
                    <View style={styles.colonSlot}>
                      <Text style={[styles.timeHero, styles.timeHeroOffset]}>:</Text>
                    </View>
                    <DigitSlot char={sTens} />
                    <DigitSlot char={sOnes} />
                  </View>
                </Animated.View>
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  innerOverlay: {
    alignSelf: 'stretch',
    width: '100%',
    borderRadius: 20,
    flexDirection: 'column',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
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
    color: EXPLORE_V2_CHROME.timerHeroText,
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
