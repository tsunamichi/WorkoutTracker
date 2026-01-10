import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Easing, AppState, Modal, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store';
import * as storage from '../storage';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconArrowLeft, IconCheck, IconPlay, IconPause, IconMenu, IconRestart, IconAdd } from '../components/icons';
import dayjs from 'dayjs';
import { startRestTimer, updateRestTimer, endRestTimer, markRestTimerCompleted } from '../modules/RestTimerLiveActivity';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { SetTimerSheet } from '../components/timer/SetTimerSheet';

interface WorkoutExecutionScreenProps {
  route: {
    params: {
      cycleId: string;
      workoutTemplateId: string;
      date: string;
    };
  };
  navigation: any;
}

// Legacy Set Timer Sheet Component (saved for future reference)
// This is the original design with the dark gradient timer display
export function SetTimerSheetLegacy({ visible, onComplete, onClose, workoutName, exerciseName, currentSet = 1, totalSets = 1 }: any) {
  const insets = useSafeAreaInsets();
  const { settings } = useStore();
  const restTime = settings.restTimerDefaultSeconds;
  const [timeLeft, setTimeLeft] = useState(restTime);
  const [isRunning, setIsRunning] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const endTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const liveActivityIdRef = useRef<string | null>(null);
  const countdownSoundRef = useRef<Audio.Sound | null>(null);
  const completeSoundRef = useRef<Audio.Sound | null>(null);
  const lastPlayedSecondRef = useRef<number | null>(null);
  
  const playCompletionAlert = async () => {
    try {
      // Play completion sound
      if (completeSoundRef.current) {
        console.log('🔊 Playing timer completion sound');
        await completeSoundRef.current.setPositionAsync(0);
        await completeSoundRef.current.playAsync();
      }
      
      // Play strong haptic feedback sequence
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Add a short delay and repeat for emphasis
      setTimeout(async () => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 200);
      
      setTimeout(async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 400);
    } catch (error) {
      console.log('⚠️ Error playing completion alert:', error);
    }
  };
  
  const animateOutAndClose = useRef((callback: () => void) => {
    console.log('🎬 Starting exit animation');
    // Animate out - slide down drawer
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    }).start(() => {
      console.log('✅ Exit animation complete, calling callback');
      callback();
    });
  }).current;
  
  useEffect(() => {
    console.log('🎬 Timer visibility changed:', visible);
    if (visible) {
      // Reset and auto-start when drawer opens
      console.log('⏱️ Starting timer with', restTime, 'seconds');
      setTimeLeft(restTime);
      setIsRunning(true);
      lastPlayedSecondRef.current = null; // Reset sound tracking
      
      // Set end time for background accuracy
      endTimeRef.current = Date.now() + restTime * 1000;
      
      // Start Live Activity for Dynamic Island
      startRestTimer(workoutName || 'Workout', exerciseName || 'Exercise', restTime, currentSet, totalSets).then((activityId) => {
        if (activityId) {
          liveActivityIdRef.current = activityId;
          console.log('🏝️ Dynamic Island Live Activity started');
        }
      });
      
      // Reset animation to starting position
      slideAnim.setValue(0);
      
      // Slide up drawer
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 20,
        velocity: 2,
      }).start();
    } else {
      // When closing, just reset state (animation handled by animateOutAndClose)
      setTimeLeft(restTime);
      setIsRunning(false);
      endTimeRef.current = null;
      
      // End Live Activity if it was started
      if (liveActivityIdRef.current) {
        console.log('🏝️ Ending Live Activity (drawer closed)');
        endRestTimer();
        liveActivityIdRef.current = null;
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (liveActivityIdRef.current) {
        console.log('🏝️ Ending Live Activity (component unmount)');
        endRestTimer();
        liveActivityIdRef.current = null;
      }
    };
  }, [visible, restTime, slideAnim, workoutName, exerciseName]);
  
  // Load audio files
  useEffect(() => {
    let mounted = true;
    
    async function loadSounds() {
      try {
        console.log('🔊 Loading timer sounds...');
        
        // Configure audio mode to play even when device is in silent mode
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        
        // Load countdown sound
        const { sound: countdownSound } = await Audio.Sound.createAsync(
          require('../../assets/sounds/countdown.mp3'),
          { shouldPlay: false, volume: 1.0 }
        );
        if (mounted) countdownSoundRef.current = countdownSound;
        
        // Load complete sound
        const { sound: completeSound } = await Audio.Sound.createAsync(
          require('../../assets/sounds/complete.mp3'),
          { shouldPlay: false, volume: 1.0 }
        );
        if (mounted) completeSoundRef.current = completeSound;
        
        console.log('🔊 Timer sounds loaded successfully');
      } catch (error) {
        console.log('⚠️ Error loading timer sounds:', error);
      }
    }
    
    loadSounds();
    
    // Cleanup sounds on unmount
    return () => {
      mounted = false;
      if (countdownSoundRef.current) {
        console.log('🔊 Unloading countdown sound');
        countdownSoundRef.current.unloadAsync();
        countdownSoundRef.current = null;
      }
      if (completeSoundRef.current) {
        console.log('🔊 Unloading complete sound');
        completeSoundRef.current.unloadAsync();
        completeSoundRef.current = null;
      }
    };
  }, []);
  
  // Timer effect using timestamp-based calculation for background accuracy
  useEffect(() => {
    if (!visible || !isRunning || !endTimeRef.current) {
      console.log('⏸️ Timer not running. Visible:', visible, 'Running:', isRunning);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    
    console.log('▶️ Timer interval started');
    
    const updateTimer = () => {
      if (!endTimeRef.current) return;
      
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
      
      console.log('⏱️ Timer tick:', remaining);
      setTimeLeft(remaining);
      
      // Play countdown sound at 3, 2, 1 seconds
      if ((remaining === 3 || remaining === 2 || remaining === 1) && lastPlayedSecondRef.current !== remaining) {
        lastPlayedSecondRef.current = remaining;
        if (countdownSoundRef.current) {
          console.log('🔊 Playing countdown sound for', remaining, 'seconds');
          countdownSoundRef.current.setPositionAsync(0).then(() => {
            return countdownSoundRef.current?.playAsync();
          }).catch((error) => {
            console.log('⚠️ Error playing countdown sound:', error);
          });
        }
      }
      
      // Live Activity updates itself using SwiftUI Timer - no need to update every second
      // Only update on significant events (start, pause, resume)
      
      if (remaining <= 0) {
        console.log('⏰ Timer completed!');
        console.log('🔴 DEBUG: liveActivityIdRef.current =', liveActivityIdRef.current);
        setIsRunning(false);
        endTimeRef.current = null;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        // Play sound and haptic feedback
        playCompletionAlert();
        
        // Mark Live Activity as completed (this expands the Dynamic Island)
        if (liveActivityIdRef.current) {
          console.log('🏝️ Marking Live Activity as completed, ID:', liveActivityIdRef.current);
          markRestTimerCompleted().then((success) => {
            console.log('🔴 DEBUG: markRestTimerCompleted returned:', success);
          }).catch((error) => {
            console.error('🔴 DEBUG: markRestTimerCompleted error:', error);
          });
          // Don't clear liveActivityIdRef yet - keep it alive for a moment to show completion
        } else {
          console.log('🔴 DEBUG: No liveActivityId - cannot mark as completed');
        }
        
        // Auto-dismiss drawer and end Live Activity after showing completion
        setTimeout(() => {
          console.log('✅ Starting exit animation from timer completion');
          if (liveActivityIdRef.current) {
            endRestTimer();
            liveActivityIdRef.current = null;
          }
          animateOutAndClose(onComplete);
        }, 2000); // Wait 2 seconds to show completion before dismissing
      }
    };
    
    // Update immediately
    updateTimer();
    
    // Then update every second
    intervalRef.current = setInterval(updateTimer, 1000);
    
    return () => {
      console.log('🛑 Timer interval cleared');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, visible, onComplete]);
  
  // AppState listener to update timer when app comes back from background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && isRunning && endTimeRef.current) {
        // App became active - recalculate time left
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
        console.log('📱 App became active, recalculating time:', remaining);
        setTimeLeft(remaining);
        
        if (remaining <= 0) {
          console.log('⏰ Timer completed while in background!');
          setIsRunning(false);
          endTimeRef.current = null;
          
          // Play sound and haptic feedback
          playCompletionAlert();
          
          // Mark Live Activity as completed
          if (liveActivityIdRef.current) {
            markRestTimerCompleted();
          }
          
          // Auto-dismiss after showing completion
          setTimeout(() => {
            if (liveActivityIdRef.current) {
              endRestTimer();
              liveActivityIdRef.current = null;
            }
            animateOutAndClose(onComplete);
          }, 2000);
        }
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, [isRunning, onComplete]);
  
  const handleAddTime = () => {
    console.log('🔴 DEBUG: Add time button pressed');
    console.log('➕ Adding 5 seconds');
    if (endTimeRef.current) {
      endTimeRef.current += 5000; // Add 5 seconds to end time
    }
    setTimeLeft(prev => {
      const newTime = prev + 5;
      console.log('New time:', newTime);
      // Reset sound tracking when adding time so sounds can play again
      if (newTime > 3) {
        lastPlayedSecondRef.current = null;
      }
      return newTime;
    });
  };
  
  const handleTogglePause = () => {
    console.log('🔴 DEBUG: Pause/Play button pressed');
    const newState = !isRunning;
    console.log('⏯️ Toggle pause. New state:', newState ? 'RUNNING' : 'PAUSED');
    setIsRunning(newState);
  };
  
  const handleSkip = () => {
    console.log('🔴 DEBUG: Skip button pressed');
    console.log('⏭️ Skip pressed');
    setIsRunning(false);
    endTimeRef.current = null;
    
    // End Live Activity when skipping
    if (liveActivityIdRef.current) {
      console.log('🏝️ Ending Live Activity (skipped)');
      endRestTimer();
      liveActivityIdRef.current = null;
    }
    
    animateOutAndClose(onComplete);
  };
  
  const formatTime = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [500, 0],
  });
  
  if (!visible) return null;
  
  console.log('🔴 DEBUG: Timer drawer is rendering, visible:', visible);
  
  // Match device corner radius (iPhone rounded corners)
  const deviceCornerRadius = insets.bottom > 0 ? 40 : 24;
  
  return (
    <View style={styles.timerOverlay} pointerEvents="box-none">
      {/* Backdrop overlay */}
      <View style={styles.timerBackdrop} pointerEvents="none" />
      
      <Animated.View style={[styles.timerDrawer, { transform: [{ translateY }] }]}>
        <SafeAreaView style={[styles.timerSheet, { 
          borderBottomLeftRadius: deviceCornerRadius,
          borderBottomRightRadius: deviceCornerRadius,
        }]} edges={['bottom']}>
        
        {/* Timer Display */}
      <View style={styles.timerDisplayWrapper}>
      <LinearGradient
        colors={['#050505', '#242424']}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={styles.timerDisplay}
      >
        {/* Decorative diagonal shapes */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.04)']}
          start={{ x: 0.06, y: -0.03 }}
          end={{ x: 1, y: 1 }}
          style={styles.decorativeShape}
        />
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.04)']}
          start={{ x: 0.06, y: -0.03 }}
          end={{ x: 1, y: 1 }}
          style={styles.decorativeShape2}
        />
        
        <View style={styles.timerTimeContainer}>
          <Text style={styles.timerTime}>{formatTime()}</Text>
        </View>
      </LinearGradient>
      </View>
      
      {/* Controls */}
      <View style={styles.timerControls}>
        <TouchableOpacity 
          style={styles.timerControlButtonTapTarget}
          onPress={handleAddTime}
          activeOpacity={1}
        >
          <View style={styles.timerControlButtonContainer}>
            <View style={styles.timerControlButton}>
              <Text style={styles.timerControlButtonText}>+5</Text>
            </View>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.timerControlButtonTapTarget}
          onPress={handleTogglePause}
          activeOpacity={1}
        >
          <View style={[styles.timerControlButtonContainer, styles.timerControlButtonContainerPrimary]}>
            <View style={[styles.timerControlButton, styles.timerControlButtonPrimary]}>
              {isRunning ? (
                <IconPause size={24} color="#FFFFFF" />
              ) : (
                <IconPlay size={24} color="#FFFFFF" />
              )}
            </View>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.timerControlButtonTapTarget}
          onPress={handleSkip}
          activeOpacity={1}
        >
          <View style={styles.timerControlButtonContainer}>
            <View style={styles.timerControlButton}>
              <Text style={styles.timerControlButtonText}>skip</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
      </SafeAreaView>
      </Animated.View>
    </View>
  );
}

