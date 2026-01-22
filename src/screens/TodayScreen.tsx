import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Modal, ScrollView } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../store';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconCalendar, IconStopwatch, IconWorkouts, IconCheck, IconSwap, IconAdd } from '../components/icons';
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
  onNavigateToWorkouts?: () => void;
  onDateChange?: (isToday: boolean) => void;
  onOpenSwapDrawer?: (selectedDate: string, weekDays: any[]) => void;
}

export function TodayScreen({ onNavigateToWorkouts, onDateChange, onOpenSwapDrawer }: TodayScreenProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { cycles, workoutAssignments, getWorkoutCompletionPercentage, getExerciseProgress, swapWorkoutAssignments, getHIITTimerSessionsForDate, settings } = useStore();
  const { t } = useTranslation();
  const today = dayjs();
  
  // State for selected date (defaults to today)
  const [selectedDate, setSelectedDate] = useState(today.format('YYYY-MM-DD'));
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, 1 = next week, etc.
  
  // Animation values
  const dayScales = useRef(DAYS_SHORT.map(() => new Animated.Value(1))).current;
  const [dayPositions, setDayPositions] = useState<number[]>([]);
  const previousDayIndex = useRef<number>(-1);
  
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
      completionPercentage,
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
  
  // Check if there are eligible workouts to swap with
  const hasEligibleWorkoutsToSwap = (currentDate: string) => {
    const currentDay = weekDays.find(d => d.date === currentDate);
    const isCurrentDayRestDay = !currentDay?.workout;
    
    // Filter eligible days (not completed, not selected date)
    const eligibleDays = weekDays.filter(day => 
      !day.isCompleted && 
      day.date !== currentDate
    );
    
    // Filter workouts that haven't been started
    const unStartedWorkouts = eligibleDays.filter(day => {
      if (!day.workout) return false;
      return day.completionPercentage === 0;
    });
    
    // If current day is rest day, we need at least one workout to swap
    // Otherwise, we need workouts OR rest days
    if (isCurrentDayRestDay) {
      return unStartedWorkouts.length > 0;
    } else {
      const restDays = eligibleDays.filter(day => !day.workout);
      return unStartedWorkouts.length > 0 || restDays.length > 0;
    }
  };
  
  const handleAddOrCreateWorkout = (currentDate: string) => {
    if (hasEligibleWorkoutsToSwap(currentDate)) {
      // Open swap drawer
      onOpenSwapDrawer?.(currentDate, weekDays);
    } else {
      // Navigate to workout creation
      navigation.navigate('WorkoutCreationOptions');
    }
  };
  
  const handleDayChange = (newDate: string) => {
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
  
  // Match device corner radius (iPhone rounded corners)
  const deviceCornerRadius = insets.bottom > 0 ? 40 : 24;
  
  return (
      <View style={styles.gradient}>
        <SafeAreaView style={[styles.container, { paddingBottom: 88 }]} edges={[]}>
          {/* Header with Cycle Info and Avatar - Fixed - Always shown */}
          <View style={[styles.header, { paddingTop: insets.top }]}>
            <View style={styles.topBar}>
              <Text style={styles.headerTitle}>
                {activeCycle
                  ? t('cycleWeekLabel')
                      .replace('{cycle}', String(activeCycle.cycleNumber))
                      .replace('{week}', String(currentWeek))
                  : t('today')}
              </Text>
              <View style={styles.headerRight}>
                {activeCycle && weekOffset !== 0 && (
                  <TouchableOpacity
                    style={styles.calendarButton}
                    onPress={handleBackToToday}
                    activeOpacity={1}
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
                  imageUri={settings.profileAvatarUri || null}
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
            
            {/* Scrollable Content with Swipe Gesture or Empty State */}
            {!activeCycle ? (
              /* Empty State */
              <View style={styles.emptyStateContent}>
                <Text style={styles.emptyTitle}>{t('noWorkoutsYet')}</Text>
                <Text style={styles.emptyText}>
                  To get started, you need to create one.
                </Text>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={onNavigateToWorkouts}
                  activeOpacity={1}
                >
                  <IconWorkouts size={24} color="#FFFFFF" />
                  <Text style={styles.createButtonText}>{t('goToWorkouts')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.content}>
                {/* Workout Content Wrapper - Fixed height for consistent Intervals positioning */}
                <View style={styles.workoutContentWrapper}>
                <View style={styles.cardsContainer}>
              {/* Workout card or Rest Day */}
              {selectedDay?.workout ? (
                <View style={styles.workoutCard}>
                      <TouchableOpacity
                        style={styles.workoutCardInner}
                        onPress={handleWorkoutPress}
                        activeOpacity={1}
                      >
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
                      const buttonState = completionPercentage === 100
                        ? t('edit')
                        : completionPercentage > 0
                          ? t('resume')
                          : t('start');
                      const progress = completionPercentage / 100;
                      
                      return (
                        <>
                          <View style={styles.workoutCardContent}>
                            {progress >= 0.999 && (
                              <View style={styles.progressCheckBadge}>
                                <IconCheck size={24} color={COLORS.signalPositive} />
                              </View>
                            )}
                          {/* Top Row: Workout Name + Progress */}
                          <View style={styles.workoutCardHeader}>
                            <Text style={styles.workoutName}>{selectedDay.workout.name}</Text>
                            {progress < 0.999 && (
                              <View style={styles.progressIndicator}>
                                <Text style={styles.progressText}>{completionPercentage}%</Text>
                                <Svg height="16" width="16" viewBox="0 0 16 16" style={styles.progressCircle}>
                                  <Circle cx="8" cy="8" r="8" fill={COLORS.backgroundCanvas} />
                                  {progress > 0 ? (
                                    <Path
                                      d={`M 8 8 L 8 0 A 8 8 0 ${progress > 0.5 ? 1 : 0} 1 ${
                                        8 + 8 * Math.sin(2 * Math.PI * progress)
                                      } ${
                                        8 - 8 * Math.cos(2 * Math.PI * progress)
                                      } Z`}
                                      fill={COLORS.signalWarning}
                                    />
                                  ) : null}
                                </Svg>
                              </View>
                            )}
                          </View>
                          
                          {/* Exercises Count */}
                          <Text style={styles.workoutExercises}>
                              {selectedDay.workout.exercises.length}{' '}
                              {selectedDay.workout.exercises.length === 1 ? t('exercise') : t('exercises')}
                          </Text>
                          </View>
                          
                          {/* Footer: Action Button */}
                          <View style={styles.workoutCardFooter} pointerEvents="none">
                            <View style={styles.startButton}>
                              <Text style={styles.startButtonText}>{buttonState}</Text>
                            </View>
                          </View>
                        </>
                      );
                    })()}
                      </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.restDayContainer}>
                  <View style={styles.restDayContent}>
                    <Text style={styles.restDayQuestion}>
                      <Text style={styles.restDayQuestionGray}>{t('restDayTitle')}{'\n'}</Text>
                      <Text style={styles.restDayQuestionBlack}>{t('noWorkoutsScheduled')}</Text>
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.cardActionsContainer}>
                {selectedDay?.workout && !selectedDay.isCompleted && (() => {
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
                      onPress={() => handleAddOrCreateWorkout(selectedDate)}
                      activeOpacity={1}
                    >
                      <IconSwap size={24} color={COLORS.text} />
                      <Text style={styles.swapButtonText}>
                        {hasEligibleWorkoutsToSwap(selectedDate) ? t('swap') : t('createWorkout')}
                      </Text>
                    </TouchableOpacity>
                  );
                })()}

                {!selectedDay?.workout && (
                    <TouchableOpacity
                      style={styles.addWorkoutButton}
                      onPress={() => handleAddOrCreateWorkout(selectedDate)}
                      activeOpacity={1}
                    >
                    <IconAdd size={24} color={COLORS.accentPrimary} />
                      <Text style={styles.addWorkoutButtonText}>
                      {hasEligibleWorkoutsToSwap(selectedDate) ? t('addWorkout') : t('createWorkout')}
                      </Text>
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
  
  // Footer
  workoutCardFooter: {
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
    backgroundColor: COLORS.accentPrimaryDimmed,
    paddingHorizontal: 20,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  startButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
    textAlign: 'left',
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
    borderWidth: 1,
    borderColor: COLORS.textMeta,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.sm,
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





