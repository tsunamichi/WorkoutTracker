import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Easing, AppState, Modal, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { useStore } from '../store';
import * as storage from '../storage';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconArrowLeft, IconCheck, IconPlay, IconPause, IconMenu, IconRestart, IconAdd, IconEdit } from '../components/icons';
import { ActionSheet } from '../components/common/ActionSheet';
import { DiagonalLinePattern } from '../components/common/DiagonalLinePattern';
import { formatWeightForLoad } from '../utils/weight';
import dayjs from 'dayjs';
import { startRestTimer, updateRestTimer, endRestTimer, markRestTimerCompleted } from '../modules/RestTimerLiveActivity';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { SetTimerSheet } from '../components/timer/SetTimerSheet';
import { useTranslation } from '../i18n/useTranslation';

interface WorkoutExecutionScreenProps {
  route: {
    params: {
      workoutId?: string; // Scheduled workout ID
      cycleId?: string;
      workoutTemplateId: string;
      date: string;
      isLocked?: boolean;
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
      startRestTimer(
        workoutName || t('workoutsLabel'),
        exerciseName || t('exercise'),
        restTime,
        currentSet,
        totalSets
      ).then((activityId) => {
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
              <Text style={styles.timerControlButtonText}>{t('addFiveSeconds')}</Text>
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
              <Text style={styles.timerControlButtonText}>{t('skip')}</Text>
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
  const { workoutId, cycleId, workoutTemplateId, date } = route.params;
  const { cycles, exercises, addSession, getWorkoutCompletionPercentage, getExerciseProgress, saveExerciseProgress, clearWorkoutProgress, skipExercise, getWorkoutTemplate, getWarmupCompletion, getMainCompletion, getAccessoryCompletion, settings, completeWorkout, scheduledWorkouts, cyclePlans } = useStore();
  const { t } = useTranslation();
  const useKg = settings.useKg;
  const weightUnit = useKg ? 'kg' : 'lb';
  
  // Use scheduled workout ID if available, otherwise construct legacy key from template+date
  const workoutKey = workoutId || `${workoutTemplateId}-${date}`;
  
  console.log('🔑 WorkoutExecutionScreen workoutKey:', {
    workoutId,
    workoutKey,
    isScheduledWorkout: workoutKey?.startsWith('sw-'),
    date,
    workoutTemplateId,
  });
  
  const [completedExercises, setCompletedExercises] = useState<string[]>([]);
  const [showTimer, setShowTimer] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Force refresh when screen comes into focus (but NOT on every progress change to avoid re-renders)
  useFocusEffect(
    useCallback(() => {
      console.log('📱 Workout screen focused - refreshing exercise states');
      setRefreshKey(prev => prev + 1); // Force refresh of completion status
    }, [])
  );
  
  // Get completion status for each section (these are getters, not subscriptions, so they don't cause re-renders)
  const warmupCompletion = getWarmupCompletion(workoutKey);
  const mainCompletion = getMainCompletion(workoutKey);
  const coreCompletion = getAccessoryCompletion(workoutKey);
  
  // Support both old cycle-based workouts and new standalone workouts
  const cycle = cycleId ? cycles.find(c => c.id === cycleId) : null;
  let workout = cycle?.workoutTemplates.find(w => w.id === workoutTemplateId);
  
  // If not found in cycle (or no cycle), try to get the template directly (new architecture)
  // Get template for warmup items
  const template = getWorkoutTemplate(workoutTemplateId);
  if (!workout) {
    if (template) {
      // Convert WorkoutTemplate to old workout format for backward compatibility
      workout = {
        id: template.id,
        cycleId: cycleId || '',
        name: template.name,
        workoutType: 'Other' as const,
        dayOfWeek: 0,
        orderIndex: 0,
        exercises: template.items.map(item => ({
          id: item.exerciseId,
          exerciseId: item.exerciseId,
          orderIndex: item.order,
          targetSets: item.sets,
          targetRepsMin: item.reps,
          targetRepsMax: item.reps,
          targetWeight: item.weight || 0,
          progressionType: 'none' as const,
        })),
      };
    }
  }
  
  // Calculate completion percentage - ONLY main strength exercises count
  // Warmup and core/accessory exercises don't affect completion percentage
  const completionPercentage = mainCompletion.percentage;

  // Check if this workout belongs to a past (non-active) cycle
  const isInPastCycle = React.useMemo(() => {
    const sw = scheduledWorkouts.find(w => w.id === workoutId);
    if (!sw || sw.source !== 'cycle') return false;
    const planId = sw.programId || sw.cyclePlanId;
    if (!planId) return false;
    const plan = cyclePlans.find(p => p.id === planId);
    return plan ? !plan.active : false;
  }, [scheduledWorkouts, cyclePlans, workoutId]);
  
  if (!workout) {
    return (
      <View style={styles.gradient}>
        <View style={styles.container}>
          <Text style={styles.errorText}>{t('workoutNotFound')}</Text>
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
    
    console.log('🎯 handleCompleteWorkout called');
    console.log('   workout:', workout ? 'exists' : 'UNDEFINED');
    console.log('   workoutKey:', workoutKey);
    console.log('   template:', template ? 'exists' : 'undefined');
    
    Alert.alert(
      t('completeWorkoutTitle'),
      t('completeWorkoutMessage'),
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('complete'),
          style: 'default',
          onPress: async () => {
            console.log('🔵 Complete button pressed in alert');
            console.log('   workout at callback:', workout ? 'exists' : 'UNDEFINED');
            
            if (!workout) {
              console.error('❌ Workout is undefined, cannot complete');
              Alert.alert('Error', 'Cannot complete workout: workout data not found');
              return;
            }
            
            console.log('🏁 Completing workout:', workoutKey);
            
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
            
            // Collect all completed sets for session (including warmup/core that were saved earlier)
            const allSets: any[] = [];
            
            // Get main exercise sets
            workout.exercises.forEach((exercise) => {
              const progress = getExerciseProgress(workoutKey, exercise.id);
              if (progress && progress.sets && !progress.skipped) {
                const completedSets = progress.sets.filter(set => set.completed);
                console.log(`   Exercise ${exercise.exerciseId}: ${completedSets.length} completed sets`);
                
                completedSets.forEach((set) => {
                  allSets.push({
                    id: `${Date.now()}-${exercise.id}-${set.setNumber}`,
                    sessionId: Date.now().toString(),
                    exerciseId: exercise.exerciseId,
                    setNumber: set.setNumber,
                    weight: set.weight,
                    reps: set.reps,
                    isCompleted: true,
                  });
                });
              }
            });
            
            console.log(`   Total main sets: ${allSets.length}`);
            
            // Create workout session with all completed sets
            if (allSets.length > 0) {
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
              console.log('✅ Session saved with', allSets.length, 'sets');
            }
            
            // Mark workout as complete (keep progress data for viewing)
            if (workoutKey?.startsWith('sw-')) {
              console.log('🎉 Marking workout as complete:', workoutKey);
              await completeWorkout(workoutKey);
              console.log('✅ Workout marked as complete (progress preserved)');
            }
            
            // Show success feedback
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // Navigate back
            navigation.goBack();
          },
        },
      ]
    );
  };
  
  const handleResetWorkout = async () => {
    setShowMenu(false);
    
    Alert.alert(
      t('resetProgressTitle'),
      t('resetProgressMessage'),
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('reset'),
          style: 'destructive',
          onPress: async () => {
            if (!workout) return;
            
            // Clear the entire workout progress so exercises reinitialize with default values
            await clearWorkoutProgress(workoutKey);
            
            // Force refresh of completion status
            setRefreshKey(prev => prev + 1);
            
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
              <IconArrowLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            {isInPastCycle ? null : completionPercentage === 100 ? (
              <TouchableOpacity 
                onPress={handleResetWorkout} 
                style={styles.resetButton}
                activeOpacity={1}
              >
                <Text style={styles.resetButtonText}>{t('reset')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                onPress={() => setShowMenu(true)} 
                style={styles.menuButton}
                activeOpacity={1}
              >
                <IconMenu size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Title */}
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.titleContainer}>
                <Text style={styles.headerTitle}>{workout.name}</Text>
              </View>
            </View>
          </View>
        </View>
        
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} bounces={false}>
          {/* Main Workout Card */}
          <View style={styles.summaryCardsContainer}>
            {template?.items && template.items.length > 0 && (
              <TouchableOpacity
                style={styles.summaryCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  (navigation as any).navigate('ExerciseExecution', { 
                    workoutKey, 
                    workoutTemplateId,
                    type: 'main'
                  });
                }}
                activeOpacity={0.7}
              >
                <View style={styles.summaryCardContent}>
                  <Text style={styles.summaryCardTitle}>{workout?.name || template.name}</Text>
                  <Text style={styles.summaryCardSubtitle}>
                    {template.items.length} {template.items.length === 1 ? 'exercise' : 'exercises'}
                  </Text>
                </View>
                {mainCompletion.percentage === 100 ? (
                  <View style={styles.summaryCardCompleteIcon}>
                    <IconCheck size={20} color={COLORS.successBright} />
                  </View>
                ) : mainCompletion.percentage > 0 ? (
                  <View style={styles.progressIndicator}>
                    <Text style={styles.progressText}>{mainCompletion.percentage}%</Text>
                    <Svg height="16" width="16" viewBox="0 0 16 16" style={styles.progressCircle}>
                      <Circle cx="8" cy="8" r="8" fill={COLORS.backgroundCanvas} />
                      <Path
                        d={`M 8 8 L 8 0 A 8 8 0 ${mainCompletion.percentage / 100 > 0.5 ? 1 : 0} 1 ${
                          8 + 8 * Math.sin(2 * Math.PI * (mainCompletion.percentage / 100))
                        } ${
                          8 - 8 * Math.cos(2 * Math.PI * (mainCompletion.percentage / 100))
                        } Z`}
                        fill={COLORS.signalWarning}
                      />
                    </Svg>
                  </View>
                ) : (
                  <Text style={styles.summaryCardAction}>{t('start')}</Text>
                )}
              </TouchableOpacity>
            )}
            
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
      
      {/* Action Sheet Menu */}
      <ActionSheet
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        items={[
          { 
            icon: <IconRestart size={24} color={COLORS.signalNegative} />,
            label: t('reset'), 
            onPress: handleResetWorkout,
            destructive: true 
          },
        ]}
      />
      </View>
    </View>
  );
}

const LIGHT_COLORS = {
  backgroundCanvas: '#0D0D0D',
  backgroundContainer: '#1C1C1E',
  secondary: '#FFFFFF',
  textSecondary: '#AEAEB2',
  textMeta: '#8E8E93',
  border: '#38383A',
  divider: COLORS.borderDimmed,
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
  resetButton: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: '#DC3545',
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
    marginLeft: 0,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
    paddingTop: SPACING.md,
  },
  // Summary Cards
  summaryCardsContainer: {
    gap: SPACING.lg,
  },
  topCardsRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  halfWidthCard: {
    flex: 1,
    aspectRatio: 1,
    ...CARDS.cardDeep.outer,
    padding: SPACING.lg,
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  halfWidthAddButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: BORDER_RADIUS.lg,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    overflow: 'hidden',
  },
  summaryCard: {
    ...CARDS.cardDeep.outer,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryCardContent: {
    flex: 1,
  },
  summaryCardTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    marginBottom: 4,
  },
  summaryCardSubtitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  summaryCardAction: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
    marginLeft: SPACING.md,
  },
  summaryCardProgress: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
    marginLeft: SPACING.md,
  },
  summaryCardCompleteIcon: {
    marginLeft: SPACING.md,
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: SPACING.md,
  },
  squareCardProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressCircle: {
    // No additional styling needed
  },
  progressText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  addCardButton: {
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    overflow: 'hidden',
  },
  addCardText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  warmupSection: {
    marginBottom: SPACING.xxxl,
  },
  warmupCard: {
    backgroundColor: CARDS.cardDeepDimmed.outer.backgroundColor,
    borderRadius: CARDS.cardDeepDimmed.outer.borderRadius,
    borderWidth: CARDS.cardDeepDimmed.outer.borderWidth,
    borderColor: CARDS.cardDeepDimmed.outer.borderColor,
    padding: SPACING.lg,
  },
  warmupCardComplete: {
    backgroundColor: COLORS.activeCard,
    opacity: 0.7,
  },
  warmupCardDisabled: {
    opacity: 0.4,
  },
  warmupCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  warmupCardLeft: {
    flex: 1,
    marginRight: SPACING.md,
  },
  warmupCardTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  warmupCardTitleDisabled: {
    color: COLORS.textMeta,
  },
  warmupStartText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
  },
  warmupCardSubtitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  warmupCheckCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.borderDimmed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warmupCheckCircleComplete: {
    backgroundColor: COLORS.accentPrimary,
    borderColor: COLORS.accentPrimary,
  },
  // Accessories Section (mirrors warmup)
  accessorySection: {
    marginTop: SPACING.xxxl,
  },
  accessoryCard: {
    backgroundColor: CARDS.cardDeepDimmed.outer.backgroundColor,
    borderRadius: CARDS.cardDeepDimmed.outer.borderRadius,
    borderWidth: CARDS.cardDeepDimmed.outer.borderWidth,
    borderColor: CARDS.cardDeepDimmed.outer.borderColor,
    padding: SPACING.lg,
  },
  accessoryCardComplete: {
    backgroundColor: COLORS.activeCard,
    opacity: 0.7,
  },
  accessoryCardDisabled: {
    opacity: 0.4,
  },
  accessoryCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accessoryCardTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  accessoryCardTitleDisabled: {
    color: COLORS.textMeta,
  },
  accessoryStartText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
  },
  sectionHeader: {
    marginTop: 40,
    marginBottom: 4,
  },
  sectionHeaderText: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
  },
  // Exercise Card Shadows (matching Today screen workout card)
  exerciseCardWrapper: {
    width: '100%',
  },
  exerciseCardInnerBase: {
    paddingHorizontal: 16,
    paddingVertical: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseInfo: {
    flex: 1,
    flexDirection: 'column',
    gap: SPACING.xs,
  },
  exerciseNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  exerciseName: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.secondary,
  },
  cycleBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.accentPrimaryDimmed,
    borderWidth: 1,
    borderColor: COLORS.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleBadgeText: {
    ...TYPOGRAPHY.meta,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.accentPrimary,
  },
  cycleHintText: {
    ...TYPOGRAPHY.meta,
    fontSize: 11,
    color: COLORS.textMeta,
  },
  exerciseNameSkipped: {
    color: COLORS.textMeta,
  },
  exerciseCheckIcon: {
    margin: -4,
  },
  exerciseStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inProgressLabel: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
    minWidth: 30,
    textAlign: 'right',
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
    backgroundColor: '#0D0D0D', // backgroundCanvas
    paddingTop: 4,
    paddingHorizontal: 4,
    paddingBottom: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.activeCard,
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
    borderTopColor: '#FFFFFF',
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
});


