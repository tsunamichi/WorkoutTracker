/**
 * Explore v2 — bottom-pinned wallet stack (isolated).
 * Card order (back → front): Complete, Up Next, Current.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, useWindowDimensions, Platform, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { EXPLORE_V2 } from './exploreV2Tokens';
import type { ExploreV2Group } from './exploreV2Types';
import type { PrimaryRevealedCard } from './exploreV2Types';
import { ExploreV2CompleteCard } from './ExploreV2CompleteCard';
import { ExploreV2UpNextCard } from './ExploreV2UpNextCard';
import { ExploreV2CurrentCard } from './ExploreV2CurrentCard';
import { ExploreV2CurrentOverflowSheet } from './ExploreV2CurrentOverflowSheet';
import { getExploreV2RadiusTokens } from './exploreV2Geometry';

const EXIT_EASE = Easing.bezier(...EXPLORE_V2.motion.currentExitEase);
const ENTER_EASE = Easing.bezier(...EXPLORE_V2.motion.currentEnterEase);
const PEEK = EXPLORE_V2.peekHeaderHeight;
const STACK_BOTTOM_GAP = 0;
const STACK_SIDE_GAP = 4;
const STACK_DEVICE_BOTTOM_GAP = 2;
const CURRENT_IN_PROGRESS_PEEK_VISIBLE_HEIGHT = 136;
const EXPLORE_V2_DEBUG_LAYOUT = false;
// Temporary debug mode for clipping/geometry inspection.
// Set to false to disable all debug overlays.
const EXPLORE_V2_DEBUG_CLIP = false;
const EXPLORE_V2_DEBUG_SHELL_BORDER = true;

/** Lightweight fallback before wallet band reports measured height. */
const FALLBACK_WALLET_HEIGHT = 420;

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
  handleStart: () => Promise<void>;
  openExploreDetailSheet: (groupIndex: number, exerciseIndex: number) => void;
  showPrimaryCta: boolean;
  inlineRestActive: boolean;
  allComplete: boolean;
  type: 'warmup' | 'main' | 'core';
  progressionGroups: Array<{ id: string; name: string; exerciseIds: string[] }>;
  updateProgressionGroup: (id: string, patch: { exerciseIds: string[] }) => Promise<void>;
  onSwapExercise: () => void;
  onRemoveExercise: (exercise: ExploreV2Group['exercises'][0]) => Promise<void>;
  /** Measured height of the wallet band (75% region). */
  walletStackHeight: number;
  /** Current group has at least one logged set — cannot replace Current from Up Next. */
  currentGroupHasLoggedSets: boolean;
  onOpenAddExercise: () => void;
  onRemoveGroupFromUpNext: (groupIndex: number) => void | Promise<void>;
  /** Template supports add (main workouts). */
  allowAddExercise: boolean;
  /** Timer-rest visual theme is active. */
  timerThemeActive: boolean;
};

