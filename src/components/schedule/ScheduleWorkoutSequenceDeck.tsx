import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CARDS, COLORS, SPACING, TYPOGRAPHY } from '../../constants';
import { useAppTheme } from '../../theme/useAppTheme';
import type { Exercise } from '../../types';
import type { ScheduledWorkout, WorkoutTemplateExercise } from '../../types/training';
import { WorkoutProgressPattern } from './WorkoutProgressPattern';

const FRONT_BOTTOM = 28;
const FRONT_H = 330;
const STACK_HEIGHT = FRONT_BOTTOM + FRONT_H;
const SWIPE_FRACTION = 0.22;
const MAX_DRAG_WIDTH_FRACTION = 0.9;
const COMMIT_VELOCITY = 680;
const SPRING_RETURN_CFG = { damping: 16, stiffness: 260, mass: 0.9 };
const LEFT_PREVIOUS_PEEK = 28;
const RIGHT_PEEK_1 = 12;
const RIGHT_PEEK_2 = 24;
const STACK_SCALE_SECOND = 0.99;
const STACK_SCALE_THIRD = 0.98;
const STACK_OPACITY_SECOND = 1;
const STACK_OPACITY_THIRD = 0.95;
const PREVIOUS_SCALE = 0.975;
const TAP_SLOP = 8;
const DRAG_ACTIVATION_X = 12;
const DEBUG_DECK_GESTURE = true;
const LEFT_PEEK = 28;

type TransitionOrigin = {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
};

type Props = {
  queue: ScheduledWorkout[];
  exercises: Exercise[];
  getMainCompletion: (scheduledWorkoutId: string) => { percentage: number };
  isInPastCycle: boolean;
  onOpenWorkout: (sw: ScheduledWorkout, origin?: TransitionOrigin) => void;
  onActiveWorkoutChange?: (sw: ScheduledWorkout | undefined) => void;
};

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
}: {
  sw: ScheduledWorkout;
  exercises: Exercise[];
  getMainCompletion: (id: string) => { percentage: number };
  primaryTextStyle?: any;
  involvedTextColor?: string;
}) {
  const { colors: themeColors } = useAppTheme();
  const mc = getMainCompletion(sw.id);
  const progress = mc.percentage / 100;
  const ordered = [...(sw.exercisesSnapshot ?? [])].sort((a, b) => a.order - b.order);
  const exerciseCount = ordered.length;
  const involvedLine = formatTopTwoMuscles(involvedCategoriesForWorkout(ordered, exercises));
  return (
    <>
      <Text style={[styles.workoutName, primaryTextStyle]} numberOfLines={1}>{sw.titleSnapshot}</Text>
      <View style={styles.titleToBubbleGap} />
      <WorkoutProgressPattern workoutId={sw.id} completionRatio={progress} style={styles.heroPattern} />
      <View style={styles.bubbleToCountGap} />
      <Text style={[styles.workoutExerciseCount, primaryTextStyle]}>
        {exerciseCount === 1 ? '1 exercise' : `${exerciseCount} exercises`}
      </Text>
      {involvedLine ? <Text style={[styles.workoutInvolvedMuscles, { color: involvedTextColor ?? themeColors.accentSecondary }]}>{involvedLine}</Text> : null}
    </>
  );
}

