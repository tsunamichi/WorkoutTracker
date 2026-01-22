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
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useStore } from '../../store';
import { SPACING, TYPOGRAPHY, COLORS } from '../../constants';
import { TimerControls } from './TimerControls';
import { IconChevronDown } from '../icons';
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
const MIN_SIZE = 180;
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
  exerciseId,
  workoutKey,
  isExerciseTimerPhase = false,
  exerciseDuration = 0,
  onExerciseTimerComplete
}: SetTimerSheetProps) {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useStore();
  const { t } = useTranslation();
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
  const countdownOpacityAnim = useRef(new Animated.Value(1)).current;
  const countdownTextScaleAnim = useRef(new Animated.Value(1)).current;
  const exerciseEntryOpacity = useRef(new Animated.Value(1)).current;
  const exerciseEntryScale = useRef(new Animated.Value(1)).current;
  const prevPreCountdownRef = useRef(preCountdown);
  
  const slideAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const sizeAnim = useRef(new Animated.Value(1)).current; // 1 = 100%, 0 = MIN_SIZE
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

  // Animate size based on time remaining
  useEffect(() => {
    const totalTime = currentPhase === 'exercise' ? exerciseDuration : restTime;
    const progress = totalTime > 0 ? timeLeft / totalTime : 0;
    const isExerciseStart = currentPhase === 'exercise' && timeLeft === totalTime;
    
    // Animate size smoothly based on progress
    Animated.timing(sizeAnim, {
      toValue: progress,
      duration: isExerciseStart ? 120 : 1000,
      easing: isExerciseStart ? Easing.out(Easing.quad) : Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [timeLeft, currentPhase, exerciseDuration, restTime, sizeAnim]);

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
      .then(permission => {
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
      .catch(error => {
        console.log('⚠️ Failed to check notification permissions:', error instanceof Error ? error.message : error);
      });
  }, [
    settings.notificationsPermissionPrompted,
    updateSettings,
    t,
  ]);

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
      sizeAnim.setValue(1);
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
    sizeAnim,
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
    restTime,
    onComplete,
    onExerciseTimerComplete,
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

  const handleToggleSound = () => {
    setSoundEnabled(prev => !prev);
  };

  const handleSkip = () => {
    setIsRunning(false);
    endTimeRef.current = null;
    cancelTimerNotification();
    
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

  // Removed wedge color animation for split pentagon.

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
                  {t('nextSetOutOf')
                    .replace('{current}', String(currentSet + 1))
                    .replace('{total}', String(totalSets))}
                </Text>
              ) : (
                <Text style={styles.nextSetText}>
                  {t('setOf')
                    .replace('{current}', String(currentSet))
                    .replace('{total}', String(totalSets))}
                </Text>
              )}
            </View>

          {/* Animated Circle Timer */}
          <View style={styles.timerContainer}>
            <Animated.View
              style={[
                styles.circleContainer,
                {
                  opacity: currentPhase === 'exercise' ? exerciseEntryOpacity : 1,
                  transform: [
                    { scale: animatedScale },
                    { scale: currentPhase === 'exercise' ? exerciseEntryScale : 1 },
                  ],
                },
              ]}
            >
              {/* Circle/Squircle background */}
              {!isPreCountdownActive && !(isExerciseTimerPhase && preCountdown >= 0) && (
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
              {isPreCountdownActive ? (
                <Animated.View
                  style={[
                    styles.textContainer,
                    {
                      transform: [{ scale: textScale }, { scale: countdownTextScaleAnim }],
                      opacity: countdownOpacityAnim,
                      zIndex: 10,
                    },
                  ]}
                >
                  <Text style={[styles.timerText, styles.countdownText]}>
                    {preCountdown === 0 ? t('go') : String(Math.max(preCountdown, 0))}
                  </Text>
                </Animated.View>
              ) : (
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
  countdownText: {
    color: COLORS.text,
  },
});