export function WorkoutExecutionScreen({ route, navigation }: WorkoutExecutionScreenProps) {
  const insets = useSafeAreaInsets();
  const { cycleId, workoutTemplateId, date } = route.params;
  const { cycles, exercises, addSession, getWorkoutCompletionPercentage, getExerciseProgress, saveExerciseProgress, clearWorkoutProgress, skipExercise } = useStore();
  
  // Subscribe to detailedWorkoutProgress for this specific workout
  const workoutKey = `${workoutTemplateId}-${date}`;
  const currentWorkoutProgress = useStore(state => state.detailedWorkoutProgress[workoutKey]);
  
  const [completedExercises, setCompletedExercises] = useState<string[]>([]);
  const [showTimer, setShowTimer] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [pressedExerciseId, setPressedExerciseId] = useState<string | null>(null);
  
  // Force refresh when screen comes into focus OR when workout progress changes
  useFocusEffect(
    useCallback(() => {
      console.log('📱 Workout screen focused - refreshing exercise states');
      console.log('📊 Current workout progress:', currentWorkoutProgress);
    }, [currentWorkoutProgress])
  );
  
  // Log when workout progress changes
  useEffect(() => {
    console.log('🔄 Workout progress changed:', currentWorkoutProgress);
  }, [currentWorkoutProgress]);
  
  const cycle = cycles.find(c => c.id === cycleId);
  const workout = cycle?.workoutTemplates.find(w => w.id === workoutTemplateId);
  
  // Calculate completion percentage, excluding skipped exercises
  let totalSets = 0;
  let completedSets = 0;
  
  workout?.exercises.forEach(ex => {
    const progress = getExerciseProgress(workoutKey, ex.id);
    if (progress?.skipped) {
      // Skip this exercise entirely - don't count its sets in total
      return;
    }
    totalSets += ex.targetSets || 0;
    completedSets += progress?.sets.filter(set => set.completed).length || 0;
  });
  
  const completionPercentage = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
  
  if (!workout) {
    return (
      <View style={styles.gradient}>
        <View style={styles.container}>
          <Text style={styles.errorText}>Workout not found</Text>
        </View>
      </View>
    );
  }
  
  const handleExerciseComplete = (exerciseId: string) => {
    if (!completedExercises.includes(exerciseId)) {
      setCompletedExercises([...completedExercises, exerciseId]);
    }
  };
  
  const handleFinishWorkout = async () => {
    console.log('🏁 Finishing workout...');
    console.log('   Workout key:', workoutKey);
    console.log('   Completion:', completionPercentage + '%');
    
    // Collect all completed sets from workout progress
    const allSets: any[] = [];
    
    if (workout) {
      workout.exercises.forEach((exercise) => {
        const progress = getExerciseProgress(workoutKey, exercise.id);
        if (progress && progress.sets) {
          const completedSets = progress.sets.filter(set => set.completed);
          console.log(`   Exercise ${exercise.exerciseId}: ${completedSets.length} completed sets`);
          
          completedSets.forEach((set) => {
            allSets.push({
              id: `${Date.now()}-${exercise.id}-${set.setNumber}`,
              sessionId: Date.now().toString(),
              exerciseId: exercise.exerciseId,
              setIndex: set.setNumber - 1,
              weight: set.weight,
              reps: set.reps,
              isCompleted: true,
            });
          });
        }
      });
    }
    
    console.log(`   Total sets to save: ${allSets.length}`);
    
    // Create workout session with all completed sets
    const session = {
      id: Date.now().toString(),
      cycleId,
      workoutTemplateId,
      date,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      sets: allSets,
    };
    
    await addSession(session);
    console.log('✅ Session saved!');
    
    // Clear the workout progress for this workout
    await clearWorkoutProgress(workoutKey);
    console.log('🧹 Progress cleared');
    
    navigation.goBack();
  };
  
  const handleCompleteWorkout = async () => {
    setShowMenu(false);
    
    Alert.alert(
      'Complete Workout',
      'Mark all exercises and sets as complete?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Complete',
          style: 'default',
          onPress: async () => {
            if (!workout) return;
            
            // Mark all exercises and all their sets as completed
            for (const exercise of workout.exercises) {
              // Get existing progress to preserve any user-set values
              const existingProgress = getExerciseProgress(workoutKey, exercise.id);
              
              // Skip if exercise is already marked as skipped
              if (existingProgress?.skipped) {
                continue;
              }
              
              const sets = [];
              
              for (let i = 0; i < exercise.targetSets; i++) {
                // If there's existing progress for this set, use it; otherwise use defaults
                const existingSet = existingProgress?.sets?.[i];
                sets.push({
                  setNumber: i + 1,
                  weight: existingSet?.weight || exercise.targetWeight || 0,
                  reps: existingSet?.reps || exercise.targetRepsMax || 0,
                  completed: true,
                  completedAt: new Date().toISOString(),
                });
              }
              
              await saveExerciseProgress(workoutKey, exercise.id, {
                exerciseId: exercise.exerciseId,
                sets,
              });
            }
            
            // Show success feedback
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };
  
  const handleResetWorkout = async () => {
    setShowMenu(false);
    
    Alert.alert(
      'Reset Progress',
      'Clear all progress for this workout? This cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            if (!workout) return;
            
            // Clear the entire workout progress so exercises reinitialize with default values
            await clearWorkoutProgress(workoutKey);
            
            // Show feedback
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  };
  
  
  return (
    <View style={styles.gradient}>
      <View style={styles.container}>
        {/* Header (includes topBar with back/menu + title) */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          {/* Back Button and Menu Button */}
          <View style={styles.topBar}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()} 
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
            <View style={styles.headerLeft}>
              <View style={styles.titleContainer}>
                <Text style={styles.headerTitle}>{workout.name}</Text>
                {completionPercentage > 0 && (
                  <Text style={styles.completionText}>{completionPercentage}% complete</Text>
                )}
              </View>
            </View>
          </View>
        </View>
        
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {/* Exercises List */}
          <View style={styles.exercisesList}>
            {(() => {
              // First, map and sort exercises
              const sortedExercises = workout.exercises
                .map((exercise, originalIndex) => ({ exercise, originalIndex }))
                .reduce((acc: any[], { exercise, originalIndex }) => {
                  const savedProgress = getExerciseProgress(workoutKey, exercise.id);
                  const isSkipped = savedProgress?.skipped || false;
                  
                  if (isSkipped) {
                    acc.push({ exercise, originalIndex, group: 'skipped' });
                  } else {
                    acc.push({ exercise, originalIndex, group: 'active' });
                  }
                  return acc;
                }, [])
                .sort((a, b) => {
                  // Separate active and skipped exercises
                  if (a.group !== b.group) {
                    return a.group === 'active' ? -1 : 1;
                  }
                  
                  // For active exercises, sort by completion state
                  if (a.group === 'active') {
                    const progressA = getExerciseProgress(workoutKey, a.exercise.id);
                    const progressB = getExerciseProgress(workoutKey, b.exercise.id);
                    
                    const completedSetsA = progressA?.sets.filter(set => set.completed).length || 0;
                    const completedSetsB = progressB?.sets.filter(set => set.completed).length || 0;
                    const totalSetsA = a.exercise.targetSets;
                    const totalSetsB = b.exercise.targetSets;
                    const isFullyCompletedA = completedSetsA === totalSetsA && totalSetsA > 0;
                    const isFullyCompletedB = completedSetsB === totalSetsB && totalSetsB > 0;
                    
                    // Determine sort order: completed (0), in-progress (1) - completed at top
                    const orderA = isFullyCompletedA ? 0 : 1;
                    const orderB = isFullyCompletedB ? 0 : 1;
                    
                    // If same order, maintain original order
                    if (orderA === orderB) return a.originalIndex - b.originalIndex;
                    
                    return orderA - orderB;
                  }
                  
                  // For skipped exercises, maintain original order
                  return a.originalIndex - b.originalIndex;
                });
              
              // Find the first in-progress exercise (first non-completed, non-skipped)
              const inProgressExerciseId = sortedExercises.find(({ exercise, group }) => {
                if (group === 'skipped') return false;
                const savedProgress = getExerciseProgress(workoutKey, exercise.id);
                const completedSets = savedProgress?.sets.filter(set => set.completed).length || 0;
                const totalSets = exercise.targetSets;
                return completedSets < totalSets;
              })?.exercise.id;
              
              return sortedExercises.map(({ exercise, originalIndex: index, group }, arrayIndex, array) => {
                // Add section header for skipped exercises
                const prevGroup = arrayIndex > 0 ? array[arrayIndex - 1].group : null;
                const showSkippedHeader = group === 'skipped' && prevGroup !== 'skipped';
                const exerciseData = exercises.find(e => e.id === exercise.exerciseId);
                
                // Get saved exercise progress to check completion
                const savedProgress = getExerciseProgress(workoutKey, exercise.id);
                
                // Debug: Log what we're checking
                console.log(`🔍 Checking ${exerciseData?.name}:`, {
                  exerciseId: exercise.id,
                  workoutKey,
                  hasProgress: !!savedProgress,
                  isSkipped: savedProgress?.skipped,
                });
                
                const isSkipped = savedProgress?.skipped || false;
                const completedSets = savedProgress?.sets.filter(set => set.completed).length || 0;
                const totalSets = exercise.targetSets;
                const isFullyCompleted = (completedSets === totalSets && totalSets > 0) || isSkipped;
                const isCurrentlyInProgress = exercise.id === inProgressExerciseId;
                
                // Check if any other exercise is in progress
                const isAnyExerciseInProgress = workout.exercises.some((ex, idx) => {
                  if (idx === index) return false; // Don't check current exercise
                  const prog = getExerciseProgress(workoutKey, ex.id);
                  if (prog?.skipped) return false; // Skipped exercises don't block others
                  const completed = prog?.sets.filter(set => set.completed).length || 0;
                  const total = ex.targetSets;
                  return completed > 0 && completed < total;
                });
                
                const isDisabled = isAnyExerciseInProgress && !isCurrentlyInProgress && !isFullyCompleted;
                
                const handleExerciseTap = () => {
                  if (isDisabled && !isSkipped) return;
                  
                  // If exercise is skipped, show dialog to activate it
                  if (isSkipped) {
                    Alert.alert(
                      'Reactivate Exercise',
                      `Do you want to reactivate ${exerciseData?.name || 'this exercise'}?`,
                      [
                        {
                          text: 'Cancel',
                          style: 'cancel',
                        },
                        {
                          text: 'Reactivate',
                          onPress: async () => {
                            console.log('🔄 Reactivating exercise:', exercise.id);
                            // Clear the entire progress for this exercise to reset it
                            const allProgress = useStore.getState().detailedWorkoutProgress;
                            const currentProgress = allProgress[workoutKey];
                            if (currentProgress) {
                              const { [exercise.id]: _, ...remainingExercises } = currentProgress.exercises;
                              const updatedProgress = {
                                ...currentProgress,
                                exercises: remainingExercises,
                                lastUpdated: new Date().toISOString(),
                              };
                              const newDetailedProgress = {
                                ...allProgress,
                                [workoutKey]: updatedProgress,
                              };
                              useStore.setState({ detailedWorkoutProgress: newDetailedProgress });
                              await storage.saveDetailedWorkoutProgress(newDetailedProgress);
                            }
                            console.log('✅ Exercise reactivated');
                          },
                        },
                      ]
                    );
                    return;
                  }
                  
                  // Normal navigation for non-skipped exercises
                  setCurrentExerciseIndex(index);
                  navigation.navigate('ExerciseDetail', {
                    exercise,
                    exerciseName: exerciseData?.name || 'Exercise',
                    workoutName: workout.name,
                    workoutKey: `${workoutTemplateId}-${date}`,
                    cycleId,
                    workoutTemplateId,
                  });
                };
                
                return (
                  <React.Fragment key={exercise.id}>
                    {/* Skipped Section Header */}
                    {showSkippedHeader && (
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionHeaderText}>Skipped</Text>
                      </View>
                    )}
                    
                    {/* Exercise Card */}
                    <View style={styles.exerciseCardWrapper}>
                      <View style={[
                        isSkipped ? CARDS.cardDeepDisabled.outer : isCurrentlyInProgress ? CARDS.cardDeep.outer : CARDS.cardDeepDimmed.outer,
                        pressedExerciseId === exercise.id && styles.exerciseCardPressed
                      ]}>
                            <TouchableOpacity
                          style={[
                            isSkipped ? { ...CARDS.cardDeepDisabled.inner, ...styles.exerciseCardInnerBase } : 
                            isCurrentlyInProgress ? { ...CARDS.cardDeep.inner, ...styles.exerciseCardInnerBase } : 
                            { ...CARDS.cardDeepDimmed.inner, ...styles.exerciseCardInnerBase }
                          ]}
                              onPress={handleExerciseTap}
                              onPressIn={() => setPressedExerciseId(exercise.id)}
                              onPressOut={() => setPressedExerciseId(null)}
                              activeOpacity={1}
                              disabled={isDisabled && !isSkipped}
                            >
                              <View style={styles.exerciseInfo}>
                                <View>
                              <Text style={[styles.exerciseName, isSkipped && styles.exerciseNameSkipped]}>
                                    {exerciseData?.name || 'Unknown Exercise'}
                                  </Text>
                                </View>
                              </View>
                              {isSkipped ? (
                                <View style={styles.exerciseCheckIcon}>
                              <IconRestart size={24} color={COLORS.text} />
                                </View>
                              ) : isFullyCompleted ? (
                                <View style={styles.exerciseCheckIcon}>
                                  <IconCheck size={24} color="#227132" />
                                </View>
                              ) : (
                                <View style={isCurrentlyInProgress ? styles.exerciseTriangle : styles.exerciseTriangleDimmed} />
                              )}
                            </TouchableOpacity>
                      </View>
                    </View>
                  </React.Fragment>
                );
              });
            })()}
          </View>
        </ScrollView>
        
      
      <SetTimerSheet
        visible={showTimer}
        onComplete={() => {
          setShowTimer(false);
          handleExerciseComplete(workout.exercises[currentExerciseIndex]?.id);
        }}
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
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate('WorkoutEdit', {
                    cycleId,
                    workoutTemplateId,
                    date,
                  });
                }}
                activeOpacity={1}
              >
                <Text style={styles.menuItemText}>Edit</Text>
              </TouchableOpacity>
              
              <View style={styles.menuDivider} />
              
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={handleCompleteWorkout}
                activeOpacity={1}
              >
                <Text style={styles.menuItemText}>Mark as complete</Text>
              </TouchableOpacity>
              
              <View style={styles.menuDivider} />
              
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={handleResetWorkout}
                activeOpacity={1}
              >
                <Text style={[styles.menuItemText, styles.menuItemTextDestructive]}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
      </View>
    </View>
  );
}

