import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, GRADIENTS } from '../constants';
import { IconArrowLeft, IconPlay, IconPause, IconSpeaker, IconSkip } from '../components/icons';
import { TimerDotCircle } from '../components/TimerDotCircle';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'HIITTimerExecution'>;

type TimerPhase = 'countdown' | 'work' | 'workRest' | 'roundRest' | 'complete';

const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  text: '#1B1B1B',
  textPrimary: '#000000',
  textSecondary: '#3C3C43',
  textMeta: '#817B77',
};

export default function HIITTimerExecutionScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { timerId } = route.params;
  const { hiitTimers } = useStore();
  
  const timer = hiitTimers.find(t => t.id === timerId);
  
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false); // Track if timer has ever been started
  const [soundEnabled, setSoundEnabled] = useState(true); // Track if sounds are enabled
  const [currentPhase, setCurrentPhase] = useState<TimerPhase>('countdown');
  const [currentSet, setCurrentSet] = useState(1);
  const [currentRound, setCurrentRound] = useState(1);
  const [secondsRemaining, setSecondsRemaining] = useState(5); // Start with 5-second countdown
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownSoundRef = useRef<Audio.Sound | null>(null);
  const completeSoundRef = useRef<Audio.Sound | null>(null);
  const lastPlayedSecondRef = useRef<number | null>(null);
  const isTransitioningRef = useRef(false);
  
  // Animated value for button shape: 0 = full width, 1 = compact rectangular
  const buttonShapeAnim = useRef(new Animated.Value(0)).current;
  
  // Animated values for side buttons: 0 = hidden, 1 = visible
  const sideButtonsAnim = useRef(new Animated.Value(0)).current;

  // Animate button shape and side buttons based on state
  useEffect(() => {
    // hasStarted = false: full width "Start" button (value = 0), side buttons hidden
    // hasStarted = true: compact rectangular button (value = 1), side buttons visible
    Animated.parallel([
      Animated.spring(buttonShapeAnim, {
        toValue: hasStarted ? 1 : 0,
        useNativeDriver: false,
        tension: 100,
        friction: 10,
      }),
      Animated.spring(sideButtonsAnim, {
        toValue: hasStarted ? 1 : 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }),
    ]).start();
  }, [hasStarted, buttonShapeAnim, sideButtonsAnim]);

  useEffect(() => {
    let mounted = true;

    const loadSounds = async () => {
      try {
        console.log('🔊 Loading HIIT timer sounds...');
        
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
        
        console.log('🔊 HIIT timer sounds loaded successfully');
      } catch (error) {
        console.log('⚠️ Error loading HIIT timer sounds:', error);
      }
    };

    loadSounds();

    return () => {
      mounted = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
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

  useEffect(() => {
    if (isRunning) {
      // Small delay to ensure transition flag is cleared
      const startTimer = () => {
        intervalRef.current = setInterval(() => {
          setSecondsRemaining(prev => {
            const newTime = prev - 1;
            
            // Play countdown sound at 3, 2, 1 seconds
            if (soundEnabled && (newTime === 3 || newTime === 2 || newTime === 1) && lastPlayedSecondRef.current !== newTime) {
              lastPlayedSecondRef.current = newTime;
              if (countdownSoundRef.current) {
                console.log('🔊 Playing countdown sound for', newTime, 'seconds');
                countdownSoundRef.current.setPositionAsync(0).then(() => {
                  return countdownSoundRef.current?.playAsync();
                }).catch((error) => {
                  console.log('⚠️ Error playing countdown sound:', error);
                });
              }
            }
            
            if (newTime <= 0 && !isTransitioningRef.current) {
              // Trigger phase complete on next tick to avoid race conditions
              setTimeout(() => handlePhaseComplete(), 0);
              return 0;
            }
            return newTime;
          });
        }, 1000);
      };
      
      // Wait for transition flag to clear before starting
      if (isTransitioningRef.current) {
        const checkInterval = setInterval(() => {
          if (!isTransitioningRef.current) {
            clearInterval(checkInterval);
            startTimer();
          }
        }, 10);
      } else {
        startTimer();
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, currentPhase, handlePhaseComplete, soundEnabled]);

  const playBeep = useCallback(async () => {
    if (!soundEnabled) return; // Skip if sounds are disabled
    
    try {
      // Play completion sound
      if (completeSoundRef.current) {
        console.log('🔊 Playing phase completion sound');
        await completeSoundRef.current.setPositionAsync(0);
        await completeSoundRef.current.playAsync();
      }
    } catch (error) {
      console.log('⚠️ Error playing completion sound:', error);
    }
  }, [soundEnabled]);

  const handlePhaseComplete = useCallback(() => {
    if (!timer || isTransitioningRef.current) {
      console.log('⚠️ Skipping phase complete - already transitioning');
      return;
    }

    console.log('✅ Phase complete triggered');
    
    // Set flag to prevent multiple calls
    isTransitioningRef.current = true;
    
    // Clear interval immediately
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    playBeep();
    
    // Reset countdown tracking for next phase
    lastPlayedSecondRef.current = null;

    if (currentPhase === 'countdown') {
      // Move from countdown to first work phase
      setCurrentPhase('work');
      setSecondsRemaining(timer.work);
      setTimeout(() => {
        isTransitioningRef.current = false;
        console.log('✅ Transition flag cleared');
      }, 50);
    } else if (currentPhase === 'work') {
      // Check if this is the last work round
      const isLastSet = currentSet === timer.sets;
      const isLastRound = currentRound === timer.rounds;
      
      if (isLastSet && isLastRound) {
        // Last work complete - navigate back instead of rest
        console.log('🏁 Last work complete - navigating back');
        setIsRunning(false);
        navigation.goBack();
        return;
      }
      
      // Move to work rest
      setCurrentPhase('workRest');
      setSecondsRemaining(timer.workRest);
      // Clear transition flag immediately so timer can restart
      setTimeout(() => {
        isTransitioningRef.current = false;
        console.log('✅ Transition flag cleared');
      }, 50);
    } else if (currentPhase === 'workRest') {
      if (currentSet < timer.sets) {
        // Move to next set
        setCurrentSet(prev => prev + 1);
        setCurrentPhase('work');
        setSecondsRemaining(timer.work);
        setTimeout(() => {
          isTransitioningRef.current = false;
          console.log('✅ Transition flag cleared');
        }, 50);
      } else if (currentRound < timer.rounds) {
        // Move to round rest
        setCurrentPhase('roundRest');
        setSecondsRemaining(timer.roundRest);
        setTimeout(() => {
          isTransitioningRef.current = false;
          console.log('✅ Transition flag cleared');
        }, 50);
      } else {
        // Complete!
        setCurrentPhase('complete');
        setIsRunning(false);
        isTransitioningRef.current = false;
        Alert.alert('Complete!', 'Great job! Your HIIT workout is complete.');
      }
    } else if (currentPhase === 'roundRest') {
      // Start new round
      setCurrentRound(prev => prev + 1);
      setCurrentSet(1);
      setCurrentPhase('work');
      setSecondsRemaining(timer.work);
      setTimeout(() => {
        isTransitioningRef.current = false;
        console.log('✅ Transition flag cleared');
      }, 50);
    }
  }, [timer, currentPhase, currentSet, currentRound, playBeep]);

  const handlePlayPause = () => {
    setIsRunning(prev => {
      // Reset countdown tracking when starting
      if (!prev) {
        lastPlayedSecondRef.current = null;
        isTransitioningRef.current = false;
        setHasStarted(true); // Mark that timer has been started
      }
      return !prev;
    });
  };

  const handleToggleSound = () => {
    setSoundEnabled(prev => !prev);
  };

  const handleSkip = () => {
    if (!timer || !hasStarted) return;
    
    // Manually trigger phase complete to skip to next phase
    setIsRunning(false);
    setTimeout(() => {
      handlePhaseComplete();
      setIsRunning(true);
    }, 100);
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Timer',
      'Are you sure you want to reset the timer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: () => {
            setIsRunning(false);
            setHasStarted(false); // Reset to initial state
            setCurrentPhase('countdown');
            setCurrentSet(1);
            setCurrentRound(1);
            setSecondsRemaining(5); // Reset to countdown
            isTransitioningRef.current = false;
            lastPlayedSecondRef.current = null;
          },
        },
      ]
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseColor = () => {
    switch (currentPhase) {
      case 'countdown':
        return COLORS.accentPrimary;
      case 'work':
        return COLORS.signalPositive;
      case 'workRest':
      case 'roundRest':
        return COLORS.textSecondary;
      case 'complete':
        return COLORS.accentPrimary;
      default:
        return COLORS.textPrimary;
    }
  };

  const getPhaseText = () => {
    switch (currentPhase) {
      case 'countdown':
        return 'Get Ready';
      case 'work':
        return 'WORK';
      case 'workRest':
        return 'REST';
      case 'roundRest':
        return 'ROUND REST';
      case 'complete':
        return 'COMPLETE';
    }
  };

  const getTotalSeconds = () => {
    if (!timer) return 30;
    
    switch (currentPhase) {
      case 'countdown':
        return 5;
      case 'work':
        return timer.work;
      case 'workRest':
        return timer.workRest;
      case 'roundRest':
        return timer.roundRest;
      case 'complete':
        return 0;
    }
  };

  const getTimerProgress = () => {
    if (!timer) return 1;
    
    const totalSeconds = getTotalSeconds();
    if (currentPhase === 'complete') return 0;
    
    return totalSeconds > 0 ? secondsRemaining / totalSeconds : 0;
  };

  if (!timer) {
    return (
      <LinearGradient
        colors={GRADIENTS.backgroundLight.colors}
        start={GRADIENTS.backgroundLight.start}
        end={GRADIENTS.backgroundLight.end}
        style={styles.container}
      >
        <View style={styles.innerContainer}>
          <Text style={styles.errorText}>Timer not found</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={GRADIENTS.backgroundLight.colors}
      start={GRADIENTS.backgroundLight.start}
      end={GRADIENTS.backgroundLight.end}
      style={styles.container}
    >
      <View style={styles.innerContainer}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <IconArrowLeft size={24} color={LIGHT_COLORS.text} />
            </TouchableOpacity>
            <View style={{ width: 48 }} />
          </View>
          
          <View style={styles.pageTitleContainer}>
            <Text style={styles.pageTitle}>{timer.name}</Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* Row with Set, Round, and Phase */}
          <View style={styles.infoRow}>
            <View style={styles.leftInfoContainer}>
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>Set</Text>
                <Text style={styles.progressValue}>{currentSet}/{timer.sets}</Text>
              </View>
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>Round</Text>
                <Text style={styles.progressValue}>{currentRound}/{timer.rounds}</Text>
              </View>
            </View>
            <View style={styles.phaseContainer}>
              <Text style={[styles.phaseText, { color: getPhaseColor() }]}>
                {getPhaseText()}
              </Text>
            </View>
          </View>

          <View style={styles.timerContainer}>
            <TimerDotCircle 
              progress={getTimerProgress()} 
              size={Dimensions.get('window').width - 80} // 40px spacing on each side
              isWorkPhase={currentPhase === 'work' || currentPhase === 'countdown'}
              totalSeconds={getTotalSeconds()}
            />
          </View>

          <View style={styles.counterContainer}>
            <View style={styles.timeTextContainer}>
              <Text style={styles.timeText}>{formatTime(secondsRemaining)}</Text>
            </View>
          </View>

          <View style={styles.stickyButtonContainer}>
            {/* Left button: Sound toggle */}
            <Animated.View
              style={[
                styles.sideButton,
                {
                  opacity: sideButtonsAnim,
                  transform: [
                    {
                      translateX: sideButtonsAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, 0], // Slide in from right
                      }),
                    },
                    {
                      scale: sideButtonsAnim,
                    },
                  ],
                },
              ]}
              pointerEvents={hasStarted ? 'auto' : 'none'}
            >
              <TouchableOpacity
                onPress={handleToggleSound}
                style={styles.sideButtonTouchable}
                activeOpacity={0.7}
              >
                <IconSpeaker size={24} color={LIGHT_COLORS.textSecondary} muted={!soundEnabled} />
              </TouchableOpacity>
            </Animated.View>

            {/* Center button: Play/Pause */}
            <TouchableOpacity
              onPress={handlePlayPause}
              activeOpacity={0.8}
            >
              <Animated.View
                style={[
                  styles.controlButton,
                  {
                    borderRadius: 12,
                    width: buttonShapeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [Dimensions.get('window').width - (SPACING.xxl * 2), 56], // Full width to square (56x56)
                    }),
                    height: 56, // Fixed height (square when compact)
                  },
                ]}
              >
                {!hasStarted ? (
                  // Initial state: "Start" text
                  <Text style={styles.buttonText}>Start</Text>
                ) : isRunning ? (
                  // Running state: Pause icon
                  <IconPause size={24} color="#FFFFFF" />
                ) : (
                  // Paused state: Play icon
                  <IconPlay size={24} color="#FFFFFF" />
                )}
              </Animated.View>
            </TouchableOpacity>

            {/* Right button: Skip */}
            <Animated.View
              style={[
                styles.sideButton,
                {
                  opacity: sideButtonsAnim,
                  transform: [
                    {
                      translateX: sideButtonsAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-50, 0], // Slide in from left
                      }),
                    },
                    {
                      scale: sideButtonsAnim,
                    },
                  ],
                },
              ]}
              pointerEvents={hasStarted ? 'auto' : 'none'}
            >
              <TouchableOpacity
                onPress={handleSkip}
                style={styles.sideButtonTouchable}
                activeOpacity={0.7}
              >
                <IconSkip size={24} color={LIGHT_COLORS.textSecondary} />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
  },
  header: {
    paddingBottom: SPACING.md,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  pageTitleContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  pageTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.textPrimary,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingTop: SPACING.xxl,
    paddingBottom: 136, // Button height (56) + button bottom spacing (40) + 40px gap
    paddingHorizontal: 40, // Minimum 40px spacing from edges
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  leftInfoContainer: {
    flexDirection: 'row',
    gap: 40,
    alignItems: 'flex-start',
  },
  progressItem: {
    alignItems: 'flex-start',
  },
  progressLabel: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
    marginBottom: SPACING.xs,
  },
  progressValue: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.text,
  },
  phaseContainer: {
    alignItems: 'flex-end',
  },
  timerContainer: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterContainer: {
    alignItems: 'center',
  },
  phaseText: {
    ...TYPOGRAPHY.meta,
    fontWeight: '600',
  },
  timeTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 56,
    color: LIGHT_COLORS.textPrimary,
    fontWeight: '300',
    fontFamily: 'System',
    includeFontPadding: false,
    textAlign: 'center',
  },
  stickyButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20, // Space between buttons
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 40, // 40px spacing below button
    paddingTop: SPACING.md,
    backgroundColor: 'transparent',
  },
  controlButton: {
    backgroundColor: '#FD6B00',
    alignItems: 'center',
    justifyContent: 'center',
    // width and height are animated
  },
  sideButton: {
    width: 56,
    height: 56,
  },
  sideButtonTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textPrimary,
    textAlign: 'center',
    marginTop: SPACING.xxl,
  },
});

