import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CARDS, COLORS, SPACING, TYPOGRAPHY } from '../../constants';
import { useAppTheme } from '../../theme/useAppTheme';
import type { Exercise } from '../../types';
import type { ScheduledWorkout, WorkoutTemplateExercise } from '../../types/training';
import { WorkoutProgressPattern } from './WorkoutProgressPattern';

const FRONT_BOTTOM = 28;
const FRONT_H = 330;
const STACK_HEIGHT = FRONT_BOTTOM + FRONT_H;
const LEFT_SLIVER = 28;
const RIGHT_PEEK_1 = 12;
const RIGHT_PEEK_2 = 24;
const PREVIOUS_SCALE = 0.975;
const NEXT_SCALE = 0.985;
const NEXT2_SCALE = 0.97;
const NEXT_OPACITY = 0.94;
const NEXT2_OPACITY = 0.88;
const TAP_SLOP = 8;
const DRAG_ACTIVATION_X = 12;
const SWIPE_THRESHOLD_FRAC = 0.24;
const SWIPE_VELOCITY_THRESHOLD = 720;
const SPRING_RETURN = { damping: 17, stiffness: 265, mass: 0.92 };
const DEBUG = true;

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

export function ScheduleWorkoutDeckV2({
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
  const cardWidth = Math.max(0, contentWidth - LEFT_SLIVER - RIGHT_PEEK_2);
  const commitThreshold = cardWidth * SWIPE_THRESHOLD_FRAC;

  const [activeIndex, setActiveIndex] = useState(0);
  const queueKey = useMemo(() => queue.map(sw => sw.id).join('|'), [queue]);
  const activeRef = useRef<any>(null);
  const commitStartedAtRef = useRef<number | null>(null);

  const dragX = useSharedValue(0);
  const isDragging = useSharedValue(0);

  useEffect(() => {
    if (queue.length === 0) return;
    setActiveIndex(prev => Math.min(prev, queue.length - 1));
  }, [queueKey, queue.length]);

  const previousWorkout = activeIndex > 0 ? queue[activeIndex - 1] : undefined;
  const previousBackWorkout = activeIndex > 1 ? queue[activeIndex - 2] : undefined;
  const activeWorkout = queue[activeIndex];
  const nextWorkout = activeIndex + 1 < queue.length ? queue[activeIndex + 1] : undefined;
  const next2Workout = activeIndex + 2 < queue.length ? queue[activeIndex + 2] : undefined;

  useEffect(() => {
    onActiveWorkoutChange?.(activeWorkout);
  }, [activeWorkout, onActiveWorkoutChange]);

  useEffect(() => {
    if (!DEBUG) return;
    console.log('[DeckV2] rendered', {
      activeIndex,
      cards: {
        previousBack: previousBackWorkout?.id ?? null,
        previous: previousWorkout?.id ?? null,
        active: activeWorkout?.id ?? null,
        next: nextWorkout?.id ?? null,
        next2: next2Workout?.id ?? null,
      },
      x: { previous: -LEFT_SLIVER, active: 0, next: RIGHT_PEEK_1, next2: RIGHT_PEEK_2 },
      z: { previousBack: 1, previous: 2, next2: 2, next: 3, active: 5 },
      overflow: { stackRoot: 'visible' },
    });
  }, [activeIndex, previousBackWorkout?.id, previousWorkout?.id, activeWorkout?.id, nextWorkout?.id, next2Workout?.id]);

  const finalizeCommit = useCallback((direction: 1 | -1) => {
    setActiveIndex(prev => {
      const next = Math.max(0, Math.min(queue.length - 1, prev + direction));
      if (DEBUG) {
        console.log('[DeckV2] activeIndex changed', {
          from: prev,
          to: next,
          commitStartedAt: commitStartedAtRef.current,
          changedAt: Date.now(),
        });
      }
      return next;
    });
    dragX.value = 0;
    commitStartedAtRef.current = null;
  }, [queue.length, dragX]);

  const canGoLeft = !!nextWorkout;
  const canGoRight = !!previousWorkout;

  const logDragActivated = useCallback(() => {
    if (DEBUG) console.log('[DeckV2] drag activated');
  }, []);
  const logSwipeCancelled = useCallback(() => {
    if (DEBUG) console.log('[DeckV2] swipe cancelled');
  }, []);
  const logTapRecognized = useCallback(() => {
    if (DEBUG) console.log('[DeckV2] tap recognized');
  }, []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-DRAG_ACTIVATION_X, DRAG_ACTIVATION_X])
        .failOffsetY([-12, 12])
        .onBegin(() => {
          isDragging.value = 0;
        })
        .onUpdate(e => {
          let x = e.translationX;
          if (x < 0 && !canGoLeft) x *= 0.28;
          if (x > 0 && !canGoRight) x *= 0.28;
          if (!isDragging.value && Math.abs(x) >= DRAG_ACTIVATION_X) {
            isDragging.value = 1;
            runOnJS(logDragActivated)();
          }
          dragX.value = x;
        })
        .onEnd(e => {
          const commitLeft = (e.translationX <= -commitThreshold || e.velocityX <= -SWIPE_VELOCITY_THRESHOLD) && canGoLeft;
          const commitRight = (e.translationX >= commitThreshold || e.velocityX >= SWIPE_VELOCITY_THRESHOLD) && canGoRight;
          if (commitLeft) {
            commitStartedAtRef.current = Date.now();
            dragX.value = withTiming(-cardWidth * 1.06, { duration: 180 }, done => {
              if (done) runOnJS(finalizeCommit)(1);
            });
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
            return;
          }
          if (commitRight) {
            commitStartedAtRef.current = Date.now();
            dragX.value = withTiming(cardWidth * 1.06, { duration: 180 }, done => {
              if (done) runOnJS(finalizeCommit)(-1);
            });
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
            return;
          }
          dragX.value = withSpring(0, SPRING_RETURN);
          runOnJS(logSwipeCancelled)();
        }),
    [canGoLeft, canGoRight, cardWidth, commitThreshold, dragX, finalizeCommit, isDragging, logDragActivated, logSwipeCancelled],
  );

  const handleOpen = useCallback(() => {
    if (!activeWorkout) return;
    const completion = getMainCompletion(activeWorkout.id).percentage;
    if (isInPastCycle && completion < 100) return;
    const node = activeRef.current;
    if (!node?.measureInWindow) {
      onOpenWorkout(activeWorkout);
      return;
    }
    node.measureInWindow((x: number, y: number, width: number, height: number) => {
      onOpenWorkout(
        activeWorkout,
        width > 0 && height > 0
          ? { x, y, width, height, borderRadius: CARDS.cardDeep.outer.borderRadius }
          : undefined,
      );
    });
  }, [activeWorkout, getMainCompletion, isInPastCycle, onOpenWorkout]);

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(TAP_SLOP)
        .onEnd((_e, success) => {
          if (!success) return;
          if (isDragging.value) return;
          runOnJS(logTapRecognized)();
          runOnJS(handleOpen)();
        }),
    [handleOpen, isDragging, logTapRecognized],
  );

  const gesture = useMemo(() => Gesture.Exclusive(pan, tap), [pan, tap]);

  const leftProgress = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, -dragX.value / commitThreshold));
    return {
      left: LEFT_SLIVER + interpolate(p, [0, 1], [RIGHT_PEEK_1, 0], 'clamp'),
      right: RIGHT_PEEK_2 - interpolate(p, [0, 1], [RIGHT_PEEK_1, 0], 'clamp'),
      opacity: nextWorkout ? interpolate(p, [0, 1], [NEXT_OPACITY, 1], 'clamp') : 0,
      transform: [{ scale: interpolate(p, [0, 1], [NEXT_SCALE, 1], 'clamp') }],
    };
  });

  const leftProgressNext2 = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, -dragX.value / commitThreshold));
    return {
      left: LEFT_SLIVER + interpolate(p, [0, 1], [RIGHT_PEEK_2, RIGHT_PEEK_1], 'clamp'),
      right: RIGHT_PEEK_2 - interpolate(p, [0, 1], [RIGHT_PEEK_2, RIGHT_PEEK_1], 'clamp'),
      opacity: next2Workout ? interpolate(p, [0, 1], [NEXT2_OPACITY, NEXT_OPACITY], 'clamp') : 0,
      transform: [{ scale: interpolate(p, [0, 1], [NEXT2_SCALE, NEXT_SCALE], 'clamp') }],
    };
  });

  const rightProgress = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, dragX.value / commitThreshold));
    return {
      left: LEFT_SLIVER - interpolate(p, [0, 1], [LEFT_SLIVER, 0], 'clamp'),
      right: RIGHT_PEEK_2 + interpolate(p, [0, 1], [LEFT_SLIVER, 0], 'clamp'),
      opacity: previousWorkout ? interpolate(p, [0, 1], [0.34, 0.96], 'clamp') : 0,
      transform: [{ scale: interpolate(p, [0, 1], [PREVIOUS_SCALE, 1], 'clamp') }],
    };
  });

  const activeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dragX.value }] }));

  if (!activeWorkout) return null;

  return (
    <View style={[styles.stackRoot, { height: STACK_HEIGHT }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.peekDeckCard,
          {
            left: LEFT_SLIVER - LEFT_SLIVER - 12,
            right: RIGHT_PEEK_2 + LEFT_SLIVER + 12,
            top: 0,
            height: FRONT_H,
            zIndex: 1,
            opacity: previousBackWorkout ? 0.12 : 0,
            borderColor: themeColors.canvasLight,
            backgroundColor: explore.surfacePreviousCard,
          },
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.peekDeckCard,
          { top: 0, height: FRONT_H, zIndex: 2, borderColor: themeColors.canvasLight, backgroundColor: explore.surfacePreviousCard },
          rightProgress,
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.peekDeckCard,
          { top: 0, height: FRONT_H, zIndex: 2, borderColor: themeColors.canvasLight, backgroundColor: explore.surfaceUpcomingCardMuted },
          leftProgressNext2,
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.peekDeckCard,
          { top: 0, height: FRONT_H, zIndex: 3, borderColor: themeColors.canvasLight, backgroundColor: explore.surfaceUpcomingCard },
          leftProgress,
        ]}
      />

      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            styles.frontShell,
            { height: FRONT_H, bottom: FRONT_BOTTOM, left: LEFT_SLIVER, right: RIGHT_PEEK_2, zIndex: 5 },
            activeStyle,
          ]}
        >
          <Animated.View ref={activeRef} style={[styles.workoutCard, { borderColor: themeColors.canvasLight, backgroundColor: explore.surfaceCurrentCard }]}>
            <View style={styles.workoutCardInner}>
              <WorkoutCardBody
                sw={activeWorkout}
                exercises={exercises}
                getMainCompletion={getMainCompletion}
                primaryTextStyle={{ color: COLORS.textOnPrimary }}
              />
            </View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  stackRoot: {
    position: 'relative',
    width: '100%',
    overflow: 'visible',
  },
  frontShell: {
    position: 'absolute',
  },
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