const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  backgroundContainer: '#CDCABB',
  secondary: '#1B1B1B',
  textSecondary: '#3C3C43',
  textMeta: '#817B77',
  border: '#C7C7CC',
  divider: 'rgba(0, 0, 0, 0.1)',
};

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
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  titleContainer: {
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    color: LIGHT_COLORS.secondary,
    marginLeft: 0,
  },
  completionText: {
    fontSize: 15,
    fontWeight: '400',
    color: LIGHT_COLORS.textMeta,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100, // Extra padding for fixed Add Exercise button
    paddingTop: SPACING.md,
  },
  exercisesList: {
    backgroundColor: 'transparent',
    gap: 12, // Space between cards
  },
  sectionHeader: {
    marginTop: 40,
    marginBottom: 4,
  },
  sectionHeaderText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
  },
  // Exercise Card Shadows (matching Today screen workout card)
  exerciseCardWrapper: {
    width: '100%',
  },
  exerciseCardPressed: {
    borderColor: '#817B77', // textMeta
  },
  exerciseCardInnerBase: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseName: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.secondary,
  },
  exerciseNameSkipped: {
    color: COLORS.textMeta,
  },
  exerciseCheckIcon: {
    margin: -4,
  },
  exerciseTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 0,
    borderTopWidth: 4.5,
    borderBottomWidth: 4.5,
    borderLeftColor: '#000000',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  exerciseTriangleDimmed: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 0,
    borderTopWidth: 4.5,
    borderBottomWidth: 4.5,
    borderLeftColor: COLORS.textMeta,
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  errorText: {
    ...TYPOGRAPHY.body,
    color: COLORS.error,
    textAlign: 'center',
    padding: SPACING.xl,
  },
  timerDrawer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    elevation: 10,
  },
  timerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    pointerEvents: 'box-none',
  },
  timerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  timerSheet: {
    backgroundColor: '#E3E6E0', // backgroundCanvas
    paddingTop: 4,
    paddingHorizontal: 4,
    paddingBottom: 24,
    borderRadius: 24,
  },
  timerDisplayWrapper: {
    width: '100%',
    marginBottom: 24,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  timerDisplay: {
    borderRadius: 24,
    borderCurve: 'continuous',
    width: '100%',
    height: 200,
    alignItems: 'stretch',
    justifyContent: 'center',
    overflow: 'hidden',
    borderTopWidth: 3,
    borderTopColor: '#000000',
  },
  decorativeShape: {
    position: 'absolute',
    top: -150,
    right: -20,
    width: 60,
    height: 300,
    transform: [{ rotate: '135deg' }, { scaleX: -1 }, { scaleY: -1 }],
  },
  decorativeShape2: {
    position: 'absolute',
    top: -90,
    right: 23,
    width: 90,
    height: 300,
    transform: [{ rotate: '135deg' }, { scaleX: -1 }, { scaleY: -1 }],
  },
  timerLabel: {
    ...TYPOGRAPHY.legal,
    color: 'rgba(255, 255, 255, 0.5)',
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
  },
  timerTimeContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  timerTime: {
    fontSize: TYPOGRAPHY.timer.fontSize,
    lineHeight: TYPOGRAPHY.timer.fontSize,
    fontWeight: TYPOGRAPHY.timer.fontWeight,
    color: '#FFFFFF',
    letterSpacing: -2,
    textAlign: 'center',
    includeFontPadding: false,
    padding: 0,
    marginTop: 8,
  },
  timerControls: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    // borderWidth: 2,
    // borderColor: 'yellow',
    // backgroundColor: 'rgba(255,0,0,0.1)',
  },
  timerControlButtonTapTarget: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    // borderWidth: 1,
    // borderColor: 'red',
  },
  timerControlButtonContainer: {
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  timerControlButtonContainerPrimary: {
  },
  timerControlButton: {
    width: 64,
    height: 64,
    backgroundColor: '#212121',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerControlButtonPrimary: {
    backgroundColor: COLORS.accentPrimary,
    borderRadius: 14,
  },
  timerControlButtonText: {
    ...TYPOGRAPHY.body,
    color: '#FFFFFF',
    fontSize: 18,
  },
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
});


