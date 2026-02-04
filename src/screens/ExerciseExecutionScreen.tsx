import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconArrowLeft, IconCheck, IconAddLine, IconMinusLine, IconTrash, IconEdit } from '../components/icons';
import { BottomDrawer } from '../components/common/BottomDrawer';
import { SetTimerSheet } from '../components/timer/SetTimerSheet';
import { useTranslation } from '../i18n/useTranslation';
import { formatWeightForLoad, toDisplayWeight, fromDisplayWeight } from '../utils/weight';
import type { WarmupItem_DEPRECATED as WarmupItem, AccessoryItem_DEPRECATED as AccessoryItem, WorkoutTemplateExercise } from '../types/training';

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
  const { 
    getWorkoutTemplate, 
    updateWarmupCompletion, 
    getWarmupCompletion, 
    updateAccessoryCompletion, 
    getAccessoryCompletion,
    updateWorkoutTemplate, 
    settings,
    addWarmupToSession,
    addAccessoryToSession,
    exercises: exercisesLibrary,
  } = useStore();
  
  const template = getWorkoutTemplate(workoutTemplateId);
  const useKg = settings.useKg;
  const weightUnit = useKg ? 'kg' : 'lb';
  const weightStep = useKg ? 0.5 : 5;
  
  // Get the appropriate items based on type
  const items = (() => {
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
  })();
  
  // Group items into groups (supersets or single exercises)
  const exerciseGroups = (() => {
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
  })();
  
  // State
  const [expandedGroupIndex, setExpandedGroupIndex] = useState(-1);
  const [currentRounds, setCurrentRounds] = useState<Record<string, number>>({});
  const [completedSets, setCompletedSets] = useState<Set<string>>(new Set());
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [localValues, setLocalValues] = useState<Record<string, { weight: number; reps: number }>>({});
  const [showAdjustmentDrawer, setShowAdjustmentDrawer] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [isExerciseTimerPhase, setIsExerciseTimerPhase] = useState(false);
  
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
    const completion = type === 'warmup' 
      ? getWarmupCompletion(workoutKey)
      : type === 'core'
      ? getAccessoryCompletion(workoutKey)
      : null;
      
    if (completion) {
      setCompletedSets(new Set(completion.completedItems));
      
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
      setExpandedGroupIndex(0);
    }
  }, [workoutKey, type]);
  
  // Auto-set active exercise when expanding a group
  useEffect(() => {
    if (expandedGroupIndex >= 0) {
      const group = exerciseGroups[expandedGroupIndex];
      const currentRound = currentRounds[group.id] || 0;
      
      // Find first incomplete exercise in current round
      let firstIncompleteExIdx = 0;
      for (let exIdx = 0; exIdx < group.exercises.length; exIdx++) {
        const exercise = group.exercises[exIdx];
        const setId = `${exercise.id}-set-${currentRound}`;
        if (!completedSets.has(setId)) {
          firstIncompleteExIdx = exIdx;
          break;
        }
      }
      setActiveExerciseIndex(firstIncompleteExIdx);
    }
  }, [expandedGroupIndex]);
  
  const saveSession = async () => {
    if (type === 'warmup') {
      const warmupSets: any[] = [];
      exerciseGroups.forEach(group => {
        const rounds = currentRounds[group.id] || 0;
        group.exercises.forEach((exercise) => {
          for (let round = 0; round < rounds; round++) {
            const setId = `${exercise.id}-set-${round}`;
            if (completedSets.has(setId)) {
              const values = localValues[exercise.id] || {};
              warmupSets.push({
                id: setId,
                exerciseName: exercise.exerciseName,
                setIndex: round,
                weight: values.weight ?? exercise.weight ?? 0,
                reps: values.reps ?? exercise.reps ?? 0,
                isTimeBased: exercise.isTimeBased || false,
                isPerSide: exercise.isPerSide,
                completedAt: new Date().toISOString(),
              });
            }
          }
        });
      });
      if (warmupSets.length > 0) {
        await addWarmupToSession(workoutKey, warmupSets);
      }
    } else if (type === 'core') {
      const accessorySets: any[] = [];
      exerciseGroups.forEach(group => {
        const rounds = currentRounds[group.id] || 0;
        group.exercises.forEach((exercise) => {
          for (let round = 0; round < rounds; round++) {
            const setId = `${exercise.id}-set-${round}`;
            if (completedSets.has(setId)) {
              const values = localValues[exercise.id] || {};
              accessorySets.push({
                id: setId,
                exerciseName: exercise.exerciseName,
                setIndex: round,
                weight: values.weight ?? exercise.weight ?? 0,
                reps: values.reps ?? exercise.reps ?? 0,
                isTimeBased: exercise.isTimeBased || false,
                isPerSide: exercise.isPerSide,
                completedAt: new Date().toISOString(),
              });
            }
          }
        });
      });
      if (accessorySets.length > 0) {
        await addAccessoryToSession(workoutKey, accessorySets);
      }
    }
  };
  
  const handleComplete = async () => {
    if (expandedGroupIndex < 0) return;
    
    setShowTimer(false);
    
    const currentGroup = exerciseGroups[expandedGroupIndex];
    const currentRound = currentRounds[currentGroup.id] || 0;
    const currentExercise = currentGroup.exercises[activeExerciseIndex];
    
    if (!currentExercise) return;
    
    // Mark set as complete
    const setId = `${currentExercise.id}-set-${currentRound}`;
    const newCompletedSets = new Set(completedSets);
    newCompletedSets.add(setId);
    setCompletedSets(newCompletedSets);
    
    // Save to store
    const completedArray = Array.from(newCompletedSets);
    if (type === 'warmup') {
      updateWarmupCompletion(workoutKey, completedArray);
    } else if (type === 'core') {
      updateAccessoryCompletion(workoutKey, completedArray);
    }
    
    // Check if all exercises in this round are complete
    const allExercisesComplete = currentGroup.exercises.every(ex => {
      const exSetId = `${ex.id}-set-${currentRound}`;
      return newCompletedSets.has(exSetId);
    });
    
    if (allExercisesComplete) {
      // Move to next round
      const nextRound = currentRound + 1;
      setCurrentRounds(prev => ({ ...prev, [currentGroup.id]: nextRound }));
      
      if (nextRound >= currentGroup.totalRounds) {
        // This group is complete
        const nextGroupIndex = expandedGroupIndex + 1;
        if (nextGroupIndex < exerciseGroups.length) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setExpandedGroupIndex(nextGroupIndex);
          setActiveExerciseIndex(0);
        } else {
          // All done!
          await saveSession();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(t('workoutComplete'), t('niceWork'), [
            { text: t('done'), onPress: () => navigation.goBack() },
          ]);
        }
      } else {
        // Same group, next round
        setActiveExerciseIndex(0);
      }
    } else {
      // Move to next exercise in same round
      const nextExIndex = activeExerciseIndex + 1;
      if (nextExIndex < currentGroup.exercises.length) {
        setActiveExerciseIndex(nextExIndex);
      }
    }
  };
  
  const handleStart = () => {
    if (expandedGroupIndex < 0) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const currentGroup = exerciseGroups[expandedGroupIndex];
    const currentExercise = currentGroup.exercises[activeExerciseIndex];
    
    if (!currentExercise) return;
    
    setShowAdjustmentDrawer(false);
    
    if (currentExercise.isTimeBased) {
      setIsExerciseTimerPhase(true);
      setShowTimer(true);
    } else {
      handleComplete();
    }
  };
  
  const handleRemove = () => {
    const title = type === 'warmup' ? 'Remove Warm-up' : type === 'core' ? 'Remove Core' : 'Remove Workout';
    const message = `Are you sure you want to remove this ${type === 'warmup' ? 'warm-up' : type === 'core' ? 'core workout' : 'workout'}?`;
    
    Alert.alert(title, message, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          // Clear the appropriate items from template
          if (!template) return;
          
          const updatedTemplate = { ...template };
          if (type === 'warmup') {
            updatedTemplate.warmupItems = [];
          } else if (type === 'core') {
            updatedTemplate.accessoryItems = [];
          } else if (type === 'main') {
            updatedTemplate.items = [];
          }
          
          await updateWorkoutTemplate(updatedTemplate);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          navigation.goBack();
        },
      },
    ]);
  };
  
  const getTitle = () => {
    if (type === 'warmup') return t('warmup');
    if (type === 'core') return t('core');
    return template?.name || 'Workout';
  };
  
  // Rest of the render logic from WarmupExecutionScreen...
  // (I'll keep this abbreviated for now, but it will include all the card rendering, drawer, timer, etc.)
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={1}
          >
            <IconArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={handleRemove}
            activeOpacity={1}
          >
            <Text style={styles.removeButtonText}>{t('remove')}</Text>
            <IconTrash size={16} color={COLORS.signalNegative} />
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
          <Text style={styles.placeholderText}>Exercise execution cards will go here...</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  backButton: {
    padding: 4,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  removeButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.signalNegative,
  },
  headerContent: {
    paddingBottom: SPACING.sm,
  },
  headerTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 120,
  },
  itemsAccordion: {
    gap: 24,
  },
  placeholderText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    textAlign: 'center',
    paddingVertical: SPACING.xl,
  },
});
