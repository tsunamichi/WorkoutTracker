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
import { useStore } from '../../store';
import { SPACING, TYPOGRAPHY } from '../../constants';
import { IconPlay, IconPause, IconSpeaker, IconSkip } from '../icons';
import { startRestTimer, endRestTimer, markRestTimerCompleted } from '../../modules/RestTimerLiveActivity';

interface SetTimerSheetProps {
  visible: boolean;
  onComplete: () => void;
  onClose: () => void;
  workoutName?: string;
  exerciseName?: string;
  currentSet?: number;
  totalSets?: number;
}

const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  textPrimary: '#000000',
  textSecondary: '#3C3C43',
  textMeta: '#817B77',
};

const REST_COLOR_YELLOW = '#FFCC00'; // Yellow for rest
const REST_COLOR_RED = '#FF6B6B'; // Red for rest (under 5 seconds)
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
  totalSets = 1 
}: SetTimerSheetProps) {
  const insets = useSafeAreaInsets();
  const { settings } = useStore();
  const restTime = settings.restTimerDefaultSeconds;
  
  const [timeLeft, setTimeLeft] = useState(restTime);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const slideAnim = useRef(new Animated.Value(0)).current;
  const sizeAnim = useRef(new Animated.Value(1)).current; // 1 = 100%, 0 = MIN_SIZE
  const breathingAnim = useRef(new Animated.Value(1)).current; // For breathing animation (1 = 100%, 0.92 = 92%)
  const restColorAnim = useRef(new Animated.Value(0)).current; // For yellow to red transition (0 = yellow, 1 = red)
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
    const progress = restTime > 0 ? timeLeft / restTime : 0;
    
    // Animate size smoothly based on progress
    Animated.timing(sizeAnim, {
      toValue: progress,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: false, // Changed to false for compatibility with breathing
    }).start();
  }, [timeLeft, restTime, sizeAnim]);

  // Breathing animation for rest phase
  useEffect(() => {
    if (!isRunning) {
      breathingAnim.stopAnimation(() => {
        breathingAnim.setValue(1);
      });
      return;
    }

    // Start breathing animation - breathe IN (contract, never expand beyond 100%)
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
  }, [isRunning, breathingAnim]);

  // Yellow to red color transition when 5 seconds or less remain
  useEffect(() => {
    if (timeLeft <= 5 && timeLeft > 0) {
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
  }, [timeLeft, restColorAnim]);

  // Handle visibility changes
  useEffect(() => {
    if (visible) {
      setTimeLeft(restTime);
      setIsRunning(true);
      lastPlayedSecondRef.current = null;
      
      endTimeRef.current = Date.now() + restTime * 1000;
      
      startRestTimer(workoutName || 'Workout', exerciseName || 'Exercise', restTime, currentSet, totalSets).then((activityId) => {
        if (activityId) {
          liveActivityIdRef.current = activityId;
        }
      });
      
      // Reset and animate in
      slideAnim.setValue(0);
      sizeAnim.setValue(1); // Start at 100%
      breathingAnim.setValue(1);
      restColorAnim.setValue(0); // Start with yellow
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
  }, [visible, restTime, slideAnim, sizeAnim, breathingAnim, restColorAnim, workoutName, exerciseName, currentSet, totalSets]);

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
        
        // Stop breathing and keep circle red at completion
        breathingAnim.stopAnimation(() => {
          breathingAnim.setValue(1);
        });
        restColorAnim.setValue(1);
        
        playCompletionAlert();
        
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
    };
    
    updateTimer();
    intervalRef.current = setInterval(updateTimer, 1000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, visible, onComplete, soundEnabled, animateOutAndClose, playCompletionAlert]);

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
          
          // Stop breathing and keep circle red at completion
          breathingAnim.stopAnimation(() => {
            breathingAnim.setValue(1);
          });
          restColorAnim.setValue(1);
          
          playCompletionAlert();
          
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
    });
    
    return () => {
      subscription.remove();
    };
  }, [isRunning, onComplete, animateOutAndClose, playCompletionAlert]);

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

  // Interpolate color from yellow to red
  const backgroundColor = restColorAnim.interpolate({
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
              {/* Circle background with breathing */}
              <Animated.View 
                style={[
                  styles.circle, 
                  { 
                    backgroundColor,
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
          <View style={styles.stickyButtonContainer}>
            <TouchableOpacity
              onPress={handleToggleSound}
              style={styles.sideButtonTouchable}
              activeOpacity={0.7}
            >
              <IconSpeaker size={28} color={LIGHT_COLORS.textSecondary} muted={!soundEnabled} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleTogglePause}
              activeOpacity={0.8}
              style={styles.playPauseButton}
            >
              {isRunning ? (
                <IconPause size={32} color="#FFFFFF" />
              ) : (
                <IconPlay size={32} color="#FFFFFF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSkip}
              style={styles.sideButtonTouchable}
              activeOpacity={0.7}
            >
              <IconSkip size={28} color={LIGHT_COLORS.textSecondary} />
            </TouchableOpacity>
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
  },
  timerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  timerDrawer: {
    paddingHorizontal: 8,
  },
  timerSheet: {
    backgroundColor: LIGHT_COLORS.backgroundCanvas,
    borderRadius: 40,
    paddingTop: 32,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  setIndicator: {
    alignItems: 'center',
    marginBottom: 40,
  },
  nextSetText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
  },
  nextSetNumber: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textPrimary,
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
    borderRadius: CONTAINER_WIDTH / 2,
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
  stickyButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    width: '100%',
  },
  playPauseButton: {
    backgroundColor: '#1B1B1B',
    width: 80,
    height: 80,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideButtonTouchable: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

