import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useStore } from '../../store';
import { SPACING, TYPOGRAPHY, COLORS } from '../../constants';
import { TimerControls } from './TimerControls';
import { IconChevronDown } from '../icons';
import { startRestTimer, endRestTimer, markRestTimerCompleted } from '../../modules/RestTimerLiveActivity';

interface SetTimerSheetProps {
  visible: boolean;
  onComplete: () => void;
  onClose: () => void;
  workoutName?: string;
  exerciseName?: string;
  currentSet?: number;
  totalSets?: number;
  exerciseId?: string;
  workoutKey?: string;
  isExerciseTimerPhase?: boolean; // If true, show exercise timer; if false, show rest timer
  exerciseDuration?: number; // Duration in seconds for exercise timer
  onExerciseTimerComplete?: () => void; // Callback when exercise timer completes
}

const REST_COLOR_YELLOW = '#FFCC00'; // Yellow for rest
const REST_COLOR_RED = '#FF6B6B'; // Red for rest (under 5 seconds)
const EXERCISE_COLOR_BLUE = '#062FFF'; // Blue for exercise timer
const MIN_SIZE = 180;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CONTAINER_WIDTH = SCREEN_WIDTH - 96; // 48px padding on each side

export function SetTimerSheet({ 
  visible, 
  onComplete, 
  onClose, 
  workoutName, 
  exerciseName, 
  currentSet = 1, 
  totalSets = 1,
  exerciseId,
  workoutKey,
  isExerciseTimerPhase = false,
  exerciseDuration = 0,
  onExerciseTimerComplete
}: SetTimerSheetProps) {
  const insets = useSafeAreaInsets();
  const { settings } = useStore();
  const restTimerTimeLeft = useStore((state) => state.restTimerTimeLeft);
  const restTimerMinimized = useStore((state) => state.restTimerMinimized);
  const restTime = settings.restTimerDefaultSeconds;
  
  // Determine initial time based on timer phase
  const getInitialTime = () => {
    if (isExerciseTimerPhase) {
      return exerciseDuration; // Use exercise duration for exercise timer
    }
    // For rest timer, check if reopening from mini timer
    return restTimerTimeLeft > 0 && restTimerMinimized ? restTimerTimeLeft : restTime;
  };
  
  const [timeLeft, setTimeLeft] = useState(getInitialTime);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [labelWidth, setLabelWidth] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<'exercise' | 'rest'>(isExerciseTimerPhase ? 'exercise' : 'rest'); // Track phase internally
  
  const slideAnim = useRef(new Animated.Value(0)).current;
  const sizeAnim = useRef(new Animated.Value(1)).current; // 1 = 100%, 0 = MIN_SIZE
  const breathingAnim = useRef(new Animated.Value(1)).current; // For breathing animation (1 = 100%, 0.92 = 92%)
  const restColorAnim = useRef(new Animated.Value(0)).current; // For yellow to red transition (0 = yellow, 1 = red)
  const borderRadiusAnim = useRef(new Animated.Value(CONTAINER_WIDTH * 0.24)).current; // Squircle for exercise, circle for rest
  
  // Store actions for mini timer
  const setRestTimerMinimized = useStore((state) => state.setRestTimerMinimized);
  const setRestTimerData = useStore((state) => state.setRestTimerData);
  const clearRestTimerData = useStore((state) => state.clearRestTimerData);
  const endTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const liveActivityIdRef = useRef<string | null>(null);
  const countdownSoundRef = useRef<Audio.Sound | null>(null);
  const completeSoundRef = useRef<Audio.Sound | null>(null);
  const lastPlayedSecondRef = useRef<number | null>(null);

  const playCompletionAlert = useCallback(async () => {
    if (!soundEnabled) return;
    
    try {
      if (completeSoundRef.current) {
        await completeSoundRef.current.setPositionAsync(0);
        await completeSoundRef.current.playAsync();
      }
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(async () => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 200);
      setTimeout(async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 400);
    } catch (error) {
      console.log('⚠️ Error playing completion alert:', error);
    }
  }, [soundEnabled]);

  const animateOutAndClose = useCallback((callback: () => void) => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    }).start(() => {
      callback();
    });
  }, [slideAnim]);

  // Keep screen awake while timer is running
  useEffect(() => {
    if (visible && isRunning) {
      activateKeepAwakeAsync('rest-timer-running');
    } else {
      deactivateKeepAwake('rest-timer-running');
    }
    
    // Cleanup on unmount
    return () => {
      deactivateKeepAwake('rest-timer-running');
    };
  }, [visible, isRunning]);

  // Load audio files
  useEffect(() => {
    let mounted = true;
    
    async function loadSounds() {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        
        const { sound: countdownSound } = await Audio.Sound.createAsync(
          require('../../../assets/sounds/countdown.mp3'),
          { shouldPlay: false, volume: 1.0 }
        );
        if (mounted) countdownSoundRef.current = countdownSound;
        
        const { sound: completeSound } = await Audio.Sound.createAsync(
          require('../../../assets/sounds/complete.mp3'),
          { shouldPlay: false, volume: 1.0 }
        );
        if (mounted) completeSoundRef.current = completeSound;
      } catch (error) {
        console.log('⚠️ Error loading timer sounds:', error);
      }
    }
    
    loadSounds();
    
    return () => {
      mounted = false;
      if (countdownSoundRef.current) {
        countdownSoundRef.current.unloadAsync();
        countdownSoundRef.current = null;
      }
      if (completeSoundRef.current) {
        completeSoundRef.current.unloadAsync();
        completeSoundRef.current = null;
      }
    };
  }, []);

  // Animate size based on time remaining
  useEffect(() => {
    const totalTime = currentPhase === 'exercise' ? exerciseDuration : restTime;
    const progress = totalTime > 0 ? timeLeft / totalTime : 0;
    
    // Animate size smoothly based on progress
    Animated.timing(sizeAnim, {
      toValue: progress,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: false, // Changed to false for compatibility with breathing
    }).start();
  }, [timeLeft, currentPhase, exerciseDuration, restTime, sizeAnim]);

  // Breathing animation for rest phase only (not exercise phase)
  useEffect(() => {
    if (!isRunning || currentPhase === 'exercise') {
      breathingAnim.stopAnimation(() => {
        breathingAnim.setValue(1);
      });
      return;
    }

    // Start breathing animation during rest timer - breathe IN (contract, never expand beyond 100%)
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathingAnim, {
          toValue: 0.92, // Contract to 92% (breathe in)
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(breathingAnim, {
          toValue: 1, // Back to normal (100%)
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();

    return () => {
      breathingAnim.stopAnimation(() => {
        breathingAnim.setValue(1);
      });
    };
  }, [isRunning, currentPhase, breathingAnim]);

  // Yellow to red color transition when 5 seconds or less remain (rest phase only)
  useEffect(() => {
    if (currentPhase === 'rest' && timeLeft <= 5 && timeLeft > 0) {
      // Transition from yellow (0) to red (1)
      Animated.timing(restColorAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }).start();
    } else {
      // Reset to yellow when more than 5 seconds
      restColorAnim.setValue(0);
    }
  }, [timeLeft, currentPhase, restColorAnim]);

  // Border radius animation: squircle for exercise, circle for rest
  useEffect(() => {
    const targetRadius = currentPhase === 'exercise' ? CONTAINER_WIDTH * 0.24 : CONTAINER_WIDTH / 2;
    Animated.timing(borderRadiusAnim, {
      toValue: targetRadius,
      duration: 300,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      useNativeDriver: false,
    }).start();
  }, [currentPhase, borderRadiusAnim]);

  // Handle visibility changes - initialize on open
  useEffect(() => {
    if (visible) {
      // Set initial phase
      const initialPhase = isExerciseTimerPhase ? 'exercise' : 'rest';
      setCurrentPhase(initialPhase);
      
      // Determine the initial time based on phase
      let initialTime;
      let isRestoringFromMini = false;
      
      if (isExerciseTimerPhase) {
        // Exercise timer: use exercise duration
        initialTime = exerciseDuration;
      } else {
        // Rest timer: check if reopening from minimized state
        isRestoringFromMini = restTimerTimeLeft > 0 && !restTimerMinimized;
        initialTime = isRestoringFromMini ? restTimerTimeLeft : restTime;
      }
      
      setTimeLeft(initialTime);
      endTimeRef.current = Date.now() + initialTime * 1000;
      setIsRunning(true);
      lastPlayedSecondRef.current = null;
      
      // Only start Live Activity for rest timer, not exercise timer
      if (!isExerciseTimerPhase) {
        const timerDuration = isRestoringFromMini ? restTimerTimeLeft : restTime;
        startRestTimer(workoutName || 'Workout', exerciseName || 'Exercise', timerDuration, currentSet, totalSets).then((activityId) => {
          if (activityId) {
            liveActivityIdRef.current = activityId;
          }
        });
      }
      
      // Reset and animate in
      slideAnim.setValue(0);
      sizeAnim.setValue(1); // Start at 100%
      breathingAnim.setValue(1);
      restColorAnim.setValue(0); // Start with yellow (or will be blue for exercise)
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 20,
        velocity: 2,
      }).start();
    } else {
      setTimeLeft(restTime);
      setIsRunning(false);
      endTimeRef.current = null;
      setCurrentPhase('rest'); // Reset phase
      
      // Stop animations
      breathingAnim.stopAnimation(() => {
        breathingAnim.setValue(1);
      });
      restColorAnim.stopAnimation(() => {
        restColorAnim.setValue(0);
      });
      
      if (liveActivityIdRef.current) {
        endRestTimer();
        liveActivityIdRef.current = null;
      }
    }
    
    return () => {
      if (liveActivityIdRef.current) {
        endRestTimer();
        liveActivityIdRef.current = null;
      }
    };
  }, [visible, isExerciseTimerPhase, exerciseDuration, restTime, restTimerTimeLeft, restTimerMinimized, slideAnim, sizeAnim, breathingAnim, restColorAnim, workoutName, exerciseName, currentSet, totalSets]);

  // Timer logic
  useEffect(() => {
    if (!visible || !isRunning || !endTimeRef.current) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    
    const updateTimer = () => {
      if (!endTimeRef.current) return;
      
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
      
      setTimeLeft(remaining);
      
      if (soundEnabled && (remaining === 3 || remaining === 2 || remaining === 1) && lastPlayedSecondRef.current !== remaining) {
        lastPlayedSecondRef.current = remaining;
        if (countdownSoundRef.current) {
          countdownSoundRef.current.setPositionAsync(0).then(() => {
            return countdownSoundRef.current?.playAsync();
          }).catch((error) => {
            console.log('⚠️ Error playing countdown sound:', error);
          });
        }
      }
      
      if (remaining <= 0) {
        setIsRunning(false);
        endTimeRef.current = null;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        // Stop breathing and keep circle at completion color
        breathingAnim.stopAnimation(() => {
          breathingAnim.setValue(1);
        });
        
        playCompletionAlert();
        
        if (currentPhase === 'exercise') {
          // Exercise phase completed - transition to rest phase (same drawer)
          if (onExerciseTimerComplete) {
            onExerciseTimerComplete(); // Notify parent that set is complete
          }
          
          // Transition to rest phase internally
          setCurrentPhase('rest');
          const newTime = restTime;
          setTimeLeft(newTime);
          endTimeRef.current = Date.now() + newTime * 1000;
          setIsRunning(true);
          lastPlayedSecondRef.current = null;
          
          // Start Live Activity for rest phase
          startRestTimer(workoutName || 'Workout', exerciseName || 'Exercise', newTime, currentSet, totalSets).then((activityId) => {
            if (activityId) {
              liveActivityIdRef.current = activityId;
            }
          });
        } else {
          // Rest phase completed - close drawer
          restColorAnim.setValue(1);
          
          if (liveActivityIdRef.current) {
            markRestTimerCompleted();
          }
          
          // Dismiss immediately without delay
          if (liveActivityIdRef.current) {
            endRestTimer();
            liveActivityIdRef.current = null;
          }
          
          // Clear mini timer state on completion
          clearRestTimerData();
          
          animateOutAndClose(onComplete);
        }
      }
    };
    
    updateTimer();
    intervalRef.current = setInterval(updateTimer, 1000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, visible, currentPhase, restTime, onComplete, onExerciseTimerComplete, soundEnabled, animateOutAndClose, playCompletionAlert, workoutName, exerciseName, currentSet, totalSets]);

  // AppState listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && isRunning && endTimeRef.current) {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
        setTimeLeft(remaining);
        
        if (remaining <= 0) {
          setIsRunning(false);
          endTimeRef.current = null;
          
          // Stop breathing and keep circle at completion color
          breathingAnim.stopAnimation(() => {
            breathingAnim.setValue(1);
          });
          
          playCompletionAlert();
          
          if (currentPhase === 'exercise') {
            // Exercise phase completed - transition to rest phase (same drawer)
            if (onExerciseTimerComplete) {
              onExerciseTimerComplete(); // Notify parent that set is complete
            }
            
            // Transition to rest phase internally
            setCurrentPhase('rest');
            const newTime = restTime;
            setTimeLeft(newTime);
            endTimeRef.current = Date.now() + newTime * 1000;
            setIsRunning(true);
            lastPlayedSecondRef.current = null;
            
            // Start Live Activity for rest phase
            startRestTimer(workoutName || 'Workout', exerciseName || 'Exercise', newTime, currentSet, totalSets).then((activityId) => {
              if (activityId) {
                liveActivityIdRef.current = activityId;
              }
            });
          } else {
            // Rest phase completed - close drawer
            restColorAnim.setValue(1);
            
            if (liveActivityIdRef.current) {
              markRestTimerCompleted();
            }
            
            // Dismiss immediately without delay
            if (liveActivityIdRef.current) {
              endRestTimer();
              liveActivityIdRef.current = null;
            }
            
            // Clear mini timer state on completion
            clearRestTimerData();
            
            animateOutAndClose(onComplete);
          }
        }
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, [isRunning, currentPhase, restTime, onComplete, onExerciseTimerComplete, animateOutAndClose, playCompletionAlert, workoutName, exerciseName, currentSet, totalSets]);

  const handleTogglePause = () => {
    setIsRunning(prev => !prev);
  };

  const handleToggleSound = () => {
    setSoundEnabled(prev => !prev);
  };

  const handleSkip = () => {
    setIsRunning(false);
    endTimeRef.current = null;
    
    if (liveActivityIdRef.current) {
      endRestTimer();
      liveActivityIdRef.current = null;
    }
    
    // Clear mini timer state
    clearRestTimerData();
    
    animateOutAndClose(onComplete);
  };
  
  const handleMinimize = () => {
    // Save current timer state to store
    setRestTimerData(timeLeft, settings.restTimerDefaultSeconds, onComplete, exerciseId, workoutKey);
    setRestTimerMinimized(true);
    
    // Animate out the drawer
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 250,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    }).start(() => {
      // Close the full drawer after animation
      onClose();
    });
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

  // Calculate circle size based on animation progress
  const animatedScale = sizeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [MIN_SIZE / CONTAINER_WIDTH, 1],
  });

  // Inverse scale for text (keeps text size constant)
  const textScale = sizeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [CONTAINER_WIDTH / MIN_SIZE, 1],
  });

  // Interpolate color: blue for exercise timer, yellow to red for rest timer
  const backgroundColor = currentPhase === 'exercise'
    ? EXERCISE_COLOR_BLUE // Solid blue for exercise timer
    : restColorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [REST_COLOR_YELLOW, REST_COLOR_RED],
      });

  if (!visible) return null;

  return (
    <View style={styles.timerOverlay} pointerEvents="auto">
      <TouchableOpacity 
        style={styles.timerBackdrop} 
        activeOpacity={1}
        onPress={() => {}} // Block touches but don't close
      />
      
      <Animated.View 
        style={[
          styles.timerDrawer, 
          { 
            transform: [{ translateY }],
            paddingBottom: 8, // 8px from bottom of screen
          }
        ]}
      >
        <View style={[styles.timerSheet, { paddingBottom: 8 + insets.bottom }]}>
          {/* Next set indicator with minimize button */}
          <TouchableOpacity 
            style={styles.setIndicator}
            onPress={handleMinimize}
            activeOpacity={0.7}
          >
            <View 
              style={styles.labelWrapper}
              onLayout={(e) => setLabelWidth(e.nativeEvent.layout.width)}
            >
              {currentSet < totalSets ? (
                <Text style={styles.nextSetText}>
                  Next set <Text style={styles.nextSetNumber}>{currentSet + 1} out of {totalSets}</Text>
                </Text>
              ) : (
                <Text style={styles.nextSetText}>
                  Set <Text style={styles.nextSetNumber}>{currentSet} of {totalSets}</Text>
                </Text>
              )}
            </View>
            <View style={[styles.chevronWrapper, { 
              left: '50%',
              marginLeft: labelWidth > 0 ? (labelWidth / 2) + 16 : 0,
              top: -2
            }]}>
              <IconChevronDown size={24} color={COLORS.textMeta} />
            </View>
          </TouchableOpacity>

          {/* Animated Circle Timer */}
          <View style={styles.timerContainer}>
            <Animated.View
              style={[
                styles.circleContainer,
                {
                  transform: [{ scale: animatedScale }],
                },
              ]}
            >
              {/* Circle/Squircle background with breathing (only during rest) */}
              <Animated.View 
                style={[
                  styles.circle, 
                  { 
                    backgroundColor,
                    borderRadius: borderRadiusAnim,
                    transform: [{ scale: breathingAnim }],
                  }
                ]} 
              />
              
              {/* Text stays constant size, positioned absolutely on top */}
              <Animated.View
                style={[
                  styles.textContainer,
                  {
                    transform: [{ scale: textScale }],
                  },
                ]}
              >
                <Text style={styles.timerText}>{formatTime()}</Text>
              </Animated.View>
            </Animated.View>
          </View>

          {/* Controls */}
          <TimerControls
            isRunning={isRunning}
            soundEnabled={soundEnabled}
            onTogglePause={handleTogglePause}
            onToggleSound={handleToggleSound}
            onSkip={handleSkip}
            hideControlsWhenPaused={true}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  timerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    justifyContent: 'flex-end',
  },
  timerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  timerDrawer: {
    paddingHorizontal: 8,
  },
  timerSheet: {
    backgroundColor: COLORS.backgroundCanvas,
    borderRadius: 40,
    borderCurve: 'continuous',
    paddingTop: 32,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  setIndicator: {
    position: 'relative',
    width: '100%',
    marginBottom: 40,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  labelWrapper: {
    alignSelf: 'center',
  },
  chevronWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextSetText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  nextSetNumber: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  timerContainer: {
    width: CONTAINER_WIDTH,
    height: CONTAINER_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  circleContainer: {
    width: CONTAINER_WIDTH,
    height: CONTAINER_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    ...StyleSheet.absoluteFillObject,
    // borderRadius is animated, set in inline style
    borderCurve: 'continuous',
  },
  textContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  timerText: {
    fontSize: 56,
    color: '#FFFFFF',
    fontWeight: '300',
    fontFamily: 'System',
    textAlign: 'center',
  },
});

