import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
  Animated,
  Easing,
  Modal,
  FlatList,
  TextInput,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  interpolate,
  interpolateColor,
  runOnJS,
  Easing as ReanimatedEasing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import { useAppTheme } from '../theme/useAppTheme';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconArrowLeft, IconCheck, IconCheckmark, IconAddLine, IconMinusLine, IconTrash, IconEdit, IconMenu, IconHistory, IconRestart, IconSkip, IconSwap, IconArrowRight, IconAdd, IconPause, IconPlay, IconAddTime, IconChevronDown } from '../components/icons';
import { BottomDrawer } from '../components/common/BottomDrawer';
import { NextLabel } from '../components/common/NextLabel';
import { SetTimerSheet } from '../components/timer/SetTimerSheet';
import { TimerValueSheet } from '../components/timer/TimerValueSheet';
import { ActionSheet, type ActionSheetItem } from '../components/common/ActionSheet';
import { Toggle } from '../components/Toggle';
import { ShapeConfetti } from '../components/common/ShapeConfetti';
import { DeviceEdgeTimer } from '../components/common/DeviceEdgeTimer';
import { ExploreV2ExecutionRoot } from '../components/exploreV2/ExploreV2ExecutionRoot';
import { ExploreV2TimerArea } from '../components/exploreV2/ExploreV2TimerArea';
import { EXPLORE_V2 } from '../components/exploreV2/exploreV2Tokens';
import { useTranslation } from '../i18n/useTranslation';
import { formatWeightForLoad, toDisplayWeight, fromDisplayWeight } from '../utils/weight';
import { applyForwardPropagationForExerciseRounds } from '../utils/exerciseLocalValues';
import type { WarmupItem_DEPRECATED as WarmupItem, AccessoryItem_DEPRECATED as AccessoryItem, WorkoutTemplateExercise } from '../types/training';
import { isDeprecatedItem, getDisplayValuesFromItem } from '../utils/exerciseMigration';
import { computeNextSuggestion } from '../utils/progressionSuggestions';
import dayjs from 'dayjs';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Coordinated expand/collapse transition for exercise cards (height, spacing, opacity)
const CARD_TRANSITION = LayoutAnimation.create(
  280,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity
);

const CARD_COLLAPSED_HEIGHT = 48;
const CARD_EXPANDED_MAX_HEIGHT = 520;
// Overlapped shell/content timing: coordinated transform, not sequential
const SHELL_EXPAND_MS = 230;
const METRICS_ENTER_DELAY_MS = 10;
const ACTION_ENTER_DELAY_MS = 40;
const CONTENT_ENTER_MS = 160;
const CONTENT_EXIT_MS = 0;
const SHELL_COLLAPSE_DELAY_MS = 0;
const SHELL_COLLAPSE_MS = 0;
const CONTENT_TRANSLATE_Y = 8;

/** iOS keyboard toolbar for Explore detail sheet inline set editing */
const EXPLORE_SET_EDIT_ACCESSORY_ID = 'exploreSetEditAccessory';

type TransitionPhase = 'idle' | 'collapsing' | 'expanding';

const DEBUG_CARD_TRANSITION = true;
function cardLog(msg: string, data?: Record<string, unknown>) {
  if (DEBUG_CARD_TRANSITION && __DEV__) {
    console.log(`[CardTransition] ${msg}`, data ?? '');
  }
}

/** One shell + two grouped content sections (metrics + action), overlapped with shell motion. */
function AnimatedCardContainer({
  shouldBeOpen,
  onCloseComplete,
  onOpenComplete,
  children,
}: {
  shouldBeOpen: boolean;
  isClosing: boolean;
  isOpening: boolean;
  onCloseComplete?: () => void;
  onOpenComplete?: () => void;
  children: (metricsStyle: Record<string, unknown>, actionStyle: Record<string, unknown>) => React.ReactNode;
}) {
  const shellProgress = useSharedValue(shouldBeOpen ? 1 : 0);
  const metricsProgress = useSharedValue(shouldBeOpen ? 1 : 0);
  const actionProgress = useSharedValue(shouldBeOpen ? 1 : 0);

  useEffect(() => {
    const onOpen = onOpenComplete;
    const onClose = onCloseComplete;
    if (shouldBeOpen) {
      cardLog('open start');
      metricsProgress.value = withDelay(METRICS_ENTER_DELAY_MS, withTiming(1, { duration: CONTENT_ENTER_MS }));
      actionProgress.value = withDelay(ACTION_ENTER_DELAY_MS, withTiming(1, { duration: CONTENT_ENTER_MS }));
      shellProgress.value = withTiming(1, { duration: SHELL_EXPAND_MS }, (f) => {
        if (f !== false && onOpen) runOnJS(onOpen)();
      });
    } else {
      cardLog('close start');
      metricsProgress.value = withTiming(0, { duration: CONTENT_EXIT_MS });
      actionProgress.value = withTiming(0, { duration: CONTENT_EXIT_MS });
      shellProgress.value = withDelay(SHELL_COLLAPSE_DELAY_MS, withTiming(0, { duration: SHELL_COLLAPSE_MS }, (f) => {
        if (f !== false && onClose) runOnJS(onClose)();
      }));
    }
  }, [shouldBeOpen, shellProgress, metricsProgress, actionProgress, onOpenComplete, onCloseComplete]);

  const containerStyle = useAnimatedStyle(() => ({
    overflow: 'hidden' as const,
    maxHeight: interpolate(shellProgress.value, [0, 1], [CARD_COLLAPSED_HEIGHT, CARD_EXPANDED_MAX_HEIGHT]),
  }));

  const metricsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(metricsProgress.value, [0, 0.2, 1], [0, 0, 1]),
    transform: [{ translateY: interpolate(metricsProgress.value, [0, 1], [CONTENT_TRANSLATE_Y, 0]) }],
  }));

  const actionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(actionProgress.value, [0, 0.2, 1], [0, 0, 1]),
    transform: [{ translateY: interpolate(actionProgress.value, [0, 1], [CONTENT_TRANSLATE_Y, 0]) }],
  }));

  return (
    <AnimatedReanimated.View style={containerStyle}>
      {children(metricsStyle, actionStyle)}
    </AnimatedReanimated.View>
  );
}

type ExecutionType = 'warmup' | 'main' | 'core';
type ExecutionMode = 'current' | 'explore' | 'explore-v2';

type RouteParams = {
  ExerciseExecution: {
    workoutKey: string;
    workoutTemplateId: string;
    type: ExecutionType;
  };
};

/** Store completion ids are `${templateExerciseId}-set-${round}`. */
function templateExerciseHasLoggedSets(completedSets: Set<string>, templateExerciseId: string): boolean {
  const prefix = `${templateExerciseId}-set-`;
  for (const id of completedSets) {
    if (id.startsWith(prefix)) return true;
  }
  return false;
}

