import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolate,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, TYPOGRAPHY, CARDS } from '../../constants';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppTheme } from '../../theme/useAppTheme';
import { EXPLORE_V2_PALETTES, mixHex } from '../exploreV2/exploreV2ColorSystem';
import type { ScheduledWorkout, WorkoutTemplateExercise } from '../../types/training';
import type { Exercise } from '../../types';
import { WorkoutProgressPattern } from './WorkoutProgressPattern';

const FRONT_BOTTOM = 28;
/** Front card height (face) tuned to hug title + pie + summary with current spacing. */
const FRONT_H = 330;
const TITLE_TO_BUBBLE_GAP = 40;
const BUBBLE_TO_COUNT_GAP = 24;
const HERO_PATTERN_TARGET_HEIGHT = 180;
/** Peek cards use full face height so pie + summary stay visible; depth comes from inset + bottom offset. */
const MID_PEEK_BOTTOM = 14;
const BACK_PEEK_BOTTOM = 0;
const MID_PEEK_INSET_FRAC = 0.04;
const BACK_PEEK_INSET_FRAC = 0.07;
/** Deepest peek layer (fourth card), tucked further in until swipe advances the stack. */
const DEEP_PEEK_INSET_FRAC = 0.105;
const STACK_HEIGHT = FRONT_BOTTOM + FRONT_H;

const SWIPE_FRACTION = 0.22;
/** Spring when the front card is released without discarding — slight overshoot / bounce. */
const SPRING_RETURN_CFG = { damping: 14, stiffness: 260, mass: 0.85 };
/** Peek stack layout / colors stay fixed until drag exceeds this (px), then morph with swipe. */
const PEEK_MORPH_DRAG_START_PX = 40;
/** Front-card “Not today” / defer fill / content fade — starts early and finishes quickly (independent of peek morph). */
const DEFER_CHROME_START_PX = 6;
/** Defer chrome completes by this fraction of the swipe commit threshold (snappy vs peek). */
const DEFER_CHROME_END_FRAC_OF_THRESHOLD = 0.38;
/** `translateX` within ±this is treated as neutral for label alignment. */
const SWIPE_ALIGN_DEAD_PX = 3;
/** Max horizontal drag: stop when ~90% of the card is off-screen (10% still visible). */
const MAX_DRAG_WIDTH_FRACTION = 0.9;
/** Max Z-rotation (deg) at full horizontal drag; swipe left → negative tilt, swipe right → positive. */
const MAX_SWIPE_TILT_DEG = 2.75;

type Props = {
  queue: ScheduledWorkout[];
  exercises: Exercise[];
  getMainCompletion: (scheduledWorkoutId: string) => { percentage: number };
  isInPastCycle: boolean;
  onOpenWorkout: (sw: ScheduledWorkout) => void;
  onActiveWorkoutChange?: (sw: ScheduledWorkout | undefined) => void;
};

/** Unique `Exercise.category` values in workout order (body areas targeted in this codebase). */
function involvedCategoriesForWorkout(ordered: WorkoutTemplateExercise[], exercises: Exercise[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const snap of ordered) {
    const lib = exercises.find(e => e.id === snap.exerciseId);
    const cat = lib?.category?.trim();
    if (!cat || seen.has(cat)) continue;
    seen.add(cat);
    out.push(cat);
  }
  return out;
}

/** At most two muscle / category labels (workout order), joined like "Chest & Shoulders". */
function formatTopTwoMuscles(labels: string[]): string {
  const top = labels.slice(0, 2);
  if (top.length === 0) return '';
  if (top.length === 1) return top[0];
  return `${top[0]} & ${top[1]}`;
}

