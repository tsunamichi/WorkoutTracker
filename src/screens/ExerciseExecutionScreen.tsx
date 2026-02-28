import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager, Alert, Animated, Easing, Modal, FlatList, TextInput, Keyboard, KeyboardAvoidingView, TouchableWithoutFeedback } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconArrowLeft, IconCheck, IconCheckmark, IconAddLine, IconMinusLine, IconTrash, IconEdit, IconMenu, IconHistory, IconRestart, IconSkip, IconSwap, IconSettings, IconArrowRight, IconAdd, IconPause, IconPlay, IconAddTime, IconChevronDown } from '../components/icons';
import { BottomDrawer } from '../components/common/BottomDrawer';
import { NextLabel } from '../components/common/NextLabel';
import { SetTimerSheet } from '../components/timer/SetTimerSheet';
import { TimerValueSheet } from '../components/timer/TimerValueSheet';
import { ActionSheet, type ActionSheetItem } from '../components/common/ActionSheet';
import { Toggle } from '../components/Toggle';
import { DiagonalLinePattern } from '../components/common/DiagonalLinePattern';
import { ShapeConfetti } from '../components/common/ShapeConfetti';
import { useTranslation } from '../i18n/useTranslation';
import { formatWeightForLoad, toDisplayWeight, fromDisplayWeight } from '../utils/weight';
import type { WarmupItem_DEPRECATED as WarmupItem, AccessoryItem_DEPRECATED as AccessoryItem, WorkoutTemplateExercise } from '../types/training';
import { isDeprecatedItem, getDisplayValuesFromItem } from '../utils/exerciseMigration';
import dayjs from 'dayjs';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ExecutionType = 'warmup' | 'main' | 'core';

type RouteParams = {
  ExerciseExecution: {
    workoutKey: string;
    workoutTemplateId: string;
    type: ExecutionType;
  };
};