export function ExerciseExecutionScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'ExerciseExecution'>>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  
  const { workoutKey, workoutTemplateId, type, bonusLogId } = route.params as {
    workoutKey: string;
    workoutTemplateId: string;
    type: 'warmup' | 'main' | 'core';
    bonusLogId?: string;
  };
  
  console.log('🚀 ExerciseExecutionScreen initialized:', {
    workoutKey,
    workoutTemplateId,
    type,
    isScheduledWorkout: workoutKey?.startsWith('sw-'),
  });
  
  const {
    getWorkoutTemplate,
    updateWarmupCompletion,
    getWarmupCompletion,
    updateAccessoryCompletion,
    getAccessoryCompletion,
    updateMainCompletion,
    getMainCompletion,
    updateWorkoutTemplate,
    updateScheduledWorkoutSnapshots,
    settings,
    exercises: exercisesLibrary,
    resetWarmupCompletion,
    resetMainCompletion,
    resetAccessoryCompletion,
    getBarbellMode,
    setBarbellMode,
    addSession,
    updateSession,
    deleteSession,
    completeWorkout,
    uncompleteWorkout,
    updateExercisePR,
    addExercise,
    scheduledWorkouts,
    cyclePlans,
    updateBonusLog,
    bonusLogs,
    saveExerciseProgress,
    logCoreSession,
    getEffectiveProgressionRule,
    getLastCompletedLogForExercise,
    progressionGroups,
    updateProgressionGroup,
  } = useStore();

  const appTheme = useAppTheme();
  
  const getDetailedWorkoutProgress = () => useStore.getState().detailedWorkoutProgress;
  
  const [refreshKey, setRefreshKey] = useState(0);
  // Subscribe to template so Remove (and other template updates) trigger re-render
  const template = useStore(
    useCallback((s) => s.workoutTemplates.find((t: { id: string }) => t.id === workoutTemplateId), [workoutTemplateId])
  );

  // Check if this workout belongs to a past (non-active) cycle
  const isInPastCycle = React.useMemo(() => {
    const sw = scheduledWorkouts.find(w => w.id === workoutKey);
    if (!sw || sw.source !== 'cycle') return false;
    const planId = sw.programId || sw.cyclePlanId;
    if (!planId) return false;
    const plan = cyclePlans.find(p => p.id === planId);
    return plan ? !plan.active : false;
  }, [scheduledWorkouts, cyclePlans, workoutKey]);
  const useKg = settings.useKg;
  const weightUnit = useKg ? 'kg' : 'lbs';
  const weightStep = useKg ? 0.5 : 5;
  
  // Refresh template when screen comes back into focus (not on initial mount)
  const hasMountedRef = useRef(false);
  useFocusEffect(
    React.useCallback(() => {
      if (hasMountedRef.current) {
        setRefreshKey(prev => prev + 1);
      } else {
        hasMountedRef.current = true;
      }
    }, [])
  );
  
  // Debug: Log template info
  console.log('🔍 ExerciseExecutionScreen template:', {
    type,
    templateId: workoutTemplateId,
    hasTemplate: !!template,
    warmupItems: template?.warmupItems?.length || 0,
    accessoryItems: template?.accessoryItems?.length || 0,
    mainItems: template?.items?.length || 0,
    refreshKey,
  });
  
  // Helper: normalize any item (old or new format) to the deprecated WarmupItem shape
  // that the rest of this screen expects
  const normalizeToDeprecated = (item: any): WarmupItem => {
    if (isDeprecatedItem(item)) {
      return item as WarmupItem;
    }
    // New ExerciseInstanceWithCycle format → convert to deprecated shape
    const display = getDisplayValuesFromItem(item);
    return {
      id: item.id,
      exerciseName: display.exerciseName,
      sets: display.sets,
      reps: display.reps,
      weight: display.weight,
      isTimeBased: display.isTimeBased,
      isPerSide: display.isPerSide ?? false,
      cycleId: display.cycleId,
      cycleOrder: display.cycleOrder,
    } as WarmupItem;
  };

  const [timeBasedOverrides, setTimeBasedOverrides] = useState<Record<string, boolean>>({});
  const [perSideOverrides, setPerSideOverrides] = useState<Record<string, boolean>>({});

  // When we have a scheduled workout, use its snapshot so completion IDs match the store exactly
  const scheduledWorkout = useMemo(
    () => (workoutKey?.startsWith('sw-') ? scheduledWorkouts.find(sw => sw.id === workoutKey) : null),
    [scheduledWorkouts, workoutKey]
  );

  // Get the appropriate items based on type. For scheduled workouts use snapshot so setIds match store.
  const items = useMemo(() => {
    let result: WarmupItem[] = [];
    if (bonusLogId) {
      const bonusLog = bonusLogs.find(l => l.id === bonusLogId);
      if (bonusLog?.exercisePayload?.items) {
        result = bonusLog.exercisePayload.items.map(normalizeToDeprecated);
      }
    } else if (type === 'warmup') {
      const source = scheduledWorkout?.warmupSnapshot ?? template?.warmupItems ?? [];
      result = source.map((item: any) => normalizeToDeprecated(item));
    } else if (type === 'core') {
      const source = scheduledWorkout?.accessorySnapshot ?? template?.accessoryItems ?? [];
      result = source.map((item: any) => normalizeToDeprecated(item));
    } else if (type === 'main') {
      // Read from store so "add exercise" sees the update immediately (subscription can lag)
      const st = useStore.getState();
      const sw = st.scheduledWorkouts.find((w: { id: string }) => w.id === workoutKey);
      const t = st.workoutTemplates.find((t: { id: string }) => t.id === workoutTemplateId);
      const source = sw?.exercisesSnapshot ?? t?.items ?? [];
      result = source.map((item: any) => {
        const exercise = exercisesLibrary.find(ex => ex.id === item.exerciseId);
        const id = sw ? item.id : (item.exerciseId ?? item.id);
        return {
          id,
          exerciseId: item.exerciseId,
          exerciseName: exercise?.name || 'Exercise',
          sets: typeof item.sets === 'number' ? item.sets : (item.sets?.length ?? 0),
          reps: item.reps,
          weight: item.weight || 0,
          isTimeBased: item.isTimeBased ?? exercise?.measurementType === 'time' ?? false,
          isPerSide: item.isPerSide ?? false,
          cycleId: item.cycleId,
          cycleOrder: item.cycleOrder,
        } as WarmupItem;
      });
    }
    // Apply local time-based and per-side overrides
    result = result.map(item => {
      let out = item;
      if (timeBasedOverrides && item.id in timeBasedOverrides) {
        out = { ...out, isTimeBased: timeBasedOverrides[item.id] } as WarmupItem;
      }
      if (perSideOverrides && item.id in perSideOverrides) {
        out = { ...out, isPerSide: perSideOverrides[item.id] } as WarmupItem;
      }
      return out;
    });
    return result;
  }, [type, template, exercisesLibrary, refreshKey, timeBasedOverrides, perSideOverrides, scheduledWorkout]);
  
  // Group items into groups (supersets or single exercises)
  const exerciseGroups = useMemo(() => {
    const result: Array<{
      id: string;
      isCycle: boolean;
      cycleId?: string;
      totalRounds: number;
      exercises: Array<typeof items[0]>;
    }> = [];
    
    const cycleGroups: Record<string, typeof items> = {};
    const processedItems = new Set<string>();
    
    // Group items by cycle
    items.forEach(item => {
      if (item.cycleId) {
        if (!cycleGroups[item.cycleId]) {
          cycleGroups[item.cycleId] = [];
        }
        cycleGroups[item.cycleId].push(item);
      }
    });
    
    // Sort cycle groups by cycleOrder
    Object.keys(cycleGroups).forEach(cycleId => {
      cycleGroups[cycleId].sort((a, b) => (a.cycleOrder ?? 0) - (b.cycleOrder ?? 0));
    });
    
    // Process items in order
    items.forEach(item => {
      if (processedItems.has(item.id)) return;
      
      if (item.cycleId && cycleGroups[item.cycleId]) {
        // Create a single group for the entire cycle
        const cycleItems = cycleGroups[item.cycleId];
        const setCount = (i: typeof item) => typeof i.sets === 'number' ? i.sets : (Array.isArray(i.sets) ? i.sets.length : 0);
        const maxSets = Math.max(...cycleItems.map(setCount), 1);
        
        result.push({
          id: item.cycleId,
          isCycle: true,
          cycleId: item.cycleId,
          totalRounds: maxSets,
          exercises: cycleItems,
        });
        
        // Mark all items in this cycle as processed
        cycleItems.forEach(i => processedItems.add(i.id));
      } else if (!item.cycleId) {
        // Non-cycle item - single group with multiple rounds
        const rounds = typeof item.sets === 'number' ? item.sets : (Array.isArray(item.sets) ? item.sets.length : 0);
        result.push({
          id: item.id,
          isCycle: false,
          totalRounds: Math.max(rounds, 1),
          exercises: [item],
        });
        processedItems.add(item.id);
      }
    });
    
    console.log('📋 [ExerciseExecution] exerciseGroups built:', result.map(g => ({
      id: g.id,
      totalRounds: g.totalRounds,
      exerciseIds: g.exercises.map(e => e.id),
      setsType: g.exercises[0] ? (typeof g.exercises[0].sets === 'number' ? 'number' : Array.isArray(g.exercises[0].sets) ? 'array' : 'other') : 'n/a',
    })));
    return result;
  }, [items]);

  const progressionEnabled = settings.progressionSuggestionsEnabled !== false;
  const progressionValuesByItemId = useMemo(() => {
    if (!progressionEnabled || type !== 'main') return {};
    const map: Record<string, { weight: number; reps: number; weightDelta: number; repsDelta: number }> = {};
    items.forEach(item => {
      const libraryId = (item as any).exerciseId || item.id;
      if (!libraryId) return;
      const rule = getEffectiveProgressionRule(libraryId);
      if (!rule) return;
      const lastLog = getLastCompletedLogForExercise(libraryId);
      const setCount = typeof item.sets === 'number' ? item.sets : (Array.isArray(item.sets) ? item.sets.length : undefined);
      const suggestion = computeNextSuggestion(libraryId, rule, lastLog, setCount, item.id);
      if (suggestion && suggestion.source !== 'no_log' && lastLog && lastLog.workingSets.length > 0) {
        const lastWeight = lastLog.workingSets[0].weight;
        const lastReps = lastLog.workingSets[0].reps;
        map[item.id] = {
          weight: suggestion.suggestedWeight,
          reps: suggestion.suggestedRepsMin,
          weightDelta: suggestion.suggestedWeight - lastWeight,
          repsDelta: suggestion.suggestedRepsMin - lastReps,
        };
      }
    });
    return map;
  }, [items, progressionEnabled, type]);
  
  // State
  const [expandedGroupIndex, setExpandedGroupIndex] = useState(-1);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [hasLoggedAnySet, setHasLoggedAnySet] = useState(false);
  const [completionTimestamps, setCompletionTimestamps] = useState<Record<string, number>>({});

  // Derive completedSets directly from store so it can NEVER go out of sync
  const { warmupCompletionByKey, accessoryCompletionByKey } = useStore();
  const storeCompletionItems = useMemo(() => {
    if (type === 'warmup') return getWarmupCompletion(workoutKey, workoutTemplateId).completedItems;
    if (type === 'core') return getAccessoryCompletion(workoutKey, workoutTemplateId).completedItems;
    if (type === 'main') return getMainCompletion(workoutKey).completedItems;
    return [] as string[];
  }, [type, workoutKey, workoutTemplateId, scheduledWorkouts, warmupCompletionByKey, accessoryCompletionByKey]);

  const completedSets = useMemo(
    () => new Set(storeCompletionItems),
    [storeCompletionItems],
  );

  // Derive currentRounds from completedSets + exerciseGroups (always consistent)
  const currentRounds = useMemo(() => {
    const rounds: Record<string, number> = {};
    exerciseGroups.forEach(group => {
      let completedRoundCount = 0;
      for (let round = 0; round < group.totalRounds; round++) {
        const allDone = group.exercises.every(ex =>
          completedSets.has(`${ex.id}-set-${round}`),
        );
        if (allDone) completedRoundCount = round + 1;
        else break;
      }
      rounds[group.id] = completedRoundCount;
    });
    return rounds;
  }, [exerciseGroups, completedSets]);

  const [showAddExerciseDrawer, setShowAddExerciseDrawer] = useState(false);
  const exploreV2TimerBandProgress = useSharedValue(0);
  /** 1 while explore-v2 work timer surface is active — tints page + card rim blue vs rest orange */
  const exploreV2WorkBlueProgress = useSharedValue(0);
  /** Measured height of `exploreV2Root` — drives % split (stack vs timer) as pixel heights */
  const exploreV2RootHeight = useSharedValue(0);
  const executionMode: ExecutionMode = 'explore-v2';
  const [isExploreCompletedExpanded, setIsExploreCompletedExpanded] = useState(false);
  const [showExploreDetailSheet, setShowExploreDetailSheet] = useState(false);
  const [exploreDetailGroupIndex, setExploreDetailGroupIndex] = useState<number | null>(null);
  const [exploreDetailExerciseIndex, setExploreDetailExerciseIndex] = useState<number>(0);
  /** Explore: small bottom sheet editor for one set (not inline in the current card) */
  const [showExploreSetEditor, setShowExploreSetEditor] = useState(false);
  const [exploreSetEditorSetIndex, setExploreSetEditorSetIndex] = useState<number | null>(null);
  const [exploreEditDraft, setExploreEditDraft] = useState<{ weightStr: string; repsStr: string } | null>(null);
  const exploreEditDraftRef = useRef<{ weightStr: string; repsStr: string } | null>(null);
  const exploreEditPendingFocusRef = useRef<'weight' | 'reps'>('weight');
  const exploreEditWeightRef = useRef<TextInput>(null);
  const exploreEditRepsRef = useRef<TextInput>(null);
  const exploreEditActiveFieldRef = useRef<'weight' | 'reps'>('weight');
  const [showAllExploreHistory, setShowAllExploreHistory] = useState(false);

  // Staggered indicator animation using Animated.View (independent of LayoutAnimation)
  const indicatorWidthAnim = useRef(new Animated.Value(0)).current;
  const indicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (indicatorTimerRef.current) {
      clearTimeout(indicatorTimerRef.current);
      indicatorTimerRef.current = null;
    }

    // Instantly collapse the indicator (no animation)
    indicatorWidthAnim.setValue(0);

    if (expandedGroupIndex >= 0) {
      // Phase 2: after delay, indicator slides in from right
      indicatorTimerRef.current = setTimeout(() => {
        Animated.timing(indicatorWidthAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }, 250);
    }

    return () => {
      if (indicatorTimerRef.current) clearTimeout(indicatorTimerRef.current);
    };
  }, [expandedGroupIndex]);
  const [localValues, setLocalValuesState] = useState<Record<string, { weight: number; reps: number }>>({});
  const localValuesRef = useRef(localValues);
  localValuesRef.current = localValues;

  // Apply updates synchronously so localValuesRef matches handleComplete/saveSession in the same tap (hero blur is not guaranteed).
  const setLocalValues = useCallback((updater: React.SetStateAction<Record<string, { weight: number; reps: number }>>) => {
    if (typeof updater === 'function') {
      const next = updater(localValuesRef.current);
      localValuesRef.current = next;
      setLocalValuesState(next);
    } else {
      localValuesRef.current = updater;
      setLocalValuesState(updater);
    }
  }, []);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null); // Track session ID for updates
  const [showAdjustmentDrawer, setShowAdjustmentDrawer] = useState(false);
  const [expandedSetInDrawer, setExpandedSetInDrawer] = useState<number>(0); // Track which set is expanded in drawer
  const [drawerGroupIndex, setDrawerGroupIndex] = useState<number | null>(null); // Override group index for drawer (completed cards)
  const [drawerExerciseIndex, setDrawerExerciseIndex] = useState<number | null>(null); // Override exercise index for drawer (completed cards)
  const [showTimer, setShowTimer] = useState(false);
  const [isExerciseTimerPhase, setIsExerciseTimerPhase] = useState(false);
  
  // Inline rest timer state
  const [inlineRestActive, setInlineRestActive] = useState(false);
  const [inlineRestTimeLeft, setInlineRestTimeLeft] = useState(0);
  const [inlineRestTotal, setInlineRestTotal] = useState(0);
  const [inlineRestPaused, setInlineRestPaused] = useState(false);
  const [inlineRestIsLastSet, setInlineRestIsLastSet] = useState(false);
  /** Explore v2: time-based work + switch-sides use the same hero strip as rest (no bottom sheet). */
  const [inlineExploreWorkActive, setInlineExploreWorkActive] = useState(false);
  const [inlineExploreSwitchActive, setInlineExploreSwitchActive] = useState(false);
  const [inlineExploreWorkTimeLeft, setInlineExploreWorkTimeLeft] = useState(0);
  const [inlineExploreSwitchTimeLeft, setInlineExploreSwitchTimeLeft] = useState(0);
  const [inlineExploreWorkPaused, setInlineExploreWorkPaused] = useState(false);
  const [inlineExploreSwitchPaused, setInlineExploreSwitchPaused] = useState(false);
  const inlineRestEndTimeRef = useRef<number>(0);
  const inlineRestTotalMsRef = useRef<number>(0);
  const inlineExploreWorkEndRef = useRef(0);
  const inlineExploreWorkTotalMsRef = useRef(0);
  const inlineExploreWorkStartRef = useRef(0);
  const inlineExploreSwitchEndRef = useRef(0);
  const inlineExploreSwitchTotalMsRef = useRef(0);
  const inlineExploreSwitchStartRef = useRef(0);
  /** After first work leg of a per-side time-based exercise, true until `handleComplete` */
  const exploreWorkAwaitingSecondLegRef = useRef(false);
  const exploreWorkDurationSecRef = useRef(30);
  /** Which countdown owns the RAF/interval (rest | work | switch) */
  const exploreActiveCountdownRef = useRef<'rest' | 'work' | 'switch' | null>(null);
  const inlineRestProgress = useRef(new Animated.Value(1)).current;
  const restStagger = useRef({
    timerLabel: new Animated.Value(0),
    pauseIcon: new Animated.Value(0),
    skipIcon: new Animated.Value(0),
  }).current;
  const nextLabelAnim = useRef(new Animated.Value(0)).current;
  const buttonLabelOpacity = useRef(new Animated.Value(1)).current;
  const counterShrinkAnim = useRef(new Animated.Value(1)).current;
  const [showMenu, setShowMenu] = useState(false);
  const [showRestTimePicker, setShowRestTimePicker] = useState(false);
  const [localRestOverride, setLocalRestOverride] = useState<number | null>(null);
  const [showExerciseHistory, setShowExerciseHistory] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapSearchQuery, setSwapSearchQuery] = useState('');
  const [showExerciseSettingsMenu, setShowExerciseSettingsMenu] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  /** While rest UI collapses after skip — keep hero time from flashing 0:00 */
  const [exploreV2RestSkipDisplayHoldSec, setExploreV2RestSkipDisplayHoldSec] = useState<number | null>(null);
  const REST_TIMER_FRAC = EXPLORE_V2.layout.restTimerHeightFraction;
  const REST_STACK_FRAC = EXPLORE_V2.layout.restStackHeightFraction;

  const onExploreV2RootLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0) exploreV2RootHeight.value = h;
    },
    [exploreV2RootHeight],
  );

  const REST_EASE = ReanimatedEasing.bezier(...EXPLORE_V2.motion.rest.restTransitionEase);
  const REST_MS = EXPLORE_V2.motion.rest.colorMs;

  const exploreV2RestHeroBg = '#FFA424';
  const exploreV2TimerPageRestTint =
    appTheme.id === 'v2' ? appTheme.colors.accentPrimary : exploreV2RestHeroBg;
  /** Work / exercise timer phase — always themed `backgroundTimer` (v2: blue; other themes: default lime). */
  const exploreV2TimerPageWorkTint = appTheme.colors.backgroundTimer;

  useEffect(() => {
    if (executionMode !== 'explore-v2') return;
    const bandUp =
      inlineRestActive || inlineExploreWorkActive || inlineExploreSwitchActive;
    exploreV2TimerBandProgress.value = withTiming(bandUp ? 1 : 0, {
      duration: REST_MS,
      easing: REST_EASE,
    });
  }, [
    executionMode,
    inlineRestActive,
    inlineExploreWorkActive,
    inlineExploreSwitchActive,
  ]);

  useEffect(() => {
    if (executionMode !== 'explore-v2') return;
    exploreV2WorkBlueProgress.value = withTiming(inlineExploreWorkActive ? 1 : 0, {
      duration: REST_MS,
      easing: REST_EASE,
    });
  }, [executionMode, inlineExploreWorkActive]);

  /** Idle: timer 0%, stack 100%. Rest: timer `REST_TIMER_FRAC`, stack `REST_STACK_FRAC` of content height */
  const exploreV2TimerBandAnimatedStyle = useAnimatedStyle(() => {
    const measured = exploreV2RootHeight.value;
    const H = measured > 0 ? measured : screenHeight * 0.55;
    return {
      height: interpolate(exploreV2TimerBandProgress.value, [0, 1], [0, H * REST_TIMER_FRAC]),
      zIndex: 1,
    };
  }, [screenHeight, REST_TIMER_FRAC]);

  const exploreV2WalletBandAnimatedStyle = useAnimatedStyle(() => {
    const measured = exploreV2RootHeight.value;
    const H = measured > 0 ? measured : screenHeight * 0.55;
    return {
      height: interpolate(exploreV2TimerBandProgress.value, [0, 1], [H, H * REST_STACK_FRAC]),
      zIndex: 2,
    };
  }, [screenHeight, REST_STACK_FRAC]);

  const exploreV2PageBgAnimatedStyle = useAnimatedStyle(() => {
    const p = exploreV2TimerBandProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const activeTint = interpolateColor(w, [0, 1], [exploreV2TimerPageRestTint, exploreV2TimerPageWorkTint]);
    return {
      backgroundColor: interpolateColor(p, [0, 1], [EXPLORE_V2.colors.pageBg, activeTint]),
    };
  }, [exploreV2TimerPageRestTint, exploreV2TimerPageWorkTint]);

  const exploreV2ContentWrapBgAnimatedStyle = useAnimatedStyle(() => {
    const p = exploreV2TimerBandProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const activeTint = interpolateColor(w, [0, 1], [exploreV2TimerPageRestTint, exploreV2TimerPageWorkTint]);
    return {
      backgroundColor: interpolateColor(p, [0, 1], [EXPLORE_V2.colors.pageBg, activeTint]),
    };
  }, [exploreV2TimerPageRestTint, exploreV2TimerPageWorkTint]);
  const exploreV2HeaderInk = '#1F1F1F';
  const historyOpacity = useRef(new Animated.Value(0)).current;
  
  // Use refs to avoid stale closures in timer callbacks
  const completedSetsRef = useRef(completedSets);
  const currentRoundsRef = useRef(currentRounds);
  const activeExerciseIndexRef = useRef(activeExerciseIndex);
  /** Set when we open the exercise timer (time-based); cleared when timer onComplete runs. Used so we add the correct set even after handleComplete has updated other refs. */
  const pendingTimerSetRef = useRef<{ exerciseId: string; round: number } | null>(null);
  
  // Keep refs in sync with state
  useEffect(() => {
    completedSetsRef.current = completedSets;
    currentRoundsRef.current = currentRounds;
    activeExerciseIndexRef.current = activeExerciseIndex;
  }, [completedSets, currentRounds, activeExerciseIndex]);

  // Debug: log whenever expanded group changes (helps find unwanted collapse)
  const prevExpandedRef = useRef(expandedGroupIndex);
  useEffect(() => {
    if (prevExpandedRef.current !== expandedGroupIndex) {
      console.log('🔄 [ExerciseExecution] expandedGroupIndex changed:', prevExpandedRef.current, '→', expandedGroupIndex, expandedGroupIndex === -1 ? '(COLLAPSED)' : '');
      prevExpandedRef.current = expandedGroupIndex;
    }
  }, [expandedGroupIndex]);
  
  const runRestStaggerIn = useCallback(() => {
    // Immediately hide button label (no animation — avoids flash from render interruption)
    buttonLabelOpacity.setValue(0);
    nextLabelAnim.setValue(0);
    restStagger.timerLabel.setValue(0);
    restStagger.pauseIcon.setValue(0);
    restStagger.skipIcon.setValue(0);
    // Smooth width expansion for the "Next" label
    Animated.timing(nextLabelAnim, {
      toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
    // Delay stagger by one frame so React renders the correct timer value first
    requestAnimationFrame(() => {
      Animated.stagger(55, [
        Animated.timing(restStagger.timerLabel, {
          toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(restStagger.pauseIcon, {
          toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(restStagger.skipIcon, {
          toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ]).start();
    });
  }, [restStagger, nextLabelAnim, buttonLabelOpacity]);

  const runRestStaggerOut = useCallback((onDone: () => void) => {
    Animated.parallel([
      // Smooth width collapse for the "Next" label
      Animated.timing(nextLabelAnim, {
        toValue: 0, duration: 150, easing: Easing.in(Easing.cubic), useNativeDriver: false,
      }),
      // Reverse stagger for timer controls
      Animated.stagger(30, [
        Animated.timing(restStagger.skipIcon, {
          toValue: 0, duration: 100, useNativeDriver: true,
        }),
        Animated.timing(restStagger.pauseIcon, {
          toValue: 0, duration: 100, useNativeDriver: true,
        }),
        Animated.timing(restStagger.timerLabel, {
          toValue: 0, duration: 100, useNativeDriver: true,
        }),
      ]),
    ]).start(() => onDone());
  }, [restStagger, nextLabelAnim]);

  // Reset animated values and fade in button label when returning from rest timer.
  // useLayoutEffect runs before paint, preventing a frame where counter/button flash.
  const wasRestActiveRef = useRef(false);
  useLayoutEffect(() => {
    if (wasRestActiveRef.current && !inlineRestActive) {
      // Do not reset inlineRestProgress here — border exit animation uses current progress.
      // Progress is set to 1 only when starting a new rest (startInlineRest).
      counterShrinkAnim.setValue(1);
      buttonLabelOpacity.setValue(0);
      Animated.timing(buttonLabelOpacity, {
        toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true,
      }).start();
    }
    wasRestActiveRef.current = inlineRestActive;
  }, [inlineRestActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const REST_BORDER_INTRO_MS = 320;
  const restRafRef = useRef<number | null>(null);
  const restStartTimeRef = useRef<number>(0);

  // Inline rest / work / switch countdown: shared border progress (RAF) + 1s resolution completion.
  // Completion handlers use refs (wired after `handleComplete`) to avoid stale closures.
  const exploreCountdownOnRestDoneRef = useRef<() => void>(() => {});
  const exploreCountdownOnWorkDoneRef = useRef<() => void>(() => {});
  const exploreCountdownOnSwitchDoneRef = useRef<() => void>(() => {});

  useEffect(() => {
    const mode: 'rest' | 'work' | 'switch' | null =
      inlineExploreWorkActive && !inlineExploreWorkPaused
        ? 'work'
        : inlineExploreSwitchActive && !inlineExploreSwitchPaused
          ? 'switch'
          : inlineRestActive && !inlineRestPaused
            ? 'rest'
            : null;
    exploreActiveCountdownRef.current = mode;

    if (!mode) return;

    const tick = () => {
      const m = exploreActiveCountdownRef.current;
      if (!m) return;
      let totalMs = 0;
      let endTime = 0;
      let startTime = 0;
      if (m === 'work') {
        totalMs = inlineExploreWorkTotalMsRef.current;
        endTime = inlineExploreWorkEndRef.current;
        startTime = inlineExploreWorkStartRef.current;
      } else if (m === 'switch') {
        totalMs = inlineExploreSwitchTotalMsRef.current;
        endTime = inlineExploreSwitchEndRef.current;
        startTime = inlineExploreSwitchStartRef.current;
      } else {
        totalMs = inlineRestTotalMsRef.current;
        endTime = inlineRestEndTimeRef.current;
        startTime = restStartTimeRef.current;
      }
      if (totalMs <= 0) return;
      const now = Date.now();
      const elapsed = now - startTime;
      const timeLeft = Math.max(0, endTime - now);
      const progress =
        elapsed < REST_BORDER_INTRO_MS ? 1 : Math.min(1, timeLeft / totalMs);
      inlineRestProgress.setValue(progress);
      if (timeLeft > 0) restRafRef.current = requestAnimationFrame(tick);
    };
    restRafRef.current = requestAnimationFrame(tick);

    const interval = setInterval(() => {
      const m = exploreActiveCountdownRef.current;
      if (!m) return;
      let end = 0;
      if (m === 'work') end = inlineExploreWorkEndRef.current;
      else if (m === 'switch') end = inlineExploreSwitchEndRef.current;
      else end = inlineRestEndTimeRef.current;
      const timeLeft = Math.max(0, end - Date.now());
      const remainingSec = Math.max(0, Math.ceil(timeLeft / 1000));
      if (m === 'work') setInlineExploreWorkTimeLeft(remainingSec);
      else if (m === 'switch') setInlineExploreSwitchTimeLeft(remainingSec);
      else setInlineRestTimeLeft(remainingSec);

      if (remainingSec <= 0) {
        clearInterval(interval);
        if (restRafRef.current != null) {
          cancelAnimationFrame(restRafRef.current);
          restRafRef.current = null;
        }
        if (m === 'rest') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          runRestStaggerOut(() => exploreCountdownOnRestDoneRef.current());
        } else if (m === 'work') {
          exploreCountdownOnWorkDoneRef.current();
        } else {
          exploreCountdownOnSwitchDoneRef.current();
        }
      }
    }, 200);

    return () => {
      if (restRafRef.current != null) {
        cancelAnimationFrame(restRafRef.current);
        restRafRef.current = null;
      }
      clearInterval(interval);
    };
  }, [
    inlineRestActive,
    inlineRestPaused,
    inlineExploreWorkActive,
    inlineExploreWorkPaused,
    inlineExploreSwitchActive,
    inlineExploreSwitchPaused,
  ]);

  const localRestRef = useRef<number | null>(localRestOverride);
  localRestRef.current = localRestOverride;

  const startInlineRest = useCallback(() => {
    const restSeconds = localRestRef.current ?? settings.restTimerDefaultSeconds;
    const totalMs = restSeconds * 1000;
    restStartTimeRef.current = Date.now();
    setExploreV2RestSkipDisplayHoldSec(null);
    setInlineRestTotal(restSeconds);
    setInlineRestTimeLeft(restSeconds);
    setInlineRestPaused(false);
    inlineRestEndTimeRef.current = Date.now() + totalMs;
    inlineRestTotalMsRef.current = totalMs;
    setInlineRestActive(true);
    inlineRestProgress.setValue(1);
  }, [settings.restTimerDefaultSeconds]);

  const EXPLORE_V2_SWITCH_SIDES_SEC = 10;

  const startInlineExploreSwitch = useCallback(() => {
    const totalMs = EXPLORE_V2_SWITCH_SIDES_SEC * 1000;
    setInlineExploreWorkActive(false);
    inlineExploreSwitchStartRef.current = Date.now();
    setInlineExploreSwitchPaused(false);
    setInlineExploreSwitchTimeLeft(EXPLORE_V2_SWITCH_SIDES_SEC);
    inlineExploreSwitchEndRef.current = Date.now() + totalMs;
    inlineExploreSwitchTotalMsRef.current = totalMs;
    setInlineExploreSwitchActive(true);
    inlineRestProgress.setValue(1);
  }, []);

  const startInlineExploreWork = useCallback((durationSec: number) => {
    const sec = Math.max(1, Math.round(durationSec));
    const totalMs = sec * 1000;
    setInlineExploreSwitchActive(false);
    inlineExploreWorkStartRef.current = Date.now();
    setInlineExploreWorkPaused(false);
    setInlineExploreWorkTimeLeft(sec);
    inlineExploreWorkEndRef.current = Date.now() + totalMs;
    inlineExploreWorkTotalMsRef.current = totalMs;
    setInlineExploreWorkActive(true);
    inlineRestProgress.setValue(1);
  }, []);

  const inlineRestDismissAndAdvance = () => {
    setInlineRestActive(false);
    setInlineRestTimeLeft(0);
    setInlineRestPaused(false);
    const currentGroup = exerciseGroups[expandedGroupIndex];
    if (!currentGroup) return;
    const currentRound = currentRoundsRef.current[currentGroup.id] || 0;
    const currentCompletedSets = completedSetsRef.current;
    // With derived currentRounds, the round count may already reflect completion.
    // If currentRound >= totalRounds, the group is fully done.
    const allExercisesComplete = currentRound >= currentGroup.totalRounds ||
      currentGroup.exercises.every(ex => {
        const exSetId = `${ex.id}-set-${currentRound}`;
        return currentCompletedSets.has(exSetId);
      });
    advanceToNext(allExercisesComplete, currentCompletedSets);
  };

  const inlineRestDismissRef = useRef(inlineRestDismissAndAdvance);
  inlineRestDismissRef.current = inlineRestDismissAndAdvance;

  useEffect(() => {
    exploreCountdownOnRestDoneRef.current = () => {
      inlineRestDismissRef.current();
    };
  }, []);

  const handleInlineRestPauseToggle = () => {
    if (inlineRestPaused) {
      // Resume: extend endTime by remaining time only. Keep original totalMs so progress
      // stays continuous (border does not jump back to full).
      inlineRestEndTimeRef.current = Date.now() + inlineRestTimeLeft * 1000;
      setInlineRestPaused(false);
    } else {
      setInlineRestPaused(true);
    }
  };

  const handleInlineRestSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const end = inlineRestEndTimeRef.current;
    const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    setExploreV2RestSkipDisplayHoldSec(remaining);
    runRestStaggerOut(() => {
      inlineRestDismissRef.current();
      setTimeout(() => setExploreV2RestSkipDisplayHoldSec(null), REST_MS);
    });
  };

  /** Countdown from wall-clock end time so the hero never flashes 0:00 before the first tick */
  const exploreV2RestTimerDisplaySec = useMemo(() => {
    if (exploreV2RestSkipDisplayHoldSec !== null) return exploreV2RestSkipDisplayHoldSec;
    if (!inlineRestActive) return 0;
    if (inlineRestPaused) return inlineRestTimeLeft;
    const end = inlineRestEndTimeRef.current;
    if (end <= 0) return 0;
    return Math.max(0, Math.ceil((end - Date.now()) / 1000));
  }, [exploreV2RestSkipDisplayHoldSec, inlineRestActive, inlineRestPaused, inlineRestTimeLeft]);

  const exploreV2HeroTimerDisplaySec = useMemo(() => {
    if (inlineExploreWorkActive) {
      if (inlineExploreWorkPaused) return inlineExploreWorkTimeLeft;
      const end = inlineExploreWorkEndRef.current;
      if (end <= 0) return 0;
      return Math.max(0, Math.ceil((end - Date.now()) / 1000));
    }
    if (inlineExploreSwitchActive) {
      if (inlineExploreSwitchPaused) return inlineExploreSwitchTimeLeft;
      const end = inlineExploreSwitchEndRef.current;
      if (end <= 0) return 0;
      return Math.max(0, Math.ceil((end - Date.now()) / 1000));
    }
    return exploreV2RestTimerDisplaySec;
  }, [
    inlineExploreWorkActive,
    inlineExploreWorkPaused,
    inlineExploreWorkTimeLeft,
    inlineExploreSwitchActive,
    inlineExploreSwitchPaused,
    inlineExploreSwitchTimeLeft,
    exploreV2RestTimerDisplaySec,
  ]);

  const exploreV2TimerPhase = useMemo(() => {
    if (executionMode !== 'explore-v2') return 'none' as const;
    if (inlineRestActive) return 'rest' as const;
    if (inlineExploreSwitchActive) return 'switchSides' as const;
    if (inlineExploreWorkActive) return 'work' as const;
    return 'none' as const;
  }, [
    executionMode,
    inlineRestActive,
    inlineExploreSwitchActive,
    inlineExploreWorkActive,
  ]);

  const exploreV2TimerContextLabel = useMemo(() => {
    if (executionMode !== 'explore-v2') return null;
    if (inlineRestActive) return t('exploreV2TimerLabelRest');
    if (inlineExploreSwitchActive) return t('exploreV2TimerLabelSwitchSides');
    if (inlineExploreWorkActive) {
      const group = exerciseGroups[expandedGroupIndex];
      const ex = group?.exercises[activeExerciseIndex];
      if (!ex?.isPerSide) return null;
      return exploreWorkAwaitingSecondLegRef.current
        ? t('exploreV2TimerLabelRightSide')
        : t('exploreV2TimerLabelLeftSide');
    }
    return null;
  }, [
    executionMode,
    t,
    inlineRestActive,
    inlineExploreSwitchActive,
    inlineExploreWorkActive,
    expandedGroupIndex,
    exerciseGroups,
    activeExerciseIndex,
  ]);

  const handleExploreV2HeroPauseToggle = () => {
    if (inlineExploreWorkActive) {
      if (inlineExploreWorkPaused) {
        inlineExploreWorkEndRef.current = Date.now() + inlineExploreWorkTimeLeft * 1000;
        setInlineExploreWorkPaused(false);
      } else {
        setInlineExploreWorkPaused(true);
      }
      return;
    }
    if (inlineExploreSwitchActive) {
      if (inlineExploreSwitchPaused) {
        inlineExploreSwitchEndRef.current = Date.now() + inlineExploreSwitchTimeLeft * 1000;
        setInlineExploreSwitchPaused(false);
      } else {
        setInlineExploreSwitchPaused(true);
      }
      return;
    }
    handleInlineRestPauseToggle();
  };

  // Track keyboard visibility for in-drawer Save button
  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Save session on unmount to ensure progress persists when user navigates away
  useEffect(() => {
    return () => {
      const currentSets = completedSetsRef.current;
      if (currentSets.size > 0) {
        console.log('💾 Auto-saving session on unmount:', currentSets.size, 'completed sets');
        saveSession(currentSets);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate history visibility
  useEffect(() => {
    Animated.timing(historyOpacity, {
      toValue: showExerciseHistory ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showExerciseHistory]);
  
  // Sort groups: completed first (by completion order), then active, then remaining
  const sortedExerciseGroups = useMemo(() => {
    const groupsWithInfo = exerciseGroups.map((group, index) => {
      const currentRound = currentRounds[group.id] || 0;
      // Don't treat the active group as "completed" while its rest timer is running —
      // otherwise it jumps to the top mid-timer and snaps back when done
      const isActiveWithTimer =
        (inlineRestActive || inlineExploreWorkActive || inlineExploreSwitchActive) &&
        index === expandedGroupIndex;
      const isCompleted = currentRound >= group.totalRounds && !isActiveWithTimer;
      const completionTime = completionTimestamps[group.id] || 0;
      return { group, index, isCompleted, completionTime };
    });
    
    // Separate into completed and incomplete
    const completed = groupsWithInfo.filter(g => g.isCompleted);
    const incomplete = groupsWithInfo.filter(g => !g.isCompleted);
    
    // Sort completed by completion time
    completed.sort((a, b) => a.completionTime - b.completionTime);
    
    // For incomplete, put active group first (only after logging first set)
    let sortedIncomplete = incomplete;
    if (hasLoggedAnySet && expandedGroupIndex >= 0) {
      const activeGroup = incomplete.find(g => g.index === expandedGroupIndex);
      const others = incomplete.filter(g => g.index !== expandedGroupIndex);
      sortedIncomplete = activeGroup ? [activeGroup, ...others] : incomplete;
    }
    
    // Combine: completed first, then incomplete
    return [...completed.map(g => g.group), ...sortedIncomplete.map(g => g.group)];
  }, [
    exerciseGroups,
    expandedGroupIndex,
    hasLoggedAnySet,
    currentRounds,
    completionTimestamps,
    inlineRestActive,
    inlineExploreWorkActive,
    inlineExploreSwitchActive,
  ]);
  
  // Map to track original indices for group IDs
  const groupIdToOriginalIndex = useMemo(() => {
    const map = new Map<string, number>();
    exerciseGroups.forEach((group, index) => {
      map.set(group.id, index);
    });
    return map;
  }, [exerciseGroups]);
  
  // Initialize local values at set level (merge, don't overwrite restored session values).
  // When progression is enabled, use the progression-adjusted weight/reps so every
  // render path (card, drawer, save) sees the updated values from the start.
  useEffect(() => {
    if (exerciseGroups.length === 0) return;
    setLocalValues(prev => {
      const merged = { ...prev };
      exerciseGroups.forEach(group => {
        group.exercises.forEach(exercise => {
          const prog = progressionValuesByItemId[exercise.id];
          for (let round = 0; round < group.totalRounds; round++) {
            const setId = `${exercise.id}-set-${round}`;
            if (!merged[setId]) {
              merged[setId] = {
                weight: prog?.weight ?? exercise.weight ?? 0,
                reps: prog?.reps ?? Number(exercise.reps) ?? 0,
              };
            }
          }
        });
      });
      return merged;
    });
  }, [exerciseGroups, progressionValuesByItemId]);
  
  // Initialize UI state on mount (expandedGroupIndex, hasLoggedAnySet, localValues, sessionId)
  // completedSets and currentRounds are derived from the store, so we only need to set UI state here
  const hasInitializedUIRef = useRef(false);
  useEffect(() => {
    if (exerciseGroups.length === 0) return;
    if (hasInitializedUIRef.current) return;
    hasInitializedUIRef.current = true;

    if (completedSets.size > 0) {
      setHasLoggedAnySet(true);

      // Find the last group with any progress (where user was working)
      let lastActiveGroupIndex = -1;
      exerciseGroups.forEach((group, idx) => {
        const hasAnyProgress = group.exercises.some(ex => {
          for (let round = 0; round < group.totalRounds; round++) {
            if (completedSets.has(`${ex.id}-set-${round}`)) return true;
          }
          return false;
        });
        if (hasAnyProgress) lastActiveGroupIndex = idx;
      });

      if (lastActiveGroupIndex >= 0) {
        const lastActiveRounds = currentRounds[exerciseGroups[lastActiveGroupIndex].id] || 0;
        const lastActiveTotal = exerciseGroups[lastActiveGroupIndex].totalRounds;

        if (lastActiveRounds >= lastActiveTotal) {
          let nextIncomplete = exerciseGroups.findIndex((group, idx) => {
            if (idx <= lastActiveGroupIndex) return false;
            return (currentRounds[group.id] || 0) < group.totalRounds;
          });
          if (nextIncomplete < 0) {
            nextIncomplete = exerciseGroups.findIndex((group, idx) => {
              if (idx >= lastActiveGroupIndex) return false;
              return (currentRounds[group.id] || 0) < group.totalRounds;
            });
          }
          setExpandedGroupIndex(nextIncomplete >= 0 ? nextIncomplete : lastActiveGroupIndex);
        } else {
          setExpandedGroupIndex(lastActiveGroupIndex);
        }
      } else {
        setExpandedGroupIndex(executionMode === 'explore-v2' ? -1 : 0);
      }
    } else {
      // Explore v2: no group is "current" until the user picks from Up Next or logs progress.
      setExpandedGroupIndex(executionMode === 'explore-v2' ? -1 : 0);
    }

    // Restore localValues: prefer session (source of truth for edits) then detailedWorkoutProgress
    const restoredValues: Record<string, { weight: number; reps: number }> = {};

    const allSessions = useStore.getState().sessions;
    const existingSession = allSessions.find(s =>
      (s as any).workoutKey === workoutKey
    ) || allSessions.find(s => {
      const dateMatch = workoutKey?.match(/(\d{4}-\d{2}-\d{2})/);
      const sessionDate = dateMatch ? dateMatch[1] : null;
      return s.workoutTemplateId === workoutTemplateId && sessionDate && s.date === sessionDate;
    });

    if (existingSession) {
      setCurrentSessionId(existingSession.id);
      existingSession.sets.forEach((set: any) => {
        exerciseGroups.forEach(group => {
          group.exercises.forEach(ex => {
            const exerciseIdToMatch = ex.exerciseId || ex.id;
            if (set.exerciseId === exerciseIdToMatch || set.exerciseId === ex.id) {
              const setId = `${ex.id}-set-${set.setIndex}`;
              restoredValues[setId] = { weight: set.weight, reps: set.reps };
            }
          });
        });
      });
    }

    const progressData = getDetailedWorkoutProgress();
    if (workoutKey && progressData[workoutKey]) {
      const workoutProgress = progressData[workoutKey];
      const freshTemplate = useStore.getState().workoutTemplates.find(t => t.id === workoutTemplateId);

      Object.entries(workoutProgress.exercises).forEach(([templateExId, exProgress]) => {
        const templateEx = (freshTemplate?.items || (freshTemplate as any)?.exercises)?.find((ex: any) => ex.id === templateExId);
        const libExId = templateEx?.exerciseId || templateExId;

        exerciseGroups.forEach(group => {
          group.exercises.forEach(ex => {
            if (ex.id === libExId || ex.id === templateExId) {
              (exProgress as any).sets?.forEach((s: any) => {
                if (s.completed) {
                  const setId = `${ex.id}-set-${s.setNumber}`;
                  if (!restoredValues[setId]) {
                    restoredValues[setId] = { weight: s.weight, reps: s.reps };
                  }
                }
              });
            }
          });
        });
      });
    }

    if (Object.keys(restoredValues).length > 0) {
      setLocalValues(prev => ({ ...prev, ...restoredValues }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseGroups, completedSets, currentRounds]);
  
  // Auto-set active exercise when expanding a group
  useEffect(() => {
    if (expandedGroupIndex >= 0 && exerciseGroups[expandedGroupIndex]) {
      const group = exerciseGroups[expandedGroupIndex];
      const currentRound = currentRounds[group.id] || 0;
      
      console.log('🔄 useEffect triggered:', {
        hasLoggedAnySet,
        expandedGroupIndex,
        groupId: group.id,
        currentRound,
        completedSetsCount: completedSets.size,
      });
      
      if (hasLoggedAnySet) {
        // After logging: find first incomplete exercise in current round
        let firstIncompleteExIdx = 0;
        for (let exIdx = 0; exIdx < group.exercises.length; exIdx++) {
          const exercise = group.exercises[exIdx];
          const setId = `${exercise.id}-set-${currentRound}`;
          if (!completedSets.has(setId)) {
            firstIncompleteExIdx = exIdx;
            break;
          }
        }
        console.log('🔄 Auto-selecting exercise (after logging):', firstIncompleteExIdx);
        setActiveExerciseIndex(firstIncompleteExIdx);
      } else {
        // Before logging: activate first exercise in expanded group
        console.log('🔄 Setting to first exercise (before logging)');
        setActiveExerciseIndex(0);
      }
    }
  }, [hasLoggedAnySet, expandedGroupIndex, exerciseGroups, currentRounds, completedSets]);
  
  // Check if ALL sections of the workout are complete (warmup, main, accessories)
  const isEntireWorkoutComplete = () => {
    const warmupCompletion = getWarmupCompletion(workoutKey);
    const mainCompletion = getMainCompletion(workoutKey);
    const accessoryCompletion = getAccessoryCompletion(workoutKey);
    
    // A section is "done" if it has no items OR if its percentage is 100%
    const warmupDone = warmupCompletion.totalItems === 0 || warmupCompletion.percentage >= 100;
    const mainDone = mainCompletion.totalItems === 0 || mainCompletion.percentage >= 100;
    const accessoryDone = accessoryCompletion.totalItems === 0 || accessoryCompletion.percentage >= 100;
    
    console.log('🔍 Checking entire workout completion:', {
      warmup: { total: warmupCompletion.totalItems, pct: warmupCompletion.percentage, done: warmupDone },
      main: { total: mainCompletion.totalItems, pct: mainCompletion.percentage, done: mainDone },
      accessory: { total: accessoryCompletion.totalItems, pct: accessoryCompletion.percentage, done: accessoryDone },
    });
    
    return warmupDone && mainDone && accessoryDone;
  };

  // Check if all exercise groups in the current section are complete
  const allCurrentGroupsComplete = useMemo(() => {
    if (exerciseGroups.length === 0) return false;
    return exerciseGroups.every(group => {
      const rounds = currentRounds[group.id] || 0;
      return rounds >= group.totalRounds;
    });
  }, [exerciseGroups, currentRounds]);

  const exploreCurrentGroupIndex = useMemo(() => {
    if (expandedGroupIndex < 0) return null;
    const group = exerciseGroups[expandedGroupIndex];
    if (!group) return null;
    const completedRounds = currentRounds[group.id] || 0;
    if (completedRounds >= group.totalRounds) return null;
    // Explore v1: "current" only exists after at least one set is logged
    if (executionMode === 'explore' && completedSets.size === 0) return null;
    return expandedGroupIndex;
  }, [
    executionMode,
    completedSets.size,
    expandedGroupIndex,
    exerciseGroups,
    currentRounds,
  ]);

  const hasCurrentExercise = executionMode === 'explore' && exploreCurrentGroupIndex !== null;
  const hasExploreV2CurrentExercise = executionMode === 'explore-v2' && exploreCurrentGroupIndex !== null;

  const exploreV2CurrentGroupHasLoggedSets = useMemo(() => {
    if (executionMode !== 'explore-v2') return false;
    if (exploreCurrentGroupIndex === null) return false;
    const g = exerciseGroups[exploreCurrentGroupIndex];
    if (!g) return false;
    for (let r = 0; r < g.totalRounds; r++) {
      for (const ex of g.exercises) {
        if (completedSets.has(`${ex.id}-set-${r}`)) return true;
      }
    }
    return false;
  }, [executionMode, exploreCurrentGroupIndex, exerciseGroups, completedSets]);
  const currentExercise = hasCurrentExercise && exploreCurrentGroupIndex !== null
    ? exerciseGroups[exploreCurrentGroupIndex]
    : null;

  const completedExerciseIndexes = useMemo(() => {
    return exerciseGroups
      .map((group, index) => ({ group, index }))
      .filter(({ group }) => (currentRounds[group.id] || 0) >= group.totalRounds)
      .sort((a, b) => {
        const aTime = completionTimestamps[a.group.id] ?? Number.MAX_SAFE_INTEGER;
        const bTime = completionTimestamps[b.group.id] ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })
      .map(({ index }) => index);
  }, [exerciseGroups, currentRounds, completionTimestamps]);

  const upNextExercises = useMemo(() => {
    return exerciseGroups
      .map((group, index) => ({ group, index }))
      .filter(({ group, index }) => {
        const completedRounds = currentRounds[group.id] || 0;
        const isCompleted = completedRounds >= group.totalRounds;
        if (isCompleted) return false;
        // Explore v2 rule: keep selected Current in Up Next until first set is actually logged.
        // Only remove Current from queue after there is logged progress.
        if (
          exploreCurrentGroupIndex !== null &&
          index === exploreCurrentGroupIndex &&
          (executionMode !== 'explore-v2' || exploreV2CurrentGroupHasLoggedSets)
        ) {
          return false;
        }
        return true;
      })
      .map(({ index }) => index);
  }, [
    exerciseGroups,
    currentRounds,
    exploreCurrentGroupIndex,
    executionMode,
    exploreV2CurrentGroupHasLoggedSets,
  ]);

  const isExplorePreStart = executionMode === 'explore' && completedSets.size === 0;
  const isExploreWorkoutComplete = executionMode === 'explore' && allCurrentGroupsComplete;
  const isExploreV2WorkoutComplete = executionMode === 'explore-v2' && allCurrentGroupsComplete;

  const canExpandExercise = useCallback((groupIndex: number) => {
    if (executionMode !== 'explore') return true;
    if (!hasCurrentExercise) return true;
    return groupIndex === exploreCurrentGroupIndex;
  }, [executionMode, hasCurrentExercise, exploreCurrentGroupIndex]);

  const canShowPrimaryCTA = useCallback((groupIndex: number) => {
    if (executionMode !== 'explore') return false;
    if (expandedGroupIndex !== groupIndex) return false;
    const group = exerciseGroups[groupIndex];
    if (!group) return false;
    const completedRounds = currentRounds[group.id] || 0;
    if (completedRounds >= group.totalRounds) return false;
    if (hasCurrentExercise) return groupIndex === exploreCurrentGroupIndex;
    return true;
  }, [
    executionMode,
    expandedGroupIndex,
    exerciseGroups,
    currentRounds,
    hasCurrentExercise,
    exploreCurrentGroupIndex,
  ]);

  const canShowPrimaryCTAExploreV2 = useCallback(
    (groupIndex: number) => {
      if (executionMode !== 'explore-v2') return false;
      if (exploreCurrentGroupIndex === null) return false;
      if (expandedGroupIndex !== groupIndex) return false;
      const group = exerciseGroups[groupIndex];
      if (!group) return false;
      const completedRounds = currentRounds[group.id] || 0;
      if (completedRounds >= group.totalRounds) return false;
      return groupIndex === exploreCurrentGroupIndex;
    },
    [
      executionMode,
      expandedGroupIndex,
      exerciseGroups,
      currentRounds,
      exploreCurrentGroupIndex,
    ],
  );

  const exploreV2FrontGroupIndex = useMemo(() => {
    if (executionMode !== 'explore-v2') return null;
    if (allCurrentGroupsComplete) return null;
    return exploreCurrentGroupIndex;
  }, [executionMode, allCurrentGroupsComplete, exploreCurrentGroupIndex]);

  /** Group + active exercise on Explore execution page — source of truth for inline sets/editing */
  const exploreExecutionEditTarget = useMemo(() => {
    if (executionMode !== 'explore' && executionMode !== 'explore-v2') return null;
    let groupIndex: number | null = null;
    if (executionMode === 'explore') {
      if (exploreCurrentGroupIndex === null) return null;
      groupIndex = exploreCurrentGroupIndex;
    } else {
      // Explore v2: no implicit "current" from Up Next — only when a group is selected as Current
      if (exploreCurrentGroupIndex !== null) {
        groupIndex = exploreCurrentGroupIndex;
      } else if (!allCurrentGroupsComplete && executionMode === 'explore') {
        groupIndex = upNextExercises[0] ?? null;
      }
    }
    if (groupIndex === null) return null;
    const g = exerciseGroups[groupIndex];
    if (!g?.exercises?.length) return null;
    const exIdx = Math.min(Math.max(0, activeExerciseIndex), g.exercises.length - 1);
    const exercise = g.exercises[exIdx];
    if (!exercise) return null;
    return { group: g, exercise, exerciseIndex: exIdx };
  }, [executionMode, exploreCurrentGroupIndex, exerciseGroups, activeExerciseIndex, allCurrentGroupsComplete, upNextExercises]);

  useEffect(() => {
    if (executionMode !== 'explore') return;
    if (isExploreWorkoutComplete || hasCurrentExercise) return;
    if (expandedGroupIndex >= 0) return;
    const firstUpNext = upNextExercises[0];
    if (firstUpNext !== undefined) {
      setExpandedGroupIndex(firstUpNext);
      setActiveExerciseIndex(0);
    }
  }, [
    executionMode,
    isExploreWorkoutComplete,
    hasCurrentExercise,
    expandedGroupIndex,
    upNextExercises,
  ]);

  // Explore v2: entry state is Up Next only — do not auto-expand a "current" group (user selects from Up Next).

  const prevExecutionModeRef = useRef(executionMode);
  useEffect(() => {
    if (executionMode === 'explore-v2' && prevExecutionModeRef.current !== 'explore-v2') {
      setExpandedGroupIndex(-1);
      setActiveExerciseIndex(0);
    }
    prevExecutionModeRef.current = executionMode;
  }, [executionMode]);

  useEffect(() => {
    if (executionMode === 'explore' || executionMode === 'explore-v2') return;
    setShowExploreDetailSheet(false);
    setExploreDetailGroupIndex(null);
  }, [executionMode]);

  // Handler for adding a new exercise to the workout template
  const handleAddExercise = async (exerciseId: string, exerciseName: string) => {
    if (!template) return;

    // Use current list from store (snapshot if scheduled, else template) so we append to what's actually shown
    const st = useStore.getState();
    const sw = st.scheduledWorkouts.find((w: { id: string }) => w.id === workoutKey);
    const currentItems = (sw?.exercisesSnapshot ?? st.workoutTemplates.find((t: { id: string }) => t.id === workoutTemplateId)?.items) ?? template.items;

    const newItem: WorkoutTemplateExercise = {
      id: `${exerciseId}-${Date.now()}`,
      exerciseId,
      order: currentItems.length,
      sets: 3,
      reps: 10,
      weight: 0,
    };

    const updatedItems = [...currentItems, newItem];
    await updateWorkoutTemplate(workoutTemplateId, { items: updatedItems });
    if (scheduledWorkout) {
      await updateScheduledWorkoutSnapshots(workoutKey, { exercisesSnapshot: updatedItems });
    }
    setShowAddExerciseDrawer(false);
    // Force re-render after store and DOM tick so useMemo sees updated getState()
    requestAnimationFrame(() => {
      setRefreshKey(prev => prev + 1);
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Display values: in-session edits first (weight, reps, and time-as-reps), then persisted data, then template.
  const progressionValuesRef = useRef(progressionValuesByItemId);
  progressionValuesRef.current = progressionValuesByItemId;

  const getSetDisplayValues = useCallback((exerciseId: string, setIndex: number, templateWeight: number, templateReps: number) => {
    const setId = `${exerciseId}-set-${setIndex}`;

    // 1. Current session edits (must win over stale progress so Completed card matches what the user entered)
    const lv = localValuesRef.current[setId];
    if (lv) return lv;

    // Session rows use library exercise id (exercise.exerciseId || exercise.id), not always template item id
    const groupExercise = exerciseGroups.flatMap(g => g.exercises).find(ex => ex.id === exerciseId);
    const sessionExerciseId = groupExercise ? (groupExercise.exerciseId || groupExercise.id) : exerciseId;

    // 2. Already-completed sets in THIS workout (persisted progress; template item id is the key)
    const progressData = getDetailedWorkoutProgress();
    if (workoutKey && progressData[workoutKey]) {
      const workoutProgress = progressData[workoutKey];
      for (const [templateExId, exProgress] of Object.entries(workoutProgress.exercises)) {
        if (templateExId !== exerciseId) continue;
        const matchingSet = (exProgress as any).sets?.find((s: any) => s.setNumber === setIndex && s.completed);
        if (matchingSet) {
          return { weight: matchingSet.weight, reps: matchingSet.reps };
        }
      }
    }

    // 3. Session data for THIS workout
    const allSessions = useStore.getState().sessions;
    const session = allSessions.find(s => (s as any).workoutKey === workoutKey)
      || allSessions.find(s => {
        const dm = workoutKey?.match(/(\d{4}-\d{2}-\d{2})/);
        const sd = dm ? dm[1] : null;
        return s.workoutTemplateId === workoutTemplateId && sd && s.date === sd;
      });
    if (session) {
      const match = session.sets.find(
        s =>
          s.setIndex === setIndex &&
          (s.exerciseId === sessionExerciseId || s.exerciseId === exerciseId),
      );
      if (match) return { weight: match.weight, reps: match.reps };
    }

    // 4. Auto-progression values (computed from last log + rules)
    const prog = progressionValuesRef.current[exerciseId];
    if (prog) return { weight: prog.weight, reps: prog.reps };

    // 5. Template defaults (reps = count or seconds when time-based)
    const tr = Number(templateReps);
    return { weight: templateWeight, reps: Number.isFinite(tr) ? tr : 0 };
  }, [workoutKey, workoutTemplateId, exerciseGroups]);

  const saveSession = async (completedSetIds?: Set<string>) => {
    console.log('💾 Saving workout session for', type, 'section');
    console.log('   workoutTemplateId:', workoutTemplateId);
    console.log('   workoutKey:', workoutKey);
    
    // Use provided completedSetIds or fall back to state
    const setsToSave = completedSetIds || completedSets;
    console.log('   Total sets to check:', setsToSave.size);
    
    // Use existing session ID or create a new one (only once per workout)
    const sessionId = currentSessionId || Date.now().toString();
    const isUpdate = !!currentSessionId;
    
    // Collect all completed sets for the session
    const allSets: any[] = [];
    
    exerciseGroups.forEach(group => {
      group.exercises.forEach(exercise => {
        for (let round = 0; round < group.totalRounds; round++) {
          const setId = `${exercise.id}-set-${round}`;
          
          // Only include completed sets
          if (setsToSave.has(setId)) {
            // Read from ref to always get the latest values (avoids stale closure)
            const setValues = localValuesRef.current[setId];
            const weight = setValues?.weight ?? exercise.weight ?? 0;
            const reps = setValues?.reps ?? exercise.reps ?? 0;
            
            const exerciseIdToUse = exercise.exerciseId || exercise.id;
            
            console.log(`   Adding set: ${exerciseIdToUse} - ${weight}${useKg ? 'kg' : 'lb'} x ${reps}`);
            
            allSets.push({
              id: `${sessionId}-${exercise.id}-${round}`,
              sessionId,
              exerciseId: exerciseIdToUse,
              setIndex: round,
              weight,
              reps,
              isCompleted: true,
            });
          }
        }
      });
    });
    
    console.log(`   Collected ${allSets.length} completed sets`);
    
    // Only create/update a session if there are completed sets
    if (allSets.length > 0) {
      // Extract the scheduled date from workoutKey (format: sw-{planId}-{YYYY-MM-DD})
      // Fall back to today's date if workoutKey doesn't contain a date
      const dateMatch = workoutKey?.match(/(\d{4}-\d{2}-\d{2})/);
      const sessionDate = dateMatch ? dateMatch[1] : dayjs().format('YYYY-MM-DD');
      
      const session = {
        id: sessionId,
        workoutTemplateId,
        workoutKey: workoutKey || '',
        date: sessionDate,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        sets: allSets,
      };
      
      if (isUpdate) {
        console.log('💾 Updating existing session:', sessionId);
        await updateSession(sessionId, session);
        console.log('✅ Session updated successfully!');
      } else {
        console.log('💾 Creating new session:', sessionId);
        setCurrentSessionId(sessionId);
        await addSession(session);
        console.log('✅ Session created successfully!');
      }

      // Keep detailedWorkoutProgress in sync so history and display use updated values
      if (workoutKey && type === 'main') {
        const byTemplateId = new Map<string, { exerciseId: string; sets: Array<{ setNumber: number; weight: number; reps: number; completed: boolean }> }>();
        allSets.forEach((set: any) => {
          const templateEx = exerciseGroups.flatMap(g => g.exercises).find(ex =>
            (ex.exerciseId || ex.id) === set.exerciseId || ex.id === set.exerciseId
          );
          const templateItemId = templateEx?.id ?? set.exerciseId;
          if (!byTemplateId.has(templateItemId)) {
            byTemplateId.set(templateItemId, { exerciseId: set.exerciseId, sets: [] });
          }
          const entry = byTemplateId.get(templateItemId)!;
          entry.sets.push({
            setNumber: set.setIndex,
            weight: set.weight,
            reps: set.reps,
            completed: true,
          });
        });
        for (const [templateItemId, { exerciseId, sets }] of byTemplateId) {
          sets.sort((a, b) => a.setNumber - b.setNumber);
          await saveExerciseProgress(workoutKey, templateItemId, { exerciseId, sets });
        }
      }
    } else {
      console.log('⚠️ No completed sets to save - session not created');
    }
  };
  
  const handleComplete = async () => {
    if (expandedGroupIndex < 0) return;

    exploreWorkAwaitingSecondLegRef.current = false;
    setInlineExploreWorkActive(false);
    setInlineExploreSwitchActive(false);
    setInlineExploreWorkPaused(false);
    setInlineExploreSwitchPaused(false);

    const currentGroup = exerciseGroups[expandedGroupIndex];
    const currentRound = currentRounds[currentGroup.id] || 0;
    // Use ref so we always have the latest index (e.g. after advancing within same round in superset)
    const exerciseIndex = activeExerciseIndexRef.current;
    const currentExercise = currentGroup.exercises[exerciseIndex] ?? currentGroup.exercises[activeExerciseIndex];
    
    console.log('🎯 handleComplete called:', {
      expandedGroupIndex,
      activeExerciseIndex,
      exerciseIndexRef: exerciseIndex,
      groupId: currentGroup.id,
      currentRound,
      exerciseName: currentExercise?.exerciseName,
      exerciseId: currentExercise?.id,
    });
    
    if (!currentExercise) {
      console.log('❌ No current exercise!');
      return;
    }
    
    if (!hasLoggedAnySet) setHasLoggedAnySet(true);
    
    const setId = `${currentExercise.id}-set-${currentRound}`;

    // Build newCompletedSets synchronously for immediate logic checks
    const newCompletedSets = new Set(completedSets);
    newCompletedSets.add(setId);
    
    // Check if all exercises in this round are complete
    const allExercisesComplete = currentGroup.exercises.every(ex => {
      const exSetId = `${ex.id}-set-${currentRound}`;
      return newCompletedSets.has(exSetId);
    });
    
    const isLastGroup = expandedGroupIndex === exerciseGroups.length - 1;
    const isLastRound = currentRound + 1 >= currentGroup.totalRounds;
    const isLastExercise = activeExerciseIndex === currentGroup.exercises.length - 1;
    const isVeryLastSet = isLastGroup && isLastRound && (allExercisesComplete || isLastExercise);
    
    // Start the rest timer BEFORE any await — this ensures inlineRestActive is true
    // when the store update triggers a re-render, preventing the action row from hiding
    if (type === 'main' && !isVeryLastSet) {
      const nextRoundAfterRest = allExercisesComplete ? currentRound + 1 : currentRound;
      const nextRoundIsLast = nextRoundAfterRest + 1 >= currentGroup.totalRounds;
      const nextExAfterRest = allExercisesComplete ? 0 : activeExerciseIndex + 1;
      const nextExIsLast = nextExAfterRest >= currentGroup.exercises.length - 1;
      setInlineRestIsLastSet(isLastGroup && nextRoundIsLast && nextExIsLast);
      if (currentExercise.isTimeBased) {
        if (executionMode === 'explore-v2') {
          counterShrinkAnim.setValue(1);
          startInlineRest();
          runRestStaggerIn();
          if (allExercisesComplete && isLastRound) {
            nextLabelAnim.setValue(0);
            requestAnimationFrame(() => {
              Animated.timing(counterShrinkAnim, {
                toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: false,
              }).start();
            });
          }
        } else {
          setIsExerciseTimerPhase(false);
          setShowTimer(true);
        }
      } else {
        counterShrinkAnim.setValue(1);
        startInlineRest();
        runRestStaggerIn();
        if (allExercisesComplete && isLastRound) {
          nextLabelAnim.setValue(0);
          requestAnimationFrame(() => {
            Animated.timing(counterShrinkAnim, {
              toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: false,
            }).start();
          });
        }
      }
    }
    
    // Now persist to the store — re-renders from this are safe because
    // inlineRestActive is already true (indicatorActive stays true)
    if (type === 'warmup') {
      await updateWarmupCompletion(workoutKey, setId, true);
    } else if (type === 'core') {
      await updateAccessoryCompletion(workoutKey, setId, true);
    } else if (type === 'main') {
      await updateMainCompletion(workoutKey, setId, true);
    }
    
    // Keep detailedWorkoutProgress in sync so other screens see progress.
    // Use template item id (currentExercise.id) as the key so history/previous log lookups match.
    const templateItemId = currentExercise.id;
    const setValues = localValuesRef.current[setId];
    const displayVals = getSetDisplayValues(currentExercise.id, currentRound, currentExercise.weight ?? 0, Number(currentExercise.reps) ?? 0);
    const savedWeight = setValues?.weight ?? displayVals.weight ?? currentExercise.weight ?? 0;
    const savedReps = setValues?.reps ?? displayVals.reps ?? Number(currentExercise.reps) ?? 0;
    const existingProgress = useStore.getState().detailedWorkoutProgress[workoutKey]?.exercises[templateItemId];
    const existingSets = (existingProgress as any)?.sets || [];
    const updatedSets = [...existingSets.filter((s: any) => s.setNumber !== currentRound), {
      setNumber: currentRound,
      weight: savedWeight,
      reps: savedReps,
      completed: true,
    }];
    await saveExerciseProgress(workoutKey, templateItemId, {
      exerciseId: currentExercise.exerciseId || currentExercise.id,
      sets: updatedSets,
    });
    
    // Check for new PR (only for main exercises with weight > 0)
    if (type === 'main' && !currentExercise.isTimeBased) {
      const exerciseIdForPR = currentExercise.exerciseId || currentExercise.id;
      const liftedWeight = savedWeight;
      const liftedReps = savedReps;
      if (liftedWeight > 0) {
        const dateMatch = workoutKey?.match(/(\d{4}-\d{2}-\d{2})/);
        const prDate = dateMatch ? dateMatch[1] : dayjs().format('YYYY-MM-DD');
        await updateExercisePR(exerciseIdForPR, currentExercise.exerciseName, liftedWeight, liftedReps, prDate);
      }
    }
    
    // For main exercises with inline timer: save and return (timer handles advancement)
    // For warmup/core: save session then always advance immediately
    if (type === 'main' && !isVeryLastSet) {
      await saveSession(newCompletedSets);
      return;
    }
    
    // Save session before advancing for warmup/core (previously only saved on group complete)
    if ((type === 'warmup' || type === 'core') && !isVeryLastSet) {
      await saveSession(newCompletedSets);
    }
    
    // Advance immediately (for warmup/core every set, for main only the very last set)
    const roundSetIds = currentGroup.exercises.map(ex => `${ex.id}-set-${currentRound}`);
    console.log('📤 [ExerciseExecution] handleComplete → advanceToNext:', {
      type,
      setId,
      currentRound,
      totalRounds: currentGroup.totalRounds,
      allExercisesComplete,
      roundSetIds,
      allInNewCompleted: roundSetIds.every(id => newCompletedSets.has(id)),
      newCompletedSetsSize: newCompletedSets.size,
    });
    advanceToNext(allExercisesComplete, newCompletedSets);
  };

  const handleCompleteRef = useRef(handleComplete);
  handleCompleteRef.current = handleComplete;

  useLayoutEffect(() => {
    exploreCountdownOnWorkDoneRef.current = () => {
      const gi = expandedGroupIndex;
      const group = exerciseGroups[gi];
      const exIdx = activeExerciseIndexRef.current;
      const ex = group?.exercises[exIdx];
      if (!group || !ex) {
        setInlineExploreWorkActive(false);
        return;
      }
      if (ex.isPerSide && !exploreWorkAwaitingSecondLegRef.current) {
        exploreWorkAwaitingSecondLegRef.current = true;
        setInlineExploreWorkActive(false);
        startInlineExploreSwitch();
        return;
      }
      exploreWorkAwaitingSecondLegRef.current = false;
      setInlineExploreWorkActive(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void handleCompleteRef.current();
    };
    exploreCountdownOnSwitchDoneRef.current = () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Medium);
      setInlineExploreSwitchActive(false);
      startInlineExploreWork(exploreWorkDurationSecRef.current);
    };
  }, [expandedGroupIndex, exerciseGroups, startInlineExploreSwitch, startInlineExploreWork]);

  const handleSkipExploreV2Timer = () => {
    if (inlineRestActive) {
      handleInlineRestSkip();
      return;
    }
    if (inlineExploreSwitchActive) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setInlineExploreSwitchActive(false);
      startInlineExploreWork(exploreWorkDurationSecRef.current);
      return;
    }
    if (inlineExploreWorkActive) {
      exploreWorkAwaitingSecondLegRef.current = false;
      setInlineExploreWorkActive(false);
      void handleCompleteRef.current();
    }
  };

  const advanceToNext = async (allExercisesComplete: boolean, newCompletedSets: Set<string>) => {
    setShowTimer(false);
    setInlineRestActive(false);
    setInlineExploreWorkActive(false);
    setInlineExploreSwitchActive(false);
    setInlineExploreWorkPaused(false);
    setInlineExploreSwitchPaused(false);
    exploreWorkAwaitingSecondLegRef.current = false;
    
    const currentGroup = exerciseGroups[expandedGroupIndex];
    if (!currentGroup) {
      console.log('⚠️ [ExerciseExecution] advanceToNext: no currentGroup at index', expandedGroupIndex);
      return;
    }
    // Compute completed rounds from the sets we're passing in, not from refs (refs can be stale or already updated by a re-render)
    let completedRounds = 0;
    const completedSetsList = Array.from(newCompletedSets);
    console.log('📊 [ExerciseExecution] advanceToNext newCompletedSets count:', newCompletedSets.size, 'sample:', completedSetsList.slice(0, 15));
    for (let r = 0; r < currentGroup.totalRounds; r++) {
      const setIdsForRound = currentGroup.exercises.map(ex => `${ex.id}-set-${r}`);
      const allDone = currentGroup.exercises.every(ex => newCompletedSets.has(`${ex.id}-set-${r}`));
      const found = setIdsForRound.filter(id => newCompletedSets.has(id));
      console.log(`   round ${r}: need ${setIdsForRound.join(', ')} → allDone=${allDone}, found=${found.join(', ') || 'none'}`);
      if (allDone) completedRounds = r + 1;
      else break;
    }
    const nextRound = completedRounds; // next round to work on (0-based: we've completed rounds 0..completedRounds-1)
    const groupFullyComplete = completedRounds >= currentGroup.totalRounds;
    
    console.log('⏭️ [ExerciseExecution] advanceToNext:', {
      groupId: currentGroup.id,
      allExercisesComplete,
      completedRounds,
      nextRound,
      totalRounds: currentGroup.totalRounds,
      groupFullyComplete,
      willStayExpanded: allExercisesComplete && !groupFullyComplete,
      activeExerciseIndex: activeExerciseIndexRef.current,
      exercisesInGroup: currentGroup.exercises.length,
    });
    
    if (allExercisesComplete) {
      // Move to next round (or finish group)
      if (groupFullyComplete) {
        // This group is complete — currentRounds will update automatically via derived state
        const updatedRounds = { ...currentRoundsRef.current, [currentGroup.id]: completedRounds };
        setCompletionTimestamps(prev => ({ ...prev, [currentGroup.id]: Date.now() }));
        
        // Find the next incomplete group - first look after current, then wrap around to before
        // Use updatedRounds to check completion, not the old currentRounds state
        let nextIncompleteIndex = exerciseGroups.findIndex((group, idx) => {
          if (idx <= expandedGroupIndex) return false; // First: look after current
          const rounds = updatedRounds[group.id] || 0;
          return rounds < group.totalRounds;
        });
        
        // If nothing found after current, wrap around and look before current
        if (nextIncompleteIndex < 0) {
          nextIncompleteIndex = exerciseGroups.findIndex((group, idx) => {
            if (idx >= expandedGroupIndex) return false; // Only look before current
            const rounds = updatedRounds[group.id] || 0;
            return rounds < group.totalRounds;
          });
        }
        
        console.log('🔍 Looking for next incomplete group:', { 
          currentGroupId: currentGroup.id, 
          expandedGroupIndex, 
          nextIncompleteIndex,
          totalGroups: exerciseGroups.length,
          updatedRounds 
        });
        
        if (nextIncompleteIndex >= 0) {
          console.log('🔴 [ExerciseExecution] COLLAPSE: group complete, user picks next. setExpandedGroupIndex(-1)');
          await saveSession(newCompletedSets);
          LayoutAnimation.configureNext(CARD_TRANSITION);
          // Don't auto-expand the next group - let the user choose freely
          setExpandedGroupIndex(-1);
          setActiveExerciseIndex(0);
          setHasLoggedAnySet(false); // Unlock flow for next exercise selection
        } else {
          // All groups in this section complete!
          console.log('🔴 [ExerciseExecution] COLLAPSE: all groups complete. setExpandedGroupIndex(-1)');
          await saveSession(newCompletedSets);
          
          // Only mark workout as completed if ALL sections (warmup, main, accessories) are done
          if (workoutKey.startsWith('sw-') && isEntireWorkoutComplete()) {
            console.log('🎉 All sections done - marking workout as complete:', workoutKey);
            await completeWorkout(workoutKey);
            console.log('✅ Workout marked as complete');
          } else {
            console.log('📋 Section complete but other sections remain');
          }
          
          if (bonusLogId) {
            const bonusLog = bonusLogs.find(l => l.id === bonusLogId);
            updateBonusLog(bonusLogId, {
              status: 'completed',
              completedAt: new Date().toISOString(),
            });
            if (type === 'core' && bonusLog?.coreProgramId && bonusLog?.coreSessionTemplateId) {
              const completed = getAccessoryCompletion(workoutKey, workoutTemplateId).completedItems;
              await logCoreSession(bonusLog.coreProgramId, bonusLog.coreSessionTemplateId, 'completed', completed);
            }
          }
          
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setShowConfetti(true);
          LayoutAnimation.configureNext(CARD_TRANSITION);
          setExpandedGroupIndex(-1);
          setActiveExerciseIndex(0);
        }
      } else {
        // Same group, next round — keep card expanded until all sets in this superset are logged
        const roundJustFinished = completedRounds - 1; // 0-based round we just completed
        console.log('🟢 [ExerciseExecution] STAY EXPANDED: same group next round. roundJustFinished=', roundJustFinished, 'nextRound=', nextRound, '(NOT calling setExpandedGroupIndex)');
        await saveSession(newCompletedSets);
        LayoutAnimation.configureNext(CARD_TRANSITION);
        setActiveExerciseIndex(0);
        // expandedGroupIndex unchanged so card stays expanded

        // Copy values from completed sets to next round sets
        setLocalValues(prev => {
          const updated = { ...prev };
          currentGroup.exercises.forEach(exercise => {
            const currentSetId = `${exercise.id}-set-${roundJustFinished}`;
            const nextSetId = `${exercise.id}-set-${nextRound}`;
            
            // If current set has adjusted values, copy them to next set
            if (prev[currentSetId]) {
              updated[nextSetId] = {
                weight: prev[currentSetId].weight,
                reps: prev[currentSetId].reps,
              };
            }
          });
          return updated;
        });
      }
    } else {
      // Move to next exercise in same round. Find the first exercise missing its set for this round (don't use ref+1 — a useEffect can update the ref and skip an exercise in 3+ supersets).
      const workingRound = nextRound; // round we're still working on (0-based)
      let nextExIndex = -1;
      for (let i = 0; i < currentGroup.exercises.length; i++) {
        const setId = `${currentGroup.exercises[i].id}-set-${workingRound}`;
        if (!newCompletedSets.has(setId)) {
          nextExIndex = i;
          break;
        }
      }
      console.log('➡️ Moving to next exercise in same round:', nextExIndex, 'round', workingRound, '| group has', currentGroup.exercises.length, 'exercises');
      await saveSession(newCompletedSets);
      if (nextExIndex >= 0) {
        LayoutAnimation.configureNext(CARD_TRANSITION);
        setActiveExerciseIndex(nextExIndex);
      } else {
        console.log('⚠️ No more exercises in this round');
      }
    }
  };
  
  const handleStart = async () => {
    if (expandedGroupIndex < 0) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const currentGroup = exerciseGroups[expandedGroupIndex];
    const currentExercise = currentGroup.exercises[activeExerciseIndex];
    
    if (!currentExercise) return;
    
    // Mark that user has started working (keeps border active)
    setHasLoggedAnySet(true);
    
    setShowAdjustmentDrawer(false);
    
    // For time-based exercises, show exercise timer first
    if (currentExercise.isTimeBased) {
      const roundForTimer = currentRounds[currentGroup.id] ?? 0;
      pendingTimerSetRef.current = { exerciseId: currentExercise.id, round: roundForTimer };
      if (executionMode === 'explore-v2' && type === 'main') {
        exploreWorkAwaitingSecondLegRef.current = false;
        const displayVals = getSetDisplayValues(
          currentExercise.id,
          roundForTimer,
          currentExercise.weight ?? 0,
          Number(currentExercise.reps) ?? 0,
        );
        const sec = Number(displayVals.reps) || 30;
        exploreWorkDurationSecRef.current = sec;
        startInlineExploreWork(sec);
        runRestStaggerIn();
      } else {
        setIsExerciseTimerPhase(true);
        setShowTimer(true);
      }
    } else {
      // For reps-based exercises, mark as complete immediately
      await handleComplete();
    }
  };
  
  const handleHistory = () => {
    setShowMenu(false);
    // TODO: Navigate to history screen for this exercise type
    Alert.alert('History', 'Exercise history coming soon!');
  };

  const handleRest = () => {
    setShowMenu(false);
    pendingTimerSetRef.current = null;
    if (executionMode === 'explore-v2' && type === 'main') {
      counterShrinkAnim.setValue(1);
      startInlineRest();
      runRestStaggerIn();
    } else {
      setShowTimer(true);
    }
  };

  const handleCompleteAll = () => {
    setShowMenu(false);
    Alert.alert(
      t('completeAll'),
      `Mark all ${type === 'warmup' ? 'warm-up' : type === 'core' ? 'core' : 'workout'} exercises as complete?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('complete'),
          onPress: async () => {
            // Mark all exercises as complete
            const allSetIds: string[] = [];
            exerciseGroups.forEach(group => {
              group.exercises.forEach(exercise => {
                for (let round = 0; round < group.totalRounds; round++) {
                  allSetIds.push(`${exercise.id}-set-${round}`);
                }
              });
            });
            
            // Update completion in store (completedSets + currentRounds derive automatically)
            if (type === 'warmup') {
              for (const setId of allSetIds) {
                await updateWarmupCompletion(workoutKey, setId, true);
              }
            } else if (type === 'core') {
              for (const setId of allSetIds) {
                await updateAccessoryCompletion(workoutKey, setId, true);
              }
            } else if (type === 'main') {
              for (const setId of allSetIds) {
                await updateMainCompletion(workoutKey, setId, true);
              }
            }

            // Keep detailedWorkoutProgress in sync (use template item id as key for history lookups)
            for (const group of exerciseGroups) {
              for (const exercise of group.exercises) {
                const templateItemId = exercise.id;
                const sets = [];
                for (let round = 0; round < group.totalRounds; round++) {
                  const setId = `${exercise.id}-set-${round}`;
                  const sv = localValuesRef.current[setId];
                  const displayVals = getSetDisplayValues(exercise.id, round, exercise.weight ?? 0, Number(exercise.reps) ?? 0);
                  sets.push({
                    setNumber: round,
                    weight: sv?.weight ?? displayVals.weight ?? exercise.weight ?? 0,
                    reps: sv?.reps ?? displayVals.reps ?? Number(exercise.reps) ?? 0,
                    completed: true,
                  });
                }
                await saveExerciseProgress(workoutKey, templateItemId, {
                  exerciseId: exercise.exerciseId || exercise.id,
                  sets,
                });
              }
            }

            const completedSetsSet = new Set(allSetIds);
            await saveSession(completedSetsSet);
            
            if (workoutKey.startsWith('sw-') && isEntireWorkoutComplete()) {
              await completeWorkout(workoutKey);
            }
            
            setHasLoggedAnySet(true);
            
            if (bonusLogId) {
              const bonusLog = bonusLogs.find(l => l.id === bonusLogId);
              updateBonusLog(bonusLogId, {
                status: 'completed',
                completedAt: new Date().toISOString(),
              });
              if (type === 'core' && bonusLog?.coreProgramId && bonusLog?.coreSessionTemplateId) {
                const completed = getAccessoryCompletion(workoutKey, workoutTemplateId).completedItems;
                await logCoreSession(bonusLog.coreProgramId, bonusLog.coreSessionTemplateId, 'completed', completed);
              }
            }
            
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowConfetti(true);
            if (type === 'main') {
              LayoutAnimation.configureNext(CARD_TRANSITION);
              setExpandedGroupIndex(-1);
              setActiveExerciseIndex(0);
            } else {
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  const handleSkip = () => {
    setShowMenu(false);
    Alert.alert(
      t('skipWorkout'),
      `Skip all ${type === 'warmup' ? 'warm-up' : type === 'core' ? 'core' : 'workout'} exercises?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('skip'),
          style: 'destructive',
          onPress: async () => {
            if (type === 'core' && bonusLogId) {
              const bonusLog = bonusLogs.find(l => l.id === bonusLogId);
              if (bonusLog?.coreProgramId && bonusLog?.coreSessionTemplateId) {
                await logCoreSession(bonusLog.coreProgramId, bonusLog.coreSessionTemplateId, 'skipped');
              }
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleReset = () => {
    setShowMenu(false);
    Alert.alert(
      t('resetProgressTitle'),
      `Reset all ${type === 'warmup' ? 'warm-up' : type === 'core' ? 'core' : 'workout'} progress?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('reset'),
          style: 'destructive',
          onPress: async () => {
            LayoutAnimation.configureNext(CARD_TRANSITION);

            // Clear completion in store (completedSets + currentRounds derive automatically)
            if (type === 'warmup') {
              await resetWarmupCompletion(workoutKey);
            } else if (type === 'core') {
              await resetAccessoryCompletion(workoutKey);
            } else if (type === 'main') {
              await resetMainCompletion(workoutKey);
            }
            
            if (workoutKey.startsWith('sw-')) {
              await uncompleteWorkout(workoutKey);
            }

            if (currentSessionId) {
              await deleteSession(currentSessionId);
              setCurrentSessionId(null);
            }

            setCompletionTimestamps({});
            setExpandedGroupIndex(0);
            setActiveExerciseIndex(0);
            setHasLoggedAnySet(false);
            setLocalValues({});
            
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  };

  const cleanupAfterSwap = async (oldExerciseId: string, newExerciseId: string) => {
    // Migrate completion from old exercise ID to new in the store
    const completedArray = Array.from(completedSets);
    const updateFn = type === 'warmup' ? updateWarmupCompletion
      : type === 'core' ? updateAccessoryCompletion
      : updateMainCompletion;

    for (const setId of completedArray) {
      if (setId.startsWith(`${oldExerciseId}-set-`)) {
        const round = setId.replace(`${oldExerciseId}-set-`, '');
        await updateFn(workoutKey, setId, false);
        await updateFn(workoutKey, `${newExerciseId}-set-${round}`, true);
      }
    }

    setLocalValues(prev => {
      const next = { ...prev };
      Object.keys(prev).forEach(setId => {
        if (setId.startsWith(`${oldExerciseId}-set-`)) {
          const round = setId.replace(`${oldExerciseId}-set-`, '');
          next[`${newExerciseId}-set-${round}`] = prev[setId];
          delete next[setId];
        }
      });
      return next;
    });
  };

  const clearLoggedSetsForTemplateExercise = async (templateExerciseId: string) => {
    const st = useStore.getState();
    let items: string[] = [];
    if (type === 'warmup') {
      items = st.getWarmupCompletion(workoutKey, workoutTemplateId).completedItems;
    } else if (type === 'core') {
      items = st.getAccessoryCompletion(workoutKey, workoutTemplateId).completedItems;
    } else {
      items = st.getMainCompletion(workoutKey).completedItems;
    }
    const prefix = `${templateExerciseId}-set-`;
    const toClear = items.filter(id => id.startsWith(prefix));
    const updateFn =
      type === 'warmup'
        ? updateWarmupCompletion
        : type === 'core'
          ? updateAccessoryCompletion
          : updateMainCompletion;
    for (const setId of toClear) {
      await updateFn(workoutKey, setId, false);
    }
    setLocalValues(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (k.startsWith(prefix)) delete next[k];
      });
      return next;
    });
    const st2 = useStore.getState();
    let remaining = 0;
    if (type === 'warmup') {
      remaining = st2.getWarmupCompletion(workoutKey, workoutTemplateId).completedItems.length;
    } else if (type === 'core') {
      remaining = st2.getAccessoryCompletion(workoutKey, workoutTemplateId).completedItems.length;
    } else {
      remaining = st2.getMainCompletion(workoutKey).completedItems.length;
    }
    setHasLoggedAnySet(remaining > 0);
  };

  /** Swap is allowed whenever this template exercise has no logged sets; other exercises are irrelevant. */
  const handleSwap = (templateExerciseIdFromOverflow?: string) => {
    setShowMenu(false);

    if (templateExerciseIdFromOverflow) {
      for (let gi = 0; gi < exerciseGroups.length; gi++) {
        const ei = exerciseGroups[gi].exercises.findIndex(ex => ex.id === templateExerciseIdFromOverflow);
        if (ei >= 0) {
          setExpandedGroupIndex(gi);
          setActiveExerciseIndex(ei);
          break;
        }
      }
    }

    const targetId =
      templateExerciseIdFromOverflow ??
      (() => {
        const gIdx = expandedGroupIndex >= 0 ? expandedGroupIndex : 0;
        const group = exerciseGroups[gIdx];
        if (!group?.exercises?.length) return null;
        const ei = Math.min(Math.max(0, activeExerciseIndex), group.exercises.length - 1);
        return group.exercises[ei]?.id ?? null;
      })();

    const openSwapEditor = () => {
      if (type === 'main') {
        setTimeout(() => setShowSwapModal(true), 400);
      } else if (type === 'warmup') {
        (navigation as any).navigate('WarmupEditor', { templateId: workoutTemplateId, workoutKey });
      } else if (type === 'core') {
        (navigation as any).navigate('AccessoriesEditor', { templateId: workoutTemplateId, workoutKey });
      }
    };

    if (!targetId) {
      openSwapEditor();
      return;
    }

    if (!templateExerciseHasLoggedSets(completedSets, targetId)) {
      openSwapEditor();
      return;
    }

    Alert.alert(t('swapClearExerciseLogsTitle'), t('swapClearExerciseLogsMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('clearLogsAndSwap'),
        style: 'destructive',
        onPress: async () => {
          await clearLoggedSetsForTemplateExercise(targetId);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          openSwapEditor();
        },
      },
    ]);
  };

  /** Remove all template items in an exercise group (Explore v2 Up Next trash). */
  const removeGroupFromWorkoutByIndex = useCallback(
    async (groupIndex: number) => {
      const group = exerciseGroups[groupIndex];
      if (!group || !template) return;
      const idsToRemove = new Set(group.exercises.map(e => e.id));
      if (type === 'warmup') {
        const source = scheduledWorkout?.warmupSnapshot ?? template?.warmupItems ?? [];
        const updatedItems = source.filter((item: any) => !idsToRemove.has(item.id));
        await updateWorkoutTemplate(workoutTemplateId, { warmupItems: updatedItems });
        if (scheduledWorkout && workoutKey) {
          await updateScheduledWorkoutSnapshots(workoutKey, { warmupSnapshot: updatedItems });
        }
      } else if (type === 'core') {
        const source = scheduledWorkout?.accessorySnapshot ?? template?.accessoryItems ?? [];
        const updatedItems = source.filter((item: any) => !idsToRemove.has(item.id));
        await updateWorkoutTemplate(workoutTemplateId, { accessoryItems: updatedItems });
        if (scheduledWorkout && workoutKey) {
          await updateScheduledWorkoutSnapshots(workoutKey, { accessorySnapshot: updatedItems });
        }
      } else if (type === 'main') {
        const source = scheduledWorkout?.exercisesSnapshot ?? template?.items ?? [];
        const updatedItems = source.filter((item: any) => !idsToRemove.has(item.id));
        await updateWorkoutTemplate(workoutTemplateId, { items: updatedItems });
        if (scheduledWorkout && workoutKey) {
          await updateScheduledWorkoutSnapshots(workoutKey, { exercisesSnapshot: updatedItems });
        }
      }
      if (expandedGroupIndex === groupIndex) {
        setExpandedGroupIndex(-1);
      } else if (groupIndex < expandedGroupIndex) {
        setExpandedGroupIndex(expandedGroupIndex - 1);
      }
      setActiveExerciseIndex(0);
      setRefreshKey(prev => prev + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [
      exerciseGroups,
      template,
      type,
      scheduledWorkout,
      workoutKey,
      workoutTemplateId,
      updateWorkoutTemplate,
      updateScheduledWorkoutSnapshots,
      expandedGroupIndex,
    ],
  );

  const removeExerciseFromWorkout = useCallback(async (activeExercise: WarmupItem) => {
    if (type === 'warmup') {
      const source = scheduledWorkout?.warmupSnapshot ?? template?.warmupItems ?? [];
      const updatedItems = source.filter((item: any) => item.id !== activeExercise.id);
      await updateWorkoutTemplate(workoutTemplateId, { warmupItems: updatedItems });
      if (scheduledWorkout && workoutKey) {
        await updateScheduledWorkoutSnapshots(workoutKey, { warmupSnapshot: updatedItems });
      }
    } else if (type === 'core') {
      const source = scheduledWorkout?.accessorySnapshot ?? template?.accessoryItems ?? [];
      const updatedItems = source.filter((item: any) => item.id !== activeExercise.id);
      await updateWorkoutTemplate(workoutTemplateId, { accessoryItems: updatedItems });
      if (scheduledWorkout && workoutKey) {
        await updateScheduledWorkoutSnapshots(workoutKey, { accessorySnapshot: updatedItems });
      }
    } else if (type === 'main') {
      const source = scheduledWorkout?.exercisesSnapshot ?? template?.items ?? [];
      const updatedItems = source.filter((item: any) => {
        const itemKey = scheduledWorkout ? item.id : (item.exerciseId ?? item.id);
        return itemKey !== activeExercise.id;
      });
      await updateWorkoutTemplate(workoutTemplateId, { items: updatedItems });
      if (scheduledWorkout && workoutKey) {
        await updateScheduledWorkoutSnapshots(workoutKey, { exercisesSnapshot: updatedItems });
      }
    }
    setRefreshKey(prev => prev + 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [
    type,
    scheduledWorkout,
    template,
    updateWorkoutTemplate,
    workoutTemplateId,
    workoutKey,
    updateScheduledWorkoutSnapshots,
  ]);
  
  const getTitle = () => {
    if (type === 'warmup') return t('warmup');
    if (type === 'core') return t('core');
    return template?.name || 'Workout';
  };

  const restTimerMenuLabel = (() => {
    const s = localRestOverride ?? settings.restTimerDefaultSeconds;
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm}:${ss.toString().padStart(2, '0')}`;
  })();

  // Helper function to get ordinal suffix for dates
  const getOrdinalSuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  
  // Get exercise history for the current exercise (templateItemId = progress key, libraryExerciseId = sessions key)
  const getExerciseHistoryForDrawer = (templateItemId: string, libraryExerciseId?: string) => {
    const exerciseIdForSession = libraryExerciseId ?? templateItemId;
    const historyByDate = new Map<string, Array<{ setNumber: number; weight: number; reps: number }>>();
    
    // 1. Get from detailed workout progress (written by ExerciseDetailScreen)
    const workoutTemplateMap = new Map<string, any>();
    const freshWorkoutTemplates = useStore.getState().workoutTemplates;
    freshWorkoutTemplates.forEach(template => {
      workoutTemplateMap.set(template.id, template);
    });
    const freshScheduledWorkouts = useStore.getState().scheduledWorkouts;

    const detailedWorkoutProgress = getDetailedWorkoutProgress();
    Object.entries(detailedWorkoutProgress).forEach(([wKey, workoutProgress]) => {
      // Resolve template: scheduled workout id is e.g. "sw-1730123456789" — get templateId from scheduled workout
      let workoutTemplate: any = null;
      let workoutDate: string = '';
      if (wKey.startsWith('sw-')) {
        const sw = freshScheduledWorkouts.find(s => s.id === wKey);
        if (sw) {
          workoutTemplate = workoutTemplateMap.get(sw.templateId);
          workoutDate = sw.date || '';
        }
      }
      if (!workoutTemplate) {
        const wTemplateId = wKey.split('-').slice(0, -3).join('-');
        workoutTemplate = workoutTemplateMap.get(wTemplateId);
      }
      if (!workoutTemplate) return;

      const date = workoutDate || (wKey.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().split('T')[0]);

      Object.entries(workoutProgress.exercises).forEach(([templateExerciseId, exerciseProgress]) => {
        const templateExercise = (workoutTemplate.items || (workoutTemplate as any).exercises)?.find(
          (ex: any) => ex.id === templateExerciseId || ex.exerciseId === templateExerciseId
        );

        if (!templateExercise) return;
        
        const exerciseDataById = exercisesLibrary.find(e => e.id === templateExercise.exerciseId);
        const exerciseDataForCurrent = exercisesLibrary.find(e => e.id === templateItemId || e.id === libraryExerciseId);
        
        const matchesByTemplateId = templateExerciseId === templateItemId;
        const matchesByLibraryId = templateExercise.exerciseId === templateItemId || templateExercise.exerciseId === libraryExerciseId;
        const matchesByName = exerciseDataById?.name.toLowerCase().trim() === exerciseDataForCurrent?.name.toLowerCase().trim();
        
        if (matchesByTemplateId || matchesByLibraryId || matchesByName) {
          if (exerciseProgress.skipped) return;
          
          const hasCompletedSets = exerciseProgress.sets?.some((set: any) => set.completed);
          
          if (hasCompletedSets && exerciseProgress.sets) {
            const completedSets = exerciseProgress.sets
              .filter(set => set.completed)
              .map(set => ({
                setNumber: set.setNumber,
                weight: set.weight,
                reps: set.reps,
              }));
            
            if (historyByDate.has(date)) {
              const existing = historyByDate.get(date)!;
              historyByDate.set(date, [...existing, ...completedSets]);
            } else {
              historyByDate.set(date, completedSets);
            }
          }
        }
      });
    });
    
    // 2. Get from completed sessions (fresh read, for dates not already covered)
    const datesFromProgress = new Set(historyByDate.keys());
    const freshSessions = useStore.getState().sessions;
    const latestSessionByDate = new Map<string, typeof freshSessions[0]>();
    
    freshSessions.forEach(session => {
      const date = session.date || new Date(session.startTime).toISOString().split('T')[0];
      if (datesFromProgress.has(date)) return;
      
      const hasExercise = session.sets.some(set => 
        set.exerciseId === exerciseIdForSession || set.exerciseId === templateItemId || set.exerciseName === items.find(i => i.id === templateItemId || i.exerciseId === exerciseIdForSession)?.exerciseName
      );
      if (!hasExercise) return;
      
      const existing = latestSessionByDate.get(date);
      if (!existing || session.id > existing.id) {
        latestSessionByDate.set(date, session);
      }
    });
    
    latestSessionByDate.forEach((session, date) => {
      session.sets.forEach(set => {
        if (set.exerciseId === exerciseIdForSession || set.exerciseId === templateItemId || set.exerciseName === items.find(i => i.id === templateItemId || i.exerciseId === exerciseIdForSession)?.exerciseName) {
          if (!historyByDate.has(date)) {
            historyByDate.set(date, []);
          }
          
          historyByDate.get(date)!.push({
            setNumber: set.setNumber || set.setIndex || 0,
            weight: set.weight || 0,
            reps: set.reps || 0,
          });
        }
      });
    });
    
    // Deduplicate sets within each date by setNumber (keep the latest entry for each set)
    historyByDate.forEach((sets, date) => {
      const uniqueSets = new Map<number, typeof sets[0]>();
      sets.forEach(set => {
        uniqueSets.set(set.setNumber, set); // Last write wins
      });
      historyByDate.set(date, Array.from(uniqueSets.values()).sort((a, b) => a.setNumber - b.setNumber));
    });
    
    // Convert to array and sort by date (oldest first, latest at bottom)
    return Array.from(historyByDate.entries())
      .map(([date, sets]) => ({ date, sets }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const exploreDetailGroup = exploreDetailGroupIndex !== null ? exerciseGroups[exploreDetailGroupIndex] : null;
  const exploreDetailExercise = exploreDetailGroup
    ? exploreDetailGroup.exercises[exploreDetailExerciseIndex] ?? exploreDetailGroup.exercises[0]
    : null;
  const exploreDetailCurrentRound = exploreDetailGroup ? (currentRounds[exploreDetailGroup.id] || 0) : 0;
  const exploreDetailHistory = useMemo(() => {
    if (!exploreDetailExercise) return [];
    return getExerciseHistoryForDrawer(exploreDetailExercise.id, (exploreDetailExercise as any).exerciseId);
  }, [exploreDetailExercise, completedSets, localValues, refreshKey]);

  const flushExploreSetEditorDraftToLocal = useCallback(() => {
    if (exploreSetEditorSetIndex === null || !exploreExecutionEditTarget) return;
    const draft = exploreEditDraftRef.current;
    if (!draft) return;
    const { exercise } = exploreExecutionEditTarget;
    const setIndex = exploreSetEditorSetIndex;
    const setId = `${exercise.id}-set-${setIndex}`;
    const setVals = getSetDisplayValues(
      exercise.id,
      setIndex,
      exercise.weight ?? 0,
      Number(exercise.reps ?? 0),
    );
    const wText = draft.weightStr.trim();
    const rText = draft.repsStr.trim();
    const parsedW = parseFloat(wText);
    const parsedR = parseInt(rText, 10);
    setLocalValues(prev => {
      const cur = prev[setId];
      let weight = cur?.weight ?? setVals.weight;
      let reps = cur?.reps ?? setVals.reps;
      if (wText !== '' && !isNaN(parsedW) && parsedW >= 0) {
        weight = fromDisplayWeight(Math.round(parsedW * 2) / 2, useKg);
      }
      if (rText !== '' && !isNaN(parsedR) && parsedR >= 1) {
        reps = parsedR;
      }
      return { ...prev, [setId]: { weight, reps } };
    });
  }, [exploreSetEditorSetIndex, exploreExecutionEditTarget, getSetDisplayValues, setLocalValues, useKg]);

  const closeExploreSetEditor = useCallback(() => {
    flushExploreSetEditorDraftToLocal();
    setShowExploreSetEditor(false);
    setExploreSetEditorSetIndex(null);
    setExploreEditDraft(null);
    exploreEditDraftRef.current = null;
    Keyboard.dismiss();
  }, [flushExploreSetEditorDraftToLocal]);

  const openExploreSetRowEditor = useCallback(
    (setIndex: number) => {
      if (!exploreExecutionEditTarget) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (showExploreSetEditor && exploreSetEditorSetIndex !== null && exploreSetEditorSetIndex !== setIndex) {
        flushExploreSetEditorDraftToLocal();
      }
      const { exercise } = exploreExecutionEditTarget;
      const setId = `${exercise.id}-set-${setIndex}`;
      const setVals = getSetDisplayValues(
        exercise.id,
        setIndex,
        exercise.weight ?? 0,
        Number(exercise.reps ?? 0),
      );
      const lv = localValuesRef.current[setId];
      const w = lv?.weight ?? setVals.weight;
      const r = lv?.reps ?? setVals.reps;
      const nextDraft = {
        weightStr: formatWeightForLoad(w, useKg),
        repsStr: String(r),
      };
      exploreEditDraftRef.current = nextDraft;
      exploreEditPendingFocusRef.current = 'weight';
      exploreEditActiveFieldRef.current = 'weight';
      setExploreEditDraft(nextDraft);
      setExploreSetEditorSetIndex(setIndex);
      setShowExploreSetEditor(true);
    },
    [
      exploreExecutionEditTarget,
      showExploreSetEditor,
      exploreSetEditorSetIndex,
      flushExploreSetEditorDraftToLocal,
      getSetDisplayValues,
      useKg,
    ],
  );

  const openExploreDetailSheet = useCallback(
    (groupIndex: number, exerciseIndex: number) => {
      const group = exerciseGroups[groupIndex];
      if (!group) return;
      flushExploreSetEditorDraftToLocal();
      setShowExploreSetEditor(false);
      setExploreSetEditorSetIndex(null);
      setExploreEditDraft(null);
      exploreEditDraftRef.current = null;
      Keyboard.dismiss();
      setExploreDetailGroupIndex(groupIndex);
      setExploreDetailExerciseIndex(exerciseIndex);
      setShowAllExploreHistory(false);
      setShowExploreDetailSheet(true);
    },
    [exerciseGroups, flushExploreSetEditorDraftToLocal],
  );

  // Focus weight when the Explore set editor sheet opens.
  useEffect(() => {
    if (!showExploreSetEditor || exploreSetEditorSetIndex === null) return;
    const target = exploreEditPendingFocusRef.current;
    const id = requestAnimationFrame(() => {
      if (target === 'reps') exploreEditRepsRef.current?.focus();
      else exploreEditWeightRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [showExploreSetEditor, exploreSetEditorSetIndex]);
  
  // Rest of the render logic from WarmupExecutionScreen...
  // (I'll keep this abbreviated for now, but it will include all the card rendering, drawer, timer, etc.)
  
  return (
    <AnimatedReanimated.View
      style={[styles.container, { paddingTop: insets.top }, exploreV2PageBgAnimatedStyle]}
    >
      <ShapeConfetti active={showConfetti} />
      {executionMode !== 'explore-v2' && (
        <DeviceEdgeTimer
          visible={inlineRestActive}
          progress={inlineRestProgress}
          strokeColor={COLORS.info}
          strokeWidth={4}
        />
      )}
      <View style={styles.header}>
        <View style={styles.topBar}>
          <TouchableOpacity
            testID="back-button"
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.goBack();
            }}
            activeOpacity={1}
          >
            <IconArrowLeft size={24} color={executionMode === 'explore-v2' ? exploreV2HeaderInk : '#FFFFFF'} />
          </TouchableOpacity>
          <View style={styles.topBarCenter}>
            <Text
              testID="header-title"
              numberOfLines={1}
              style={[styles.headerTitle, executionMode === 'explore-v2' && styles.headerTitleExploreV2]}
            >
              {getTitle()}
            </Text>
            {executionMode === 'explore' && inlineRestActive && (
              <View style={[styles.headerTimerPill, styles.headerTimerPillBelowTitle]}>
                <TouchableOpacity onPress={handleInlineRestPauseToggle} activeOpacity={0.7} style={styles.exploreTimerIconBtn}>
                  {inlineRestPaused ? <IconPlay size={16} color={COLORS.accentPrimary} /> : <IconPause size={16} color={COLORS.accentPrimary} />}
                </TouchableOpacity>
                <Text style={styles.exploreTimerText}>
                  {Math.floor(inlineRestTimeLeft / 60)}:{String(inlineRestTimeLeft % 60).padStart(2, '0')}
                </Text>
                <TouchableOpacity onPress={handleInlineRestSkip} activeOpacity={0.7} style={styles.exploreTimerIconBtn}>
                  <IconSkip size={16} color={COLORS.accentPrimary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
          {!isInPastCycle && (
            <TouchableOpacity
              testID="menu-button"
              style={styles.menuButton}
              onPress={() => setShowMenu(true)}
              activeOpacity={1}
            >
              <IconMenu size={24} color={executionMode === 'explore-v2' ? exploreV2HeaderInk : '#FFFFFF'} />
            </TouchableOpacity>
          )}
          {isInPastCycle && (
            <View style={styles.menuSpacer} />
          )}
        </View>
      </View>
      
      <AnimatedReanimated.View style={[styles.contentWrap, exploreV2ContentWrapBgAnimatedStyle]}>
        {executionMode === 'explore-v2' ? (
          <View style={styles.exploreV2Root} onLayout={onExploreV2RootLayout}>
            <AnimatedReanimated.View style={[styles.exploreV2TimerBand, exploreV2TimerBandAnimatedStyle]} />
            <AnimatedReanimated.View style={[styles.exploreV2WalletBand, exploreV2WalletBandAnimatedStyle]}>
              <ExploreV2ExecutionRoot
                exerciseGroups={exerciseGroups}
                exploreCurrentGroupIndex={exploreCurrentGroupIndex}
                upNextExercises={upNextExercises}
                completedExerciseIndexes={completedExerciseIndexes}
                currentRounds={currentRounds}
                completedSets={completedSets}
                setExpandedGroupIndex={setExpandedGroupIndex}
                activeExerciseIndex={activeExerciseIndex}
                setActiveExerciseIndex={setActiveExerciseIndex}
                getSetDisplayValues={getSetDisplayValues}
                localValues={localValues}
                setLocalValues={setLocalValues}
                useKg={useKg}
                weightUnit={weightUnit}
                getBarbellMode={getBarbellMode}
                setBarbellMode={setBarbellMode}
                timeBasedOverrides={timeBasedOverrides}
                setTimeBasedOverrides={setTimeBasedOverrides}
                perSideOverrides={perSideOverrides}
                setPerSideOverrides={setPerSideOverrides}
                handleStart={handleStart}
                openExploreDetailSheet={openExploreDetailSheet}
                showPrimaryCta={
                  exploreV2FrontGroupIndex !== null &&
                  canShowPrimaryCTAExploreV2(exploreV2FrontGroupIndex)
                }
                onSkipRest={handleSkipExploreV2Timer}
                exploreV2TimerPhase={exploreV2TimerPhase}
                exploreV2WorkBlueProgress={exploreV2WorkBlueProgress}
                allComplete={isExploreV2WorkoutComplete}
                type={type}
                progressionGroups={progressionGroups}
                updateProgressionGroup={updateProgressionGroup}
                onSwapExercise={handleSwap}
                onRemoveExercise={async (exercise) => {
                  await removeExerciseFromWorkout(exercise as WarmupItem);
                }}
                exploreLayoutRootHeight={exploreV2RootHeight}
                currentGroupHasLoggedSets={exploreV2CurrentGroupHasLoggedSets}
                onOpenAddExercise={() => setShowAddExerciseDrawer(true)}
                onRemoveGroupFromUpNext={removeGroupFromWorkoutByIndex}
                allowAddExercise={type === 'main'}
                timerThemeActive={
                  exploreV2TimerPhase === 'rest' || exploreV2TimerPhase === 'switchSides'
                }
                restThemeProgress={exploreV2TimerBandProgress}
                getExerciseHistoryForDrawer={getExerciseHistoryForDrawer}
                exerciseHistoryRefreshKey={refreshKey}
                progressionValuesByItemId={progressionValuesByItemId}
              />
            </AnimatedReanimated.View>
            <View
              style={styles.exploreV2TimerOverlay}
              pointerEvents={
                inlineRestActive || inlineExploreWorkActive || inlineExploreSwitchActive
                  ? 'box-none'
                  : 'none'
              }
            >
              <View
                style={[
                  styles.exploreV2TimerOverlayAnchor,
                  {
                    left: insets.left,
                    width: screenWidth - insets.left - insets.right,
                  },
                ]}
                pointerEvents={
                  inlineRestActive || inlineExploreWorkActive || inlineExploreSwitchActive
                    ? 'box-none'
                    : 'none'
                }
              >
                <ExploreV2TimerArea
                  layoutVariant="overlay"
                  active={
                    inlineRestActive || inlineExploreWorkActive || inlineExploreSwitchActive
                  }
                  layoutProgress={exploreV2TimerBandProgress}
                  timeLeftSec={exploreV2HeroTimerDisplaySec}
                  paused={
                    inlineRestActive
                      ? inlineRestPaused
                      : inlineExploreWorkActive
                        ? inlineExploreWorkPaused
                        : inlineExploreSwitchPaused
                  }
                  onPauseToggle={handleExploreV2HeroPauseToggle}
                  progress={inlineRestProgress}
                  contextLabel={exploreV2TimerContextLabel}
                  workTimerVisualActive={inlineExploreWorkActive || inlineExploreSwitchActive}
                  exploreV2WorkBlueProgress={exploreV2WorkBlueProgress}
                />
              </View>
            </View>
          </View>
        ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.scrollContent,
            type === 'main' && !allCurrentGroupsComplete && { paddingBottom: 48 + 12 + Math.max(insets.bottom, 16) },
          ]}
          bounces={false}
        >
        {executionMode === 'explore' ? (
          <View style={styles.exploreRoot}>
            {(() => {
              const renderExploreCard = (
                groupIndex: number,
                section: 'current' | 'up-next' | 'completed',
                currentLayout?: 'current-stack',
              ) => {
                const group = exerciseGroups[groupIndex];
                if (!group) return null;

                const completedRounds = currentRounds[group.id] || 0;
                const isCompleted = completedRounds >= group.totalRounds;
                const isExpanded = expandedGroupIndex === groupIndex;
                const isCurrent = exploreCurrentGroupIndex === groupIndex;
                /** Current explore area: summary card + separate set list + CTA (calmer than one overloaded card) */
                const layoutStack = section === 'current' && currentLayout === 'current-stack';
                const isCardLocked = section !== 'completed' && hasCurrentExercise && !isCurrent;
                const canOpen = canExpandExercise(groupIndex) && !isCompleted && section !== 'completed';
                const workingRound = Math.min(completedRounds, Math.max(0, group.totalRounds - 1));
                const focusExerciseIndex = isCurrent
                  ? Math.min(activeExerciseIndex, Math.max(0, group.exercises.length - 1))
                  : Math.max(
                      0,
                      group.exercises.findIndex(ex => !completedSets.has(`${ex.id}-set-${workingRound}`)),
                    );
                const focusExercise = group.exercises[focusExerciseIndex] ?? group.exercises[0];
                const displayRound = isCompleted ? Math.max(0, completedRounds - 1) : completedRounds;
                const displayVals = getSetDisplayValues(
                  focusExercise.id,
                  displayRound,
                  focusExercise.weight ?? 0,
                  Number(focusExercise.reps) ?? 0,
                );
                const showWeight = displayVals.weight > 0;
                const repsUnit = focusExercise.isTimeBased ? 'secs' : 'reps';
                const groupHasStarted = group.exercises.some(ex => completedSets.has(`${ex.id}-set-0`));
                const ctaLabel = !groupHasStarted
                  ? 'Log first set'
                  : completedRounds + 1 >= group.totalRounds
                    ? 'Log final set'
                    : 'Log next set';
                const indicatorActive = isExpanded && !isCompleted && canShowPrimaryCTA(groupIndex);
                const groupCardBg = isExpanded ? styles.itemCardBorder : styles.itemCardInactive;
                const groupCardFg = isExpanded ? styles.itemCardFill : styles.itemCardInnerInactive;

                return (
                  <View key={`${section}-${group.id}`} style={layoutStack ? styles.exploreCurrentStack : styles.itemRow}>
                    <View style={styles.exerciseCardsColumn}>
                      <View style={groupCardBg}>
                        <View style={[groupCardFg, isCardLocked && styles.exploreCardLocked]}>
                          {/* Header only; expanded summary / set list / CTA stay outside this press target */}
                          <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => {
                              if (!canOpen || isCardLocked) return;
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              LayoutAnimation.configureNext(CARD_TRANSITION);
                              if (isExpanded && !hasCurrentExercise) {
                                setExpandedGroupIndex(-1);
                                return;
                              }
                              setExpandedGroupIndex(groupIndex);
                              setActiveExerciseIndex(focusExerciseIndex);
                            }}
                            disabled={!canOpen || isCardLocked}
                          >
                            <View style={isExpanded ? styles.itemCardHeaderActive : styles.itemCardCollapsed}>
                              <Text style={[styles.exerciseNameText, isExpanded && styles.exerciseNameTextActive, styles.exerciseNameCollapsedFlex]} numberOfLines={1}>
                                {group.exercises.map(ex => ex.exerciseName).join(' + ')}
                              </Text>
                              {!isExpanded ? (
                                <Text style={styles.setCountCollapsed} numberOfLines={1}>
                                  {isCompleted ? 'Done' : `${Math.min(completedRounds + 1, group.totalRounds)}/${group.totalRounds}`}
                                </Text>
                              ) : (
                                <View style={styles.cardHeaderRightCluster}>
                                  <View style={styles.cardHeaderActionSlot}>
                                    {isCompleted ? (
                                      <View style={styles.cardHeaderActionTouchable}>
                                        <IconCheckmark size={18} color={COLORS.successBright} />
                                      </View>
                                    ) : (
                                      <TouchableOpacity
                                        onPress={() => {
                                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                          openExploreDetailSheet(groupIndex, focusExerciseIndex);
                                        }}
                                        activeOpacity={0.7}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        style={styles.cardHeaderActionTouchable}
                                      >
                                        <View style={styles.pencilIconOffset}>
                                          <IconEdit size={18} color={COLORS.textMeta} />
                                        </View>
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>

                          {isExpanded && !isCompleted && (
                            <View style={styles.itemCardExpanded}>
                              {layoutStack ? (
                                <View style={styles.exploreCurrentSummaryCompact}>
                                  <Text style={styles.exploreCurrentSummaryText}>
                                    {`${Math.min(completedRounds + 1, group.totalRounds)} / ${group.totalRounds} sets`}
                                  </Text>
                                </View>
                              ) : (
                                <View style={styles.valuesDisplayRow}>
                                  <View style={styles.valuesDisplayLeft}>
                                    {showWeight && (
                                      <View style={styles.valueColumn}>
                                        <View style={styles.valueRow}>
                                          <Text style={styles.largeValue}>
                                            {formatWeightForLoad(displayVals.weight, useKg)}
                                          </Text>
                                          <Text style={styles.unit}>{weightUnit}</Text>
                                        </View>
                                        {(() => {
                                          const isBarbellMode = getBarbellMode(focusExercise.id);
                                          const barbellWeight = useKg ? 20 : 45;
                                          const weightPerSide = (displayVals.weight - barbellWeight) / 2;
                                          return isBarbellMode && weightPerSide > 0 ? (
                                            <Text style={styles.weightPerSideText}>
                                              {formatWeightForLoad(weightPerSide, useKg)}/side
                                            </Text>
                                          ) : null;
                                        })()}
                                      </View>
                                    )}
                                    <View style={styles.valueRow}>
                                      <Text style={styles.largeValue}>{displayVals.reps}</Text>
                                      <Text style={styles.unit}>{repsUnit}</Text>
                                    </View>
                                  </View>
                                  <Text style={styles.setCountInValues} numberOfLines={1}>
                                    {`${Math.min(completedRounds + 1, group.totalRounds)}/${group.totalRounds}`}
                                  </Text>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                    </View>

                    {layoutStack && isExpanded && !isCompleted && (
                      <View style={styles.exploreSetListBlock}>
                        <Text style={styles.exploreDetailSectionTitle}>Sets</Text>
                        {Array.from({ length: group.totalRounds }, (_, setIndex) => {
                          const setId = `${focusExercise.id}-set-${setIndex}`;
                          const isSetCompleted = completedSets.has(setId);
                          const isSetNext = !isSetCompleted && setIndex === completedRounds;
                          const isSetUpcoming = !isSetCompleted && !isSetNext;
                          const setVals = getSetDisplayValues(
                            focusExercise.id,
                            setIndex,
                            focusExercise.weight ?? 0,
                            focusExercise.reps ?? 0,
                          );
                          const setRepsUnit = focusExercise.isTimeBased ? 'secs' : 'reps';
                          const rowShellStyle = [
                            styles.exploreSetRow,
                            isSetCompleted && styles.exploreSetRowCompleted,
                            !isSetCompleted && isSetNext && styles.exploreSetRowActive,
                            !isSetCompleted && isSetUpcoming && styles.exploreSetRowUpcoming,
                          ];
                          const valueSummary = `${formatWeightForLoad(setVals.weight, useKg)} ${weightUnit} × ${setVals.reps} ${setRepsUnit}`;
                          return (
                            <TouchableOpacity
                              key={setId}
                              style={rowShellStyle}
                              onPress={() => openExploreSetRowEditor(setIndex)}
                              activeOpacity={0.75}
                            >
                              <View style={styles.exploreSetRowCompact}>
                                <View style={styles.exploreSetRowLeft}>
                                  {isSetCompleted && (
                                    <View style={styles.exploreSetDoneIcon}>
                                      <IconCheckmark size={18} color={COLORS.successBright} />
                                    </View>
                                  )}
                                  <Text style={styles.exploreInlineSetNumber}>Set {setIndex + 1}</Text>
                                  {isSetNext && <Text style={styles.exploreSetNextLabel}>next</Text>}
                                  {isSetUpcoming && <Text style={styles.exploreSetUpcomingLabel}>upcoming</Text>}
                                </View>
                                <View style={styles.exploreSetRowRight}>
                                  <Text
                                    style={[styles.exploreSetValueCompact, isSetCompleted && styles.exploreSetValueMuted]}
                                    numberOfLines={1}
                                  >
                                    {valueSummary}
                                  </Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {indicatorActive && (
                      <View style={[styles.externalActionCard, inlineRestActive && styles.externalActionCardDisabled]}>
                        <TouchableOpacity
                          style={styles.externalActionTouchable}
                          onPress={async () => {
                            if (expandedGroupIndex !== groupIndex || activeExerciseIndex !== focusExerciseIndex) {
                              setExpandedGroupIndex(groupIndex);
                              setActiveExerciseIndex(focusExerciseIndex);
                              return;
                            }
                            await handleStart();
                          }}
                          disabled={inlineRestActive}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.cardStartButtonText, inlineRestActive && styles.cardStartButtonTextDisabled]}>
                            {ctaLabel}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              };

              const renderExploreCompletedRows = () => {
                const completedExercises = completedExerciseIndexes.flatMap((groupIndex) => {
                  const group = exerciseGroups[groupIndex];
                  if (!group) return [];
                  return group.exercises.map((exercise) => ({
                    groupIndex,
                    group,
                    exercise,
                    key: `${group.id}-${exercise.id}`,
                  }));
                });

                return completedExercises.map((entry, idx) => (
                  <TouchableOpacity
                    key={entry.key}
                    style={[
                      styles.historyExerciseRow,
                      idx === completedExercises.length - 1 && { borderBottomWidth: 0 },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const exIdx = entry.group.exercises.findIndex(e => e.id === entry.exercise.id);
                      openExploreDetailSheet(entry.groupIndex, exIdx);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.historyExerciseNameColumn}>
                      <Text style={styles.historyExerciseName} numberOfLines={2}>
                        {entry.exercise.exerciseName}
                      </Text>
                    </View>
                    <View style={styles.historyExerciseDataColumn}>
                      {Array.from({ length: entry.group.totalRounds }).map((_, roundIdx) => {
                        const vals = getSetDisplayValues(
                          entry.exercise.id,
                          roundIdx,
                          entry.exercise.weight ?? 0,
                          entry.exercise.reps ?? 0,
                        );
                        const displayWeight = vals.weight;
                        const displayReps = vals.reps;
                        const showWeight = displayWeight > 0;
                        return (
                          <View key={roundIdx} style={styles.historySetDataRow}>
                            {showWeight && (
                              <View style={styles.historySetValueGroup}>
                                <Text style={styles.historySetValue}>
                                  {formatWeightForLoad(displayWeight, useKg)}
                                </Text>
                                <Text style={styles.historySetUnit}>{weightUnit}</Text>
                              </View>
                            )}
                            <View style={styles.historySetValueGroup}>
                              <Text style={styles.historySetValue}>{displayReps}</Text>
                              <Text style={styles.historySetUnit}>
                                {entry.exercise.isTimeBased ? 'secs' : 'reps'}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </TouchableOpacity>
                ));
              };

              const renderExploreCompletedSection = () => (
                <View style={styles.exploreSection}>
                  <TouchableOpacity
                    style={styles.exploreSectionAccordionHeader}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setIsExploreCompletedExpanded(prev => !prev);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.exploreSectionTitle}>Completed</Text>
                    <View
                      style={[
                        styles.exploreSectionAccordionIconWrap,
                        isExploreCompletedExpanded && styles.exploreSectionAccordionIconWrapExpanded,
                      ]}
                    >
                      <IconChevronDown size={20} color={COLORS.accentPrimary} />
                    </View>
                  </TouchableOpacity>
                  {isExploreCompletedExpanded && renderExploreCompletedRows()}
                </View>
              );

              if (isExploreWorkoutComplete) {
                return (
                  renderExploreCompletedSection()
                );
              }

              return (
                <>
                  {currentExercise && exploreCurrentGroupIndex !== null && (
                    <View style={styles.exploreSection}>
                      <Text style={styles.exploreSectionTitle}>Current</Text>
                      {renderExploreCard(exploreCurrentGroupIndex, 'current', 'current-stack')}
                    </View>
                  )}

                  {upNextExercises.length > 0 && (
                    <View style={styles.exploreSection}>
                      <Text style={styles.exploreSectionTitle}>Up next</Text>
                      {upNextExercises.map(index => renderExploreCard(index, 'up-next'))}
                    </View>
                  )}

                  {!isExplorePreStart && completedExerciseIndexes.length > 0 && (
                    renderExploreCompletedSection()
                  )}
                </>
              );
            })()}
          </View>
        ) : allCurrentGroupsComplete ? (
          /* ===== COMPLETED WORKOUT - HISTORY VIEW ===== */
          <View style={styles.historyViewContainer}>
            <View style={styles.historyViewHeader}>
              <IconCheckmark size={16} color={COLORS.successBright} />
              <Text style={styles.historyViewTitle}>{t('workoutComplete')}</Text>
            </View>
            
            {(() => {
              const allExercises = exerciseGroups.flatMap(g => g.exercises);
              const lastExerciseId = allExercises[allExercises.length - 1]?.id;
              return exerciseGroups.map((group) => (
              group.exercises.map((exercise) => {
                const exerciseName = exercise.exerciseName;
                const totalRounds = group.totalRounds;
                const isLast = exercise.id === lastExerciseId;
                
                return (
                  <TouchableOpacity
                    key={exercise.id}
                    style={[styles.historyExerciseRow, isLast && { borderBottomWidth: 0 }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const groupIdx = exerciseGroups.findIndex(g => g.id === group.id);
                      const exIdx = group.exercises.findIndex(e => e.id === exercise.id);
                      setDrawerGroupIndex(groupIdx);
                      setDrawerExerciseIndex(exIdx);
                      setExpandedSetInDrawer(0);
                      setShowAdjustmentDrawer(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.historyExerciseNameColumn}>
                      <Text style={styles.historyExerciseName} numberOfLines={2}>
                        {exerciseName}
                      </Text>
                    </View>
                    <View style={styles.historyExerciseDataColumn}>
                      {Array.from({ length: totalRounds }).map((_, roundIdx) => {
                        const vals = getSetDisplayValues(exercise.id, roundIdx, exercise.weight ?? 0, exercise.reps ?? 0);
                        const displayWeight = vals.weight;
                        const displayReps = vals.reps;
                        const showWeight = displayWeight > 0;
                        
                        return (
                          <View key={roundIdx} style={styles.historySetDataRow}>
                            {showWeight && (
                              <View style={styles.historySetValueGroup}>
                                <Text style={styles.historySetValue}>
                                  {formatWeightForLoad(displayWeight, useKg)}
                                </Text>
                                <Text style={styles.historySetUnit}>{weightUnit}</Text>
                              </View>
                            )}
                            <View style={styles.historySetValueGroup}>
                              <Text style={styles.historySetValue}>{displayReps}</Text>
                              <Text style={styles.historySetUnit}>
                                {exercise.isTimeBased ? 'secs' : 'reps'}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </TouchableOpacity>
                );
              })
            ));
            })()}
          </View>
        ) : (
          /* ===== IN-PROGRESS - NORMAL EXERCISE CARDS ===== */
          <>
        <View style={styles.itemsAccordion}>
          {sortedExerciseGroups.map((group) => {
            const originalIndex = groupIdToOriginalIndex.get(group.id) ?? -1;
            const isExpanded = expandedGroupIndex === originalIndex;
            const currentRound = currentRounds[group.id] || 0;
            const isCompleted = currentRound >= group.totalRounds;
            const isActiveWithTimer = isExpanded && inlineRestActive;
            
            // Whether the indicator column is active for this group
            const indicatorActive = isExpanded && (!isCompleted || inlineRestActive);

            // Keep the active card style while the rest timer is running to prevent padding jump
            const visuallyCompleted = isCompleted && !isActiveWithTimer;
            const groupCardBg = visuallyCompleted ? styles.itemCardDimmed : (isExpanded ? styles.itemCardBorder : styles.itemCardInactive);
            const groupCardFg = visuallyCompleted ? styles.itemCardInnerDimmed : (isExpanded ? styles.itemCardFill : styles.itemCardInnerInactive);

            return (
              <View
                key={group.id}
                testID={`exercise-group-${originalIndex}`}
                style={styles.itemRow}
              >
                {/* Single card wrapping all exercises in the group */}
                <View style={styles.exerciseCardsColumn}>
                  <View style={groupCardBg}>
                    <View style={groupCardFg}>
                      {group.exercises.map((exercise, exIndex) => {
                        // For completed groups, show the last completed round's values
                        const displayRound = isCompleted ? Math.max(0, currentRound - 1) : currentRound;
                        const setId = `${exercise.id}-set-${displayRound}`;
                        const displayVals = getSetDisplayValues(exercise.id, displayRound, exercise.weight ?? 0, exercise.reps ?? 0);
                        const displayWeight = displayVals.weight;
                        const displayReps = displayVals.reps;
                        const showWeight = displayWeight > 0;
                        const isActive = expandedGroupIndex === originalIndex && activeExerciseIndex === exIndex;
                        const shouldBeOpen = isActive;
                        const displayActive = isActive;
                        const isExerciseCompleted = completedSets.has(setId);
                        const repsUnit = exercise.isTimeBased ? 'secs' : 'reps';

                        return (
                          <React.Fragment key={exercise.id}>
                            {/* Divider between exercises in a superset */}
                            {exIndex > 0 && <View style={styles.supersetDivider} />}
                            <TouchableOpacity
                              activeOpacity={1}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                if (isCompleted || isExerciseCompleted) {
                                  setDrawerGroupIndex(originalIndex);
                                  setDrawerExerciseIndex(exIndex);
                                  const lastRound = Math.max(0, (currentRounds[group.id] || 0) - 1);
                                  setExpandedSetInDrawer(lastRound);
                                  setShowAdjustmentDrawer(true);
                                } else if (displayActive) {
                                  setDrawerGroupIndex(null);
                                  setDrawerExerciseIndex(null);
                                  const currentRound = currentRounds[group.id] || 0;
                                  setExpandedSetInDrawer(currentRound);
                                  setShowAdjustmentDrawer(true);
                                } else if (expandedGroupIndex !== originalIndex) {
                                  // Switch cards immediately so active/inactive colors and CTA move together.
                                  setExpandedGroupIndex(originalIndex);
                                  setActiveExerciseIndex(exIndex);
                                } else if (activeExerciseIndex !== exIndex) {
                                  cardLog('tap same group, switch exercise', { group: originalIndex, exIndex });
                                  setActiveExerciseIndex(exIndex);
                                }
                              }}
                            >
                              <AnimatedCardContainer
                                shouldBeOpen={shouldBeOpen}
                                isClosing={false}
                                isOpening={false}
                              >
                                {(metricsStyle, actionStyle) => (
                                  <>
                                    {/* GROUP A — shared header. Stays mounted and stable. */}
                                    <View style={[
                                      displayActive ? styles.itemCardHeaderActive : styles.itemCardCollapsed,
                                      isExerciseCompleted && styles.exerciseContentDimmed,
                                    ]}>
                                      <Text style={[
                                        styles.exerciseNameText,
                                        isExpanded && styles.exerciseNameTextActive,
                                        styles.exerciseNameCollapsedFlex,
                                      ]} numberOfLines={1}>
                                        {exercise.exerciseName}
                                      </Text>
                                      {!displayActive ? (
                                        <Text style={styles.setCountCollapsed} numberOfLines={1}>
                                          {`${Math.min((currentRounds[group.id] || 0) + 1, group.totalRounds)}/${group.totalRounds}`}
                                        </Text>
                                      ) : (
                                        <View style={styles.cardHeaderRightCluster}>
                                          <View style={styles.cardHeaderActionSlot}>
                                            {isCompleted || (displayActive && inlineRestActive && inlineRestIsLastSet) ? (
                                              <View style={styles.cardHeaderActionTouchable}>
                                                <IconCheckmark size={18} color={COLORS.successBright} />
                                              </View>
                                            ) : (
                                              <TouchableOpacity
                                                onPress={() => {
                                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                  setDrawerGroupIndex(null);
                                                  setDrawerExerciseIndex(null);
                                                  const cr = currentRounds[group.id] || 0;
                                                  setExpandedSetInDrawer(cr);
                                                  setShowAdjustmentDrawer(true);
                                                }}
                                                activeOpacity={0.7}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                style={styles.cardHeaderActionTouchable}
                                              >
                                                <View style={styles.pencilIconOffset}>
                                                  <IconEdit size={18} color={COLORS.textMeta} />
                                                </View>
                                              </TouchableOpacity>
                                            )}
                                          </View>
                                        </View>
                                      )}
                                    </View>
                                    {/* GROUP B + C — overlapped with shell; slight metrics -> action stagger */}
                                    <View style={styles.itemCardExpanded}>
                                      <AnimatedReanimated.View style={metricsStyle}>
                                        {group.exercises.length === 1 ? (
                                          <View style={styles.valuesDisplayRow}>
                                            <View style={styles.valuesDisplayLeft}>
                                              {showWeight && (
                                                <View style={styles.valueColumn}>
                                                  <View style={styles.valueRow}>
                                                    <Text style={styles.largeValue}>
                                                      {formatWeightForLoad(displayWeight, useKg)}
                                                    </Text>
                                                    <View style={styles.unitWithDelta}>
                                                      {(() => {
                                                        const prog = progressionValuesRef.current[exercise.id];
                                                        return prog && prog.weightDelta > 0 ? (
                                                          <Text style={styles.deltaLabel} numberOfLines={1}>↑</Text>
                                                        ) : null;
                                                      })()}
                                                      <Text style={styles.unit}>{weightUnit}</Text>
                                                    </View>
                                                  </View>
                                                  {(() => {
                                                    const isBarbellMode = getBarbellMode(exercise.id);
                                                    const barbellWeight = useKg ? 20 : 45;
                                                    const weightPerSide = (displayWeight - barbellWeight) / 2;
                                                    return isBarbellMode && weightPerSide > 0 ? (
                                                      <Text style={styles.weightPerSideText}>
                                                        {formatWeightForLoad(weightPerSide, useKg)}/side
                                                      </Text>
                                                    ) : null;
                                                  })()}
                                                </View>
                                              )}
                                              <View style={styles.valueRow}>
                                                <Text style={styles.largeValue}>{displayReps}</Text>
                                                <View style={styles.unitWithDelta}>
                                                  {(() => {
                                                    const prog = progressionValuesRef.current[exercise.id];
                                                    return prog && prog.repsDelta > 0 ? (
                                                      <Text style={styles.deltaLabel} numberOfLines={1}>↑</Text>
                                                    ) : null;
                                                  })()}
                                                  <Text style={styles.unit}>{repsUnit}</Text>
                                                </View>
                                              </View>
                                            </View>
                                            <Text style={styles.setCountInValues} numberOfLines={1}>
                                              {inlineRestActive
                                                ? `${Math.min(currentRound + 1, group.totalRounds)}/${group.totalRounds}`
                                                : `${currentRound + 1}/${group.totalRounds}`}
                                            </Text>
                                          </View>
                                        ) : (
                                          <View style={styles.valuesInlineRow}>
                                            {showWeight && (
                                              <View style={styles.valueRow}>
                                                <Text style={styles.largeValue}>
                                                  {formatWeightForLoad(displayWeight, useKg)}
                                                </Text>
                                                <View style={styles.unitWithDelta}>
                                                  {(() => {
                                                    const prog = progressionValuesRef.current[exercise.id];
                                                    return prog && prog.weightDelta > 0 ? (
                                                      <Text style={styles.deltaLabel} numberOfLines={1}>↑</Text>
                                                    ) : null;
                                                  })()}
                                                  <Text style={styles.unit}>{weightUnit}</Text>
                                                </View>
                                              </View>
                                            )}
                                            <View style={styles.valueRow}>
                                              <Text style={styles.largeValue}>{displayReps}</Text>
                                              <View style={styles.unitWithDelta}>
                                                {(() => {
                                                  const prog = progressionValuesRef.current[exercise.id];
                                                  return prog && prog.repsDelta > 0 ? (
                                                    <Text style={styles.deltaLabel} numberOfLines={1}>↑</Text>
                                                  ) : null;
                                                })()}
                                                <Text style={styles.unit}>{repsUnit}</Text>
                                              </View>
                                            </View>
                                            {showWeight && (() => {
                                              const isBarbellMode = getBarbellMode(exercise.id);
                                              const barbellWeight = useKg ? 20 : 45;
                                              const weightPerSide = (displayWeight - barbellWeight) / 2;
                                              return isBarbellMode && weightPerSide > 0 ? (
                                                <Text style={styles.weightPerSideText}>
                                                  {formatWeightForLoad(weightPerSide, useKg)}/side
                                                </Text>
                                              ) : null;
                                            })()}
                                            <Text style={styles.setCountInValues} numberOfLines={1}>
                                              {inlineRestActive
                                                ? `${Math.min(currentRound + 1, group.totalRounds)}/${group.totalRounds}`
                                                : `${currentRound + 1}/${group.totalRounds}`}
                                            </Text>
                                          </View>
                                        )}
                                      </AnimatedReanimated.View>
                                      {/* Group C action row moved outside card */}
                                    </View>
                                  </>
                                )}
                              </AnimatedCardContainer>
                            </TouchableOpacity>
                          </React.Fragment>
                        );
                      })}
                    </View>
                  </View>
                </View>
                {indicatorActive && (
                  <View style={styles.externalActionCard}>
                    <View style={styles.inlineRestProgressTrack}>
                      <Animated.View style={[styles.inlineRestProgressFill, { width: inlineRestProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
                    </View>
                    <Animated.View
                      style={[styles.externalActionOverlay, { opacity: buttonLabelOpacity }]}
                      pointerEvents={inlineRestActive ? 'none' : 'auto'}
                    >
                      <TouchableOpacity
                        testID="start-button"
                        style={styles.externalActionTouchable}
                        onPress={handleStart}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.cardStartButtonText}>
                          {group.exercises[activeExerciseIndex]?.isTimeBased ? t('startTimer') : t('markAsCompleted')}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                    <View
                      style={styles.externalInlineRestControls}
                      pointerEvents={inlineRestActive ? 'auto' : 'none'}
                    >
                      <Animated.View style={{ opacity: restStagger.timerLabel, transform: [{ translateX: restStagger.timerLabel.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }}>
                        <Text style={[styles.inlineRestTime, inlineRestActive && styles.inlineRestTimeActive]}>
                          {Math.floor(inlineRestTimeLeft / 60)}:{String(inlineRestTimeLeft % 60).padStart(2, '0')}
                        </Text>
                      </Animated.View>
                      <Animated.View style={{ opacity: restStagger.pauseIcon, transform: [{ translateX: restStagger.pauseIcon.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }}>
                        <TouchableOpacity onPress={handleInlineRestPauseToggle} activeOpacity={0.7} style={styles.inlineRestIconBtn}>
                          {inlineRestPaused ? <IconPlay size={20} color={inlineRestActive ? COLORS.accentPrimary : COLORS.text} /> : <IconPause size={20} color={inlineRestActive ? COLORS.accentPrimary : COLORS.text} />}
                        </TouchableOpacity>
                      </Animated.View>
                      <Animated.View style={{ opacity: restStagger.skipIcon, transform: [{ translateX: restStagger.skipIcon.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }}>
                        <TouchableOpacity onPress={handleInlineRestSkip} activeOpacity={0.7} style={styles.inlineRestIconBtn}>
                          <IconSkip size={20} color={inlineRestActive ? COLORS.accentPrimary : COLORS.text} />
                        </TouchableOpacity>
                      </Animated.View>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
          </>
        )}
        </ScrollView>
        )}
      </AnimatedReanimated.View>

      
      {/* Timer Sheet */}
      {expandedGroupIndex >= 0 && exerciseGroups[expandedGroupIndex] && (
        <SetTimerSheet
          visible={showTimer && executionMode !== 'explore-v2'}
          onComplete={() => {
            // CRITICAL: Do not call advanceToNext (or any setState) in this tick. Defer to next frame + macrotask so we are never in the same commit as SetTimerSheet (fixes "useInsertionEffect must not schedule updates").
            const currentGroup = exerciseGroups[expandedGroupIndex];
            if (!currentGroup) return;
            const captured = {
              workoutKey,
              workoutTemplateId,
              type,
              expandedGroupIndex,
              exerciseGroups,
            };
            const runWork = () => {
              const group = captured.exerciseGroups[captured.expandedGroupIndex];
              if (!group) return;
              const pending = pendingTimerSetRef.current;
              pendingTimerSetRef.current = null;

              const state = useStore.getState();
              const storeCompletedItems =
                captured.type === 'warmup'
                  ? state.getWarmupCompletion(captured.workoutKey, captured.workoutTemplateId).completedItems
                  : captured.type === 'core'
                    ? state.getAccessoryCompletion(captured.workoutKey, captured.workoutTemplateId).completedItems
                    : state.getMainCompletion(captured.workoutKey).completedItems;
              const newCompletedSets = new Set(storeCompletedItems);

              if (pending) {
                newCompletedSets.add(`${pending.exerciseId}-set-${pending.round}`);
              }

              let roundJustCompleted = -1;
              for (let r = 0; r < group.totalRounds; r++) {
                const allDone = group.exercises.every(ex =>
                  newCompletedSets.has(`${ex.id}-set-${r}`),
                );
                if (allDone) roundJustCompleted = r;
                else break;
              }
              const allExercisesComplete = roundJustCompleted >= 0;

              console.log('⏰ [Timer onComplete]', {
                workoutKey: captured.workoutKey,
                type: captured.type,
                storeCount: storeCompletedItems.length,
                pending: pending ? `${pending.exerciseId}-set-${pending.round}` : null,
                roundJustCompleted,
                allExercisesComplete,
                newCompletedSetsSize: newCompletedSets.size,
              });

              advanceToNext(allExercisesComplete, newCompletedSets);
            };
            requestAnimationFrame(() => setTimeout(runWork, 0));
          }}
          onClose={() => setShowTimer(false)}
          workoutName={template?.name}
          exerciseName={exerciseGroups[expandedGroupIndex].exercises[activeExerciseIndex]?.exerciseName}
          currentSet={(currentRounds[exerciseGroups[expandedGroupIndex].id] || 0) + 1}
          totalSets={exerciseGroups[expandedGroupIndex].totalRounds}
          nextExerciseName={(() => {
            // Find the next exercise that will come after the current group completes
            const currentGroup = exerciseGroups[expandedGroupIndex];
            const currentRound = currentRounds[currentGroup.id] || 0;
            const isLastRound = (currentRound + 1) >= currentGroup.totalRounds;
            
            if (!isLastRound) return undefined; // Not the last set, no need for next exercise
            
            // Find the next incomplete group (after current, then wrap around)
            let nextGroupIndex = exerciseGroups.findIndex((group, idx) => {
              if (idx <= expandedGroupIndex) return false;
              const rounds = currentRounds[group.id] || 0;
              return rounds < group.totalRounds;
            });
            
            if (nextGroupIndex < 0) {
              nextGroupIndex = exerciseGroups.findIndex((group, idx) => {
                if (idx >= expandedGroupIndex) return false;
                const rounds = currentRounds[group.id] || 0;
                return rounds < group.totalRounds;
              });
            }
            
            if (nextGroupIndex >= 0) {
              return exerciseGroups[nextGroupIndex].exercises[0]?.exerciseName;
            }
            return undefined; // No next exercise (workout complete)
          })()}
          isExerciseTimerPhase={isExerciseTimerPhase}
          exerciseDuration={(() => {
            const activeEx = exerciseGroups[expandedGroupIndex]?.exercises[activeExerciseIndex];
            if (!activeEx) return 30;
            const currentRound = currentRounds[exerciseGroups[expandedGroupIndex].id] ?? 0;
            const displayVals = getSetDisplayValues(activeEx.id, currentRound, activeEx.weight ?? 0, activeEx.reps ?? 0);
            return Number(displayVals.reps) || 30;
          })()}
          onExerciseTimerComplete={handleComplete}
          skipRestPhase={type !== 'main'}
          isPerSide={exerciseGroups[expandedGroupIndex].exercises[activeExerciseIndex]?.isPerSide}
          restTimeOverride={localRestOverride}
        />
      )}

      {/* Explore-only: exercise settings (setup, history, actions). Sets live on the execution card. */}
      {(executionMode === 'explore' || executionMode === 'explore-v2') && exploreDetailGroup && exploreDetailExercise && (
        <BottomDrawer
          visible={showExploreDetailSheet}
          onClose={() => {
            setShowExploreDetailSheet(false);
            setExploreDetailGroupIndex(null);
            setShowAllExploreHistory(false);
            saveSession();
          }}
          maxHeight="90%"
          scrollable={true}
          backgroundColor={COLORS.backgroundCanvas}
          keyboardShouldPersistTaps="always"
        >
          <View style={styles.exploreDetailSheetContent}>
            <View style={styles.exploreDetailHeader}>
              <Text style={styles.exploreDetailTitle} numberOfLines={2}>
                {exploreDetailExercise.exerciseName}
              </Text>
              <Text style={styles.exploreDetailSheetSubtitle}>Exercise settings</Text>
            </View>

            <View style={styles.exploreDetailSection}>
              <Text style={styles.exploreDetailSectionTitle}>Exercise setup</Text>
              {(() => {
                const setupVals = getSetDisplayValues(
                  exploreDetailExercise.id,
                  exploreDetailCurrentRound,
                  exploreDetailExercise.weight ?? 0,
                  exploreDetailExercise.reps ?? 0,
                );
                const setupWeight = localValues[`${exploreDetailExercise.id}-set-${exploreDetailCurrentRound}`]?.weight ?? setupVals.weight;
                const showBarbellToggle = setupWeight > (useKg ? 20 : 45);
                const isBarbellMode = getBarbellMode(exploreDetailExercise.id);
                return (
                  <>
                    <View style={styles.exploreSetupRow}>
                      <View style={styles.exploreSetupLabelBlock}>
                        <Text style={styles.exploreSetupLabel}>Weight format</Text>
                        <Text style={styles.exploreSetupDesc}>Plates per side</Text>
                      </View>
                      <Toggle
                        label=""
                        hideLabel
                        value={isBarbellMode}
                        onValueChange={() => setBarbellMode(exploreDetailExercise.id, !isBarbellMode)}
                        disabled={!showBarbellToggle}
                      />
                    </View>
                    <View style={styles.exploreSetupRow}>
                      <View style={styles.exploreSetupLabelBlock}>
                        <Text style={styles.exploreSetupLabel}>Structure</Text>
                        <Text style={styles.exploreSetupDesc}>Both sides</Text>
                      </View>
                      <Toggle
                        label=""
                        hideLabel
                        value={exploreDetailExercise.isPerSide ?? false}
                        onValueChange={() =>
                          setPerSideOverrides(prev => ({
                            ...prev,
                            [exploreDetailExercise.id]: !(exploreDetailExercise.isPerSide ?? false),
                          }))
                        }
                      />
                    </View>
                    <View style={styles.exploreSetupRow}>
                      <View style={styles.exploreSetupLabelBlock}>
                        <Text style={styles.exploreSetupLabel}>Tracking type</Text>
                        <Text style={styles.exploreSetupDesc}>Timed instead of reps</Text>
                      </View>
                      <Toggle
                        label=""
                        hideLabel
                        value={exploreDetailExercise.isTimeBased ?? false}
                        onValueChange={() =>
                          setTimeBasedOverrides(prev => ({
                            ...prev,
                            [exploreDetailExercise.id]: !(exploreDetailExercise.isTimeBased ?? false),
                          }))
                        }
                      />
                    </View>
                    {type === 'main' && (() => {
                      const libId = (exploreDetailExercise as any).exerciseId || exploreDetailExercise.id;
                      const currentGroup = progressionGroups.find(g => g.exerciseIds.includes(libId));
                      const options: { key: string | null; label: string }[] = [
                        { key: null, label: 'None' },
                        ...progressionGroups.map(g => ({
                          key: g.id,
                          label: g.name === 'Main Upper' ? 'Upper' : g.name === 'Main Lower' ? 'Lower' : g.name,
                        })),
                      ];
                      return (
                        <View style={styles.exploreProgressionGroupSection}>
                          <Text style={styles.exploreDetailSectionTitle}>Progression Group</Text>
                          <View style={styles.exploreProgressionPills}>
                            {options.map(opt => {
                              const selected = opt.key === (currentGroup?.id ?? null);
                              return (
                                <TouchableOpacity
                                  key={opt.key ?? 'none'}
                                  style={[styles.progressionGroupPill, selected && styles.progressionGroupPillSelected]}
                                  activeOpacity={0.7}
                                  onPress={async () => {
                                    if (selected) return;
                                    if (currentGroup) {
                                      await updateProgressionGroup(currentGroup.id, {
                                        exerciseIds: currentGroup.exerciseIds.filter(id => id !== libId),
                                      });
                                    }
                                    if (opt.key) {
                                      const target = progressionGroups.find(g => g.id === opt.key);
                                      if (target) {
                                        await updateProgressionGroup(target.id, {
                                          exerciseIds: [...target.exerciseIds, libId],
                                        });
                                      }
                                    }
                                  }}
                                >
                                  <Text style={[styles.progressionGroupPillText, selected && styles.progressionGroupPillTextSelected]}>
                                    {opt.label}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })()}
                  </>
                );
              })()}
            </View>

            <View style={styles.exploreDetailSection}>
              <Text style={styles.exploreDetailSectionTitle}>Recent history</Text>
              {exploreDetailHistory.length === 0 ? (
                <Text style={styles.exploreDetailEmptyText}>{t('noHistoryRecordedYet')}</Text>
              ) : (
                <>
                  {(showAllExploreHistory ? exploreDetailHistory.slice(-5) : exploreDetailHistory.slice(-2)).map((workout) => {
                    const repsSummary = workout.sets.map(s => s.reps).join(', ');
                    const firstWeight = workout.sets[0]?.weight ?? 0;
                    return (
                      <View key={workout.date} style={styles.exploreHistoryRow}>
                        <Text style={styles.exploreHistoryText}>
                          {dayjs(workout.date).format('MMM D')} - {formatWeightForLoad(firstWeight, useKg)} {weightUnit} x {repsSummary}
                        </Text>
                      </View>
                    );
                  })}
                  {exploreDetailHistory.length > 2 && (
                    <TouchableOpacity
                      style={styles.exploreViewAllHistoryButton}
                      onPress={() => setShowAllExploreHistory(prev => !prev)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.exploreViewAllHistoryText}>
                        {showAllExploreHistory ? t('showLess') : t('viewAll')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            <View style={styles.exploreDetailActionsSection}>
              <View style={styles.exploreDetailSheetDivider} />
              <View style={styles.exploreActionsRow}>
                <TouchableOpacity
                  style={styles.exploreActionCell}
                  onPress={() => {
                    if (!exploreDetailExercise) return;
                    if (exploreDetailGroupIndex !== null) {
                      setExpandedGroupIndex(exploreDetailGroupIndex);
                      setActiveExerciseIndex(exploreDetailExerciseIndex);
                    }
                    setShowExploreDetailSheet(false);
                    handleSwap(exploreDetailExercise.id);
                  }}
                  activeOpacity={0.7}
                >
                  <IconSwap size={18} color={COLORS.textMeta} />
                  <Text style={[styles.exploreActionText, styles.exploreActionCellLabel]} numberOfLines={1}>
                    Swap exercise
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.exploreActionCell}
                  onPress={() => {
                    Alert.alert(
                      t('deleteExerciseTitle'),
                      t('deleteExerciseMessage'),
                      [
                        { text: t('cancel'), style: 'cancel' },
                        {
                          text: t('remove'),
                          style: 'destructive',
                          onPress: async () => {
                            await removeExerciseFromWorkout(exploreDetailExercise);
                            setShowExploreDetailSheet(false);
                            setExploreDetailGroupIndex(null);
                          },
                        },
                      ],
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <IconTrash size={18} color={COLORS.signalNegative} />
                  <Text style={[styles.exploreActionTextDanger, styles.exploreActionCellLabel]} numberOfLines={1}>
                    {t('remove')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </BottomDrawer>
      )}

      {/* Explore-only: compact sheet to edit one set (not inline in the current card) */}
      {(executionMode === 'explore' || executionMode === 'explore-v2') &&
        showExploreSetEditor &&
        exploreExecutionEditTarget &&
        exploreSetEditorSetIndex !== null && (
          <BottomDrawer
            visible={true}
            onClose={closeExploreSetEditor}
            maxHeight="52%"
            scrollable={true}
            backgroundColor={COLORS.backgroundCanvas}
            keyboardShouldPersistTaps="always"
          >
            <View style={styles.exploreSetEditorSheet}>
              <Text style={styles.exploreSetEditorTitle}>
                Set {exploreSetEditorSetIndex + 1}
              </Text>
              <Text style={styles.exploreSetEditorExerciseName} numberOfLines={2}>
                {exploreExecutionEditTarget.exercise.exerciseName}
              </Text>
              <View style={styles.exploreSetEditorInputsColumn}>
                <View style={styles.exploreSetEditInputGroup}>
                  <TextInput
                    ref={exploreEditWeightRef}
                    style={[styles.exploreSetEditInput, styles.exploreSetEditorInputWide]}
                    value={exploreEditDraft?.weightStr ?? ''}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    inputAccessoryViewID={Platform.OS === 'ios' ? EXPLORE_SET_EDIT_ACCESSORY_ID : undefined}
                    onFocus={() => {
                      exploreEditActiveFieldRef.current = 'weight';
                    }}
                    onChangeText={text => {
                      setExploreEditDraft(prev => {
                        const base = prev ?? { weightStr: '', repsStr: '' };
                        const next = { ...base, weightStr: text };
                        exploreEditDraftRef.current = next;
                        return next;
                      });
                    }}
                    onEndEditing={() => flushExploreSetEditorDraftToLocal()}
                    returnKeyType={Platform.OS === 'android' ? 'next' : 'default'}
                    onSubmitEditing={() => exploreEditRepsRef.current?.focus()}
                  />
                  <Text style={styles.exploreSetEditUnit}>{weightUnit}</Text>
                </View>
                <View style={styles.exploreSetEditInputGroup}>
                  <TextInput
                    ref={exploreEditRepsRef}
                    style={[styles.exploreSetEditInput, styles.exploreSetEditorInputWide]}
                    value={exploreEditDraft?.repsStr ?? ''}
                    keyboardType="number-pad"
                    selectTextOnFocus
                    inputAccessoryViewID={Platform.OS === 'ios' ? EXPLORE_SET_EDIT_ACCESSORY_ID : undefined}
                    onFocus={() => {
                      exploreEditActiveFieldRef.current = 'reps';
                    }}
                    onChangeText={text => {
                      setExploreEditDraft(prev => {
                        const base = prev ?? { weightStr: '', repsStr: '' };
                        const next = { ...base, repsStr: text };
                        exploreEditDraftRef.current = next;
                        return next;
                      });
                    }}
                    onEndEditing={() => flushExploreSetEditorDraftToLocal()}
                    returnKeyType="done"
                    onSubmitEditing={closeExploreSetEditor}
                  />
                  <Text style={styles.exploreSetEditUnit}>
                    {exploreExecutionEditTarget.exercise.isTimeBased ? 'secs' : 'reps'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.exploreSetEditorSaveBtn} onPress={closeExploreSetEditor} activeOpacity={0.85}>
                <Text style={styles.exploreSetEditorSaveText}>Done</Text>
              </TouchableOpacity>
              {Platform.OS === 'ios' && (
                <InputAccessoryView nativeID={EXPLORE_SET_EDIT_ACCESSORY_ID}>
                  <View style={styles.exploreSetEditorKeyboardAccessory}>
                    <TouchableOpacity style={styles.exploreSetEditorKeyboardDone} onPress={closeExploreSetEditor} activeOpacity={0.8}>
                      <Text style={styles.exploreSetEditorKeyboardDoneText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </InputAccessoryView>
              )}
            </View>
          </BottomDrawer>
        )}
      
      {/* Adjustment Drawer */}
      {(() => {
        const drawerGrpIdx = drawerGroupIndex ?? expandedGroupIndex;
        const drawerExIdx = drawerExerciseIndex ?? activeExerciseIndex;
        return (
      <BottomDrawer
        visible={executionMode === 'current' && showAdjustmentDrawer}
        onClose={() => {
          setShowAdjustmentDrawer(false);
          setDrawerGroupIndex(null);
          setDrawerExerciseIndex(null);
          // Re-save session to persist any value changes made in the drawer
          saveSession();
        }}
        maxHeight="90%"
        scrollable={true}
        backgroundColor={COLORS.backgroundCanvas}
        keyboardShouldPersistTaps="always"
      >
        <View style={styles.adjustmentDrawerContent}>
          {/* Title Row with Action Buttons */}
          <View style={styles.drawerTitleRow}>
            <Text style={styles.adjustmentDrawerTitle} numberOfLines={2}>
              {drawerGrpIdx >= 0 && exerciseGroups[drawerGrpIdx]?.exercises[drawerExIdx]?.exerciseName || t('adjustValues')}
            </Text>
            {drawerGrpIdx >= 0 && exerciseGroups[drawerGrpIdx] && exerciseGroups[drawerGrpIdx].exercises[drawerExIdx] && (
              <View style={styles.drawerActionButtons}>
                <TouchableOpacity
                  style={styles.drawerIconButton}
                  onPress={() => setShowExerciseSettingsMenu(true)}
                  activeOpacity={0.7}
                >
                  <IconMenu size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          {drawerGrpIdx >= 0 && exerciseGroups[drawerGrpIdx] && exerciseGroups[drawerGrpIdx].exercises[drawerExIdx] ? (
            <View style={styles.allSetsContainer}>
              {Array.from({ length: exerciseGroups[drawerGrpIdx].totalRounds }, (_, setIndex) => {
                const currentGroup = exerciseGroups[drawerGrpIdx];
                const activeExercise = currentGroup.exercises[drawerExIdx];
                const isBarbellMode = getBarbellMode(activeExercise.id);
                const repsUnit = activeExercise.isTimeBased ? 'secs' : 'reps';
                const setId = `${activeExercise.id}-set-${setIndex}`;
                const isCompleted = completedSets.has(setId);
                const isExpanded = expandedSetInDrawer === setIndex;
                const currentRound = currentRounds[currentGroup.id] || 0;
                const isActive = setIndex === currentRound;
                
                // Get values for this specific set — read from session/store if localValues doesn't have it
                const drawerSetVals = getSetDisplayValues(activeExercise.id, setIndex, activeExercise.weight ?? 0, activeExercise.reps ?? 0);
                const displayWeight = drawerSetVals.weight;
                const displayReps = drawerSetVals.reps;
                const showBarbellToggle = displayWeight > (useKg ? 20 : 45);
                
                // Initialize localValues for this set if needed (use session-aware values)
                if (!localValues[setId]) {
                  let weightToUse = drawerSetVals.weight;
                  let repsToUse = drawerSetVals.reps;
                  
                  if (setIndex > 0) {
                    const prevSetId = `${activeExercise.id}-set-${setIndex - 1}`;
                    if (localValues[prevSetId]) {
                      weightToUse = localValues[prevSetId].weight;
                      repsToUse = localValues[prevSetId].reps;
                    }
                  }
                  
                  setLocalValues(prev => ({
                    ...prev,
                    [setId]: {
                      weight: weightToUse,
                      reps: repsToUse,
                    },
                  }));
                }
                
                return (
                  <View key={setId} style={styles.setCard}>
                      {/* Next label for active set */}
                      {isActive && !isCompleted && (
                        <View style={styles.inProgressBadge}>
                          <NextLabel />
                        </View>
                      )}
                      {/* Set Header - Always visible, tappable */}
                      <TouchableOpacity
                        style={[styles.setHeader, isExpanded && styles.setHeaderExpanded]}
                        onPress={() => setExpandedSetInDrawer(isExpanded ? -1 : setIndex)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.setHeaderLeft}>
                          {!isExpanded && (
                            <View style={styles.setPreviewRow}>
                              <View style={styles.setPreviewValue}>
                                <Text style={styles.setPreviewValueText}>
                                  {formatWeightForLoad(displayWeight, useKg)}
                                </Text>
                                <Text style={styles.setPreviewUnit}>{weightUnit}</Text>
                              </View>
                              <View style={styles.setPreviewValue}>
                                <Text style={styles.setPreviewValueText}>{displayReps}</Text>
                                <Text style={styles.setPreviewUnit}>{repsUnit}</Text>
                              </View>
                            </View>
                          )}
                        </View>
                        {isCompleted && (
                          <View style={styles.completedBadge}>
                            <IconCheckmark size={16} color={COLORS.successBright} />
                          </View>
                        )}
                      </TouchableOpacity>
                      
                      {/* Set Controls - Only visible when expanded */}
                      {isExpanded && (
                        <View style={styles.setControls}>
                          <View style={styles.drawerInputRow}>
                            {/* Weight Input */}
                            <View style={styles.drawerInputGroup}>
                              <TextInput
                                style={styles.drawerInput}
                                defaultValue={formatWeightForLoad(displayWeight, useKg)}
                                keyboardType="decimal-pad"
                                selectTextOnFocus
                                onEndEditing={(e) => {
                                  const text = e.nativeEvent.text.trim();
                                  const parsed = parseFloat(text);
                                  if (text === '' || isNaN(parsed) || parsed < 0) return;
                                  const rounded = Math.round(parsed * 2) / 2; // snap to nearest 0.5
                                  const newWeight = fromDisplayWeight(rounded, useKg);
                                  const totalRounds = currentGroup.totalRounds;
                                  setLocalValues(prev => {
                                    const current = prev[setId] ?? { weight: displayWeight, reps: displayReps };
                                    return applyForwardPropagationForExerciseRounds(
                                      prev,
                                      activeExercise.id,
                                      setIndex,
                                      totalRounds,
                                      completedSets,
                                      setId,
                                      { weight: newWeight, reps: current.reps },
                                    );
                                  });
                                }}
                              />
                              <Text style={styles.drawerInputUnit}>{weightUnit}</Text>
                            </View>
                            {/* Reps Input */}
                            <View style={styles.drawerInputGroup}>
                              <TextInput
                                style={styles.drawerInput}
                                defaultValue={String(displayReps)}
                                keyboardType="number-pad"
                                selectTextOnFocus
                                onEndEditing={(e) => {
                                  const text = e.nativeEvent.text.trim();
                                  const parsed = parseInt(text, 10);
                                  if (text === '' || isNaN(parsed) || parsed < 1) return;
                                  const totalRounds = currentGroup.totalRounds;
                                  setLocalValues(prev => {
                                    const current = prev[setId] ?? { weight: displayWeight, reps: displayReps };
                                    return applyForwardPropagationForExerciseRounds(
                                      prev,
                                      activeExercise.id,
                                      setIndex,
                                      totalRounds,
                                      completedSets,
                                      setId,
                                      { weight: current.weight, reps: parsed },
                                    );
                                  });
                                }}
                              />
                              <Text style={styles.drawerInputUnit}>{repsUnit}</Text>
                            </View>
                          </View>
                          {isBarbellMode && (() => {
                            const barbellWeight = useKg ? 20 : 45;
                            const weightPerSide = (displayWeight - barbellWeight) / 2;
                            return weightPerSide > 0 ? (
                              <Text style={styles.weightPerSideText}>
                                {formatWeightForLoad(weightPerSide, useKg)}/side
                              </Text>
                            ) : null;
                          })()}
                        </View>
                      )}
                    </View>
                  );
              })}
            </View>
          ) : null}
          
          {/* Exercise History - always show section; show empty state when no data */}
          {drawerGrpIdx >= 0 && exerciseGroups[drawerGrpIdx] && (() => {
            const activeExercise = exerciseGroups[drawerGrpIdx].exercises[drawerExIdx];
            if (!activeExercise) return null;

            const exerciseHistory = getExerciseHistoryForDrawer(activeExercise.id, activeExercise.exerciseId);
            const workoutsToShow = exerciseHistory.length > 0
              ? (showExerciseHistory ? exerciseHistory.slice(-3) : exerciseHistory.slice(-1))
              : [];

            return (
              <>
                <View style={styles.historyFullBleedDivider} />
                <View style={styles.historySection}>
                  {exerciseHistory.length === 0 ? (
                    <View style={styles.historyRow}>
                      <View style={styles.historyLeftColumn}>
                        <Text style={styles.historyLabel}>{t('latestExerciseLog')}</Text>
                        <Text style={styles.historyEmptyText}>{t('noHistoryRecordedYet')}</Text>
                      </View>
                    </View>
                  ) : (
                    workoutsToShow.map((workout, workoutIndex) => (
                      <View key={workout.date}>
                        <View style={styles.historyRow}>
                          <View style={styles.historyLeftColumn}>
                            {workoutIndex === workoutsToShow.length - 1 && (
                              <Text style={styles.historyLabel}>{t('latestExerciseLog')}</Text>
                            )}
                            <Text style={styles.historyDateLine}>
                              {dayjs(workout.date).format('MMMM D')}{getOrdinalSuffix(dayjs(workout.date).date())}
                            </Text>
                            {workoutIndex === workoutsToShow.length - 1 && exerciseHistory.length > 1 && (
                              <TouchableOpacity
                                style={styles.viewAllButton}
                                onPress={() => setShowExerciseHistory(!showExerciseHistory)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.viewAllText}>
                                  {showExerciseHistory ? t('showLess') : t('viewAll')}
                                </Text>
                                <View style={{ transform: [{ rotate: showExerciseHistory ? '180deg' : '0deg' }] }}>
                                  <IconChevronDown size={16} color={COLORS.accentPrimary} />
                                </View>
                              </TouchableOpacity>
                            )}
                          </View>
                          <View style={styles.historySetsColumn}>
                            {workout.sets.map((set, setIndex) => (
                              <View key={setIndex} style={styles.historySetRow}>
                                <View style={styles.historyValueColumn}>
                                  <Text style={styles.historySetText}>
                                    {formatWeightForLoad(set.weight, useKg)}
                                  </Text>
                                  <Text style={styles.historySetUnit}>{weightUnit}</Text>
                                </View>
                                <View style={styles.historyValueColumn}>
                                  <Text style={styles.historySetText}>{set.reps}</Text>
                                  <Text style={styles.historySetUnit}>{activeExercise.isTimeBased ? 'secs' : 'reps'}</Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        </View>
                        {workoutIndex < workoutsToShow.length - 1 && (
                          <View style={styles.historyDivider} />
                        )}
                      </View>
                    ))
                  )}
                </View>
              </>
            );
          })()}

          {/* Save button - appears when keyboard is visible; dismiss then persist so one tap is enough */}
          {isKeyboardVisible && (
            <View style={styles.drawerKeyboardSaveContainer}>
              <TouchableOpacity
                style={styles.drawerKeyboardSaveButton}
                onPress={() => {
                  Keyboard.dismiss();
                  // Delay so onEndEditing runs and localValues is updated before we persist
                  setTimeout(() => { saveSession(); }, 150);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.drawerKeyboardSaveText}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </BottomDrawer>
      );
      })()}

      {/* Swap Exercise: input pinned at bottom, moves with keyboard */}
      <Modal
        visible={showSwapModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowSwapModal(false); setSwapSearchQuery(''); }}
      >
        <View style={styles.swapOverlay}>
          <TouchableWithoutFeedback onPress={() => { setShowSwapModal(false); setSwapSearchQuery(''); }}>
            <View style={styles.swapOverlayBackdrop} />
          </TouchableWithoutFeedback>
          <KeyboardAvoidingView
            style={styles.swapBottomAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <View style={styles.swapAutocompleteContainer}>
            {swapSearchQuery.trim().length > 0 ? (() => {
                    const query = swapSearchQuery.trim().toLowerCase();
                    const currentExercise = expandedGroupIndex >= 0
                      ? exerciseGroups[expandedGroupIndex]?.exercises[activeExerciseIndex]
                      : null;
                    const filtered = exercisesLibrary.filter(ex =>
                      ex.name.toLowerCase().includes(query) &&
                      (currentExercise ? ex.id !== currentExercise.id : true)
                    );
                    const exactMatch = exercisesLibrary.some(ex => ex.name.toLowerCase() === query);
                    const showAdd = !exactMatch && query.length >= 2;
                    const optionsToShow = filtered.slice(0, 5);
                    const updateTemplateAndSwap = async (exerciseId: string, exerciseName: string) => {
                      if (!currentExercise) return;
                      if (type === 'warmup' && template?.warmupItems) {
                        const updatedItems = template.warmupItems.map(item =>
                          item.id === currentExercise.id ? { ...item, id: exerciseId, exerciseName } : item
                        );
                        await updateWorkoutTemplate(workoutTemplateId, { warmupItems: updatedItems });
                      } else if (type === 'core' && template?.accessoryItems) {
                        const updatedItems = template.accessoryItems.map(item =>
                          item.id === currentExercise.id ? { ...item, id: exerciseId, exerciseName } : item
                        );
                        await updateWorkoutTemplate(workoutTemplateId, { accessoryItems: updatedItems });
                      } else if (type === 'main' && template?.items) {
                        const updatedItems = template.items.map(item =>
                          item.id === currentExercise.id || item.exerciseId === currentExercise.id
                            ? { ...item, exerciseId } : item
                        );
                        await updateWorkoutTemplate(workoutTemplateId, { items: updatedItems });
                        if (scheduledWorkout) {
                          await updateScheduledWorkoutSnapshots(workoutKey, { exercisesSnapshot: updatedItems });
                        }
                      }
                      if (type !== 'main' || !scheduledWorkout) {
                        cleanupAfterSwap(currentExercise.id, exerciseId);
                      }
                      setSwapSearchQuery('');
                      setShowSwapModal(false);
                      setRefreshKey(prev => prev + 1);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    };
                    return (
                      <View style={styles.swapAutocompleteList}>
                        {optionsToShow.length === 0 ? (
                          <Text style={styles.swapNoResults}>No exercises found</Text>
                        ) : (
                          optionsToShow.map((exercise, index) => (
                            <TouchableOpacity
                              key={exercise.id}
                              style={[
                                styles.exerciseOption,
                                index === optionsToShow.length - 1 ? styles.exerciseOptionLast : null,
                              ]}
                              onPress={() => updateTemplateAndSwap(exercise.id, exercise.name)}
                            >
                              <Text style={styles.exerciseOptionText}>{exercise.name}</Text>
                            </TouchableOpacity>
                          ))
                        )}
                        {showAdd && (
                          <TouchableOpacity
                            style={styles.swapAddNewRow}
                            onPress={async () => {
                              const newName = swapSearchQuery.trim();
                              const newId = newName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
                              const newExercise = {
                                id: newId,
                                name: newName,
                                category: 'Other' as any,
                                isCustom: true,
                              };
                              await addExercise(newExercise);
                              if (currentExercise) {
                                if (type === 'warmup' && template?.warmupItems) {
                                  const updatedItems = template.warmupItems.map(item =>
                                    item.id === currentExercise.id ? { ...item, id: newId, exerciseName: newName } : item
                                  );
                                  await updateWorkoutTemplate(workoutTemplateId, { warmupItems: updatedItems });
                                } else if (type === 'core' && template?.accessoryItems) {
                                  const updatedItems = template.accessoryItems.map(item =>
                                    item.id === currentExercise.id ? { ...item, id: newId, exerciseName: newName } : item
                                  );
                                  await updateWorkoutTemplate(workoutTemplateId, { accessoryItems: updatedItems });
                                } else if (type === 'main' && template?.items) {
                                  const updatedItems = template.items.map(item =>
                                    item.id === currentExercise.id || item.exerciseId === currentExercise.id
                                      ? { ...item, exerciseId: newId } : item
                                  );
                                  await updateWorkoutTemplate(workoutTemplateId, { items: updatedItems });
                                  if (scheduledWorkout) {
                                    await updateScheduledWorkoutSnapshots(workoutKey, { exercisesSnapshot: updatedItems });
                                  }
                                }
                                if (type !== 'main' || !scheduledWorkout) {
                                  cleanupAfterSwap(currentExercise.id, newId);
                                }
                              }
                              setSwapSearchQuery('');
                              setShowSwapModal(false);
                              setRefreshKey(prev => prev + 1);
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            }}
                          >
                            <IconAdd size={20} color={COLORS.accentPrimary} />
                            <Text style={styles.swapAddNewText}>Create "{swapSearchQuery.trim()}"</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })() : null}
            </View>
            <View style={[styles.swapInputRow, { paddingBottom: Math.max(insets.bottom, SPACING.md) }]}>
              <TextInput
                style={styles.swapSearchInputLarge}
                placeholder="Search exercises..."
                placeholderTextColor={COLORS.textSecondary}
                value={swapSearchQuery}
                onChangeText={setSwapSearchQuery}
                autoFocus={true}
                returnKeyType="done"
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Action Sheet Menu */}
      <ActionSheet
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        items={
          type === 'main' ? (allCurrentGroupsComplete ? [
            {
              icon: <IconAdd size={24} color="#FFFFFF" />,
              label: t('addExercise'),
              onPress: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowMenu(false);
                setTimeout(() => setShowAddExerciseDrawer(true), 350);
              },
              singleRow: true,
            },
            {
              icon: <IconAddTime size={24} color="#FFFFFF" />,
              label: restTimerMenuLabel,
              onPress: () => {
                setShowMenu(false);
                setTimeout(() => setShowRestTimePicker(true), 350);
              },
              singleRow: true,
            },
            {
              icon: <IconRestart size={24} color={COLORS.signalNegative} />,
              label: t('reset'),
              onPress: handleReset,
              destructive: true,
            },
          ] : [
            {
              icon: <IconAdd size={24} color="#FFFFFF" />,
              label: t('addExercise'),
              onPress: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowMenu(false);
                setTimeout(() => setShowAddExerciseDrawer(true), 350);
              },
              singleRow: true,
            },
            {
              icon: <IconAddTime size={24} color="#FFFFFF" />,
              label: restTimerMenuLabel,
              onPress: () => {
                setShowMenu(false);
                setTimeout(() => setShowRestTimePicker(true), 350);
              },
              singleRow: true,
            },
            {
              icon: <IconRestart size={24} color={COLORS.signalNegative} />,
              label: t('reset'),
              onPress: handleReset,
              destructive: true,
            },
            {
              icon: <IconCheck size={24} color={COLORS.successBright} checkColor={COLORS.container} />,
              label: t('complete'),
              onPress: handleCompleteAll,
              labelColor: COLORS.successBright,
            },
          ]) : (allCurrentGroupsComplete ? [
            {
              icon: <IconRestart size={24} color={COLORS.signalNegative} />,
              label: t('reset'),
              onPress: handleReset,
              destructive: true,
            },
          ] : [
            {
              icon: <IconRestart size={24} color={COLORS.signalNegative} />,
              label: t('reset'),
              onPress: handleReset,
              destructive: true,
            },
            {
              icon: <IconTrash size={24} color={COLORS.error} />,
              label: t('remove'),
              onPress: () => {
                setShowMenu(false);
                setTimeout(() => {
                  Alert.alert(
                    type === 'warmup' ? t('removeWarmup') : 'Remove Core',
                    type === 'warmup' ? t('removeWarmupConfirmation') : 'Are you sure you want to remove the core exercises from this workout?',
                    [
                      {
                        text: t('cancel'),
                        style: 'cancel',
                      },
                      {
                        text: t('remove'),
                        style: 'destructive',
                        onPress: async () => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          // Update the template to remove items
                          if (type === 'warmup') {
                            await updateWorkoutTemplate(workoutTemplateId, { warmupItems: [] });
                          } else if (type === 'core') {
                            await updateWorkoutTemplate(workoutTemplateId, { accessoryItems: [] });
                          }
                          navigation.goBack();
                        },
                      },
                    ]
                  );
                }, 300);
              },
              destructive: true,
            },
          ])
        }
      />
      
      {/* Exercise Settings overflow menu: 3 toggles (stacked, label + toggle per line) then Swap, Remove */}
      {(() => {
        const menuGrpIdx = drawerGroupIndex ?? expandedGroupIndex;
        const menuExIdx = drawerExerciseIndex ?? activeExerciseIndex;
        const menuExercise = menuGrpIdx >= 0 && exerciseGroups[menuGrpIdx] ? exerciseGroups[menuGrpIdx].exercises[menuExIdx] : null;
        if (!menuExercise) return null;
        const currentRound = currentRounds[exerciseGroups[menuGrpIdx]?.id] ?? 0;
        const drawerSetVals = getSetDisplayValues(menuExercise.id, currentRound, menuExercise.weight ?? 0, menuExercise.reps ?? 0);
        const displayWeight = localValues[`${menuExercise.id}-set-${currentRound}`]?.weight ?? drawerSetVals.weight;
        const showBarbellToggle = displayWeight > (useKg ? 20 : 45);
        const isBarbellMode = getBarbellMode(menuExercise.id);
        return (
          <BottomDrawer
            visible={executionMode === 'current' && showExerciseSettingsMenu}
            onClose={() => setShowExerciseSettingsMenu(false)}
            maxHeight="65%"
            scrollable={true}
            showHandle={true}
            backgroundColor={COLORS.backgroundCanvas}
          >
            <View style={[styles.exerciseSettingsMenuContent, { paddingBottom: Math.max(SPACING.xl, insets.bottom) }]}>
              <Text style={styles.exerciseSettingsMenuSectionTitle}>Set behavior</Text>
              <View style={styles.exerciseSettingsMenuRow}>
                <View style={styles.exerciseSettingsMenuLabelBlock}>
                  <Text style={styles.exerciseSettingsMenuLabel}>{t('setBehaviorWeight')}</Text>
                  <Text style={styles.exerciseSettingsMenuLabelDesc}>{t('setBehaviorPlatesDesc')}</Text>
                </View>
                <Toggle
                  label=""
                  hideLabel
                  value={isBarbellMode}
                  onValueChange={() => setBarbellMode(menuExercise.id, !isBarbellMode)}
                  disabled={!showBarbellToggle}
                />
              </View>
              <View style={styles.exerciseSettingsMenuRow}>
                <View style={styles.exerciseSettingsMenuLabelBlock}>
                  <Text style={styles.exerciseSettingsMenuLabel}>{t('setBehaviorStructure')}</Text>
                  <Text style={styles.exerciseSettingsMenuLabelDesc}>{t('setBehaviorBothSidesDesc')}</Text>
                </View>
                <Toggle
                  label=""
                  hideLabel
                  value={menuExercise.isPerSide ?? false}
                  onValueChange={() => setPerSideOverrides(prev => ({ ...prev, [menuExercise.id]: !(menuExercise.isPerSide ?? false) }))}
                />
              </View>
              <View style={styles.exerciseSettingsMenuRow}>
                <View style={styles.exerciseSettingsMenuLabelBlock}>
                  <Text style={styles.exerciseSettingsMenuLabel}>{t('setBehaviorType')}</Text>
                  <Text style={styles.exerciseSettingsMenuLabelDesc}>{t('setBehaviorTimedDesc')}</Text>
                </View>
                <Toggle
                  label=""
                  hideLabel
                  value={menuExercise.isTimeBased ?? false}
                  onValueChange={() => setTimeBasedOverrides(prev => ({ ...prev, [menuExercise.id]: !(menuExercise.isTimeBased ?? false) }))}
                />
              </View>
              {/* Progression group selector */}
              {type === 'main' && (() => {
                const libId = menuExercise.exerciseId || menuExercise.id;
                const currentGroup = progressionGroups.find(g => g.exerciseIds.includes(libId));
                const options: { key: string | null; label: string }[] = [
                  { key: null, label: 'None' },
                  ...progressionGroups.map(g => ({ key: g.id, label: g.name })),
                ];
                return (
                  <>
                    <Text style={[styles.exerciseSettingsMenuSectionTitle, { marginTop: SPACING.lg }]}>Progression group</Text>
                    <View style={styles.progressionGroupPills}>
                      {options.map(opt => {
                        const selected = opt.key === (currentGroup?.id ?? null);
                        return (
                          <TouchableOpacity
                            key={opt.key ?? 'none'}
                            style={[styles.progressionGroupPill, selected && styles.progressionGroupPillSelected]}
                            activeOpacity={0.7}
                            onPress={async () => {
                              if (selected) return;
                              if (currentGroup) {
                                await updateProgressionGroup(currentGroup.id, {
                                  exerciseIds: currentGroup.exerciseIds.filter(id => id !== libId),
                                });
                              }
                              if (opt.key) {
                                const target = progressionGroups.find(g => g.id === opt.key);
                                if (target) {
                                  await updateProgressionGroup(target.id, {
                                    exerciseIds: [...target.exerciseIds, libId],
                                  });
                                }
                              }
                            }}
                          >
                            <Text style={[styles.progressionGroupPillText, selected && styles.progressionGroupPillTextSelected]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                );
              })()}

              <View style={styles.exerciseSettingsMenuActionsRow}>
                <TouchableOpacity
                  style={styles.exerciseSettingsMenuActionCard}
                  onPress={() => {
                    setShowExerciseSettingsMenu(false);
                    setShowAdjustmentDrawer(false);
                    if (menuGrpIdx >= 0) {
                      setExpandedGroupIndex(menuGrpIdx);
                      setActiveExerciseIndex(menuExIdx);
                    }
                    setTimeout(() => setShowSwapModal(true), 400);
                  }}
                  activeOpacity={0.7}
                >
                  <IconSwap size={24} color={COLORS.text} />
                  <Text style={styles.exerciseSettingsMenuActionLabel}>{t('swap')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.exerciseSettingsMenuActionCard, styles.exerciseSettingsMenuActionCardDanger]}
                onPress={() => {
                  setShowExerciseSettingsMenu(false);
                  setShowAdjustmentDrawer(false);
                  setTimeout(() => {
                    Alert.alert(
                      t('deleteExerciseTitle'),
                      t('deleteExerciseMessage'),
                      [
                        { text: t('cancel'), style: 'cancel' },
                        {
                          text: t('remove'),
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              const activeExercise = menuExercise;
                              if (type === 'warmup') {
                                const source = scheduledWorkout?.warmupSnapshot ?? template?.warmupItems ?? [];
                                const updatedItems = source.filter((item: any) => item.id !== activeExercise.id);
                                await updateWorkoutTemplate(workoutTemplateId, { warmupItems: updatedItems });
                                if (scheduledWorkout && workoutKey) {
                                  await updateScheduledWorkoutSnapshots(workoutKey, { warmupSnapshot: updatedItems });
                                }
                              } else if (type === 'core') {
                                const source = scheduledWorkout?.accessorySnapshot ?? template?.accessoryItems ?? [];
                                const updatedItems = source.filter((item: any) => item.id !== activeExercise.id);
                                await updateWorkoutTemplate(workoutTemplateId, { accessoryItems: updatedItems });
                                if (scheduledWorkout && workoutKey) {
                                  await updateScheduledWorkoutSnapshots(workoutKey, { accessorySnapshot: updatedItems });
                                }
                              } else if (type === 'main') {
                                const source = scheduledWorkout?.exercisesSnapshot ?? template?.items ?? [];
                                const updatedItems = source.filter((item: any) => {
                                  const itemKey = scheduledWorkout ? item.id : (item.exerciseId ?? item.id);
                                  return itemKey !== activeExercise.id;
                                });
                                await updateWorkoutTemplate(workoutTemplateId, { items: updatedItems });
                                if (scheduledWorkout && workoutKey) {
                                  await updateScheduledWorkoutSnapshots(workoutKey, { exercisesSnapshot: updatedItems });
                                }
                              }
                              setRefreshKey(prev => prev + 1);
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            } catch (e) {
                              console.error('[Remove] Error', e);
                            }
                          },
                        },
                      ]
                    );
                  }, 300);
                }}
                  activeOpacity={0.7}
                >
                  <IconTrash size={24} color={COLORS.signalNegative} />
                  <Text style={[styles.exerciseSettingsMenuActionLabel, { color: COLORS.signalNegative }]}>{t('remove')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </BottomDrawer>
        );
      })()}

      {/* Add Exercise Drawer */}
      <BottomDrawer
        visible={showAddExerciseDrawer}
        onClose={() => setShowAddExerciseDrawer(false)}
        maxHeight="70%"
        fixedHeight={true}
        showHandle={false}
        scrollable={false}
        contentStyle={{ padding: 0 }}
      >
        <AddExerciseDrawerContent
          exercisesLibrary={exercisesLibrary}
          onSelect={handleAddExercise}
          onClose={() => setShowAddExerciseDrawer(false)}
        />
      </BottomDrawer>

      {/* Local Rest Timer Picker */}
      <TimerValueSheet
        visible={showRestTimePicker}
        onClose={() => setShowRestTimePicker(false)}
        title="Workout Rest Time"
        label=""
        value={localRestOverride ?? settings.restTimerDefaultSeconds}
        min={15}
        max={300}
        step={5}
        onSave={(seconds) => {
          setLocalRestOverride(seconds);
          setShowRestTimePicker(false);
        }}
        formatValue={(val) => `${Math.floor(val / 60)}:${(val % 60).toString().padStart(2, '0')}`}
        accentColor={COLORS.info}
      />

    </AnimatedReanimated.View>
  );
}

function ExecutionModeToggle({
  mode,
  onModeChange,
}: {
  mode: ExecutionMode;
  onModeChange: (mode: ExecutionMode) => void;
}) {
  return (
    <View style={styles.executionModeToggleRow}>
      <TouchableOpacity
        style={[
          styles.executionModeToggleOption,
          mode === 'current' && styles.executionModeToggleOptionActive,
        ]}
        onPress={() => onModeChange('current')}
        activeOpacity={0.85}
      >
        <Text
          style={[
            styles.executionModeToggleText,
            mode === 'current' && styles.executionModeToggleTextActive,
          ]}
        >
          Current
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.executionModeToggleOption,
          mode === 'explore' && styles.executionModeToggleOptionActive,
        ]}
        onPress={() => onModeChange('explore')}
        activeOpacity={0.85}
      >
        <Text
          style={[
            styles.executionModeToggleText,
            mode === 'explore' && styles.executionModeToggleTextActive,
          ]}
        >
          Explore
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.executionModeToggleOption,
          mode === 'explore-v2' && styles.executionModeToggleOptionActive,
        ]}
        onPress={() => onModeChange('explore-v2')}
        activeOpacity={0.85}
      >
        <Text
          style={[
            styles.executionModeToggleText,
            mode === 'explore-v2' && styles.executionModeToggleTextActive,
          ]}
        >
          Explore v2
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// Separate component to avoid re-renders on the main screen
function AddExerciseDrawerContent({
  exercisesLibrary,
  onSelect,
  onClose
}: {
  exercisesLibrary: Array<{ id: string; name: string }>;
  onSelect: (id: string, name: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return exercisesLibrary;
    const lowerQuery = searchQuery.toLowerCase();
    return exercisesLibrary.filter(ex => ex.name.toLowerCase().includes(lowerQuery));
  }, [searchQuery, exercisesLibrary]);

  return (
    <View style={addExerciseStyles.container}>
      <View style={addExerciseStyles.header}>
        <Text style={addExerciseStyles.title}>{t('addExercise')}</Text>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
          <Text style={addExerciseStyles.cancelText}>{t('cancel')}</Text>
        </TouchableOpacity>
      </View>

      <View style={addExerciseStyles.searchContainer}>
        <TextInput
          style={addExerciseStyles.searchInput}
          placeholder={t('searchExercisesPlaceholder')}
          placeholderTextColor={COLORS.textMeta}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={filteredExercises}
        keyExtractor={(item) => item.id}
        style={addExerciseStyles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity
            style={addExerciseStyles.exerciseItem}
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              await onSelect(item.id, item.name);
            }}
            activeOpacity={0.7}
          >
            <Text style={addExerciseStyles.exerciseName}>{item.name}</Text>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={addExerciseStyles.separator} />}
      />
    </View>
  );
}

const addExerciseStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  cancelText: {
    ...TYPOGRAPHY.body,
    color: COLORS.accentPrimary,
  },
  searchContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.md,
  },
  searchInput: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    backgroundColor: COLORS.container,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderDimmed,
  },
  list: {
    flex: 1,
    paddingHorizontal: SPACING.xxl,
  },
  exerciseItem: {
    paddingVertical: SPACING.lg,
  },
  exerciseName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.borderDimmed,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: EXPLORE_V2.colors.pageBg,
  },
  header: {
    paddingBottom: 0,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.sm,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -4,
  },
  menuButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginRight: -4,
  },
  menuSpacer: {
    width: 48,
    height: 48,
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
    minWidth: 0,
  },
  /** Workout title — 20px via TYPOGRAPHY.h3 */
  headerTitle: {
    ...TYPOGRAPHY.h3,
    color: '#FFFFFF',
    textAlign: 'center',
    width: '100%',
  },
  headerTitleExploreV2: {
    fontSize: TYPOGRAPHY.body.fontSize,
    color: '#1F1F1F',
    fontWeight: '600',
    letterSpacing: -0.35,
    lineHeight: 28,
    opacity: 0.94,
    textAlign: 'center',
  },
  floatingModeToggle: {
    position: 'absolute',
    zIndex: 100,
    right: SPACING.xxl,
    elevation: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  executionModeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.containerBackground,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.borderDimmed,
    padding: 2,
  },
  executionModeToggleOption: {
    minHeight: 30,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BORDER_RADIUS.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  executionModeToggleOptionActive: {
    backgroundColor: COLORS.accentPrimary,
  },
  executionModeToggleText: {
    ...TYPOGRAPHY.legal,
    color: COLORS.textSecondary,
  },
  executionModeToggleTextActive: {
    color: COLORS.backgroundCanvas,
  },
  headerTimerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accentPrimaryDimmed,
    borderRadius: BORDER_RADIUS.round,
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 168,
  },
  headerTimerPillBelowTitle: {
    marginTop: SPACING.xs,
  },
  contentWrap: {
    flex: 1,
    backgroundColor: EXPLORE_V2.colors.pageBg,
  },
  /** Solid rest theme — matches timer / chrome (#FFA424) */
  containerExploreV2RestTimer: {
    backgroundColor: '#FFA424',
  },
  contentWrapExploreV2RestTimer: {
    backgroundColor: '#FFA424',
  },
  exploreV2Root: {
    flex: 1,
    flexDirection: 'column',
    overflow: 'visible',
    minHeight: 0,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  /**
   * Rest timer hero — lowest z-index so the wallet stack paints on top (digits read “through” / behind cards).
   * pointerEvents set in JSX — idle must be `none` so cards stay tappable.
   */
  exploreV2TimerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  exploreV2TimerOverlayAnchor: {
    position: 'absolute',
    top: `${EXPLORE_V2.layout.restTimerCenterFromRootTopFraction * 100}%`,
    alignItems: 'center',
    /** Half digit slot (82) centers on anchor; extra nudge pulls hero toward header */
    transform: [
      {
        translateY: -(82 / 2 + EXPLORE_V2.layout.restTimerOverlayUpNudgePx),
      },
    ],
  },
  /** Height comes only from exploreV2TimerBandAnimatedStyle so the wallet flexes in sync */
  exploreV2TimerBand: {
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  exploreV2WalletBand: {
    minHeight: 0,
    overflow: 'visible',
    paddingBottom: 4,
    backgroundColor: 'transparent',
  },
  exploreTimerText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
    flex: 1,
    textAlign: 'center',
  },
  exploreTimerIconBtn: {
    width: 28,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    paddingBottom: 120,
  },
  itemsAccordion: {
    gap: 12,
  },
  exploreRoot: {
    gap: 48,
  },
  /** Current exercise: summary card + set list block + CTA stacked (Explore only) */
  exploreCurrentStack: {
    width: '100%',
    gap: SPACING.sm,
  },
  exploreCurrentSummaryCompact: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  exploreCurrentSummaryText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  exploreSetListBlock: {
    width: '100%',
    gap: SPACING.xs,
  },
  exploreSection: {
    gap: SPACING.sm,
  },
  exploreSectionTitle: {
    ...TYPOGRAPHY.legal,
    color: COLORS.textMeta,
    textTransform: 'uppercase',
  },
  exploreSectionAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    alignSelf: 'flex-start',
  },
  exploreSectionAccordionIconWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '0deg' }],
  },
  exploreSectionAccordionIconWrapExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  exploreCardOuter: {
    width: '100%',
  },
  exploreCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderDimmed,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  exploreCardExpanded: {
    borderColor: COLORS.accentPrimaryDimmed,
  },
  exploreCardCompleted: {
    opacity: 0.85,
  },
  exploreCardLocked: {
    opacity: 0.6,
  },
  exploreCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  exploreCardTitle: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    flex: 1,
  },
  exploreCardMeta: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  exploreCardExpandedContent: {
    gap: SPACING.sm,
    paddingTop: 2,
  },
  exploreMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flexWrap: 'wrap',
  },
  exploreMetricText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  exploreMetricProgress: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  exploreHelperText: {
    ...TYPOGRAPHY.legal,
    color: COLORS.textMeta,
  },
  exploreExpandedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  exploreEditButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.borderDimmed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explorePrimaryButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  explorePrimaryButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.backgroundCanvas,
  },
  exploreDetailSheetContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xxl,
    gap: 40,
  },
  exploreDetailHeader: {
    paddingBottom: SPACING.xs,
    gap: 4,
  },
  exploreDetailTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  exploreDetailSheetSubtitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  exploreInlineSetNumber: {
    ...TYPOGRAPHY.meta,
    fontWeight: '600',
    color: COLORS.text,
  },
  exploreSetUpcomingLabel: {
    ...TYPOGRAPHY.legal,
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMeta,
    textTransform: 'uppercase',
  },
  exploreDetailSection: {
    gap: SPACING.sm,
  },
  exploreDetailSectionTitle: {
    ...TYPOGRAPHY.legal,
    color: COLORS.textMeta,
    textTransform: 'uppercase',
  },
  /** Actions block: no extra gap so spacing above buttons is controlled by exploreActionsRow */
  exploreDetailActionsSection: {
    gap: 0,
  },
  /** Edge-to-edge within the padded drawer content */
  exploreDetailSheetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginHorizontal: -SPACING.xxl,
    alignSelf: 'stretch',
  },
  exploreSetRow: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  exploreSetRowCompleted: {
    backgroundColor: CARDS.cardDeep.inner.backgroundColor,
    opacity: 0.88,
  },
  exploreSetRowActive: {
    backgroundColor: COLORS.activeCard,
    borderColor: 'transparent',
  },
  exploreSetRowUpcoming: {
    backgroundColor: CARDS.cardDeep.inner.backgroundColor,
  },
  exploreSetRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
  },
  exploreSetRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  exploreSetRowRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginLeft: SPACING.sm,
    minWidth: 0,
  },
  exploreSetNextLabel: {
    ...TYPOGRAPHY.legal,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.accentPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  exploreSetValueCompact: {
    ...TYPOGRAPHY.meta,
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'right',
    flex: 1,
    minWidth: 0,
  },
  exploreSetValueMuted: {
    color: COLORS.textMeta,
  },
  exploreSetDoneIcon: {
    flexShrink: 0,
  },
  exploreSetEditInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  exploreSetEditInput: {
    ...TYPOGRAPHY.body,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
    color: COLORS.text,
    padding: 0,
    minWidth: 48,
    flex: 1,
  },
  exploreSetEditUnit: {
    ...TYPOGRAPHY.legal,
    color: COLORS.textMeta,
    flexShrink: 0,
  },
  exploreSetEditorSheet: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
  },
  exploreSetEditorTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  exploreSetEditorExerciseName: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  exploreSetEditorInputsColumn: {
    gap: SPACING.md,
  },
  exploreSetEditorInputWide: {
    minWidth: 80,
  },
  exploreSetEditorSaveBtn: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.accentPrimary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  exploreSetEditorSaveText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.backgroundCanvas,
    fontWeight: '700',
  },
  exploreSetEditorKeyboardAccessory: {
    backgroundColor: COLORS.backgroundCanvas,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  exploreSetEditorKeyboardDone: {
    backgroundColor: COLORS.accentPrimary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  exploreSetEditorKeyboardDoneText: {
    ...TYPOGRAPHY.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  exploreDetailEmptyText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  exploreHistoryRow: {
    paddingVertical: SPACING.xs,
  },
  exploreHistoryText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.text,
  },
  exploreViewAllHistoryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  exploreViewAllHistoryText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.accentPrimary,
  },
  exploreSetupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    backgroundColor: CARDS.cardDeep.inner.backgroundColor,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: SPACING.sm,
  },
  exploreSetupLabelBlock: {
    flex: 1,
    gap: 2,
  },
  exploreSetupLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.text,
  },
  exploreSetupDesc: {
    ...TYPOGRAPHY.legal,
    color: COLORS.textMeta,
  },
  exploreProgressionPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  exploreProgressionGroupSection: {
    gap: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  exploreActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: SPACING.sm,
    paddingTop: SPACING.xxl,
  },
  exploreActionCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: 44,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    backgroundColor: CARDS.cardDeep.inner.backgroundColor,
    borderRadius: 10,
    minWidth: 0,
  },
  exploreActionCellLabel: {
    flexShrink: 1,
  },
  exploreActionText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  exploreActionTextDanger: {
    ...TYPOGRAPHY.meta,
    color: COLORS.signalNegative,
  },
  itemRow: {
    width: '100%',
  },
  exerciseCardsColumn: {
    flex: 1,
  },
  supersetDivider: {
    height: 1,
    backgroundColor: COLORS.borderDimmed,
    marginHorizontal: 16,
  },
  exerciseContentDimmed: {
    opacity: 0.5,
  },
  // Active card: use background color as "border" with padding to simulate border width
  itemCardBorder: {
    borderRadius: 10,
    borderCurve: 'continuous' as const,
    overflow: 'hidden',
  },
  itemCardFill: {
    backgroundColor: COLORS.activeCard,
    borderRadius: 9,
    borderCurve: 'continuous' as const,
    overflow: 'hidden',
  },
  itemCardInactive: {
    ...CARDS.cardDeep.outer,
    borderRadius: 10,
    // 1px transparent padding to match active card size and prevent layout jump
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 1,
    paddingRight: 1,
    borderWidth: 0,
  },
  itemCardInnerInactive: {
    ...CARDS.cardDeep.inner,
    borderRadius: 9,
  },
  itemCardDimmed: {
    ...CARDS.cardDeepDimmed.outer,
    borderRadius: 10,
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 1,
    paddingRight: 1,
    borderWidth: 0,
  },
  itemCardInnerDimmed: {
    ...CARDS.cardDeepDimmed.inner,
    borderRadius: 9,
  },
  itemCardCollapsed: {
    height: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemCardHeaderActive: {
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseNameCollapsedFlex: {
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  setCountCollapsed: {
    ...TYPOGRAPHY.legal,
    color: COLORS.textMeta,
    flexShrink: 0,
  },
  itemCardExpanded: {
    height: 126,
    paddingTop: 6,
    paddingHorizontal: 16,
    paddingBottom: 0,
    justifyContent: 'flex-end',
  },
  itemCardExpandedWithIndicator: {
    paddingRight: 60,
  },
  exerciseNameInCard: {
    marginBottom: 4,
  },
  exerciseNameInCardCentered: {
    marginBottom: 0,
  },
  exerciseNameRowWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4, // Match exerciseNameInCard to prevent jump
  },
  exerciseNameText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  exerciseNameTextActive: {
    color: COLORS.text,
  },
  editIconContainer: {
    marginLeft: SPACING.md,
  },
  cardHeaderActionSlot: {
    width: 28,
    height: 28,
    marginLeft: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeaderActionTouchable: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pencilIconOffset: {
    marginLeft: 0,
  },
  cardHeaderRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  setCountInValues: {
    ...TYPOGRAPHY.legal,
    color: COLORS.text,
    flexShrink: 0,
  },
  valuesDisplayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 16,
  },
  valuesDisplayLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
    gap: 24,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  valueColumn: {
    flexDirection: 'column',
    gap: 4,
  },
  largeValue: {
    ...TYPOGRAPHY.h1,
    color: '#FFFFFF',
    fontWeight: '400',
  },
  unit: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  unitWithDelta: {
    position: 'relative',
    overflow: 'visible',
  },
  deltaLabel: {
    position: 'absolute',
    top: -12,
    left: 0,
    fontSize: 12,
    color: COLORS.successBright,
    fontWeight: '700',
  },
  cardActionRow: {
    flexDirection: 'row',
    paddingHorizontal: 0,
    marginTop: 16,
    height: 48,
    gap: 0,
  },
  setCountIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: 12,
  },
  actionLeftContainer: {
    flex: 1,
    height: 44,
  },
  actionLeftOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 0,
    zIndex: 2,
  },
  externalActionCard: {
    marginTop: 2,
    borderRadius: 10,
    backgroundColor: COLORS.accentPrimaryDimmed,
    overflow: 'hidden',
    height: 52,
  },
  externalActionCardDisabled: {
    backgroundColor: CARDS.cardDeep.inner.backgroundColor,
  },
  externalActionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    zIndex: 2,
  },
  externalActionTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  externalInlineRestControls: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    zIndex: 1,
  },
  actionLeftTouchable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  cardStartButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: '500',
    color: COLORS.accentPrimary,
  },
  cardStartButtonTextDisabled: {
    opacity: 0.6,
  },
  setCountText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.accentPrimary,
    textAlign: 'right',
  },
  setCountIndicatorRow: {
    flexDirection: 'row',
    gap: 0,
  },
  setCountNextLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.text,
    flexShrink: 0,
  },
  inlineRestControlsAbsolute: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    gap: 8,
    zIndex: 1,
    overflow: 'hidden',
  },
  inlineRestTime: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
    paddingVertical: 4,
    width: 40,
    textAlign: 'left',
  },
  inlineRestTimeActive: {
    color: COLORS.accentPrimary,
  },
  inlineRestIconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedCheckContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.backgroundCanvas,
  },
  startButton: {
    width: '100%',
  },
  startButtonInner: {
    backgroundColor: COLORS.accentPrimary,
    height: 48,
    paddingHorizontal: 24,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.backgroundCanvas,
  },
  adjustmentDrawerContent: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 28,
  },
  adjustmentDrawerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    flex: 1,
  },
  drawerValuesCard: {
    ...CARDS.cardDeep.outer,
    backgroundColor: COLORS.activeCard,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  drawerAdjustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  drawerInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  drawerInputGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  drawerInput: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
    padding: 0,
    minWidth: 30,
  },
  drawerInputUnit: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  drawerKeyboardSaveContainer: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  drawerKeyboardSaveButton: {
    backgroundColor: COLORS.accentPrimaryDimmed,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  drawerKeyboardSaveText: {
    ...TYPOGRAPHY.body,
    color: COLORS.accentPrimary,
    fontWeight: '600',
  },
  drawerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  allSetsContainer: {
    gap: SPACING.md,
  },
  setCard: {
    ...CARDS.cardDeep.outer,
    backgroundColor: COLORS.backgroundContainer,
    overflow: 'hidden',
  },
  inProgressBadge: {
    position: 'absolute',
    top: 12,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 1,
  },
  supersetActiveRow: {
    flexDirection: 'row',
  },
  supersetActiveLeft: {
    flex: 1,
  },
  valuesInlineRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 16,
  },
  supersetActiveRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  setHeaderExpanded: {
    paddingBottom: 0,
  },
  setHeaderLeft: {
    flex: 1,
  },
  setHeaderTitle: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
  },
  setHeaderPreview: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  completedBadge: {
    position: 'absolute',
    top: 12,
    right: 14,
  },
  setPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  setPreviewValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  setPreviewValueText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  setPreviewUnit: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  setControls: {
    paddingTop: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: SPACING.sm,
  },
  drawerAdjustValueColumn: {
    gap: 2,
  },
  drawerAdjustValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  weightPerSideText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  drawerAdjustValueText: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
  },
  drawerAdjustUnit: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  drawerAdjustButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  adjustButtonTapTarget: {
    padding: 4,
  },
  adjustButton: {
    ...CARDS.cardDeep.outer,
    backgroundColor: COLORS.accentPrimaryDimmed,
  },
  adjustButtonInner: {
    ...CARDS.cardDeep.inner,
    backgroundColor: COLORS.accentPrimaryDimmed,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerAdjustDivider: {
    height: 1,
    backgroundColor: COLORS.disabledBorder,
    marginVertical: 16,
  },
  viewHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: SPACING.md,
  },
  viewHistoryButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  historyFullBleedDivider: {
    height: 1,
    backgroundColor: COLORS.disabledBorder,
    marginHorizontal: -SPACING.xxl,
    marginTop: 40,
  },
  historySection: {
    marginTop: 40,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingBottom: SPACING.md,
  },
  historyLeftColumn: {
    flex: 1,
  },
  historyLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  viewAllText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.accentPrimary,
  },
  historyEmptyText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.text,
    paddingTop: 4,
  },
  historyDateLine: {
    ...TYPOGRAPHY.meta,
    color: COLORS.text,
    marginTop: 4,
  },
  historySetsColumn: {
    alignItems: 'flex-end',
  },
  historySetRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.lg,
    paddingVertical: 2,
  },
  historyValueColumn: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 4,
    width: 48,
  },
  historySetText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  historySetUnit: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  historyDivider: {
    height: 1,
    backgroundColor: COLORS.disabledBorder,
    marginVertical: SPACING.md,
  },
  drawerActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  drawerIconButton: {
    // No padding to ensure perfect vertical alignment with title
  },
  barbellToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  barbellToggleContainer: {
    marginTop: 24,
  },
  exerciseSettingsMenuContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  exerciseSettingsMenuSectionTitle: {
    ...TYPOGRAPHY.legal,
    color: COLORS.textMeta,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  exerciseSettingsMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  exerciseSettingsMenuLabelBlock: {
    gap: 2,
  },
  exerciseSettingsMenuLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  exerciseSettingsMenuLabelDesc: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  exerciseSettingsMenuActionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: 24,
  },
  exerciseSettingsMenuActionCard: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.backgroundContainer,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  exerciseSettingsMenuActionCardDanger: {},
  progressionGroupPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  progressionGroupPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.backgroundContainer,
  },
  progressionGroupPillSelected: {
    backgroundColor: COLORS.accentPrimary,
  },
  progressionGroupPillText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  progressionGroupPillTextSelected: {
    color: COLORS.backgroundCanvas,
    fontWeight: '600',
  },
  exerciseSettingsMenuActionLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
  },
  exerciseOptionCardLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.text,
    textAlign: 'center',
  },
  exerciseOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  exerciseOptionLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  barbellToggleLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  exerciseOption: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  exerciseOptionLast: {
    borderBottomWidth: 0,
  },
  exerciseOptionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  swapOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  swapOverlayBackdrop: {
    flex: 1,
  },
  swapBottomAvoid: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  swapAutocompleteContainer: {
    backgroundColor: COLORS.backgroundContainer,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: SPACING.sm,
    maxHeight: 400,
  },
  swapAutocompleteList: {
    marginBottom: 0,
  },
  swapInputRow: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.backgroundContainer,
  },
  swapSearchInput: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  swapSearchInputLarge: {
    ...TYPOGRAPHY.body,
    fontSize: 18,
    color: COLORS.text,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg + 4,
    minHeight: 56,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  swapNoResults: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.xl,
  },
  swapAddNewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    marginTop: SPACING.xs,
  },
  swapAddNewText: {
    ...TYPOGRAPHY.body,
    color: COLORS.accentPrimary,
    fontWeight: '600',
  },
  // Warm-up and Core Cards (when shown on main exercise screen)
  topCardsRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
    width: '100%',
  },
  halfWidthCard: {
    flex: 1,
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    height: 80,
    ...CARDS.cardDeep.outer,
    padding: SPACING.lg,
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  halfWidthCardTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    marginBottom: 4,
  },
  halfWidthCardSubtitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  halfWidthCardAction: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
  },
  halfWidthCardCompleteIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halfWidthCardProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  halfWidthProgressText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  progressCircle: {
    // SVG styling handled inline
  },
  halfWidthAddButton: {
    flex: 1,
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    height: 80,
    borderRadius: BORDER_RADIUS.lg,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    overflow: 'hidden',
  },
  halfWidthAddText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.text,
  },
  sectionLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.text,
    textTransform: 'uppercase',
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  // Add Exercise button (same height as inactive cards, pinned to bottom via addExerciseButtonFooter)
  addExerciseButton: {
    flex: 1,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  addExerciseButtonFooter: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: 12,
  },
  addExerciseButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  addExerciseButtonText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.text,
  },
  // Completed workout - history view
  historyViewContainer: {
    paddingTop: SPACING.xs,
  },
  historyViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.xl,
  },
  historyViewTitle: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.successBright,
  },
  historyExerciseRow: {
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDimmed,
    alignItems: 'flex-start',
  },
  historyExerciseNameColumn: {
    flex: 1,
    paddingRight: SPACING.lg,
  },
  historyExerciseName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  historyExerciseDataColumn: {
    minWidth: 120,
    alignItems: 'flex-end',
  },
  historySetDataRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.lg,
    paddingVertical: 2,
  },
  historySetValueGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 4,
    width: 48,
  },
  historySetValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
});
