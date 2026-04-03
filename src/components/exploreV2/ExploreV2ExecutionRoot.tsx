/**
 * Explore v2 — bottom-pinned wallet stack (isolated).
 * Card order (back → front): Complete, Up Next, Current.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, useWindowDimensions, Platform, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  interpolateColor,
  interpolate,
  type SharedValue,
  useSharedValue,
  useDerivedValue,
  useAnimatedReaction,
  withTiming,
  withSequence,
  runOnJS,
  runOnUI,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../../theme/useAppTheme';
import { EXPLORE_V2 } from './exploreV2Tokens';
import { TYPOGRAPHY } from '../../constants';
import type { ExploreV2Group } from './exploreV2Types';
import type { PrimaryRevealedCard } from './exploreV2Types';
import { ExploreV2CompleteCard } from './ExploreV2CompleteCard';
import { ExploreV2UpNextCard } from './ExploreV2UpNextCard';
import { ExploreV2CurrentCard } from './ExploreV2CurrentCard';
import type { ExerciseDrawerHistoryEntry } from './ExploreV2CurrentOverflowSheet';
import { getExploreV2RadiusTokens } from './exploreV2Geometry';

const EXIT_EASE = Easing.bezier(...EXPLORE_V2.motion.easing.smoothExit);
const ENTER_EASE = Easing.bezier(...EXPLORE_V2.motion.easing.smoothEnter);
const EXIT_ANTICIPATION_EASE = Easing.out(Easing.cubic);
const PEEK = EXPLORE_V2.peekHeaderHeight;
const STACK_BOTTOM_GAP = 0;
const STACK_SIDE_GAP = 8;
const STACK_DEVICE_BOTTOM_GAP = 2;
const CURRENT_IN_PROGRESS_PEEK_VISIBLE_HEIGHT = 136;
/** Keep peeking strips consistent across states (no extra lift bias). */
const COMPLETE_PRIMARY_UPNEXT_LIFT = 0;
const REST_STACK_FRAC = EXPLORE_V2.layout.restStackHeightFraction;
const EXIT_ANTICIPATION_PX = EXPLORE_V2.motion.anticipation.subtleOffset;
const EXIT_ANTICIPATION_MS = EXPLORE_V2.motion.anticipation.subtleDuration;
const MOTION_EXIT_MS = EXPLORE_V2.motion.duration.exit;
const MOTION_ENTER_MS = EXPLORE_V2.motion.duration.cardEnter;
const CURRENT_OPEN_MS = EXPLORE_V2.motion.duration.standard;
const CURRENT_CLOSE_MS = EXPLORE_V2.motion.duration.quick;
const UP_NEXT_HIDE_MS = EXPLORE_V2.motion.duration.quick;
const UP_NEXT_SHOW_MS = EXPLORE_V2.motion.duration.standard;
const CELEBRATION_ENTER_MS = EXPLORE_V2.motion.duration.page;
const CELEBRATION_EXIT_MS = EXPLORE_V2.motion.duration.quick;
const EXPLORE_V2_DEBUG_LAYOUT = false;
// Temporary debug mode for clipping/geometry inspection.
// Set to false to disable all debug overlays.
const EXPLORE_V2_DEBUG_CLIP = false;
const EXPLORE_V2_DEBUG_SHELL_BORDER = false;
/** Lightweight fallback before wallet band reports measured height. */
const FALLBACK_WALLET_HEIGHT = 420;
/** Border overlay above card layers (zCurrent ≤ 50) so rounded cards don’t paint over the stroke */
const WALLET_BORDER_OVERLAY_Z = 2000;

function groupHasAnyLoggedSet(group: ExploreV2Group, completedSets: Set<string>): boolean {
  for (let r = 0; r < group.totalRounds; r++) {
    for (const ex of group.exercises) {
      if (completedSets.has(`${ex.id}-set-${r}`)) return true;
    }
  }
  return false;
}