export function ExerciseExecutionScreen() {
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
  } = useStore();
  
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
  const weightUnit = useKg ? 'kg' : 'lb';
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
      const source = scheduledWorkout?.exercisesSnapshot ?? template?.items ?? [];
      result = source.map((item: any) => {
        const exercise = exercisesLibrary.find(ex => ex.id === item.exerciseId);
        // Use item.id (template row id) for scheduled workouts so completion setIds match snapshot
        const id = scheduledWorkout ? item.id : (item.exerciseId ?? item.id);
        return {
          id,
          exerciseName: exercise?.name || 'Exercise',
          sets: typeof item.sets === 'number' ? item.sets : (item.sets?.length ?? 0),
          reps: item.reps,
          weight: item.weight || 0,
          isTimeBased: item.isTimeBased ?? exercise?.measurementType === 'time' ?? false,
          isPerSide: false,
          cycleId: item.cycleId,
          cycleOrder: item.cycleOrder,
        } as WarmupItem;
      });
    }
    // Apply local time-based overrides
    if (timeBasedOverrides && Object.keys(timeBasedOverrides).length > 0) {
      result = result.map(item => {
        if (item.id in timeBasedOverrides) {
          return { ...item, isTimeBased: timeBasedOverrides[item.id] } as WarmupItem;
        }
        return item;
      });
    }
    return result;
  }, [type, template, exercisesLibrary, refreshKey, timeBasedOverrides, scheduledWorkout]);
  
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
  
  // Wrapper that updates both state AND ref immediately (ref avoids stale closures in saveSession)
  const setLocalValues = useCallback((updater: React.SetStateAction<Record<string, { weight: number; reps: number }>>) => {
    setLocalValuesState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      localValuesRef.current = next;
      return next;
    });
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
  const inlineRestEndTimeRef = useRef<number>(0);
  const inlineRestProgress = useRef(new Animated.Value(1)).current;
  const inlineRestAnimRef = useRef<Animated.CompositeAnimation | null>(null);
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
      inlineRestProgress.setValue(1);
      counterShrinkAnim.setValue(1);
      buttonLabelOpacity.setValue(0);
      Animated.timing(buttonLabelOpacity, {
        toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true,
      }).start();
    }
    wasRestActiveRef.current = inlineRestActive;
  }, [inlineRestActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inline rest timer countdown
  useEffect(() => {
    if (!inlineRestActive || inlineRestPaused) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((inlineRestEndTimeRef.current - Date.now()) / 1000));
      setInlineRestTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        runRestStaggerOut(() => inlineRestDismissRef.current());
      }
    }, 200);
    return () => clearInterval(interval);
  }, [inlineRestActive, inlineRestPaused]);

  const startInlineRestAnim = useCallback((fromValue: number, durationMs: number) => {
    if (inlineRestAnimRef.current) inlineRestAnimRef.current.stop();
    inlineRestProgress.setValue(fromValue);
    const anim = Animated.timing(inlineRestProgress, {
      toValue: 0,
      duration: durationMs,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    inlineRestAnimRef.current = anim;
    anim.start();
  }, [inlineRestProgress]);

  const localRestRef = useRef<number | null>(localRestOverride);
  localRestRef.current = localRestOverride;

  const startInlineRest = useCallback(() => {
    const restSeconds = localRestRef.current ?? settings.restTimerDefaultSeconds;
    setInlineRestTotal(restSeconds);
    setInlineRestTimeLeft(restSeconds);
    setInlineRestPaused(false);
    inlineRestEndTimeRef.current = Date.now() + restSeconds * 1000;
    setInlineRestActive(true);
    startInlineRestAnim(1, restSeconds * 1000);
  }, [settings.restTimerDefaultSeconds, startInlineRestAnim]);

  const inlineRestDismissAndAdvance = () => {
    if (inlineRestAnimRef.current) inlineRestAnimRef.current.stop();
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

  const handleInlineRestPauseToggle = () => {
    if (inlineRestPaused) {
      inlineRestEndTimeRef.current = Date.now() + inlineRestTimeLeft * 1000;
      setInlineRestPaused(false);
      const remaining = inlineRestTotal > 0 ? inlineRestTimeLeft / inlineRestTotal : 0;
      startInlineRestAnim(remaining, inlineRestTimeLeft * 1000);
    } else {
      if (inlineRestAnimRef.current) inlineRestAnimRef.current.stop();
      setInlineRestPaused(true);
    }
  };

  const handleInlineRestSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    runRestStaggerOut(() => inlineRestDismissRef.current());
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
      const isActiveWithTimer = inlineRestActive && index === expandedGroupIndex;
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
  }, [exerciseGroups, expandedGroupIndex, hasLoggedAnySet, currentRounds, completionTimestamps, inlineRestActive]);
  
  // Map to track original indices for group IDs
  const groupIdToOriginalIndex = useMemo(() => {
    const map = new Map<string, number>();
    exerciseGroups.forEach((group, index) => {
      map.set(group.id, index);
    });
    return map;
  }, [exerciseGroups]);
  
  // Initialize local values at set level (merge, don't overwrite restored session values)
  useEffect(() => {
    if (exerciseGroups.length === 0) return;
    setLocalValues(prev => {
      const merged = { ...prev };
      exerciseGroups.forEach(group => {
        group.exercises.forEach(exercise => {
          for (let round = 0; round < group.totalRounds; round++) {
            const setId = `${exercise.id}-set-${round}`;
            if (!merged[setId]) {
              merged[setId] = {
                weight: exercise.weight || 0,
                reps: Number(exercise.reps) || 0,
              };
            }
          }
        });
      });
      return merged;
    });
  }, [exerciseGroups]);
  
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
        setExpandedGroupIndex(0);
      }
    } else {
      setExpandedGroupIndex(0);
    }

    // Restore localValues from the best available data source
    const restoredValues: Record<string, { weight: number; reps: number }> = {};

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
                  restoredValues[setId] = { weight: s.weight, reps: s.reps };
                }
              });
            }
          });
        });
      });
    }

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
              if (!restoredValues[setId]) {
                restoredValues[setId] = { weight: set.weight, reps: set.reps };
              }
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

  // Handler for adding a new exercise to the workout template
  const handleAddExercise = (exerciseId: string, exerciseName: string) => {
    if (!template) return;
    
    const newItem: WorkoutTemplateExercise = {
      id: `${exerciseId}-${Date.now()}`,
      exerciseId,
      order: template.items.length,
      sets: 3,
      reps: 10,
      weight: 0,
    };
    
    const updatedItems = [...template.items, newItem];
    updateWorkoutTemplate(workoutTemplateId, { items: updatedItems });
    setRefreshKey(prev => prev + 1);
    setShowAddExerciseDrawer(false);
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Build a lookup of session values for displaying accurate logged data
  // Falls back through: localValues → detailedWorkoutProgress → session data → template values
  const getSetDisplayValues = useCallback((exerciseId: string, setIndex: number, templateWeight: number, templateReps: number) => {
    const setId = `${exerciseId}-set-${setIndex}`;
    const fallback = { weight: templateWeight, reps: Number(templateReps) || 0 };
    
    // First try localValues (includes session-restored and user-edited values)
    const lv = localValuesRef.current[setId];
    if (lv && (lv.weight !== fallback.weight || lv.reps !== fallback.reps)) {
      return lv;
    }
    
    // Then try detailedWorkoutProgress (most reliable source for completed workout data)
    const progressData = getDetailedWorkoutProgress();
    if (workoutKey && progressData[workoutKey]) {
      const workoutProgress = progressData[workoutKey];
      // Find the matching exercise in progress by checking all exercises
      for (const [templateExId, exProgress] of Object.entries(workoutProgress.exercises)) {
        const freshTemplate = useStore.getState().workoutTemplates.find(t => t.id === workoutTemplateId);
        const templateExercise = (freshTemplate?.items || (freshTemplate as any)?.exercises)?.find((ex: any) => ex.id === templateExId);
        if (templateExercise?.exerciseId === exerciseId || templateExId === exerciseId) {
          const matchingSet = (exProgress as any).sets?.find((s: any) => s.setNumber === setIndex && s.completed);
          if (matchingSet) {
            return { weight: matchingSet.weight, reps: matchingSet.reps };
          }
        }
      }
    }
    
    // Then try reading directly from the session in the store
    const allSessions = useStore.getState().sessions;
    const session = allSessions.find(s => (s as any).workoutKey === workoutKey)
      || allSessions.find(s => {
        const dm = workoutKey?.match(/(\d{4}-\d{2}-\d{2})/);
        const sd = dm ? dm[1] : null;
        return s.workoutTemplateId === workoutTemplateId && sd && s.date === sd;
      });
    if (session) {
      const match = session.sets.find(s =>
        (s.exerciseId === exerciseId) && (s.setIndex === setIndex)
      );
      if (match) return { weight: match.weight, reps: match.reps };
    }
    
    // Last resort: localValues (even if same as template) or template
    return lv || fallback;
  }, [workoutKey, workoutTemplateId]);

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
    } else {
      console.log('⚠️ No completed sets to save - session not created');
    }
  };
  
  const handleComplete = async () => {
    if (expandedGroupIndex < 0) return;
    
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
        setIsExerciseTimerPhase(false);
        setShowTimer(true);
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
    const savedWeight = setValues?.weight ?? currentExercise.weight ?? 0;
    const savedReps = setValues?.reps ?? Number(currentExercise.reps) ?? 0;
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
  
  const advanceToNext = async (allExercisesComplete: boolean, newCompletedSets: Set<string>) => {
    setShowTimer(false);
    setInlineRestActive(false);
    
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
          LayoutAnimation.configureNext(
            LayoutAnimation.create(250, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
          );
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
          
          setExpandedGroupIndex(-1);
          setActiveExerciseIndex(0);
        }
      } else {
        // Same group, next round — keep card expanded until all sets in this superset are logged
        const roundJustFinished = completedRounds - 1; // 0-based round we just completed
        console.log('🟢 [ExerciseExecution] STAY EXPANDED: same group next round. roundJustFinished=', roundJustFinished, 'nextRound=', nextRound, '(NOT calling setExpandedGroupIndex)');
        await saveSession(newCompletedSets);
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
      setIsExerciseTimerPhase(true);
      setShowTimer(true);
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
    setShowTimer(true);
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
                  sets.push({
                    setNumber: round,
                    weight: sv?.weight ?? exercise.weight ?? 0,
                    reps: sv?.reps ?? Number(exercise.reps) ?? 0,
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
            LayoutAnimation.configureNext(
              LayoutAnimation.create(250, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
            );

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

  const handleSwap = () => {
    setShowMenu(false);
    
    // Check if any sets have been logged
    const hasLoggedSets = completedSets.size > 0;
    
    if (hasLoggedSets) {
      // Show alert that requires reset first
      Alert.alert(
        t('resetRequired'),
        t('resetRequiredMessage'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('reset'),
            style: 'destructive',
            onPress: async () => {
              // Clear completion in store first (completedSets derives automatically)
              if (type === 'warmup') {
                await resetWarmupCompletion(workoutKey);
              } else if (type === 'core') {
                await resetAccessoryCompletion(workoutKey);
              } else if (type === 'main') {
                await resetMainCompletion(workoutKey);
              }
              
              if (currentSessionId) {
                await deleteSession(currentSessionId);
                setCurrentSessionId(null);
              }
              
              LayoutAnimation.configureNext(
                LayoutAnimation.create(250, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
              );
              setCompletionTimestamps({});
              setExpandedGroupIndex(0);
              setActiveExerciseIndex(0);
              setHasLoggedAnySet(false);
              setLocalValues({});
              
              // Show feedback
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              
              // Now navigate to editor
              if (type === 'warmup') {
                (navigation as any).navigate('WarmupEditor', { templateId: workoutTemplateId, workoutKey });
              } else if (type === 'core') {
                (navigation as any).navigate('AccessoriesEditor', { templateId: workoutTemplateId, workoutKey });
              }
            },
          },
        ]
      );
    } else {
      // No sets logged, allow swap directly
      if (type === 'warmup') {
        (navigation as any).navigate('WarmupEditor', { templateId: workoutTemplateId, workoutKey });
      } else if (type === 'core') {
        (navigation as any).navigate('AccessoriesEditor', { templateId: workoutTemplateId, workoutKey });
      }
    }
  };
  
  const getTitle = () => {
    if (type === 'warmup') return t('warmup');
    if (type === 'core') return t('core');
    return template?.name || 'Workout';
  };
  
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
  
  // Get exercise history for the current exercise
  const getExerciseHistoryForDrawer = (exerciseId: string) => {
    const historyByDate = new Map<string, Array<{ setNumber: number; weight: number; reps: number }>>();
    
    // 1. Get from detailed workout progress (written by ExerciseDetailScreen)
    const workoutTemplateMap = new Map<string, any>();
    const freshWorkoutTemplates = useStore.getState().workoutTemplates;
    freshWorkoutTemplates.forEach(template => {
      workoutTemplateMap.set(template.id, template);
    });
    
    const detailedWorkoutProgress = getDetailedWorkoutProgress();
    Object.entries(detailedWorkoutProgress).forEach(([wKey, workoutProgress]) => {
      const wTemplateId = wKey.split('-').slice(0, -3).join('-');
      const workoutTemplate = workoutTemplateMap.get(wTemplateId);
      
      if (!workoutTemplate) return;
      
      Object.entries(workoutProgress.exercises).forEach(([templateExerciseId, exerciseProgress]) => {
        const templateExercise = (workoutTemplate.items || (workoutTemplate as any).exercises)?.find((ex: any) => ex.id === templateExerciseId);
        
        if (!templateExercise) return;
        
        const exerciseDataById = exercisesLibrary.find(e => e.id === templateExercise.exerciseId);
        const exerciseDataForCurrent = exercisesLibrary.find(e => e.id === exerciseId);
        
        const matchesById = templateExercise.exerciseId === exerciseId;
        const matchesByName = exerciseDataById?.name.toLowerCase().trim() === exerciseDataForCurrent?.name.toLowerCase().trim();
        
        if (matchesById || matchesByName) {
          if (exerciseProgress.skipped) return;
          
          const hasCompletedSets = exerciseProgress.sets.some(set => set.completed);
          
          if (hasCompletedSets) {
            const dateMatch = wKey.match(/(\d{4}-\d{2}-\d{2})/);
            const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
            
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
        set.exerciseId === exerciseId || set.exerciseName === items.find(i => i.id === exerciseId)?.exerciseName
      );
      if (!hasExercise) return;
      
      const existing = latestSessionByDate.get(date);
      if (!existing || session.id > existing.id) {
        latestSessionByDate.set(date, session);
      }
    });
    
    latestSessionByDate.forEach((session, date) => {
      session.sets.forEach(set => {
        if (set.exerciseId === exerciseId || set.exerciseName === items.find(i => i.id === exerciseId)?.exerciseName) {
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
  
  // Rest of the render logic from WarmupExecutionScreen...
  // (I'll keep this abbreviated for now, but it will include all the card rendering, drawer, timer, etc.)
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ShapeConfetti active={showConfetti} />
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
            <IconArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {!isInPastCycle && (
            <TouchableOpacity
              testID="menu-button"
              style={styles.menuButton}
              onPress={() => setShowMenu(true)}
              activeOpacity={1}
            >
              <IconMenu size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.headerContent}>
          <Text testID="header-title" style={styles.headerTitle}>{getTitle()}</Text>
        </View>
      </View>
      
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        {allCurrentGroupsComplete ? (
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
              <View key={group.id} testID={`exercise-group-${originalIndex}`} style={styles.itemRow}>
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
                        const isCurrentExercise = isExpanded && exIndex === activeExerciseIndex;
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
                                } else if (isCurrentExercise) {
                                  setDrawerGroupIndex(null);
                                  setDrawerExerciseIndex(null);
                                  const currentRound = currentRounds[group.id] || 0;
                                  setExpandedSetInDrawer(currentRound);
                                  setShowAdjustmentDrawer(true);
                                } else if (!hasLoggedAnySet && !isExpanded) {
                                  LayoutAnimation.configureNext(
                                    LayoutAnimation.create(
                                      250,
                                      LayoutAnimation.Types.easeInEaseOut,
                                      LayoutAnimation.Properties.opacity
                                    )
                                  );
                                  setExpandedGroupIndex(originalIndex);
                                  setActiveExerciseIndex(0);
                                }
                              }}
                            >
                              {/* Collapsed card: not started or completed */}
                              {!isCurrentExercise ? (
                                <View style={[styles.itemCardCollapsed, isExerciseCompleted && styles.exerciseContentDimmed]}>
                                  <Text style={[
                                    styles.exerciseNameText,
                                    isExpanded && styles.exerciseNameTextActive,
                                    { flex: 1 },
                                  ]} numberOfLines={1}>
                                    {exercise.exerciseName}
                                  </Text>
                                </View>
                              ) : (
                                /* Active card: full expanded layout */
                                <View style={styles.itemCardExpanded}>
                                  {/* Superset active: two-column layout */}
                                  {group.exercises.length > 1 ? (
                                    <View style={styles.supersetActiveRow}>
                                      <View style={styles.supersetActiveLeft}>
                                        <Text style={[
                                          styles.exerciseNameText,
                                          styles.exerciseNameTextActive,
                                        ]} numberOfLines={1}>
                                          {exercise.exerciseName}
                                        </Text>
                                        <View style={styles.valuesInlineRow}>
                                          {showWeight && (
                                            <View style={styles.valueRow}>
                                              <Text style={styles.largeValue}>
                                                {formatWeightForLoad(displayWeight, useKg)}
                                              </Text>
                                              <Text style={styles.unit}>{weightUnit}</Text>
                                            </View>
                                          )}
                                          <View style={styles.valueRow}>
                                            <Text style={styles.largeValue}>{displayReps}</Text>
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
                                      </View>
                                      <View style={styles.supersetActiveRight}>
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
                                          style={{ opacity: isCompleted ? 0 : 1 }}
                                          disabled={isCompleted}
                                        >
                                          <IconEdit size={18} color={COLORS.textMeta} />
                                        </TouchableOpacity>
                                        <NextLabel />
                                      </View>
                                    </View>
                                  ) : (
                                    <>
                                      <View style={styles.exerciseNameRowWithIcon}>
                                        <Text style={[
                                          styles.exerciseNameText,
                                          styles.exerciseNameTextActive,
                                          { flex: 1 },
                                        ]} numberOfLines={1}>
                                          {exercise.exerciseName}
                                        </Text>
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
                                          style={{ opacity: isCompleted ? 0 : 1 }}
                                          disabled={isCompleted}
                                        >
                                          <IconEdit size={18} color={COLORS.textMeta} />
                                        </TouchableOpacity>
                                      </View>

                                      <View style={styles.valuesDisplayRow}>
                                        <View style={styles.valuesDisplayLeft}>
                                          {showWeight && (
                                            <View style={styles.valueColumn}>
                                              <View style={styles.valueRow}>
                                                <Text style={styles.largeValue}>
                                                  {formatWeightForLoad(displayWeight, useKg)}
                                                </Text>
                                                <Text style={styles.unit}>{weightUnit}</Text>
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
                                            <Text style={styles.unit}>{repsUnit}</Text>
                                          </View>
                                        </View>
                                      </View>
                                    </>
                                  )}
                                </View>
                              )}
                            </TouchableOpacity>
                          </React.Fragment>
                        );
                      })}
                      {/* Completed check icon */}
                      {isCompleted && (
                        <View style={styles.completedCardBadge}>
                          <IconCheckmark size={16} color={COLORS.successBright} />
                        </View>
                      )}

                      {/* Start button + Set indicator row / Inline rest timer */}
                      {indicatorActive && (
                        <View style={styles.cardActionRow}>
                          {/* Left: unified button / timer — same element, no mount/unmount */}
                          <Animated.View style={[styles.actionLeftContainer, {
                            borderBottomRightRadius: counterShrinkAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [11, 0, 0] }),
                            borderRightWidth: counterShrinkAnim.interpolate({ inputRange: [0, 0.05, 1], outputRange: [1, 0, 0] }),
                          }]}>
                            <View style={styles.inlineRestProgressTrack}>
                              <Animated.View style={[styles.inlineRestProgressFill, { width: inlineRestProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
                            </View>

                            {/* Button label — fades out when timer starts */}
                            <Animated.View
                              style={[styles.actionLeftOverlay, { opacity: buttonLabelOpacity }]}
                              pointerEvents={inlineRestActive ? 'none' : 'auto'}
                            >
                              <TouchableOpacity
                                testID="start-button"
                                style={styles.actionLeftTouchable}
                                onPress={handleStart}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.cardStartButtonText}>
                                  {group.exercises[activeExerciseIndex]?.isTimeBased ? t('startTimer') : t('markAsCompleted')}
                                </Text>
                              </TouchableOpacity>
                            </Animated.View>

                            {/* Timer controls — stagger in over the progress bar */}
                            <View
                              style={styles.inlineRestControlsAbsolute}
                              pointerEvents={inlineRestActive ? 'auto' : 'none'}
                            >
                              <Animated.View style={{ opacity: restStagger.timerLabel, transform: [{ translateX: restStagger.timerLabel.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }}>
                                <Text style={styles.inlineRestTime}>
                                  {Math.floor(inlineRestTimeLeft / 60)}:{String(inlineRestTimeLeft % 60).padStart(2, '0')}
                                </Text>
                              </Animated.View>
                              <Animated.View style={{ opacity: restStagger.pauseIcon, transform: [{ translateX: restStagger.pauseIcon.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }}>
                                <TouchableOpacity onPress={handleInlineRestPauseToggle} activeOpacity={0.7} style={styles.inlineRestIconBtn}>
                                  {inlineRestPaused ? <IconPlay size={20} color={COLORS.text} /> : <IconPause size={20} color={COLORS.text} />}
                                </TouchableOpacity>
                              </Animated.View>
                              <Animated.View style={{ opacity: restStagger.skipIcon, transform: [{ translateX: restStagger.skipIcon.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }}>
                                <TouchableOpacity onPress={handleInlineRestSkip} activeOpacity={0.7} style={styles.inlineRestIconBtn}>
                                  <IconSkip size={20} color={COLORS.text} />
                                </TouchableOpacity>
                              </Animated.View>
                            </View>
                          </Animated.View>

                          {/* Right: set counter — shrinks to zero on last set of a group */}
                          <Animated.View style={[styles.setCountIndicator, {
                            flexDirection: 'row',
                            alignItems: 'center',
                            maxWidth: counterShrinkAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 100] }),
                            paddingHorizontal: counterShrinkAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }),
                            borderTopWidth: counterShrinkAnim.interpolate({ inputRange: [0, 0.01, 1], outputRange: [0, 1, 1] }),
                            borderBottomWidth: counterShrinkAnim.interpolate({ inputRange: [0, 0.01, 1], outputRange: [0, 1, 1] }),
                            borderRightWidth: counterShrinkAnim.interpolate({ inputRange: [0, 0.01, 1], outputRange: [0, 1, 1] }),
                            borderLeftWidth: 0,
                          }]}>
                            {inlineRestActive && inlineRestIsLastSet ? (
                              <IconCheckmark size={18} color={COLORS.accentPrimary} />
                            ) : (
                              <>
                                <Animated.View style={{
                                  overflow: 'hidden',
                                  maxWidth: nextLabelAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 50] }),
                                  marginRight: nextLabelAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }),
                                }}>
                                  <Text style={styles.setCountNextLabel} numberOfLines={1}>
                                    {t('next')}
                                  </Text>
                                </Animated.View>
                                <Text style={styles.setCountText} numberOfLines={1}>
                                  {inlineRestActive
                                    ? `${Math.min(currentRound + 1, group.totalRounds)}/${group.totalRounds}`
                                    : `${currentRound + 1}/${group.totalRounds}`}
                                </Text>
                              </>
                            )}
                          </Animated.View>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Add Exercise button - appears after first set is logged */}
        {type === 'main' && (
          <TouchableOpacity
            style={styles.addExerciseButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowAddExerciseDrawer(true);
            }}
            activeOpacity={0.7}
          >
            <DiagonalLinePattern width="100%" height="100%" borderRadius={BORDER_RADIUS.lg} />
            <View style={styles.addExerciseButtonContent}>
              <IconAdd size={20} color={COLORS.text} />
              <Text style={styles.addExerciseButtonText}>{t('addExercise')}</Text>
            </View>
          </TouchableOpacity>
        )}
          </>
        )}
      </ScrollView>
      
      
      {/* Timer Sheet */}
      {expandedGroupIndex >= 0 && exerciseGroups[expandedGroupIndex] && (
        <SetTimerSheet
          visible={showTimer}
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
          exerciseDuration={localValues[exerciseGroups[expandedGroupIndex].exercises[activeExerciseIndex]?.id]?.reps ?? exerciseGroups[expandedGroupIndex].exercises[activeExerciseIndex]?.reps ?? 30}
          onExerciseTimerComplete={handleComplete}
          skipRestPhase={type !== 'main'}
          isPerSide={exerciseGroups[expandedGroupIndex].exercises[activeExerciseIndex]?.isPerSide}
          restTimeOverride={localRestOverride}
        />
      )}
      
      {/* Adjustment Drawer */}
      {(() => {
        const drawerGrpIdx = drawerGroupIndex ?? expandedGroupIndex;
        const drawerExIdx = drawerExerciseIndex ?? activeExerciseIndex;
        return (
      <BottomDrawer
        visible={showAdjustmentDrawer}
        onClose={() => {
          setShowAdjustmentDrawer(false);
          setDrawerGroupIndex(null);
          setDrawerExerciseIndex(null);
          // Re-save session to persist any value changes made in the drawer
          saveSession();
        }}
        maxHeight="90%"
        scrollable={true}
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
                  <IconSettings size={24} color={COLORS.text} />
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
                                  setLocalValues(prev => {
                                    const current = prev[setId];
                                    if (!current) return prev;
                                    const updated = { ...prev };
                                    for (let i = setIndex; i < currentGroup.totalRounds; i++) {
                                      const futureSetId = `${activeExercise.id}-set-${i}`;
                                      if (completedSets.has(futureSetId)) continue; // don't overwrite logged sets
                                      updated[futureSetId] = {
                                        reps: updated[futureSetId]?.reps ?? current.reps,
                                        weight: newWeight,
                                      };
                                    }
                                    return updated;
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
                                  setLocalValues(prev => {
                                    const current = prev[setId];
                                    if (!current) return prev;
                                    const updated = { ...prev };
                                    for (let i = setIndex; i < currentGroup.totalRounds; i++) {
                                      const futureSetId = `${activeExercise.id}-set-${i}`;
                                      if (completedSets.has(futureSetId)) continue; // don't overwrite logged sets
                                      updated[futureSetId] = {
                                        weight: updated[futureSetId]?.weight ?? current.weight,
                                        reps: parsed,
                                      };
                                    }
                                    return updated;
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
          
          {/* Barbell toggle: below the set cards, when weight > bar (20kg / 45lb) */}
          {drawerGrpIdx >= 0 && exerciseGroups[drawerGrpIdx] && exerciseGroups[drawerGrpIdx].exercises[drawerExIdx] && (() => {
            const activeExercise = exerciseGroups[drawerGrpIdx].exercises[drawerExIdx];
            const currentRound = currentRounds[exerciseGroups[drawerGrpIdx].id] ?? 0;
            const drawerSetVals = getSetDisplayValues(activeExercise.id, currentRound, activeExercise.weight ?? 0, activeExercise.reps ?? 0);
            const displayWeight = localValues[`${activeExercise.id}-set-${currentRound}`]?.weight ?? drawerSetVals.weight;
            const showBarbellToggle = displayWeight > (useKg ? 20 : 45);
            const isBarbellMode = getBarbellMode(activeExercise.id);
            if (!showBarbellToggle) return null;
            return (
              <View style={[styles.barbellToggleRow, styles.barbellToggleContainer]}>
                <Text style={styles.barbellToggleLabel}>{t('barbellMode')}</Text>
                <Toggle
                  value={isBarbellMode}
                  onValueChange={() => setBarbellMode(activeExercise.id, !isBarbellMode)}
                />
              </View>
            );
          })()}
          
          {/* Exercise History */}
          {drawerGrpIdx >= 0 && exerciseGroups[drawerGrpIdx] && (() => {
            const activeExercise = exerciseGroups[drawerGrpIdx].exercises[drawerExIdx];
            if (!activeExercise) return null;
            
            // Get exercise history for this exercise
            const exerciseHistory = getExerciseHistoryForDrawer(activeExercise.id);
            
            // Only show if there's history
            if (exerciseHistory.length === 0) return null;
            
            // Show latest workout by default, or last 3 if expanded (oldest first, latest at bottom)
            const workoutsToShow = showExerciseHistory ? exerciseHistory.slice(-3) : exerciseHistory.slice(-1);
            
            return (
              <>
                <View style={styles.historyFullBleedDivider} />
                <View style={styles.historySection}>
                  {workoutsToShow.map((workout, workoutIndex) => (
                    <View key={workout.date}>
                      <View style={styles.historyRow}>
                        {/* Left column: label + date */}
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

                        {/* Right column: sets */}
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
                  ))}
                </View>
              </>
            );
          })()}

          {/* Save button - appears when keyboard is visible */}
          {isKeyboardVisible && (
            <View style={styles.drawerKeyboardSaveContainer}>
              <TouchableOpacity
                style={styles.drawerKeyboardSaveButton}
                onPress={() => Keyboard.dismiss()}
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
                          item.exerciseId === currentExercise.id ? { ...item, exerciseId } : item
                        );
                        await updateWorkoutTemplate(workoutTemplateId, { items: updatedItems });
                      }
                      cleanupAfterSwap(currentExercise.id, exerciseId);
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
                                    item.exerciseId === currentExercise.id ? { ...item, exerciseId: newId } : item
                                  );
                                  await updateWorkoutTemplate(workoutTemplateId, { items: updatedItems });
                                }
                                cleanupAfterSwap(currentExercise.id, newId);
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
              icon: <IconAddTime size={24} color="#FFFFFF" />,
              label: `${(() => { const s = localRestOverride ?? settings.restTimerDefaultSeconds; return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; })()}`,
              onPress: () => {
                setShowMenu(false);
                setTimeout(() => setShowRestTimePicker(true), 350);
              },
              featured: true,
            },
            {
              icon: <IconRestart size={24} color={COLORS.signalNegative} />,
              label: t('reset'),
              onPress: handleReset,
              destructive: true,
            },
          ] : [
            {
              icon: <IconAddTime size={24} color="#FFFFFF" />,
              label: `${(() => { const s = localRestOverride ?? settings.restTimerDefaultSeconds; return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; })()}`,
              onPress: () => {
                setShowMenu(false);
                setTimeout(() => setShowRestTimePicker(true), 350);
              },
              featured: true,
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
              icon: <IconSwap size={24} color="#FFFFFF" />,
              label: t('swap'),
              onPress: handleSwap,
            },
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
      
      {/* Exercise Settings Menu (in Adjust Values Drawer): Switch to Time/Reps (own row), Swap, Remove. Barbell is in the drawer below. */}
      {expandedGroupIndex >= 0 && exerciseGroups[expandedGroupIndex] && exerciseGroups[expandedGroupIndex].exercises[activeExerciseIndex] && (() => {
        const activeExercise = exerciseGroups[expandedGroupIndex].exercises[activeExerciseIndex];
        const exerciseMenuItems: ActionSheetItem[] = [
          {
            icon: <IconAddTime size={24} color={activeExercise.isTimeBased ? COLORS.accentPrimary : '#FFFFFF'} />,
            label: activeExercise.isTimeBased ? 'Switch to Reps' : 'Switch to Time',
            onPress: () => {
              setTimeBasedOverrides(prev => ({
                ...prev,
                [activeExercise.id]: !activeExercise.isTimeBased,
              }));
              setShowExerciseSettingsMenu(false);
            },
            featured: true,
          },
          {
            icon: <IconSwap size={24} color="#FFFFFF" />,
            label: t('swap'),
            onPress: () => {
              setShowExerciseSettingsMenu(false);
              setShowAdjustmentDrawer(false);
              setTimeout(() => setShowSwapModal(true), 400);
            },
          },
          {
            icon: <IconTrash size={24} color={COLORS.error} />,
            label: t('remove'),
            onPress: () => {
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
                          console.log('[Remove] Confirm pressed', {
                            type,
                            activeExerciseId: activeExercise.id,
                            workoutKey,
                            hasScheduledWorkout: !!scheduledWorkout,
                            hasTemplate: !!template,
                            templateItemsLen: template?.items?.length,
                            warmupItemsLen: template?.warmupItems?.length,
                            accessoryItemsLen: template?.accessoryItems?.length,
                          });
                          if (type === 'warmup') {
                            const source = scheduledWorkout?.warmupSnapshot ?? template?.warmupItems ?? [];
                            console.log('[Remove] warmup source', { sourceLen: source.length, sourceIds: source.map((i: any) => i.id) });
                            const updatedItems = source.filter((item: any) => item.id !== activeExercise.id);
                            console.log('[Remove] warmup updatedItems', updatedItems.length);
                            await updateWorkoutTemplate(workoutTemplateId, { warmupItems: updatedItems });
                            console.log('[Remove] warmup template updated');
                            if (scheduledWorkout && workoutKey) {
                              await updateScheduledWorkoutSnapshots(workoutKey, { warmupSnapshot: updatedItems });
                              console.log('[Remove] warmup snapshot updated');
                            }
                          } else if (type === 'core') {
                            const source = scheduledWorkout?.accessorySnapshot ?? template?.accessoryItems ?? [];
                            console.log('[Remove] core source', { sourceLen: source.length, sourceIds: source.map((i: any) => i.id) });
                            const updatedItems = source.filter((item: any) => item.id !== activeExercise.id);
                            console.log('[Remove] core updatedItems', updatedItems.length);
                            await updateWorkoutTemplate(workoutTemplateId, { accessoryItems: updatedItems });
                            console.log('[Remove] core template updated');
                            if (scheduledWorkout && workoutKey) {
                              await updateScheduledWorkoutSnapshots(workoutKey, { accessorySnapshot: updatedItems });
                              console.log('[Remove] core snapshot updated');
                            }
                          } else if (type === 'main') {
                            const source = scheduledWorkout?.exercisesSnapshot ?? template?.items ?? [];
                            const sourceIds = source.map((i: any) => ({ id: i.id, exerciseId: i.exerciseId }));
                            console.log('[Remove] main source', { sourceLen: source.length, sourceIds });
                            // Match how we set id in items useMemo: scheduled uses item.id, else item.exerciseId ?? item.id
                            const updatedItems = source.filter((item: any) => {
                              const itemKey = scheduledWorkout ? item.id : (item.exerciseId ?? item.id);
                              return itemKey !== activeExercise.id;
                            });
                            console.log('[Remove] main updatedItems', updatedItems.length, 'activeExercise.id', activeExercise.id);
                            await updateWorkoutTemplate(workoutTemplateId, { items: updatedItems });
                            console.log('[Remove] main template updated');
                            if (scheduledWorkout && workoutKey) {
                              await updateScheduledWorkoutSnapshots(workoutKey, { exercisesSnapshot: updatedItems });
                              console.log('[Remove] main snapshot updated');
                            }
                          }
                          setRefreshKey(prev => prev + 1);
                          console.log('[Remove] refreshKey bumped, done');
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } catch (e) {
                          console.error('[Remove] Error', e);
                        }
                      },
                    },
                  ]
                );
              }, 300);
            },
            destructive: true,
          },
        ];
        return (
          <ActionSheet
            visible={showExerciseSettingsMenu}
            onClose={() => setShowExerciseSettingsMenu(false)}
            items={exerciseMenuItems}
          />
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
  onSelect: (id: string, name: string) => void; 
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
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(item.id, item.name);
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
    backgroundColor: COLORS.backgroundCanvas,
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
  headerContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: '#FFFFFF',
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
    borderRadius: 16,
    borderCurve: 'continuous' as const,
    overflow: 'hidden',
  },
  itemCardFill: {
    backgroundColor: COLORS.activeCard,
    borderRadius: 15,
    borderCurve: 'continuous' as const,
    overflow: 'hidden',
  },
  itemCardInactive: {
    ...CARDS.cardDeep.outer,
    // 1px transparent padding to match active card size and prevent layout jump
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 1,
    paddingRight: 1,
    borderWidth: 0,
  },
  itemCardInnerInactive: {
    ...CARDS.cardDeep.inner,
  },
  itemCardDimmed: {
    ...CARDS.cardDeepDimmed.outer,
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 1,
    paddingRight: 1,
    borderWidth: 0,
  },
  itemCardInnerDimmed: {
    ...CARDS.cardDeepDimmed.inner,
  },
  itemCardCollapsed: {
    height: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemCardExpanded: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
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
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  exerciseNameTextActive: {
    color: COLORS.text,
  },
  editIconContainer: {
    marginLeft: SPACING.md,
  },
  valuesDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  unit: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  cardActionRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingBottom: 4,
    height: 48,
    gap: 0,
  },
  setCountIndicator: {
    backgroundColor: COLORS.accentPrimaryDimmed,
    borderColor: COLORS.accentPrimary,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 11,
    borderCurve: 'continuous' as const,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    height: 44,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  actionLeftContainer: {
    flex: 1,
    height: 44,
    backgroundColor: COLORS.backgroundContainer,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 11,
    borderBottomRightRadius: 0,
    borderCurve: 'continuous' as const,
    borderWidth: 1,
    borderColor: COLORS.accentPrimary,
    borderRightWidth: 0,
    overflow: 'hidden',
  },
  actionLeftOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  actionLeftTouchable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardStartButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.backgroundCanvas,
  },
  setCountText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.accentPrimary,
    textAlign: 'center',
  },
  setCountIndicatorRow: {
    flexDirection: 'row',
    gap: 4,
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
    paddingHorizontal: 12,
    gap: 8,
    zIndex: 1,
    overflow: 'hidden',
  },
  inlineRestProgressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.accentPrimaryDimmed,
    borderRadius: 10,
  },
  inlineRestProgressFill: {
    height: '100%',
    backgroundColor: COLORS.accentPrimary,
  },
  inlineRestTime: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
    width: 52,
    paddingVertical: 4,
    textAlign: 'center',
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
    backgroundColor: COLORS.activeCard,
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
  completedCardBadge: {
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
    color: COLORS.textMeta,
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
  // Add Exercise button
  addExerciseButton: {
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.xl,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
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
