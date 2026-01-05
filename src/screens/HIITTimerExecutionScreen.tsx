import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { COLORS, SPACING, TYPOGRAPHY, GRADIENTS, BUTTONS, BORDER_RADIUS } from '../constants';
import { IconArrowLeft, IconPlay, IconPause, IconSpeaker, IconSkip, IconRestart, IconMenu } from '../components/icons';
import { DropdownMenu } from '../components/DropdownMenu';
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
  const [menuVisible, setMenuVisible] = useState(false);
  
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
    // Skip animation during transitions to prevent crashes
    if (isTransitioningRef.current) return;
    
    if (currentPhase === 'complete') {
      // Don't shrink on complete
      Animated.timing(sizeAnim, {
        toValue: 0.6, // Stay at medium size
        duration: 600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true, // Use native driver for better performance
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
      useNativeDriver: true, // Use native driver for better performance
    }).start();
  }, [secondsRemaining, currentPhase, sizeAnim]);

  // Animate phase transitions (color and reset to 100%)
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    
    // Set initial color on mount
    if (prevPhase === null) {
      let initialColorValue = 0;
      if (currentPhase === 'countdown') initialColorValue = 0;
      else if (currentPhase === 'work') initialColorValue = 1;
      else if (currentPhase === 'workRest' || currentPhase === 'roundRest') initialColorValue = 2;
      else if (currentPhase === 'complete') initialColorValue = 3;
      
      colorAnim.setValue(initialColorValue);
      
      prevPhaseRef.current = currentPhase;
      return;
    }
    
    if (prevPhase !== currentPhase) {
      // Add a small delay to let React finish the current render cycle
      const timer = setTimeout(() => {
        try {
          // Phase transition - animate back to 100% size (fast start, slow deceleration)
          Animated.timing(sizeAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.out(Easing.exp), // Fast start, slow deceleration
            useNativeDriver: true, // Use native driver for better performance
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
            try {
              Animated.timing(borderRadiusAnim, {
                toValue: 32, // Rounded rectangle
                duration: 600,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: false,
              }).start(() => {
                // Trigger confetti after shape morph
                triggerConfetti();
              });
            } catch (error) {
              console.log('⚠️ Error morphing shape:', error);
              triggerConfetti(); // Still trigger confetti even if morph fails
            }
          } else {
            borderRadiusAnim.setValue(CONTAINER_WIDTH / 2); // Reset to circle
          }
        } catch (error) {
          console.log('⚠️ Error in phase transition animation:', error);
        }
      }, 100); // Small delay to let React finish rendering
      
      prevPhaseRef.current = currentPhase;
      
      return () => clearTimeout(timer);
    }
  }, [currentPhase, sizeAnim, colorAnim, borderRadiusAnim, triggerConfetti]);

  // Load audio files
  useEffect(() => {
    const loadAudio = async () => {
      try {
        // Configure audio mode for iOS
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: false,
        });
        
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

  // Store handlePhaseComplete in a ref to avoid recreating interval
  const handlePhaseCompleteRef = useRef(handlePhaseComplete);
  useEffect(() => {
    handlePhaseCompleteRef.current = handlePhaseComplete;
  }, [handlePhaseComplete]);

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
            setTimeout(() => handlePhaseCompleteRef.current(), 0);
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
  }, [isRunning, soundEnabled]);

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
      
      // Use requestAnimationFrame to ensure smooth transition
      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            // Batch state updates to minimize re-renders
            setShowGo(false);
            
            // Use a second RAF to split the updates
            requestAnimationFrame(() => {
      setCurrentPhase('work');
      setSecondsRemaining(timer.work);
        isTransitioningRef.current = false;
            });
          } catch (error) {
            console.log('⚠️ Error transitioning from countdown:', error);
            isTransitioningRef.current = false;
          }
        }, 400);
      });
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
  const triggerConfetti = useCallback(() => {
    // Don't trigger confetti during phase transitions
    if (isTransitioningRef.current) {
      console.log('⚠️ Skipping confetti during transition');
      return;
    }
    
    try {
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
      
      // Clear particles after animation
      setTimeout(() => setParticles([]), 1600);
    } catch (error) {
      console.log('⚠️ Error triggering confetti:', error);
    }
  }, []);

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
    
    // Auto-start after a brief delay
    setTimeout(() => {
      setIsRunning(true);
    }, 200);
  };

  const handleMenu = () => {
    setMenuVisible(!menuVisible);
  };

  const handleEdit = () => {
    setMenuVisible(false);
    if (timerId) {
      // Stop timer before navigating to edit
      setIsRunning(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      navigation.navigate('HIITTimerForm', { timerId });
    }
  };

  const handleDelete = () => {
    setMenuVisible(false);
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
              // Stop all running operations before deleting
            setIsRunning(false);
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              
              // Stop all animations
              sizeAnim.stopAnimation();
              colorAnim.stopAnimation();
              borderRadiusAnim.stopAnimation();
              sideButtonsAnim.stopAnimation();
              
              // Delete and navigate back
              deleteHIITTimer(timerId);
              navigation.goBack();
            }
          },
        },
      ]
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

  // Memoize interpolations to prevent recreation on every render
  const animatedScale = useMemo(() => {
    const minScale = MIN_SIZE / CONTAINER_WIDTH;
    return sizeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [minScale, 1],
    });
  }, [sizeAnim]);

  // Inverse scale for text to keep it fixed size
  const textScale = useMemo(() => {
    const minScale = MIN_SIZE / CONTAINER_WIDTH;
    return sizeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1 / minScale, 1], // Inverse of the circle scale
    });
  }, [sizeAnim]);

  // Get background color based on current phase (direct approach for reliability)
  const getBackgroundColor = () => {
    switch (currentPhase) {
      case 'countdown':
        return PHASE_COLORS.countdown;
      case 'work':
        return PHASE_COLORS.work;
      case 'workRest':
      case 'roundRest':
        return PHASE_COLORS.rest;
      case 'complete':
        return PHASE_COLORS.complete;
      default:
        return PHASE_COLORS.countdown;
    }
  };

  const currentBackgroundColor = getBackgroundColor();
  console.log(`🎨 Current phase: ${currentPhase}, color: ${currentBackgroundColor}`);

  // Memoize pie chart progress to prevent errors during phase transitions
  const pieChartProgress = useMemo(() => {
    if (!timer) return 0;
    const total = getTotalWorkoutTime();
    const remaining = getRemainingWorkoutTime();
    if (total <= 0 || remaining < 0) return 0;
    const progress = remaining / total;
    // Ensure progress is between 0 and 1
    return Math.max(0, Math.min(1, progress));
  }, [timer, currentPhase, currentSet, currentRound, secondsRemaining]);

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
              <IconMenu size={24} color={LIGHT_COLORS.text} />
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
                {/* Background circle */}
                <Circle
                  cx="8"
                  cy="8"
                  r="8"
                  fill={LIGHT_COLORS.border}
                />
                {/* Progress pie - starts full and drains */}
                {pieChartProgress >= 0.999 ? (
                  <Circle
                    cx="8"
                    cy="8"
                    r="8"
                    fill={LIGHT_COLORS.text}
                  />
                ) : pieChartProgress > 0 ? (
                  <Path
                    d={`M 8 8 L 8 0 A 8 8 0 ${pieChartProgress > 0.5 ? 1 : 0} 1 ${
                      8 + 8 * Math.sin(2 * Math.PI * pieChartProgress)
                    } ${
                      8 - 8 * Math.cos(2 * Math.PI * pieChartProgress)
                    } Z`}
                    fill={LIGHT_COLORS.text}
                  />
                ) : null}
              </Svg>
            </View>
            </View>
          </View>

        {/* Dropdown Menu */}
        <DropdownMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          top={insets.top + 48}
          right={18}
          items={[
            { label: 'Edit', onPress: handleEdit },
            { label: 'Delete', onPress: handleDelete, destructive: true },
          ]}
        />

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
                borderRadius: borderRadiusAnim,
                backgroundColor: currentBackgroundColor,
                transform: [{ scale: animatedScale }],
              },
            ]}
          >
            {currentPhase === 'complete' ? (
              <Animated.View style={{ transform: [{ scale: textScale }] }}>
                <Text style={styles.completeText}>{getDisplayText()}</Text>
                {getSubtitleText() && (
                  <Text style={styles.subtitleText}>{getSubtitleText()}</Text>
                )}
              </Animated.View>
            ) : (
              <Animated.Text style={[styles.timerText, { transform: [{ scale: textScale }] }]}>
                {getDisplayText()}
              </Animated.Text>
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
    width: CONTAINER_WIDTH,
    height: CONTAINER_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    borderCurve: 'continuous',
  },
  timerText: {
    fontSize: 56,
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