export type ExploreV2ExecutionRootProps = {
  exerciseGroups: ExploreV2Group[];
  exploreCurrentGroupIndex: number | null;
  upNextExercises: number[];
  completedExerciseIndexes: number[];
  currentRounds: Record<string, number>;
  completedSets: Set<string>;
  setExpandedGroupIndex: (i: number) => void;
  activeExerciseIndex: number;
  setActiveExerciseIndex: (i: number) => void;
  getSetDisplayValues: (exerciseId: string, round: number, w: number, r: number) => { weight: number; reps: number };
  localValues: Record<string, { weight: number; reps: number }>;
  setLocalValues: React.Dispatch<React.SetStateAction<Record<string, { weight: number; reps: number }>>>;
  useKg: boolean;
  weightUnit: string;
  getBarbellMode: (id: string) => boolean;
  setBarbellMode: (id: string, v: boolean) => void;
  timeBasedOverrides: Record<string, boolean>;
  setTimeBasedOverrides: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  perSideOverrides: Record<string, boolean>;
  setPerSideOverrides: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  handleStart: (payload?: { setId: string; values: { weight: number; reps: number } }) => Promise<void>;
  showPrimaryCta: boolean;
  onSkipRest: () => void;
  exploreV2TimerPhase: 'none' | 'work' | 'switchSides' | 'rest';
  exploreV2WorkBlueProgress: SharedValue<number>;
  allComplete: boolean;
  type: 'warmup' | 'main' | 'core';
  progressionGroups: Array<{ id: string; name: string; exerciseIds: string[] }>;
  updateProgressionGroup: (id: string, patch: { exerciseIds: string[] }) => Promise<void>;
  /** Template item id of the exercise being swapped (drives per-exercise log checks on the screen). */
  onSwapExercise: (templateExerciseId: string) => void;
  onRemoveExercise: (exercise: ExploreV2Group['exercises'][0]) => Promise<void>;
  /** Measured height of explore v2 content root — same SharedValue as ExerciseExecutionScreen `exploreV2RootHeight`. */
  exploreLayoutRootHeight: SharedValue<number>;
  /** Current group has at least one logged set — cannot replace Current from Up Next. */
  currentGroupHasLoggedSets: boolean;
  onOpenAddExercise: () => void;
  onRemoveGroupFromUpNext: (groupIndex: number) => void | Promise<void>;
  /** Template supports add (main workouts). */
  allowAddExercise: boolean;
  /** Timer-rest visual theme is active. */
  timerThemeActive: boolean;
  /** 0 = idle chrome, 1 = rest — drives smooth color transitions (synced with screen rest timer) */
  restThemeProgress: SharedValue<number>;
  /** Same source as legacy exercise drawer history (template + library id). */
  getExerciseHistoryForDrawer: (
    templateItemId: string,
    libraryExerciseId?: string,
  ) => ExerciseDrawerHistoryEntry[];
  /** Bumps history when sessions / progress refresh (same role as detail sheet `refreshKey`). */
  exerciseHistoryRefreshKey: number;
  /** Per template exercise id — suggested load deltas for progression ↑ on hero metrics */
  progressionValuesByItemId: Record<
    string,
    { weight: number; reps: number; weightDelta: number; repsDelta: number }
  >;
  /** Final-set celebration animation (Great Job) */
  celebrateCompletion?: boolean;
  completedOnDateLabel?: string;
};

