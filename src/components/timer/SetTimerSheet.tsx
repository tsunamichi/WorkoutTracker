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
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useStore } from '../../store';
import { TYPOGRAPHY, COLORS } from '../../constants';
import { IconPause, IconPlay } from '../icons';
import { useTranslation } from '../../i18n/useTranslation';
import { COUNTDOWN_SOUND, COMPLETE_SOUND } from '../../utils/sounds';

// Optional local notifications (expo-notifications). If not installed, notifications are skipped.
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.log('⚠️ expo-notifications not installed, local notifications disabled');
}


interface SetTimerSheetProps {
  visible: boolean;
  onComplete: () => void;
  onClose: () => void;
  workoutName?: string;
  exerciseName?: string;
  currentSet?: number;
  totalSets?: number;
  nextExerciseName?: string; // Name of the next exercise (shown on last set)
  exerciseId?: string;
  workoutKey?: string;
  isExerciseTimerPhase?: boolean; // If true, show exercise timer; if false, show rest timer
  exerciseDuration?: number; // Duration in seconds for exercise timer
  onExerciseTimerComplete?: () => void; // Callback when exercise timer completes
  skipRestPhase?: boolean; // If true, skip rest phase after exercise timer completes
  isPerSide?: boolean; // If true, run exercise timer twice with 10s "switch sides" countdown between
  restTimeOverride?: number | null; // Local rest time override (seconds), null = use global setting
}

const PRE_EXERCISE_COUNTDOWN = 5;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONTAINER_WIDTH = SCREEN_WIDTH - 96; // 48px padding on each side



