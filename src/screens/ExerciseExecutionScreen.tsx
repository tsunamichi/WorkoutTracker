import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager, Alert, Animated, Modal, FlatList, TextInput, Keyboard, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconArrowLeft, IconCheck, IconCheckmark, IconAddLine, IconMinusLine, IconTrash, IconEdit, IconMenu, IconHistory, IconRestart, IconSkip, IconSwap, IconSettings, IconArrowRight, IconAdd } from '../components/icons';
import { BottomDrawer } from '../components/common/BottomDrawer';
import { NextLabel } from '../components/common/NextLabel';
import { SetTimerSheet } from '../components/timer/SetTimerSheet';
import { ActionSheet } from '../components/common/ActionSheet';
import { Toggle } from '../components/Toggle';
import { DiagonalLinePattern } from '../components/common/DiagonalLinePattern';
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
  
  const { workoutKey, workoutTemplateId, type } = route.params;
  
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
  } = useStore();
  
  const getDetailedWorkoutProgress = () => useStore.getState().detailedWorkoutProgress;
  
  const [refreshKey, setRefreshKey] = useState(0);
  const template = getWorkoutTemplate(workoutTemplateId);
  const useKg = settings.useKg;
  const weightUnit = useKg ? 'kg' : 'lb';
  const weightStep = useKg ? 0.5 : 5;
  
  // Refresh template when screen comes into focus (to show newly added warmup/core items)
  useFocusEffect(
    React.useCallback(() => {
      setRefreshKey(prev => prev + 1);
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

  // Get the appropriate items based on type
  const items = useMemo(() => {
    if (type === 'warmup') {
      return (template?.warmupItems || []).map(normalizeToDeprecated);
    }
    if (type === 'core') {
      return (template?.accessoryItems || []).map(normalizeToDeprecated);
    }
    // For main workout, convert WorkoutTemplateExercise to WarmupItem format
    if (type === 'main') {
      return (template?.items || []).map(item => {
        const exercise = exercisesLibrary.find(ex => ex.id === item.exerciseId);
        return {
          id: item.exerciseId,
          exerciseName: exercise?.name || 'Exercise',
          sets: item.sets,
          reps: item.reps,
          weight: item.weight || 0,
          isTimeBased: item.isTimeBased ?? exercise?.measurementType === 'time' ?? false,
          isPerSide: false,
          cycleId: item.cycleId,
          cycleOrder: item.cycleOrder,
        } as WarmupItem;
      });
    }
    return [];
  }, [type, template, exercisesLibrary, refreshKey]);
  
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
        const maxSets = Math.max(...cycleItems.map(i => i.sets));
        
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
        result.push({
          id: item.id,
          isCycle: false,
          totalRounds: item.sets,
          exercises: [item],
        });
        processedItems.add(item.id);
      }
    });
    
    return result;
  }, [items]);
  
  // State
  const [expandedGroupIndex, setExpandedGroupIndex] = useState(-1);
  const [currentRounds, setCurrentRounds] = useState<Record<string, number>>({});
  const [completedSets, setCompletedSets] = useState<Set<string>>(new Set());
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0); // Start with first exercise when group is expanded
  const [hasLoggedAnySet, setHasLoggedAnySet] = useState(false); // Track if any set has been logged
  const [completionTimestamps, setCompletionTimestamps] = useState<Record<string, number>>({}); // Track when groups were completed
  const accessoriesAnim = useRef(new Animated.Value(0)).current; // 0 = expanded, 1 = collapsed
  const accessoriesIsCollapsed = useRef(false);
  const accessoriesDragStart = useRef(0);
  const accessoriesCurrentVal = useRef(0);

  const ACCESSORIES_EXPANDED_HEIGHT = 120;
  const SNAP_THRESHOLD = 0.35;

  useEffect(() => {
    const id = accessoriesAnim.addListener(({ value }) => {
      accessoriesCurrentVal.current = value;
    });
    return () => accessoriesAnim.removeListener(id);
  }, []);

  const collapseAccessories = () => {
    accessoriesIsCollapsed.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(accessoriesAnim, { toValue: 1, useNativeDriver: false, damping: 18, stiffness: 200 }).start();
  };

  const expandAccessories = () => {
    accessoriesIsCollapsed.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(accessoriesAnim, { toValue: 0, useNativeDriver: false, damping: 18, stiffness: 200 }).start();
  };

  const accessoriesPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderGrant: () => {
        accessoriesAnim.stopAnimation();
        accessoriesDragStart.current = accessoriesCurrentVal.current;
      },
      onPanResponderMove: (_, gs) => {
        const progress = accessoriesDragStart.current + (gs.dy / ACCESSORIES_EXPANDED_HEIGHT);
        accessoriesAnim.setValue(Math.max(0, Math.min(1, progress)));
      },
      onPanResponderRelease: (_, gs) => {
        const currentVal = accessoriesCurrentVal.current;
        const isTap = Math.abs(gs.dy) < 5 && Math.abs(gs.dx) < 5;

        if (isTap) {
          if (accessoriesIsCollapsed.current) expandAccessories();
          else collapseAccessories();
          return;
        }

        const goingDown = gs.vy > 0;
        const shouldCollapse = goingDown ? currentVal > SNAP_THRESHOLD : currentVal > (1 - SNAP_THRESHOLD);

        if (shouldCollapse) collapseAccessories();
        else expandAccessories();
      },
    })
  ).current;
  const [showAddExerciseDrawer, setShowAddExerciseDrawer] = useState(false); // Add exercise bottom drawer

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
  const [showMenu, setShowMenu] = useState(false);
  const [showExerciseHistory, setShowExerciseHistory] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapSearchQuery, setSwapSearchQuery] = useState('');
  const [showExerciseSettingsMenu, setShowExerciseSettingsMenu] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isAccessoriesCollapsed, setIsAccessoriesCollapsed] = useState(true);
  const historyOpacity = useRef(new Animated.Value(0)).current;
  
  // Use refs to avoid stale closures in timer callbacks
  const completedSetsRef = useRef(completedSets);
  const currentRoundsRef = useRef(currentRounds);
  const activeExerciseIndexRef = useRef(activeExerciseIndex);
  
  // Keep refs in sync with state
  useEffect(() => {
    completedSetsRef.current = completedSets;
    currentRoundsRef.current = currentRounds;
    activeExerciseIndexRef.current = activeExerciseIndex;
  }, [completedSets, currentRounds, activeExerciseIndex]);
  
  // Track keyboard visibility for in-drawer Save button
  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
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
      const isCompleted = currentRound >= group.totalRounds;
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
  }, [exerciseGroups, expandedGroupIndex, hasLoggedAnySet, currentRounds, completionTimestamps]);
  
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
  
  // Load completion state
  useEffect(() => {
    if (exerciseGroups.length === 0) return; // Wait for groups to be populated
    
    console.log('📂 Loading completion state:', { type, workoutKey });
    const completion = type === 'warmup' 
      ? getWarmupCompletion(workoutKey)
      : type === 'core'
      ? getAccessoryCompletion(workoutKey)
      : type === 'main'
      ? getMainCompletion(workoutKey)
      : null;
    
    console.log('📊 Loaded completion:', completion);
      
    if (completion && completion.completedItems.length > 0) {
      const completedItemsSet = new Set(completion.completedItems);
      setCompletedSets(completedItemsSet);
      setHasLoggedAnySet(true); // User has already logged sets
      accessoriesIsCollapsed.current = true;
      accessoriesAnim.setValue(1);
      
      // Calculate current rounds for each group
      const rounds: Record<string, number> = {};
      exerciseGroups.forEach(group => {
        let completedRounds = 0;
        for (let round = 0; round < group.totalRounds; round++) {
          const allExercisesComplete = group.exercises.every(ex => {
            const setId = `${ex.id}-set-${round}`;
            return completedItemsSet.has(setId);
          });
          if (allExercisesComplete) {
            completedRounds = round + 1;
          } else {
            break;
          }
        }
        rounds[group.id] = completedRounds;
      });
      setCurrentRounds(rounds);
      
      // Find the last group that has ANY progress (where user was working)
      // This is better than "first incomplete" because user may have skipped ahead
      let lastActiveGroupIndex = -1;
      exerciseGroups.forEach((group, idx) => {
        const hasAnyProgress = group.exercises.some(ex => {
          for (let round = 0; round < group.totalRounds; round++) {
            if (completedItemsSet.has(`${ex.id}-set-${round}`)) return true;
          }
          return false;
        });
        if (hasAnyProgress) {
          lastActiveGroupIndex = idx;
        }
      });
      
      // If the last active group is fully complete, find the next incomplete group
      if (lastActiveGroupIndex >= 0) {
        const lastActiveRounds = rounds[exerciseGroups[lastActiveGroupIndex].id] || 0;
        const lastActiveTotal = exerciseGroups[lastActiveGroupIndex].totalRounds;
        
        if (lastActiveRounds >= lastActiveTotal) {
          // Last active group is done - find next incomplete (with wrap-around)
          let nextIncomplete = exerciseGroups.findIndex((group, idx) => {
            if (idx <= lastActiveGroupIndex) return false;
            return (rounds[group.id] || 0) < group.totalRounds;
          });
          if (nextIncomplete < 0) {
            nextIncomplete = exerciseGroups.findIndex((group, idx) => {
              if (idx >= lastActiveGroupIndex) return false;
              return (rounds[group.id] || 0) < group.totalRounds;
            });
          }
          setExpandedGroupIndex(nextIncomplete >= 0 ? nextIncomplete : lastActiveGroupIndex);
        } else {
          // Last active group still has sets to do - resume there
          setExpandedGroupIndex(lastActiveGroupIndex);
        }
      } else {
        setExpandedGroupIndex(0);
      }
      
    } else {
      setExpandedGroupIndex(0); // Expand first group by default
    }

    // Restore localValues from the best available data source
    const restoredValues: Record<string, { weight: number; reps: number }> = {};
    
    // 1. First, try to restore from detailedWorkoutProgress (most reliable for actual logged values)
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
      
      if (Object.keys(restoredValues).length > 0) {
        console.log('📂 Restored localValues for', Object.keys(restoredValues).length, 'sets from detailedWorkoutProgress');
      }
    }
    
    // 2. Then fill in from session data for any sets not covered by progress
    const allSessions = useStore.getState().sessions;
    const existingSession = allSessions.find(s => 
      (s as any).workoutKey === workoutKey
    ) || allSessions.find(s => {
      const dateMatch = workoutKey?.match(/(\d{4}-\d{2}-\d{2})/);
      const sessionDate = dateMatch ? dateMatch[1] : null;
      return s.workoutTemplateId === workoutTemplateId && sessionDate && s.date === sessionDate;
    });
    
    if (existingSession) {
      console.log('📂 Found existing session:', existingSession.id);
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
  }, [workoutKey, type, exerciseGroups, getWarmupCompletion, getAccessoryCompletion, getMainCompletion]);
  
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
    const currentExercise = currentGroup.exercises[activeExerciseIndex];
    
    console.log('🎯 handleComplete called:', {
      expandedGroupIndex,
      activeExerciseIndex,
      groupId: currentGroup.id,
      currentRound,
      exerciseName: currentExercise?.exerciseName,
      exerciseId: currentExercise?.id,
    });
    
    if (!currentExercise) {
      console.log('❌ No current exercise!');
      return;
    }
    
    // Mark that user has logged at least one set (locks the flow)
    if (!hasLoggedAnySet) {
      collapseAccessories();
    }
    setHasLoggedAnySet(true);
    
    // Mark set as complete
    const setId = `${currentExercise.id}-set-${currentRound}`;
    const newCompletedSets = new Set(completedSets);
    newCompletedSets.add(setId);
    console.log('✅ Marking set as complete:', setId);
    setCompletedSets(newCompletedSets);
    
    // Save to store (individual set completion)
    console.log('💾 Saving set completion:', { type, workoutKey, setId });
    if (type === 'warmup') {
      await updateWarmupCompletion(workoutKey, setId, true);
    } else if (type === 'core') {
      await updateAccessoryCompletion(workoutKey, setId, true);
    } else if (type === 'main') {
      await updateMainCompletion(workoutKey, setId, true);
    }
    console.log('✅ Set completion saved');
    
    // Check for new PR (only for main exercises with weight > 0)
    if (type === 'main' && !currentExercise.isTimeBased) {
      const exerciseIdForPR = currentExercise.exerciseId || currentExercise.id;
      const setValues = localValuesRef.current[setId];
      const liftedWeight = setValues?.weight ?? currentExercise.weight ?? 0;
      const liftedReps = setValues?.reps ?? Number(currentExercise.reps) ?? 0;
      if (liftedWeight > 0) {
        const dateMatch = workoutKey?.match(/(\d{4}-\d{2}-\d{2})/);
        const prDate = dateMatch ? dateMatch[1] : dayjs().format('YYYY-MM-DD');
        await updateExercisePR(exerciseIdForPR, currentExercise.exerciseName, liftedWeight, liftedReps, prDate);
      }
    }
    
    // Check if all exercises in this round are complete
    const allExercisesComplete = currentGroup.exercises.every(ex => {
      const exSetId = `${ex.id}-set-${currentRound}`;
      return newCompletedSets.has(exSetId);
    });
    
    // Check if this is the last set of the last group
    const isLastGroup = expandedGroupIndex === exerciseGroups.length - 1;
    const isLastRound = currentRound + 1 >= currentGroup.totalRounds;
    const isLastExercise = activeExerciseIndex === currentGroup.exercises.length - 1;
    const isVeryLastSet = isLastGroup && isLastRound && (allExercisesComplete || isLastExercise);
    
    // For strength (main) workouts, show rest timer after completing a set (except for the very last set)
    if (type === 'main' && !isVeryLastSet) {
      setIsExerciseTimerPhase(false);
      setShowTimer(true);
      return;
    }
    
    // Otherwise, advance immediately
    advanceToNext(allExercisesComplete, newCompletedSets);
  };
  
  const advanceToNext = async (allExercisesComplete: boolean, newCompletedSets: Set<string>) => {
    setShowTimer(false);
    
    const currentGroup = exerciseGroups[expandedGroupIndex];
    const currentRound = currentRounds[currentGroup.id] || 0;
    
    console.log('⏭️ advanceToNext called:', {
      allExercisesComplete,
      currentRound,
      totalRounds: currentGroup.totalRounds,
      activeExerciseIndex,
      exercisesInGroup: currentGroup.exercises.length,
    });
    
    if (allExercisesComplete) {
      // Move to next round
      const nextRound = currentRound + 1;
      
      if (nextRound >= currentGroup.totalRounds) {
        // This group is complete - update state with new round count
        const updatedRounds = { ...currentRounds, [currentGroup.id]: nextRound };
        setCurrentRounds(updatedRounds);
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
          console.log('➡️ Group complete, letting user pick next exercise');
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
          console.log('✅ All groups in this section complete! Saving session...');
          await saveSession(newCompletedSets);
          
          // Only mark workout as completed if ALL sections (warmup, main, accessories) are done
          if (workoutKey.startsWith('sw-') && isEntireWorkoutComplete()) {
            console.log('🎉 All sections done - marking workout as complete:', workoutKey);
            await completeWorkout(workoutKey);
            console.log('✅ Workout marked as complete');
          } else {
            console.log('📋 Section complete but other sections remain');
          }
          
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
          if (type === 'main') {
            // For main workouts, transition to the history/summary view
            setExpandedGroupIndex(-1);
            setActiveExerciseIndex(0);
          } else {
            // For warmup/core, show alert and navigate back
            Alert.alert(t('workoutComplete'), t('niceWork'), [
              { text: t('done'), onPress: () => navigation.goBack() },
            ]);
          }
        }
      } else {
        // Same group, next round
        console.log('➡️ Moving to next round:', nextRound);
        setCurrentRounds(prev => ({ ...prev, [currentGroup.id]: nextRound }));
        setActiveExerciseIndex(0);
        
        // Copy values from completed sets to next round sets
        setLocalValues(prev => {
          const updated = { ...prev };
          currentGroup.exercises.forEach(exercise => {
            const currentSetId = `${exercise.id}-set-${currentRound}`;
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
      // Move to next exercise in same round
      const nextExIndex = activeExerciseIndex + 1;
      console.log('➡️ Moving to next exercise in same round:', nextExIndex);
      if (nextExIndex < currentGroup.exercises.length) {
        setActiveExerciseIndex(nextExIndex);
      } else {
        console.log('⚠️ No more exercises in this round');
      }
    }
  };
  
  const handleStart = () => {
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
      setIsExerciseTimerPhase(true);
      setShowTimer(true);
    } else {
      // For reps-based exercises, mark as complete immediately
      handleComplete();
    }
  };
  
  const handleHistory = () => {
    setShowMenu(false);
    // TODO: Navigate to history screen for this exercise type
    Alert.alert('History', 'Exercise history coming soon!');
  };

  const handleRest = () => {
    setShowMenu(false);
    // Show rest timer
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
            
            const completedSetsSet = new Set(allSetIds);
            setCompletedSets(completedSetsSet);
            
            // Update completion state - call for each set individually
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
            
            // Pass the completed sets directly to avoid state timing issues
            await saveSession(completedSetsSet);
            
            // Only mark workout as completed if ALL sections are done
            if (workoutKey.startsWith('sw-') && isEntireWorkoutComplete()) {
              console.log('🎉 All sections done - marking workout as complete:', workoutKey);
              await completeWorkout(workoutKey);
              console.log('✅ Workout marked as complete');
            } else {
              console.log('📋 Section complete but other sections remain');
            }
            
            // Update currentRounds so allCurrentGroupsComplete triggers
            const updatedRounds: Record<string, number> = {};
            exerciseGroups.forEach(group => {
              updatedRounds[group.id] = group.totalRounds;
            });
            setCurrentRounds(prev => ({ ...prev, ...updatedRounds }));
            setHasLoggedAnySet(true);
            collapseAccessories();
            
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
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
          onPress: () => {
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
            // Delete the saved session for this workout (if any)
            if (currentSessionId) {
              console.log('🗑️ Deleting session on reset:', currentSessionId);
              await deleteSession(currentSessionId);
              setCurrentSessionId(null);
            }
            
            // Clear all completed sets in local state
            LayoutAnimation.configureNext(
              LayoutAnimation.create(250, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
            );
            setCompletedSets(new Set());
            setCurrentRounds({});
            setCompletionTimestamps({});
            setExpandedGroupIndex(0);
            setActiveExerciseIndex(0);
            setHasLoggedAnySet(false);
            setLocalValues({}); // Reset adjusted values back to template defaults
            
            // Clear completion state in store
            if (type === 'warmup') {
              await resetWarmupCompletion(workoutKey);
            } else if (type === 'core') {
              await resetAccessoryCompletion(workoutKey);
            } else if (type === 'main') {
              await resetMainCompletion(workoutKey);
            }
            
            // Revert workout status from completed back to planned
            if (workoutKey.startsWith('sw-')) {
              await uncompleteWorkout(workoutKey);
            }
            
            // Show feedback
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  };

  const cleanupAfterSwap = (oldExerciseId: string, newExerciseId: string) => {
    // Migrate completedSets, localValues, and currentRounds from old exercise ID to new
    setCompletedSets(prev => {
      const next = new Set(prev);
      prev.forEach(setId => {
        if (setId.startsWith(`${oldExerciseId}-set-`)) {
          const round = setId.replace(`${oldExerciseId}-set-`, '');
          next.delete(setId);
          next.add(`${newExerciseId}-set-${round}`);
        }
      });
      return next;
    });
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
              // Delete the saved session for this workout (if any)
              if (currentSessionId) {
                console.log('🗑️ Deleting session on swap-reset:', currentSessionId);
                await deleteSession(currentSessionId);
                setCurrentSessionId(null);
              }
              
              // Clear all completed sets
              LayoutAnimation.configureNext(
                LayoutAnimation.create(250, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
              );
              setCompletedSets(new Set());
              setCurrentRounds({});
              setCompletionTimestamps({});
              setExpandedGroupIndex(0);
              setActiveExerciseIndex(0);
              setHasLoggedAnySet(false);
              setLocalValues({});
              
              // Clear completion state in store
              if (type === 'warmup') {
                await resetWarmupCompletion(workoutKey);
              } else if (type === 'core') {
                await resetAccessoryCompletion(workoutKey);
              }
              
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
          <TouchableOpacity
            testID="menu-button"
            style={styles.menuButton}
            onPress={() => setShowMenu(true)}
            activeOpacity={1}
          >
            <IconMenu size={24} color="#FFFFFF" />
          </TouchableOpacity>
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
        {allCurrentGroupsComplete && type === 'main' ? (
          /* ===== COMPLETED WORKOUT - HISTORY VIEW ===== */
          <View style={styles.historyViewContainer}>
            <View style={styles.historyViewHeader}>
              <IconCheckmark size={16} color={COLORS.successBright} />
              <Text style={styles.historyViewTitle}>{t('workoutComplete')}</Text>
            </View>
            
            {exerciseGroups.map((group) => (
              group.exercises.map((exercise) => {
                const exerciseName = exercise.exerciseName;
                const totalRounds = group.totalRounds;
                
                return (
                  <TouchableOpacity
                    key={exercise.id}
                    style={styles.historyExerciseRow}
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
            ))}

            {/* Add Exercise button in history view */}
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
          </View>
        ) : (
          /* ===== IN-PROGRESS - NORMAL EXERCISE CARDS ===== */
          <>
        {/* Strength Workout Label - Only show when type is 'main' */}
        {type === 'main' && (
          <Text style={styles.sectionLabel}>Strength Workout</Text>
        )}
        
        <View style={styles.itemsAccordion}>
          {sortedExerciseGroups.map((group) => {
            const originalIndex = groupIdToOriginalIndex.get(group.id) ?? -1;
            const isExpanded = expandedGroupIndex === originalIndex;
            const currentRound = currentRounds[group.id] || 0;
            const isCompleted = currentRound >= group.totalRounds;
            
            // Whether the indicator column is active for this group
            const indicatorActive = isExpanded && !isCompleted;

            // Group-level card style
            const groupCardBg = isCompleted ? styles.itemCardDimmed : (isExpanded ? styles.itemCardBorder : styles.itemCardInactive);
            const groupCardFg = isCompleted ? styles.itemCardInnerDimmed : (isExpanded ? styles.itemCardFill : styles.itemCardInnerInactive);

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
                                console.log('👆 Card tapped:', {
                                  exerciseName: exercise.exerciseName,
                                  exIndex,
                                  originalIndex,
                                  isExpanded,
                                  isCurrentExercise,
                                  hasLoggedAnySet,
                                  isCompleted,
                                });
                                if (isCompleted || isExerciseCompleted) {
                                  console.log('📝 Opening adjustment drawer for completed exercise');
                                  setDrawerGroupIndex(originalIndex);
                                  setDrawerExerciseIndex(exIndex);
                                  const lastRound = Math.max(0, (currentRounds[group.id] || 0) - 1);
                                  setExpandedSetInDrawer(lastRound);
                                  setShowAdjustmentDrawer(true);
                                } else if (isCurrentExercise) {
                                  console.log('📝 Opening adjustment drawer');
                                  setDrawerGroupIndex(null);
                                  setDrawerExerciseIndex(null);
                                  const currentRound = currentRounds[group.id] || 0;
                                  setExpandedSetInDrawer(currentRound);
                                  setShowAdjustmentDrawer(true);
                                } else if (!hasLoggedAnySet && !isExpanded) {
                                  console.log('📂 Expanding group and selecting first exercise');
                                  // Animate card height/style changes; indicator is Animated.View so unaffected
                                  LayoutAnimation.configureNext(
                                    LayoutAnimation.create(
                                      250,
                                      LayoutAnimation.Types.easeInEaseOut,
                                      LayoutAnimation.Properties.opacity
                                    )
                                  );
                                  setExpandedGroupIndex(originalIndex);
                                  setActiveExerciseIndex(0);
                                } else {
                                  console.log('❌ Card tap did nothing (condition not met)');
                                }
                              }}
                            >
                              <View style={[
                                styles.itemCardExpanded,
                                isExerciseCompleted && styles.exerciseContentDimmed,
                              ]}>
                                {/* Superset active: two-column layout */}
                                {isCurrentExercise && isExpanded && group.exercises.length > 1 ? (
                                  <View style={styles.supersetActiveRow}>
                                    {/* Left column: name + values side by side */}
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
                                    {/* Right column: pencil + Next */}
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
                                      >
                                        <IconEdit size={18} color={COLORS.textMeta} />
                                      </TouchableOpacity>
                                      <NextLabel />
                                    </View>
                                  </View>
                                ) : (
                                  <>
                                    {/* Single exercise or non-active: original layout */}
                                    <View style={[
                                      styles.exerciseNameRowWithIcon,
                                      !isCurrentExercise && !isExerciseCompleted && !isCompleted && styles.exerciseNameInCardCentered
                                    ]}>
                                      <Text style={[
                                        styles.exerciseNameText,
                                        (isExpanded || group.exercises.length === 1) && styles.exerciseNameTextActive,
                                        { flex: 1 },
                                      ]} numberOfLines={1}>
                                        {exercise.exerciseName}
                                      </Text>
                                      {isCurrentExercise && isExpanded && group.exercises.length === 1 && (
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
                                        >
                                          <IconEdit size={18} color={COLORS.textMeta} />
                                        </TouchableOpacity>
                                      )}
                                    </View>

                                    {/* Values Row - Show for current exercise in expanded group */}
                                    {isCurrentExercise && (
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
                                    )}
                                  </>
                                )}
                              </View>
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

                      {/* Start button + Set indicator row inside the card */}
                      {indicatorActive && (
                        <View style={styles.cardActionRow}>
                          <TouchableOpacity
                            testID="start-button"
                            style={styles.cardStartButton}
                            onPress={handleStart}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.cardStartButtonText}>
                              {group.exercises[activeExerciseIndex]?.isTimeBased ? t('startTimer') : t('markAsCompleted')}
                            </Text>
                          </TouchableOpacity>
                          <View style={styles.setCountIndicator}>
                            <Text style={styles.setCountText} numberOfLines={1}>
                              {currentRound + 1}/{group.totalRounds}
                            </Text>
                          </View>
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
        {hasLoggedAnySet && type === 'main' && (
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
      
      {/* Accessories slide-up drawer */}
      {type === 'main' && template && (
        <View style={[styles.accessoriesBottomContainer, { paddingBottom: insets.bottom + 8 }]}>
          {/* Drag handle — tap and drag handled by PanResponder */}
          <View {...accessoriesPanResponder.panHandlers}>
            <View style={styles.accessoriesHandleArea}>
              <View style={styles.accessoriesHandle} />
            </View>
            <View style={styles.accessoriesLabelContainer}>
              <Text style={styles.accessoriesLabel}>Accessories</Text>
            </View>
          </View>

          {/* Animated content */}
          <Animated.View style={{
            height: accessoriesAnim.interpolate({ inputRange: [0, 1], outputRange: [ACCESSORIES_EXPANDED_HEIGHT, 0] }),
            opacity: accessoriesAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.3, 0] }),
            overflow: 'hidden',
          }}>
            <View style={styles.accessoriesCardsRow}>
              {/* Warm-up Card */}
              {template.warmupItems && template.warmupItems.length > 0 ? (
                <TouchableOpacity
                  style={styles.halfWidthCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    (navigation as any).push('ExerciseExecution', { 
                      workoutKey, 
                      workoutTemplateId,
                      type: 'warmup'
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <View>
                    <Text style={styles.halfWidthCardTitle}>{t('warmup')}</Text>
                    {(() => {
                      const completion = getWarmupCompletion(workoutKey);
                      if (completion.percentage === 100) {
                        return (
                          <View style={styles.halfWidthCardProgressRow}>
                            <IconCheckmark size={16} color={COLORS.successBright} />
                          </View>
                        );
                      } else if (completion.percentage > 0) {
                        return (
                          <View style={styles.halfWidthCardProgressRow}>
                            <Text style={styles.halfWidthProgressText}>{completion.percentage}%</Text>
                            <Svg height="16" width="16" viewBox="0 0 16 16" style={styles.progressCircle}>
                              <Circle cx="8" cy="8" r="8" fill={COLORS.backgroundCanvas} />
                              <Path
                                d={`M 8 8 L 8 0 A 8 8 0 ${completion.percentage / 100 > 0.5 ? 1 : 0} 1 ${
                                  8 + 8 * Math.sin(2 * Math.PI * (completion.percentage / 100))
                                } ${
                                  8 - 8 * Math.cos(2 * Math.PI * (completion.percentage / 100))
                                } Z`}
                                fill={COLORS.signalWarning}
                              />
                            </Svg>
                          </View>
                        );
                      } else {
                        return <Text style={styles.halfWidthCardAction}>{t('start')}</Text>;
                      }
                    })()}
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.halfWidthAddButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    (navigation as any).navigate('WarmupEditor', { templateId: workoutTemplateId, workoutKey });
                  }}
                  activeOpacity={0.7}
                >
                  <DiagonalLinePattern width="100%" height="100%" borderRadius={BORDER_RADIUS.lg} />
                  <IconAdd size={20} color={COLORS.text} />
                  <Text style={styles.halfWidthAddText}>Add {t('warmup')}</Text>
                </TouchableOpacity>
              )}
              
              {/* Core Card */}
              {template.accessoryItems && template.accessoryItems.length > 0 ? (
                <TouchableOpacity
                  style={styles.halfWidthCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    (navigation as any).push('ExerciseExecution', { 
                      workoutKey, 
                      workoutTemplateId,
                      type: 'core'
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <View>
                    <Text style={styles.halfWidthCardTitle}>{t('core')}</Text>
                    {(() => {
                      const completion = getAccessoryCompletion(workoutKey);
                      if (completion.percentage === 100) {
                        return (
                          <View style={styles.halfWidthCardProgressRow}>
                            <IconCheckmark size={16} color={COLORS.successBright} />
                          </View>
                        );
                      } else if (completion.percentage > 0) {
                        return (
                          <View style={styles.halfWidthCardProgressRow}>
                            <Text style={styles.halfWidthProgressText}>{completion.percentage}%</Text>
                            <Svg height="16" width="16" viewBox="0 0 16 16" style={styles.progressCircle}>
                              <Circle cx="8" cy="8" r="8" fill={COLORS.backgroundCanvas} />
                              <Path
                                d={`M 8 8 L 8 0 A 8 8 0 ${completion.percentage / 100 > 0.5 ? 1 : 0} 1 ${
                                  8 + 8 * Math.sin(2 * Math.PI * (completion.percentage / 100))
                                } ${
                                  8 - 8 * Math.cos(2 * Math.PI * (completion.percentage / 100))
                                } Z`}
                                fill={COLORS.signalWarning}
                              />
                            </Svg>
                          </View>
                        );
                      } else {
                        return <Text style={styles.halfWidthCardAction}>{t('start')}</Text>;
                      }
                    })()}
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.halfWidthAddButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    (navigation as any).navigate('AccessoriesEditor', { templateId: workoutTemplateId, workoutKey });
                  }}
                  activeOpacity={0.7}
                >
                  <DiagonalLinePattern width="100%" height="100%" borderRadius={BORDER_RADIUS.lg} />
                  <IconAdd size={20} color={COLORS.text} />
                  <Text style={styles.halfWidthAddText}>Add {t('core')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>
      )}
      
      {/* Timer Sheet */}
      {expandedGroupIndex >= 0 && exerciseGroups[expandedGroupIndex] && (
        <SetTimerSheet
          visible={showTimer}
          onComplete={() => {
            console.log('⏰ Timer completed, calling advanceToNext');
            const currentGroup = exerciseGroups[expandedGroupIndex];
            // Use refs to get CURRENT state, not stale closure state
            const currentRound = currentRoundsRef.current[currentGroup.id] || 0;
            const currentCompletedSets = completedSetsRef.current;
            
            console.log('⏰ Current state:', {
              currentRound,
              completedSetsSize: currentCompletedSets.size,
              activeExerciseIndex: activeExerciseIndexRef.current,
            });
            
            // Check if all exercises in this round are complete
            const allExercisesComplete = currentGroup.exercises.every(ex => {
              const exSetId = `${ex.id}-set-${currentRound}`;
              return currentCompletedSets.has(exSetId);
            });
            
            console.log('⏰ All exercises complete:', allExercisesComplete);
            advanceToNext(allExercisesComplete, currentCompletedSets);
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
                          <Text style={styles.historyLabel}>{t('latestExerciseLog')}</Text>
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
                              <IconArrowRight size={16} color={COLORS.accentPrimary} />
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

      {/* Swap Exercise Bottom Drawer */}
      <BottomDrawer
        visible={showSwapModal}
        onClose={() => { setShowSwapModal(false); setSwapSearchQuery(''); }}
        maxHeight="80%"
        scrollable={false}
      >
        <View style={styles.adjustmentDrawerContent}>
          <Text style={styles.adjustmentDrawerTitle}>{t('swapExercise')}</Text>
          
          <View style={styles.swapSearchContainer}>
            <TextInput
              style={styles.swapSearchInput}
              placeholder="Search exercises..."
              placeholderTextColor={COLORS.textSecondary}
              value={swapSearchQuery}
              onChangeText={setSwapSearchQuery}
              autoFocus={true}
              returnKeyType="done"
            />
          </View>
          
          {swapSearchQuery.trim().length > 0 && (() => {
            const query = swapSearchQuery.trim().toLowerCase();
            const currentExercise = expandedGroupIndex >= 0 
              ? exerciseGroups[expandedGroupIndex]?.exercises[activeExerciseIndex]
              : null;
            const filtered = exercisesLibrary.filter(ex =>
              ex.name.toLowerCase().includes(query) &&
              (currentExercise ? ex.id !== currentExercise.id : true)
            );
            const exactMatch = exercisesLibrary.some(ex => ex.name.toLowerCase() === query);
            
            return (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 300 }}
                ListEmptyComponent={
                  <Text style={styles.swapNoResults}>No exercises found</Text>
                }
                ListFooterComponent={
                  !exactMatch && query.length >= 2 ? (
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
                              item.id === currentExercise.id
                                ? { ...item, id: newId, exerciseName: newName }
                                : item
                            );
                            await updateWorkoutTemplate(workoutTemplateId, { warmupItems: updatedItems });
                          } else if (type === 'core' && template?.accessoryItems) {
                            const updatedItems = template.accessoryItems.map(item =>
                              item.id === currentExercise.id
                                ? { ...item, id: newId, exerciseName: newName }
                                : item
                            );
                            await updateWorkoutTemplate(workoutTemplateId, { accessoryItems: updatedItems });
                          } else if (type === 'main' && template?.items) {
                            const updatedItems = template.items.map(item =>
                              item.exerciseId === currentExercise.id
                                ? { ...item, exerciseId: newId }
                                : item
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
                      <Text style={styles.swapAddNewText}>Add "{swapSearchQuery.trim()}"</Text>
                    </TouchableOpacity>
                  ) : null
                }
                renderItem={({ item: exercise }) => (
                  <TouchableOpacity
                    style={styles.exerciseOption}
                    onPress={async () => {
                      if (!currentExercise) return;
                      
                      if (type === 'warmup' && template?.warmupItems) {
                        const updatedItems = template.warmupItems.map(item => 
                          item.id === currentExercise.id 
                            ? { ...item, id: exercise.id, exerciseName: exercise.name }
                            : item
                        );
                        await updateWorkoutTemplate(workoutTemplateId, { warmupItems: updatedItems });
                      } else if (type === 'core' && template?.accessoryItems) {
                        const updatedItems = template.accessoryItems.map(item =>
                          item.id === currentExercise.id
                            ? { ...item, id: exercise.id, exerciseName: exercise.name }
                            : item
                        );
                        await updateWorkoutTemplate(workoutTemplateId, { accessoryItems: updatedItems });
                      } else if (type === 'main' && template?.items) {
                        const updatedItems = template.items.map(item =>
                          item.exerciseId === currentExercise.id
                            ? { ...item, exerciseId: exercise.id }
                            : item
                        );
                        await updateWorkoutTemplate(workoutTemplateId, { items: updatedItems });
                      }
                      
                      cleanupAfterSwap(currentExercise.id, exercise.id);
                      setSwapSearchQuery('');
                      setShowSwapModal(false);
                      setRefreshKey(prev => prev + 1);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }}
                  >
                    <Text style={styles.exerciseOptionText}>{exercise.name}</Text>
                  </TouchableOpacity>
                )}
                initialNumToRender={20}
                maxToRenderPerBatch={20}
                windowSize={10}
              />
            );
          })()}
        </View>
      </BottomDrawer>

      {/* Action Sheet Menu */}
      <ActionSheet
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        items={
          type === 'main' ? [
            // Main workout: Reset and Complete side by side
            {
              icon: <IconRestart size={24} color={COLORS.signalNegative} />,
              label: t('reset'),
              onPress: handleReset,
              destructive: true,
            },
            {
              icon: <IconCheckmark size={24} color="#FFFFFF" />,
              label: t('complete'),
              onPress: handleCompleteAll,
            },
          ] : [
            // Warmup/Core: Swap, Reset, and Remove
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
          ]
        }
      />
      
      {/* Exercise Settings Menu (in Adjust Values Drawer) */}
      {expandedGroupIndex >= 0 && exerciseGroups[expandedGroupIndex] && exerciseGroups[expandedGroupIndex].exercises[activeExerciseIndex] && (() => {
        const activeExercise = exerciseGroups[expandedGroupIndex].exercises[activeExerciseIndex];
        const isBarbellMode = getBarbellMode(activeExercise.id);
        const displayWeight = localValues[`${activeExercise.id}-set-${currentRounds[exerciseGroups[expandedGroupIndex].id] || 0}`]?.weight ?? activeExercise.weight ?? 0;
        const showBarbellOption = displayWeight > (useKg ? 20 : 45);
        
        return (
          <ActionSheet
            visible={showExerciseSettingsMenu}
            onClose={() => setShowExerciseSettingsMenu(false)}
            items={[
              {
                icon: <IconSwap size={24} color="#FFFFFF" />,
                label: t('swapExercise'),
                onPress: () => {
                  setShowExerciseSettingsMenu(false);
                  setShowAdjustmentDrawer(false);
                  setTimeout(() => {
                    setShowSwapModal(true);
                  }, 400);
                },
              },
              ...(showBarbellOption ? [{
                icon: <IconCheck size={24} color={isBarbellMode ? COLORS.accentPrimary : "#FFFFFF"} />,
                label: t('barbellMode'),
                onPress: () => {
                  setBarbellMode(activeExercise.id, !isBarbellMode);
                  setShowExerciseSettingsMenu(false);
                },
              }] : []),
            ]}
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
    gap: 0,
  },
  setCountIndicator: {
    backgroundColor: COLORS.accentPrimaryDimmed,
    borderWidth: 1,
    borderColor: COLORS.accentPrimary,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 14,
    borderCurve: 'continuous' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  cardStartButton: {
    flex: 1,
    height: 44,
    backgroundColor: COLORS.accentPrimary,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 0,
    borderCurve: 'continuous' as const,
    alignItems: 'center',
    justifyContent: 'center',
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
    alignItems: 'flex-start',
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
    gap: 4,
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
  exerciseOptionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  swapSearchContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
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
  accessoriesBottomContainer: {
    paddingHorizontal: SPACING.xxl,
    backgroundColor: COLORS.backgroundContainer,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
  },
  accessoriesCardsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: 12,
  },
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
  accessoriesHandleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  accessoriesHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  accessoriesLabelContainer: {
    alignItems: 'center',
    marginTop: 24,
    paddingBottom: SPACING.sm,
  },
  accessoriesLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  historyViewTitle: {
    ...TYPOGRAPHY.h3,
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
    gap: 4,
  },
  historySetValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
});