function ExploreV2ExecutionRootComponent(props: ExploreV2ExecutionRootProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {
    exerciseGroups,
    exploreCurrentGroupIndex,
    upNextExercises,
    completedExerciseIndexes,
    currentRounds,
    completedSets,
    setExpandedGroupIndex,
    activeExerciseIndex,
    setActiveExerciseIndex,
    getSetDisplayValues,
    localValues,
    setLocalValues,
    useKg,
    weightUnit,
    getBarbellMode,
    setBarbellMode,
    timeBasedOverrides,
    setTimeBasedOverrides,
    perSideOverrides,
    setPerSideOverrides,
    handleStart,
    showPrimaryCta,
    onSkipRest,
    exploreV2TimerPhase,
    exploreV2WorkBlueProgress,
    allComplete,
    type,
    progressionGroups,
    updateProgressionGroup,
    onSwapExercise,
    onRemoveExercise,
    exploreLayoutRootHeight,
    currentGroupHasLoggedSets,
    onOpenAddExercise,
    onRemoveGroupFromUpNext,
    allowAddExercise,
    timerThemeActive,
    restThemeProgress,
    getExerciseHistoryForDrawer,
    exerciseHistoryRefreshKey,
    progressionValuesByItemId,
    celebrateCompletion = false,
    completedOnDateLabel,
  } = props;
  const { explore: exRoot, colors: themeColorsRoot } = useAppTheme();
  const warmActivityRoot = exRoot.warmActivity;
  const backgroundTimerRoot = themeColorsRoot.backgroundTimer;
  const radius = useMemo(
    () => getExploreV2RadiusTokens(screenWidth, insets.bottom),
    [screenWidth, insets.bottom],
  );
  /** Rounded top (card tokens) + device bottom — clips content without a top padding gap */
  const walletShellRadii = useMemo(
    () => ({
      borderTopLeftRadius: EXPLORE_V2.cardTopRadius,
      borderTopRightRadius: EXPLORE_V2.cardTopRadius,
      borderBottomLeftRadius: radius.frontBottomRadius,
      borderBottomRightRadius: radius.frontBottomRadius,
    }),
    [radius.frontBottomRadius],
  );

  const [primaryRevealed, setPrimaryRevealed] = useState<PrimaryRevealedCard>('up_next');
  const [overflowOpen, setOverflowOpen] = useState(false);

  useEffect(() => {
    if (primaryRevealed !== 'current') {
      setOverflowOpen(false);
    }
  }, [primaryRevealed]);

  const [stackShellHeight, setStackShellHeight] = useState(0);
  /** After last set logged: keep Current mounted until slide-down exit finishes */
  const exitCompleteRef = useRef(true);
  const lastCurrentGroupRef = useRef<ExploreV2Group | null>(null);
  const exitAnimStartedRef = useRef(false);
  const [exitTick, setExitTick] = useState(0);
  const hasCompletePresent = completedExerciseIndexes.length > 0;
  const currentGroupIndex = exploreCurrentGroupIndex;
  const hasCurrent = currentGroupIndex !== null;
  const currentGroup = currentGroupIndex !== null ? exerciseGroups[currentGroupIndex] : null;

  /** Mirrors for worklets — synced in useLayoutEffect before paint */
  const hasCurrentSV = useSharedValue(false);
  const primaryRevealedSV = useSharedValue<'up_next' | 'current' | 'complete'>('up_next');
  const hasCompletePresentSV = useSharedValue(false);
  const currentGroupHasLoggedSetsSV = useSharedValue(false);
  /** Mirrors exitCompleteRef for UI-thread slide logic (avoids runOnUI + module worklets). */
  const exitCompleteSV = useSharedValue(1);
  /** Window height fallback for layout when root measure is still 0 */
  const screenHeightSV = useSharedValue(screenHeight);
  /** Actual measured wallet container height (JS onLayout -> UI thread shared value). */
  const stackShellHeightSV = useSharedValue(0);
  /** Bumps when layout-affecting props change — drives useAnimatedReaction instead of runOnUI from JS effects */
  const walletSlideApplyToken = useSharedValue(0);
  /** Frozen Current layer height while exit animation runs (hasCurrent became false) */
  const currentExitLayerHeightSV = useSharedValue(0);

  const structuralWalletH = useDerivedValue(() => {
    const measured = stackShellHeightSV.value;
    if (measured > 0) {
      // Keep stack geometry locked to the allocated wallet container height.
      // This prevents content-state changes (e.g. opening Current) from resizing the wallet.
      return Math.max(PEEK, measured);
    }
    const Hroot =
      exploreLayoutRootHeight.value > 0 ? exploreLayoutRootHeight.value : screenHeight * 0.55;
    const desired = Math.max(
      PEEK,
      interpolate(restThemeProgress.value, [0, 1], [Hroot, Hroot * REST_STACK_FRAC]),
    );
    const available = stackShellHeightSV.value > 0 ? stackShellHeightSV.value : desired;
    // Never let a layer budget exceed the wallet container's measured height.
    return Math.max(PEEK, Math.min(desired, available));
  }, [screenHeight]);

  /** UI-thread exit sequence — useCallback worklet so runOnUI receives a real worklet (Babel). */
  const runExitSlideSequence = useCallback(
    (slideY: SharedValue<number>, targetSlideY: number, onFinished: () => void) => {
      'worklet';
      const start = slideY.value;
      const pullBack = start - EXIT_ANTICIPATION_PX;
      slideY.value = withSequence(
        withTiming(pullBack, {
          duration: EXIT_ANTICIPATION_MS,
          easing: EXIT_ANTICIPATION_EASE,
        }),
        withTiming(
          targetSlideY,
          {
            duration: MOTION_EXIT_MS,
            easing: EXIT_EASE,
          },
          finished => {
            if (finished) runOnJS(onFinished)();
          },
        ),
      );
    },
    [],
  );

  /** Slides the card in from below the stack when Current appears or the group changes. */
  const currentSlideY = useSharedValue<number>(FALLBACK_WALLET_HEIGHT);
  /** Brief vertical nudge when Up Next selection is blocked (active current with logged sets). */
  const currentBlockNudgeY = useSharedValue(0);
  /** Slides Up Next down to a visible header tab when Completed is primary. */
  const upNextSlideY = useSharedValue<number>(0);
  const completionCelebrateProgress = useSharedValue(0);

  useEffect(() => {
    completionCelebrateProgress.value = withTiming(celebrateCompletion ? 1 : 0, {
      duration: celebrateCompletion ? CELEBRATION_ENTER_MS : CELEBRATION_EXIT_MS,
      easing: Easing.bezier(...EXPLORE_V2.motion.easing.smoothEnter),
    });
    if (celebrateCompletion) setPrimaryRevealed('current');
  }, [celebrateCompletion, completionCelebrateProgress]);

  if (hasCurrent && currentGroup) {
    lastCurrentGroupRef.current = currentGroup;
    exitCompleteRef.current = false;
  }

  useLayoutEffect(() => {
    screenHeightSV.value = screenHeight;
    hasCurrentSV.value = hasCurrent;
    primaryRevealedSV.value = primaryRevealed;
    hasCompletePresentSV.value = hasCompletePresent;
    currentGroupHasLoggedSetsSV.value = currentGroupHasLoggedSets;
    exitCompleteSV.value = exitCompleteRef.current ? 1 : 0;
    walletSlideApplyToken.value = walletSlideApplyToken.value + 1;
  }, [
    hasCurrent,
    currentGroupIndex,
    primaryRevealed,
    hasCompletePresent,
    currentGroupHasLoggedSets,
    exitTick,
    screenHeight,
  ]);

  const isExitAnimating = useMemo(
    () => !hasCurrent && !exitCompleteRef.current && lastCurrentGroupRef.current !== null,
    [hasCurrent, exitTick],
  );

  const shouldShowCurrentLayer = useMemo(
    () =>
      Boolean(
        (hasCurrent && currentGroup) ||
          (!hasCurrent && !exitCompleteRef.current && lastCurrentGroupRef.current),
      ),
    [hasCurrent, currentGroup, exitTick],
  );

  const displayCurrentGroup = hasCurrent && currentGroup ? currentGroup : lastCurrentGroupRef.current;

  const currentHasNoLogsInGroup = useMemo(() => {
    if (!displayCurrentGroup) return false;
    return !groupHasAnyLoggedSet(displayCurrentGroup, completedSets);
  }, [displayCurrentGroup, completedSets]);

  const visibleCurrentHasLoggedSets = useMemo(() => {
    if (!displayCurrentGroup) return false;
    return groupHasAnyLoggedSet(displayCurrentGroup, completedSets);
  }, [displayCurrentGroup, completedSets]);

  const preStart = Boolean(displayCurrentGroup) && currentHasNoLogsInGroup;
  const currentIsCollapsedSecondary =
    shouldShowCurrentLayer && visibleCurrentHasLoggedSets && primaryRevealed !== 'current';

  useEffect(() => {
    if (!hasCurrent) {
      if (!isExitAnimating) {
        setPrimaryRevealed('up_next');
      }
      return;
    }
    // Fresh workout (no logs yet): stay on Up Next until the user opens a group from the queue.
    // `onSelectUpNext` sets primary to Current; resuming with progress auto-opens Current below.
    if (completedSets.size > 0) {
      setPrimaryRevealed('current');
    }
  }, [hasCurrent, isExitAnimating, completedSets.size]);

  useEffect(() => {
    if (!EXPLORE_V2_DEBUG_LAYOUT || !__DEV__) return;
    const activeCardType: PrimaryRevealedCard = hasCurrent ? primaryRevealed : 'up_next';
    console.log('[ExploreV2LayoutDebug]', {
      shellHeight: stackShellHeight,
      activeCardType,
      inactiveVisibleCount: 'n/a-structural-model',
      peekHeight: PEEK,
      activeCardTranslateY: activeCardType === 'current' ? currentSlideY.value : upNextSlideY.value,
    });
  }, [stackShellHeight, hasCurrent, primaryRevealed, currentSlideY, upNextSlideY]);

  // Keep Up Next above Completed so its exit slide-to-tab remains visible.
  const zComplete = 30;
  const zUpNext = 40;
  // Keep Current above stack while present so slide-out is visible and in-progress peek is tappable.
  const zCurrent = shouldShowCurrentLayer ? 50 : 0;

  const onCurrentExitFinished = useCallback(() => {
    exitAnimStartedRef.current = false;
    exitCompleteRef.current = true;
    lastCurrentGroupRef.current = null;
    const h = currentExitLayerHeightSV.value;
    currentSlideY.value = h;
    setExitTick(t => t + 1);
  }, [currentSlideY, currentExitLayerHeightSV]);

  /** After last set: slide Current fully down off-screen before unmounting (UI runtime only). */
  useLayoutEffect(() => {
    if (hasCurrent) {
      exitAnimStartedRef.current = false;
      return;
    }
    if (!lastCurrentGroupRef.current || exitCompleteRef.current || exitAnimStartedRef.current) {
      return;
    }
    exitAnimStartedRef.current = true;
    const h = currentExitLayerHeightSV.value;
    runOnUI(runExitSlideSequence)(currentSlideY, h, onCurrentExitFinished);
  }, [hasCurrent, onCurrentExitFinished, currentSlideY, currentExitLayerHeightSV, runExitSlideSequence]);

  /** Bottom-pinned Current + Up Next slides — runs on UI thread via useAnimatedReaction (no runOnUI(moduleWorklet)). */
  useAnimatedReaction(
    () => walletSlideApplyToken.value,
    (_token, _prev) => {
      const lerpWallet = (p: number, a: number, b: number) => a + (b - a) * p;
      const p = restThemeProgress.value;
      const measured = stackShellHeightSV.value;
      const sw = measured > 0
        ? Math.max(PEEK, measured)
        : Math.max(
            PEEK,
            lerpWallet(
              p,
              exploreLayoutRootHeight.value > 0
                ? exploreLayoutRootHeight.value
                : screenHeightSV.value * 0.55,
              (exploreLayoutRootHeight.value > 0
                ? exploreLayoutRootHeight.value
                : screenHeightSV.value * 0.55) * REST_STACK_FRAC,
            ),
          );

      const hasCurrentW = hasCurrentSV.value;
      const exitComplete = exitCompleteSV.value === 1;
      const hasCompleteW = hasCompletePresentSV.value;
      const logged = currentGroupHasLoggedSetsSV.value;
      const pr = primaryRevealedSV.value;
      const primaryCode = pr === 'up_next' ? 0 : pr === 'current' ? 1 : 2;

      /** Stack overlap geometry — layer boxes stay tall; collapse is translateY + isExpanded on cards */
      const currentH = Math.max(PEEK, sw - (hasCompleteW ? 2 * PEEK : PEEK));

      if (!hasCurrentW) {
        if (exitComplete) {
          currentSlideY.value = currentH;
        }
      } else {
        currentExitLayerHeightSV.value = currentH;
        const hiddenTarget = logged
          ? Math.max(0, currentH - CURRENT_IN_PROGRESS_PEEK_VISIBLE_HEIGHT)
          : currentH;
        const target = primaryCode === 1 ? 0 : hiddenTarget;
        const isEntering = primaryCode === 1;
        if (Math.abs(currentSlideY.value - target) > 0.5) {
          currentSlideY.value = withTiming(target, {
            duration: isEntering ? CURRENT_OPEN_MS : CURRENT_CLOSE_MS,
            easing: isEntering ? ENTER_EASE : EXIT_EASE,
          });
        }
      }

      const upNextH = Math.max(PEEK, sw - (hasCompleteW ? PEEK : 0));
      const extraVisibleForCurrent =
        hasCurrentW && logged ? CURRENT_IN_PROGRESS_PEEK_VISIBLE_HEIGHT : 0;
      const upNextVisibleWhenComplete =
        PEEK +
        extraVisibleForCurrent +
        (primaryCode === 2 ? COMPLETE_PRIMARY_UPNEXT_LIFT : 0);
      const hiddenUpNext = Math.max(0, upNextH - upNextVisibleWhenComplete);
      const upNextTarget = primaryCode === 2 ? hiddenUpNext : 0;
      const revealingComplete = primaryCode === 2;
      if (Math.abs(upNextSlideY.value - upNextTarget) > 0.5) {
        upNextSlideY.value = withTiming(upNextTarget, {
          duration: revealingComplete ? UP_NEXT_HIDE_MS : UP_NEXT_SHOW_MS,
          easing: revealingComplete ? EXIT_EASE : ENTER_EASE,
        });
      }
    },
  );

  const triggerCurrentBlockNudge = useCallback(() => {
    currentBlockNudgeY.value = withSequence(
      withTiming(-4, { duration: 45, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 65, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 90, easing: Easing.out(Easing.cubic) }),
    );
  }, [currentBlockNudgeY]);

  const aCompleteLayerHeight = useAnimatedStyle(() => ({
    height: structuralWalletH.value,
  }));

  const aUpNextLayerHeight = useAnimatedStyle(() => ({
    height: Math.max(PEEK, structuralWalletH.value - (hasCompletePresentSV.value ? PEEK : 0)),
  }));

  const aCurrent = useAnimatedStyle(() => {
    const sw = structuralWalletH.value;
    const live = Math.max(PEEK, sw - (hasCompletePresentSV.value ? 2 * PEEK : PEEK));
    const height = hasCurrentSV.value ? live : currentExitLayerHeightSV.value;
    const centerLift = Math.max(0, (sw - height) / 2);
    return {
      position: 'absolute' as const,
      left: 0,
      right: 0,
      bottom: STACK_BOTTOM_GAP,
      height,
      transform: [
        {
          translateY:
            currentSlideY.value +
            currentBlockNudgeY.value +
            centerLift * completionCelebrateProgress.value,
        },
      ],
    };
  }, []);

  /** Keep collapsed Current translateY in sync with wallet height during rest intro/exit (no JS lag). */
  useAnimatedReaction(
    () => structuralWalletH.value,
    (s, prev) => {
      if (prev == null) return;
      if (!hasCurrentSV.value) return;
      if (primaryRevealedSV.value === 'current') return;
      const currentH = Math.max(PEEK, s - (hasCompletePresentSV.value ? 2 * PEEK : PEEK));
      const hiddenTarget = currentGroupHasLoggedSetsSV.value
        ? Math.max(0, currentH - CURRENT_IN_PROGRESS_PEEK_VISIBLE_HEIGHT)
        : currentH;
      currentSlideY.value = hiddenTarget;
    },
  );

  const aUpNext = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY:
            upNextSlideY.value,
        },
      ],
    };
  });
  const celebrationRecedeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(completionCelebrateProgress.value, [0, 1], [1, 0.5]),
    transform: [{ translateY: interpolate(completionCelebrateProgress.value, [0, 1], [0, 96]) }],
  }));

  const rootFillAnimatedStyle = useAnimatedStyle(() => {
    const b = restThemeProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const whenUp = interpolateColor(w, [0, 1], [warmActivityRoot, backgroundTimerRoot]);
    return {
      backgroundColor: interpolateColor(b, [0, 1], [EXPLORE_V2.colors.pageBg, whenUp]),
    };
  }, [warmActivityRoot, backgroundTimerRoot]);

  /** Stack outline — matches page (orange rest / lime work timer) */
  const walletBorderOverlayAnimatedStyle = useAnimatedStyle(() => {
    const b = restThemeProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const pRest = b * (1 - w);
    return {
      borderColor: interpolateColor(pRest, [0, 1], [themeColorsRoot.accentSecondarySoft, themeColorsRoot.accentPrimary]),
    };
  }, [themeColorsRoot.accentSecondarySoft, themeColorsRoot.accentPrimary]);

  const onSelectUpNext = useCallback(
    (gi: number) => {
      const g = exerciseGroups[gi];
      if (!g) return;
      if (groupHasAnyLoggedSet(g, completedSets)) return;
      if (currentGroupHasLoggedSets) {
        triggerCurrentBlockNudge();
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setExpandedGroupIndex(gi);
      setActiveExerciseIndex(0);
      setPrimaryRevealed('current');
    },
    [
      exerciseGroups,
      completedSets,
      currentGroupHasLoggedSets,
      setExpandedGroupIndex,
      setActiveExerciseIndex,
      triggerCurrentBlockNudge,
    ],
  );

  const onSelectCompletedExercise = useCallback(() => {
    // Disabled for now; completed-row tap design is pending.
  }, []);

  const onLogNextSet = useCallback(async (payload?: { setId: string; values: { weight: number; reps: number } }) => {
    // CTA disabled state is handled in CurrentCard; avoid transient prop races blocking Log.
    if (exploreV2TimerPhase !== 'none') return;
    await handleStart(payload);
  }, [exploreV2TimerPhase, handleStart]);

  const focusExercise = useMemo(() => {
    const g = displayCurrentGroup;
    if (!g) return undefined;
    return g.exercises[Math.min(activeExerciseIndex, Math.max(0, g.exercises.length - 1))];
  }, [displayCurrentGroup, activeExerciseIndex, exitTick]);

  const progressionGroupId = useMemo(() => {
    if (!focusExercise || type !== 'main') return null;
    const libId = (focusExercise as any).exerciseId || focusExercise.id;
    const g = progressionGroups.find(pg => pg.exerciseIds.includes(libId));
    return g?.id ?? null;
  }, [focusExercise, progressionGroups, type]);

  const focusExerciseHistory = useMemo(() => {
    if (!focusExercise) return [];
    return getExerciseHistoryForDrawer(focusExercise.id, (focusExercise as any).exerciseId);
  }, [focusExercise, completedSets, localValues, exerciseHistoryRefreshKey]);

  /** Must render in every stack branch while exiting — otherwise `hasCurrent` → false swaps layout and unmounts before the slide runs */
  const currentExerciseLayer =
    shouldShowCurrentLayer && displayCurrentGroup ? (
      <Animated.View
        style={[
          aCurrent,
          { zIndex: zCurrent },
          EXPLORE_V2_DEBUG_CLIP && styles.debugCurrentFrame,
          EXPLORE_V2_DEBUG_CLIP &&
            (currentIsCollapsedSecondary
              ? styles.debugCurrentFrameCollapsed
              : styles.debugCurrentFrameExpanded),
        ]}
      >
        {EXPLORE_V2_DEBUG_CLIP ? (
          <View pointerEvents="none" style={styles.debugCurrentShadowExtent} />
        ) : null}
        <ExploreV2CurrentCard
          group={displayCurrentGroup}
          primaryRevealed={primaryRevealed}
          currentRounds={currentRounds}
          completedSets={completedSets}
          getSetDisplayValues={getSetDisplayValues}
          localValues={localValues}
          setLocalValues={setLocalValues}
          useKg={useKg}
          weightUnit={weightUnit}
          getBarbellMode={getBarbellMode}
          progressionValuesByItemId={progressionValuesByItemId}
          onLogNextSet={onLogNextSet}
          onSkipRest={onSkipRest}
          exploreV2TimerPhase={exploreV2TimerPhase}
          exploreV2WorkBlueProgress={exploreV2WorkBlueProgress}
          preStart={preStart}
          onCollapsedPress={() => {
            Haptics.selectionAsync();
            setPrimaryRevealed('current');
          }}
          showPrimaryCta={showPrimaryCta}
          showCollapsedWhenSecondary={visibleCurrentHasLoggedSets}
          frontBottomRadius={radius.frontBottomRadius}
          coveredBottomRadius={radius.frontBottomRadius}
          timerThemeActive={timerThemeActive}
          restThemeProgress={restThemeProgress}
          settingsOverflow={
            focusExercise
              ? {
                  visible: overflowOpen,
                  onClose: () => setOverflowOpen(false),
                  onOpenSheet: () => {
                    if (exploreV2TimerPhase === 'none') setOverflowOpen(true);
                  },
                  inlineRestActive: exploreV2TimerPhase !== 'none',
                  restThemeProgress,
                  exercise: focusExercise,
                  templateItemId: focusExercise.id,
                  libraryExerciseId: (focusExercise as any).exerciseId,
                  history: focusExerciseHistory,
                  useKg,
                  weightUnit,
                  timeBased: timeBasedOverrides[focusExercise.id] ?? focusExercise.isTimeBased ?? false,
                  onTimeBasedChange: v =>
                    setTimeBasedOverrides(p => ({ ...p, [focusExercise.id]: v })),
                  perSide: perSideOverrides[focusExercise.id] ?? focusExercise.isPerSide ?? false,
                  onPerSideChange: v =>
                    setPerSideOverrides(p => ({ ...p, [focusExercise.id]: v })),
                  progressionGroups,
                  currentProgressionGroupId: progressionGroupId,
                  onProgressionGroupSelect: async optId => {
                    const libId = (focusExercise as any).exerciseId || focusExercise.id;
                    const currentGroupPg = progressionGroups.find(pg => pg.exerciseIds.includes(libId));
                    if (currentGroupPg && optId !== currentGroupPg.id) {
                      await updateProgressionGroup(currentGroupPg.id, {
                        exerciseIds: currentGroupPg.exerciseIds.filter(id => id !== libId),
                      });
                    }
                    if (optId) {
                      const target = progressionGroups.find(pg => pg.id === optId);
                      if (target) {
                        await updateProgressionGroup(target.id, {
                          exerciseIds: [...target.exerciseIds, libId],
                        });
                      }
                    }
                  },
                  onSwap: () => {
                    setOverflowOpen(false);
                    onSwapExercise(focusExercise.id);
                  },
                  onDelete: async () => {
                    setOverflowOpen(false);
                    await onRemoveExercise(focusExercise);
                  },
                  type,
                }
              : undefined
          }
          celebrationProgress={completionCelebrateProgress}
          celebrationActive={celebrateCompletion}
        />
      </Animated.View>
    ) : null;

  if (allComplete && !celebrateCompletion && primaryRevealed !== 'current') {
    return (
      <Animated.View style={[styles.completeOnly, walletShellRadii]}>
        <Animated.View style={[styles.rootFill, rootFillAnimatedStyle]}>
          {completedOnDateLabel ? (
            <View style={styles.completedOnMeta}>
              <Text style={styles.completedOnLine}>Completed on {completedOnDateLabel}</Text>
            </View>
          ) : null}
          <View style={styles.completeOnlyListWrap}>
            <ExploreV2CompleteCard
              completedGroupIndexes={completedExerciseIndexes}
              exerciseGroups={exerciseGroups}
              getSetDisplayValues={getSetDisplayValues}
              useKg={useKg}
              weightUnit={weightUnit}
              onOpenExercise={onSelectCompletedExercise}
              onHeaderPress={() => {}}
              isExpanded
              frontBottomRadius={radius.frontBottomRadius}
              coveredBottomRadius={radius.frontBottomRadius}
              timerThemeActive={timerThemeActive}
              restThemeProgress={restThemeProgress}
              exploreV2WorkBlueProgress={exploreV2WorkBlueProgress}
              contentOnly
            />
          </View>
          {EXPLORE_V2_DEBUG_SHELL_BORDER ? (
            <View
              pointerEvents="none"
              style={[
                styles.debugShellBorderOverlay,
                {
                  borderTopLeftRadius: EXPLORE_V2.cardTopRadius,
                  borderTopRightRadius: EXPLORE_V2.cardTopRadius,
                  borderBottomLeftRadius: radius.frontBottomRadius,
                  borderBottomRightRadius: radius.frontBottomRadius,
                },
              ]}
            />
          ) : null}
        </Animated.View>
      </Animated.View>
    );
  }

  const zCompleteTwo = 30;
  const zUpNextTwo = 40;

  return (
    <Animated.View
      style={[styles.root, walletShellRadii]}
      onLayout={e => {
        const h = e.nativeEvent.layout.height;
        setStackShellHeight(h);
        stackShellHeightSV.value = h;
      }}
    >
      <Animated.View style={[styles.rootFill, rootFillAnimatedStyle]}>
      {!hasCurrent && !hasCompletePresent ? (
        <View style={styles.stackFill}>
          {EXPLORE_V2_DEBUG_CLIP ? (
            <View pointerEvents="none" style={styles.debugStackFillMask} />
          ) : null}
          <Animated.View
            style={[
              styles.layerBottom,
              aUpNextLayerHeight,
              aUpNext,
              {
                bottom: STACK_BOTTOM_GAP,
              },
            ]}
          >
            <ExploreV2UpNextCard
              upNextGroupIndexes={upNextExercises}
              exerciseGroups={exerciseGroups}
              completedSets={completedSets}
              onSelectGroup={onSelectUpNext}
              onHeaderPress={() => {
                Haptics.selectionAsync();
                setPrimaryRevealed('up_next');
              }}
              onOpenAddExercise={onOpenAddExercise}
              onRemoveGroupFromUpNext={onRemoveGroupFromUpNext}
              allowAddExercise={allowAddExercise}
              hasCurrentExercise={shouldShowCurrentLayer}
              hasCompletePresent={hasCompletePresent}
              isExpanded={primaryRevealed === 'up_next'}
              frontBottomRadius={radius.frontBottomRadius}
              coveredBottomRadius={radius.frontBottomRadius}
              timerThemeActive={timerThemeActive}
              restThemeProgress={restThemeProgress}
              exploreV2WorkBlueProgress={exploreV2WorkBlueProgress}
            />
          </Animated.View>
          {currentExerciseLayer}
        </View>
      ) : !hasCurrent && hasCompletePresent ? (
        <View style={styles.stackFill}>
          {EXPLORE_V2_DEBUG_CLIP ? (
            <View pointerEvents="none" style={styles.debugStackFillMask} />
          ) : null}
          <Animated.View
            style={[
              styles.layerBottom,
              aCompleteLayerHeight,
              {
                bottom: STACK_BOTTOM_GAP,
                zIndex: zCompleteTwo,
              },
            ]}
          >
            <ExploreV2CompleteCard
              completedGroupIndexes={completedExerciseIndexes}
              exerciseGroups={exerciseGroups}
              getSetDisplayValues={getSetDisplayValues}
              useKg={useKg}
              weightUnit={weightUnit}
              onOpenExercise={onSelectCompletedExercise}
              onHeaderPress={() => {
                Haptics.selectionAsync();
                setPrimaryRevealed('complete');
              }}
              isExpanded={!celebrateCompletion && primaryRevealed === 'complete'}
              frontBottomRadius={radius.frontBottomRadius}
              coveredBottomRadius={radius.frontBottomRadius}
              timerThemeActive={timerThemeActive}
              restThemeProgress={restThemeProgress}
              exploreV2WorkBlueProgress={exploreV2WorkBlueProgress}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.layerBottom,
              aUpNextLayerHeight,
              aUpNext,
              {
                bottom: STACK_BOTTOM_GAP,
                zIndex: zUpNextTwo,
              },
            ]}
          >
            <ExploreV2UpNextCard
              upNextGroupIndexes={upNextExercises}
              exerciseGroups={exerciseGroups}
              completedSets={completedSets}
              onSelectGroup={onSelectUpNext}
              onHeaderPress={() => {
                Haptics.selectionAsync();
                setPrimaryRevealed('up_next');
              }}
              onOpenAddExercise={onOpenAddExercise}
              onRemoveGroupFromUpNext={onRemoveGroupFromUpNext}
              allowAddExercise={allowAddExercise}
              hasCurrentExercise={shouldShowCurrentLayer}
              hasCompletePresent={hasCompletePresent}
              isExpanded={!celebrateCompletion && primaryRevealed === 'up_next'}
              frontBottomRadius={radius.frontBottomRadius}
              coveredBottomRadius={radius.frontBottomRadius}
              timerThemeActive={timerThemeActive}
              restThemeProgress={restThemeProgress}
              exploreV2WorkBlueProgress={exploreV2WorkBlueProgress}
            />
          </Animated.View>
          {currentExerciseLayer}
        </View>
      ) : (
        <View style={styles.stackFill}>
          {EXPLORE_V2_DEBUG_CLIP ? (
            <View pointerEvents="none" style={styles.debugStackFillMask} />
          ) : null}
          {hasCompletePresent ? (
            <Animated.View
              style={[
                styles.layerBottom,
                aCompleteLayerHeight,
                celebrationRecedeStyle,
                {
                  bottom: STACK_BOTTOM_GAP,
                  zIndex: zComplete,
                },
              ]}
            >
              <ExploreV2CompleteCard
                completedGroupIndexes={completedExerciseIndexes}
                exerciseGroups={exerciseGroups}
                getSetDisplayValues={getSetDisplayValues}
                useKg={useKg}
                weightUnit={weightUnit}
                onOpenExercise={onSelectCompletedExercise}
                onHeaderPress={() => {
                  Haptics.selectionAsync();
                  setPrimaryRevealed('complete');
                }}
                isExpanded={!celebrateCompletion && primaryRevealed === 'complete'}
                frontBottomRadius={radius.frontBottomRadius}
                coveredBottomRadius={radius.frontBottomRadius}
                timerThemeActive={timerThemeActive}
                restThemeProgress={restThemeProgress}
                exploreV2WorkBlueProgress={exploreV2WorkBlueProgress}
              />
            </Animated.View>
          ) : null}
          <Animated.View
            style={[
              styles.layerBottom,
              aUpNextLayerHeight,
              aUpNext,
              celebrationRecedeStyle,
              {
                bottom: STACK_BOTTOM_GAP,
                zIndex: zUpNext,
              },
            ]}
          >
            <ExploreV2UpNextCard
              upNextGroupIndexes={upNextExercises}
              exerciseGroups={exerciseGroups}
              completedSets={completedSets}
              onSelectGroup={onSelectUpNext}
              onHeaderPress={() => {
                Haptics.selectionAsync();
                setPrimaryRevealed('up_next');
              }}
              onOpenAddExercise={onOpenAddExercise}
              onRemoveGroupFromUpNext={onRemoveGroupFromUpNext}
              allowAddExercise={allowAddExercise}
              hasCurrentExercise={shouldShowCurrentLayer}
              hasCompletePresent={hasCompletePresent}
              isExpanded={!celebrateCompletion && primaryRevealed === 'up_next'}
              frontBottomRadius={radius.frontBottomRadius}
              coveredBottomRadius={radius.frontBottomRadius}
              timerThemeActive={timerThemeActive}
              restThemeProgress={restThemeProgress}
              exploreV2WorkBlueProgress={exploreV2WorkBlueProgress}
            />
          </Animated.View>
          {currentExerciseLayer}
        </View>
      )}

      {EXPLORE_V2_DEBUG_CLIP ? (
        <View pointerEvents="none" style={styles.debugRootMask} />
      ) : null}
      {EXPLORE_V2_DEBUG_SHELL_BORDER ? (
        <View
          pointerEvents="none"
          style={[
            styles.debugShellBorderOverlay,
            {
              borderTopLeftRadius: EXPLORE_V2.cardTopRadius,
              borderTopRightRadius: EXPLORE_V2.cardTopRadius,
              borderBottomLeftRadius: radius.frontBottomRadius,
              borderBottomRightRadius: radius.frontBottomRadius,
            },
          ]}
        />
      ) : null}
      {EXPLORE_V2_DEBUG_LAYOUT && __DEV__ ? (
        <View style={styles.debugOverlay} pointerEvents="none">
          <View style={styles.debugChip}>
            <Text style={styles.debugText}>
              {`sh:${Math.round(stackShellHeight)} a:${hasCurrent ? primaryRevealed : 'up_next'} p:${PEEK}`}
            </Text>
          </View>
        </View>
      ) : null}
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.walletBorderOverlay,
          walletBorderOverlayAnimatedStyle,
          walletShellRadii,
          { zIndex: WALLET_BORDER_OVERLAY_Z },
        ]}
      />
    </Animated.View>
  );
}

