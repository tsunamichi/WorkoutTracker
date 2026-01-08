import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Modal, ScrollView } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../store';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconCalendar, IconStopwatch, IconWorkouts } from '../components/icons';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Light theme colors for Today screen
const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  backgroundContainer: '#CDCABB',
  secondary: '#1B1B1B',
  textSecondary: '#3C3C43',
  textMeta: '#817B77',
  border: '#C7C7CC',
  accentPrimary: '#FD6B00',
  dayButtonActive: '#007AFF',
  dayButtonActiveText: '#FFFFFF',
  progressDot: '#D1D1D6',
  progressDotActive: '#000000',
};

interface TodayScreenProps {
  onNavigateToWorkouts?: () => void;
  onDateChange?: (isToday: boolean) => void;
}

export function TodayScreen({ onNavigateToWorkouts, onDateChange }: TodayScreenProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { cycles, workoutAssignments, getWorkoutCompletionPercentage, getExerciseProgress, swapWorkoutAssignments, getHIITTimerSessionsForDate } = useStore();
  const today = dayjs();
  
  // State for selected date (defaults to today)
  const [selectedDate, setSelectedDate] = useState(today.format('YYYY-MM-DD'));
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, 1 = next week, etc.
  const [isCardPressed, setIsCardPressed] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [previousWorkoutData, setPreviousWorkoutData] = useState<any>(null);
  const [showSwapSheet, setShowSwapSheet] = useState(false);
  const [isSwapSheetVisible, setIsSwapSheetVisible] = useState(false);
  
  // Animation values
  const oldCardTranslateX = useRef(new Animated.Value(0)).current;
  const newCardTranslateX = useRef(new Animated.Value(0)).current;
  const dayScales = useRef(DAYS_SHORT.map(() => new Animated.Value(1))).current;
  const [dayPositions, setDayPositions] = useState<number[]>([]);
  const previousDayIndex = useRef<number>(-1);
  const swapSheetTranslateY = useRef(new Animated.Value(1000)).current;
  const swapSheetBackdropOpacity = useRef(new Animated.Value(0)).current;
  
  // Find active cycle
  const activeCycle = cycles.find(c => c.isActive);
  
  // Clear selected day when there are no workouts created
  useEffect(() => {
    if (!activeCycle) {
      setSelectedDate('');
    }
  }, [activeCycle]);
  
  // Notify parent when viewing date changes
  useEffect(() => {
    if (onDateChange) {
      const isToday = selectedDate === today.format('YYYY-MM-DD');
      onDateChange(isToday);
    }
  }, [selectedDate, onDateChange]);
  
  console.log('📅 Today Screen Debug:');
  console.log('- Today date:', today.format('YYYY-MM-DD'));
  console.log('- Total cycles:', cycles.length);
  console.log('- Active cycle:', activeCycle?.id);
  console.log('- Active cycle details:', activeCycle ? {
      cycleNumber: activeCycle.cycleNumber,
      isActive: activeCycle.isActive,
      startDate: activeCycle.startDate,
      workoutTemplates: activeCycle.workoutTemplates.length
    } : 'none');
  console.log('- Total assignments:', workoutAssignments.length);
  console.log('- Assignments for active cycle:', workoutAssignments.filter(a => a.cycleId === activeCycle?.id).length);
  if (workoutAssignments.length > 0) {
    console.log('- Sample assignments:', workoutAssignments.slice(0, 3).map(a => ({
      date: a.date,
      cycleId: a.cycleId,
      workoutTemplateId: a.workoutTemplateId
    })));
  }
  
  // Calculate current week based on week offset
  const viewedWeekStart = today.startOf('isoWeek').add(weekOffset, 'week');
  const currentWeek = activeCycle 
    ? Math.floor(viewedWeekStart.diff(dayjs(activeCycle.startDate), 'week')) + 1
    : 0;
  
  // Get start of week based on offset (Monday)
  const weekStart = today.startOf('isoWeek').add(weekOffset, 'week');
  
  // Get workouts for this week
  const weekDays = DAYS_SHORT.map((dayLetter, index) => {
    const date = weekStart.add(index, 'day');
    const dateStr = date.format('YYYY-MM-DD');
    const isToday = date.isSame(today, 'day');
    
    // Find workout assignment for this date (only from active cycle)
    const assignment = workoutAssignments.find(a => 
      a.date === dateStr && 
      a.cycleId === activeCycle?.id
    );
    const workout = assignment && activeCycle
      ? activeCycle.workoutTemplates.find(w => w.id === assignment.workoutTemplateId)
      : null;
    
    // Check if workout is 100% complete
    const workoutKey = workout ? `${workout.id}-${dateStr}` : '';
    let totalSets = 0;
    if (workout) {
      workout.exercises.forEach(ex => {
        const progress = getExerciseProgress(workoutKey, ex.id);
        if (!progress?.skipped) {
          totalSets += ex.targetSets || 0;
        }
      });
    }
    const completionPercentage = workout ? getWorkoutCompletionPercentage(workoutKey, totalSets) : 0;
    const isCompleted = completionPercentage === 100;
    
    return {
      dayLetter,
      dayNumber: date.date(),
      date: dateStr,
      dateObj: date,
      isToday,
      workout,
      assignment,
      isCompleted,
    };
  });
  
  // Get selected day's workout
  const selectedDay = weekDays.find(d => d.date === selectedDate);
  const selectedDayIndex = weekDays.findIndex(d => d.date === selectedDate);
  
  // Animate button press effect when day changes
  useEffect(() => {
    if (selectedDayIndex !== -1) {
      // Unpress previous day (scale up slightly, then back to normal)
      if (previousDayIndex.current !== -1 && previousDayIndex.current !== selectedDayIndex) {
        Animated.sequence([
          Animated.spring(dayScales[previousDayIndex.current], {
            toValue: 1.05,
            useNativeDriver: true,
            tension: 200,
            friction: 25,
          }),
          Animated.spring(dayScales[previousDayIndex.current], {
            toValue: 1,
            useNativeDriver: true,
            tension: 200,
            friction: 25,
          }),
        ]).start();
      }
      
      // Press effect on new day: scale down then back up (subtle, starts fast, slows down)
      Animated.sequence([
        Animated.spring(dayScales[selectedDayIndex], {
          toValue: 0.95,
          useNativeDriver: true,
          tension: 200,
          friction: 25,
        }),
        Animated.spring(dayScales[selectedDayIndex], {
          toValue: 1,
          useNativeDriver: true,
          tension: 200,
          friction: 25,
        }),
      ]).start();
      
      // Update previous index
      previousDayIndex.current = selectedDayIndex;
      
      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [selectedDayIndex]);
  
  // Swap sheet animation
  useEffect(() => {
    if (showSwapSheet) {
      setIsSwapSheetVisible(true);
      Animated.parallel([
        Animated.spring(swapSheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(swapSheetBackdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(swapSheetTranslateY, {
          toValue: 1000,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(swapSheetBackdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsSwapSheetVisible(false);
      });
    }
  }, [showSwapSheet]);
  
  const handleDayChange = (newDate: string) => {
    const oldIndex = selectedDayIndex;
    const newIndex = weekDays.findIndex(d => d.date === newDate);
    
    if (newIndex !== -1 && oldIndex !== -1) {
      // Store previous workout data
      setPreviousWorkoutData(selectedDay);
      
      // Start transition
      setIsTransitioning(true);
      
      // Determine direction
      const direction = newIndex > oldIndex ? 1 : -1;
      const distance = 400;
      
      // Reset positions
      oldCardTranslateX.setValue(0);
      newCardTranslateX.setValue(distance * direction);
      
      // Animate both cards
      Animated.parallel([
        // Old card slides out
        Animated.timing(oldCardTranslateX, {
          toValue: -distance * direction,
          duration: 300,
          useNativeDriver: true,
        }),
        // New card slides in
        Animated.timing(newCardTranslateX, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Reset and clean up after animation
        setIsTransitioning(false);
        setPreviousWorkoutData(null);
        oldCardTranslateX.setValue(0);
        newCardTranslateX.setValue(0);
      });
    }
    
    setSelectedDate(newDate);
  };
  
  const handleWorkoutPress = () => {
    if (selectedDay?.workout && activeCycle) {
      navigation.navigate('WorkoutExecution', {
        cycleId: activeCycle.id,
        workoutTemplateId: selectedDay.workout.id,
        date: selectedDay.date,
      });
    }
  };
  
  const handleBackToToday = () => {
    setWeekOffset(0);
    setSelectedDate(today.format('YYYY-MM-DD'));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  
  // Handler for swipe gestures (runs on JS thread)
  const handleSwipe = (velocityX: number, translationX: number) => {
    // Only process swipes if not currently transitioning
    if (isTransitioning) return;
    
    const selectedDay = dayjs(selectedDate);
    const isSwipeRight = velocityX > 500 || translationX > 100;
    const isSwipeLeft = velocityX < -500 || translationX < -100;
    
    if (isSwipeRight) {
      // Swipe right - go to previous day
      const prevDay = selectedDay.subtract(1, 'day');
      
      // Check if we're moving to a different week
      if (prevDay.isoWeek() !== selectedDay.isoWeek() || prevDay.year() !== selectedDay.year()) {
        setWeekOffset(weekOffset - 1);
      }
      
      handleDayChange(prevDay.format('YYYY-MM-DD'));
    } else if (isSwipeLeft) {
      // Swipe left - go to next day
      const nextDay = selectedDay.add(1, 'day');
      
      // Check if we're moving to a different week
      if (nextDay.isoWeek() !== selectedDay.isoWeek() || nextDay.year() !== selectedDay.year()) {
        setWeekOffset(weekOffset + 1);
      }
      
      handleDayChange(nextDay.format('YYYY-MM-DD'));
    }
  };

  // Swipe gesture disabled (requires react-native-reanimated)
  
  // Match device corner radius (iPhone rounded corners)
  const deviceCornerRadius = insets.bottom > 0 ? 40 : 24;
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.gradient}>
        <SafeAreaView style={[styles.container, { paddingBottom: 88 }]} edges={[]}>
          {/* Header with Cycle Info and Avatar - Fixed - Always shown */}
          <View style={[styles.header, { paddingTop: insets.top }]}>
            <View style={styles.topBar}>
              <Text style={styles.headerTitle}>
                {activeCycle ? `Cycle ${activeCycle.cycleNumber} — Week ${currentWeek}` : 'Today'}
              </Text>
              <View style={styles.headerRight}>
                {activeCycle && weekOffset !== 0 && (
                  <TouchableOpacity
                    style={styles.calendarButton}
                    onPress={handleBackToToday}
                    activeOpacity={0.7}
                  >
                    <IconCalendar size={24} color="#000000" />
                  </TouchableOpacity>
                )}
                <ProfileAvatar 
                  onPress={() => navigation.navigate('Profile')}
                  size={40}
                  backgroundColor="#9E9E9E"
                  textColor="#FFFFFF"
                  showInitial={true}
                />
              </View>
            </View>
          </View>
          
          {/* Week Calendar - Fixed - Always shown, disabled when no cycle */}
          <View style={[styles.weekCalendar, !activeCycle && styles.weekCalendarDisabled]}>
            {weekDays.map((day, index) => {
              const isSelected = day.date === selectedDate;
              const isToday = day.isToday;
              const isCompleted = day.isCompleted;
                
                return (
                  <View
                    key={index}
                    style={styles.dayContainer}
                  >
                  <TouchableOpacity
                    style={styles.dayTouchable}
                    onPress={() => activeCycle && handleDayChange(day.date)}
                    activeOpacity={1}
                    disabled={!activeCycle}
                  >
                    <View style={styles.dayLabelContainer}>
                      <Text style={styles.dayLabel}>{day.dayLetter}</Text>
                      <View style={[styles.todayUnderline, !isToday && styles.todayUnderlineHidden]} />
                    </View>
                    <Animated.View
                      style={{
                        transform: [{ scale: dayScales[index] }]
                      }}
                    >
                      <View style={styles.dayButtonBlackShadow}>
                        <View style={styles.dayButtonOuterShadow}>
                          <View
                            style={[
                              styles.dayButton, 
                              styles.dayButtonWithShadow,
                              {
                                backgroundColor: isSelected 
                                  ? '#000000'
                                  : '#E3E3DE'
                              }
                            ]}
                          >
                          <View style={[styles.dayButtonBorder, isSelected && styles.dayButtonBorderActive]}>
                            <Text style={isSelected ? styles.dayNumberToday : styles.dayNumber}>
                              {day.dayNumber}
                            </Text>
                          </View>
                        </View>
                        </View>
                      </View>
                    </Animated.View>
                  </TouchableOpacity>
                  </View>
                );
              })}
            </View>
            
            {/* Scrollable Content with Swipe Gesture or Empty State */}
            {!activeCycle ? (
              /* Empty State */
              <View style={styles.emptyStateContent}>
                <Text style={styles.emptyTitle}>No workouts yet</Text>
                <Text style={styles.emptyText}>
                  To get started, you need to create one.
                </Text>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={onNavigateToWorkouts}
                  activeOpacity={0.8}
                >
                  <IconWorkouts size={24} color="#FFFFFF" />
                  <Text style={styles.createButtonText}>Go to Workouts</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.content}>
                <View style={styles.cardsContainer}>
              {/* Old workout card during transition */}
              {isTransitioning && previousWorkoutData?.workout && (
                <Animated.View 
                  style={[
                    styles.workoutCardBlackShadow,
                    styles.absoluteCard,
                    { transform: [{ translateX: oldCardTranslateX }] }
                  ]}
                >
                  <View style={styles.workoutCardWhiteShadow}>
                    <View style={styles.workoutCard}>
                      <View style={styles.workoutCardInner}>
                    {/* Workout Name */}
                      <Text style={styles.workoutName}>{previousWorkoutData.workout.name}</Text>
                    
                    {/* Exercises Count */}
                    <Text style={styles.workoutExercises}>
                      {previousWorkoutData.workout.exercises.length} exercises
                    </Text>
                    
                    {/* Footer */}
                    <View style={styles.workoutCardFooter}>
                      {(() => {
                        const workoutKey = `${previousWorkoutData.workout.id}-${previousWorkoutData.date}`;
                        let totalSets = 0;
                        previousWorkoutData.workout.exercises.forEach((ex: any) => {
                          const progress = getExerciseProgress(workoutKey, ex.id);
                          if (!progress?.skipped) {
                            totalSets += ex.targetSets || 0;
                          }
                        });
                        const completionPercentage = getWorkoutCompletionPercentage(workoutKey, totalSets);
                        const progress = completionPercentage / 100;
                        
                        const buttonState = completionPercentage === 100 ? 'Edit' 
                          : completionPercentage > 0 ? 'Resume' 
                          : 'Start';
                        const isOrangeTriangle = buttonState === 'Start';
                        
                        return (
                          <>
                            {/* Left: Progress Indicator */}
                            <View style={styles.progressIndicator}>
                              <Svg height="16" width="16" viewBox="0 0 16 16" style={styles.progressCircle}>
                                <Circle cx="8" cy="8" r="8" fill={LIGHT_COLORS.border} />
                                {progress >= 0.999 ? (
                                  <Circle cx="8" cy="8" r="8" fill="#227132" />
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
                              </Svg>
                              <Text style={styles.progressText}>{completionPercentage}%</Text>
                            </View>
                            
                            {/* Right: Action Button */}
                            <View style={styles.startButton}>
                              <Text style={styles.startButtonText}>{buttonState}</Text>
                              <View style={styles.playTriangleWrapper}>
                                <View style={[
                                  styles.playTriangle,
                                  isOrangeTriangle && styles.playTriangleOrange
                                ]} />
                              </View>
                            </View>
                          </>
                        );
                      })()}
                    </View>
                  </View>
                </View>
                  </View>
                </Animated.View>
              )}
              
              {/* Old rest day card during transition */}
              {isTransitioning && previousWorkoutData && !previousWorkoutData.workout && (
                <Animated.View 
                  style={[
                    styles.workoutCardBlackShadow,
                    styles.absoluteCard,
                    { transform: [{ translateX: oldCardTranslateX }] }
                  ]}
                >
                  <View style={styles.workoutCardWhiteShadow}>
                    <View style={styles.restDayCard}>
                      <View style={styles.restDayInner}>
                        <Text style={styles.restDayText}>Rest Day</Text>
                        <Text style={styles.restDaySubtext}>
                          No workout scheduled
                        </Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>
              )}
              
              {/* New/current card */}
              {selectedDay?.workout ? (
                <Animated.View 
                  style={[
                    styles.workoutCardBlackShadow,
                    isTransitioning && styles.absoluteCard,
                    isTransitioning && { transform: [{ translateX: newCardTranslateX }] }
                  ]}
                >
                  <View style={styles.workoutCardWhiteShadow}>
                    <View style={[
                      styles.workoutCard,
                      isCardPressed && styles.workoutCardPressed
                    ]}>
                      <TouchableOpacity
                        style={[
                          styles.workoutCardInner,
                          isCardPressed && styles.workoutCardInnerPressed
                        ]}
                        onPress={handleWorkoutPress}
                        onPressIn={() => setIsCardPressed(true)}
                        onPressOut={() => setIsCardPressed(false)}
                        activeOpacity={1}
                      >
                    {/* Workout Name */}
                      <Text style={styles.workoutName}>{selectedDay.workout.name}</Text>
                    
                    {/* Exercises Count */}
                    <Text style={styles.workoutExercises}>
                      {selectedDay.workout.exercises.length} exercises
                    </Text>
                    
                    {/* Footer */}
                    <View style={styles.workoutCardFooter}>
                      {(() => {
                        const workoutKey = `${selectedDay.workout.id}-${selectedDay.date}`;
                        let totalSets = 0;
                        selectedDay.workout.exercises.forEach((ex: any) => {
                          const progress = getExerciseProgress(workoutKey, ex.id);
                          if (!progress?.skipped) {
                            totalSets += ex.targetSets || 0;
                          }
                        });
                        const completionPercentage = getWorkoutCompletionPercentage(workoutKey, totalSets);
                        const progress = completionPercentage / 100;
                        
                        const buttonState = completionPercentage === 100 ? 'Edit' 
                          : completionPercentage > 0 ? 'Resume' 
                          : 'Start';
                        const isOrangeTriangle = buttonState === 'Start';
                        
                        return (
                          <>
                            {/* Left: Progress Indicator */}
                            <View style={styles.progressIndicator}>
                              <Svg height="16" width="16" viewBox="0 0 16 16" style={styles.progressCircle}>
                                <Circle cx="8" cy="8" r="8" fill={LIGHT_COLORS.border} />
                                {progress >= 0.999 ? (
                                  <Circle cx="8" cy="8" r="8" fill="#227132" />
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
                              </Svg>
                              <Text style={styles.progressText}>{completionPercentage}%</Text>
                            </View>
                            
                            {/* Right: Action Button */}
                            <View style={styles.startButton}>
                              <Text style={styles.startButtonText}>{buttonState}</Text>
                              <View style={styles.playTriangleWrapper}>
                                <View style={[
                                  styles.playTriangle,
                                  isOrangeTriangle && styles.playTriangleOrange
                                ]} />
                              </View>
                            </View>
                          </>
                        );
                      })()}
                    </View>
                  </TouchableOpacity>
                </View>
                  </View>
                </Animated.View>
              ) : (
                <Animated.View 
                  style={[
                    styles.workoutCardBlackShadow,
                    isTransitioning && styles.absoluteCard,
                    isTransitioning && { transform: [{ translateX: newCardTranslateX }] }
                  ]}
                >
                  <View style={styles.workoutCardWhiteShadow}>
                    <TouchableOpacity
                      style={styles.restDayCard}
                      onPress={() => setShowSwapSheet(true)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.restDayInner}>
                        <Text style={styles.restDayText}>Rest Day</Text>
                        <Text style={styles.restDaySubtext}>
                          No workout scheduled
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}
              
              {/* Rest Day Swap Button */}
              {!selectedDay?.workout && !isTransitioning && (
                <TouchableOpacity 
                  style={styles.swapButton}
                  onPress={() => setShowSwapSheet(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.swapIconWrapper}>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path 
                        d="M7 16V4M7 4L3 8M7 4L11 8" 
                        stroke={COLORS.text}
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                      <Path 
                        d="M17 8V20M17 20L21 16M17 20L13 16" 
                        stroke={COLORS.text}
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                  <Text style={styles.swapButtonText}>Swap</Text>
                </TouchableOpacity>
              )}
              
              {/* Swap Button */}
              {selectedDay?.workout && !selectedDay.isCompleted && !isTransitioning && (() => {
                // Check if workout has any progress
                const workoutKey = `${selectedDay.workout.id}-${selectedDay.date}`;
                // Calculate totalSets excluding skipped exercises
                let totalSets = 0;
                selectedDay.workout.exercises.forEach((ex: any) => {
                  const progress = getExerciseProgress(workoutKey, ex.id);
                  if (!progress?.skipped) {
                    totalSets += ex.targetSets || 0;
                  }
                });
                const completionPercentage = getWorkoutCompletionPercentage(workoutKey, totalSets);
                const hasStarted = completionPercentage > 0;
                
                // Hide swap button if workout has been started
                if (hasStarted) return null;
                
                return (
                  <TouchableOpacity 
                    style={styles.swapButton}
                    onPress={() => setShowSwapSheet(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.swapIconWrapper}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                        <Path 
                          d="M7 16V4M7 4L3 8M7 4L11 8" 
                          stroke={COLORS.text}
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                        <Path 
                          d="M17 8V20M17 20L21 16M17 20L13 16" 
                          stroke={COLORS.text}
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                      </Svg>
                    </View>
                    <Text style={styles.swapButtonText}>Swap</Text>
                  </TouchableOpacity>
                );
              })()}
              
              {/* Completed Intervals Section */}
              {!isTransitioning && (() => {
                const completedIntervals = getHIITTimerSessionsForDate(selectedDate);
                if (completedIntervals.length === 0) return null;
                
                return (
                  <View style={styles.completedIntervalsSection}>
                    <Text style={styles.completedIntervalsTitle}>Completed intervals</Text>
                    {completedIntervals.map((session) => {
                      const minutes = Math.floor(session.totalDuration / 60);
                      const seconds = session.totalDuration % 60;
                      const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                      
                      return (
                        <View key={session.id} style={styles.intervalItem}>
                          <Text style={styles.intervalName}>{session.timerName}</Text>
                          <Text style={styles.intervalTime}>{timeDisplay}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })()}
              
              </View>
              </View>
            )}
        </SafeAreaView>
      </View>
      
      {/* Swap Bottom Sheet Modal - Renders at root level above tab bar */}
      <Modal
        visible={isSwapSheetVisible}
        transparent={true}
        animationType="none"
        onRequestClose={() => setShowSwapSheet(false)}
      >
        <SafeAreaView style={[styles.swapSheetOverlay, {
          borderBottomLeftRadius: deviceCornerRadius,
          borderBottomRightRadius: deviceCornerRadius,
        }]} edges={['bottom']}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowSwapSheet(false)}
            activeOpacity={1}
          >
            <Animated.View 
              style={[
                StyleSheet.absoluteFillObject,
                { 
                  backgroundColor: COLORS.overlay,
                  opacity: swapSheetBackdropOpacity 
                }
              ]}
              pointerEvents="none"
            />
          </TouchableOpacity>
          <Animated.View 
            style={[
              styles.swapSheet,
              { transform: [{ translateY: swapSheetTranslateY }] }
            ]}
          >
              <View style={styles.swapSheetInner}>
                <View style={styles.swapSheetHandle} />
                <Text style={styles.swapSheetTitle}>Swap Workout</Text>
                <ScrollView style={styles.swapSheetList}>
                  {weekDays
                    .filter(day => 
                      !day.isCompleted && 
                      day.date !== selectedDate
                    )
                    .map((day, index) => (
                      <View key={index} style={styles.swapSheetItemWrapper}>
                        <View style={styles.swapSheetItemBlackShadow}>
                          <View style={styles.swapSheetItemWhiteShadow}>
                            <View style={styles.swapSheetItem}>
                              <TouchableOpacity
                                style={styles.swapSheetItemInner}
                                onPress={async () => {
                                  await swapWorkoutAssignments(selectedDate, day.date);
                                  setShowSwapSheet(false);
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                }}
                                activeOpacity={0.7}
                              >
                                <View>
                                  <Text style={styles.swapSheetItemTitle}>
                                    {day.workout?.name || 'Rest Day'}
                                  </Text>
                                  <Text style={styles.swapSheetItemSubtitle}>
                                    {day.dateObj.format('dddd, MMM D')}
                                  </Text>
                                </View>
                                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                                  <Path 
                                    d="M7 16V4M7 4L3 8M7 4L11 8" 
                                    stroke="#817B77" 
                                    strokeWidth="2" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                  />
                                  <Path 
                                    d="M17 8V20M17 20L21 16M17 20L13 16" 
                                    stroke="#817B77" 
                                    strokeWidth="2" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                  />
                                </Svg>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </View>
                    ))}
                  {weekDays.filter(day => 
                    !day.isCompleted && 
                    day.date !== selectedDate
                  ).length === 0 && (
                    <View style={styles.swapSheetEmpty}>
                      <Text style={styles.swapSheetEmptyText}>
                        No other days this week to swap with
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </Animated.View>
        </SafeAreaView>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    padding: SPACING.xxl,
  },
  cardsContainer: {
    position: 'relative',
    width: '100%',
  },
  absoluteCard: {
    position: 'absolute',
    width: '100%',
    left: 0,
    right: 0,
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl * 3,
  },
  emptyStateContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.xxxl * 2,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textMeta,
    marginBottom: SPACING.xs,
  },
  emptyText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  createButton: {
    backgroundColor: '#1B1B1B',
    height: 56,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  createButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  
  // Header
  header: {
    marginBottom: SPACING.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  calendarButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Week Calendar
  weekCalendar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
    paddingHorizontal: 24,
    position: 'relative',
  },
  weekCalendarDisabled: {
    opacity: 0.5,
  },
  dayContainer: {
    flex: 1,
    alignItems: 'center',
  },
  dayTouchable: {
    alignItems: 'center',
    zIndex: 1,
  },
  dayLabelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dayLabel: {
    ...TYPOGRAPHY.legal,
    color: '#1B1B1B',
  },
  todayUnderline: {
    width: 12,
    height: 1,
    backgroundColor: '#000000',
    marginTop: 2,
  },
  todayUnderlineHidden: {
    backgroundColor: 'transparent',
  },
  dayButtonBlackShadow: {
    // Black shadow: -1, -1, 8% opacity, 1px blur
    shadowColor: '#000000',
    shadowOffset: { width: -1, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 2,
  },
  dayButtonOuterShadow: {
    // White shadow: 1, 1, 1px blur
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 1,
    elevation: 1,
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(27, 27, 27, 0.25)',
  },
  dayButtonWithShadow: {
    // Dark shadow (inset appearance)
    shadowColor: '#000',
    shadowOffset: { width: -2, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  dayButtonBorder: {
    width: '100%',
    height: '100%',
    borderRadius: 11,
    borderCurve: 'continuous',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#FFFFFF',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonBorderActive: {
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.5)',
  },
  dayNumber: {
    ...TYPOGRAPHY.metaBold,
    color: LIGHT_COLORS.secondary,
  },
  dayNumberToday: {
    ...TYPOGRAPHY.metaBold,
    color: LIGHT_COLORS.dayButtonActiveText,
  },
  
  // Workout Card
  workoutCardBlackShadow: CARDS.cardDeep.blackShadow,
  workoutCardWhiteShadow: CARDS.cardDeep.whiteShadow,
  workoutCard: {
    ...CARDS.cardDeep.outer,
    width: '100%',
  },
  workoutCardPressed: {
    borderWidth: 2,
    borderColor: '#000000',
  },
  workoutCardInner: {
    ...CARDS.cardDeep.inner,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  workoutCardInnerPressed: {
    paddingHorizontal: 23,
    paddingTop: 15,
    paddingBottom: 19,
  },
  workoutName: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
    marginBottom: 2,
  },
  workoutExercises: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
    marginBottom: 20,
  },
  
  // Footer
  workoutCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressCircle: {
    // No additional styling needed
  },
  progressText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  workoutProgress: {
    ...TYPOGRAPHY.body,
    color: '#227132',
  },
  
  // Start Button
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  startButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: '#000000',
  },
  playTriangleWrapper: {
    position: 'relative',
    width: 9,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playTriangle: {
    position: 'absolute',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 0,
    borderTopWidth: 4.5,
    borderBottomWidth: 4.5,
    borderLeftColor: '#000000',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  playTriangleOrange: {
    borderLeftColor: COLORS.accentPrimary,
  },
  
  // Completed Badge
  completedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: '#227132',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedBadgeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Rest Day Card
  restDayCard: {
    ...CARDS.cardDeep.outer,
    width: '100%',
  },
  restDayInner: {
    ...CARDS.cardDeep.inner,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    alignItems: 'center',
  },
  restDayText: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
    marginBottom: 4,
  },
  restDaySubtext: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
    textAlign: 'center',
  },
  
  // Swap Button
  restDayActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xl,
    marginTop: SPACING.lg,
  },
  restDayActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  swapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    marginTop: SPACING.lg,
    marginLeft: 24,
  },
  swapButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  swapIconWrapper: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Completed Intervals
  completedIntervalsSection: {
    marginTop: 80,
    marginLeft: 0,
  },
  completedIntervalsTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    marginBottom: SPACING.md,
  },
  intervalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  intervalName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  intervalTime: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  
  // Swap Bottom Sheet
  swapSheetOverlay: {
    flex: 1,
  },
  swapSheet: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    marginBottom: 8,
    backgroundColor: COLORS.backgroundCanvas,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.sm,
    maxHeight: '70%',
  },
  swapSheetInner: {
    flex: 1,
  },
  swapSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: LIGHT_COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  swapSheetTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.xl,
  },
  swapSheetList: {
    flex: 1,
  },
  swapSheetItemWrapper: {
    marginBottom: SPACING.md,
  },
  swapSheetItemBlackShadow: {
    ...CARDS.cardDeep.blackShadow,
  },
  swapSheetItemWhiteShadow: {
    ...CARDS.cardDeep.whiteShadow,
  },
  swapSheetItem: {
    ...CARDS.cardDeep.outer,
  },
  swapSheetItemInner: {
    ...CARDS.cardDeep.inner,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
  },
  swapSheetItemTitle: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.xs,
  },
  swapSheetItemSubtitle: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
  },
  swapSheetEmpty: {
    paddingVertical: SPACING.xxxl,
    alignItems: 'center',
  },
  swapSheetEmptyText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
    textAlign: 'center',
  },
});





