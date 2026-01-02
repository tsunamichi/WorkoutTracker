import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import Svg, { Circle, Path } from 'react-native-svg';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, GRADIENTS, BUTTONS } from '../constants';
import { IconArrowLeft, IconPlay, IconPause, IconSpeaker, IconSkip } from '../components/icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'HIITTimerExecution'>;

type TimerPhase = 'countdown' | 'work' | 'workRest' | 'roundRest' | 'complete';

const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  text: '#1B1B1B',
  secondary: '#1B1B1B',
  textSecondary: '#3C3C43',
  textMeta: '#817B77',
  border: '#CDCABB',
};

export default function HIITTimerExecutionScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { timerId } = route.params;
  const { hiitTimers, addHIITTimer, deleteHIITTimer } = useStore();
  
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
  
  // Animated value for timer progress (smooth transitions)
  const progressAnim = useRef(new Animated.Value(1)).current;
  
  // Animated value for phase transitions: -1 = countdown, 0 = work, 1 = rest
  const getPhaseValue = (phase: typeof currentPhase) => {
    if (phase === 'countdown') return -1;
    if (phase === 'work') return 0;
    return 1;
  };
  const phaseTransitionAnim = useRef(new Animated.Value(getPhaseValue(currentPhase))).current;
  
  // Animated values for countdown flash effect
  const countdownFlashAnim = useRef(new Animated.Value(1)).current;
  const countdownOpacityAnim = useRef(new Animated.Value(1)).current;
  
  // Animated value for urgency state (time <= 5 seconds): 0 = normal, 1 = urgent
  const urgencyAnim = useRef(new Animated.Value(0)).current;
  
  // Track previous phase for transition detection
  const prevPhaseRef = useRef(currentPhase);

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

  // Animate phase transitions (colors, fonts, flex, gap, border radius)
  useEffect(() => {
    const targetValue = getPhaseValue(currentPhase);
    const prevPhase = prevPhaseRef.current;
    
    // Detect countdown -> work transition for special handling
    const isCountdownToWork = prevPhase === 'countdown' && currentPhase === 'work';
    
    Animated.timing(phaseTransitionAnim, {
      toValue: targetValue,
      duration: isCountdownToWork ? 350 : 300, // Faster transition
      useNativeDriver: false,
      easing: Easing.out(Easing.exp), // Exponential ease-out for dramatic deceleration
    }).start();
    
    prevPhaseRef.current = currentPhase;
  }, [currentPhase, phaseTransitionAnim]);

  // Flash animation for countdown
  useEffect(() => {
    if (currentPhase === 'countdown' && secondsRemaining > 0) {
      // Reset to large scale and low opacity
      countdownFlashAnim.setValue(1.3);
      countdownOpacityAnim.setValue(0.3);
      
      // Animate back to normal with a bounce
      Animated.parallel([
        Animated.spring(countdownFlashAnim, {
          toValue: 1,
          useNativeDriver: false,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(countdownOpacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [currentPhase, secondsRemaining, countdownFlashAnim, countdownOpacityAnim]);

  // Animate urgency state when time reaches 5 seconds
  useEffect(() => {
    if (currentPhase === 'work' || currentPhase === 'workRest' || currentPhase === 'roundRest') {
      const isUrgent = secondsRemaining <= 5;
      Animated.timing(urgencyAnim, {
        toValue: isUrgent ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
        easing: Easing.inOut(Easing.ease),
      }).start();
    } else {
      urgencyAnim.setValue(0);
    }
  }, [currentPhase, secondsRemaining, urgencyAnim]);

  // Animate progress bar (flex values)
  useEffect(() => {
    if (!timer || currentPhase === 'countdown' || currentPhase === 'complete') {
      // During countdown, progressAnim is 1.0 (full time remaining)
      // During complete, progressAnim is 0 (no time remaining)
      progressAnim.setValue(currentPhase === 'countdown' ? 1.0 : 0);
      return;
    }

    let totalPhaseSeconds = 0;
    if (currentPhase === 'work') totalPhaseSeconds = timer.work;
    else if (currentPhase === 'workRest') totalPhaseSeconds = timer.workRest;
    else if (currentPhase === 'roundRest') totalPhaseSeconds = timer.roundRest;

    const clampedProgress = totalPhaseSeconds > 0 ? secondsRemaining / totalPhaseSeconds : 0;

    const isPhaseTransition = prevPhaseRef.current !== currentPhase;
    const isWorkToRest = (prevPhaseRef.current === 'work' && (currentPhase === 'workRest' || currentPhase === 'roundRest'));

    Animated.timing(progressAnim, {
      toValue: clampedProgress,
      duration: (isPhaseTransition && !isWorkToRest) ? 0 : 1000, // Smooth transition for work->rest
      useNativeDriver: false,
      easing: (t) => t, // Linear easing
    }).start();
  }, [secondsRemaining, currentPhase, timer, progressAnim]);

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

  // Calculate total workout time (excluding countdown)
  const getTotalWorkoutTime = () => {
    if (!timer) return 0;
    const totalWorkTime = timer.work * timer.sets * timer.rounds;
    // Work rest after each set except the last set of each round
    const totalWorkRestTime = timer.workRest * (timer.sets - 1) * timer.rounds;
    const totalRoundRestTime = timer.roundRest * (timer.rounds - 1); // Last round has no rest
    return totalWorkTime + totalWorkRestTime + totalRoundRestTime;
  };

  // Calculate remaining workout time (excluding countdown)
  const getRemainingWorkoutTime = () => {
    if (!timer) return 0;
    if (currentPhase === 'complete') return 0;
    if (currentPhase === 'countdown') return getTotalWorkoutTime(); // Show full time during countdown

    let remaining = 0;

    // Add remaining time in current phase
    remaining += secondsRemaining;

    // Add remaining sets in current round (after current set)
    if (currentPhase === 'work') {
      // If not the last set of the round, add rest after this work
      if (currentSet < timer.sets) {
        remaining += timer.workRest;
      }
      // Add all remaining sets after current (each has work + rest, except last set has no rest)
      const setsAfterCurrent = timer.sets - currentSet;
      if (setsAfterCurrent > 0) {
        remaining += timer.work * setsAfterCurrent;
        remaining += timer.workRest * (setsAfterCurrent - 1); // No rest after last set
      }
    } else if (currentPhase === 'workRest') {
      // Add all remaining sets after current (each has work + rest, except last set has no rest)
      const setsAfterCurrent = timer.sets - currentSet;
      if (setsAfterCurrent > 0) {
        remaining += timer.work * setsAfterCurrent;
        remaining += timer.workRest * (setsAfterCurrent - 1); // No rest after last set
      }
    }

    // Add remaining rounds (after current round)
    if (currentRound < timer.rounds) {
      const remainingRounds = timer.rounds - currentRound;
      // Each remaining round has all sets with their rests
      remaining += (timer.work * timer.sets) * remainingRounds;
      remaining += (timer.workRest * (timer.sets - 1)) * remainingRounds;
      // Plus round rest between rounds (but not after the last round)
      remaining += timer.roundRest * (remainingRounds - 1);
      
      // If we're not in roundRest yet and not in the last round, add round rest
      if (currentPhase !== 'roundRest' && currentRound < timer.rounds) {
        remaining += timer.roundRest;
      }
    }
    
    return remaining;
  };

  const handleMenu = () => {
    Alert.alert(
      'Timer Options',
      '',
      [
        {
          text: 'Delete Timer',
          onPress: () => {
            Alert.alert(
              'Delete Timer',
              'Are you sure you want to delete this timer?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    if (timerId) {
                      deleteHIITTimer(timerId);
                      navigation.goBack();
                    }
                  },
                },
              ]
            );
          },
          style: 'destructive',
        },
        {
          text: 'Duplicate Timer',
          onPress: () => {
            if (timer) {
              const newTimerId = `hiit-${Date.now()}`;
              const duplicatedTimer = {
                ...timer,
                id: newTimerId,
                name: `${timer.name} 2`,
                createdAt: new Date().toISOString(),
              };
              addHIITTimer(duplicatedTimer);
              navigation.replace('HIITTimerForm', { timerId: newTimerId });
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
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
            <TouchableOpacity onPress={handleMenu} style={styles.menuButton}>
              <View style={styles.menuDot} />
              <View style={styles.menuDot} />
              <View style={styles.menuDot} />
            </TouchableOpacity>
          </View>
          
          {/* Page Title and Set/Round Info */}
          <View style={styles.headerInfoContainer}>
            <View style={styles.headerInfoLeft}>
            <Text style={styles.pageTitle}>{timer.name}</Text>
              <Text style={styles.progressInfo}>
                <Text style={styles.progressLabel}>Set </Text>
                <Text style={styles.progressValue}>{currentSet}/{timer.sets}</Text>
                <Text style={styles.progressLabel}>     Round </Text>
                <Text style={styles.progressValue}>{currentRound}/{timer.rounds}</Text>
              </Text>
              </View>
            
            {/* Total Time - right aligned */}
            <View style={styles.totalTimeContainer}>
              <Text style={styles.totalTimeText}>{formatTime(getRemainingWorkoutTime())}</Text>
              <Svg height="16" width="16" viewBox="0 0 16 16" style={styles.totalTimeCircle}>
                {(() => {
                  const progress = getTotalWorkoutTime() > 0 ? getRemainingWorkoutTime() / getTotalWorkoutTime() : 0;
                  const isFullCircle = progress >= 0.999;
                  
                  return (
                    <>
                      {/* Background circle */}
                      <Circle
                        cx="8"
                        cy="8"
                        r="8"
                        fill={LIGHT_COLORS.border}
                      />
                      {/* Progress pie - starts full and drains */}
                      {isFullCircle ? (
                        <Circle
                          cx="8"
                          cy="8"
                          r="8"
                          fill={LIGHT_COLORS.text}
                        />
                      ) : progress > 0 ? (
                        <Path
                          d={`M 8 8 L 8 0 A 8 8 0 ${progress > 0.5 ? 1 : 0} 1 ${
                            8 + 8 * Math.sin(2 * Math.PI * progress)
                          } ${
                            8 - 8 * Math.cos(2 * Math.PI * progress)
                          } Z`}
                          fill={LIGHT_COLORS.text}
                        />
                      ) : null}
                    </>
                  );
                })()}
              </Svg>
            </View>
            </View>
          </View>

        <View style={styles.content}>

          {/* Timer Blocks */}
          <View style={styles.timerBlocksContainer}>
            {currentPhase === 'complete' ? (
              // Complete Phase: Show completion message
              <View style={[styles.timerBlock, { backgroundColor: '#227132', flex: 1 }]}>
                <Text style={[styles.currentPhaseTime, { color: '#FFFFFF' }]}>
                  Complete!
                </Text>
          </View>
            ) : (
              // Two-block vertical layout: Always render two blocks, animate properties
              <>
                {/* Top Block */}
                <Animated.View 
                  style={[
                    styles.timerBlock,
                    {
                      backgroundColor: 
                        currentPhase === 'countdown' 
                          ? '#FDB022' // Countdown yellow
                          : currentPhase === 'work'
                            ? urgencyAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [LIGHT_COLORS.secondary, COLORS.accentPrimary], // Animate from black to orange
                              })
                            : '#CDCABB', // Rest phase (inactive - gray)
                      flex: (currentPhase === 'countdown' || currentPhase === 'work') 
                        ? Animated.add(
                            Animated.multiply(
                              progressAnim.interpolate({
                                inputRange: [0.1, 1],
                                outputRange: [0.25, 0.8],
                                extrapolate: 'clamp',
                              }),
                              phaseTransitionAnim.interpolate({
                                inputRange: [-1, 0],
                                outputRange: [0, 1],
                                extrapolate: 'clamp',
                              })
                            ),
                            phaseTransitionAnim.interpolate({
                              inputRange: [-1, 0],
                              outputRange: [1, 0],
                              extrapolate: 'clamp',
                            })
                          )
                        : progressAnim.interpolate({
                            inputRange: [0.1, 1],
                            outputRange: [0.75, 0.25],
                            extrapolate: 'clamp',
                          }),
                      borderBottomLeftRadius: phaseTransitionAnim.interpolate({
                        inputRange: [-1, 0],
                        outputRange: [32, 0],
                        extrapolate: 'clamp',
                      }),
                      borderBottomRightRadius: phaseTransitionAnim.interpolate({
                        inputRange: [-1, 0],
                        outputRange: [32, 0],
                        extrapolate: 'clamp',
                      }),
                      marginBottom: phaseTransitionAnim.interpolate({
                        inputRange: [-1, 0, 1],
                        outputRange: [0, 4, 4],
                        extrapolate: 'clamp',
                      }),
                    },
                  ]}
                >
                  <Animated.Text 
                    style={[
                      styles.currentPhaseTime, 
                      { 
                        color: (currentPhase === 'countdown' || currentPhase === 'work') 
                          ? '#FFFFFF' 
                          : phaseTransitionAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['#FFFFFF', '#817B77'],
                            }),
                        fontSize: (currentPhase === 'countdown' || currentPhase === 'work') 
                          ? phaseTransitionAnim.interpolate({
                              inputRange: [-1, 0, 1],
                              outputRange: [72, 72, 28],
                            })
                          : TYPOGRAPHY.h3.fontSize, // Use h3 for "Move" label
                        transform: currentPhase === 'countdown' ? [{ scale: countdownFlashAnim }] : [],
                        opacity: currentPhase === 'countdown' ? countdownOpacityAnim : 1,
                      }
                    ]}
                  >
                    {currentPhase === 'countdown' 
                      ? secondsRemaining 
                      : (currentPhase === 'work' ? formatTime(secondsRemaining) : 'Move')
                    }
                  </Animated.Text>
                </Animated.View>
                
                {/* Bottom Block */}
                <Animated.View 
                  style={[
                    styles.timerBlock,
                    {
                      backgroundColor: (currentPhase === 'workRest' || currentPhase === 'roundRest') 
                        ? urgencyAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['#FDB022', COLORS.accentPrimary], // Animate from yellow to orange
                          })
                        : '#CDCABB', // Inactive rest block
                      flex: (currentPhase === 'countdown' || currentPhase === 'work')
                        ? Animated.multiply(
                            progressAnim.interpolate({
                              inputRange: [0.1, 1],
                              outputRange: [0.75, 0.2],
                              extrapolate: 'clamp',
                            }),
                            phaseTransitionAnim.interpolate({
                              inputRange: [-1, 0],
                              outputRange: [0, 1],
                              extrapolate: 'clamp',
                            })
                          )
                        : progressAnim.interpolate({
                            inputRange: [0.1, 1],
                            outputRange: [0.25, 0.75],
                            extrapolate: 'clamp',
                          }),
                      maxHeight: phaseTransitionAnim.interpolate({
                        inputRange: [-1, -0.5, 0],
                        outputRange: [0, 5000, 10000],
                        extrapolate: 'clamp',
                      }),
                      borderTopLeftRadius: 0,
                      borderTopRightRadius: 0,
                      overflow: 'hidden',
                    },
                  ]}
                >
                  <Animated.Text 
                    style={[
                      styles.currentPhaseTime,
                      {
                        color: (currentPhase === 'workRest' || currentPhase === 'roundRest') 
                          ? '#FFFFFF' // White text on yellow/orange background
                          : LIGHT_COLORS.textMeta,
                        fontSize: (currentPhase === 'workRest' || currentPhase === 'roundRest')
                          ? phaseTransitionAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [28, 72],
                            })
                          : TYPOGRAPHY.h3.fontSize, // Use h3 for "Rest" label
                        opacity: phaseTransitionAnim.interpolate({
                          inputRange: [-1, -0.7, 0],
                          outputRange: [0, 0, 1],
                          extrapolate: 'clamp',
                        }),
                      }
                    ]}
                  >
                    {(currentPhase === 'workRest' || currentPhase === 'roundRest') 
                      ? formatTime(secondsRemaining) 
                      : 'Rest'
                    }
                  </Animated.Text>
                </Animated.View>
              </>
            )}
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

            {/* Play/Pause Button */}
            <TouchableOpacity
              onPress={handlePlayPause}
              style={[BUTTONS.primaryButtonNoLabel, styles.playPauseButton]}
              activeOpacity={0.8}
            >
              {isRunning ? (
                <IconPause size={32} color={'#FFFFFF'} />
              ) : (
                <IconPlay size={32} color={'#FFFFFF'} />
              )}
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
    marginLeft: -4,
  },
  menuButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginRight: -4,
    gap: 4,
  },
  menuDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: LIGHT_COLORS.secondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xxl,
    justifyContent: 'flex-start',
    paddingBottom: 176, // Space for button (80px height + 48px from bottom + 48px gap)
  },
  headerInfoContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md, // Matches other leaf pages
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end', // Align to baseline
  },
  headerInfoLeft: {
    flexDirection: 'column',
    gap: 8, // Space between title and set/round info
    flex: 1, // Take remaining space
  },
  pageTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.text,
  },
  progressInfo: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
  },
  progressLabel: {
    color: LIGHT_COLORS.textMeta,
  },
  progressValue: {
    color: LIGHT_COLORS.text,
  },
  totalTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // Space between time text and circle
  },
  totalTimeText: {
    ...TYPOGRAPHY.body, // Matches set/round indicator style
    color: LIGHT_COLORS.text,
  },
  totalTimeCircle: {
    width: 16,
    height: 16,
  },
  timerBlocksContainer: {
    width: '100%',
    flex: 1, // Take remaining space
    marginTop: 48, // 48px gap between set/round info and blocks
  },
  timerBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    borderCurve: 'continuous',
  },
  currentPhaseTime: {
    fontSize: 72,
    fontWeight: '300',
    textAlign: 'center',
  },
  nextPhaseTime: {
    fontSize: 28,
    fontWeight: '300',
    color: LIGHT_COLORS.textMeta,
    textAlign: 'center',
  },
  stickyButtonContainer: {
    position: 'absolute',
    bottom: 48, // 48px from bottom of block
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20, // Space between buttons
    paddingHorizontal: SPACING.xxl,
  },
  playPauseButton: {
    backgroundColor: LIGHT_COLORS.secondary,
  },
  sideButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: LIGHT_COLORS.backgroundCanvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideButtonTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.secondary,
    textAlign: 'center',
    marginTop: SPACING.xxl,
  },
});