export const ExploreV2ExecutionRoot = React.memo(ExploreV2ExecutionRootComponent);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    marginHorizontal: STACK_SIDE_GAP,
    marginBottom: STACK_DEVICE_BOTTOM_GAP,
    minHeight: 0,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
  },
  /** Animated rest/page fill — sits under cards; border is a separate overlay */
  rootFill: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
  },
  /** Drawn above all card layers so rounded card corners don’t cover the stroke */
  walletBorderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
  },
  completeOnly: {
    flex: 1,
    position: 'relative' as const,
    marginHorizontal: 0,
    marginBottom: STACK_DEVICE_BOTTOM_GAP,
    minHeight: 0,
    overflow: 'visible',
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
  },
  completedOnMeta: {
    position: 'absolute',
    top: 10,
    left: 24,
    right: 24,
    zIndex: 10,
  },
  completedOnLine: {
    ...TYPOGRAPHY.h3,
    fontWeight: '500',
    color: '#002E29',
  },
  completeOnlyListWrap: {
    flex: 1,
    marginTop: 78,
  },
  /** Fills wallet band; back cards use absolute fill so they are not height-squished. */
  stackFill: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 0,
  },
  /** Bottom-pinned fixed-height card layer */
  layerBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: STACK_BOTTOM_GAP,
    overflow: 'hidden',
  },
  debugOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  debugChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 8,
  },
  debugText: {
    fontSize: 10,
    color: '#FFFFFF',
  },
  debugRootMask: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: '#ff00ff', // outer shell mask
    zIndex: 999,
  },
  debugStackFillMask: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: '#00e5ff', // clipping parent for stack layers
    zIndex: 998,
  },
  debugCurrentFrame: {
    borderWidth: 1,
    zIndex: 997,
  },
  debugCurrentFrameExpanded: {
    borderColor: '#39ff14', // expanded current frame
  },
  debugCurrentFrameCollapsed: {
    borderColor: '#ff8c00', // collapsed current frame
  },
  debugCurrentShadowExtent: {
    position: 'absolute',
    top: -12,
    left: -12,
    right: -12,
    bottom: -12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#ffd400', // approximate shadow extent guide
  },
  debugShellBorderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: EXPLORE_V2.colors.pageBg,
    zIndex: 1200,
  },
});
