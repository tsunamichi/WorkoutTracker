import React, { createContext, useCallback, useContext, useMemo } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/** Shared timeline 0→1 for Home → Exercise handoff (~500–600ms). */
export const SCHEDULE_DECK_TRANSITION_MS = 560;

/** Matches Schedule home outgoing scale end (`TodayScreen`); incoming execution scales from the inverse to 1. */
export const SCHEDULE_DECK_HOME_SCALE_MAX = 1.25;
export const SCHEDULE_DECK_EXECUTION_INCOMING_SCALE_START = 1 / SCHEDULE_DECK_HOME_SCALE_MAX;

/**
 * Single easing for both directions. Intro is exit reversed in time: `withTiming(1)` from 0 vs `withTiming(0)` from 1.
 */
const SCHEDULE_DECK_EASING = Easing.bezier(0.33, 0, 0.2, 1);

/** Exact `withTiming` config for both directions — same duration, same ease (and no extra delay). */
export const SCHEDULE_DECK_WITH_TIMING_CONFIG = {
  duration: SCHEDULE_DECK_TRANSITION_MS,
  easing: SCHEDULE_DECK_EASING,
} as const;

/**
 * Normalized progress keys (0–1 over `SCHEDULE_DECK_TRANSITION_MS`).
 * Execution ramps in slightly before home opacity hits 0 (`inStart` < `homeOpacityEnd`) so there is no frame
 * where both layers interpolate to 0 at the same p (boundary flash / dead zone on reverse).
 */
export const SCHEDULE_DECK_T = {
  /** Home opacity 1→0 completes by this progress. */
  homeOpacityEnd: 0.46,
  /** Home scale 1→1.25 completes (may trail opacity slightly). */
  homeScaleEnd: 0.52,
  /**
   * Execution opacity / scale begin here — slightly before `homeOpacityEnd` for a short crossfade (no simultaneous 0).
   */
  inStart: 0.45,
  /** Execution opacity 0→1 completes here. */
  inOpacityEnd: 1,
  inEnd: 1,
} as const;

type ScheduleDeckTransitionContextValue = {
  progress: Animated.SharedValue<number>;
  startTransition: () => void;
  /** Exercise → Home: animates `progress` 1 → 0 (inverse of forward). Same duration as `startTransition`. */
  startReverseTransition: (onComplete?: (finished: boolean) => void) => void;
  reset: () => void;
};

const ScheduleDeckTransitionContext = createContext<ScheduleDeckTransitionContextValue | null>(null);

export function ScheduleDeckTransitionProvider({ children }: { children: React.ReactNode }) {
  const progress = useSharedValue(0);

  const startTransition = useCallback(() => {
    cancelAnimation(progress);
    progress.value = 0;
    progress.value = withTiming(1, SCHEDULE_DECK_WITH_TIMING_CONFIG);
  }, [progress]);

  const startReverseTransition = useCallback(
    (onComplete?: (finished: boolean) => void) => {
      cancelAnimation(progress);
      progress.value = 1;
      progress.value = withTiming(0, SCHEDULE_DECK_WITH_TIMING_CONFIG, finished => {
        if (onComplete) {
          runOnJS(onComplete)(finished);
        }
      });
    },
    [progress],
  );

  const reset = useCallback(() => {
    cancelAnimation(progress);
    progress.value = 0;
  }, [progress]);

  const value = useMemo(
    () => ({
      progress,
      startTransition,
      startReverseTransition,
      reset,
    }),
    [progress, startTransition, startReverseTransition, reset],
  );

  return (
    <ScheduleDeckTransitionContext.Provider value={value}>{children}</ScheduleDeckTransitionContext.Provider>
  );
}

export function useScheduleDeckTransition(): ScheduleDeckTransitionContextValue {
  const ctx = useContext(ScheduleDeckTransitionContext);
  if (!ctx) {
    throw new Error('useScheduleDeckTransition must be used within ScheduleDeckTransitionProvider');
  }
  return ctx;
}
