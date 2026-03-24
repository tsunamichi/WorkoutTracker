/**
 * Fixed-height timer strip — time is the hero; never shifts the card stack.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated as RNAnimated, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { EXPLORE_V2 } from './exploreV2Tokens';
import { EXPLORE_V2_CHROME } from './exploreV2ColorSystem';
import { EXPLORE_V2_PALETTES } from './exploreV2ColorSystem';
import { IconPause, IconPlay, IconSkip } from '../icons';

type Props = {
  /** Omit to fill parent (e.g. 25% flex band). */
  height?: number;
  active: boolean;
  timeLeftSec: number;
  paused: boolean;
  onPauseToggle: () => void;
  onSkip: () => void;
  /** 0–1 progress for border / track */
  progress: RNAnimated.Value;
};

const TIMER_MOTION = EXPLORE_V2.motion.timer;
const TIMER_ENTER_EASE = Easing.bezier(...TIMER_MOTION.timerContainerEnterEase);
const TIMER_EXIT_EASE = Easing.bezier(...TIMER_MOTION.timerContainerExitEase);
const TIMER_DIGIT_EASE = Easing.bezier(...TIMER_MOTION.timerDigitEase);
const INCOMING_DIGIT_DELAY_FRACTION = 0.16;
const TIMER_CONTROL_BG = EXPLORE_V2_PALETTES.complete.main;
const TIMER_CONTROL_BG_ACTIVE = '#F3940F';
const TIMER_CONTROL_ICON_ACTIVE = '#8C5509';
const TIMER_LABEL_WIDTH = 236;
const TIMER_DIGIT_SLOT_HEIGHT = 82;
const TIMER_TEXT_Y_OFFSET = 6;

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
    // Requested behavior: outgoing digit disappears immediately (no roll/fade animation).
    opacity: interpolate(t.value, [0, 0.001, 1], [1, 0, 0]),
    transform: [{ translateY: 0 }],
  }));

  const incoming = useAnimatedStyle(() => ({
    // Keep incoming fully hidden at first so outgoing can disappear cleanly.
    opacity: interpolate(
      t.value,
      [0, INCOMING_DIGIT_DELAY_FRACTION, 1],
      [0, 0, 1],
    ),
    transform: [{
      translateY: interpolate(
        t.value,
        [0, INCOMING_DIGIT_DELAY_FRACTION, 1],
        [TIMER_MOTION.timerDigitOffsetY, TIMER_MOTION.timerDigitOffsetY, 0],
      ),
    }],
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
          <Animated.Text style={[styles.timeHero, styles.timeHeroOffset, styles.digitOverlay, outgoing]}>{fromChar}</Animated.Text>
          <Animated.Text style={[styles.timeHero, styles.timeHeroOffset, styles.digitOverlay, incoming]}>{toChar}</Animated.Text>
        </>
      )}
    </View>
  );
}

