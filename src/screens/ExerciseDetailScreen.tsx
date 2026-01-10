import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager, Animated, Modal, Alert } from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import dayjs from 'dayjs';
import type { WorkoutTemplateExercise } from '../types';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, GRADIENTS, CARDS } from '../constants';
import { IconArrowLeft, IconPlay, IconCheck, IconMenu, IconMinusLine, IconAddLine } from '../components/icons';
import { SetTimerSheet } from '../components/timer/SetTimerSheet';
import { Toggle } from '../components/Toggle';
import { BottomDrawer } from '../components/common/BottomDrawer';

interface ExerciseDetailScreenProps {
  route?: {
    params: {
      exercise: WorkoutTemplateExercise;
      exerciseName: string;
      workoutName: string;
      workoutKey: string;
      cycleId: string;
      workoutTemplateId: string;
    };
  };
  navigation?: any;
}

const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  backgroundContainer: '#CDCABB',
  secondary: '#1B1B1B',
  textSecondary: '#3C3C43',
  textMeta: '#817B77',
  border: '#C7C7CC',
  divider: 'rgba(0, 0, 0, 0.1)',
  buttonBg: '#1C1C1C',
};

// Pulsating circle component for resting indicator
function PulsatingCircle() {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.accentPrimary,
        transform: [{ scale: pulseAnim }],
      }}
    />
  );
}

