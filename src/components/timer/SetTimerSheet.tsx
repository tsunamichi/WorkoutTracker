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
import { TimerDotCircle } from '../TimerDotCircle';
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
      
      slideAnim.setValue(0);
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
  }, [visible, restTime, slideAnim, workoutName, exerciseName, currentSet, totalSets]);

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
        
        playCompletionAlert();
        
        if (liveActivityIdRef.current) {
          markRestTimerCompleted();
        }
        
        setTimeout(() => {
          if (liveActivityIdRef.current) {
            endRestTimer();
            liveActivityIdRef.current = null;
          }
          animateOutAndClose(onComplete);
        }, 2000);
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
          playCompletionAlert();
          
          if (liveActivityIdRef.current) {
            markRestTimerCompleted();
          }
          
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

  // Progress for fade OUT behavior
  // When timeLeft = restTime (start): progress = 1 (all dots visible)
  // When timeLeft = 0 (end): progress = 0 (no dots visible)
  const progress = timeLeft / restTime;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [500, 0],
  });

  if (!visible) return null;

  return (
    <View style={styles.timerOverlay} pointerEvents="box-none">
      <View style={styles.timerBackdrop} pointerEvents="none" />
      
      <Animated.View 
        style={[
          styles.timerDrawer, 
          { 
            transform: [{ translateY }],
            paddingBottom: insets.bottom + 8, // Account for safe area + 8px spacing
          }
        ]}
      >
        <View style={styles.timerSheet}>
          {/* Set indicator */}
          <View style={styles.setIndicator}>
            <Text style={styles.setLabel}>Set</Text>
            <Text style={styles.setValue}>{currentSet}/{totalSets}</Text>
          </View>

          {/* Dot pattern */}
          <View style={styles.timerContainer}>
            <TimerDotCircle 
              progress={progress} 
              size={Dimensions.get('window').width - 96} // 48px padding on each side
              isWorkPhase={true} // Dots fade OUT from center as progress decreases
              totalSeconds={restTime}
            />
          </View>

          {/* Time display */}
          <View style={styles.counterContainer}>
            <Text style={styles.timeText}>{formatTime()}</Text>
          </View>

          {/* Controls */}
          <View style={styles.stickyButtonContainer}>
            <TouchableOpacity
              onPress={handleToggleSound}
              style={styles.sideButtonTouchable}
              activeOpacity={0.7}
            >
              <IconSpeaker size={24} color={LIGHT_COLORS.textSecondary} muted={!soundEnabled} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleTogglePause}
              activeOpacity={0.8}
            >
              <View style={styles.controlButton}>
                {isRunning ? (
                  <IconPause size={24} color="#FFFFFF" />
                ) : (
                  <IconPlay size={24} color="#FFFFFF" />
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSkip}
              style={styles.sideButtonTouchable}
              activeOpacity={0.7}
            >
              <IconSkip size={24} color={LIGHT_COLORS.textSecondary} />
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
    pointerEvents: 'box-none',
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
    paddingTop: SPACING.xl,
    paddingHorizontal: 48,
    paddingBottom: 40,
    alignItems: 'center',
  },
  setIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.xl,
  },
  setLabel: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
  },
  setValue: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.textPrimary,
  },
  timerContainer: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  counterContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  timeText: {
    fontSize: 56,
    color: LIGHT_COLORS.textPrimary,
    fontWeight: '300',
    fontFamily: 'System',
    textAlign: 'center',
  },
  stickyButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    width: '100%',
  },
  controlButton: {
    backgroundColor: '#FD6B00',
    width: 56,
    height: 56,
    borderRadius: 12,
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