export function ScheduleWorkoutSequenceDeck({
  queue,
  exercises,
  getMainCompletion,
  isInPastCycle,
  onOpenWorkout,
  onActiveWorkoutChange,
}: Props) {
  const { explore, colors: themeColors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.max(0, windowWidth - SPACING.xxl * 2);
  const cardWidth = Math.max(0, contentWidth - LEFT_PREVIOUS_PEEK - RIGHT_PEEK_2);
  const swipeThreshold = cardWidth * SWIPE_FRACTION;
  const [activeIndex, setActiveIndex] = useState(0);
  const cardRef = useRef<any>(null);
  const translateX = useSharedValue(0);
  const dragActivated = useSharedValue(0);
  const queueKey = useMemo(() => queue.map(sw => sw.id).join('|'), [queue]);
  const pendingCommitStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (queue.length === 0) return;
    setActiveIndex(prev => Math.min(prev, queue.length - 1));
  }, [queueKey, queue.length]);

  const current = queue[activeIndex];
  const previous = queue.slice(0, activeIndex);
  const upcoming = queue.slice(activeIndex + 1);
  const previousTop = previous[previous.length - 1];
  const previousBack = previous[previous.length - 2];
  const upcomingTop = upcoming[0];
  const upcomingBack = upcoming[1];
  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < queue.length - 1;

  useEffect(() => {
    if (!DEBUG_DECK_GESTURE) return;
    console.log('[ScheduleDeck] rendered cards', {
      activeIndex,
      ids: {
        previousTop: previousTop?.id ?? null,
        previousBack: previousBack?.id ?? null,
        current: current?.id ?? null,
        next: upcomingTop?.id ?? null,
        third: upcomingBack?.id ?? null,
      },
      xPositions: {
        previous: -LEFT_PEEK,
        active: 0,
        next: RIGHT_PEEK_1,
        third: RIGHT_PEEK_2,
      },
      zOrder: {
        active: 5,
        next: 3,
        third: 2,
        previous: 2,
        previousBack: 1,
      },
      clipping: {
        stackRootOverflow: 'visible',
      },
      queueSize: queue.length,
    });
  }, [activeIndex, current?.id, previousTop?.id, previousBack?.id, upcomingTop?.id, upcomingBack?.id, queue.length]);

  const logDragActivated = useCallback((translationX: number) => {
    if (DEBUG_DECK_GESTURE) console.log('[ScheduleDeck] drag activated', { translationX });
  }, []);
  const logSwipeCancelled = useCallback(() => {
    if (DEBUG_DECK_GESTURE) console.log('[ScheduleDeck] swipe cancelled / snapped back');
  }, []);
  const logTapRecognized = useCallback(() => {
    if (DEBUG_DECK_GESTURE) console.log('[ScheduleDeck] tap recognized');
  }, []);

  useEffect(() => {
    onActiveWorkoutChange?.(current);
  }, [current, onActiveWorkoutChange]);

  const commitNext = useCallback(() => {
    setActiveIndex(prev => Math.min(prev + 1, queue.length - 1));
    translateX.value = 0;
    if (DEBUG_DECK_GESTURE) {
      console.log('[ScheduleDeck] swipe committed', {
        direction: 'next',
        activeIndexChangedAt: Date.now(),
        commitStartedAt: pendingCommitStartedAtRef.current,
      });
    }
    pendingCommitStartedAtRef.current = null;
  }, [queue.length, translateX]);

  const commitPrev = useCallback(() => {
    setActiveIndex(prev => Math.max(prev - 1, 0));
    translateX.value = 0;
    if (DEBUG_DECK_GESTURE) {
      console.log('[ScheduleDeck] swipe committed', {
        direction: 'previous',
        activeIndexChangedAt: Date.now(),
        commitStartedAt: pendingCommitStartedAtRef.current,
      });
    }
    pendingCommitStartedAtRef.current = null;
  }, [translateX]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-DRAG_ACTIVATION_X, DRAG_ACTIVATION_X])
        .failOffsetY([-12, 12])
        .onBegin(() => {
          dragActivated.value = 0;
        })
        .onUpdate(e => {
          const max = cardWidth * MAX_DRAG_WIDTH_FRACTION;
          let x = e.translationX;
          if (!dragActivated.value && Math.abs(x) >= DRAG_ACTIVATION_X) {
            dragActivated.value = 1;
            runOnJS(logDragActivated)(x);
          }
          if (x < 0 && !canGoNext) x *= 0.3;
          if (x > 0 && !canGoPrev) x *= 0.3;
          translateX.value = Math.max(-max, Math.min(max, x));
        })
        .onEnd(e => {
          const leftCommit = (e.translationX < -swipeThreshold || e.velocityX < -COMMIT_VELOCITY) && canGoNext;
          const rightCommit = (e.translationX > swipeThreshold || e.velocityX > COMMIT_VELOCITY) && canGoPrev;
          if (leftCommit) {
            pendingCommitStartedAtRef.current = Date.now();
            translateX.value = withTiming(-cardWidth, { duration: 170 }, done => {
              if (done) runOnJS(commitNext)();
            });
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
            dragActivated.value = 0;
            return;
          }
          if (rightCommit) {
            pendingCommitStartedAtRef.current = Date.now();
            translateX.value = withTiming(cardWidth, { duration: 170 }, done => {
              if (done) runOnJS(commitPrev)();
            });
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
            dragActivated.value = 0;
            return;
          }
          translateX.value = withSpring(0, SPRING_RETURN_CFG);
          runOnJS(logSwipeCancelled)();
          dragActivated.value = 0;
        }),
    [canGoNext, canGoPrev, commitNext, commitPrev, cardWidth, swipeThreshold, translateX, dragActivated, logDragActivated, logSwipeCancelled],
  );

  const frontStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const revealNext = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, -translateX.value) / swipeThreshold);
    return {
      left: LEFT_PREVIOUS_PEEK + interpolate(p, [0, 1], [RIGHT_PEEK_1, 0], 'clamp'),
      right: RIGHT_PEEK_2 - interpolate(p, [0, 1], [RIGHT_PEEK_1, 0], 'clamp'),
      opacity: upcomingTop ? interpolate(p, [0, 1], [STACK_OPACITY_SECOND, 1], 'clamp') : 0,
      transform: [{ scale: interpolate(p, [0, 1], [STACK_SCALE_SECOND, 1], 'clamp') }],
    };
  });
  const revealThird = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, -translateX.value) / swipeThreshold);
    return {
      left: LEFT_PREVIOUS_PEEK + interpolate(p, [0, 1], [RIGHT_PEEK_2, RIGHT_PEEK_1], 'clamp'),
      right: RIGHT_PEEK_2 - interpolate(p, [0, 1], [RIGHT_PEEK_2, RIGHT_PEEK_1], 'clamp'),
      opacity: upcomingBack ? interpolate(p, [0, 1], [STACK_OPACITY_THIRD, STACK_OPACITY_SECOND], 'clamp') : 0,
      transform: [{ scale: interpolate(p, [0, 1], [STACK_SCALE_THIRD, STACK_SCALE_SECOND], 'clamp') }],
    };
  });
  const revealPrevious = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, translateX.value) / swipeThreshold);
    return {
      left: LEFT_PREVIOUS_PEEK - interpolate(p, [0, 1], [LEFT_PEEK, 0], 'clamp'),
      right: RIGHT_PEEK_2 + interpolate(p, [0, 1], [LEFT_PEEK, 0], 'clamp'),
      opacity: previousTop ? interpolate(p, [0, 1], [0.34, 0.94], 'clamp') : 0,
      transform: [{ scale: interpolate(p, [0, 1], [PREVIOUS_SCALE, 1], 'clamp') }],
    };
  });
  const previousBackStaticStyle = {
    left: LEFT_PREVIOUS_PEEK - LEFT_PEEK - 12,
    right: RIGHT_PEEK_2 + LEFT_PEEK + 12,
    top: 0 as const,
    opacity: previousBack ? 0.14 : 0,
  };

  if (!current) return null;

  const mainCompletion = getMainCompletion(current.id);
  const completionPercentage = mainCompletion.percentage;

  const handleOpen = () => {
    if (isInPastCycle && completionPercentage < 100) return;
    const node = cardRef.current;
    if (!node?.measureInWindow) {
      onOpenWorkout(current);
      return;
    }
    node.measureInWindow((x: number, y: number, width: number, height: number) => {
      onOpenWorkout(current, width > 0 && height > 0 ? {
        x,
        y,
        width,
        height,
        borderRadius: CARDS.cardDeep.outer.borderRadius,
      } : undefined);
    });
  };

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(TAP_SLOP)
        .onEnd((_event, success) => {
          if (!success) return;
          if (dragActivated.value) return;
          runOnJS(logTapRecognized)();
          runOnJS(handleOpen)();
        }),
    [dragActivated, handleOpen, logTapRecognized],
  );

  const cardGesture = useMemo(
    () => Gesture.Exclusive(panGesture, tapGesture),
    [panGesture, tapGesture],
  );

  return (
    <View style={[styles.stackRoot, { height: STACK_HEIGHT }]}>
      <Animated.View pointerEvents="none" style={[styles.peekDeckCard, { height: FRONT_H, zIndex: 1, borderColor: themeColors.canvasLight, backgroundColor: explore.surfacePreviousCard }, previousBackStaticStyle]} />
      <Animated.View pointerEvents="none" style={[styles.peekDeckCard, { height: FRONT_H, zIndex: 2, borderColor: themeColors.canvasLight, backgroundColor: explore.surfacePreviousCard, top: 0 }, revealPrevious]} />
      <Animated.View pointerEvents="none" style={[styles.peekDeckCard, { height: FRONT_H, zIndex: 2, borderColor: themeColors.canvasLight, backgroundColor: explore.surfaceUpcomingCardMuted, top: 0 }, revealThird]} />
      <Animated.View pointerEvents="none" style={[styles.peekDeckCard, { height: FRONT_H, zIndex: 3, borderColor: themeColors.canvasLight, backgroundColor: explore.surfaceUpcomingCard, top: 0 }, revealNext]} />

      <GestureDetector gesture={cardGesture}>
        <Animated.View
          style={[
            styles.frontShell,
            { height: FRONT_H, bottom: FRONT_BOTTOM, left: LEFT_PREVIOUS_PEEK, right: RIGHT_PEEK_2, zIndex: 5 },
            frontStyle,
          ]}
        >
          <Animated.View ref={cardRef} style={[styles.workoutCard, { borderColor: themeColors.canvasLight, backgroundColor: explore.surfaceCurrentCard }]}>
            <View style={styles.workoutCardInner}>
              <WorkoutCardBody sw={current} exercises={exercises} getMainCompletion={getMainCompletion} primaryTextStyle={{ color: COLORS.textOnPrimary }} />
            </View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  stackRoot: { position: 'relative', width: '100%', overflow: 'visible' },
  frontShell: { position: 'absolute', left: 0, right: 0, zIndex: 4 },
  peekDeckCard: {
    position: 'absolute',
    borderRadius: CARDS.cardDeep.outer.borderRadius,
    borderCurve: CARDS.cardDeep.outer.borderCurve,
    borderWidth: 2,
    overflow: 'hidden',
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
  workoutName: { ...TYPOGRAPHY.displayLarge, fontWeight: '400', color: COLORS.textOnPrimary },
  titleToBubbleGap: { height: 40 },
  bubbleToCountGap: { height: 24 },
  workoutExerciseCount: { ...TYPOGRAPHY.body, color: COLORS.textOnPrimary, fontWeight: '500' },
  workoutInvolvedMuscles: { ...TYPOGRAPHY.meta, marginTop: 4 },
  heroPattern: { minHeight: 180 },
});
