import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Modal } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// import { GestureDetector, Gesture } from 'react-native-gesture-handler';
// import { runOnJS } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconCalendar, IconStopwatch } from '../components/icons';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

interface TodayScreenProps {
  navigation: any;
}

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

export function TodayScreen({ navigation }: TodayScreenProps) {
  const insets = useSafeAreaInsets();
  const { cycles, workoutAssignments, getWorkoutCompletionPercentage, getExerciseProgress, swapWorkoutAssignments } = useStore();
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

  // Swipe gesture DISABLED for debugging
  // const swipeGesture = Gesture.Pan()
  //   .onEnd((event) => {
  //     runOnJS(handleSwipe)(event.velocityX, event.translationX);
  //   });
  
  // Match device corner radius (iPhone rounded corners)
  const deviceCornerRadius = insets.bottom > 0 ? 40 : 24;
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LinearGradient
        colors={['#E3E6E0', '#D4D6D1']}
        style={styles.gradient}
      >
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
                          <LinearGradient
                            colors={isSelected 
                              ? (isCompleted ? ['#227132', '#227132'] : ['#000000', '#000000'])
                              : ['rgba(227, 227, 222, 1)', 'rgba(237, 237, 237, 0.93)']}
                            start={{ x: 0.42, y: 0.42 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.dayButton, styles.dayButtonWithShadow]}
                          >
                          <View style={[styles.dayButtonBorder, isSelected && styles.dayButtonBorderActive]}>
                            <Text style={isSelected ? styles.dayNumberToday : styles.dayNumber}>
                              {day.dayNumber}
                            </Text>
                          </View>
                        </LinearGradient>
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
                <Text style={styles.emptyTitle}>No Workouts</Text>
                <Text style={styles.emptyText}>
                  Create a new workout to get started with your training
                </Text>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={() => navigation.navigate('Workouts')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.createButtonText}>Create a New Workout</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // <GestureDetector gesture={swipeGesture}>
                <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
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
                    <View style={styles.workoutHeaderRow}>
                      <Text style={styles.workoutName}>{previousWorkoutData.workout.name}</Text>
                    </View>
                    
                    {/* Progress Dots */}
                    <View style={styles.progressDotsContainer}>
                      {(() => {
                        const workoutKey = `${previousWorkoutData.workout.id}-${previousWorkoutData.date}`;
                        // Calculate totalSets excluding skipped exercises
                        let totalSets = 0;
                        previousWorkoutData.workout.exercises.forEach((ex: any) => {
                          const progress = getExerciseProgress(workoutKey, ex.id);
                          if (!progress?.skipped) {
                            totalSets += ex.targetSets || 0;
                          }
                        });
                        const completionPercentage = getWorkoutCompletionPercentage(workoutKey, totalSets);
                        const totalDots = 96; // 3 rows * 32 dots
                        const completedDots = Math.round((completionPercentage / 100) * totalDots);
                        
                        return Array.from({ length: 3 }).map((_, rowIdx) => (
                          <View key={rowIdx} style={styles.progressDotsRow}>
                            {Array.from({ length: 32 }).map((_, dotIdx) => {
                              const absoluteDotIndex = rowIdx * 32 + dotIdx;
                              const isCompleted = absoluteDotIndex < completedDots;
                              return (
                                <View 
                                  key={dotIdx} 
                                  style={[
                                    styles.progressDot,
                                    isCompleted && styles.progressDotCompleted
                                  ]} 
                                />
                              );
                            })}
                          </View>
                        ));
                      })()}
                    </View>
                    
                    {/* Footer */}
                    <View style={styles.workoutCardFooter}>
                      {(() => {
                        const workoutKey = `${previousWorkoutData.workout.id}-${previousWorkoutData.date}`;
                        // Calculate totalSets excluding skipped exercises
                        let totalSets = 0;
                        previousWorkoutData.workout.exercises.forEach((ex: any) => {
                          const progress = getExerciseProgress(workoutKey, ex.id);
                          if (!progress?.skipped) {
                            totalSets += ex.targetSets || 0;
                          }
                        });
                        const completionPercentage = getWorkoutCompletionPercentage(workoutKey, totalSets);
                        
                        // Determine button state
                        const buttonState = completionPercentage === 100 ? 'edit' 
                          : completionPercentage > 0 ? 'resume' 
                          : 'start';
                        const isOrangeTriangle = buttonState === 'start';
                        
                        return (
                          <>
                            <Text style={styles.workoutExercises}>
                              {previousWorkoutData.workout.exercises.length} exercises
                            </Text>
                            
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
                    <View style={styles.workoutHeaderRow}>
                      <Text style={styles.workoutName}>{selectedDay.workout.name}</Text>
                    </View>
                    
                    {/* Progress Dots - Show total sets across all exercises */}
                    <View style={styles.progressDotsContainer}>
                      {(() => {
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
                        const totalDots = 96; // 3 rows * 32 dots
                        const completedDots = Math.round((completionPercentage / 100) * totalDots);
                        
                        return Array.from({ length: 3 }).map((_, rowIdx) => (
                          <View key={rowIdx} style={styles.progressDotsRow}>
                            {Array.from({ length: 32 }).map((_, dotIdx) => {
                              const absoluteDotIndex = rowIdx * 32 + dotIdx;
                              const isCompleted = absoluteDotIndex < completedDots;
                              return (
                                <View 
                                  key={dotIdx} 
                                  style={[
                                    styles.progressDot,
                                    isCompleted && styles.progressDotCompleted
                                  ]} 
                                />
                              );
                            })}
                          </View>
                        ));
                      })()}
                    </View>
                    
                    {/* Footer: Progress and Start/Resume/Edit button */}
                    <View style={styles.workoutCardFooter}>
                      {(() => {
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
                        
                        // Determine button state
                        const buttonState = completionPercentage === 100 ? 'edit' 
                          : completionPercentage > 0 ? 'resume' 
                          : 'start';
                        const isOrangeTriangle = buttonState === 'start';
                        
                        return (
                          <>
                            <Text style={styles.workoutExercises}>
                              {selectedDay.workout.exercises.length} exercises
                            </Text>
                            
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
                  </View>
                  <Text style={styles.swapButtonText}>swap</Text>
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
                    </View>
                    <Text style={styles.swapButtonText}>swap</Text>
                  </TouchableOpacity>
                );
              })()}
              
              </View>
            </ScrollView>
            // </GestureDetector>
            )}
        </SafeAreaView>
      </LinearGradient>
      
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
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
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
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  createButton: {
    backgroundColor: LIGHT_COLORS.accentPrimary,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
  },
  createButtonText: {
    ...TYPOGRAPHY.button,
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
  workoutCardBlackShadow: {
    // Black shadow: -1, -1, 8% opacity, 1px blur
    shadowColor: '#000000',
    shadowOffset: { width: -1, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 2,
  },
  workoutCardWhiteShadow: {
    // Bottom-right shadow: 1, 1, 100% opacity, 1px blur
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 1,
    elevation: 1,
  },
  workoutCard: {
    backgroundColor: '#E3E3DE',
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '100%',
    overflow: 'hidden',
  },
  workoutCardPressed: {
    borderWidth: 2,
    borderColor: '#000000',
  },
  workoutCardInner: {
    backgroundColor: '#E2E3DF',
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.75)',
    borderLeftColor: 'rgba(255, 255, 255, 0.75)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.08)',
  },
  workoutCardInnerPressed: {
    paddingHorizontal: 23,
    paddingTop: 15,
    paddingBottom: 19,
  },
  workoutHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  workoutName: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
  },
  completionPercentage: {
    ...TYPOGRAPHY.h3,
    color: '#227132',
  },
  
  // Progress Dots
  progressDotsContainer: {
    marginBottom: SPACING.xl,
    gap: 6,
  },
  progressDotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    borderCurve: 'continuous',
    backgroundColor: LIGHT_COLORS.progressDot, // Lighter/disabled color
  },
  progressDotCompleted: {
    backgroundColor: '#227132', // Green
  },
  
  // Footer
  workoutCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutExercises: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
  },
  workoutProgress: {
    ...TYPOGRAPHY.body,
    color: '#227132',
  },
  
  // Start Button
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  startButtonText: {
    ...TYPOGRAPHY.bodyBold,
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
    backgroundColor: '#E3E3DE',
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '100%',
    overflow: 'hidden',
  },
  restDayInner: {
    backgroundColor: '#E2E3DF',
    borderRadius: 12,
    borderCurve: 'continuous',
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
    gap: 8,
    marginTop: SPACING.lg,
    marginLeft: 24,
    paddingVertical: SPACING.md,
  },
  swapButtonText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
  },
  swapIconWrapper: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
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





