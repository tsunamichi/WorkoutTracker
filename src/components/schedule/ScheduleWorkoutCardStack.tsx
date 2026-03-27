import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
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
import { EXPLORE_V2_PALETTES, mixHex } from '../exploreV2/exploreV2ColorSystem';
import type { ScheduledWorkout, WorkoutTemplateExercise } from '../../types/training';
import type { Exercise } from '../../types';

const FRONT_BOTTOM = 28;
/** Front card height (face); content sized to fit title + 32 + 200 pie + 32 + summary + inner padding (10 top / 16 bottom). */
const FRONT_H = 370;
const TITLE_TO_BUBBLE_GAP = 32;
const BUBBLE_TO_COUNT_GAP = 32;
const HERO_BUBBLE_SIZE = 200;
/** Peek cards use full face height so pie + summary stay visible; depth comes from inset + bottom offset. */
const MID_PEEK_BOTTOM = 14;
const BACK_PEEK_BOTTOM = 0;
const MID_PEEK_INSET_FRAC = 0.04;
const BACK_PEEK_INSET_FRAC = 0.07;
/** Deepest peek layer (fourth card), tucked further in until swipe advances the stack. */
const DEEP_PEEK_INSET_FRAC = 0.105;
const STACK_HEIGHT = FRONT_BOTTOM + FRONT_H;

const SWIPE_FRACTION = 0.22;
const SPRING_CFG = { damping: 28, stiffness: 280 };
/** Max Z-rotation (deg) at full horizontal drag; swipe left → negative tilt, swipe right → positive. */
const MAX_SWIPE_TILT_DEG = 2.75;

const HERO_PIE_OUTLINE = 2.5;

