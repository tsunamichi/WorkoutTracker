import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconArrowLeft, IconCheck, IconCheckmark, IconTriangle, IconAddLine, IconMinusLine, IconTrash, IconEdit, IconMenu, IconHistory, IconRestart, IconSkip } from '../components/icons';
import { BottomDrawer } from '../components/common/BottomDrawer';
import { SetTimerSheet } from '../components/timer/SetTimerSheet';
import { ActionSheet } from '../components/common/ActionSheet';
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
  const [localValues, setLocalValues] = useState<Record<string, { weight: number; reps: number }>>({});
  const [showAdjustmentDrawer, setShowAdjustmentDrawer] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [isExerciseTimerPhase, setIsExerciseTimerPhase] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  // Sort groups to put active group first (only after logging first set)
  const sortedExerciseGroups = useMemo(() => {
    // Only reorder if user has logged at least one set
    if (!hasLoggedAnySet || expandedGroupIndex < 0 || expandedGroupIndex >= exerciseGroups.length) {
      return exerciseGroups;
    }
    
    const expandedGroup = exerciseGroups[expandedGroupIndex];
    const otherGroups = exerciseGroups.filter((_, idx) => idx !== expandedGroupIndex);
    
    return [expandedGroup, ...otherGroups];
  }, [exerciseGroups, expandedGroupIndex, hasLoggedAnySet]);
  
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
    
    const completion = type === 'warmup' 
      ? getWarmupCompletion(workoutKey)
      : type === 'core'
      ? getAccessoryCompletion(workoutKey)
      : null;
      
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
  }, [workoutKey, type, exerciseGroups, getWarmupCompletion, getAccessoryCompletion]);
  
  // Auto-set active exercise when expanding a group
  useEffect(() => {
    if (expandedGroupIndex >= 0 && exerciseGroups[expandedGroupIndex]) {
      const group = exerciseGroups[expandedGroupIndex];
      const currentRound = currentRounds[group.id] || 0;
      
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
        setActiveExerciseIndex(firstIncompleteExIdx);
      } else {
        // Before logging: activate first exercise in expanded group
        setActiveExerciseIndex(0);
      }
    }
  }, [hasLoggedAnySet, expandedGroupIndex, exerciseGroups, currentRounds, completedSets]);
  
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
    
    const currentGroup = exerciseGroups[expandedGroupIndex];
    const currentRound = currentRounds[currentGroup.id] || 0;
    const currentExercise = currentGroup.exercises[activeExerciseIndex];
    
    if (!currentExercise) return;
    
    // Mark that user has logged at least one set (locks the flow)
    setHasLoggedAnySet(true);
    
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
            
            setCompletedSets(new Set(allSetIds));
            
            // Update completion state
            if (type === 'warmup') {
              updateWarmupCompletion(workoutKey, allSetIds);
            } else if (type === 'core') {
              updateAccessoryCompletion(workoutKey, allSetIds);
            }
            
            await saveSession();
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
                      const displayWeight = localValues[exercise.id]?.weight ?? exercise.weight ?? 0;
                      const displayReps = localValues[exercise.id]?.reps ?? exercise.reps ?? 0;
                      const showWeight = displayWeight > 0;
                      const isCurrentExercise = isExpanded && exIndex === activeExerciseIndex;
                      const isActive = isCurrentExercise && hasLoggedAnySet; // Only active after logging first set
                      const setId = `${exercise.id}-set-${currentRound}`;
                      const isExerciseCompleted = completedSets.has(setId);
                      const repsUnit = exercise.isTimeBased ? 'secs' : 'reps';
                      
                      // Determine card style based on state
                      const cardStyle = isExerciseCompleted ? styles.itemCardDimmed : (isActive ? styles.itemCard : styles.itemCardInactive);
                      const cardInnerStyle = isExerciseCompleted ? styles.itemCardInnerDimmed : (isActive ? styles.itemCardInner : styles.itemCardInnerInactive);
                      
                      return (
                        <View key={exercise.id} style={styles.exerciseCardWrapper}>
                          <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              if (!hasLoggedAnySet && !isExpanded && !isCompleted) {
                                // Before logging first set: allow selecting any GROUP (not individual exercise)
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setExpandedGroupIndex(originalIndex);
                                setActiveExerciseIndex(0); // Start with first exercise in group
                              } else if (isCurrentExercise && !isExerciseCompleted) {
                                // Current exercise card opens adjustment drawer
                                setShowAdjustmentDrawer(true);
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
                                    
                                    {isExerciseCompleted && (
                                      <View style={styles.checkIconContainer}>
                                        <IconCheck size={24} color={COLORS.signalPositive} />
                                      </View>
                                    )}
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
                
                {/* Round Indicator - Dots on the right */}
                <View style={styles.roundIndicatorContainer}>
                  {isCompleted ? (
                    <View style={styles.completedCircle} />
                  ) : (
                    Array.from({ length: group.totalRounds }).map((_, roundIndex) => {
                      const isRoundCompleted = roundIndex < currentRound;
                      const isRoundActive = roundIndex === currentRound && isExpanded;
                      
                      if (isRoundCompleted) {
                        return (
                          <View key={roundIndex} style={styles.completedCircle} />
                        );
                      }
                      
                      if (isRoundActive) {
                        return (
                          <View key={roundIndex} style={styles.activeTriangleContainer}>
                            <IconTriangle size={16} color={COLORS.accentPrimary} />
                          </View>
                        );
                      }
                      
                      return (
                        <View
                          key={roundIndex}
                          style={styles.roundDot}
                        />
                      );
                    })
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
            const currentGroup = exerciseGroups[expandedGroupIndex];
            const currentRound = currentRounds[currentGroup.id] || 0;
            const newCompletedSets = new Set(completedSets);
            
            // Check if all exercises in this round are complete
            const allExercisesComplete = currentGroup.exercises.every(ex => {
              const exSetId = `${ex.id}-set-${currentRound}`;
              return newCompletedSets.has(exSetId);
            });
            
            advanceToNext(allExercisesComplete, newCompletedSets);
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
        maxHeight="50%"
      >
        <View style={styles.adjustmentDrawerContent}>
          <Text style={styles.adjustmentDrawerTitle}>{t('adjustValues')}</Text>
          
          {expandedGroupIndex >= 0 && exerciseGroups[expandedGroupIndex] && (
            <View style={styles.drawerValuesCard}>
              {(() => {
                const currentGroup = exerciseGroups[expandedGroupIndex];
                const activeExercise = currentGroup.exercises[activeExerciseIndex];
                if (!activeExercise) return null;
                
                const displayWeight = localValues[activeExercise.id]?.weight ?? activeExercise.weight ?? 0;
                const displayReps = localValues[activeExercise.id]?.reps ?? activeExercise.reps ?? 0;
                const repsUnit = activeExercise.isTimeBased ? 'secs' : 'reps';
                
                return (
                  <>
                    {/* Weight Row */}
                    <View style={styles.drawerAdjustRow}>
                      <View style={styles.drawerAdjustValue}>
                        <Text style={styles.drawerAdjustValueText}>
                          {formatWeightForLoad(displayWeight, useKg)}
                        </Text>
                        <Text style={styles.drawerAdjustUnit}>{weightUnit}</Text>
                      </View>
                      <View style={styles.drawerAdjustButtons}>
                        <TouchableOpacity 
                          onPress={() => {
                            setLocalValues(prev => {
                              const current = prev[activeExercise.id];
                              if (!current) return prev;
                              const currentDisplay = toDisplayWeight(current.weight, useKg);
                              const nextDisplay = Math.max(0, currentDisplay - weightStep);
                              return {
                                ...prev,
                                [activeExercise.id]: {
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
                              const current = prev[activeExercise.id];
                              if (!current) return prev;
                              const currentDisplay = toDisplayWeight(current.weight, useKg);
                              const nextDisplay = currentDisplay + weightStep;
                              return {
                                ...prev,
                                [activeExercise.id]: {
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
                    
                    <View style={styles.drawerAdjustDivider} />
                    
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
                              const current = prev[activeExercise.id];
                              if (!current) return prev;
                              return {
                                ...prev,
                                [activeExercise.id]: {
                                  ...current,
                                  reps: Math.max(1, current.reps - 1),
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
                              const current = prev[activeExercise.id];
                              if (!current) return prev;
                              return {
                                ...prev,
                                [activeExercise.id]: {
                                  ...current,
                                  reps: current.reps + 1,
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
                  </>
                );
              })()}
            </View>
          )}
        </View>
      </BottomDrawer>

      {/* Action Sheet Menu */}
      <ActionSheet
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        items={[
          {
            icon: <IconCheck size={24} color="#000000" />,
            label: t('complete'),
            onPress: handleCompleteAll,
            featured: true,
          },
          {
            icon: <IconHistory size={24} color="#000000" />,
            label: t('history'),
            onPress: handleHistory,
          },
          {
            icon: <IconRestart size={24} color="#000000" />,
            label: t('rest'),
            onPress: handleRest,
          },
          {
            icon: <IconSkip size={24} color={COLORS.signalNegative} />,
            label: t('skip'),
            onPress: handleSkip,
            destructive: true,
          },
        ]}
      />
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
  },
  itemCardInnerInactive: {
    ...CARDS.cardDeep.inner,
  },
  itemCardDimmed: {
    ...CARDS.cardDeepDimmed.outer,
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
    marginBottom: 0,
  },
  exerciseNameText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  exerciseNameTextActive: {
    color: COLORS.text,
  },
  checkIconContainer: {
    marginLeft: SPACING.md,
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
    gap: 6,
    paddingTop: 4,
    position: 'relative',
    width: 16,
  },
  roundDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.textMeta,
  },
  completedCircle: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTriangleContainer: {
    transform: [{ rotate: '180deg' }],
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
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  startButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: '#FFFFFF',
  },
  adjustmentDrawerContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  adjustmentDrawerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  drawerValuesCard: {
    ...CARDS.cardDeep.outer,
    backgroundColor: COLORS.activeCard,
  },
  drawerAdjustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  drawerAdjustValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  drawerAdjustValueText: {
    fontSize: 32,
    fontWeight: '600',
    color: COLORS.text,
  },
  drawerAdjustUnit: {
    ...TYPOGRAPHY.caption,
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
    backgroundColor: COLORS.backgroundAlt,
  },
  adjustButtonInner: {
    ...CARDS.cardDeep.inner,
    backgroundColor: COLORS.backgroundAlt,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerAdjustDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
});