export function ExploreV2TimerArea({
  height: heightProp,
  active,
  timeLeftSec,
  paused,
  onPauseToggle,
  onSkip,
  progress,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const prevActiveRef = useRef(active);
  const [timerRowWidth, setTimerRowWidth] = useState(0);
  const availableRowWidth = timerRowWidth > 0 ? timerRowWidth : screenWidth - EXPLORE_V2.margin * 2;
  const timerGap = Math.max(10, Math.min(32, (availableRowWidth - TIMER_LABEL_WIDTH - 96 - 24) / 2));

  const containerY = useSharedValue(active ? 0 : TIMER_MOTION.timerEnterTranslateY);
  const containerScale = useSharedValue(active ? 1 : TIMER_MOTION.timerEnterScaleFrom);
  const containerOpacity = useSharedValue(active ? 1 : 0);
  const valueProgress = useSharedValue(active ? 1 : 0);
  const controlsProgress = useSharedValue(active ? 1 : 0);
  const borderProgress = useSharedValue(active ? 1 : 0);

  const totalSec = Math.max(0, timeLeftSec);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const showMinuteTens = minutes >= 10;
  const mTens = String(Math.floor(minutes / 10) % 10);
  const mOnes = String(minutes % 10);
  const sTens = String(Math.floor(seconds / 10));
  const sOnes = String(seconds % 10);

  useEffect(() => {
    const wasActive = prevActiveRef.current;
    prevActiveRef.current = active;

    if (active) {
      if (!wasActive) {
        containerY.value = TIMER_MOTION.timerEnterTranslateY;
        containerScale.value = TIMER_MOTION.timerEnterScaleFrom;
        containerOpacity.value = 0;
        valueProgress.value = 0;
        controlsProgress.value = 0;
        borderProgress.value = 0;
      }

      borderProgress.value = withTiming(1, {
        duration: TIMER_MOTION.timerEnterMs,
        easing: TIMER_ENTER_EASE,
      });
      containerY.value = withSequence(
        withTiming(TIMER_MOTION.timerEnterBounceOvershootY, {
          duration: TIMER_MOTION.timerEnterRiseMs,
          easing: TIMER_ENTER_EASE,
        }),
        withTiming(0, {
          duration: TIMER_MOTION.timerEnterBounceSettleMs,
          easing: Easing.bezier(0.18, 0.9, 0.25, 1),
        }),
      );
      containerScale.value = withSequence(
        withTiming(1.004, {
          duration: TIMER_MOTION.timerEnterRiseMs,
          easing: TIMER_ENTER_EASE,
        }),
        withTiming(1, {
          duration: TIMER_MOTION.timerEnterBounceSettleMs,
          easing: Easing.bezier(0.18, 0.9, 0.25, 1),
        }),
      );
      containerOpacity.value = withTiming(1, {
        duration: TIMER_MOTION.timerEnterMs,
        easing: TIMER_ENTER_EASE,
      });
      valueProgress.value = withTiming(1, {
        duration: TIMER_MOTION.timerEnterMs - 30,
        easing: TIMER_ENTER_EASE,
      });
      controlsProgress.value = withDelay(
        TIMER_MOTION.timerControlStaggerMs,
        withTiming(1, {
          duration: TIMER_MOTION.timerEnterMs - 60,
          easing: TIMER_ENTER_EASE,
        }),
      );
      return;
    }

    controlsProgress.value = withTiming(0, {
      duration: Math.round(TIMER_MOTION.timerExitMs * 0.75),
      easing: TIMER_EXIT_EASE,
    });
    valueProgress.value = withTiming(0, {
      duration: Math.round(TIMER_MOTION.timerExitMs * 0.8),
      easing: TIMER_EXIT_EASE,
    });
    borderProgress.value = withDelay(
      24,
      withTiming(0, {
        duration: TIMER_MOTION.timerExitMs,
        easing: TIMER_EXIT_EASE,
      }),
    );
    containerY.value = withTiming(TIMER_MOTION.timerExitTranslateY, {
      duration: TIMER_MOTION.timerExitMs,
      easing: TIMER_EXIT_EASE,
    });
    containerScale.value = withTiming(TIMER_MOTION.timerExitScaleTo, {
      duration: TIMER_MOTION.timerExitMs,
      easing: TIMER_EXIT_EASE,
    });
    containerOpacity.value = withTiming(0, {
      duration: TIMER_MOTION.timerExitMs,
      easing: TIMER_EXIT_EASE,
    });
  }, [active, borderProgress, containerOpacity, containerScale, containerY, controlsProgress, valueProgress]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ translateY: containerY.value }, { scale: containerScale.value }],
  }));

  const valueStyle = useAnimatedStyle(() => ({
    opacity: valueProgress.value,
    transform: [{ translateY: interpolate(valueProgress.value, [0, 1], [3, 0]) }],
  }));

  const controlsStyle = useAnimatedStyle(() => ({
    opacity: controlsProgress.value,
    transform: [{ translateY: interpolate(controlsProgress.value, [0, 1], [4, 0]) }],
  }));

  const borderStyle = useAnimatedStyle(() => ({
    opacity: borderProgress.value,
  }));

  return (
    <View
      style={[
        styles.wrap,
        heightProp != null ? { height: heightProp } : { flex: 1 },
        { marginHorizontal: EXPLORE_V2.margin },
      ]}
    >
      <View
        style={[
          styles.inner,
          active && styles.innerActive,
        ]}
      >
        <Animated.View style={[styles.timerContent, containerStyle]} pointerEvents={active ? 'auto' : 'none'}>
          <>
            <View style={styles.timerRow} onLayout={e => setTimerRowWidth(e.nativeEvent.layout.width)}>
              <Animated.View style={controlsStyle}>
                <TouchableOpacity
                  onPress={onPauseToggle}
                  style={[styles.iconBtn, active && styles.iconBtnActive]}
                  activeOpacity={0.75}
                >
                  {paused ? (
                    <IconPlay size={22} color={active ? TIMER_CONTROL_ICON_ACTIVE : EXPLORE_V2_CHROME.timerIcon} />
                  ) : (
                    <IconPause size={22} color={active ? TIMER_CONTROL_ICON_ACTIVE : EXPLORE_V2_CHROME.timerIcon} />
                  )}
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={[styles.timerValueWrap, { marginHorizontal: 0 }, valueStyle]}>
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

              <Animated.View style={controlsStyle}>
                <TouchableOpacity onPress={onSkip} style={[styles.iconBtn, active && styles.iconBtnActive]} activeOpacity={0.75}>
                  <IconSkip size={22} color={active ? TIMER_CONTROL_ICON_ACTIVE : EXPLORE_V2_CHROME.timerIcon} />
                </TouchableOpacity>
              </Animated.View>
            </View>
            {/* Progress strip intentionally removed to avoid visible divider above deck cards. */}
          </>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
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
    borderColor: 'transparent',
  },
  innerActive: {
    borderColor: EXPLORE_V2_CHROME.timerActiveBorder,
  },
  timerContent: {
    flex: 1,
    width: '100%',
  },
  timerRow: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderCurve: 'continuous' as const,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TIMER_CONTROL_BG,
  },
  iconBtnActive: {
    backgroundColor: TIMER_CONTROL_BG_ACTIVE,
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
