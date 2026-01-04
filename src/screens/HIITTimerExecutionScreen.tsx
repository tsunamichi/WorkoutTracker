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
import { IconArrowLeft, IconPlay, IconPause, IconSpeaker, IconSkip, IconRestart } from '../components/icons';
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

const PHASE_COLORS = {
  countdown: '#FDB022', // Yellow
  work: '#5E9EFF', // Blue
  rest: '#FF6B6B', // Red
  complete: '#227132', // Green
};

const MIN_SIZE = 180;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CONTAINER_WIDTH = SCREEN_WIDTH - (SPACING.xxl * 2);

interface Particle {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  rotation: Animated.Value;
  color: string;
  size: number;
}

export default function HIITTimerExecutionScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { timerId } = route.params;
  const { hiitTimers, deleteHIITTimer } = useStore();
  
  const timer = hiitTimers.find(t => t.id === timerId);
  
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
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.errorText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }
  
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentPhase, setCurrentPhase] = useState<TimerPhase>('countdown');
  const [currentSet, setCurrentSet] = useState(1);
  const [currentRound, setCurrentRound] = useState(1);
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const [showGo, setShowGo] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownSoundRef = useRef<Audio.Sound | null>(null);
  const completeSoundRef = useRef<Audio.Sound | null>(null);
  const lastPlayedSecondRef = useRef<number | null>(null);
  const isTransitioningRef = useRef(false);
  
  // Refs to track current state for callbacks (avoid stale closures)
  const currentPhaseRef = useRef<TimerPhase>(currentPhase);
  const currentSetRef = useRef(currentSet);
  const currentRoundRef = useRef(currentRound);
  
  // Animated values
  const sizeAnim = useRef(new Animated.Value(1)).current; // 1 = 100%, 0 = MIN_SIZE
  const colorAnim = useRef(new Animated.Value(0)).current; // For color transitions
  const borderRadiusAnim = useRef(new Animated.Value(CONTAINER_WIDTH / 2)).current; // Circle to rounded rect
  const sideButtonsAnim = useRef(new Animated.Value(0)).current;
  const celebrationPulseAnim = useRef(new Animated.Value(1)).current; // For pulsing celebration
  
  // Track previous phase for color interpolation
  const prevPhaseRef = useRef<TimerPhase>('countdown');

  // Update refs whenever state changes
  useEffect(() => {
    currentPhaseRef.current = currentPhase;
    currentSetRef.current = currentSet;
    currentRoundRef.current = currentRound;
  }, [currentPhase, currentSet, currentRound]);

  // Get total seconds for current phase
  const getTotalSeconds = () => {
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

  // Animate size based on time remaining
  useEffect(() => {
    if (currentPhase === 'complete') {
      // Don't shrink on complete
      Animated.timing(sizeAnim, {
        toValue: 0.6, // Stay at medium size
        duration: 600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }).start();
      return;
    }

    const totalSeconds = getTotalSeconds();
    const progress = totalSeconds > 0 ? secondsRemaining / totalSeconds : 0;
    
    // Animate size smoothly based on progress
    Animated.timing(sizeAnim, {
      toValue: progress,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [secondsRemaining, currentPhase, sizeAnim]);

  // Animate phase transitions (color and reset to 100%)
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    
    if (prevPhase !== currentPhase) {
      // Phase transition - animate back to 100% size (fast start, slow deceleration)
      Animated.timing(sizeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.exp), // Fast start, slow deceleration
        useNativeDriver: false,
      }).start();
      
      // Animate color transition
      let colorValue = 0;
      switch (currentPhase) {
        case 'countdown':
          colorValue = 0;
          break;
        case 'work':
          colorValue = 1;
          break;
        case 'workRest':
        case 'roundRest':
          colorValue = 2;
          break;
        case 'complete':
          colorValue = 3;
          break;
      }
      
      Animated.timing(colorAnim, {
        toValue: colorValue,
        duration: 600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }).start();
      
      // Morph shape on complete
      if (currentPhase === 'complete') {
        Animated.timing(borderRadiusAnim, {
          toValue: 32, // Rounded rectangle
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }).start(() => {
          // Trigger confetti after shape morph
          triggerConfetti();
        });
      } else {
        borderRadiusAnim.setValue(CONTAINER_WIDTH / 2); // Reset to circle
      }
      
      prevPhaseRef.current = currentPhase;
    }
  }, [currentPhase, sizeAnim, colorAnim, borderRadiusAnim]);

  // Load audio files
  useEffect(() => {
    const loadAudio = async () => {
      try {
        const { sound: countdownSound } = await Audio.Sound.createAsync(
          require('../../assets/sounds/countdown.mp3')
        );
        const { sound: completeSound } = await Audio.Sound.createAsync(
          require('../../assets/sounds/complete.mp3')
        );
        countdownSoundRef.current = countdownSound;
        completeSoundRef.current = completeSound;
      } catch (error) {
        console.log('⚠️ Error loading sounds:', error);
      }
    };

    loadAudio();

    return () => {
      // Cleanup sounds
      countdownSoundRef.current?.unloadAsync();
      completeSoundRef.current?.unloadAsync();
    };
  }, []);

  // Show side buttons after first start (hide on complete)
  useEffect(() => {
    Animated.spring(sideButtonsAnim, {
      toValue: (isRunning && currentPhase !== 'complete') ? 1 : 0,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
  }, [isRunning, currentPhase, sideButtonsAnim]);

  // Stop celebration animation when leaving complete phase
  useEffect(() => {
    if (currentPhase !== 'complete') {
      celebrationPulseAnim.stopAnimation(() => {
        celebrationPulseAnim.setValue(1);
      });
    }
  }, [currentPhase, celebrationPulseAnim]);

  // Timer interval
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsRemaining(prev => {
          const newTime = prev - 1;
          
          // Play countdown sound at 3, 2, 1
          if (soundEnabled && (newTime === 3 || newTime === 2 || newTime === 1) && lastPlayedSecondRef.current !== newTime) {
            lastPlayedSecondRef.current = newTime;
            if (countdownSoundRef.current) {
              countdownSoundRef.current.setPositionAsync(0).then(() => {
                return countdownSoundRef.current?.playAsync();
              }).catch((error) => {
                console.log('⚠️ Error playing countdown sound:', error);
              });
            }
          }
          
          if (newTime <= 0 && !isTransitioningRef.current) {
            setTimeout(() => handlePhaseComplete(), 0);
            return 0;
          }
          return newTime;
        });
      }, 1000);
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
  }, [isRunning, handlePhaseComplete, soundEnabled]);

  // Handle phase completion
  const handlePhaseComplete = useCallback(() => {
    if (!timer || isTransitioningRef.current) return;

    isTransitioningRef.current = true;
    lastPlayedSecondRef.current = null;

    const phase = currentPhaseRef.current;
    const set = currentSetRef.current;
    const round = currentRoundRef.current;

    console.log('🎯 Phase complete:', phase, 'Set:', set, 'Round:', round);

    // Play completion sound for non-countdown phases
    if (soundEnabled && phase !== 'countdown' && completeSoundRef.current) {
      completeSoundRef.current.setPositionAsync(0).then(() => {
        return completeSoundRef.current?.playAsync();
      }).catch((error) => {
        console.log('⚠️ Error playing completion sound:', error);
      });
    }

    if (phase === 'countdown') {
      // Show "Go!" briefly before transitioning
      setShowGo(true);
      
      setTimeout(() => {
        setShowGo(false);
        setCurrentPhase('work');
        setSecondsRemaining(timer.work);
        isTransitioningRef.current = false;
      }, 400);
    } else if (phase === 'work') {
      const isLastSet = set === timer.sets;
      const isLastRound = round === timer.rounds;
      
      console.log('💪 Work complete - isLastSet:', isLastSet, 'isLastRound:', isLastRound);
      
      if (isLastSet && isLastRound) {
        // Workout complete - stop timer
        console.log('🏁 Workout complete!');
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setCurrentPhase('complete');
        setIsRunning(false);
        isTransitioningRef.current = false;
      } else {
        // Move to work rest - continue without stopping
        console.log('⏸️ Moving to work rest');
        setCurrentPhase('workRest');
        setSecondsRemaining(timer.workRest);
        setTimeout(() => {
          isTransitioningRef.current = false;
        }, 50);
      }
    } else if (phase === 'workRest') {
      console.log('⏸️ Work rest complete');
      if (set < timer.sets) {
        // Next set - continue without stopping
        console.log('➡️ Next set:', set + 1);
        setCurrentSet(prev => prev + 1);
        setCurrentPhase('work');
        setSecondsRemaining(timer.work);
      } else if (round < timer.rounds) {
        // Round rest - continue without stopping
        console.log('🔄 Moving to round rest');
        setCurrentPhase('roundRest');
        setSecondsRemaining(timer.roundRest);
      }
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 50);
    } else if (phase === 'roundRest') {
      console.log('🔄 Round rest complete');
      // New round - continue without stopping
      console.log('➡️ Next round:', round + 1);
      setCurrentRound(prev => prev + 1);
      setCurrentSet(1);
      setCurrentPhase('work');
      setSecondsRemaining(timer.work);
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 50);
    }
  }, [timer, soundEnabled]);

  // Trigger confetti
  const triggerConfetti = () => {
    const particleCount = 50; // More particles!
    const colors = ['#227132', '#5E9EFF', '#FDB022', '#FF6B6B']; // Green, Blue, Yellow, Red
    
    const newParticles: Particle[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
      const distance = 120 + Math.random() * 150;
      const duration = 1200 + Math.random() * 400;
      
      const particle: Particle = {
        id: Date.now() + i,
        x: new Animated.Value(0),
        y: new Animated.Value(0),
        opacity: new Animated.Value(1),
        rotation: new Animated.Value(0),
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 8, // Varied sizes 6-14px
      };
      
      // Animate particle with varied trajectories
      Animated.parallel([
        Animated.timing(particle.x, {
          toValue: Math.cos(angle) * distance,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(particle.y, {
          toValue: Math.sin(angle) * distance + 80, // More gravity effect
          duration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(particle.opacity, {
          toValue: 0,
          duration: duration * 0.8,
          delay: duration * 0.2,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(particle.rotation, {
          toValue: (Math.random() - 0.5) * 6,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]).start();
      
      newParticles.push(particle);
    }
    
    setParticles(newParticles);
    
    // Start celebration pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(celebrationPulseAnim, {
          toValue: 1.05,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false, // Must be false since sizeAnim uses width/height
        }),
        Animated.timing(celebrationPulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false, // Must be false since sizeAnim uses width/height
        }),
      ])
    ).start();
    
    // Clear particles after animation
    setTimeout(() => setParticles([]), 1600);
  };

  const handlePlayPause = () => {
    setIsRunning(prev => {
      if (!prev) {
        lastPlayedSecondRef.current = null;
        isTransitioningRef.current = false;
      }
      return !prev;
    });
  };

  const handleRestart = () => {
    // Reset to initial state
    setIsRunning(false);
    setCurrentPhase('countdown');
    setCurrentSet(1);
    setCurrentRound(1);
    setSecondsRemaining(5);
    setShowGo(false);
    setParticles([]);
    isTransitioningRef.current = false;
    lastPlayedSecondRef.current = null;
    
    // Stop and reset animated values
    sizeAnim.stopAnimation(() => {
      sizeAnim.setValue(1);
    });
    colorAnim.stopAnimation(() => {
      colorAnim.setValue(0);
    });
    borderRadiusAnim.stopAnimation(() => {
      borderRadiusAnim.setValue(CONTAINER_WIDTH / 2);
    });
    celebrationPulseAnim.stopAnimation(() => {
      celebrationPulseAnim.setValue(1);
    });
    
    // Auto-start after a brief delay
    setTimeout(() => {
      setIsRunning(true);
    }, 200);
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
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const handleToggleSound = () => {
    setSoundEnabled(prev => !prev);
  };

  const handleSkip = () => {
    if (!timer) return;
    
    setIsRunning(false);
    setTimeout(() => {
      handlePhaseComplete();
      if (currentPhase !== 'complete') {
        setIsRunning(true);
      }
    }, 100);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate total workout time (excluding countdown)
  const getTotalWorkoutTime = () => {
    if (!timer) return 0;
    const totalWorkTime = timer.work * timer.sets * timer.rounds;
    const totalWorkRestTime = timer.workRest * (timer.sets - 1) * timer.rounds;
    const totalRoundRestTime = timer.roundRest * (timer.rounds - 1);
    return totalWorkTime + totalWorkRestTime + totalRoundRestTime;
  };

  // Calculate remaining workout time (excluding countdown)
  const getRemainingWorkoutTime = () => {
    if (!timer) return 0;
    if (currentPhase === 'complete') return 0;
    if (currentPhase === 'countdown') return getTotalWorkoutTime();

    let remaining = 0;

    // Add remaining time in current phase
    remaining += secondsRemaining;

    // Add remaining sets in current round (after current set)
    if (currentPhase === 'work') {
      if (currentSet < timer.sets) {
        remaining += timer.workRest;
      }
      const setsAfterCurrent = timer.sets - currentSet;
      if (setsAfterCurrent > 0) {
        remaining += timer.work * setsAfterCurrent;
        remaining += timer.workRest * (setsAfterCurrent - 1);
      }
    } else if (currentPhase === 'workRest') {
      const setsAfterCurrent = timer.sets - currentSet;
      if (setsAfterCurrent > 0) {
        remaining += timer.work * setsAfterCurrent;
        remaining += timer.workRest * (setsAfterCurrent - 1);
      }
    }

    // Add remaining rounds (after current round)
    if (currentRound < timer.rounds) {
      const remainingRounds = timer.rounds - currentRound;
      remaining += (timer.work * timer.sets) * remainingRounds;
      remaining += (timer.workRest * (timer.sets - 1)) * remainingRounds;
      remaining += timer.roundRest * (remainingRounds - 1);
      
      if (currentPhase !== 'roundRest' && currentRound < timer.rounds) {
        remaining += timer.roundRest;
      }
    }
    
    return remaining;
  };

  const getDisplayText = () => {
    if (showGo) return 'Go!';
    if (currentPhase === 'countdown') return secondsRemaining.toString();
    if (currentPhase === 'complete') return 'Workout complete';
    return formatTime(secondsRemaining);
  };

  const getSubtitleText = () => {
    if (currentPhase === 'complete') return 'Nice work';
    return null;
  };

  // Interpolate size
  const animatedSize = sizeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [MIN_SIZE, CONTAINER_WIDTH],
  });

  // Interpolate color
  const backgroundColor = colorAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [
      PHASE_COLORS.countdown,
      PHASE_COLORS.work,
      PHASE_COLORS.rest,
      PHASE_COLORS.complete,
    ],
  });

  return (
    <LinearGradient
      colors={GRADIENTS.backgroundLight.colors}
      start={GRADIENTS.backgroundLight.start}
      end={GRADIENTS.backgroundLight.end}
      style={styles.container}
    >
      <View style={[styles.innerContainer, { paddingBottom: insets.bottom }]}>
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

        {/* Timer Circle */}
        <View style={styles.timerContainer}>
          {/* Confetti particles */}
          {particles.map(particle => (
            <Animated.View
              key={particle.id}
              style={[
                styles.particle,
                {
                  width: particle.size,
                  height: particle.size,
                  borderRadius: particle.size / 2,
                  backgroundColor: particle.color,
                  transform: [
                    { translateX: particle.x },
                    { translateY: particle.y },
                    { rotate: particle.rotation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    }) },
                  ],
                  opacity: particle.opacity,
                },
              ]}
            />
          ))}
          
          {/* Circle shape */}
          <Animated.View
            style={[
              styles.circle,
              {
                width: animatedSize,
                height: animatedSize,
                borderRadius: borderRadiusAnim,
                backgroundColor,
                transform: currentPhase === 'complete' ? [{ scale: celebrationPulseAnim }] : [],
              },
            ]}
          >
            {currentPhase === 'complete' ? (
              <>
                <Text style={styles.completeText}>{getDisplayText()}</Text>
                {getSubtitleText() && (
                  <Text style={styles.subtitleText}>{getSubtitleText()}</Text>
                )}
              </>
            ) : (
              <Text style={styles.timerText}>{getDisplayText()}</Text>
            )}
          </Animated.View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
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
                      outputRange: [50, 0],
                    }),
                  },
                  { scale: sideButtonsAnim },
                ],
              },
            ]}
              pointerEvents={(isRunning && currentPhase !== 'complete') ? 'auto' : 'none'}
          >
            <TouchableOpacity
              onPress={handleToggleSound}
              style={styles.sideButtonTouchable}
              activeOpacity={0.7}
            >
              <IconSpeaker size={24} color={LIGHT_COLORS.textSecondary} muted={!soundEnabled} />
            </TouchableOpacity>
          </Animated.View>

          {/* Play/Pause/Restart Button */}
          <TouchableOpacity
            onPress={currentPhase === 'complete' ? handleRestart : handlePlayPause}
            style={[BUTTONS.primaryButtonNoLabel, styles.playPauseButton]}
            activeOpacity={0.8}
          >
            {currentPhase === 'complete' ? (
              <IconRestart size={32} color={'#FFFFFF'} />
            ) : isRunning ? (
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
                      outputRange: [-50, 0],
                    }),
                  },
                  { scale: sideButtonsAnim },
                ],
              },
            ]}
              pointerEvents={(isRunning && currentPhase !== 'complete') ? 'auto' : 'none'}
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
  headerInfoContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerInfoLeft: {
    flexDirection: 'column',
    gap: 8,
    flex: 1,
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
    gap: 8,
  },
  totalTimeText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.text,
  },
  totalTimeCircle: {
    width: 16,
    height: 16,
  },
  timerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  circle: {
    justifyContent: 'center',
    alignItems: 'center',
    borderCurve: 'continuous',
  },
  timerText: {
    fontSize: 72,
    fontWeight: '300',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  completeText: {
    ...TYPOGRAPHY.h2,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitleText: {
    ...TYPOGRAPHY.h3,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: SPACING.md,
    opacity: 0.9,
  },
  particle: {
    position: 'absolute',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 48,
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
