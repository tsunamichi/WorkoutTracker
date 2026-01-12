import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useStore } from '../../store';
import { SPACING, TYPOGRAPHY, COLORS } from '../../constants';

const CIRCLE_SIZE = 40;

const REST_COLOR_YELLOW = '#FFD60A';
const REST_COLOR_RED = '#FF453A';

interface MiniTimerProps {
  onExpand: () => void;
}

export function MiniTimer({ onExpand }: MiniTimerProps) {
  const insets = useSafeAreaInsets();
  const restTimerMinimized = useStore((state) => state.restTimerMinimized);
  const restTimerTimeLeft = useStore((state) => state.restTimerTimeLeft);
  const restTimerTotalTime = useStore((state) => state.restTimerTotalTime);
  const restTimerOnComplete = useStore((state) => state.restTimerOnComplete);
  const restTimerExerciseId = useStore((state) => state.restTimerExerciseId);
  const restTimerWorkoutKey = useStore((state) => state.restTimerWorkoutKey);
  const clearRestTimerData = useStore((state) => state.clearRestTimerData);
  const setRestTimerData = useStore((state) => state.setRestTimerData);
  const settings = useStore((state) => state.settings);
  const { exercises, cycles, getExerciseProgress } = useStore();
  
  const [timeLeft, setTimeLeft] = useState(restTimerTimeLeft);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const slideAnim = useRef(new Animated.Value(0)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;
  
  // Get exercise information
  const getExerciseInfo = () => {
    if (!restTimerExerciseId || !restTimerWorkoutKey) return { name: '', currentSet: 1, totalSets: 3 };
    
    // Parse workout key to get template ID
    const parts = restTimerWorkoutKey.split('-');
    const workoutTemplateId = parts.slice(0, -3).join('-');
    const cycleIdMatch = workoutTemplateId.match(/cycle-\d+/);
    const cycleId = cycleIdMatch ? cycleIdMatch[0] : null;
    
    if (!cycleId) return { name: '', currentSet: 1, totalSets: 3 };
    
    // Find the workout template and exercise
    const cycle = cycles.find(c => c.id === cycleId);
    const workoutTemplate = cycle?.workoutTemplates.find(w => w.id === workoutTemplateId);
    const templateExercise = workoutTemplate?.exercises.find(e => e.id === restTimerExerciseId);
    const exerciseData = exercises.find(e => e.id === templateExercise?.exerciseId);
    
    // Get exercise progress to determine current set
    const progress = getExerciseProgress(restTimerWorkoutKey, restTimerExerciseId);
    const completedSets = progress?.sets.filter(s => s.completed).length || 0;
    const currentSet = completedSets + 1;
    const totalSets = templateExercise?.targetSets || 3;
    
    return {
      name: exerciseData?.name || '',
      currentSet,
      totalSets,
    };
  };
  
  const exerciseInfo = getExerciseInfo();
  
  // Animate in when minimized
  useEffect(() => {
    if (restTimerMinimized) {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }).start();
      
      // Start breathing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(breatheAnim, {
            toValue: 1.1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(breatheAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }).start();
      breatheAnim.stopAnimation();
      breatheAnim.setValue(1);
    }
  }, [restTimerMinimized]);
  
  // Timer countdown
  useEffect(() => {
    if (!restTimerMinimized) return;
    
    setTimeLeft(restTimerTimeLeft);
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev <= 1 ? 0 : prev - 1;
        
        if (newTime === 0) {
          // Timer complete
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimerComplete();
        } else {
          // Update store with new time
          setRestTimerData(newTime, restTimerTotalTime, restTimerOnComplete, restTimerExerciseId || undefined, restTimerWorkoutKey || undefined);
        }
        
        return newTime;
      });
    }, 1000);
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [restTimerMinimized, restTimerTimeLeft, restTimerTotalTime, restTimerOnComplete, setRestTimerData]);
  
  const handleTimerComplete = async () => {
    // Play completion sound
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../../assets/sounds/complete.mp3')
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.log('Error playing sound:', error);
    }
    
    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Call the onComplete callback if it exists
    if (restTimerOnComplete) {
      restTimerOnComplete();
    }
    
    // Clear the mini timer state
    clearRestTimerData();
  };
  
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Get background color based on time left (changes at 5 seconds)
  const backgroundColor = timeLeft <= 5 ? REST_COLOR_RED : REST_COLOR_YELLOW;
  
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 0],
  });
  
  if (!restTimerMinimized) return null;
  
  return (
    <Animated.View 
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom || SPACING.md,
          transform: [{ translateY }],
        }
      ]}
    >
      <TouchableOpacity
        style={styles.miniTimer}
        onPress={onExpand}
        activeOpacity={0.8}
      >
        {/* Left Column: Exercise Info */}
        <View style={styles.leftColumn}>
          <Text style={styles.exerciseName} numberOfLines={1}>
            {exerciseInfo.name}
          </Text>
          <Text style={styles.setLabel}>
            Set {exerciseInfo.currentSet} of {exerciseInfo.totalSets}
          </Text>
        </View>
        
        {/* Right Column: Timer Circle */}
        <View style={styles.circleWrapper}>
          {/* Filled circle with breathing animation */}
          <Animated.View 
            style={[
              styles.circle,
              { 
                backgroundColor,
                transform: [{ scale: breatheAnim }]
              }
            ]}
          />
          
          {/* Time text stays constant size, positioned absolutely on top */}
          <View style={styles.timeTextContainer}>
            <Text style={styles.timeText}>{formatTime(timeLeft)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xl, // 24px
    paddingTop: SPACING.md,
    backgroundColor: COLORS.backgroundContainer,
  },
  miniTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  leftColumn: {
    flex: 1,
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  exerciseName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    marginBottom: 2,
  },
  setLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  circleWrapper: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
  },
  timeTextContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'System',
  },
});

