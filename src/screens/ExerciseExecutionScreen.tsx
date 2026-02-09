import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager, Alert, Animated, Modal, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconArrowLeft, IconCheck, IconCheckmark, IconAddLine, IconMinusLine, IconTrash, IconEdit, IconMenu, IconHistory, IconRestart, IconSkip, IconSwap, IconSettings, IconArrowRight } from '../components/icons';
import { BottomDrawer } from '../components/common/BottomDrawer';
import { SetTimerSheet } from '../components/timer/SetTimerSheet';
import { ActionSheet } from '../components/common/ActionSheet';
import { Toggle } from '../components/Toggle';
import { useTranslation } from '../i18n/useTranslation';
import { formatWeightForLoad, toDisplayWeight, fromDisplayWeight } from '../utils/weight';
import type { WarmupItem_DEPRECATED as WarmupItem, AccessoryItem_DEPRECATED as AccessoryItem, WorkoutTemplateExercise } from '../types/training';
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
    completeWorkout,
  } = useStore();
  
  // Get these once without subscribing to avoid re-renders
  // Using useStore.getState() to read current value without creating a subscription
  const getDetailedWorkoutProgress = () => useStore.getState().detailedWorkoutProgress;
  const sessions = useStore.getState().sessions;
  const workoutTemplates = useStore.getState().workoutTemplates;
  
  const template = getWorkoutTemplate(workoutTemplateId);
  const useKg = settings.useKg;
  const weightUnit = useKg ? 'kg' : 'lb';
  const weightStep = useKg ? 0.5 : 5;
  
  // Get the appropriate items based on type
  const items = useMemo(() => {
    if (type === 'warmup') return template?.warmupItems || [];
    if (type === 'core') return template?.accessoryItems || [];
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
          isTimeBased: false,
          isPerSide: false,
          cycleId: item.cycleId,
          cycleOrder: item.cycleOrder,
        } as WarmupItem;
      });
    }
    return [];
  }, [type, template, exercisesLibrary]);
  
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
  const [localValues, setLocalValues] = useState<Record<string, { weight: number; reps: number }>>({});
  const [showAdjustmentDrawer, setShowAdjustmentDrawer] = useState(false);
  const [expandedSetInDrawer, setExpandedSetInDrawer] = useState<number>(0); // Track which set is expanded in drawer
  const [showTimer, setShowTimer] = useState(false);
  const [isExerciseTimerPhase, setIsExerciseTimerPhase] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showExerciseHistory, setShowExerciseHistory] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showExerciseSettingsMenu, setShowExerciseSettingsMenu] = useState(false);
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
  
  // Initialize local values from items
  useEffect(() => {
    const initial: Record<string, { weight: number; reps: number }> = {};
    items.forEach(item => {
      initial[item.id] = {
        weight: item.weight || 0,
        reps: item.reps || 0,
      };
    });
    setLocalValues(initial);
  }, [items]);
  
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
      setCompletedSets(new Set(completion.completedItems));
      setHasLoggedAnySet(true); // User has already logged sets
      
      // Calculate current rounds for each group
      const rounds: Record<string, number> = {};
      exerciseGroups.forEach(group => {
        let completedRounds = 0;
        for (let round = 0; round < group.totalRounds; round++) {
          const allExercisesComplete = group.exercises.every(ex => {
            const setId = `${ex.id}-set-${round}`;
            return completion.completedItems.includes(setId);
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
      
      // Auto-expand first incomplete group
      const firstIncompleteIndex = exerciseGroups.findIndex(group => {
        const currentRound = rounds[group.id] || 0;
        return currentRound < group.totalRounds;
      });
      if (firstIncompleteIndex >= 0) {
        setExpandedGroupIndex(firstIncompleteIndex);
      }
    } else {
      setExpandedGroupIndex(0); // Expand first group by default
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
  
  const saveSession = async (completedSetIds?: Set<string>) => {
    console.log('💾 Saving workout session for', type, 'section');
    console.log('   workoutTemplateId:', workoutTemplateId);
    console.log('   workoutKey:', workoutKey);
    
    // Use provided completedSetIds or fall back to state
    const setsToSave = completedSetIds || completedSets;
    console.log('   Total sets to check:', setsToSave.size);
    
    // Collect all completed sets for the session
    const allSets: any[] = [];
    const sessionId = Date.now().toString();
    
    exerciseGroups.forEach(group => {
      group.exercises.forEach(exercise => {
        for (let round = 0; round < group.totalRounds; round++) {
          const setId = `${exercise.id}-set-${round}`;
          
          // Only include completed sets
          if (setsToSave.has(setId)) {
            // Get the actual values from localValues, or fall back to template values
            const setValues = localValues[setId];
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
    
    // Only create a session if there are completed sets
    if (allSets.length > 0) {
      const session = {
        id: sessionId,
        workoutTemplateId,
        date: dayjs().format('YYYY-MM-DD'),
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        sets: allSets,
      };
      
      console.log('💾 Creating session:', JSON.stringify(session, null, 2));
      await addSession(session);
      console.log('✅ Session saved successfully!');
      console.log('   Check Progress tab and History page to verify');
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
        
        // Find the next incomplete group in the original order
        // Use updatedRounds to check completion, not the old currentRounds state
        const nextIncompleteIndex = exerciseGroups.findIndex((group, idx) => {
          if (idx <= expandedGroupIndex) return false; // Must be after current
          const rounds = updatedRounds[group.id] || 0;
          return rounds < group.totalRounds;
        });
        
        console.log('🔍 Looking for next incomplete group:', { 
          currentGroupId: currentGroup.id, 
          expandedGroupIndex, 
          nextIncompleteIndex,
          totalGroups: exerciseGroups.length,
          updatedRounds 
        });
        
        if (nextIncompleteIndex >= 0) {
          console.log('➡️ Moving to next group:', nextIncompleteIndex);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setExpandedGroupIndex(nextIncompleteIndex);
          setActiveExerciseIndex(0);
          setHasLoggedAnySet(false); // Unlock flow for next exercise selection
        } else {
          // All done!
          console.log('✅ All groups complete! Saving session...');
          await saveSession();
          
          // Mark workout as completed if it's a scheduled workout
          if (workoutKey.startsWith('sw-')) {
            console.log('🎉 Marking workout as complete:', workoutKey);
            await completeWorkout(workoutKey);
            console.log('✅ Workout marked as complete');
          }
          
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(t('workoutComplete'), t('niceWork'), [
            { text: t('done'), onPress: () => navigation.goBack() },
          ]);
        }
      } else {
        // Same group, next round
        console.log('➡️ Moving to next round:', nextRound);
        setCurrentRounds(prev => ({ ...prev, [currentGroup.id]: nextRound }));
        setActiveExerciseIndex(0);
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
            
            // Mark workout as completed if it's a scheduled workout
            if (workoutKey.startsWith('sw-')) {
              console.log('🎉 Marking workout as complete:', workoutKey);
              await completeWorkout(workoutKey);
              console.log('✅ Workout marked as complete');
            }
            
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            navigation.goBack();
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
            // Clear all completed sets in local state
            setCompletedSets(new Set());
            setCurrentRounds({});
            setCompletionTimestamps({});
            setExpandedGroupIndex(0);
            setActiveExerciseIndex(0);
            setHasLoggedAnySet(false);
            
            // Clear completion state in store
            if (type === 'warmup') {
              await resetWarmupCompletion(workoutKey);
            } else if (type === 'core') {
              await resetAccessoryCompletion(workoutKey);
            } else if (type === 'main') {
              await resetMainCompletion(workoutKey);
            }
            
            // Show feedback
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
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
              // Clear all completed sets
              setCompletedSets(new Set());
              setCurrentRounds({});
              setCompletionTimestamps({});
              setExpandedGroupIndex(0);
              setActiveExerciseIndex(0);
              setHasLoggedAnySet(false);
              
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
                (navigation as any).navigate('WarmupEditor', { templateId: workoutTemplateId });
              } else if (type === 'core') {
                (navigation as any).navigate('AccessoriesEditor', { templateId: workoutTemplateId });
              }
            },
          },
        ]
      );
    } else {
      // No sets logged, allow swap directly
      if (type === 'warmup') {
        (navigation as any).navigate('WarmupEditor', { templateId: workoutTemplateId });
      } else if (type === 'core') {
        (navigation as any).navigate('AccessoriesEditor', { templateId: workoutTemplateId });
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
    
    // Create a map of workoutTemplateId -> workout template for quick lookup
    const workoutTemplateMap = new Map<string, any>();
    workoutTemplates.forEach(template => {
      workoutTemplateMap.set(template.id, template);
    });
    
    // 1. Get from detailed workout progress (includes in-progress workouts with completed sets)
    const detailedWorkoutProgress = getDetailedWorkoutProgress();
    Object.entries(detailedWorkoutProgress).forEach(([workoutKey, workoutProgress]) => {
      // Extract workoutTemplateId from workoutKey
      const workoutTemplateId = workoutKey.split('-').slice(0, -3).join('-');
      const workoutTemplate = workoutTemplateMap.get(workoutTemplateId);
      
      if (!workoutTemplate) return;
      
      // Check all exercises in this workout progress
      Object.entries(workoutProgress.exercises).forEach(([templateExerciseId, exerciseProgress]) => {
        const templateExercise = workoutTemplate.exercises?.find((ex: any) => ex.id === templateExerciseId);
        
        if (!templateExercise) return;
        
        // Match by exerciseId
        const exerciseDataById = exercisesLibrary.find(e => e.id === templateExercise.exerciseId);
        const exerciseDataForCurrent = exercisesLibrary.find(e => e.id === exerciseId);
        
        const matchesById = templateExercise.exerciseId === exerciseId;
        const matchesByName = exerciseDataById?.name.toLowerCase().trim() === exerciseDataForCurrent?.name.toLowerCase().trim();
        
        if (matchesById || matchesByName) {
          // Skip if this exercise was marked as skipped
          if (exerciseProgress.skipped) return;
          
          // Include completed sets
          const hasCompletedSets = exerciseProgress.sets.some(set => set.completed);
          
          if (hasCompletedSets) {
            // Extract date from workoutKey
            const dateMatch = workoutKey.match(/(\d{4}-\d{2}-\d{2})/);
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
    
    // 2. Get from completed sessions
    sessions.forEach(session => {
      session.sets.forEach(set => {
        if (set.exerciseId === exerciseId || set.exerciseName === items.find(i => i.id === exerciseId)?.exerciseName) {
          const date = session.date || new Date(session.startTime).toISOString().split('T')[0];
          
          if (!historyByDate.has(date)) {
            historyByDate.set(date, []);
          }
          
          historyByDate.get(date)!.push({
            setNumber: set.setNumber || 1,
            weight: set.weight || 0,
            reps: set.reps || 0,
          });
        }
      });
    });
    
    // Convert to array and sort by date (newest first)
    return Array.from(historyByDate.entries())
      .map(([date, sets]) => ({ date, sets }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };
  
  // Rest of the render logic from WarmupExecutionScreen...
  // (I'll keep this abbreviated for now, but it will include all the card rendering, drawer, timer, etc.)
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.goBack();
            }}
            activeOpacity={1}
          >
            <IconArrowLeft size={24} color="#000000" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setShowMenu(true)}
            activeOpacity={1}
          >
            <IconMenu size={24} color="#000000" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{getTitle()}</Text>
        </View>
      </View>
      
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        <View style={styles.itemsAccordion}>
          {sortedExerciseGroups.map((group) => {
            const originalIndex = groupIdToOriginalIndex.get(group.id) ?? -1;
            const isExpanded = expandedGroupIndex === originalIndex;
            const currentRound = currentRounds[group.id] || 0;
            const isCompleted = currentRound >= group.totalRounds;
            
            return (
              <View key={group.id} style={styles.itemRow}>
                {/* Exercise Cards Container */}
                <View style={styles.exerciseCardsColumn}>
                  <View style={styles.exerciseCardsContainer}>
                    {group.exercises.map((exercise, exIndex) => {
                      const setId = `${exercise.id}-set-${currentRound}`;
                      const displayWeight = localValues[setId]?.weight ?? exercise.weight ?? 0;
                      const displayReps = localValues[setId]?.reps ?? exercise.reps ?? 0;
                      const showWeight = displayWeight > 0;
                      const isCurrentExercise = isExpanded && exIndex === activeExerciseIndex;
                      const isExerciseCompleted = completedSets.has(setId);
                      const repsUnit = exercise.isTimeBased ? 'secs' : 'reps';
                      
                      // Card is active when it's the current exercise AND user has started working on it
                      // (either logged a set, timer is showing, or adjustment drawer is open)
                      const isActive = isCurrentExercise && (hasLoggedAnySet || showTimer || showAdjustmentDrawer);
                      
                      // Determine card style based on state
                      const cardStyle = isExerciseCompleted ? styles.itemCardDimmed : (isActive ? styles.itemCard : styles.itemCardInactive);
                      const cardInnerStyle = isExerciseCompleted ? styles.itemCardInnerDimmed : (isActive ? styles.itemCardInner : styles.itemCardInnerInactive);
                      
                      return (
                        <View key={exercise.id} style={styles.exerciseCardWrapper}>
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
                              if (!hasLoggedAnySet && !isExpanded && !isCompleted) {
                                // Before logging first set: allow selecting any GROUP (not individual exercise)
                                console.log('📂 Expanding group and selecting first exercise');
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setExpandedGroupIndex(originalIndex);
                                setActiveExerciseIndex(0); // Start with first exercise in group
                              } else if (isCurrentExercise && !isExerciseCompleted) {
                                // Current exercise card opens adjustment drawer
                                console.log('📝 Opening adjustment drawer');
                                const currentRound = currentRounds[group.id] || 0;
                                setExpandedSetInDrawer(currentRound);
                                setShowAdjustmentDrawer(true);
                              } else {
                                console.log('❌ Card tap did nothing (condition not met)');
                              }
                            }}
                          >
                            <View style={cardStyle}>
                              <View style={cardInnerStyle}>
                                <View style={styles.itemCardExpanded}>
                                  {/* Exercise Name Row */}
                                  <View style={[
                                    isExerciseCompleted ? styles.exerciseNameRowWithIcon : styles.exerciseNameInCard,
                                    !isCurrentExercise && !isExerciseCompleted && styles.exerciseNameInCardCentered
                                  ]}>
                                  <Text style={[
                                    styles.exerciseNameText,
                                    (isExpanded || group.exercises.length === 1) && styles.exerciseNameTextActive
                                  ]}>
                                    {exercise.exerciseName}
                                  </Text>
                                  </View>
                                  
                                  {/* Values Row - Show for current exercise in expanded group */}
                                  {isCurrentExercise && (
                                    <View style={styles.valuesDisplayRow}>
                                      <View style={styles.valuesDisplayLeft}>
                                        <View style={styles.valueRow}>
                                          <Text style={styles.largeValue}>{displayReps}</Text>
                                          <Text style={styles.unit}>{repsUnit}</Text>
                                        </View>
                                        
                                        {showWeight && (
                                          <View style={styles.valueRow}>
                                            <Text style={styles.largeValue}>
                                              {formatWeightForLoad(displayWeight, useKg)}
                                            </Text>
                                            <Text style={styles.unit}>{weightUnit}</Text>
                                          </View>
                                        )}
                                      </View>
                                      
                                      <View style={styles.editIconContainer}>
                                        <IconEdit size={20} color={COLORS.textMeta} />
                                      </View>
                                    </View>
                                  )}
                                </View>
                              </View>
                            </View>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                </View>
                
                {/* Round Indicator - Set count format (only for expanded group) */}
                <View style={styles.roundIndicatorContainer}>
                  {isCompleted ? (
                    <View style={styles.completedCheckContainer}>
                      <IconCheck size={20} color={COLORS.signalPositive} />
                    </View>
                  ) : isExpanded && (
                    <Text style={styles.setCountText} numberOfLines={1}>
                      {currentRound + 1}/{group.totalRounds}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
      
      {/* Start Button - Fixed at Bottom */}
      {expandedGroupIndex !== -1 && (
        <View style={[styles.startButtonContainer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStart}
            activeOpacity={1}
          >
            <View style={styles.startButtonInner}>
              <Text style={styles.startButtonText}>{t('start')}</Text>
            </View>
          </TouchableOpacity>
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
          currentSet={currentRounds[exerciseGroups[expandedGroupIndex].id] + 1}
          totalSets={exerciseGroups[expandedGroupIndex].totalRounds}
          isExerciseTimerPhase={isExerciseTimerPhase}
          exerciseDuration={localValues[exerciseGroups[expandedGroupIndex].exercises[activeExerciseIndex]?.id]?.reps ?? exerciseGroups[expandedGroupIndex].exercises[activeExerciseIndex]?.reps ?? 30}
          onExerciseTimerComplete={handleComplete}
          skipRestPhase={type !== 'main'}
          isPerSide={exerciseGroups[expandedGroupIndex].exercises[activeExerciseIndex]?.isPerSide}
        />
      )}
      
      {/* Adjustment Drawer */}
      <BottomDrawer
        visible={showAdjustmentDrawer}
        onClose={() => setShowAdjustmentDrawer(false)}
        maxHeight="90%"
        scrollable={true}
      >
        <View style={styles.adjustmentDrawerContent}>
          {/* Title Row with Action Buttons */}
          <View style={styles.drawerTitleRow}>
            <Text style={styles.adjustmentDrawerTitle}>{t('adjustValues')}</Text>
            {expandedGroupIndex >= 0 && exerciseGroups[expandedGroupIndex] && exerciseGroups[expandedGroupIndex].exercises[activeExerciseIndex] && (
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
          
          {expandedGroupIndex >= 0 && exerciseGroups[expandedGroupIndex] && exerciseGroups[expandedGroupIndex].exercises[activeExerciseIndex] ? (
            <View style={styles.allSetsContainer}>
              {Array.from({ length: exerciseGroups[expandedGroupIndex].totalRounds }, (_, setIndex) => {
                const currentGroup = exerciseGroups[expandedGroupIndex];
                const activeExercise = currentGroup.exercises[activeExerciseIndex];
                const isBarbellMode = getBarbellMode(activeExercise.id);
                const repsUnit = activeExercise.isTimeBased ? 'secs' : 'reps';
                const setId = `${activeExercise.id}-set-${setIndex}`;
                const isCompleted = completedSets.has(setId);
                const isExpanded = expandedSetInDrawer === setIndex;
                const currentRound = currentRounds[currentGroup.id] || 0;
                const isActive = setIndex === currentRound;
                
                // Get values for this specific set
                const displayWeight = localValues[setId]?.weight ?? activeExercise.weight ?? 0;
                const displayReps = localValues[setId]?.reps ?? Number(activeExercise.reps) ?? 0;
                const showBarbellToggle = displayWeight > (useKg ? 20 : 45);
                
                // Initialize localValues for this set if needed
                if (!localValues[setId]) {
                  setLocalValues(prev => ({
                    ...prev,
                    [setId]: {
                      weight: activeExercise.weight ?? 0,
                      reps: Number(activeExercise.reps) ?? 0,
                    },
                  }));
                }
                
                return (
                  <View key={setId} style={[styles.setCard, isActive && styles.setCardActive]}>
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
                                <Text style={styles.setPreviewValueText}>{displayReps}</Text>
                                <Text style={styles.setPreviewUnit}>{repsUnit}</Text>
                              </View>
                              <View style={styles.setPreviewValue}>
                                <Text style={styles.setPreviewValueText}>
                                  {formatWeightForLoad(displayWeight, useKg)}
                                </Text>
                                <Text style={styles.setPreviewUnit}>{weightUnit}</Text>
                              </View>
                            </View>
                          )}
                        </View>
                        {isCompleted && (
                          <View style={styles.completedBadge}>
                            <Text style={styles.completedText}>{t('completed')}</Text>
                            <IconCheck size={20} color={COLORS.signalPositive} />
                          </View>
                        )}
                      </TouchableOpacity>
                      
                      {/* Set Controls - Only visible when expanded */}
                      {isExpanded && (
                        <View style={styles.setControls}>
                          {/* Reps Row */}
                          <View style={styles.drawerAdjustRow}>
                            <View style={styles.drawerAdjustValue}>
                              <Text style={styles.drawerAdjustValueText}>
                                {displayReps}
                              </Text>
                              <Text style={styles.drawerAdjustUnit}>{repsUnit}</Text>
                            </View>
                            <View style={styles.drawerAdjustButtons}>
                              <TouchableOpacity 
                                onPress={() => {
                                  setLocalValues(prev => {
                                    const current = prev[setId];
                                    if (!current) return prev;
                                    return {
                                      ...prev,
                                      [setId]: {
                                        ...current,
                                        reps: Math.max(1, Number(current.reps) - 1),
                                      },
                                    };
                                  });
                                }}
                                activeOpacity={1}
                                style={styles.adjustButtonTapTarget}
                              >
                                <View style={styles.adjustButton}>
                                  <View style={styles.adjustButtonInner}>
                                    <IconMinusLine size={24} color={COLORS.accentPrimary} />
                                  </View>
                                </View>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                onPress={() => {
                                  setLocalValues(prev => {
                                    const current = prev[setId];
                                    if (!current) return prev;
                                    return {
                                      ...prev,
                                      [setId]: {
                                        ...current,
                                        reps: Number(current.reps) + 1,
                                      },
                                    };
                                  });
                                }}
                                activeOpacity={1}
                                style={styles.adjustButtonTapTarget}
                              >
                                <View style={styles.adjustButton}>
                                  <View style={styles.adjustButtonInner}>
                                    <IconAddLine size={24} color={COLORS.accentPrimary} />
                                  </View>
                                </View>
                              </TouchableOpacity>
                            </View>
                          </View>
                          
                          <View style={styles.drawerAdjustDivider} />
                          
                          {/* Weight Row */}
                          <View style={styles.drawerAdjustRow}>
                            <View style={styles.drawerAdjustValueColumn}>
                              <View style={styles.drawerAdjustValue}>
                                <Text style={styles.drawerAdjustValueText}>
                                  {formatWeightForLoad(displayWeight, useKg)}
                                </Text>
                                <Text style={styles.drawerAdjustUnit}>{weightUnit}</Text>
                              </View>
                              {isBarbellMode && (() => {
                                const barbellWeight = useKg ? 20 : 45;
                                const weightPerSide = (displayWeight - barbellWeight) / 2;
                                return weightPerSide > 0 ? (
                                  <Text style={styles.weightPerSideText}>
                                    {formatWeightForLoad(weightPerSide, useKg)} {weightUnit} per side
                                  </Text>
                                ) : null;
                              })()}
                            </View>
                            <View style={styles.drawerAdjustButtons}>
                              <TouchableOpacity 
                                onPress={() => {
                                  setLocalValues(prev => {
                                    const current = prev[setId];
                                    if (!current) return prev;
                                    const currentDisplay = toDisplayWeight(current.weight, useKg);
                                    const nextDisplay = Math.max(0, currentDisplay - weightStep);
                                    return {
                                      ...prev,
                                      [setId]: {
                                        ...current,
                                        weight: fromDisplayWeight(nextDisplay, useKg),
                                      },
                                    };
                                  });
                                }}
                                activeOpacity={1}
                                style={styles.adjustButtonTapTarget}
                              >
                                <View style={styles.adjustButton}>
                                  <View style={styles.adjustButtonInner}>
                                    <IconMinusLine size={24} color={COLORS.accentPrimary} />
                                  </View>
                                </View>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                onPress={() => {
                                  setLocalValues(prev => {
                                    const current = prev[setId];
                                    if (!current) return prev;
                                    const currentDisplay = toDisplayWeight(current.weight, useKg);
                                    const nextDisplay = currentDisplay + weightStep;
                                    return {
                                      ...prev,
                                      [setId]: {
                                        ...current,
                                        weight: fromDisplayWeight(nextDisplay, useKg),
                                      },
                                    };
                                  });
                                }}
                                activeOpacity={1}
                                style={styles.adjustButtonTapTarget}
                              >
                                <View style={styles.adjustButton}>
                                  <View style={styles.adjustButtonInner}>
                                    <IconAddLine size={24} color={COLORS.accentPrimary} />
                                  </View>
                                </View>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      )}
                    </View>
                  );
              })}
            </View>
          ) : null}
          
          {/* Exercise History */}
          {expandedGroupIndex >= 0 && exerciseGroups[expandedGroupIndex] && (() => {
            const activeExercise = exerciseGroups[expandedGroupIndex].exercises[activeExerciseIndex];
            if (!activeExercise) return null;
            
            // Get exercise history for this exercise
            const exerciseHistory = getExerciseHistoryForDrawer(activeExercise.id);
            
            // Only show if there's history
            if (exerciseHistory.length === 0) return null;
            
            // Show latest workout by default, or all if expanded
            const workoutsToShow = showExerciseHistory ? exerciseHistory.slice(0, 3) : exerciseHistory.slice(0, 1);
            
            return (
              <>
                <View style={styles.historyFullBleedDivider} />
                <View style={styles.historySection}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyLabel}>{t('latestExerciseLog')}</Text>
                    {exerciseHistory.length > 1 && (
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
                  {workoutsToShow.map((workout, workoutIndex) => (
                    <View key={workout.date}>
                      <View style={styles.historyWorkoutGroup}>
                        {/* Date column on the left */}
                        <View style={styles.historyDateColumn}>
                          <Text style={styles.historyDateText}>
                            {dayjs(workout.date).format('MMMM')}
                          </Text>
                          <Text style={styles.historyDateText}>
                            {dayjs(workout.date).date()}{getOrdinalSuffix(dayjs(workout.date).date())}
                          </Text>
                        </View>
                        
                        {/* Sets column on the right */}
                        <View style={styles.historySetsColumn}>
                          {workout.sets.slice().reverse().map((set, setIndex) => (
                            <View key={setIndex} style={styles.historySetRow}>
                              <View style={styles.historyValueColumn}>
                                <Text style={styles.historySetText}>
                                  {formatWeightForLoad(set.weight, useKg)}
                                </Text>
                                <Text style={styles.historySetUnit}>{weightUnit}</Text>
                              </View>
                              <View style={styles.historyValueColumn}>
                                <Text style={styles.historySetText}>{set.reps}</Text>
                                <Text style={styles.historySetUnit}>reps</Text>
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
        </View>
      </BottomDrawer>

      {/* Swap Exercise Modal */}
      <Modal
        visible={showSwapModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSwapModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSwapModal(false)}>
              <IconArrowLeft size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('swapExercise')}</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <FlatList
            style={styles.modalContent}
            data={exercisesLibrary.filter(ex => {
              // Filter out the current exercise
              const currentExercise = expandedGroupIndex >= 0 
                ? exerciseGroups[expandedGroupIndex]?.exercises[activeExerciseIndex]
                : null;
              return currentExercise ? ex.id !== currentExercise.id : true;
            })}
            keyExtractor={(item) => item.id}
            renderItem={({ item: exercise }) => (
              <TouchableOpacity
                style={styles.exerciseOption}
                onPress={async () => {
                  const currentExercise = exerciseGroups[expandedGroupIndex]?.exercises[activeExerciseIndex];
                  if (!currentExercise) return;
                  
                  // Update the template with the new exercise
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
                  
                  setShowSwapModal(false);
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
        </View>
      </Modal>

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
              icon: <IconCheck size={24} color="#000000" />,
              label: t('complete'),
              onPress: handleCompleteAll,
            },
          ] : [
            // Warmup/Core: Swap and Reset side by side
            {
              icon: <IconSwap size={24} color="#000000" />,
              label: t('swap'),
              onPress: handleSwap,
            },
            {
              icon: <IconRestart size={24} color={COLORS.signalNegative} />,
              label: t('reset'),
              onPress: handleReset,
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
                icon: <IconSwap size={24} color="#000000" />,
                label: t('swapExercise'),
                onPress: () => {
                  setShowExerciseSettingsMenu(false);
                  setTimeout(() => {
                    setShowSwapModal(true);
                  }, 300);
                },
              },
              ...(showBarbellOption ? [{
                icon: <IconCheck size={24} color={isBarbellMode ? COLORS.accentPrimary : "#000000"} />,
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
    </View>
  );
}

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
    marginBottom: SPACING.xxxl,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: '#000000',
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
    gap: 24,
  },
  itemRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  exerciseCardsColumn: {
    flex: 1,
  },
  exerciseCardsContainer: {
    gap: 8,
  },
  exerciseCardWrapper: {
    width: '100%',
  },
  itemCard: {
    ...CARDS.cardDeep.outer,
    borderWidth: 1,
    borderColor: COLORS.accentPrimary,
  },
  itemCardInner: {
    ...CARDS.cardDeep.inner,
  },
  itemCardInactive: {
    ...CARDS.cardDeep.outer,
    borderWidth: 1,
    borderColor: COLORS.activeCard, // Same as card background, invisible but prevents layout jump
  },
  itemCardInnerInactive: {
    ...CARDS.cardDeep.inner,
  },
  itemCardDimmed: {
    ...CARDS.cardDeepDimmed.outer,
    borderWidth: 1,
    borderColor: COLORS.activeCard, // Same as card background, invisible but prevents layout jump
  },
  itemCardInnerDimmed: {
    ...CARDS.cardDeepDimmed.inner,
  },
  itemCardExpanded: {
    padding: 16,
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
  largeValue: {
    ...TYPOGRAPHY.h1,
    color: '#000000',
  },
  unit: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  roundIndicatorContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
    position: 'relative',
    width: 48,
  },
  setCountText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.accentPrimary,
    width: 48,
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
    color: '#FFFFFF',
  },
  adjustmentDrawerContent: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xl,
  },
  adjustmentDrawerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
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
  setCardActive: {
    borderWidth: 1,
    borderColor: COLORS.accentPrimary,
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.signalPositive,
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
    paddingHorizontal: 24,
    paddingBottom: 24,
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
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
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
  historyWorkoutGroup: {
    flexDirection: 'row',
    paddingVertical: SPACING.md,
  },
  historyDateColumn: {
    width: 80,
    paddingRight: SPACING.md,
  },
  historyDateText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    textAlign: 'left',
  },
  historySetsColumn: {
    flex: 1,
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
});
