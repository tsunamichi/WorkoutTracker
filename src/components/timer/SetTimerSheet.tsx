import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import Svg, { Path } from 'react-native-svg';
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

const REST_COLOR_YELLOW = COLORS.signalWarning;
const REST_COLOR_RED = COLORS.signalNegative;
const EXERCISE_COLOR_BLUE = '#1B1B1B'; // Black for exercise timer
const PRE_EXERCISE_COUNTDOWN = 5;
  const COUNTDOWN_COLORS = [COLORS.text, COLORS.text, COLORS.text, COLORS.text, COLORS.text];
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
  const restTime = settings.restTimerDefaultSeconds;
  
  // Determine initial time based on timer phase
  const getInitialTime = () => {
    if (isExerciseTimerPhase) {
      return exerciseDuration; // Use exercise duration for exercise timer
    }
    return restTime;
  };
  
  const [timeLeft, setTimeLeft] = useState(getInitialTime);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [labelWidth, setLabelWidth] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<'exercise' | 'rest'>(isExerciseTimerPhase ? 'exercise' : 'rest'); // Track phase internally
  const [preCountdown, setPreCountdown] = useState(0);
  
  const slideAnim = useRef(new Animated.Value(0)).current;
  const sizeAnim = useRef(new Animated.Value(1)).current; // 1 = 100%, 0 = MIN_SIZE
  const breathingAnim = useRef(new Animated.Value(1)).current; // For breathing animation (1 = 100%, 0.92 = 92%)
  const restColorAnim = useRef(new Animated.Value(0)).current; // For yellow to red transition (0 = yellow, 1 = red)
  const borderRadiusAnim = useRef(new Animated.Value(CONTAINER_WIDTH * 0.24)).current; // Squircle for exercise, circle for rest
  const endTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const preCountdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const liveActivityIdRef = useRef<string | null>(null);
  const countdownSoundRef = useRef<Audio.Sound | null>(null);
  const [wedgeAnimKey, setWedgeAnimKey] = useState(0);
  const countdownWedgeColors = useMemo(
    () => COUNTDOWN_COLORS.map(() => new Animated.Value(0)),
    [wedgeAnimKey]
  );
  const AnimatedPath = useRef(Animated.createAnimatedComponent(Path)).current;
  const completeSoundRef = useRef<Audio.Sound | null>(null);
  const lastPlayedSecondRef = useRef<number | null>(null);
  const prevVisibleRef = useRef(visible);
  const isInitializedRef = useRef(false);

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
      duration: 450,
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

  const startExerciseTimer = useCallback(() => {
    const duration = exerciseDuration;
    setPreCountdown(-1);
    setTimeLeft(duration);
    endTimeRef.current = Date.now() + duration * 1000;
    setIsRunning(true);
    lastPlayedSecondRef.current = null;
  }, [exerciseDuration]);

  const playCountdownTick = useCallback((remaining: number) => {
    if (!soundEnabled) return;
    if ((remaining === 3 || remaining === 2 || remaining === 1) && lastPlayedSecondRef.current !== remaining) {
      lastPlayedSecondRef.current = remaining;
      if (countdownSoundRef.current) {
        countdownSoundRef.current.setPositionAsync(0).then(() => {
          return countdownSoundRef.current?.playAsync();
        }).catch((error) => {
          console.log('⚠️ Error playing countdown sound:', error);
        });
      }
    }
  }, [soundEnabled]);

  // Handle visibility changes - ONLY initialize when drawer opens (visible goes from false to true)
  useEffect(() => {
    const isOpening = visible && !prevVisibleRef.current;
    const isClosing = !visible && prevVisibleRef.current;
    
    if (isOpening) {
      // Drawer is opening - initialize timer
      isInitializedRef.current = true;
      
      // Set initial phase
      const initialPhase = isExerciseTimerPhase ? 'exercise' : 'rest';
      setCurrentPhase(initialPhase);
      
      // Determine the initial time based on phase
      let initialTime;
      
      if (isExerciseTimerPhase) {
        // Exercise timer: use exercise duration after pre-countdown
        initialTime = exerciseDuration;
      } else {
        // Rest timer: use default rest time
        initialTime = restTime;
      }
      
      setTimeLeft(initialTime);
      endTimeRef.current = null;
      setIsRunning(false);
      lastPlayedSecondRef.current = null;
      
      // Only start Live Activity for rest timer, not exercise timer
      if (!isExerciseTimerPhase) {
        endTimeRef.current = Date.now() + initialTime * 1000;
        setIsRunning(true);
        startRestTimer(workoutName || 'Workout', exerciseName || 'Exercise', restTime, currentSet, totalSets).then((activityId) => {
          if (activityId) {
            liveActivityIdRef.current = activityId;
          }
        });
      } else {
        // Start 5-second pre-countdown before exercise timer
        if (preCountdownIntervalRef.current) {
          clearInterval(preCountdownIntervalRef.current);
        }
        setPreCountdown(PRE_EXERCISE_COUNTDOWN);
        preCountdownIntervalRef.current = setInterval(() => {
          setPreCountdown(prev => {
            const next = prev - 1;
            if (next < 0) {
              if (preCountdownIntervalRef.current) {
                clearInterval(preCountdownIntervalRef.current);
                preCountdownIntervalRef.current = null;
              }
              setPreCountdown(-1);
              startExerciseTimer();
              return -1;
            }
            playCountdownTick(next);
            return next;
          });
        }, 1000);
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
    } else if (isClosing) {
      // Drawer is closing - cleanup
      isInitializedRef.current = false;
      
      setTimeLeft(restTime);
      setIsRunning(false);
      setPreCountdown(0);
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
    
    // Update previous visible ref
    prevVisibleRef.current = visible;
    
    return () => {
      if (preCountdownIntervalRef.current) {
        clearInterval(preCountdownIntervalRef.current);
        preCountdownIntervalRef.current = null;
      }
      if (liveActivityIdRef.current) {
        endRestTimer();
        liveActivityIdRef.current = null;
      }
    };
  }, [visible, isExerciseTimerPhase, exerciseDuration, restTime, slideAnim, sizeAnim, breathingAnim, restColorAnim, workoutName, exerciseName, currentSet, totalSets, playCountdownTick, startExerciseTimer]);

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
      
      playCountdownTick(remaining);
      
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
    
    // Handle skip differently based on current phase
    if (currentPhase === 'exercise') {
      // Exercise phase: mark set complete and transition to rest
      if (onExerciseTimerComplete) {
        onExerciseTimerComplete();
      }
      
      // Transition to rest phase
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
      // Rest phase: close the timer
      animateOutAndClose(onComplete);
    }
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

  const isPreCountdownActive = preCountdown >= 0 && currentPhase === 'exercise';

  useEffect(() => {
    if (isPreCountdownActive && preCountdown === PRE_EXERCISE_COUNTDOWN) {
      setWedgeAnimKey(prev => prev + 1);
    }
  }, [isPreCountdownActive, preCountdown]);

  useEffect(() => {
    if (!isPreCountdownActive) {
      countdownWedgeColors.forEach(color => color.setValue(0));
      return;
    }

    const visibleCount = Math.max(0, Math.min(PRE_EXERCISE_COUNTDOWN, preCountdown));
    const startIndex = Math.max(0, COUNTDOWN_COLORS.length - visibleCount);

    Animated.parallel(
      countdownWedgeColors.map((color, index) =>
        Animated.timing(color, {
          toValue: index >= startIndex ? 0 : 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        })
      )
    ).start();
  }, [preCountdown, isPreCountdownActive, countdownWedgeColors]);

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
          {/* Next set indicator */}
          <View style={styles.setIndicator}>
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
              {/* Circle/Squircle background */}
              {isPreCountdownActive ? (
                <Svg width={100} height={100} viewBox="0 0 203 195">
                  {(() => {
                    // Order: top-left first, top-right last.
                    const paths = [
                      'M98.9364 102.129L1.78409 70.5625C2.16584 69.7229 2.60513 68.9077 3.10245 68.124C5.14672 64.9028 8.52616 62.4465 15.286 57.5352L82.2841 8.8584C89.0441 3.94698 92.4247 1.49079 96.12 0.541992C97.0483 0.303667 97.9897 0.134931 98.9364 0.0322266V102.129Z',
                      'M97.6991 105.934L37.4228 188.897C36.7597 188.287 36.1356 187.631 35.5575 186.933C33.1258 183.993 31.8348 180.02 29.2528 172.073L3.66202 93.3125C1.07994 85.3657 -0.211326 81.3917 0.0282325 77.584C0.0969806 76.4916 0.255943 75.4108 0.499912 74.3516L97.6991 105.934Z',
                      'M161.345 191.43C160.462 191.948 159.539 192.401 158.581 192.78C155.034 194.185 150.856 194.185 142.501 194.185H59.6864C51.3307 194.185 47.1527 194.185 43.6054 192.78C42.5678 192.369 41.5713 191.872 40.623 191.299L100.936 108.285L161.345 191.43Z',
                      'M201.663 74.2568C201.92 75.3465 202.088 76.4588 202.159 77.584C202.399 81.3917 201.107 85.3657 198.525 93.3125L172.934 172.073C170.352 180.02 169.061 183.993 166.629 186.933C165.996 187.698 165.307 188.411 164.573 189.069L104.173 105.934L201.663 74.2568Z',
                      'M102.936 0C103.989 0.0974266 105.036 0.277265 106.067 0.541992C109.763 1.49079 113.142 3.94705 119.902 8.8584L186.9 57.5352C193.66 62.4466 197.041 64.9027 199.085 68.124C199.565 68.8799 199.99 69.6655 200.362 70.4736L102.936 102.129V0Z',
                    ];
                    return paths.map((d, index) => (
                      <AnimatedPath
                        key={`pentagon-segment-${index}`}
                        d={d}
                        fill={countdownWedgeColors[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: [COLORS.text, COLORS.activeCard],
                        })}
                      />
                    ));
                  })()}
                </Svg>
              ) : (
                <Animated.View
                  style={[
                    styles.circle,
                    {
                      backgroundColor,
                      borderRadius: borderRadiusAnim,
                      transform: [{ scale: breathingAnim }],
                    },
                  ]}
                />
              )}
              
              {/* Text stays constant size, positioned absolutely on top */}
              {!isPreCountdownActive && (
                <Animated.View
                  style={[
                    styles.textContainer,
                    {
                      transform: [{ scale: textScale }],
                      zIndex: 10,
                    },
                  ]}
                >
                  <Text style={styles.timerText}>{formatTime()}</Text>
                </Animated.View>
              )}
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