function WorkoutCardBody({
  sw,
  exercises,
  getMainCompletion,
  primaryTextStyle,
  involvedTextColor,
  debugRole,
  debugKey,
  visibleMode,
}: {
  sw: ScheduledWorkout;
  exercises: Exercise[];
  getMainCompletion: (id: string) => { percentage: number };
  primaryTextStyle?: any;
  involvedTextColor?: string;
  debugRole: 'front' | 'mid' | 'back' | 'deep';
  debugKey: string;
  visibleMode: string;
}) {
  const { colors: themeColors } = useAppTheme();
  void debugKey;
  void debugRole;
  void visibleMode;
  const mc = getMainCompletion(sw.id);
  const progress = mc.percentage / 100;
  const ordered = [...(sw.exercisesSnapshot ?? [])].sort((a, b) => a.order - b.order);
  const exerciseCount = ordered.length;
  const involvedLine = formatTopTwoMuscles(involvedCategoriesForWorkout(ordered, exercises));

  const involvedStyle = [styles.workoutInvolvedMuscles, { color: involvedTextColor ?? themeColors.accentSecondary }];
  return (
    <>
      <View style={styles.cardHeader}>
        <Animated.Text style={[styles.workoutName, primaryTextStyle]} numberOfLines={1} ellipsizeMode="tail">
          {sw.titleSnapshot}
        </Animated.Text>
      </View>
      <View style={styles.titleToBubbleGap} />
      <View style={styles.heroBubbleRow}>
        <WorkoutProgressPattern
          workoutId={sw.id}
          completionRatio={progress}
          style={styles.heroPattern}
        />
      </View>
      <View style={styles.bubbleToCountGap} />
      <Animated.Text style={[styles.workoutExerciseCount, primaryTextStyle]}>
        {exerciseCount === 1 ? '1 exercise' : `${exerciseCount} exercises`}
      </Animated.Text>
      {involvedLine ? (
        <Text style={involvedStyle} numberOfLines={2}>
          {involvedLine}
        </Text>
      ) : null}
    </>
  );
}

/**
 * `queue` is the ordered deck (planned workouts ahead). Index `i` is the front card; peek cards
 * show the next items with wrap-around when there are 3+ entries (2 entries → one peek only).
 * Swiping left or right advances `(i + 1) % n` so the deck loops until the queue is empty or
 * only one card remains.
 */