/** SVG path for a circular sector from 12 o'clock, clockwise (progress 0–1). */
function heroPieSectorPath(cx: number, cy: number, r: number, progress: number): string {
  const p = Math.min(1, Math.max(0, progress));
  if (p <= 0 || p >= 1) return '';
  const start = -Math.PI / 2;
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const end = start + p * 2 * Math.PI;
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const largeArc = p > 0.5 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

/** Pie-style progress: gold segment + bronze remainder, black rim and radial dividers (no label). */
function HeroProgressPie({ progress }: { progress: number }) {
  const p = Math.min(1, Math.max(0, progress));
  const size = HERO_BUBBLE_SIZE;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - HERO_PIE_OUTLINE / 2;
  const rim = COLORS.inkCharcoal;
  const remainder = COLORS.accentPrimaryDimmed;
  const done = COLORS.accentPrimary;
  const sector = heroPieSectorPath(cx, cy, r, p);

  const endAngle = -Math.PI / 2 + p * 2 * Math.PI;
  const rx = cx + r * Math.cos(endAngle);
  const ry = cy + r * Math.sin(endAngle);
  const sx = cx;
  const sy = cy - r;

  return (
    <View style={styles.heroBubbleWrap}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {p < 1 ? <Circle cx={cx} cy={cy} r={r} fill={remainder} /> : null}
        {p > 0 && p < 1 ? <Path d={sector} fill={done} /> : null}
        {p >= 1 ? <Circle cx={cx} cy={cy} r={r} fill={done} /> : null}
        {p > 0 && p < 1 ? (
          <>
            <Line x1={cx} y1={cy} x2={sx} y2={sy} stroke={rim} strokeWidth={HERO_PIE_OUTLINE} />
            <Line x1={cx} y1={cy} x2={rx} y2={ry} stroke={rim} strokeWidth={HERO_PIE_OUTLINE} />
          </>
        ) : null}
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke={rim} strokeWidth={HERO_PIE_OUTLINE} />
      </Svg>
    </View>
  );
}

type Props = {
  queue: ScheduledWorkout[];
  exercises: Exercise[];
  getMainCompletion: (scheduledWorkoutId: string) => { percentage: number };
  isInPastCycle: boolean;
  onOpenWorkout: (sw: ScheduledWorkout) => void;
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

function DeckCardFace({
  sw,
  exercises,
  getMainCompletion,
  variant,
  peekTextColor,
  peekMutedColor,
}: {
  sw: ScheduledWorkout;
  exercises: Exercise[];
  getMainCompletion: (id: string) => { percentage: number };
  variant: 'front' | 'peek';
  peekTextColor?: string;
  peekMutedColor?: string;
}) {
  const mc = getMainCompletion(sw.id);
  const progress = mc.percentage / 100;
  const ordered = [...(sw.exercisesSnapshot ?? [])].sort((a, b) => a.order - b.order);
  const exerciseCount = ordered.length;
  const involvedLine = formatTopTwoMuscles(involvedCategoriesForWorkout(ordered, exercises));

  const titleStyle =
    variant === 'front' ? styles.workoutName : [styles.workoutName, { color: peekTextColor! }];
  const countStyle =
    variant === 'front'
      ? styles.workoutExerciseCount
      : [styles.workoutExerciseCount, { color: peekTextColor! }];
  const muscleStyle =
    variant === 'front'
      ? styles.workoutInvolvedMuscles
      : [styles.workoutInvolvedMuscles, { color: peekMutedColor! }];

  return (
    <>
      <View style={styles.cardHeader}>
        <Text style={titleStyle} numberOfLines={1} ellipsizeMode="tail">
          {sw.titleSnapshot}
        </Text>
      </View>
      <View style={styles.titleToBubbleGap} />
      <View style={styles.heroBubbleRow}>
        <HeroProgressPie progress={progress} />
      </View>
      <View style={styles.bubbleToCountGap} />
      <Text style={countStyle}>
        {exerciseCount === 1 ? '1 exercise' : `${exerciseCount} exercises`}
      </Text>
      {involvedLine ? (
        <Text style={muscleStyle} numberOfLines={2}>
          {involvedLine}
        </Text>
      ) : null}
    </>
  );
}

/** Peek layer with text colors that follow swipe progress (background interpolates on the shell). */
function DeckCardFacePeekAnimated({
  sw,
  exercises,
  getMainCompletion,
  translateX,
  growEndPx,
  primaryFrom,
  primaryTo,
  mutedFrom,
  mutedTo,
}: {
  sw: ScheduledWorkout;
  exercises: Exercise[];
  getMainCompletion: (id: string) => { percentage: number };
  translateX: SharedValue<number>;
  growEndPx: number;
  primaryFrom: string;
  primaryTo: string;
  mutedFrom: string;
  mutedTo: string;
}) {
  const mc = getMainCompletion(sw.id);
  const progress = mc.percentage / 100;
  const ordered = [...(sw.exercisesSnapshot ?? [])].sort((a, b) => a.order - b.order);
  const exerciseCount = ordered.length;
  const involvedLine = formatTopTwoMuscles(involvedCategoriesForWorkout(ordered, exercises));

  const primaryTextStyle = useAnimatedStyle(() => {
    const ax = Math.abs(translateX.value);
    return {
      color: interpolateColor(ax, [0, growEndPx], [primaryFrom, primaryTo], 'RGB'),
    };
  });

  const mutedTextStyle = useAnimatedStyle(() => {
    const ax = Math.abs(translateX.value);
    return {
      color: interpolateColor(ax, [0, growEndPx], [mutedFrom, mutedTo], 'RGB'),
    };
  });

  return (
    <>
      <View style={styles.cardHeader}>
        <Animated.Text style={[styles.workoutName, primaryTextStyle]} numberOfLines={1} ellipsizeMode="tail">
          {sw.titleSnapshot}
        </Animated.Text>
      </View>
      <View style={styles.titleToBubbleGap} />
      <View style={styles.heroBubbleRow}>
        <HeroProgressPie progress={progress} />
      </View>
      <View style={styles.bubbleToCountGap} />
      <Animated.Text style={[styles.workoutExerciseCount, primaryTextStyle]}>
        {exerciseCount === 1 ? '1 exercise' : `${exerciseCount} exercises`}
      </Animated.Text>
      {involvedLine ? (
        <Animated.Text style={[styles.workoutInvolvedMuscles, mutedTextStyle]} numberOfLines={2}>
          {involvedLine}
        </Animated.Text>
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
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.max(0, windowWidth - SPACING.xxl * 2);
  const swipeThreshold = contentWidth * SWIPE_FRACTION;

  const [activeIndex, setActiveIndex] = React.useState(0);
  const queueKey = useMemo(() => queue.map(sw => sw.id).join('|'), [queue]);
  const pendingTranslateResetRef = useRef(false);

  const translateX = useSharedValue(0);

  const deepTuckBg = useMemo(
    () => mixHex(EXPLORE_V2_PALETTES.complete.main, '#FFFFFF', 0.14),
    [],
  );
  /** Muted line on front (charcoal) — target for muscle text as next card becomes front. */
  const metaOnCharcoal = useMemo(() => mixHex(COLORS.canvasLight, COLORS.inkCharcoal, 0.38), []);

  useEffect(() => {
    setActiveIndex(0);
    translateX.value = 0;
  }, [queueKey, translateX]);

  const n = queue.length;
  const idx = n === 0 ? 0 : Math.min(activeIndex, n - 1);
  const activeWorkout = queue[idx];
  const mid = n > 1 ? queue[(idx + 1) % n] : undefined;
  const back = n > 2 ? queue[(idx + 2) % n] : undefined;
  const deep = n > 3 ? queue[(idx + 3) % n] : undefined;

  const canAdvance = n > 1;

  const advanceDeck = useCallback(() => {
    setActiveIndex(i => {
      const len = queue.length;
      if (len <= 1) return 0;
      return (i + 1) % len;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [queue.length]);

  const commitSwipeAdvance = useCallback(() => {
    pendingTranslateResetRef.current = true;
    advanceDeck();
  }, [advanceDeck]);

  useLayoutEffect(() => {
    if (pendingTranslateResetRef.current) {
      pendingTranslateResetRef.current = false;
      translateX.value = 0;
    }
  }, [activeIndex, translateX]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-18, 18])
        .failOffsetY([-12, 12])
        .onUpdate(e => {
          const max = contentWidth * 0.35;
          let x = e.translationX;
          if (!canAdvance) x = x * 0.25;
          translateX.value = Math.max(-max, Math.min(max, x));
        })
        .onEnd(e => {
          const absX = Math.abs(e.translationX);
          if (absX > swipeThreshold && canAdvance) {
            const exitLeft = e.translationX < 0;
            translateX.value = withTiming(
              exitLeft ? -contentWidth : contentWidth,
              { duration: 220 },
              finished => {
                if (finished) runOnJS(commitSwipeAdvance)();
              },
            );
          } else {
            translateX.value = withSpring(0, SPRING_CFG);
          }
        }),
    [canAdvance, contentWidth, swipeThreshold, translateX, commitSwipeAdvance],
  );

  const maxDragPx = contentWidth * 0.35;

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const x = translateX.value;
    const tiltDeg = interpolate(
      x,
      [-maxDragPx, 0, maxDragPx],
      [-MAX_SWIPE_TILT_DEG, 0, MAX_SWIPE_TILT_DEG],
      Extrapolate.CLAMP,
    );
    return {
      transform: [{ translateX: x }, { rotateZ: `${tiltDeg}deg` }],
    };
  }, [maxDragPx]);

  /** Distance along X at which peek layers reach their “committed swipe” layout. */
  const peekGrowEndPx = Math.max(swipeThreshold, maxDragPx * 0.5);

  const upNextMain = EXPLORE_V2_PALETTES.upNext.main;
  const upNextDark = EXPLORE_V2_PALETTES.upNext.dark;
  const upNextMuted = EXPLORE_V2_PALETTES.upNext.muted;
  const completeMain = EXPLORE_V2_PALETTES.complete.main;
  const completeDark = EXPLORE_V2_PALETTES.complete.dark;
  const completeMuted = EXPLORE_V2_PALETTES.complete.muted;
  const frontCardBg = COLORS.inkCharcoal;
  const canvasLight = COLORS.canvasLight;

  const midPeekAnimatedStyle = useAnimatedStyle(() => {
    const ax = Math.abs(translateX.value);
    const bottom = interpolate(ax, [0, peekGrowEndPx], [MID_PEEK_BOTTOM, FRONT_BOTTOM], Extrapolate.CLAMP);
    const inset = interpolate(ax, [0, peekGrowEndPx], [MID_PEEK_INSET_FRAC * contentWidth, 0], Extrapolate.CLAMP);
    const backgroundColor = interpolateColor(ax, [0, peekGrowEndPx], [upNextMain, frontCardBg], 'RGB');
    return {
      bottom,
      left: inset,
      right: inset,
      backgroundColor,
    };
  }, [contentWidth, peekGrowEndPx, upNextMain, frontCardBg]);

  const backPeekAnimatedStyle = useAnimatedStyle(() => {
    const ax = Math.abs(translateX.value);
    const bottom = interpolate(ax, [0, peekGrowEndPx], [BACK_PEEK_BOTTOM, MID_PEEK_BOTTOM], Extrapolate.CLAMP);
    const inset = interpolate(
      ax,
      [0, peekGrowEndPx],
      [BACK_PEEK_INSET_FRAC * contentWidth, MID_PEEK_INSET_FRAC * contentWidth],
      Extrapolate.CLAMP,
    );
    const backgroundColor = interpolateColor(ax, [0, peekGrowEndPx], [completeMain, upNextMain], 'RGB');
    return {
      bottom,
      left: inset,
      right: inset,
      backgroundColor,
    };
  }, [contentWidth, peekGrowEndPx, completeMain, upNextMain]);

  const deepPeekAnimatedStyle = useAnimatedStyle(() => {
    const ax = Math.abs(translateX.value);
    const inset = interpolate(
      ax,
      [0, peekGrowEndPx],
      [DEEP_PEEK_INSET_FRAC * contentWidth, BACK_PEEK_INSET_FRAC * contentWidth],
      Extrapolate.CLAMP,
    );
    const backgroundColor = interpolateColor(ax, [0, peekGrowEndPx], [deepTuckBg, completeMain], 'RGB');
    return {
      bottom: BACK_PEEK_BOTTOM,
      left: inset,
      right: inset,
      backgroundColor,
    };
  }, [contentWidth, peekGrowEndPx, deepTuckBg, completeMain]);

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
          style={[styles.peekDeckCard, deepPeekAnimatedStyle, { height: FRONT_H, zIndex: 2 }]}
        >
          <View style={[styles.workoutCardInner, styles.peekCardInner]}>
            <View style={styles.workoutCardContent}>
              <DeckCardFace
                sw={deep}
                exercises={exercises}
                getMainCompletion={getMainCompletion}
                variant="peek"
                peekTextColor={completeDark}
                peekMutedColor={completeMuted}
              />
            </View>
          </View>
        </Animated.View>
      ) : null}

      {back ? (
        <Animated.View
          key={`peek-back-${back.id}`}
          pointerEvents="none"
          style={[styles.peekDeckCard, backPeekAnimatedStyle, { height: FRONT_H, zIndex: 3 }]}
        >
          <View style={[styles.workoutCardInner, styles.peekCardInner]}>
            <View style={styles.workoutCardContent}>
              <DeckCardFacePeekAnimated
                sw={back}
                exercises={exercises}
                getMainCompletion={getMainCompletion}
                translateX={translateX}
                growEndPx={peekGrowEndPx}
                primaryFrom={completeDark}
                primaryTo={upNextDark}
                mutedFrom={completeMuted}
                mutedTo={upNextMuted}
              />
            </View>
          </View>
        </Animated.View>
      ) : null}

      {mid ? (
        <Animated.View
          key={`peek-mid-${mid.id}`}
          pointerEvents="none"
          style={[styles.peekDeckCard, midPeekAnimatedStyle, { height: FRONT_H, zIndex: 4 }]}
        >
          <View style={[styles.workoutCardInner, styles.peekCardInner]}>
            <View style={styles.workoutCardContent}>
              <DeckCardFacePeekAnimated
                sw={mid}
                exercises={exercises}
                getMainCompletion={getMainCompletion}
                translateX={translateX}
                growEndPx={peekGrowEndPx}
                primaryFrom={upNextDark}
                primaryTo={canvasLight}
                mutedFrom={upNextMuted}
                mutedTo={metaOnCharcoal}
              />
            </View>
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
            frontAnimatedStyle,
          ]}
        >
          <View style={styles.workoutCard} testID="workout-card">
            <TouchableOpacity
              style={styles.workoutCardInner}
              onPress={handlePressCard}
              activeOpacity={1}
              disabled={isInPastCycle && completionPercentage < 100}
            >
              <View style={styles.workoutCardContent}>
                <DeckCardFace
                  sw={activeWorkout}
                  exercises={exercises}
                  getMainCompletion={getMainCompletion}
                  variant="front"
                />
              </View>
            </TouchableOpacity>
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
    borderColor: COLORS.canvasLight,
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
  workoutCard: {
    backgroundColor: COLORS.inkCharcoal,
    borderRadius: CARDS.cardDeep.outer.borderRadius,
    borderCurve: CARDS.cardDeep.outer.borderCurve,
    overflow: CARDS.cardDeep.outer.overflow,
    borderWidth: 2,
    borderColor: COLORS.canvasLight,
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
  },
  cardHeader: {
    flexShrink: 0,
  },
  workoutName: {
    ...TYPOGRAPHY.displayLarge,
    fontWeight: '400',
    color: COLORS.canvasLight,
    flexShrink: 1,
  },
  titleToBubbleGap: {
    height: TITLE_TO_BUBBLE_GAP,
    flexShrink: 0,
  },
  heroBubbleRow: {
    flexShrink: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleToCountGap: {
    height: BUBBLE_TO_COUNT_GAP,
    flexShrink: 0,
  },
  workoutExerciseCount: {
    ...TYPOGRAPHY.body,
    color: COLORS.canvasLight,
    fontWeight: '500',
  },
  workoutInvolvedMuscles: {
    ...TYPOGRAPHY.meta,
    color: COLORS.canvasLight,
    opacity: 0.85,
    marginTop: 4,
  },
  heroBubbleWrap: {
    width: HERO_BUBBLE_SIZE,
    height: HERO_BUBBLE_SIZE,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
