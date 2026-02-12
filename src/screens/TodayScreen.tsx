import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Modal, ScrollView } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconCheck, IconSwap, IconAdd, IconSettings, IconHistory } from '../components/icons';
import { DiagonalLinePattern } from '../components/common/DiagonalLinePattern';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { useTranslation } from '../i18n/useTranslation';

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
  onDateChange?: (isToday: boolean) => void;
  onOpenSwapDrawer?: (selectedDate: string, weekDays: any[]) => void;
  onOpenAddWorkout?: (date: string) => void;
}

export function TodayScreen({ onDateChange, onOpenSwapDrawer, onOpenAddWorkout }: TodayScreenProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    getWorkoutCompletionPercentage,
    getExerciseProgress,
    getHIITTimerSessionsForDate,
    settings,
    // Schedule-First Architecture
    scheduledWorkouts,
    getScheduledWorkout,
    getWarmupCompletion,
    getMainCompletion,
  } = useStore();
  const { t } = useTranslation();
  const today = dayjs();
  
  // State for selected date (defaults to today)
  const [selectedDate, setSelectedDate] = useState(today.format('YYYY-MM-DD'));
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, 1 = next week, etc.
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Force refresh when screen comes into focus (e.g., after scheduling a workout)
  useFocusEffect(
    React.useCallback(() => {
      setRefreshTrigger(prev => prev + 1);
    }, [scheduledWorkouts])
  );
  
  // Animation values
  const dayScales = useRef(DAYS_SHORT.map(() => new Animated.Value(1))).current;
  const [dayPositions, setDayPositions] = useState<number[]>([]);
  const previousDayIndex = useRef<number>(-1);
  
  // Initialize selected date to today
  useEffect(() => {
    if (!selectedDate) {
      setSelectedDate(today.format('YYYY-MM-DD'));
    }
  }, [selectedDate, today]);
  
  // Notify parent when viewing date changes
  useEffect(() => {
    if (onDateChange) {
      const isToday = selectedDate === today.format('YYYY-MM-DD');
      onDateChange(isToday);
    }
  }, [selectedDate, onDateChange]);
  
  // (debug logging removed)
  
  // Get start of week based on offset (Monday)
  const weekStart = today.startOf('isoWeek').add(weekOffset, 'week');
  
  // Always show "Schedule" - plan info is shown on individual cards
  const currentWeekLabel = t('schedule');
  
  // Get workouts for this week (SCHEDULE-FIRST: Only use ScheduledWorkout)
  const weekDays = React.useMemo(() => DAYS_SHORT.map((dayLetter, index) => {
    const date = weekStart.add(index, 'day');
    const dateStr = date.format('YYYY-MM-DD');
    const isToday = date.isSame(today, 'day');
    
    // SCHEDULE-FIRST: Only check scheduledWorkouts (single source of truth)
    const scheduledWorkout = getScheduledWorkout(dateStr);
    
    // Calculate completion percentage using mainCompletion (only strength workout, not warmup/core)
    let completionPercentage = 0;
    
    if (scheduledWorkout) {
      const mainCompletion = getMainCompletion(scheduledWorkout.id);
      completionPercentage = mainCompletion.percentage;
    }
    
    const isCompleted = scheduledWorkout?.status === 'completed' || completionPercentage === 100;
    const isLocked = scheduledWorkout?.isLocked || false;
    
    return {
      dayLetter,
      dayNumber: date.date(),
      date: dateStr,
      dateObj: date,
      isToday,
      scheduledWorkout, // NEW: direct reference to scheduled workout
      isCompleted,
      isLocked, // NEW: track if workout is locked
      completionPercentage,
    };
  }), [
    weekStart, 
    scheduledWorkouts, 
    getScheduledWorkout, 
    getMainCompletion,
    refreshTrigger
  ]);
  
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
  
  // Check if there are eligible workouts to swap with (using new architecture)
  const hasEligibleWorkoutsToSwap = (currentDate: string) => {
    const currentDay = weekDays.find(d => d.date === currentDate);
    const hasCurrentWorkout = !!currentDay?.scheduledWorkout;
    
    // CRITICAL: Cannot swap if the current day is completed or locked
    if (currentDay?.isCompleted || currentDay?.isLocked) {
      return false;
    }
    
    // Filter eligible days (not locked, not selected date)
    const eligibleDays = weekDays.filter(day => 
      !day.isLocked && 
      day.date !== currentDate &&
      !day.isCompleted
    );
    
    // Filter workouts that haven't been started
    const unStartedWorkouts = eligibleDays.filter(day => {
      if (!day.scheduledWorkout) return false;
      return day.completionPercentage === 0;
    });
    
    // If current day has no workout, we need at least one workout to swap
    // Otherwise, we need workouts OR rest days
    if (!hasCurrentWorkout) {
      return unStartedWorkouts.length > 0;
    } else {
      const restDays = eligibleDays.filter(day => !day.scheduledWorkout);
      return unStartedWorkouts.length > 0 || restDays.length > 0;
    }
  };
  
  const handleAddOrCreateWorkout = (currentDate: string) => {
    if (hasEligibleWorkoutsToSwap(currentDate)) {
      // Open swap drawer with current weekDays data
      onOpenSwapDrawer?.(currentDate, weekDays);
    } else {
      // NEW: Open AddWorkoutSheet to choose workout or plan
      onOpenAddWorkout?.(currentDate);
    }
  };
  
  const handleDayChange = (newDate: string) => {
    setSelectedDate(newDate);
  };
  
  const handleWorkoutPress = () => {
    if (selectedDay?.scheduledWorkout) {
      const sw = selectedDay.scheduledWorkout;
      
      // SCHEDULE-FIRST: Pass scheduled workout data to execution screen
      // Navigate directly to ExerciseExecution with type='main' (skipping WOD page)
      (navigation as any).navigate('ExerciseExecution', {
        workoutKey: sw.id, // Pass scheduled workout ID as workoutKey
        workoutTemplateId: sw.templateId,
        type: 'main', // Go directly to main exercises page
      });
    }
  };
  
  // Match device corner radius (iPhone rounded corners)
  const deviceCornerRadius = insets.bottom > 0 ? 40 : 24;
  
  return (
      <View style={styles.gradient}>
        <SafeAreaView style={[styles.container, { paddingBottom: 88 }]} edges={[]}>
          {/* Header with Schedule Info and Avatar - Fixed - Always shown */}
          <View style={[styles.header, { paddingTop: insets.top }]}>
            <View style={styles.topBar}>
              <Text style={styles.headerTitle}>
                {currentWeekLabel}
              </Text>
              <View style={styles.headerRight}>
                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={() => (navigation as any).navigate('History')}
                  activeOpacity={1}
                >
                  <IconHistory size={24} color="#000000" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={() => (navigation as any).navigate('Profile')}
                  activeOpacity={1}
                >
                  <IconSettings size={24} color="#000000" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
          
          {/* Week Calendar - Always shown and interactive */}
          <View style={styles.weekCalendar}>
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
                    onPress={() => handleDayChange(day.date)}
                    activeOpacity={1}
                  >
                    <View style={styles.dayButtonWrapper}>
                      {isToday && (
                        <View style={styles.dayLabelContainer}>
                          <Text style={styles.dayLabel}>{day.dateObj.format('ddd')}</Text>
                        </View>
                      )}
                      <Animated.View
                        style={{
                          transform: [{ scale: dayScales[index] }]
                        }}
                      >
                        <View
                          style={[
                            styles.dayButton,
                            { backgroundColor: COLORS.activeCard },
                            isSelected && {
                              backgroundColor: COLORS.text,
                              borderWidth: 1,
                              borderColor: COLORS.text,
                            }
                          ]}
                        >
                          <View style={[styles.dayButtonBorder, isSelected && styles.dayButtonBorderActive]}>
                            <Text style={isSelected ? styles.dayNumberToday : styles.dayNumber}>
                              {day.dayNumber}
                            </Text>
                          </View>
                        </View>
                      </Animated.View>
                    </View>
                  </TouchableOpacity>
                  </View>
                );
              })}
            </View>
            
            {/* Day Detail Content */}
            {(
              <View style={styles.content}>
                {/* Workout Content Wrapper - Fixed height for consistent Intervals positioning */}
                <View style={styles.workoutContentWrapper}>
                <View style={styles.cardsContainer}>
              {/* Workout card or Empty Day */}
              {selectedDay?.scheduledWorkout ? (
                <View style={styles.workoutCard}>
                      <TouchableOpacity
                        testID="workout-card"
                        style={styles.workoutCardInner}
                        onPress={handleWorkoutPress}
                        activeOpacity={1}
                      >
                    {(() => {
                      const sw = selectedDay.scheduledWorkout;
                      
                      // Calculate completion percentage using mainCompletion (only strength workout, not warmup/core)
                      const mainCompletion = getMainCompletion(sw.id);
                      const completionPercentage = mainCompletion.percentage;
                      
                      // Determine button state
                      const progress = completionPercentage / 100;
                      const isCompleted = sw.isLocked || completionPercentage === 100;
                      
                      let buttonState = t('start');
                      if (isCompleted) {
                        buttonState = 'Completed'; // Show "Completed" for locked or 100% workouts
                      } else if (completionPercentage > 0) {
                        buttonState = t('resume');
                      }
                      
                      return (
                        <>
                          <View style={styles.workoutCardContent}>
                          {/* Top Row: Workout Name + Progress/Checkmark */}
                          <View style={styles.workoutCardHeader}>
                            <Text style={styles.workoutName}>{sw.titleSnapshot}</Text>
                            {isCompleted ? (
                              <View style={styles.completedCheckBadge}>
                                <IconCheck size={20} color={COLORS.success} />
                              </View>
                            ) : progress > 0 ? (
                              <View style={styles.progressIndicator}>
                                <Text style={styles.progressText}>{completionPercentage}%</Text>
                                <Svg height="16" width="16" viewBox="0 0 16 16" style={styles.progressCircle}>
                                  <Circle cx="8" cy="8" r="8" fill={COLORS.backgroundCanvas} />
                                  <Path
                                    d={`M 8 8 L 8 0 A 8 8 0 ${progress > 0.5 ? 1 : 0} 1 ${
                                      8 + 8 * Math.sin(2 * Math.PI * progress)
                                    } ${
                                      8 - 8 * Math.cos(2 * Math.PI * progress)
                                    } Z`}
                                    fill={COLORS.signalWarning}
                                  />
                                </Svg>
                              </View>
                            ) : null}
                          </View>
                          
                          {/* Exercises Count and Program Name */}
                          <Text style={styles.workoutExercises}>
                              {sw.exercisesSnapshot?.length || 0}{' '}
                              {(sw.exercisesSnapshot?.length || 0) === 1 ? t('exercise') : t('exercises')}
                              {sw.programName && (
                                <Text style={styles.workoutMeta}>
                                  {' • '}{sw.programName}
                                </Text>
                              )}
                          </Text>
                          </View>
                          
                          {/* Footer: Action Button */}
                          <View style={styles.workoutCardFooter} pointerEvents="none">
                            <View style={[styles.startButton, isCompleted && styles.startButtonCompleted]}>
                              <Text style={[styles.startButtonText, isCompleted && styles.startButtonTextCompleted]}>{buttonState}</Text>
                            </View>
                          </View>
                        </>
                      );
                    })()}
                      </TouchableOpacity>
                </View>
              ) : (
                /* Per Product Spec: Empty Day State */
                <View style={styles.restDayContainer}>
                  <View style={styles.restDayContent}>
                    <Text style={styles.restDayQuestion}>
                      <Text style={styles.restDayQuestionGray}>{t('noWorkoutPlanned')}</Text>
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.cardActionsContainer}>
                {/* Per Product Spec: Show actions based on workout existence and lock status */}
                {selectedDay?.scheduledWorkout ? (
                  /* Workout EXISTS: Show swap button (unless locked, completed, or in progress) */
                  !selectedDay.isLocked && !selectedDay.isCompleted && selectedDay.completionPercentage === 0 && (
                    <TouchableOpacity 
                      style={styles.swapButton}
                      onPress={() => handleAddOrCreateWorkout(selectedDate)}
                      activeOpacity={1}
                    >
                      <IconSwap size={24} color={COLORS.text} />
                      <Text style={styles.swapButtonText}>{t('swap')}</Text>
                    </TouchableOpacity>
                  )
                ) : (
                  /* Per Product Spec: NO workout - show ONLY "Add workout" button */
                  <TouchableOpacity
                    style={styles.addWorkoutButton}
                    onPress={() => handleAddOrCreateWorkout(selectedDate)}
                    activeOpacity={1}
                  >
                    <IconAdd size={24} color={COLORS.accentPrimary} />
                    <Text style={styles.addWorkoutButtonText}>{t('addWorkout')}</Text>
                  </TouchableOpacity>
                )}
              </View>
              </View>
              
              {/* Intervals Section */}
              {(() => {
                // Determine if selected date is today, past, or future
                const todayDate = today.format('YYYY-MM-DD');
                const selectedDayjs = dayjs(selectedDate);
                const isToday = selectedDate === todayDate;
                const isPastDay = selectedDayjs.isBefore(today, 'day');
                const isFutureDay = selectedDayjs.isAfter(today, 'day');
                
                // Hide intervals section for future days
                if (isFutureDay) return null;
                
                const completedIntervals = getHIITTimerSessionsForDate(selectedDate);
                
                return (
                  <View style={styles.intervalsSection}>
                    {/* Show explanatory text when no intervals */}
                    {completedIntervals.length === 0 && isToday && (
                        <TouchableOpacity
                        style={styles.addIntervalCardButton}
                          onPress={() => navigation.navigate('HIITTimerList' as never)}
                          activeOpacity={0.7}
                        >
                          <DiagonalLinePattern width="100%" height={56} borderRadius={16} />
                          <IconAdd size={24} color={COLORS.text} />
                        <Text style={styles.addIntervalCardText}>{t('addIntervalTimer')}</Text>
                        </TouchableOpacity>
                    )}
                    
                    {/* Show completed intervals */}
                    {completedIntervals.length > 0 && completedIntervals.map((session) => {
                      const minutes = Math.floor(session.totalDuration / 60);
                      const seconds = session.totalDuration % 60;
                      const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                      
                      return (
                        <View key={session.id} style={styles.intervalCardWrapper}>
                          <View style={styles.intervalCard}>
                            <View style={styles.intervalCardInner}>
                              <Text style={styles.intervalName}>{session.timerName}</Text>
                              <Text style={styles.intervalTime}>{timeDisplay}</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                    {completedIntervals.length > 0 && isToday && (
                      <TouchableOpacity
                        style={styles.addIntervalButton}
                        onPress={() => navigation.navigate('HIITTimerList' as never)}
                        activeOpacity={0.7}
                      >
                        <IconAdd size={24} color={COLORS.text} />
                        <Text style={styles.addIntervalButtonText}>{t('addInterval')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })()}
              
              </View>
              </View>
            )}
        </SafeAreaView>
      </View>
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
  workoutContentWrapper: {
    // Wrapper contains cardsContainer
  },
  cardsContainer: {
    position: 'relative',
    width: '100%',
    minHeight: 160, // Fixed height to keep content consistent between workout and rest days
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
  settingsButton: {
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
  dayButtonWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  dayLabelContainer: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  dayLabel: {
    ...TYPOGRAPHY.note,
    color: '#1B1B1B',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonBorderActive: {
    // No inner border on active state
  },
  dayNumber: {
    ...TYPOGRAPHY.metaBold,
    color: LIGHT_COLORS.secondary,
  },
  dayNumberToday: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.backgroundCanvas,
  },
  
  // Workout Card
  workoutCard: {
    backgroundColor: CARDS.cardDeep.outer.backgroundColor,
    borderRadius: CARDS.cardDeep.outer.borderRadius,
    borderCurve: CARDS.cardDeep.outer.borderCurve,
    overflow: CARDS.cardDeep.outer.overflow,
    width: '100%',
  },
  workoutCardInner: {
    ...CARDS.cardDeep.inner,
    paddingHorizontal: 4,
    paddingTop: 16,
    paddingBottom: 4,
  },
  workoutCardContent: {
    paddingHorizontal: 20,
    position: 'relative',
  },
  workoutCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  workoutName: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
    flex: 1,
  },
  workoutExercises: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
    marginBottom: 20,
  },
  workoutMeta: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
  },
  programLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.accentPrimary,
    marginBottom: 16,
  },
  
  // Footer
  workoutCardFooter: {
    marginTop: 'auto',
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressCircle: {
    // No additional styling needed
  },
  progressCheckCircle: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCheckBadge: {
    position: 'absolute',
    top: 0,
    right: 16,
  },
  completedCheckBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  progressText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  workoutProgress: {
    ...TYPOGRAPHY.body,
    color: COLORS.signalPositive,
  },
  
  // Start Button
  startButton: {
    width: '100%',
    height: 48,
    backgroundColor: COLORS.accentPrimary,
    paddingHorizontal: 20,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  startButtonCompleted: {
    backgroundColor: '#E8F5E9', // Light green background
  },
  startButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: '#FFFFFF',
    textAlign: 'left',
  },
  startButtonTextCompleted: {
    color: COLORS.success,
  },
  
  // Completed Badge
  completedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: COLORS.signalPositive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedBadgeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Rest Day Card
  // Rest Day View
  restDayContainer: {
    width: '100%',
  },
  restDayContent: {
    alignItems: 'flex-start',
  },
  restDayQuestion: {
    ...TYPOGRAPHY.h3,
    lineHeight: 28,
    marginBottom: SPACING.xl,
  },
  restDayQuestionGray: {
    color: COLORS.textMeta,
  },
  restDayQuestionBlack: {
    color: COLORS.text,
  },
  addWorkoutButton: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: COLORS.accentPrimaryDimmed,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  addWorkoutButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    color: COLORS.accentPrimary,
  },
  
  // Swap Button
  swapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
  
  cardActionsContainer: {
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  
  // Intervals Section
  intervalsSection: {
    marginTop: 56, // 56px gap from workout card
  },
  intervalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    minHeight: 24,
  },
  intervalsTitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  addIntervalCardButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.sm,
    overflow: 'hidden',
  },
  addIntervalCardText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  addIntervalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    marginTop: SPACING.sm,
  },
  addIntervalButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  intervalCardWrapper: {
    marginBottom: SPACING.sm,
  },
  intervalCard: CARDS.cardDeepDimmed.outer,
  intervalCardInner: {
    ...CARDS.cardDeepDimmed.inner,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  intervalName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  intervalTime: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  noIntervalsText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    marginTop: SPACING.sm,
  },
});





