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
import type { WarmupItem_DEPRECATED as WarmupItem } from '../types/training';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type RouteParams = {
  WarmupExecution: {
    workoutKey: string;
    workoutTemplateId: string;
  };
};

export function WarmupExecutionScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'WarmupExecution'>>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  
  const { workoutKey, workoutTemplateId } = route.params;
  const { getWorkoutTemplate, updateWarmupCompletion, getWarmupCompletion, updateWorkoutTemplate, settings } = useStore();
  const template = getWorkoutTemplate(workoutTemplateId);
  const warmupItems = template?.warmupItems || [];
  const useKg = settings.useKg;
  const weightUnit = useKg ? 'kg' : 'lb';
  const weightStep = useKg ? 0.5 : 5;
  
  // Group warmup items into groups (supersets or single exercises)
  const warmupGroups = (() => {
    const result: Array<{
      id: string;
      isCycle: boolean;
      cycleId?: string;
      totalRounds: number;
      exercises: Array<typeof warmupItems[0]>;
    }> = [];
    
    const cycleGroups: Record<string, typeof warmupItems> = {};
    const processedItems = new Set<string>();
    
    // Group items by cycle
    warmupItems.forEach(item => {
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
    warmupItems.forEach(item => {
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
  
  const [expandedGroupIndex, setExpandedGroupIndex] = useState<number>(-1);
  const [completedSets, setCompletedSets] = useState<Set<string>>(new Set());
  
  // Track current round for each group
  const [currentRounds, setCurrentRounds] = useState<Record<string, number>>({});
  
  // Local state for the currently expanded group's exercise values
  const [localValues, setLocalValues] = useState<Record<string, { weight: number; reps: number }>>({});
  
  // Track current active exercise index within the expanded group
  const [activeExerciseIndex, setActiveExerciseIndex] = useState<number>(0);
  
  // Track drawer visibility
  const [showAdjustmentDrawer, setShowAdjustmentDrawer] = useState<boolean>(false);
  
  // Track timer visibility
  const [showTimer, setShowTimer] = useState<boolean>(false);
  const [isExerciseTimerPhase, setIsExerciseTimerPhase] = useState<boolean>(true);
  
  // Load completion status on mount and auto-expand first incomplete group
  useEffect(() => {
    const completion = getWarmupCompletion(workoutKey);
    const completed = new Set(completion.completedItems);
    setCompletedSets(completed);
    
    // Calculate current round for each group based on completed sets
    const rounds: Record<string, number> = {};
    warmupGroups.forEach(group => {
      let currentRound = 0;
      for (let roundIndex = 0; roundIndex < group.totalRounds; roundIndex++) {
        const allCompleted = group.exercises.every(ex => {
          const setId = `${ex.id}-set-${roundIndex}`;
          return completed.has(setId);
        });
        if (allCompleted) {
          currentRound = roundIndex + 1;
        } else {
          break;
        }
      }
      rounds[group.id] = currentRound;
    });
    setCurrentRounds(rounds);
    
    // Auto-expand first incomplete group
    const firstIncompleteIndex = warmupGroups.findIndex(group => {
      const round = rounds[group.id] || 0;
      return round < group.totalRounds;
    });
    if (firstIncompleteIndex !== -1) {
      setExpandedGroupIndex(firstIncompleteIndex);
      const group = warmupGroups[firstIncompleteIndex];
      const roundIndex = rounds[group.id] || 0;
      const values: Record<string, { weight: number; reps: number }> = {};
      group.exercises.forEach(ex => {
        values[ex.id] = {
          weight: ex.weight || 0,
          reps: ex.reps || 0,
        };
      });
      setLocalValues(values);
      
      // Find first incomplete exercise in this group
      let firstIncompleteExIdx = 0;
      for (let exIdx = 0; exIdx < group.exercises.length; exIdx++) {
        const setId = `${group.exercises[exIdx].id}-set-${roundIndex}`;
        if (!completed.has(setId)) {
          firstIncompleteExIdx = exIdx;
          break;
        }
      }
      setActiveExerciseIndex(firstIncompleteExIdx);
    }
  }, [workoutKey]);
  
  // Update local state when expanded group changes
  useEffect(() => {
    if (expandedGroupIndex >= 0 && warmupGroups[expandedGroupIndex]) {
      const group = warmupGroups[expandedGroupIndex];
      const roundIndex = currentRounds[group.id] || 0;
      const values: Record<string, { weight: number; reps: number }> = {};
      group.exercises.forEach(ex => {
        values[ex.id] = {
          weight: ex.weight || 0,
          reps: ex.reps || 0,
        };
      });
      setLocalValues(values);
      
      // Find first incomplete exercise in this group for this round
      let firstIncompleteExIdx = 0;
      for (let exIdx = 0; exIdx < group.exercises.length; exIdx++) {
        const setId = `${group.exercises[exIdx].id}-set-${roundIndex}`;
        if (!completedSets.has(setId)) {
          firstIncompleteExIdx = exIdx;
          break;
        }
      }
      setActiveExerciseIndex(firstIncompleteExIdx);
    }
  }, [expandedGroupIndex]);
  
  const handleWeightChange = (exerciseId: string, delta: number) => {
    setLocalValues(prev => {
      const current = prev[exerciseId];
      if (!current) return prev;
      const currentDisplay = toDisplayWeight(current.weight, useKg);
      const nextDisplay = Math.max(0, currentDisplay + delta);
      return {
        ...prev,
        [exerciseId]: {
          ...current,
          weight: fromDisplayWeight(nextDisplay, useKg),
        },
      };
    });
  };
  
  const handleRepsChange = (exerciseId: string, delta: number) => {
    setLocalValues(prev => {
      const current = prev[exerciseId];
      if (!current) return prev;
      return {
        ...prev,
        [exerciseId]: {
          ...current,
          reps: Math.max(1, current.reps + delta),
        },
      };
    });
  };
  
  const handleStart = () => {
    if (expandedGroupIndex < 0) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const currentGroup = warmupGroups[expandedGroupIndex];
    const currentExercise = currentGroup.exercises[activeExerciseIndex];
    
    if (!currentExercise) return;
    
    // Close drawer if open
    setShowAdjustmentDrawer(false);
    
    // If time-based, show timer
    if (currentExercise.isTimeBased) {
      const duration = localValues[currentExercise.id]?.reps ?? currentExercise.reps ?? 30;
      setIsExerciseTimerPhase(true);
      setShowTimer(true);
    } else {
      // For reps-based, mark as done immediately
      handleComplete();
    }
  };
  
  const handleComplete = async () => {
    if (expandedGroupIndex < 0) return;
    
    // Close timer if it's open
    setShowTimer(false);
    
    const currentGroup = warmupGroups[expandedGroupIndex];
    const currentRound = currentRounds[currentGroup.id] || 0;
    const currentExercise = currentGroup.exercises[activeExerciseIndex];
    
    if (!currentExercise) return;
    
    // Mark only the current exercise's set as complete
    const setId = `${currentExercise.id}-set-${currentRound}`;
    const newCompleted = new Set(completedSets);
    newCompleted.add(setId);
    await updateWarmupCompletion(workoutKey, setId, true);
    setCompletedSets(newCompleted);
    
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        250,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity
      )
    );
    
    // Move to next exercise in the current round
    if (activeExerciseIndex + 1 < currentGroup.exercises.length) {
      setActiveExerciseIndex(activeExerciseIndex + 1);
    } else {
      // All exercises in current round are done, check if all are completed
      const allExercisesCompleted = currentGroup.exercises.every(ex => {
        const id = `${ex.id}-set-${currentRound}`;
        return newCompleted.has(id);
      });
      
      if (allExercisesCompleted) {
        // Update current round for this group
        const newRounds = { ...currentRounds, [currentGroup.id]: currentRound + 1 };
        setCurrentRounds(newRounds);
        
        // Check if current group is done
        if (currentRound + 1 >= currentGroup.totalRounds) {
          // Find next incomplete group
          const nextIncompleteIndex = warmupGroups.findIndex(
            (group, idx) => idx > expandedGroupIndex && (newRounds[group.id] || 0) < group.totalRounds
          );
          
          if (nextIncompleteIndex !== -1) {
            // Move to next group and start from first exercise
            setExpandedGroupIndex(nextIncompleteIndex);
            setActiveExerciseIndex(0);
          } else {
            // All done, navigate back
            navigation.goBack();
          }
        } else {
          // Move to next round, start from first exercise
          setActiveExerciseIndex(0);
        }
      }
    }
  };
  
  const allComplete = warmupGroups.length > 0 && warmupGroups.every(group => 
    (currentRounds[group.id] || 0) >= group.totalRounds
  );
  
  const handleRemoveWarmup = () => {
    Alert.alert(
      t('removeWarmup'),
      t('removeWarmupConfirmation'),
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
            // Update the template to remove warmup items
            await updateWorkoutTemplate(workoutTemplateId, { warmupItems: [] });
            navigation.goBack();
          },
        },
      ]
    );
  };
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
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
            style={styles.removeButton}
            onPress={handleRemoveWarmup}
            activeOpacity={1}
          >
            <Text style={styles.removeButtonText}>{t('remove')}</Text>
            <IconTrash size={16} color={COLORS.error} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{t('warmup')}</Text>
        </View>
      </View>
      
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        <View style={styles.itemsAccordion}>
          {warmupGroups.map((group, index) => {
            const isExpanded = expandedGroupIndex === index;
            const currentRound = currentRounds[group.id] || 0;
            const isCompleted = currentRound >= group.totalRounds;
            
            return (
              <View key={group.id} style={styles.itemRow} testID={`group-row-${index}`}>
                {/* Exercise Cards Container - Full width */}
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
                        <View key={exercise.id} style={styles.exerciseCardWrapper} testID={`exercise-container-${exIndex}`}>
                          {/* Exercise Card */}
                          <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => {
                              if (isActive && !isExerciseCompleted) {
                                // Open drawer for active card
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setShowAdjustmentDrawer(true);
                              }
                            }}
                            disabled={false}
                          >
                            <View style={cardStyle}>
                              <View style={cardInnerStyle}>
                                <View style={styles.itemCardExpanded}>
                                  {/* Exercise Name Row with Check Icon */}
                                  <View style={[
                                    styles.exerciseNameRowWithIcon,
                                    !isActive && !isExerciseCompleted && !isCompleted && styles.exerciseNameInCardCentered
                                  ]} testID="exercise-name-header">
                                    <Text style={[
                                      styles.exerciseNameTextInCard,
                                      (isExpanded || group.exercises.length === 1) && styles.exerciseNameTextActive
                                    ]} testID="exercise-name-text">
                                      {exercise.exerciseName}
                                    </Text>
                                    
                                    {/* Show check icon if exercise or group is completed */}
                                    {(isExerciseCompleted || isCompleted) && (
                                      <IconCheck size={20} color={COLORS.signalPositive} />
                                    )}
                                  </View>
                                  
                                  {/* Values Row - Only show for active card */}
                                  {isActive && (
                                    <View style={styles.valuesDisplayRow} testID="view-mode-container">
                                      <View style={styles.valuesDisplayLeft}>
                                        {/* Reps */}
                                        <View style={styles.valueRow} testID="reps-value-row">
                                          <Text style={styles.largeValue} testID="reps-value">{displayReps}</Text>
                                          <Text style={styles.unit} testID="reps-unit">{repsUnit}</Text>
                                        </View>
                                        
                                        {/* Weight (if > 0) */}
                                        {showWeight && (
                                          <View style={styles.valueRow} testID="weight-value-row">
                                            <Text style={styles.largeValue} testID="weight-value">
                                              {formatWeightForLoad(displayWeight, useKg)}
                                            </Text>
                                            <Text style={styles.unit} testID="weight-unit">{weightUnit}</Text>
                                          </View>
                                        )}
                                      </View>
                                      
                                      {/* Edit Icon for active cards */}
                                      <View style={styles.editIconContainer}>
                                        <IconEdit size={20} color={COLORS.textMeta} />
                                      </View>
                                    </View>
                                  )}
                                </View>
                              </View>
                            </View>
                          </TouchableOpacity>
                          {/* Set count badge overlay - only on active card */}
                          {isActive && !isCompleted && (
                            <View style={styles.setCountBadgeOverlay}>
                              <Text style={styles.setCountText} numberOfLines={1}>
                                {currentRound + 1}/{group.totalRounds}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
      
      {/* Start Button - Fixed at Bottom */}
      {expandedGroupIndex !== -1 && !allComplete && (
        <View style={[styles.markAsDoneContainer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={styles.markAsDoneButton}
            onPress={handleStart}
            activeOpacity={1}
          >
            <View style={[styles.markAsDoneButtonInner, styles.markAsDoneButtonBackground]}>
              <Text style={styles.markAsDoneButtonText}>{t('start')}</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Exercise Timer */}
      {expandedGroupIndex >= 0 && warmupGroups[expandedGroupIndex] && (
        <SetTimerSheet
          visible={showTimer}
          onComplete={handleComplete}
          onClose={() => setShowTimer(false)}
          workoutName={template?.name}
          exerciseName={warmupGroups[expandedGroupIndex].exercises[activeExerciseIndex]?.exerciseName}
          currentSet={currentRounds[warmupGroups[expandedGroupIndex].id] + 1}
          totalSets={warmupGroups[expandedGroupIndex].totalRounds}
          isExerciseTimerPhase={isExerciseTimerPhase}
          exerciseDuration={localValues[warmupGroups[expandedGroupIndex].exercises[activeExerciseIndex]?.id]?.reps ?? warmupGroups[expandedGroupIndex].exercises[activeExerciseIndex]?.reps ?? 30}
          onExerciseTimerComplete={handleComplete}
          skipRestPhase={true}
          isPerSide={warmupGroups[expandedGroupIndex].exercises[activeExerciseIndex]?.isPerSide}
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
          
          {/* Get active exercise */}
          {expandedGroupIndex >= 0 && warmupGroups[expandedGroupIndex] && (
            <View style={styles.drawerValuesCard}>
              {(() => {
                const currentGroup = warmupGroups[expandedGroupIndex];
                const activeExercise = currentGroup.exercises[activeExerciseIndex];
                if (!activeExercise) return null;
                
                const displayWeight = localValues[activeExercise.id]?.weight ?? activeExercise.weight ?? 0;
                const displayReps = localValues[activeExercise.id]?.reps ?? activeExercise.reps ?? 0;
                const repsUnit = activeExercise.isTimeBased ? 'secs' : 'reps';
                const showWeightControl = displayWeight > 0 || true; // Always show weight control
                
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
                          onPress={() => handleWeightChange(activeExercise.id, -weightStep)}
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
                          onPress={() => handleWeightChange(activeExercise.id, weightStep)}
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
                          onPress={() => handleRepsChange(activeExercise.id, -1)}
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
                          onPress={() => handleRepsChange(activeExercise.id, 1)}
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
    paddingBottom: 0,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  headerContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    marginBottom: SPACING.xxxl,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -4,
  },
  removeButton: {
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 6,
  },
  removeButtonText: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.error,
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
  },
  roundIndicatorContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
    position: 'relative',
  },
  roundCheckContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseCardWrapper: {
    position: 'relative',
  },
  setCountBadgeOverlay: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.text,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 16,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  setCountText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.backgroundCanvas,
    textAlign: 'center',
  },
  roundDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: COLORS.textMeta,
    // Use transform to make it appear as 4x4 while occupying 8x8 space
    transform: [{ scale: 0.5 }],
  },
  roundDotCompleted: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.text,
    transform: [{ scale: 1 }],
  },
  roundDotActive: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.text,
    width: 8,
    height: 8,
    borderRadius: 4,
    transform: [{ scale: 1 }],
  },
  roundDotHidden: {
    opacity: 0,
  },
  exerciseCardsContainer: {
    gap: 12,
  },
  exerciseNameHeader: {
    paddingHorizontal: 4,
    paddingBottom: 8,
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
  exerciseNameTextInCard: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  exerciseNameTextActive: {
    color: COLORS.text,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  exerciseNameText: {
    ...TYPOGRAPHY.bodyBold,
    color: '#000000',
    fontSize: 16,
    marginBottom: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressContainerInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.borderDimmed,
  },
  progressDotCompleted: {
    backgroundColor: COLORS.signalPositive,
  },
  progressDotActive: {
    backgroundColor: COLORS.accentPrimary,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  progressText: {
    ...TYPOGRAPHY.meta,
    fontSize: 12,
    color: COLORS.textMeta,
    marginLeft: 4,
  },
  activeItemWrapper: {
    width: '100%',
  },
  itemCard: {
    ...CARDS.cardDeep.outer,
    borderWidth: 2,
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
  itemCardCollapsedRadius: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  itemCardInnerCollapsedRadius: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  itemCardCollapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: SPACING.lg,
  },
  itemCollapsedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  collapsedValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  itemCollapsedText: {
    ...TYPOGRAPHY.body,
    color: '#000000',
  },
  itemCollapsedUnit: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  itemCheckIcon: {
    margin: -4,
  },
  itemCardExpanded: {
    padding: 16,
  },
  itemCardExpandedSuperset: {
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 16,
  },
  valuesDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valuesDisplayLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
    gap: 24,
  },
  largeValue: {
    ...TYPOGRAPHY.h1,
    color: '#000000',
  },
  unit: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  editIconContainer: {
    marginLeft: SPACING.md,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  exerciseNameInCardText: {
    ...TYPOGRAPHY.body,
    color: '#000000',
    flex: 1,
  },
  editButton: {
    padding: 4,
    marginLeft: 8,
  },
  doneEditButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.accentPrimary,
    marginLeft: 8,
  },
  doneEditButtonText: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 14,
    color: COLORS.backgroundCanvas,
  },
  valuesWithEditContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  valuesHorizontalContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    flex: 1,
  },
  valueSeparator: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  adjustmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  valueContainer: {
    flex: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 0,
    gap: 4,
  },
  largeValue: {
    ...TYPOGRAPHY.h1,
    color: '#000000',
  },
  unit: {
    ...TYPOGRAPHY.h1,
    color: COLORS.textMeta,
  },
  mediumValue: {
    ...TYPOGRAPHY.body,
    color: '#000000',
  },
  mediumUnit: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  adjustButtonTapTarget: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  adjustButtonInner: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentPrimaryDimmed,
  },
  dividerContainer: {
    height: 2,
    marginBottom: 16,
    marginHorizontal: 16,
  },
  dividerTop: {
    height: 1,
    backgroundColor: COLORS.borderDimmed,
  },
  dividerBottom: {
    height: 1,
    backgroundColor: '#FFFFFF',
    marginTop: -1,
  },
  markAsDoneContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.backgroundCanvas,
  },
  markAsDoneButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  markAsDoneButtonInner: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAsDoneButtonBackground: {
    backgroundColor: COLORS.accentPrimary,
  },
  markAsDoneButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.backgroundCanvas,
    fontSize: 18,
  },
  exerciseSeparator: {
    height: 1,
    backgroundColor: COLORS.borderDimmed,
    marginTop: 0,
    marginBottom: 4,
    marginHorizontal: 16,
  },
  collapsedExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  
  // Adjustment Drawer Styles
  adjustmentDrawerContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
  },
  adjustmentDrawerTitle: {
    ...TYPOGRAPHY.h3,
    color: '#000000',
    marginBottom: SPACING.lg,
  },
  drawerValuesCard: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  drawerAdjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  drawerAdjustValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.sm,
  },
  drawerAdjustValueText: {
    ...TYPOGRAPHY.h1,
    color: '#000000',
  },
  drawerAdjustUnit: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  drawerAdjustButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  drawerAdjustDivider: {
    height: 1,
    backgroundColor: COLORS.borderDimmed,
    marginHorizontal: SPACING.xl,
  },
});