export function ExerciseDetailScreen({ route, navigation }: ExerciseDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { exercise, exerciseName, workoutName, workoutKey, cycleId, workoutTemplateId } = route?.params || {};
  const { exercises, updateCycle, cycles, saveExerciseProgress, getExerciseProgress, skipExercise, getBarbellMode, setBarbellMode, sessions, detailedWorkoutProgress } = useStore();
  const [showTimer, setShowTimer] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [useBarbellMode, setUseBarbellMode] = useState(() => {
    // Load barbell mode preference from store for this exercise
    return exercise?.exerciseId ? getBarbellMode(exercise.exerciseId) : false;
  });
  const [recordingSetIndex, setRecordingSetIndex] = useState<number | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  // Get number of sets from exercise
  const numberOfSets = exercise?.targetSets || 3;
  const [setsData, setSetsData] = useState(() => {
    // Try to load saved progress first
    if (workoutKey && exercise) {
      const savedProgress = getExerciseProgress(workoutKey, exercise.id);
      if (savedProgress) {
        return savedProgress.sets;
      }
    }
    // Default initialization
    return Array.from({ length: numberOfSets }, (_, index) => ({
      setNumber: index + 1,
      weight: exercise?.targetWeight || 0,
      reps: exercise?.targetRepsMax || exercise?.targetRepsMin || 8,
      completed: false,
    }));
  });
  
  // Find first non-completed set for initial expansion
  const [expandedSetIndex, setExpandedSetIndex] = useState(() => {
    const firstIncompleteIndex = setsData.findIndex(set => !set.completed);
    return firstIncompleteIndex !== -1 ? firstIncompleteIndex : -1;
  });
  
  // Check if all sets are completed
  const allSetsCompleted = setsData.every(set => set.completed);
  
  // When all sets complete, expand all cards
  useEffect(() => {
    if (allSetsCompleted && expandedSetIndex === -1) {
      // Don't auto-expand, leave them collapsed after completion
    }
  }, [allSetsCompleted]);
  
  if (!exercise) return null;
  
  const exerciseData = exercises.find(e => e.id === exercise.exerciseId);
  const BARBELL_WEIGHT = 45;
  
  const handleWeightIncrement = (setIndex: number) => {
    const newSets = [...setsData];
    newSets[setIndex] = {
      ...newSets[setIndex],
      weight: newSets[setIndex].weight + 2.5,
    };
    setSetsData(newSets);
    setHasUnsavedChanges(true);
    
    // Save immediately
    if (workoutKey && exercise) {
      saveExerciseProgress(workoutKey, exercise.id, {
        exerciseId: exercise.id,
        sets: newSets,
      });
    }
  };
  
  const handleWeightDecrement = (setIndex: number) => {
    const newSets = [...setsData];
    newSets[setIndex] = {
      ...newSets[setIndex],
      weight: Math.max(0, newSets[setIndex].weight - 2.5),
    };
    setSetsData(newSets);
    setHasUnsavedChanges(true);
    
    // Save immediately
    if (workoutKey && exercise) {
      saveExerciseProgress(workoutKey, exercise.id, {
        exerciseId: exercise.id,
        sets: newSets,
      });
    }
  };
  
  const handleRepsIncrement = (setIndex: number) => {
    const newSets = [...setsData];
    newSets[setIndex] = {
      ...newSets[setIndex],
      reps: newSets[setIndex].reps + 1,
    };
    setSetsData(newSets);
    setHasUnsavedChanges(true);
    
    // Save immediately
    if (workoutKey && exercise) {
      saveExerciseProgress(workoutKey, exercise.id, {
        exerciseId: exercise.id,
        sets: newSets,
      });
    }
  };
  
  const handleRepsDecrement = (setIndex: number) => {
    const newSets = [...setsData];
    newSets[setIndex] = {
      ...newSets[setIndex],
      reps: Math.max(1, newSets[setIndex].reps - 1),
    };
    setSetsData(newSets);
    setHasUnsavedChanges(true);
    
    // Save immediately
    if (workoutKey && exercise) {
      saveExerciseProgress(workoutKey, exercise.id, {
        exerciseId: exercise.id,
        sets: newSets,
      });
    }
  };
  
  const handleRecord = (setIndex: number) => {
    // Mark set as completed and collapse it
    const updatedSets = [...setsData];
    const completedSet = updatedSets[setIndex];
    
    // Mark current set as complete
    updatedSets[setIndex] = {
      ...completedSet,
      completed: true,
    };
    
    // Update all subsequent incomplete sets with the current set's weight and reps
    for (let i = setIndex + 1; i < updatedSets.length; i++) {
      if (!updatedSets[i].completed) {
        updatedSets[i] = {
          ...updatedSets[i],
          weight: completedSet.weight,
          reps: completedSet.reps,
        };
      }
    }
    
    setSetsData(updatedSets);
    
    // Save progress immediately with updated data
    if (workoutKey && exercise) {
      saveExerciseProgress(workoutKey, exercise.id, {
        exerciseId: exercise.id,
        sets: updatedSets,
      });
    }
    
    // Animate collapse
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        250,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity
      )
    );
    
    // Collapse current set and show timer
    setRecordingSetIndex(setIndex);
    setExpandedSetIndex(-1); // Collapse all
    setShowTimer(true);
  };
  
  const handleTimerComplete = () => {
    setShowTimer(false);
    
    // Check if this was the last set
    const isLastSet = recordingSetIndex !== null && recordingSetIndex === numberOfSets - 1;
    const allNowCompleted = recordingSetIndex !== null && 
      setsData.filter((s, idx) => idx <= recordingSetIndex || s.completed).length === numberOfSets;
    
    if (isLastSet && allNowCompleted) {
      // Navigate back to workout page
      navigation?.goBack();
      // TODO: Add shimmer effect on next exercise in workout page
    } else {
      // Animate expansion of next set
      LayoutAnimation.configureNext(
        LayoutAnimation.create(
          250,
          LayoutAnimation.Types.easeInEaseOut,
          LayoutAnimation.Properties.opacity
        )
      );
      
      // Expand next non-completed set if available
      if (recordingSetIndex !== null) {
        const nextIncompleteIndex = setsData.findIndex((set, idx) => idx > recordingSetIndex && !set.completed);
        if (nextIncompleteIndex !== -1) {
          setExpandedSetIndex(nextIncompleteIndex);
        } else {
          setExpandedSetIndex(-1); // All sets completed
        }
        setRecordingSetIndex(null);
      }
    }
  };
  
  // Save progress function
  const saveProgress = useCallback(async () => {
    if (workoutKey && exercise) {
      // Save detailed set progress
      await saveExerciseProgress(workoutKey, exercise.id, {
        exerciseId: exercise.id,
        sets: setsData,
      });
    }
    
    if (cycleId && workoutTemplateId && exercise) {
      const cycle = cycles.find(c => c.id === cycleId);
      if (cycle) {
        const updatedTemplates = cycle.workoutTemplates.map(template => {
          if (template.id === workoutTemplateId) {
            const updatedExercises = template.exercises.map(ex => {
              if (ex.id === exercise.id) {
                // Use the first set's values as the new target
                const firstSet = setsData[0];
                return {
                  ...ex,
                  targetWeight: firstSet.weight,
                  targetRepsMax: firstSet.reps,
                  targetRepsMin: firstSet.reps,
                };
              }
              return ex;
            });
            return { ...template, exercises: updatedExercises };
          }
          return template;
        });
        
        await updateCycle(cycleId, { workoutTemplates: updatedTemplates });
      }
    }
  }, [workoutKey, exercise, setsData, saveExerciseProgress, cycleId, workoutTemplateId, cycles, updateCycle]);
  
  // Save progress when leaving the screen
  useEffect(() => {
    const unsubscribe = navigation?.addListener('beforeRemove', (e: any) => {
      // Prevent default action
      e.preventDefault();
      
      // Check if exercise was just skipped - if so, don't overwrite the skip state
      const currentProgress = getExerciseProgress(workoutKey, exercise.id);
      if (currentProgress?.skipped) {
        console.log('🚫 Exercise is skipped, skipping auto-save to preserve skip state');
        navigation.dispatch(e.data.action);
        return;
      }
      
      // Save progress, then allow navigation
      saveProgress().then(() => {
        navigation.dispatch(e.data.action);
      });
    });

    return unsubscribe;
  }, [navigation, saveProgress, workoutKey, exercise, getExerciseProgress]);
  
  const handleCompleteExercise = () => {
    setShowMenu(false);
    
    Alert.alert(
      'Complete Exercise',
      'Mark all sets as complete?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Complete',
          style: 'default',
          onPress: async () => {
            const completedSets = setsData.map(set => ({
              ...set,
              completed: true,
              completedAt: new Date().toISOString(),
            }));
            setSetsData(completedSets);
            
            // Save progress
            if (workoutKey && exercise) {
              await saveExerciseProgress(workoutKey, exercise.id, {
                exerciseId: exercise.id,
                sets: completedSets,
              });
              
              // Navigate back to workout page
              navigation?.goBack();
            }
          },
        },
      ]
    );
  };
  
  const handleResetExercise = () => {
    setShowMenu(false);
    
    Alert.alert(
      'Reset Exercise',
      'Clear all progress for this exercise? This cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            // Reset all sets to default values
            const resetSets = Array.from({ length: numberOfSets }, (_, index) => ({
              setNumber: index + 1,
              weight: exercise?.targetWeight || 0,
              reps: exercise?.targetRepsMax || exercise?.targetRepsMin || 8,
              completed: false,
            }));
            setSetsData(resetSets);
            setExpandedSetIndex(0);
            
            // Save the reset state
            if (workoutKey && exercise) {
              saveExerciseProgress(workoutKey, exercise.id, {
                exerciseId: exercise.id,
                sets: resetSets,
              });
            }
          },
        },
      ]
    );
  };
  
  const handleHistory = () => {
    setShowMenu(false);
    setShowHistory(true);
  };
  
  const handleSkipExercise = () => {
    setShowMenu(false);
    
    Alert.alert(
      'Skip Exercise',
      'Are you sure you want to skip this exercise?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Skip',
          style: 'default',
          onPress: () => {
            if (workoutKey && exercise) {
              console.log('🚫 Skipping exercise:', exercise.id);
              console.log('🔑 Workout key:', workoutKey);
              console.log('📝 Exercise details:', exercise);
              
              // Save the skip state and navigate back
              skipExercise(workoutKey, exercise.id).then(() => {
                console.log('✅ Exercise skipped successfully');
                // Navigate back immediately without confirmation
                navigation?.goBack();
              }).catch((error) => {
                console.error('❌ Error skipping exercise:', error);
                Alert.alert('Error', 'Failed to skip exercise. Please try again.');
              });
            } else {
              Alert.alert('Error', 'Missing workout or exercise information');
            }
          },
        },
      ]
    );
  };
  
  // Get exercise history from workout progress - grouped by date, newest first
  const getExerciseHistory = () => {
    if (!exercise) return [];
    
    // Map to store sets by date (YYYY-MM-DD)
    const historyByDate = new Map<string, Array<{
      setNumber: number;
      weight: number;
      reps: number;
      completed: boolean;
    }>>();
    
    // Create a map of workoutTemplateId -> workout template for quick lookup
    const workoutTemplateMap = new Map<string, any>();
    if (cycles && Array.isArray(cycles)) {
      cycles.forEach(cycle => {
        if (cycle.workoutTemplates && Array.isArray(cycle.workoutTemplates)) {
          cycle.workoutTemplates.forEach(workout => {
            workoutTemplateMap.set(workout.id, workout);
          });
        }
      });
    }
    
    // 1. Get from current workout progress (check all workouts for matching exerciseId OR name)
    Object.entries(detailedWorkoutProgress).forEach(([workoutKey, workoutProgress]) => {
      // Extract workoutTemplateId from workoutKey (format: workoutTemplateId-YYYY-MM-DD)
      const workoutTemplateId = workoutKey.split('-').slice(0, -3).join('-'); // Remove the date part
      const workoutTemplate = workoutTemplateMap.get(workoutTemplateId);
      
      if (!workoutTemplate) return; // Skip if we can't find the template
      
      // Check all exercises in this workout progress
      Object.entries(workoutProgress.exercises).forEach(([templateExerciseId, exerciseProgress]) => {
        // Find the template exercise to get its actual exerciseId
        const templateExercise = workoutTemplate.exercises.find((ex: any) => ex.id === templateExerciseId);
        
        if (!templateExercise) return;
        
        // Match by exerciseId (preferred) OR by exercise name (fallback for old data)
        const exerciseDataById = exercises.find(e => e.id === templateExercise.exerciseId);
        const exerciseDataForCurrent = exercises.find(e => e.id === exercise.exerciseId);
        
        const matchesById = templateExercise.exerciseId === exercise.exerciseId;
        const matchesByName = exerciseDataById?.name.toLowerCase().trim() === exerciseDataForCurrent?.name.toLowerCase().trim();
        
        if (matchesById || matchesByName) {
          // Skip if this exercise was marked as skipped
          if (exerciseProgress.skipped) return;
          
          // This exercise matches! Include its completed sets
          const hasCompletedSets = exerciseProgress.sets.some(set => set.completed);
          
          if (hasCompletedSets) {
            // Extract date from workoutKey (format: workoutTemplateId-YYYY-MM-DD)
            const dateMatch = workoutKey.match(/(\d{4}-\d{2}-\d{2})/);
            const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
            
            const completedSets = exerciseProgress.sets
              .filter(set => set.completed)
              .map(set => ({
                setNumber: set.setNumber,
                weight: set.weight,
                reps: set.reps,
                completed: set.completed,
              }));
            
            // If date already exists, merge sets; otherwise create new entry
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
    
    // 2. Get from completed sessions (also match by name as fallback)
    const currentExerciseData = exercises.find(e => e.id === exercise.exerciseId);
    
    sessions.forEach((session) => {
      const exerciseSets = session.sets
        .filter(set => {
          // Match by ID (preferred)
          if (set.exerciseId === exercise.exerciseId) return true;
          
          // Match by name (fallback for old data)
          if (currentExerciseData) {
            const setExerciseData = exercises.find(e => e.id === set.exerciseId);
            if (setExerciseData?.name.toLowerCase().trim() === currentExerciseData.name.toLowerCase().trim()) {
              return true;
            }
          }
          
          return false;
        })
        .filter(set => set.isCompleted)
        .sort((a, b) => a.setIndex - b.setIndex)
        .map(set => ({
          setNumber: set.setIndex + 1,
          weight: set.weight,
          reps: set.reps,
          completed: set.isCompleted,
        }));
      
      if (exerciseSets.length > 0) {
        const date = session.date;
        
        // Merge with existing date if present
        if (historyByDate.has(date)) {
          const existing = historyByDate.get(date)!;
          historyByDate.set(date, [...existing, ...exerciseSets]);
        } else {
          historyByDate.set(date, exerciseSets);
        }
      }
    });
    
    // Convert map to array and sort by date (newest first)
    const history = Array.from(historyByDate.entries())
      .map(([date, sets]) => ({
        date,
        sessionId: date, // Use date as sessionId for key
        sets: sets.sort((a, b) => a.setNumber - b.setNumber), // Sort sets by number
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return history;
  };
  
  const exerciseHistory = getExerciseHistory();
  
  // Helper function to get ordinal suffix
  const getOrdinalSuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  
  return (
    <View style={styles.gradient}>
      <View style={styles.container}>
        {/* Header (includes topBar with back/menu + title) */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          {/* Back Button and Menu Button */}
          <View style={styles.topBar}>
            <TouchableOpacity 
              onPress={() => navigation?.goBack()} 
              style={styles.backButton}
              activeOpacity={1}
            >
              <IconArrowLeft size={24} color="#000000" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setShowMenu(true)} 
              style={styles.menuButton}
              activeOpacity={1}
            >
              <IconMenu size={24} color="#000000" />
            </TouchableOpacity>
          </View>
          
          {/* Title */}
          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>{exerciseName}</Text>
            </View>
            
            {/* Barbell Mode Toggle */}
            <View style={styles.barbellToggleContainer}>
              <Toggle
                label="Barbell"
                value={useBarbellMode}
                disabled={
                  expandedSetIndex !== -1 &&
                  setsData[expandedSetIndex] &&
                  setsData[expandedSetIndex].weight < 45
                }
                onValueChange={(value) => {
                  setUseBarbellMode(value);
                  if (exercise?.exerciseId) {
                    setBarbellMode(exercise.exerciseId, value);
                  }
                }}
              />
            </View>
          </View>
        </View>
        
        <ScrollView 
          style={styles.content} 
          contentContainerStyle={styles.scrollContent}
        >
          {/* Accordion Sets */}
          <View style={styles.setsAccordion}>
            {setsData.map((set, index) => {
              const isExpanded = expandedSetIndex === index;
              const weight = set.weight;
              const reps = set.reps;
              const perSideWeight = useBarbellMode && weight > BARBELL_WEIGHT ? (weight - BARBELL_WEIGHT) / 2 : 0;
              const isCompleted = set.completed;
              
              return (
                <View key={index} style={styles.setRow}>
                  {/* Wrapper for set card + record button */}
                  {isExpanded && (
                    <View style={styles.activeSetWrapper}>
                      <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => {
                          // Check if all sets are complete
                          const allSetsComplete = setsData.every(set => set.completed);
                          // Only allow manual expand/collapse when all sets are complete
                          if (allSetsComplete) {
                            LayoutAnimation.configureNext(
                              LayoutAnimation.create(
                                250,
                                LayoutAnimation.Types.easeInEaseOut,
                                LayoutAnimation.Properties.opacity
                              )
                            );
                            setExpandedSetIndex(isExpanded ? -1 : index);
                          }
                        }}
                        disabled={!setsData.every(set => set.completed)}
                      >
                        <View style={styles.setCard}>
                          <View style={styles.setCardInner}>
                      {/* Expanded View */}
                      {isExpanded && (
                        <View style={styles.setCardExpanded}>
                          {/* Weight Adjustment */}
                          <View style={styles.adjustmentRow}>
                            <View style={styles.valueContainer}>
                              <View style={styles.valueRow}>
                                <Text style={styles.largeValue}>{weight}</Text>
                                <Text style={styles.unit}>lbs</Text>
                                {useBarbellMode && perSideWeight > 0 && (
                                  <Text style={styles.perSideText}>
                                    {perSideWeight % 1 === 0 ? perSideWeight : perSideWeight.toFixed(1)} per side
                                  </Text>
                                )}
                              </View>
                            </View>
                            <View style={styles.buttonsContainer}>
                              <TouchableOpacity 
                                onPress={() => handleWeightDecrement(index)}
                                activeOpacity={1}
                                style={styles.adjustButtonTapTarget}
                              >
                                <View style={styles.adjustButton}>
                                  <LinearGradient
                                    colors={['#212121', '#3F3D3D']}
                                    start={{ x: 0.42, y: 0.42 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.adjustButtonInner}
                                  >
                                    <IconMinusLine size={24} color="#DEDEDE" />
                                  </LinearGradient>
                                </View>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                onPress={() => handleWeightIncrement(index)}
                                activeOpacity={1}
                                style={styles.adjustButtonTapTarget}
                              >
                                <View style={styles.adjustButton}>
                                  <LinearGradient
                                    colors={['#212121', '#3F3D3D']}
                                    start={{ x: 0.42, y: 0.42 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.adjustButtonInner}
                                  >
                                    <IconAddLine size={24} color="#DEDEDE" />
                                  </LinearGradient>
                                </View>
                              </TouchableOpacity>
                            </View>
                          </View>
                          
                          {/* Divider */}
                          <View style={styles.dividerContainer}>
                            <View style={styles.dividerTop} />
                            <View style={styles.dividerBottom} />
                          </View>
                          
                          {/* Reps Adjustment */}
                          <View style={[styles.adjustmentRow, { marginBottom: 0 }]}>
                            <View style={styles.valueContainer}>
                              <View style={styles.valueRow}>
                                <Text style={styles.largeValue}>{reps}</Text>
                                <Text style={styles.unit}>reps</Text>
                              </View>
                            </View>
                            <View style={styles.buttonsContainer}>
                              <TouchableOpacity 
                                onPress={() => handleRepsDecrement(index)}
                                activeOpacity={1}
                                style={styles.adjustButtonTapTarget}
                              >
                                <View style={styles.adjustButton}>
                                  <LinearGradient
                                    colors={['#212121', '#3F3D3D']}
                                    start={{ x: 0.42, y: 0.42 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.adjustButtonInner}
                                  >
                                    <IconMinusLine size={24} color="#DEDEDE" />
                                  </LinearGradient>
                                </View>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                onPress={() => handleRepsIncrement(index)}
                                activeOpacity={1}
                                style={styles.adjustButtonTapTarget}
                              >
                                <View style={styles.adjustButton}>
                                  <LinearGradient
                                    colors={['#212121', '#3F3D3D']}
                                    start={{ x: 0.42, y: 0.42 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.adjustButtonInner}
                                  >
                                    <IconAddLine size={24} color="#DEDEDE" />
                                  </LinearGradient>
                                </View>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  {/* Collapsed view - without wrapper */}
                  {!isExpanded && (
                    <TouchableOpacity
                      activeOpacity={1}
                      onPress={() => {
                        // Check if all sets are complete
                        const allSetsComplete = setsData.every(set => set.completed);
                        // Only allow manual expand/collapse when all sets are complete
                        if (allSetsComplete) {
                          LayoutAnimation.configureNext(
                            LayoutAnimation.create(
                              250,
                              LayoutAnimation.Types.easeInEaseOut,
                              LayoutAnimation.Properties.opacity
                            )
                          );
                          setExpandedSetIndex(isExpanded ? -1 : index);
                        }
                      }}
                      disabled={!setsData.every(set => set.completed)}
                    >
                      <View style={[
                        isExpanded ? styles.setCard : styles.setCardDimmed,
                        styles.setCardCollapsedRadius
                      ]}>
                        <View style={[
                          isExpanded ? styles.setCardInner : styles.setCardInnerDimmed,
                          styles.setCardInnerCollapsedRadius
                        ]}>
                              <View style={styles.setCardCollapsed}>
                                <View style={styles.setCollapsedLeft}>
                                  <View style={styles.collapsedValueRow}>
                                    <Text style={styles.setCollapsedText}>{weight}</Text>
                                    <Text style={styles.setCollapsedUnit}>lbs</Text>
                                  </View>
                                  <View style={styles.collapsedValueRow}>
                                    <Text style={styles.setCollapsedText}>{reps}</Text>
                                    <Text style={styles.setCollapsedUnit}>reps</Text>
                                  </View>
                                </View>
                                {recordingSetIndex === index && showTimer ? (
                                  <PulsatingCircle />
                                ) : isCompleted ? (
                                  <View style={styles.setCheckIcon}>
                                    <IconCheck size={24} color="#227132" />
                                  </View>
                                ) : null}
                              </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
        
        {/* Mark as Done / Save Changes Button - Fixed at Bottom */}
        {expandedSetIndex !== -1 && (
          <View style={[styles.markAsDoneContainer, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={styles.markAsDoneButton}
              onPress={() => {
                if (allSetsCompleted && hasUnsavedChanges) {
                  // Save changes mode - just close without navigation
                  setHasUnsavedChanges(false);
                  LayoutAnimation.configureNext(
                    LayoutAnimation.create(
                      250,
                      LayoutAnimation.Types.easeInEaseOut,
                      LayoutAnimation.Properties.opacity
                    )
                  );
                  setExpandedSetIndex(-1);
                } else if (expandedSetIndex !== null && expandedSetIndex >= 0) {
                  // Mark as Done mode - record the set
                  handleRecord(expandedSetIndex);
                }
              }}
              activeOpacity={1}
              disabled={allSetsCompleted && !hasUnsavedChanges}
            >
              {allSetsCompleted ? (
                // Save Changes button (black background)
                <View style={[styles.markAsDoneButtonInner, styles.saveChangesButtonBackground, (!hasUnsavedChanges) && styles.buttonDisabled]}>
                  <Text style={styles.markAsDoneButtonText}>Save changes</Text>
                </View>
              ) : (
                // Mark as Done button (solid background)
                <View style={[styles.markAsDoneButtonInner, styles.markAsDoneButtonBackground]}>
                  <Text style={styles.markAsDoneButtonText}>Mark as Done</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
        
        {/* Timer Bottom Sheet */}
        <SetTimerSheet
          visible={showTimer}
          workoutName={workoutName}
          exerciseName={exerciseName}
          currentSet={recordingSetIndex !== null ? recordingSetIndex + 1 : 1}
          totalSets={numberOfSets}
          onComplete={handleTimerComplete}
          onClose={() => setShowTimer(false)}
        />
        
        {/* Overflow Menu Modal */}
        <Modal
          visible={showMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowMenu(false)}
        >
          <TouchableOpacity 
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setShowMenu(false)}
          >
            <View style={[styles.menuContainer, { paddingTop: insets.top + 48 }]}>
              <View style={styles.menu}>
                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={handleHistory}
                  activeOpacity={1}
                >
                  <Text style={styles.menuItemText}>History</Text>
                </TouchableOpacity>
                
                <View style={styles.menuDivider} />
                
                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={handleCompleteExercise}
                  activeOpacity={1}
                >
                  <Text style={styles.menuItemText}>Mark as complete</Text>
                </TouchableOpacity>
                
                <View style={styles.menuDivider} />
                
                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={handleSkipExercise}
                  activeOpacity={1}
                >
                  <Text style={styles.menuItemText}>Skip exercise</Text>
                </TouchableOpacity>
                
                <View style={styles.menuDivider} />
                
                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={handleResetExercise}
                  activeOpacity={1}
                >
                  <Text style={[styles.menuItemText, styles.menuItemTextDestructive]}>Reset</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
        
        {/* Exercise History Bottom Sheet */}
        <BottomDrawer
          visible={showHistory}
          onClose={() => setShowHistory(false)}
          maxHeight="40%"
          expandable={true}
        >
          <View style={styles.historySheetContent}>
              <Text style={styles.historySheetTitle}>History</Text>
                {exerciseHistory.length === 0 ? (
                  <View style={styles.historySheetEmpty}>
                    <Text style={styles.historySheetEmptyText}>
                      No history recorded yet
                    </Text>
                  </View>
                ) : (
                  exerciseHistory.map((workout, workoutIndex) => {
                    const isLastItem = workoutIndex === exerciseHistory.length - 1;
                    return (
                      <View 
                        key={workout.sessionId}
                        style={isLastItem ? { paddingBottom: 16 } : undefined}
                      >
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
                          <View key={`${workout.sessionId}-${setIndex}`} style={styles.historySetRow}>
                            <View style={styles.historyValueColumn}>
                              <Text style={styles.setCollapsedText}>{set.weight}</Text>
                              <Text style={styles.setCollapsedUnit}>lbs</Text>
                            </View>
                            <View style={styles.historyValueColumn}>
                              <Text style={styles.setCollapsedText}>{set.reps}</Text>
                              <Text style={styles.setCollapsedUnit}>reps</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                    
                        {workoutIndex < exerciseHistory.length - 1 && (
                      <View style={styles.historyDividerContainer}>
                        <View style={styles.historyDividerTop} />
                        <View style={styles.historyDividerBottom} />
                      </View>
                        )}
                      </View>
                    );
                  })
                )}
            </View>
        </BottomDrawer>
          </View>
      </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    paddingBottom: SPACING.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
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
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: '#000000',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    paddingBottom: 120, // Extra space for fixed Mark as Done button
  },
  setsAccordion: {
    gap: 12,
  },
  setRow: {
    width: '100%',
  },
  activeSetWrapper: {
    width: '100%',
  },
  setCard: {
    ...CARDS.cardDeep.outer,
    borderRadius: 12,
  },
  setCardInner: {
    ...CARDS.cardDeep.inner,
    borderRadius: 12,
  },
  setCardDimmed: {
    ...CARDS.cardDeepDimmed.outer,
    borderRadius: 12,
  },
  setCardInnerDimmed: {
    ...CARDS.cardDeepDimmed.inner,
    borderRadius: 12,
  },
  setCardInactive: {
    shadowOpacity: 0,
    elevation: 0,
  },
  setCardCollapsedRadius: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  setCardInnerCollapsedRadius: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  setCardCollapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  setCollapsedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  collapsedValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  setCollapsedText: {
    ...TYPOGRAPHY.body,
    color: '#000000',
  },
  setCollapsedUnit: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
  },
  setCheckIcon: {
    margin: -4,
  },
  setCardExpanded: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  adjustmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  valueContainer: {
    flex: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 0,
    gap: 4,
    position: 'relative',
  },
  largeValue: {
    ...TYPOGRAPHY.h1,
    color: '#000000',
  },
  unit: {
    ...TYPOGRAPHY.h1,
    color: LIGHT_COLORS.textMeta,
  },
  perSideText: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 0,
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
  adjustButtonShadow1: {
    width: 48,
    height: 48,
    // Shadow 1: white, opacity 0.35, no blur, offset -1, -1
    shadowColor: '#FFFFFF',
    shadowOffset: { width: -1, height: -1 },
    shadowOpacity: 0.35,
    shadowRadius: 0,
    elevation: 1,
  },
  adjustButtonShadow2: {
    width: 48,
    height: 48,
    // Shadow 2: black, opacity 0.16, blur 3, offset -2, -2
    shadowColor: '#000000',
    shadowOffset: { width: -2, height: -2 },
    shadowOpacity: 0.16,
    shadowRadius: 3,
    elevation: 2,
  },
  adjustButtonShadow3: {
    width: 48,
    height: 48,
    // Shadow 3: white, opacity 0.8, blur 5, offset 2, 2
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 3,
  },
  adjustButtonShadow4: {
    width: 48,
    height: 48,
    // Shadow 4: white, opacity 1.0, no blur, offset 1, 1
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1.0,
    shadowRadius: 0,
    elevation: 4,
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
  },
  adjustButtonText: {
    ...TYPOGRAPHY.body,
    color: '#FFFFFF',
    marginTop: -2,
  },
  dividerContainer: {
    height: 2,
    marginBottom: 16,
  },
  dividerTop: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  dividerBottom: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  recordRowWrapper: {
    marginTop: 0,
    borderTopWidth: 0,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: COLORS.border,
    borderBottomColor: COLORS.border,
    borderRightColor: COLORS.border,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 20,
    paddingHorizontal: 24,
    gap: 8,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: COLORS.accentPrimaryLight,
    borderLeftColor: COLORS.accentPrimaryLight,
    borderBottomColor: COLORS.accentPrimaryDark,
    borderRightColor: COLORS.accentPrimaryDark,
  },
  recordRowCompleted: {
    opacity: 1, // Full opacity when disabled
    borderTopColor: COLORS.backgroundCanvas,
    borderLeftColor: COLORS.backgroundCanvas,
    borderBottomColor: COLORS.border,
    borderRightColor: COLORS.border,
  },
  recordRowActive: {
    opacity: 1, // Full opacity when there are unsaved changes
  },
  recordButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: '#ffffff',
  },
  recordButtonTextDisabled: {
    color: LIGHT_COLORS.textMeta,
  },
  
  // Barbell Toggle
  barbellToggleContainer: {
    marginTop: SPACING.lg,
    paddingBottom: 40,
  },
  
  // History Bottom Sheet Content
  historySheetContent: {
    paddingHorizontal: SPACING.xxl,
  },
  historySheetTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.xl,
  },
  historySheetEmpty: {
    paddingVertical: SPACING.xxxl,
    alignItems: 'center',
  },
  historySheetEmptyText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
    textAlign: 'center',
  },
  historyWorkoutGroup: {
    flexDirection: 'row',
    paddingVertical: SPACING.lg,
    gap: 32,
  },
  historyDateColumn: {
    flex: 1,
  },
  historyDateText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
  },
  historySetsColumn: {
    flex: 1,
    gap: SPACING.md,
    alignItems: 'flex-end', // Right-align the entire column
  },
  historySetRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 16,
    justifyContent: 'flex-end', // Right-align the row
  },
  historyValueColumn: {
    width: 64, // 64px width per column
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end', // Right-align text within column
    gap: 4,
  },
  historyDividerContainer: {
    marginVertical: SPACING.md,
  },
  historyDividerTop: {
    height: 1,
    backgroundColor: '#CBC8C7', // metaSoft color
  },
  historyDividerBottom: {
    height: 1,
    backgroundColor: '#FFFFFF',
    marginTop: 1, // 1px gap between lines
  },
  
  // Overflow Menu
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  menuContainer: {
    alignItems: 'flex-end',
    paddingRight: 18,
  },
  menu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderCurve: 'continuous',
    minWidth: 200,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 17,
    fontWeight: '400',
    color: LIGHT_COLORS.secondary,
  },
  menuItemTextDestructive: {
    color: '#FF3B30',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginHorizontal: 12,
  },
  
  // Mark as Done Button
  markAsDoneContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xxl,
    paddingTop: 16,
  },
  markAsDoneButton: {
    borderRadius: 12,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  markAsDoneButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  markAsDoneButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: '#FFFFFF',
    fontSize: 17,
  },
  saveChangesButtonBackground: {
    backgroundColor: '#1B1B1B',
  },
  markAsDoneButtonBackground: {
    backgroundColor: COLORS.accentPrimary,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});