export function SetTimerSheet({ 
  visible, 
  onComplete, 
  onClose, 
  workoutName, 
  exerciseName, 
  currentSet = 1, 
  totalSets = 1,
  nextExerciseName,
  exerciseId,
  workoutKey,
  isExerciseTimerPhase = false,
  exerciseDuration = 0,
  onExerciseTimerComplete,
  skipRestPhase = false,
  isPerSide = false,
  restTimeOverride = null
}: SetTimerSheetProps) {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useStore();
  const { t } = useTranslation();
  const restTime = restTimeOverride ?? settings.restTimerDefaultSeconds;
  
  // Determine initial time based on timer phase
  const getInitialTime = () => {
    if (isExerciseTimerPhase) {
      return exerciseDuration; // Use exercise duration for exercise timer
    }
    return restTime;
  };
  
  const [timeLeft, setTimeLeft] = useState(getInitialTime);
  const [isRunning, setIsRunning] = useState(false);
  const soundEnabled = true;
  const [currentPhase, setCurrentPhase] = useState<'exercise' | 'rest' | 'switchSides'>(isExerciseTimerPhase ? 'exercise' : 'rest'); // Track phase internally
  const [preCountdown, setPreCountdown] = useState(-1);
  const [currentSide, setCurrentSide] = useState<'first' | 'second'>('first'); // Track which side we're on for per-side exercises
  const countdownOpacityAnim = useRef(new Animated.Value(1)).current;
  const countdownTextScaleAnim = useRef(new Animated.Value(1)).current;
  const exerciseEntryOpacity = useRef(new Animated.Value(1)).current;
  const exerciseEntryScale = useRef(new Animated.Value(1)).current;
  const prevPreCountdownRef = useRef(preCountdown);
  
  const slideAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const breathingAnim = useRef(new Animated.Value(1)).current; // For breathing animation (1 = 100%, 0.92 = 92%)
  const restColorAnim = useRef(new Animated.Value(0)).current; // For yellow to red transition (0 = yellow, 1 = red)
  const borderRadiusAnim = useRef(new Animated.Value(CONTAINER_WIDTH * 0.24)).current; // Squircle for exercise, circle for rest
  const endTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const preCountdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const notificationIdRef = useRef<string | null>(null);
  const pausedRemainingRef = useRef<number | null>(null);
  const countdownSoundRef = useRef<Audio.Sound | null>(null);
  const completeSoundRef = useRef<Audio.Sound | null>(null);
  const lastPlayedSecondRef = useRef<number | null>(null);
  const prevVisibleRef = useRef(visible);
  const isInitializedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

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
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      // Do NOT call callback in this stack. Schedule it for two frames + macrotask so we're fully outside the animation commit (fixes "useInsertionEffect must not schedule updates").
      const runLater = () => setTimeout(() => callback(), 0);
      requestAnimationFrame(() => {
        requestAnimationFrame(runLater);
      });
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
          COUNTDOWN_SOUND,
          { shouldPlay: false, volume: 1.0 }
        );
        if (mounted) countdownSoundRef.current = countdownSound;
        
        const { sound: completeSound } = await Audio.Sound.createAsync(
          COMPLETE_SOUND,
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

  const runExerciseEntryAnimation = useCallback(() => {
    exerciseEntryOpacity.stopAnimation();
    exerciseEntryScale.stopAnimation();
    exerciseEntryOpacity.setValue(0);
    exerciseEntryScale.setValue(0.4);
    borderRadiusAnim.setValue(CONTAINER_WIDTH * 0.24);
    Animated.parallel([
      Animated.timing(exerciseEntryOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(exerciseEntryScale, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [exerciseEntryOpacity, exerciseEntryScale, borderRadiusAnim]);

  // Entry animation for exercise timer (when countdown completes)
  useEffect(() => {
    if (currentPhase !== 'exercise') {
      exerciseEntryOpacity.setValue(1);
      exerciseEntryScale.setValue(1);
      prevPreCountdownRef.current = preCountdown;
      return;
    }

    const wasCountingDown = prevPreCountdownRef.current >= 0;
    if (wasCountingDown && preCountdown === -1) {
      runExerciseEntryAnimation();
    }

    prevPreCountdownRef.current = preCountdown;
  }, [
    currentPhase,
    preCountdown,
    runExerciseEntryAnimation,
    exerciseEntryOpacity,
    exerciseEntryScale,
  ]);

  const cancelTimerNotification = useCallback(async () => {
    if (!Notifications || !notificationIdRef.current) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
      notificationIdRef.current = null;
    } catch (error) {
      console.log('⚠️ Failed to cancel notification:', error instanceof Error ? error.message : error);
    }
  }, []);

  const scheduleTimerNotification = useCallback(async (endTimestampMs: number) => {
    if (!Notifications) return;
    try {
      if (settings.notificationsPermissionPrompted && settings.notificationsEnabled === false) {
        return;
      }
      const permission = await Notifications.getPermissionsAsync();
      const hasPermission = permission.granted || permission.ios?.status === 2;
      if (!hasPermission) {
        const requested = await Notifications.requestPermissionsAsync();
        const granted = requested.granted || requested.ios?.status === 2;
        await updateSettings({
          notificationsPermissionPrompted: true,
          notificationsEnabled: granted,
        });
        if (!granted) {
          return;
        }
      } else if (!settings.notificationsPermissionPrompted || settings.notificationsEnabled !== true) {
        await updateSettings({
          notificationsPermissionPrompted: true,
          notificationsEnabled: true,
        });
      }

      if (notificationIdRef.current) {
        await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
      }

      const exerciseLabel = exerciseName || t('exercise');
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: t('timerCompleteTitle'),
          body: t('timerCompleteBody').replace('{exerciseName}', exerciseLabel),
          sound: true,
        },
        trigger: new Date(endTimestampMs),
      });

      notificationIdRef.current = id;
    } catch (error) {
      console.log('⚠️ Failed to schedule notification:', error instanceof Error ? error.message : error);
    }
  }, [
    exerciseName,
    t,
    settings.notificationsPermissionPrompted,
    settings.notificationsEnabled,
    updateSettings,
  ]);

  const promptNotificationPermissions = useCallback(() => {
    if (!Notifications || settings.notificationsPermissionPrompted) return;
    Notifications.getPermissionsAsync()
      .then((permission: any) => {
        if (permission.granted || permission.ios?.status === 2) {
          updateSettings({
            notificationsPermissionPrompted: true,
            notificationsEnabled: true,
          });
          return;
        }

        Alert.alert(
          t('notificationPermissionTitle'),
          t('notificationPermissionBody'),
          [
            {
              text: t('notNow'),
              style: 'cancel',
              onPress: () =>
                updateSettings({
                  notificationsPermissionPrompted: true,
                  notificationsEnabled: false,
                }),
            },
            {
              text: t('enableNotifications'),
              onPress: async () => {
                try {
                  const requested = await Notifications.requestPermissionsAsync();
                  const granted = requested.granted || requested.ios?.status === 2;
                  await updateSettings({
                    notificationsPermissionPrompted: true,
                    notificationsEnabled: granted,
                  });
                  if (!granted) {
                    Alert.alert(
                      t('notificationPermissionTitle'),
                      t('notificationPermissionBody'),
                      [
                        { text: t('notNow'), style: 'cancel' },
                        {
                          text: t('openSettings'),
                          onPress: () => {
                            Linking.openSettings().catch(() => {});
                          },
                        },
                      ]
                    );
                  }
                } catch (error) {
                  console.log(
                    '⚠️ Failed to request notification permissions:',
                    error instanceof Error ? error.message : error
                  );
                }
              },
            },
          ]
        );
      })
      .catch((error: unknown) => {
        console.log('⚠️ Failed to check notification permissions:', error instanceof Error ? error.message : error);
      });
  }, [
    settings.notificationsPermissionPrompted,
    updateSettings,
    t,
  ]);

  // Breathing animation for rest and switchSides phases only (not exercise phase)
  useEffect(() => {
    if (!isRunning || currentPhase === 'exercise') {
      breathingAnim.stopAnimation(() => {
        breathingAnim.setValue(1);
      });
      return;
    }

    // Start breathing animation during rest/switchSides timer - breathe IN (contract, never expand beyond 100%)
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

  // Yellow to red color transition when 5 seconds or less remain (rest and switch sides phases)
  useEffect(() => {
    if ((currentPhase === 'rest' || currentPhase === 'switchSides') && timeLeft <= 5 && timeLeft > 0) {
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

  // Border radius animation: squircle for exercise, circle for rest and switchSides
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
    const isOpening = visible && (!prevVisibleRef.current || !isInitializedRef.current);
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
      
      // Rest timer starts immediately; exercise timer waits for pre-countdown.
      if (!isExerciseTimerPhase) {
        endTimeRef.current = Date.now() + initialTime * 1000;
        setIsRunning(true);
      } else {
        // Start 5-second pre-countdown before exercise timer
        setPreCountdown(PRE_EXERCISE_COUNTDOWN);
      }
      
      // Reset and animate in
      slideAnim.setValue(0);
      breathingAnim.setValue(1);
      restColorAnim.setValue(0); // Start with yellow (or will be blue for exercise)
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 20,
        velocity: 2,
      }).start();

      promptNotificationPermissions();
    } else if (isClosing) {
      // Drawer is closing - cleanup
      isInitializedRef.current = false;
      
      setTimeLeft(restTime);
      setIsRunning(false);
      setPreCountdown(0);
      endTimeRef.current = null;
      setCurrentPhase('rest'); // Reset phase
      setCurrentSide('first'); // Reset side for per-side exercises
      
      // Stop animations
      breathingAnim.stopAnimation(() => {
        breathingAnim.setValue(1);
      });
      restColorAnim.stopAnimation(() => {
        restColorAnim.setValue(0);
      });
      
      cancelTimerNotification();
    }
    
    // Update previous visible ref
    prevVisibleRef.current = visible;
    
    return () => {
      if (preCountdownIntervalRef.current) {
        clearInterval(preCountdownIntervalRef.current);
        preCountdownIntervalRef.current = null;
      }
      cancelTimerNotification();
    };
  }, [
    visible,
    isExerciseTimerPhase,
    exerciseDuration,
    restTime,
    slideAnim,
    breathingAnim,
    restColorAnim,
    workoutName,
    exerciseName,
    currentSet,
    totalSets,
    playCountdownTick,
    startExerciseTimer,
    promptNotificationPermissions,
  ]);

  // Pre-countdown timer (5-4-3-2-1-GO) using useEffect with timeout
  useEffect(() => {
    if (!visible || currentPhase !== 'exercise' || preCountdown < 0) {
      return;
    }
    
    if (preCountdown === 0) {
      // Countdown complete, start exercise timer
      setPreCountdown(-1);
      startExerciseTimer();
      return;
    }
    
    // Play tick sound for 3, 2, 1
    playCountdownTick(preCountdown - 1);
    
    // Schedule next tick
    const timer = setTimeout(() => {
      setPreCountdown(prev => prev - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [preCountdown, visible, currentPhase, startExerciseTimer, playCountdownTick]);

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
          // Exercise phase completed
          
          // Check if this is a per-side exercise and we're on the first side
          if (isPerSide && currentSide === 'first') {
            // Transition to switch sides countdown (10 seconds)
            setCurrentPhase('switchSides');
            const switchTime = 10;
            setTimeLeft(switchTime);
            endTimeRef.current = Date.now() + switchTime * 1000;
            setIsRunning(true);
            lastPlayedSecondRef.current = null;
          } else {
            // Either not per-side, or we just finished the second side
            if (onExerciseTimerComplete) {
              // Await so store is updated before we close and run onComplete (parent reads store there)
              Promise.resolve(onExerciseTimerComplete()).then(() => {
                if (skipRestPhase) {
                  cancelTimerNotification();
                  animateOutAndClose(onComplete);
                } else {
                  setCurrentPhase('rest');
                  const newTime = restTime;
                  setTimeLeft(newTime);
                  endTimeRef.current = Date.now() + newTime * 1000;
                  setIsRunning(true);
                  lastPlayedSecondRef.current = null;
                }
              });
              return;
            }

            // If skipRestPhase is true, close drawer immediately instead of transitioning to rest
            if (skipRestPhase) {
              cancelTimerNotification();
              animateOutAndClose(onComplete);
            } else {
              // Transition to rest phase internally
              setCurrentPhase('rest');
              const newTime = restTime;
              setTimeLeft(newTime);
              endTimeRef.current = Date.now() + newTime * 1000;
              setIsRunning(true);
              lastPlayedSecondRef.current = null;
            }
          }
          
        } else if (currentPhase === 'switchSides') {
          // Switch sides countdown completed - start second side immediately (no pre-countdown)
          setCurrentSide('second');
          setCurrentPhase('exercise');
          setPreCountdown(-1); // No pre-countdown for second side
          setTimeLeft(exerciseDuration);
          endTimeRef.current = Date.now() + exerciseDuration * 1000;
          setIsRunning(true);
          lastPlayedSecondRef.current = null;
        } else {
          // Rest phase completed - close drawer
          restColorAnim.setValue(1);
          cancelTimerNotification();
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
  }, [
    isRunning,
    visible,
    currentPhase,
    currentSide,
    restTime,
    exerciseDuration,
    onComplete,
    onExerciseTimerComplete,
    skipRestPhase,
    isPerSide,
    soundEnabled,
    animateOutAndClose,
    playCompletionAlert,
    workoutName,
    exerciseName,
    currentSet,
    totalSets,
    cancelTimerNotification,
  ]);

  // AppState listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasActive = appStateRef.current === 'active';
      appStateRef.current = nextAppState;

      if (nextAppState === 'active') {
        cancelTimerNotification();
        if (isRunning && endTimeRef.current) {
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
            cancelTimerNotification();

            if (currentPhase === 'exercise') {
              // Exercise phase completed
              if (onExerciseTimerComplete) {
                Promise.resolve(onExerciseTimerComplete()).then(() => {
                  if (skipRestPhase) {
                    animateOutAndClose(onComplete);
                  } else {
                    setCurrentPhase('rest');
                    const newTime = restTime;
                    setTimeLeft(newTime);
                    endTimeRef.current = Date.now() + newTime * 1000;
                    setIsRunning(true);
                    lastPlayedSecondRef.current = null;
                  }
                });
              } else if (skipRestPhase) {
                animateOutAndClose(onComplete);
              } else {
                // Transition to rest phase internally
                setCurrentPhase('rest');
                const newTime = restTime;
                setTimeLeft(newTime);
                endTimeRef.current = Date.now() + newTime * 1000;
                setIsRunning(true);
                lastPlayedSecondRef.current = null;
              }
            } else {
              // Rest phase completed - close drawer
              restColorAnim.setValue(1);
              animateOutAndClose(onComplete);
            }
          }
        }
        return;
      }

      if (wasActive && (nextAppState === 'background' || nextAppState === 'inactive')) {
        if (isRunning && endTimeRef.current) {
          scheduleTimerNotification(endTimeRef.current);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [
    isRunning,
    currentPhase,
    restTime,
    onComplete,
    onExerciseTimerComplete,
    skipRestPhase,
    animateOutAndClose,
    playCompletionAlert,
    workoutName,
    exerciseName,
    currentSet,
    totalSets,
    scheduleTimerNotification,
    cancelTimerNotification,
  ]);

  const handleTogglePause = () => {
    // Don't allow manual start/pause during pre-countdown
    const isPreCountdownActive = preCountdown >= 0 && currentPhase === 'exercise';
    if (isPreCountdownActive) {
      return;
    }
    
    if (isRunning) {
      const remaining = endTimeRef.current
        ? Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
        : Math.max(0, timeLeft);
      pausedRemainingRef.current = remaining;
      setTimeLeft(remaining);
      endTimeRef.current = null;
      setIsRunning(false);

      cancelTimerNotification();
      return;
    }

    const resumeRemaining = pausedRemainingRef.current ?? timeLeft;
    pausedRemainingRef.current = null;
    endTimeRef.current = Date.now() + resumeRemaining * 1000;
    setIsRunning(true);

    cancelTimerNotification();
  };

  const handleSkip = () => {
    setIsRunning(false);
    endTimeRef.current = null;
    cancelTimerNotification();
    
    // Handle skip differently based on current phase
    if (currentPhase === 'exercise') {
      // Exercise phase: mark set complete
      if (onExerciseTimerComplete) {
        Promise.resolve(onExerciseTimerComplete()).then(() => {
          if (skipRestPhase) {
            animateOutAndClose(onComplete);
          } else {
            // Transition to rest phase
            setCurrentPhase('rest');
            const newTime = restTime;
            setTimeLeft(newTime);
            endTimeRef.current = Date.now() + newTime * 1000;
            setIsRunning(true);
            lastPlayedSecondRef.current = null;
          }
        });
      } else if (skipRestPhase) {
        animateOutAndClose(onComplete);
      } else {
        // Transition to rest phase
        setCurrentPhase('rest');
        const newTime = restTime;
        setTimeLeft(newTime);
        endTimeRef.current = Date.now() + newTime * 1000;
        setIsRunning(true);
        lastPlayedSecondRef.current = null;
      }
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
    outputRange: [SCREEN_HEIGHT, 0],
  });
  const phaseLabel =
    currentPhase === 'exercise'
      ? 'work'
      : currentPhase === 'switchSides'
        ? 'switch sides'
        : 'rest';

  const isPreCountdownActive = preCountdown >= 0 && currentPhase === 'exercise';

  useEffect(() => {
    if (!isPreCountdownActive) {
      countdownOpacityAnim.setValue(1);
      countdownTextScaleAnim.setValue(1);
      return;
    }

    if (preCountdown < 0) {
      return;
    }

    countdownOpacityAnim.stopAnimation();
    countdownTextScaleAnim.stopAnimation();
    countdownOpacityAnim.setValue(1);
    countdownTextScaleAnim.setValue(1);
    const shouldShrink = preCountdown !== 0;

    Animated.parallel([
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(countdownOpacityAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(countdownTextScaleAnim, {
          toValue: shouldShrink ? 0.8 : 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [preCountdown, isPreCountdownActive, countdownOpacityAnim, countdownTextScaleAnim]);

  const handleTogglePauseWrapper = () => {
    // Disable play/pause during pre-countdown
    if (isPreCountdownActive) {
      return;
    }
    handleTogglePause();
  };

  // Removed wedge color animation for split pentagon.

  if (!visible) return null;

  return (
    <View style={styles.timerOverlay} pointerEvents="auto">
      <Animated.View 
        style={[
          styles.timerDrawer, 
          { 
            transform: [{ translateY }],
            paddingBottom: 0,
          }
        ]}
      >
        <View style={[styles.timerSheet, { paddingBottom: 16 + insets.bottom }]}>
          <View style={styles.heroTimerBand}>
            {isPreCountdownActive ? (
              <Animated.View style={{ opacity: countdownOpacityAnim, transform: [{ scale: countdownTextScaleAnim }] }}>
                <Text style={styles.heroTimerText}>{preCountdown === 0 ? t('go') : String(Math.max(preCountdown, 0))}</Text>
              </Animated.View>
            ) : (
              <Text style={styles.heroTimerText}>{formatTime()}</Text>
            )}
            <Text style={styles.heroTimerLabel}>{phaseLabel}</Text>
          </View>
          <View style={styles.currentCard}>
            <View style={styles.currentHeaderRow}>
              <Text style={styles.currentExercise} numberOfLines={1}>{exerciseName || 'Exercise'}</Text>
              <Text style={styles.currentTopTime}>{formatTime()}</Text>
            </View>
            <View style={styles.currentMetaRow}>
              <Text style={styles.currentMeta}>Set {currentSet}/{totalSets}</Text>
              <Text style={styles.currentMeta}>
                {currentPhase === 'switchSides'
                  ? 'Switch sides'
                  : currentPhase === 'exercise' && isPerSide
                    ? currentSide === 'first'
                      ? 'Left side'
                      : 'Right side'
                    : nextExerciseName
                      ? `Next ${nextExerciseName}`
                      : `Round ${currentSet}/${totalSets}`}
              </Text>
            </View>
            <View style={styles.currentVisualPlaceholder}>
              <View style={styles.placeholderCircleLeft} />
              <View style={styles.placeholderCircleRight} />
            </View>
            <View style={styles.controlsRow}>
              <TouchableOpacity style={styles.pauseBtn} onPress={handleTogglePauseWrapper} activeOpacity={0.8} disabled={isPreCountdownActive}>
                {isRunning ? <IconPause size={20} color={COLORS.backgroundCanvas} /> : <IconPlay size={20} color={COLORS.backgroundCanvas} />}
                <Text style={styles.pauseBtnText}>{isRunning ? 'Pause' : 'Resume'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.8}>
                <Text style={styles.skipBtnText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    backgroundColor: COLORS.backgroundCanvas,
  },
  timerDrawer: {
    flex: 1,
  },
  timerSheet: {
    flex: 1,
    backgroundColor: '#C6FF18',
    paddingTop: 88,
    paddingHorizontal: 24,
  },
  heroTimerBand: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  heroTimerText: {
    fontSize: 84,
    lineHeight: 88,
    fontWeight: '400',
    color: COLORS.backgroundCanvas,
  },
  heroTimerLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.backgroundCanvas,
    marginTop: -8,
  },
  currentCard: {
    flex: 1,
    backgroundColor: '#012625',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  currentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currentExercise: {
    ...TYPOGRAPHY.h2,
    color: COLORS.canvasLight,
    flex: 1,
    marginRight: 12,
  },
  currentTopTime: {
    ...TYPOGRAPHY.body,
    color: 'rgba(255,255,255,0.8)',
  },
  currentMetaRow: {
    marginTop: 6,
    flexDirection: 'row',
    columnGap: 20,
  },
  currentMeta: {
    ...TYPOGRAPHY.body,
    color: 'rgba(184,220,216,0.75)',
  },
  currentVisualPlaceholder: {
    flex: 1,
    marginTop: 16,
    marginBottom: 14,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#062E2D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  placeholderCircleLeft: {
    width: CONTAINER_WIDTH * 0.54,
    height: CONTAINER_WIDTH * 0.54,
    borderRadius: CONTAINER_WIDTH * 0.27,
    backgroundColor: 'rgba(116,165,158,0.22)',
    marginLeft: -CONTAINER_WIDTH * 0.27,
  },
  placeholderCircleRight: {
    width: CONTAINER_WIDTH * 0.54,
    height: CONTAINER_WIDTH * 0.54,
    borderRadius: CONTAINER_WIDTH * 0.27,
    backgroundColor: 'rgba(116,165,158,0.22)',
    marginRight: -CONTAINER_WIDTH * 0.27,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pauseBtn: {
    minWidth: 120,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFB835',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
  },
  pauseBtnText: {
    ...TYPOGRAPHY.body,
    color: COLORS.backgroundCanvas,
    fontWeight: '600',
  },
  skipBtn: {
    paddingHorizontal: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    ...TYPOGRAPHY.h3,
    color: '#FFB835',
    fontWeight: '500',
  },
});