export function ScheduleWorkoutCardStack({
  queue,
  exercises,
  getMainCompletion,
  isInPastCycle,
  onOpenWorkout,
  onActiveWorkoutChange,
}: Props) {
  const { t } = useTranslation();
  const { explore, colors: themeColors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.max(0, windowWidth - SPACING.xxl * 2);
  const swipeThreshold = contentWidth * SWIPE_FRACTION;
  const deferChromeEndPx = Math.max(
    DEFER_CHROME_START_PX + 14,
    swipeThreshold * DEFER_CHROME_END_FRAC_OF_THRESHOLD,
  );

  const [activeCardId, setActiveCardId] = useState<string | null>(queue[0]?.id ?? null);
  const queueKey = useMemo(() => queue.map(sw => sw.id).join('|'), [queue]);

  const translateX = useSharedValue(0);

  const deepTuckBg = useMemo(
    () => mixHex(EXPLORE_V2_PALETTES.complete.main, '#FFFFFF', 0.14),
    [],
  );

  useEffect(() => {
    const ids = new Set(queue.map(sw => sw.id));
    const hasActive = activeCardId ? ids.has(activeCardId) : false;
    // Preserve current active card identity across queue updates when possible.
    // Falling back to the first card only when the active card disappeared keeps
    // shell/body ownership stable and avoids perceptible handoff jumps.
    const nextActiveId = hasActive ? activeCardId : (queue[0]?.id ?? null);
    setActiveCardId(nextActiveId);
    if (!nextActiveId) {
      translateX.value = 0;
    }
  }, [queueKey, queue, activeCardId, translateX]);

  const n = queue.length;
  const idxById = activeCardId ? queue.findIndex(sw => sw.id === activeCardId) : -1;
  const idx = n === 0 ? 0 : (idxById >= 0 ? idxById : 0);
  const activeWorkout = queue[idx];
  const nextWorkout = n > 1 ? queue[(idx + 1) % n] : undefined;
  const back = n > 2 ? queue[(idx + 2) % n] : undefined;
  const deep = n > 3 ? queue[(idx + 3) % n] : undefined;

  const canAdvance = n > 1;

  useEffect(() => {
    onActiveWorkoutChange?.(activeWorkout);
  }, [activeWorkout, onActiveWorkoutChange]);

  const commitSwipeAdvance = useCallback((committedId: string | null) => {
    // Two-layer handoff: commit the already revealed next card directly.
    translateX.value = 0;
    if (committedId) setActiveCardId(committedId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [translateX]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-18, 18])
        .failOffsetY([-12, 12])
        .onUpdate(e => {
          const max = contentWidth * MAX_DRAG_WIDTH_FRACTION;
          let x = e.translationX;
          if (!canAdvance) x = x * 0.25;
          translateX.value = Math.max(-max, Math.min(max, x));
        })
        .onEnd(e => {
          const absX = Math.abs(e.translationX);
          if (absX > swipeThreshold && canAdvance) {
            const nextId = nextWorkout?.id ?? null;
            const exitLeft = e.translationX < 0;
            translateX.value = withTiming(
              exitLeft ? -contentWidth : contentWidth,
              { duration: 220 },
              finished => {
                if (finished) runOnJS(commitSwipeAdvance)(nextId);
              },
            );
          } else {
            translateX.value = withSpring(0, SPRING_RETURN_CFG);
          }
        }),
    [canAdvance, contentWidth, swipeThreshold, translateX, commitSwipeAdvance, nextWorkout?.id],
  );

  const maxDragPx = contentWidth * MAX_DRAG_WIDTH_FRACTION;

  /** Horizontal slide only — defer label sits outside the tilt layer so it stays screen-level. */
  const frontShellTranslateStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const frontCardTiltStyle = useAnimatedStyle(() => {
    const x = translateX.value;
    const tiltDeg = interpolate(
      x,
      [-maxDragPx, 0, maxDragPx],
      [-MAX_SWIPE_TILT_DEG, 0, MAX_SWIPE_TILT_DEG],
      Extrapolate.CLAMP,
    );
    return {
      transform: [{ rotateZ: `${tiltDeg}deg` }],
    };
  }, [maxDragPx]);

  /** Distance along X at which peek layers reach their “committed swipe” layout (always > morph start). */
  const peekGrowEndPx = Math.max(
    PEEK_MORPH_DRAG_START_PX + 1,
    swipeThreshold,
    maxDragPx * 0.5,
  );

  const upNextMain = EXPLORE_V2_PALETTES.upNext.main;
  const upNextDark = EXPLORE_V2_PALETTES.upNext.dark;
  const completeMain = EXPLORE_V2_PALETTES.complete.main;
  const completeDark = EXPLORE_V2_PALETTES.complete.dark;
  const frontCardBg = explore.surfaceCurrentCard;
  /** Same surface as Explore Up Next swipe/remove strip CTA family (`appTheme.explore.skipRestCtaBg`). */
  const scheduleSwipeDeferBg = explore.skipRestCtaBg;
  const canvasLight = themeColors.canvasLight;
  const morphStart = PEEK_MORPH_DRAG_START_PX;
  const deferStart = DEFER_CHROME_START_PX;
  const deferEnd = deferChromeEndPx;

  const frontCardFillAnimatedStyle = useAnimatedStyle(() => {
    const ax = Math.abs(translateX.value);
    return {
      backgroundColor: interpolateColor(
        ax,
        [0, deferStart, deferEnd],
        [frontCardBg, frontCardBg, scheduleSwipeDeferBg],
        'RGB',
      ),
    };
  }, [deferEnd, deferStart, frontCardBg, scheduleSwipeDeferBg]);

  const frontContentFadeAnimatedStyle = useAnimatedStyle(() => {
    const ax = Math.abs(translateX.value);
    return {
      opacity: interpolate(ax, [0, deferStart, deferEnd], [1, 1, 0], Extrapolate.CLAMP),
    };
  }, [deferStart, deferEnd]);

  const backPrimaryTextStyle = useAnimatedStyle(() => {
    const ax = Math.abs(translateX.value);
    return {
      color: interpolateColor(ax, [0, morphStart, peekGrowEndPx], [completeDark, completeDark, upNextDark], 'RGB'),
    };
  }, [morphStart, peekGrowEndPx, completeDark, upNextDark]);

  const midPrimaryTextStyle = useAnimatedStyle(() => {
    const ax = Math.abs(translateX.value);
    return {
      color: interpolateColor(ax, [0, morphStart, peekGrowEndPx], [upNextDark, upNextDark, themeColors.textOnPrimary], 'RGB'),
    };
  }, [morphStart, peekGrowEndPx, upNextDark, themeColors.textOnPrimary]);

  const notTodayOverlayAnimatedStyle = useAnimatedStyle(() => {
    const x = translateX.value;
    const ax = Math.abs(x);
    const opacity = interpolate(ax, [0, deferStart, deferEnd], [0, 0, 1], Extrapolate.CLAMP);
    let alignItems: 'center' | 'flex-end' | 'flex-start' = 'center';
    if (x > SWIPE_ALIGN_DEAD_PX) alignItems = 'flex-start';
    else if (x < -SWIPE_ALIGN_DEAD_PX) alignItems = 'flex-end';
    return {
      opacity,
      justifyContent: 'center' as const,
      alignItems,
      paddingHorizontal: SPACING.lg,
    };
  }, [deferEnd, deferStart]);

  const notTodayTextAnimatedStyle = useAnimatedStyle(() => {
    const x = translateX.value;
    if (x > SWIPE_ALIGN_DEAD_PX) return { textAlign: 'left' as const };
    if (x < -SWIPE_ALIGN_DEAD_PX) return { textAlign: 'right' as const };
    return { textAlign: 'center' as const };
  }, []);

  const midPeekAnimatedStyle = useAnimatedStyle(() => {
    const ax = Math.abs(translateX.value);
    const bottom = interpolate(
      ax,
      [0, morphStart, peekGrowEndPx],
      [MID_PEEK_BOTTOM, MID_PEEK_BOTTOM, FRONT_BOTTOM],
      Extrapolate.CLAMP,
    );
    const inset = interpolate(
      ax,
      [0, morphStart, peekGrowEndPx],
      [MID_PEEK_INSET_FRAC * contentWidth, MID_PEEK_INSET_FRAC * contentWidth, 0],
      Extrapolate.CLAMP,
    );
    const backgroundColor = interpolateColor(
      ax,
      [0, morphStart, peekGrowEndPx],
      [upNextMain, upNextMain, frontCardBg],
      'RGB',
    );
    return {
      bottom,
      left: inset,
      right: inset,
      backgroundColor,
    };
  }, [contentWidth, peekGrowEndPx, morphStart, upNextMain, frontCardBg]);

  const nextPeekContentAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: Math.abs(translateX.value) >= peekGrowEndPx ? 1 : 0,
    };
  }, [peekGrowEndPx]);

  const backPeekAnimatedStyle = useAnimatedStyle(() => {
    const ax = Math.abs(translateX.value);
    const bottom = interpolate(
      ax,
      [0, morphStart, peekGrowEndPx],
      [BACK_PEEK_BOTTOM, BACK_PEEK_BOTTOM, MID_PEEK_BOTTOM],
      Extrapolate.CLAMP,
    );
    const inset = interpolate(
      ax,
      [0, morphStart, peekGrowEndPx],
      [
        BACK_PEEK_INSET_FRAC * contentWidth,
        BACK_PEEK_INSET_FRAC * contentWidth,
        MID_PEEK_INSET_FRAC * contentWidth,
      ],
      Extrapolate.CLAMP,
    );
    const backgroundColor = interpolateColor(
      ax,
      [0, morphStart, peekGrowEndPx],
      [completeMain, completeMain, upNextMain],
      'RGB',
    );
    return {
      bottom,
      left: inset,
      right: inset,
      backgroundColor,
    };
  }, [contentWidth, peekGrowEndPx, morphStart, completeMain, upNextMain]);

  const deepPeekAnimatedStyle = useAnimatedStyle(() => {
    const ax = Math.abs(translateX.value);
    const inset = interpolate(
      ax,
      [0, morphStart, peekGrowEndPx],
      [
        DEEP_PEEK_INSET_FRAC * contentWidth,
        DEEP_PEEK_INSET_FRAC * contentWidth,
        BACK_PEEK_INSET_FRAC * contentWidth,
      ],
      Extrapolate.CLAMP,
    );
    const backgroundColor = interpolateColor(
      ax,
      [0, morphStart, peekGrowEndPx],
      [deepTuckBg, deepTuckBg, completeMain],
      'RGB',
    );
    return {
      bottom: BACK_PEEK_BOTTOM,
      left: inset,
      right: inset,
      backgroundColor,
    };
  }, [contentWidth, peekGrowEndPx, morphStart, deepTuckBg, completeMain]);

  if (!activeWorkout) return null;

  const mainCompletion = getMainCompletion(activeWorkout.id);
  const completionPercentage = mainCompletion.percentage;

  const openFront = () => {
    if (isInPastCycle && completionPercentage < 100) return;
    onOpenWorkout(activeWorkout);
  };

  const handlePressCard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openFront();
  };

  return (
    <View style={[styles.stackRoot, { height: STACK_HEIGHT, width: '100%' }]}>
      {deep ? (
        <Animated.View
          key={`peek-deep-${deep.id}`}
          pointerEvents="none"
          style={[styles.peekDeckCard, deepPeekAnimatedStyle, { height: FRONT_H, zIndex: 2, borderColor: canvasLight }]}
        >
          <View style={[styles.workoutCardInner, styles.peekCardInner]}>
            <View style={[styles.workoutCardContent, styles.peekCardContentHidden]}>
              <WorkoutCardBody
                sw={deep}
                exercises={exercises}
                getMainCompletion={getMainCompletion}
                primaryTextStyle={{ color: completeDark }}
                debugRole="deep"
                debugKey={`peek-deep-${deep.id}`}
                visibleMode="hidden"
              />
            </View>
          </View>
        </Animated.View>
      ) : null}

      {back ? (
        <Animated.View
          key={`peek-back-${back.id}`}
          pointerEvents="none"
          style={[styles.peekDeckCard, backPeekAnimatedStyle, { height: FRONT_H, zIndex: 3, borderColor: canvasLight }]}
        >
          <View style={[styles.workoutCardInner, styles.peekCardInner]}>
            <View style={[styles.workoutCardContent, styles.peekCardContentHidden]}>
              <WorkoutCardBody
                sw={back}
                exercises={exercises}
                getMainCompletion={getMainCompletion}
                primaryTextStyle={backPrimaryTextStyle}
                debugRole="back"
                debugKey={`peek-back-${back.id}`}
                visibleMode="hidden"
              />
            </View>
          </View>
        </Animated.View>
      ) : null}

      {nextWorkout ? (
        <Animated.View
          key={`peek-mid-${nextWorkout.id}`}
          pointerEvents="none"
          style={[styles.peekDeckCard, midPeekAnimatedStyle, { height: FRONT_H, zIndex: 4, borderColor: canvasLight }]}
        >
          <View style={[styles.workoutCardInner, styles.peekCardInner]}>
            <Animated.View style={[styles.workoutCardContent, nextPeekContentAnimatedStyle]}>
              <WorkoutCardBody
                sw={nextWorkout}
                exercises={exercises}
                getMainCompletion={getMainCompletion}
                primaryTextStyle={midPrimaryTextStyle}
                debugRole="mid"
                debugKey={`peek-mid-${nextWorkout.id}`}
                visibleMode="animated-reveal"
              />
            </Animated.View>
          </View>
        </Animated.View>
      ) : null}

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.frontShell,
            {
              bottom: FRONT_BOTTOM,
              height: FRONT_H,
              zIndex: 5,
            },
            frontShellTranslateStyle,
          ]}
        >
          <View style={styles.frontShellInner}>
            <Animated.View style={[styles.frontTiltLayer, frontCardTiltStyle]}>
              <Animated.View
                style={[styles.workoutCard, frontCardFillAnimatedStyle, { borderColor: canvasLight }]}
                testID="workout-card"
              >
                <TouchableOpacity
                  style={styles.workoutCardInner}
                  onPress={handlePressCard}
                  activeOpacity={1}
                  disabled={isInPastCycle && completionPercentage < 100}
                >
                  <View style={styles.workoutCardContent}>
                    <Animated.View style={[styles.frontCardContentWrap, frontContentFadeAnimatedStyle]}>
                      <WorkoutCardBody
                        sw={activeWorkout}
                        exercises={exercises}
                        getMainCompletion={getMainCompletion}
                        primaryTextStyle={{ color: COLORS.textOnPrimary }}
                        debugRole="front"
                        debugKey={`front-${activeWorkout.id}`}
                        visibleMode="animated-front-fade"
                      />
                    </Animated.View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[styles.notTodayOverlay, notTodayOverlayAnimatedStyle]}
            >
              <Animated.Text style={[styles.notTodayText, notTodayTextAnimatedStyle]}>{t('notToday')}</Animated.Text>
            </Animated.View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  stackRoot: {
    position: 'relative',
    alignSelf: 'center',
  },
  peekDeckCard: {
    position: 'absolute',
    borderRadius: CARDS.cardDeep.outer.borderRadius,
    borderCurve: CARDS.cardDeep.outer.borderCurve,
    borderWidth: 2,
    overflow: 'hidden',
  },
  peekCardInner: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  frontShell: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  frontShellInner: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  frontTiltLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  workoutCard: {
    borderRadius: CARDS.cardDeep.outer.borderRadius,
    borderCurve: CARDS.cardDeep.outer.borderCurve,
    overflow: CARDS.cardDeep.outer.overflow,
    borderWidth: 2,
    width: '100%',
    flex: 1,
  },
  workoutCardInner: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 16,
    paddingHorizontal: 16,
    justifyContent: 'flex-start',
    borderRadius: CARDS.cardDeep.inner.borderRadius,
    borderCurve: CARDS.cardDeep.inner.borderCurve,
    backgroundColor: 'transparent',
  },
  workoutCardContent: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    flexDirection: 'column',
    position: 'relative',
  },
  peekCardContentHidden: {
    opacity: 0,
  },
  frontCardContentWrap: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  notTodayOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  notTodayText: {
    ...TYPOGRAPHY.displayLarge,
    fontWeight: '400',
    color: COLORS.textOnPrimary,
  },
  cardHeader: {
    flexShrink: 0,
  },
  workoutName: {
    ...TYPOGRAPHY.displayLarge,
    fontWeight: '400',
    color: COLORS.textOnPrimary,
    flexShrink: 1,
  },
  titleToBubbleGap: {
    height: TITLE_TO_BUBBLE_GAP,
    flexShrink: 0,
  },
  heroBubbleRow: {
    flexShrink: 0,
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  bubbleToCountGap: {
    height: BUBBLE_TO_COUNT_GAP,
    flexShrink: 0,
  },
  workoutExerciseCount: {
    ...TYPOGRAPHY.body,
    color: COLORS.textOnPrimary,
    fontWeight: '500',
  },
  workoutInvolvedMuscles: {
    ...TYPOGRAPHY.meta,
    marginTop: 4,
  },
  heroPattern: {
    minHeight: HERO_PATTERN_TARGET_HEIGHT,
  },
});