export function ExploreV2ExecutionRoot(props: ExploreV2ExecutionRootProps) {
  const { width: screenWidth } = useWindowDimensions();
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
    openExploreDetailSheet,
    showPrimaryCta,
    inlineRestActive,
    allComplete,
    type,
    progressionGroups,
    updateProgressionGroup,
    onSwapExercise,
    onRemoveExercise,
    walletStackHeight,
    currentGroupHasLoggedSets,
    onOpenAddExercise,
    onRemoveGroupFromUpNext,
    allowAddExercise,
    timerThemeActive,
  } = props;
  const radius = useMemo(
    () => getExploreV2RadiusTokens(screenWidth, insets.bottom),
    [screenWidth, insets.bottom],
  );

  const [primaryRevealed, setPrimaryRevealed] = useState<PrimaryRevealedCard>('up_next');
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [stackShellHeight, setStackShellHeight] = useState(0);
  const hasCompletePresent = completedExerciseIndexes.length > 0;
  const currentGroupIndex = exploreCurrentGroupIndex;
  const hasCurrent = currentGroupIndex !== null;
  const currentGroup = currentGroupIndex !== null ? exerciseGroups[currentGroupIndex] : null;

  const measuredWalletHeight = walletStackHeight > 0 ? walletStackHeight : FALLBACK_WALLET_HEIGHT;
  const effectiveWalletHeight = stackShellHeight > 0 ? stackShellHeight : measuredWalletHeight;
  // Card size model:
  // - Up Next alone: 100%
  // - With Current: Current is 100% - 54
  // - With Complete: Up Next is 100% - 54, Current is 100% - 108
  const structuralCardHeight = Math.max(PEEK, effectiveWalletHeight);
  const upNextExpandedH = Math.max(
    PEEK,
    structuralCardHeight - (hasCompletePresent ? PEEK : 0),
  );
  const currentExpandedH = Math.max(
    PEEK,
    structuralCardHeight - (hasCompletePresent ? 2 * PEEK : PEEK),
  );
  const completeExpandedH = structuralCardHeight;
  /** Slides the card in from below the stack when Current appears or the group changes. */
  const currentSlideY = useSharedValue<number>(currentExpandedH);
  /** Slides Up Next down to a visible header tab when Completed is primary. */
  const upNextSlideY = useSharedValue<number>(0);

  const currentHasNoLogsInGroup = useMemo(() => {
    if (!currentGroup) return false;
    return !groupHasAnyLoggedSet(currentGroup, completedSets);
  }, [currentGroup, completedSets]);

  const preStart = hasCurrent && currentHasNoLogsInGroup;
  const currentIsCollapsedSecondary =
    hasCurrent && currentGroupHasLoggedSets && primaryRevealed !== 'current';

  useEffect(() => {
    if (hasCurrent) setPrimaryRevealed('current');
    else setPrimaryRevealed('up_next');
  }, [hasCurrent]);

  const stackFillHeight = structuralCardHeight;

  useEffect(() => {
    if (!EXPLORE_V2_DEBUG_LAYOUT || !__DEV__) return;
    const activeCardType: PrimaryRevealedCard = hasCurrent ? primaryRevealed : 'up_next';
    const activeCardHeight =
      activeCardType === 'current'
        ? currentExpandedH
        : activeCardType === 'up_next'
          ? upNextExpandedH
          : completeExpandedH;
    const activeCardBottom = STACK_BOTTOM_GAP;
    const activeCardTop = stackFillHeight - activeCardBottom - activeCardHeight;
    console.log('[ExploreV2LayoutDebug]', {
      walletHeight: measuredWalletHeight,
      shellHeight: stackShellHeight,
      activeCardType,
      activeCardHeight,
      inactiveVisibleCount: 'n/a-structural-model',
      peekHeight: PEEK,
      activeCardBottom,
      activeCardTop,
      activeCardTranslateY: activeCardType === 'current' ? currentSlideY.value : upNextSlideY.value,
    });
  }, [
    measuredWalletHeight,
    stackShellHeight,
    hasCurrent,
    primaryRevealed,
    hasCompletePresent,
    currentGroupHasLoggedSets,
    stackFillHeight,
    currentSlideY,
    upNextSlideY,
  ]);

  // Keep Up Next above Completed so its exit slide-to-tab remains visible.
  const zComplete = 30;
  const zUpNext = 40;
  // Keep Current above stack while present so slide-out is visible and in-progress peek is tappable.
  const zCurrent = hasCurrent ? 50 : 0;

  /** Bottom-pinned motion:
   *  - no logged sets: slide Current fully out when not primary
   *  - in-progress (logged): keep a collapsed peek visible when not primary
   */
  useEffect(() => {
    if (!hasCurrent) {
      currentSlideY.value = currentExpandedH;
      return;
    }
    const hiddenTarget = currentGroupHasLoggedSets
      ? Math.max(0, currentExpandedH - CURRENT_IN_PROGRESS_PEEK_VISIBLE_HEIGHT)
      : currentExpandedH;
    const target = primaryRevealed === 'current' ? 0 : hiddenTarget;
    const isEntering = primaryRevealed === 'current';
    currentSlideY.value = withTiming(target, {
      duration: isEntering ? EXPLORE_V2.motion.currentEnterMs : EXPLORE_V2.motion.currentExitMs,
      easing: isEntering ? ENTER_EASE : EXIT_EASE,
    });
  }, [hasCurrent, currentGroupIndex, currentExpandedH, primaryRevealed, currentGroupHasLoggedSets]);

  /** Up Next motion: when Completed is primary, slide Up Next to header-peek tab. */
  useEffect(() => {
    // If Current is in-progress and compacted, reserve its visible strip so Up Next
    // still shows a visible header tab above it when Completed is primary.
    const extraVisibleForCurrent = hasCurrent && currentGroupHasLoggedSets
      ? CURRENT_IN_PROGRESS_PEEK_VISIBLE_HEIGHT
      : 0;
    const upNextVisibleWhenComplete = PEEK + extraVisibleForCurrent;
    const hiddenTarget = Math.max(0, upNextExpandedH - upNextVisibleWhenComplete);
    const target = primaryRevealed === 'complete' ? hiddenTarget : 0;
    const isRevealing = primaryRevealed === 'complete';
    const delay = hasCurrent ? EXPLORE_V2.motion.stackStaggerMs : 0;
    upNextSlideY.value = withDelay(
      delay,
      withTiming(target, {
        duration: isRevealing ? EXPLORE_V2.motion.upNextRevealMs : EXPLORE_V2.motion.upNextSettleMs,
        easing: isRevealing ? EXIT_EASE : ENTER_EASE,
      }),
    );
  }, [primaryRevealed, upNextExpandedH, upNextSlideY, hasCurrent, currentGroupHasLoggedSets]);

  const aCurrent = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: STACK_BOTTOM_GAP,
    height: currentExpandedH,
    transform: [{ translateY: currentSlideY.value }],
  }));

  const aUpNext = useAnimatedStyle(() => ({
    transform: [{ translateY: upNextSlideY.value }],
  }));

  const onSelectUpNext = useCallback(
    (gi: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const g = exerciseGroups[gi];
      if (!g) return;
      if (groupHasAnyLoggedSet(g, completedSets)) return;
      if (currentGroupHasLoggedSets) {
        return;
      }
      setExpandedGroupIndex(gi);
      setActiveExerciseIndex(0);
      setPrimaryRevealed('current');
    },
    [exerciseGroups, completedSets, currentGroupHasLoggedSets, setExpandedGroupIndex, setActiveExerciseIndex],
  );

  const onLogNextSet = useCallback(async () => {
    if (!showPrimaryCta || inlineRestActive) return;
    await handleStart();
  }, [showPrimaryCta, inlineRestActive, handleStart]);

  const focusExercise = currentGroup?.exercises[Math.min(activeExerciseIndex, (currentGroup?.exercises.length ?? 1) - 1)];

  const progressionGroupId = useMemo(() => {
    if (!focusExercise || type !== 'main') return null;
    const libId = (focusExercise as any).exerciseId || focusExercise.id;
    const g = progressionGroups.find(pg => pg.exerciseIds.includes(libId));
    return g?.id ?? null;
  }, [focusExercise, progressionGroups, type]);

  if (allComplete) {
    return (
      <View
        style={[
          styles.completeOnly,
          {
            backgroundColor: timerThemeActive ? '#FFA424' : EXPLORE_V2.colors.pageBg,
            borderBottomLeftRadius: radius.frontBottomRadius,
            borderBottomRightRadius: radius.frontBottomRadius,
          },
        ]}
      >
        <View style={[styles.layerBottom, { height: completeExpandedH }]}>
          <ExploreV2CompleteCard
            completedGroupIndexes={completedExerciseIndexes}
            exerciseGroups={exerciseGroups}
            getSetDisplayValues={getSetDisplayValues}
            useKg={useKg}
            weightUnit={weightUnit}
            onOpenExercise={(gi, ei) => openExploreDetailSheet(gi, ei)}
            onHeaderPress={() => {}}
            isExpanded
            frontBottomRadius={radius.frontBottomRadius}
            coveredBottomRadius={radius.frontBottomRadius}
            timerThemeActive={timerThemeActive}
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
      </View>
    );
  }

  const zCompleteTwo = 30;
  const zUpNextTwo = 40;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: timerThemeActive ? '#FFA424' : EXPLORE_V2.colors.pageBg,
          borderBottomLeftRadius: radius.frontBottomRadius,
          borderBottomRightRadius: radius.frontBottomRadius,
        },
      ]}
      onLayout={e => setStackShellHeight(e.nativeEvent.layout.height)}
    >
      {!hasCurrent && !hasCompletePresent ? (
        <View style={[styles.stackFill, { height: stackFillHeight }]}>
          {EXPLORE_V2_DEBUG_CLIP ? (
            <View pointerEvents="none" style={styles.debugStackFillMask} />
          ) : null}
          <Animated.View
            style={[
              styles.layerBottom,
              aUpNext,
              {
                height: upNextExpandedH,
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
              currentSelectionsLocked={currentGroupHasLoggedSets}
              hasCurrentExercise={hasCurrent}
              hasCompletePresent={hasCompletePresent}
              isExpanded={primaryRevealed === 'up_next'}
              frontBottomRadius={radius.frontBottomRadius}
              coveredBottomRadius={radius.frontBottomRadius}
              timerThemeActive={timerThemeActive}
            />
          </Animated.View>
        </View>
      ) : !hasCurrent && hasCompletePresent ? (
        <View style={[styles.stackFill, { height: stackFillHeight }]}>
          {EXPLORE_V2_DEBUG_CLIP ? (
            <View pointerEvents="none" style={styles.debugStackFillMask} />
          ) : null}
          <View
            style={[
              styles.layerBottom,
              {
                height: completeExpandedH,
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
              onOpenExercise={(gi, ei) => openExploreDetailSheet(gi, ei)}
              onHeaderPress={() => {
                Haptics.selectionAsync();
                setPrimaryRevealed('complete');
              }}
              isExpanded={primaryRevealed === 'complete'}
              frontBottomRadius={radius.frontBottomRadius}
              coveredBottomRadius={radius.frontBottomRadius}
              timerThemeActive={timerThemeActive}
            />
          </View>
          <Animated.View
            style={[
              styles.layerBottom,
              aUpNext,
              {
                height: upNextExpandedH,
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
              currentSelectionsLocked={currentGroupHasLoggedSets}
              hasCurrentExercise={hasCurrent}
              hasCompletePresent={hasCompletePresent}
              isExpanded={primaryRevealed === 'up_next'}
              frontBottomRadius={radius.frontBottomRadius}
              coveredBottomRadius={radius.frontBottomRadius}
              timerThemeActive={timerThemeActive}
            />
          </Animated.View>
        </View>
      ) : (
        <View style={[styles.stackFill, { height: stackFillHeight }]}>
          {EXPLORE_V2_DEBUG_CLIP ? (
            <View pointerEvents="none" style={styles.debugStackFillMask} />
          ) : null}
          {hasCompletePresent ? (
            <View
              style={[
                styles.layerBottom,
                {
                  height: completeExpandedH,
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
                onOpenExercise={(gi, ei) => openExploreDetailSheet(gi, ei)}
                onHeaderPress={() => {
                  Haptics.selectionAsync();
                  setPrimaryRevealed('complete');
                }}
                isExpanded={primaryRevealed === 'complete'}
                frontBottomRadius={radius.frontBottomRadius}
                coveredBottomRadius={radius.frontBottomRadius}
                timerThemeActive={timerThemeActive}
              />
            </View>
          ) : null}
          <Animated.View
            style={[
              styles.layerBottom,
              aUpNext,
              {
                height: upNextExpandedH,
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
              currentSelectionsLocked={currentGroupHasLoggedSets}
              hasCurrentExercise={hasCurrent}
              hasCompletePresent={hasCompletePresent}
              isExpanded={primaryRevealed === 'up_next'}
              frontBottomRadius={radius.frontBottomRadius}
              coveredBottomRadius={radius.frontBottomRadius}
              timerThemeActive={timerThemeActive}
            />
          </Animated.View>
          {hasCurrent && currentGroup ? (
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
                group={currentGroup}
                primaryRevealed={primaryRevealed}
                currentRounds={currentRounds}
                completedSets={completedSets}
                getSetDisplayValues={getSetDisplayValues}
                localValues={localValues}
                useKg={useKg}
                weightUnit={weightUnit}
                getBarbellMode={getBarbellMode}
                onLogNextSet={onLogNextSet}
                onOpenOverflow={() => setOverflowOpen(true)}
                preStart={preStart}
                onCollapsedPress={() => {
                  Haptics.selectionAsync();
                  setPrimaryRevealed('current');
                }}
                showPrimaryCta={showPrimaryCta}
                inlineRestActive={inlineRestActive}
                showCollapsedWhenSecondary={currentGroupHasLoggedSets}
                frontBottomRadius={radius.frontBottomRadius}
                coveredBottomRadius={radius.frontBottomRadius}
                timerThemeActive={timerThemeActive}
              />
            </Animated.View>
          ) : null}
        </View>
      )}

      {focusExercise && currentGroup && (
        <ExploreV2CurrentOverflowSheet
          visible={overflowOpen}
          onClose={() => setOverflowOpen(false)}
          exercise={focusExercise}
          templateItemId={focusExercise.id}
          libraryExerciseId={(focusExercise as any).exerciseId}
          useKg={useKg}
          getBarbellMode={getBarbellMode}
          setBarbellMode={setBarbellMode}
          timeBased={timeBasedOverrides[focusExercise.id] ?? focusExercise.isTimeBased ?? false}
          onTimeBasedChange={v => setTimeBasedOverrides(p => ({ ...p, [focusExercise.id]: v }))}
          perSide={perSideOverrides[focusExercise.id] ?? focusExercise.isPerSide ?? false}
          onPerSideChange={v => setPerSideOverrides(p => ({ ...p, [focusExercise.id]: v }))}
          progressionGroups={progressionGroups}
          currentProgressionGroupId={progressionGroupId}
          onProgressionGroupSelect={async optId => {
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
          }}
          onSwap={() => {
            setOverflowOpen(false);
            onSwapExercise();
          }}
          onDelete={async () => {
            setOverflowOpen(false);
            await onRemoveExercise(focusExercise);
          }}
          type={type}
        />
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
              {`w:${Math.round(measuredWalletHeight)} sh:${Math.round(stackShellHeight)} a:${
                hasCurrent ? primaryRevealed : 'up_next'
              } c:${Math.round(currentExpandedH)} u:${Math.round(upNextExpandedH)} k:${Math.round(completeExpandedH)} p:${PEEK}`}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    marginHorizontal: STACK_SIDE_GAP,
    marginBottom: STACK_DEVICE_BOTTOM_GAP,
    paddingBottom: 0,
    minHeight: 200,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
  },
  /** Fills wallet band; back cards use absolute fill so they are not height-squished. */
  stackFill: {
    flex: 1,
    position: 'relative',
    overflow: 'visible',
    minHeight: 0,
  },
  completeOnly: {
    flex: 1,
    position: 'relative',
    marginHorizontal: STACK_SIDE_GAP,
    marginBottom: STACK_DEVICE_BOTTOM_GAP,
    backgroundColor: 'transparent',
    minHeight: 0,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
  },
  /** Bottom-pinned fixed-height card layer */
  layerBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: STACK_BOTTOM_GAP,
    overflow: 'visible',
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
