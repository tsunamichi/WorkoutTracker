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
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import Svg, { Circle, Path } from 'react-native-svg';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, GRADIENTS, BUTTONS, BORDER_RADIUS } from '../constants';
import { IconArrowLeft, IconMenu, IconEdit, IconTrash } from '../components/icons';
import { ActionSheet } from '../components/common/ActionSheet';
import { TimerControls } from '../components/timer/TimerControls';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { AppState } from 'react-native';

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
  countdown: COLORS.signalWarning,
  work: '#1B1B1B', // Black
  restYellow: COLORS.signalWarning,
  restRed: COLORS.signalNegative,
  complete: COLORS.signalPositive,
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
  const { hiitTimers, deleteHIITTimer, addHIITTimerSession, setActiveHIITTimer } = useStore();
  
  // Get timer reactively - will update when hiitTimers changes
  const timer = React.useMemo(() => {
    const foundTimer = hiitTimers.find(t => t.id === timerId);
    console.log('🔄 Timer memo updated:', {
      timerId,
      found: !!foundTimer,
      values: foundTimer ? {
        work: foundTimer.work,
        workRest: foundTimer.workRest,
        sets: foundTimer.sets,
        rounds: foundTimer.rounds,
        roundRest: foundTimer.roundRest,
      } : null
    });
    return foundTimer;
  }, [hiitTimers, timerId]);
  
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentPhase, setCurrentPhase] = useState<TimerPhase>('countdown');
  const [currentSet, setCurrentSet] = useState(1);
  const [currentRound, setCurrentRound] = useState(1);
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const [showGo, setShowGo] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);
  
  // Track if timer has been started (to determine if we need to show reset confirmation)
  const hasStartedRef = useRef(false);
  
  // Store initial timer values to detect changes
  const initialTimerRef = useRef(timer ? {
    work: timer.work,
    workRest: timer.workRest,
    sets: timer.sets,
    rounds: timer.rounds,
    roundRest: timer.roundRest,
  } : null);
  
  // Navigate back if timer is deleted
  useEffect(() => {
    if (!timer) {
      console.log('⚠️ Timer not found, navigating back');
      navigation.goBack();
    }
  }, [timer, navigation]);
  
  // Keep screen awake while timer is running
  useEffect(() => {
    if (isRunning) {
      activateKeepAwakeAsync('timer-running');
    } else {
      deactivateKeepAwake('timer-running');
    }
    
    // Cleanup on unmount
    return () => {
      deactivateKeepAwake('timer-running');
    };
  }, [isRunning]);
  
  // Reload timer values when returning from edit screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('👁️ Timer screen focused, checking for changes...');
      
      // If timer or initial ref is null, skip change detection
      if (!timer || !initialTimerRef.current) {
        return;
      }
      
      // Check if timer values have changed
      const hasChanged = 
        initialTimerRef.current.work !== timer.work ||
        initialTimerRef.current.workRest !== timer.workRest ||
        initialTimerRef.current.sets !== timer.sets ||
        initialTimerRef.current.rounds !== timer.rounds ||
        initialTimerRef.current.roundRest !== timer.roundRest;
      
      console.log('🔍 Timer values check:', {
        hasChanged,
        old: initialTimerRef.current,
        new: { work: timer.work, workRest: timer.workRest, sets: timer.sets, rounds: timer.rounds, roundRest: timer.roundRest }
      });
      
      // Always reload if values changed (reset happens after user confirmation in form)
      if (hasChanged) {
        console.log('🔄 Timer values changed, resetting...');
        console.log('🔄 Current timer object:', {
          work: timer.work,
          workRest: timer.workRest,
          sets: timer.sets,
          rounds: timer.rounds,
          roundRest: timer.roundRest,
        });
        
        // Stop any running timers
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        // Clear active timer status (should already be cleared by form, but ensure it here)
        setActiveHIITTimer(null);
        
        // Reset to initial state with new values
        setIsRunning(false);
        setCurrentPhase('countdown');
        setCurrentSet(1);
        setCurrentRound(1);
        setSecondsRemaining(5);
        setShowGo(false);
        hasStartedRef.current = false;
        
        // Update initial timer ref to new values
        initialTimerRef.current = {
          work: timer.work,
          workRest: timer.workRest,
          sets: timer.sets,
          rounds: timer.rounds,
          roundRest: timer.roundRest,
        };
        
        console.log('✅ Timer reset complete with new values', initialTimerRef.current);
      }
    });
    
    return unsubscribe;
  }, [navigation, timer, timerId, setActiveHIITTimer]);
  
  // Mark timer as active when it starts (even if paused later)
  useEffect(() => {
    console.log('⏯️ isRunning changed:', { 
      isRunning, 
      timerId, 
      hasStarted: hasStartedRef.current,
      currentPhase 
    });
    if (isRunning && !hasStartedRef.current) {
      // Only mark as active the first time user presses play
      hasStartedRef.current = true;
      setActiveHIITTimer(timerId);
      console.log('🔴 Timer marked as ACTIVE:', timerId);
    }
  }, [isRunning, timerId, setActiveHIITTimer, currentPhase]);
  
  // Clear active timer only when component unmounts IF timer hasn't been started
  useEffect(() => {
    return () => {
      // Only clear if timer was never started
      if (!hasStartedRef.current) {
        console.log('🟢 Clearing active timer on unmount (never started)');
        setActiveHIITTimer(null);
      } else {
        console.log('⏸️ Timer screen unmounting but timer was started, keeping active status');
      }
    };
  }, [timerId, setActiveHIITTimer]);
  
  // Clear active timer when timer completes
  useEffect(() => {
    if (currentPhase === 'complete') {
      console.log('✅ Timer complete, clearing active status');
      setActiveHIITTimer(null);
      hasStartedRef.current = false;
    }
  }, [currentPhase, setActiveHIITTimer]);
  
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
  const sizeAnim = useRef(new Animated.Value(1)).current; // 1 = 100%, 0 = MIN_SIZE (JS driver for width/height)
  const textSizeAnim = useRef(new Animated.Value(1)).current; // Separate value for text scale (native driver)
  const colorAnim = useRef(new Animated.Value(0)).current; // For color transitions
  const borderRadiusAnim = useRef(new Animated.Value(CONTAINER_WIDTH / 2)).current;
  const breathingAnim = useRef(new Animated.Value(1)).current; // For breathing main circle during rest
  const textOpacityAnim = useRef(new Animated.Value(1)).current; // For countdown number fade transitions
  const textShrinkAnim = useRef(new Animated.Value(1)).current; // For countdown number shrink (1 to 0.8 = 20% shrink)
  const restColorAnim = useRef(new Animated.Value(0)).current; // For yellow to red transition during rest (0 = yellow, 1 = red)

  // Track previous phase and seconds for animations
  const prevPhaseRef = useRef<TimerPhase>('countdown');
  const prevSecondsRef = useRef<number>(secondsRemaining);

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

  // Animate size based on time remaining (circle shrinks as time consumes)
  useEffect(() => {
    // Skip animation during transitions to prevent crashes
    if (isTransitioningRef.current) return;
    
    // Stop any running animations first to prevent conflicts
    sizeAnim.stopAnimation(() => {
      textSizeAnim.stopAnimation(() => {
    if (currentPhase === 'complete') {
      // Shrink quickly to disappear
          Animated.parallel([
      Animated.timing(sizeAnim, {
        toValue: 0, // Shrink to 0
              duration: 400, // Fast shrink
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false, // JS driver for width/height
            }),
            Animated.timing(textSizeAnim, {
              toValue: 0,
              duration: 400,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true, // Native driver for transform
            }),
          ]).start();
      return;
    }

        // All phases (countdown, work, rest): shrink continuously as time passes
    const totalSeconds = getTotalSeconds();
    const progress = totalSeconds > 0 ? secondsRemaining / totalSeconds : 0;
    
        // Animate both size values in parallel for all phases
        Animated.parallel([
    Animated.timing(sizeAnim, {
      toValue: progress,
      duration: 1000,
      easing: Easing.linear,
            useNativeDriver: false, // JS driver for width/height
          }),
          Animated.timing(textSizeAnim, {
            toValue: progress,
            duration: 1000,
            easing: Easing.linear,
            useNativeDriver: true, // Native driver for transform
          }),
        ]).start();
      });
    });
  }, [secondsRemaining, currentPhase, sizeAnim, textSizeAnim]);

  // Countdown number fade and shrink animation (each number fades out and shrinks 20%)
  useEffect(() => {
    if (currentPhase === 'countdown' && secondsRemaining !== prevSecondsRef.current && !showGo) {
      // Fade out and shrink, then fade back in at original size (but not for "Go!")
      Animated.parallel([
        Animated.timing(textOpacityAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(textShrinkAnim, {
          toValue: 0.8, // Shrink to 80% (20% reduction)
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Reset to original size and fade in
        textShrinkAnim.setValue(1); // Reset to original size
        Animated.timing(textOpacityAnim, {
          toValue: 1,
          duration: 150,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
    }).start();
      });
    }
    prevSecondsRef.current = secondsRemaining;
  }, [secondsRemaining, currentPhase, showGo, textOpacityAnim, textShrinkAnim]);

  // Breathing animation on main circle during rest (when timer is running)
  useEffect(() => {
    // Only manage breathing animation for rest phases
    if (currentPhase === 'workRest' || currentPhase === 'roundRest') {
      if (!isRunning) {
        console.log('⏸️ Timer paused during rest - freezing breathing animation at current value');
        // Just stop the animation, don't reset to 1 (this preserves the current visual state)
        breathingAnim.stopAnimation();
      } else {
        console.log('▶️ Timer running during rest - resuming breathing animation smoothly');
        // Stop any existing animation and resume from current value
        breathingAnim.stopAnimation((currentValue) => {
          console.log('   Current breathingAnim value:', currentValue);
          
          // Smoothly transition to normal size first, then start the breathing loop
          Animated.sequence([
            // First, smoothly return to normal (1) from wherever we are
            Animated.timing(breathingAnim, {
              toValue: 1,
              duration: 500, // Quick but smooth return to normal
              easing: Easing.out(Easing.ease),
              useNativeDriver: false,
            }),
            // Then start the breathing loop
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
            ),
          ]).start();
        });
      }
    }
    // For non-rest phases, don't touch breathingAnim (it should remain at 1 from phase transition)
  }, [isRunning, currentPhase, breathingAnim]);

  // Yellow to red color transition during rest (when 5 seconds or less remain)
  useEffect(() => {
    if (currentPhase === 'workRest' || currentPhase === 'roundRest') {
      const targetValue = secondsRemaining <= 5 ? 1 : 0; // 1 = red, 0 = yellow
      Animated.timing(restColorAnim, {
        toValue: targetValue,
        duration: 600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }).start();
    } else {
      // Reset to yellow for non-rest phases
      restColorAnim.setValue(0);
    }
  }, [secondsRemaining, currentPhase, restColorAnim]);

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
          // Stop any running animations first to prevent driver conflicts
          sizeAnim.stopAnimation();
          textSizeAnim.stopAnimation();
          
          // Morph shape based on phase
          console.log('🔄 Phase transition to:', currentPhase);
          
          // Check if transitioning from rest to work (needs shrink→expand animation)
          const isRestToWork = (prevPhase === 'workRest' || prevPhase === 'roundRest') && currentPhase === 'work';
          
          // Prepare animations array
          const animations = [];
          
          // Size reset animation
          if (isRestToWork) {
            console.log('💥 Rest to Work - wait 80ms then QUICK explosive expand!');
            // Already at 50% from rest phase, rest for 80ms, then explosive expand to 100%
            setTimeout(() => {
              Animated.parallel([
          Animated.timing(sizeAnim, {
                  toValue: 1, // Expand to 100%
                  duration: 180, // Very quick expand
                  easing: Easing.out(Easing.back(1.7)), // Strong overshoot for explosive bounce
                  useNativeDriver: false,
                }),
                Animated.timing(textSizeAnim, {
            toValue: 1,
                  duration: 180, // Very quick expand
                  easing: Easing.out(Easing.back(1.7)),
                  useNativeDriver: true,
                }),
              ]).start();
            }, 80); // 80ms rest at 50% before expanding
          } else {
            // Normal size reset animation
            animations.push(
              Animated.timing(sizeAnim, {
                toValue: 1,
                duration: 300, // Fast transition
                easing: Easing.bezier(0.4, 0.0, 0.2, 1),
                useNativeDriver: false, // JS driver for width/height
              }),
              Animated.timing(textSizeAnim, {
                toValue: 1,
                duration: 300,
                easing: Easing.bezier(0.4, 0.0, 0.2, 1),
                useNativeDriver: true, // Native driver for transform
              })
            );
          }
          
          // Color transition
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
          
          const colorDuration = isRestToWork ? 300 : 300; // Same fast timing
          animations.push(
          Animated.timing(colorAnim, {
            toValue: colorValue,
              duration: colorDuration,
              easing: Easing.bezier(0.4, 0.0, 0.2, 1),
            useNativeDriver: false,
            })
          );
          
          // Shape morph animation
          if (currentPhase === 'complete') {
            console.log('✅ Complete phase - rounded rectangle');
            // Stop breathing animation if running
            breathingAnim.stopAnimation(() => {
              breathingAnim.setValue(1);
            });
            
            animations.push(
              Animated.timing(borderRadiusAnim, {
                toValue: 32, // Rounded rectangle
                duration: 300, // Fast transition
                easing: Easing.bezier(0.4, 0.0, 0.2, 1),
                useNativeDriver: false,
              })
            );
            
            // Run all animations in parallel
            Animated.parallel(animations).start(() => {
                // Trigger confetti after shape morph
                triggerConfetti();
              });
          } else if (currentPhase === 'work') {
            console.log('🟧 Work phase - morphing to SQUIRCLE');
            // Squircle shape for work phase
            breathingAnim.stopAnimation(() => {
              breathingAnim.setValue(1);
            });
            
            const squircleRadius = CONTAINER_WIDTH * 0.24;
            console.log('   Border radius:', squircleRadius, 'Container width:', CONTAINER_WIDTH);
            
            const shapeDuration = 300; // Fast timing for all transitions
            animations.push(
              Animated.timing(borderRadiusAnim, {
                toValue: squircleRadius, // Squircle (24% of width for smooth rounded square)
                duration: shapeDuration,
                easing: Easing.bezier(0.4, 0.0, 0.2, 1),
                useNativeDriver: false,
              })
            );
            
            // Run all animations simultaneously
            Animated.parallel(animations).start(() => {
              console.log('🟧 Squircle transition complete');
            });
          } else if (currentPhase === 'workRest' || currentPhase === 'roundRest') {
            console.log('🔵 Rest phase - morphing to CIRCLE with BREATHING');
            // Circle with breathing for rest phases (breathing controlled by separate useEffect)
            // Reset rest color to yellow when entering rest phase
            restColorAnim.setValue(0);
            
            animations.push(
              Animated.timing(borderRadiusAnim, {
                toValue: CONTAINER_WIDTH / 2, // Full circle
                duration: 300, // Fast transition
                easing: Easing.bezier(0.4, 0.0, 0.2, 1),
                useNativeDriver: false,
              })
            );
            
            // Run all animations simultaneously
            Animated.parallel(animations).start();
          } else {
            console.log('⏱️ Countdown/other phase - default circle');
            // Countdown or other phases - circle, no breathing
            breathingAnim.stopAnimation(() => {
              breathingAnim.setValue(1);
            });
            borderRadiusAnim.setValue(CONTAINER_WIDTH / 2);
            // Reset text animations for countdown
            if (currentPhase === 'countdown') {
              textOpacityAnim.setValue(1);
              textShrinkAnim.setValue(1);
            }
            
            // Run size/color animations
            if (animations.length > 0) {
              Animated.parallel(animations).start();
            }
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


  // Handle phase completion - MUST be defined before effects that use it
  const handlePhaseComplete = useCallback(() => {
    console.log('🔥 handlePhaseComplete called with timer:', {
      work: timer?.work,
      workRest: timer?.workRest,
      sets: timer?.sets,
      rounds: timer?.rounds,
    });
    
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
      // Show "Go!" for half a second, then transition fast
      setShowGo(true);
      textOpacityAnim.setValue(1);
      
      // Wait 500ms, then fade out over 200ms
      setTimeout(() => {
        Animated.timing(textOpacityAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
      }, 500);
      
      // Use requestAnimationFrame to ensure smooth transition
      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            // Batch state updates to minimize re-renders
            setShowGo(false);
            textOpacityAnim.setValue(1); // Reset for next phase
            
            // Use a second RAF to split the updates
            requestAnimationFrame(() => {
      console.log('🟦 Transitioning to WORK phase, duration:', timer.work, 'seconds');
      setCurrentPhase('work');
      setSecondsRemaining(timer.work);
        
        isTransitioningRef.current = false;
            });
          } catch (error) {
            console.log('⚠️ Error transitioning from countdown:', error);
            isTransitioningRef.current = false;
          }
        }, 600); // 500ms display + 100ms buffer (shape transition starts immediately)
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
        
        // Save the completed session
        // Calculate total time based on timer template (excluding countdown)
        const totalWorkTime = timer.work * timer.sets * timer.rounds;
        const totalWorkRestTime = timer.workRest * (timer.sets - 1) * timer.rounds; // Rest BETWEEN sets only
        const totalRoundRestTime = timer.roundRest * (timer.rounds - 1); // Rest BETWEEN rounds only
        const totalDuration = totalWorkTime + totalWorkRestTime + totalRoundRestTime;
        const today = dayjs().format('YYYY-MM-DD');
        
        console.log('⏰ Timer completed:', {
          totalDuration: totalDuration + ' seconds',
          work: `${timer.work}s × ${timer.sets} sets × ${timer.rounds} rounds = ${totalWorkTime}s`,
          workRest: `${timer.workRest}s × ${timer.sets - 1} × ${timer.rounds} = ${totalWorkRestTime}s`,
          roundRest: `${timer.roundRest}s × ${timer.rounds - 1} = ${totalRoundRestTime}s`,
        });
        
        const session = {
          id: `hiit-session-${Date.now()}`,
          timerId: timer.id,
          timerName: timer.name,
          date: today,
          completedAt: new Date().toISOString(),
          totalDuration,
        };
        
        addHIITTimerSession(session);
        console.log('💾 Saved HIIT timer session:', session);
        
        setCurrentPhase('complete');
        setIsRunning(false);
        isTransitioningRef.current = false;
      } else {
        // Move to work rest - continue without stopping
        console.log('⏸️ Moving to work rest, duration:', timer.workRest, 'seconds');
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
  }, [timer, soundEnabled, setCurrentPhase, setSecondsRemaining, setCurrentSet, setCurrentRound, setIsRunning, setShowGo, textOpacityAnim, addHIITTimerSession, timerId]);

  // Log when handlePhaseComplete recreates
  const handlePhaseCompleteIdRef = useRef(0);
  useEffect(() => {
    handlePhaseCompleteIdRef.current += 1;
    console.log('🆕 handlePhaseComplete recreated (ID:', handlePhaseCompleteIdRef.current, ') with timer:', {
      work: timer?.work,
      workRest: timer?.workRest,
    });
  }, [handlePhaseComplete, timer]);

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
  }, [isRunning, soundEnabled, handlePhaseComplete]);

  // Pause timer when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' && isRunning) {
        console.log('📱 App going to background - pausing HIIT timer');
        setIsRunning(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isRunning]);

  // Trigger confetti
  const triggerConfetti = useCallback(() => {
    // Don't trigger confetti during phase transitions
    if (isTransitioningRef.current) {
      console.log('⚠️ Skipping confetti during transition');
      return;
    }
    
    try {
      const particleCount = 50; // More particles!
      const colors = [COLORS.signalPositive, '#5E9EFF', COLORS.signalWarning, COLORS.signalNegative];
      
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
    const wasRunning = isRunning;
    
    setIsRunning(prev => {
      if (!prev) {
        // Starting/resuming
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
    breathingAnim.stopAnimation(() => {
      breathingAnim.setValue(1);
    });
    restColorAnim.stopAnimation(() => {
      restColorAnim.setValue(0);
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
      console.log('✏️ Navigating to edit timer', { 
        timerId, 
        hasStarted: hasStartedRef.current,
        isRunning,
        currentPhase 
      });
      // Stop timer before navigating to edit
      setIsRunning(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      navigation.navigate('HIITTimerForm', { mode: 'edit', timerId });
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
              breathingAnim.stopAnimation();
              restColorAnim.stopAnimation();
              
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

  const handleBack = () => {
    // Check if timer has been started (not in initial state)
    const timerHasStarted = currentPhase !== 'countdown' || currentSet !== 1 || currentRound !== 1 || secondsRemaining !== 5;
    
    if (timerHasStarted && currentPhase !== 'complete') {
      // Store current running state in ref for alert callbacks
      const wasRunningRef = { current: isRunning };
      
      // Pause the timer if it's running
      if (isRunning) {
        setIsRunning(false);
      }
      
      // Show confirmation dialog
      Alert.alert(
        'Exit Interval',
        'Are you sure you want to exit? Your progress will be lost.',
        [
          {
            text: 'Resume',
            style: 'cancel',
            onPress: () => {
              // Resume the timer if it was running before
              if (wasRunningRef.current) {
                setIsRunning(true);
              }
            },
          },
          {
            text: 'Exit',
            style: 'destructive',
            onPress: () => {
              // Stop all running operations
              setIsRunning(false);
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              
              // Stop all animations
              sizeAnim.stopAnimation();
              colorAnim.stopAnimation();
              borderRadiusAnim.stopAnimation();
              breathingAnim.stopAnimation();
              restColorAnim.stopAnimation();
              
              navigation.goBack();
            },
          },
        ]
      );
    } else {
      // Timer hasn't started or is complete, just go back
      navigation.goBack();
    }
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
  const animatedSize = useMemo(() => {
    return sizeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [MIN_SIZE, CONTAINER_WIDTH],
    });
  }, [sizeAnim]);

  // Border radius ratio (as a fraction of container width)
  const borderRadiusRatio = useMemo(() => {
    return borderRadiusAnim.interpolate({
      inputRange: [32, CONTAINER_WIDTH * 0.24, CONTAINER_WIDTH / 2],
      outputRange: [32 / CONTAINER_WIDTH, 0.24, 0.5],
      extrapolate: 'clamp',
    });
  }, [borderRadiusAnim]);

  // Scaled border radius that maintains shape proportions
  const scaledBorderRadius = useMemo(() => {
    return Animated.multiply(animatedSize, borderRadiusRatio);
  }, [animatedSize, borderRadiusRatio]);

  // Inverse scale for text to keep it fixed size (native driver)
  const textScale = useMemo(() => {
    const minScale = MIN_SIZE / CONTAINER_WIDTH;
    return textSizeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1 / minScale, 1], // Inverse of the circle scale
    });
  }, [textSizeAnim]);

  // Get background color based on current phase
  const currentBackgroundColor = useMemo(() => {
    if (currentPhase === 'workRest' || currentPhase === 'roundRest') {
      // Interpolate between yellow and red during rest
      return restColorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [PHASE_COLORS.restYellow, PHASE_COLORS.restRed],
      });
    }
    
    switch (currentPhase) {
      case 'countdown':
        return PHASE_COLORS.countdown;
      case 'work':
        return PHASE_COLORS.work;
      case 'complete':
        return PHASE_COLORS.complete;
      default:
        return PHASE_COLORS.countdown;
    }
  }, [currentPhase, restColorAnim]);

  console.log(`🎨 Current phase: ${currentPhase}, seconds: ${secondsRemaining}`);

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

  // Show empty state if timer is not found (will navigate back via useEffect)
  if (!timer) {
    return (
      <View style={styles.container}>
        <View style={styles.innerContainer} />
      </View>
    );
  }

    return (
      <View style={styles.container}>
      <View style={[styles.innerContainer, { paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
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

        {/* Action Sheet Menu */}
        <ActionSheet
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          items={[
            { 
              icon: <IconTrash size={24} color={COLORS.signalNegative} />,
              label: 'Delete', 
              onPress: handleDelete, 
              destructive: true 
            },
            { 
              icon: <IconEdit size={24} color={LIGHT_COLORS.text} />,
              label: 'Edit', 
              onPress: handleEdit
            },
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
          
          {/* Main timer circle - using width/height, with breathing during rest */}
          {currentPhase !== 'complete' && (
          <Animated.View
            style={[
              styles.circle,
              {
                width: Animated.multiply(animatedSize, breathingAnim), // Animate width with breathing
                height: Animated.multiply(animatedSize, breathingAnim), // Animate height with breathing
                borderRadius: Animated.multiply(scaledBorderRadius, breathingAnim), // Proportional border radius with breathing
                backgroundColor: currentBackgroundColor,
              },
            ]}
          >
            {/* Content container for text scaling */}
            <View
              style={{
                width: '100%',
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center',
              }}
          >
            {currentPhase === 'countdown' ? (
                showGo ? (
                  // "Go!" - show for 500ms then fade out
                  <Animated.Text 
                    style={[
                      styles.timerText,
                      { 
                        opacity: textOpacityAnim,
                      }
                    ]}
                  >
                    {getDisplayText()}
                  </Animated.Text>
                ) : (
                  // Countdown numbers - fade and shrink
                  <Animated.Text 
                    style={[
                      styles.timerText, 
                      { 
                        transform: [{ scale: textShrinkAnim }], // Shrink 20% as fading out
                        opacity: textOpacityAnim, // Fade animation for countdown
                      }
                    ]}
                  >
                {getDisplayText()}
              </Animated.Text>
                )
              ) : currentPhase !== 'complete' ? (
                // Work and rest phases - text stays fixed size (no scale transform)
                <Text style={styles.timerText}>
                  {getDisplayText()}
                </Text>
              ) : null}
            </View>
          </Animated.View>
          )}
          
          {/* Complete message on canvas (outside the circle) */}
          {currentPhase === 'complete' && (
            <View style={styles.completeMessageContainer}>
                <Text style={styles.completeText}>{getDisplayText()}</Text>
                {getSubtitleText() && (
                  <Text style={styles.subtitleText}>{getSubtitleText()}</Text>
                )}
            </View>
          )}
          </View>

        {/* Controls */}
        <TimerControls
          isRunning={isRunning && currentPhase !== 'complete'}
          soundEnabled={soundEnabled}
          onTogglePause={handlePlayPause}
          onToggleSound={handleToggleSound}
          onSkip={handleSkip}
          showRestart={currentPhase === 'complete'}
          onRestart={handleRestart}
          hideControlsWhenPaused={true}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
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
  completeMessageContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  completeText: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.text,
    textAlign: 'center',
  },
  subtitleText: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.md,
    opacity: 0.9,
  },
  particle: {
    position: 'absolute',
  },
  errorText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.secondary,
    textAlign: 'center',
    marginTop: SPACING.xxl,
  },
});
