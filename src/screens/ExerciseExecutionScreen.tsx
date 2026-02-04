import React, { useState, useEffect, useMemo } from 'react';
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
    if (expandedGroupIndex >= 0 && exerciseGroups[expandedGroupIndex]) {
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
  }, [expandedGroupIndex, exerciseGroups, currentRounds, completedSets]);
  
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
          {exerciseGroups.map((group, index) => {
            const isExpanded = expandedGroupIndex === index;
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
                      const isActive = isExpanded && exIndex === activeExerciseIndex;
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
                              if (isActive && !isExerciseCompleted) {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                                    !isActive && !isExerciseCompleted && styles.exerciseNameInCardCentered
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
                                  
                                  {/* Values Row - Only show for active card */}
                                  {isActive && (
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
                                      
                                      <View style={styles.checkIconContainer}>
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
                  {Array.from({ length: group.totalRounds }).map((_, roundIndex) => (
                    <View
                      key={roundIndex}
                      style={[
                        styles.roundDot,
                        roundIndex < currentRound && styles.roundDotCompleted,
                        roundIndex === currentRound && !isCompleted && isExpanded && styles.roundDotActive,
                      ]}
                    />
                  ))}
                  
                  {isCompleted && (
                    <View style={styles.roundCheckContainer}>
                      <IconCheck size={24} color={COLORS.signalPositive} />
                    </View>
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
          onComplete={handleComplete}
          onClose={() => setShowTimer(false)}
          workoutName={template?.name}
          exerciseName={exerciseGroups[expandedGroupIndex].exercises[activeExerciseIndex]?.exerciseName}
          currentSet={currentRounds[exerciseGroups[expandedGroupIndex].id] + 1}
          totalSets={exerciseGroups[expandedGroupIndex].totalRounds}
          isExerciseTimerPhase={isExerciseTimerPhase}
          exerciseDuration={localValues[exerciseGroups[expandedGroupIndex].exercises[activeExerciseIndex]?.id]?.reps ?? exerciseGroups[expandedGroupIndex].exercises[activeExerciseIndex]?.reps ?? 30}
          onExerciseTimerComplete={handleComplete}
          skipRestPhase={true}
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
  itemRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
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
    backgroundColor: COLORS.activeCard,
  },
  itemCardInner: {
    ...CARDS.cardDeep.inner,
    backgroundColor: COLORS.activeCard,
  },
  itemCardInactive: {
    ...CARDS.cardDeep.outer,
    backgroundColor: COLORS.activeCard,
    opacity: 0.5,
  },
  itemCardInnerInactive: {
    ...CARDS.cardDeep.inner,
    backgroundColor: COLORS.activeCard,
  },
  itemCardDimmed: {
    ...CARDS.cardDeep.outer,
    backgroundColor: COLORS.activeCard,
    opacity: 0.4,
  },
  itemCardInnerDimmed: {
    ...CARDS.cardDeep.inner,
    backgroundColor: COLORS.activeCard,
  },
  itemCardExpanded: {
    gap: 12,
  },
  exerciseNameInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseNameInCardCentered: {
    justifyContent: 'center',
  },
  exerciseNameRowWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  exerciseNameText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    flex: 1,
  },
  exerciseNameTextActive: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  checkIconContainer: {
    flexShrink: 0,
  },
  valuesDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  valuesDisplayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  largeValue: {
    fontSize: 32,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 38,
  },
  unit: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMeta,
  },
  roundIndicatorContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    position: 'relative',
    minWidth: 32,
  },
  roundCheckContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.backgroundDisabled,
  },
  roundDotCompleted: {
    backgroundColor: COLORS.text,
  },
  roundDotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.text,
    backgroundColor: 'transparent',
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
    backgroundColor: COLORS.button,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  startButtonText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.buttonText,
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
