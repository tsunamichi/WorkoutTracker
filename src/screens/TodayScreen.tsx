import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconCheckmark, IconSwap, IconAdd, IconSettings, IconCalendar, IconPause, IconPlay } from '../components/icons';
import { ExpandableCalendarStrip } from '../components/calendar/ExpandableCalendarStrip';
import { DiagonalLinePattern } from '../components/common/DiagonalLinePattern';
import { CycleControlSheet } from '../components/CycleControlSheet';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { useTranslation } from '../i18n/useTranslation';
import type { BonusType } from '../types/training';

dayjs.extend(isoWeek);

// TEMP SEED: set to true to re-seed, then set back to false
const SEED_ENABLED = false;
async function seedDevData() {
  const store = require('../store').useStore.getState();
  const storage = require('../storage');
  
  // 1. Clear everything
  await store.clearAllHistory();

  const now = new Date().toISOString();
  const planId = 'cp-seed-001';

  // 2. Create workout templates (Push, Pull, Legs)
  const pushTemplate = {
    id: 'wt-seed-push', kind: 'workout' as const, name: 'Push',
    warmupItems: [], accessoryItems: [],
    items: [
      { id: 'ex-push-1', exerciseId: 'bench-press', order: 0, sets: 4, reps: 8, weight: 185 },
      { id: 'ex-push-2', exerciseId: 'overhead-press', order: 1, sets: 3, reps: 10, weight: 95 },
      { id: 'ex-push-3', exerciseId: 'incline-db-press', order: 2, sets: 3, reps: 12, weight: 60 },
    ],
    createdAt: now, updatedAt: now, lastUsedAt: null, usageCount: 0,
  };
  const pullTemplate = {
    id: 'wt-seed-pull', kind: 'workout' as const, name: 'Pull',
    warmupItems: [], accessoryItems: [],
    items: [
      { id: 'ex-pull-1', exerciseId: 'barbell-row', order: 0, sets: 4, reps: 8, weight: 155 },
      { id: 'ex-pull-2', exerciseId: 'pull-up', order: 1, sets: 3, reps: 10, weight: 0 },
      { id: 'ex-pull-3', exerciseId: 'face-pull', order: 2, sets: 3, reps: 15, weight: 30 },
    ],
    createdAt: now, updatedAt: now, lastUsedAt: null, usageCount: 0,
  };
  const legsTemplate = {
    id: 'wt-seed-legs', kind: 'workout' as const, name: 'Legs',
    warmupItems: [], accessoryItems: [],
    items: [
      { id: 'ex-legs-1', exerciseId: 'squat', order: 0, sets: 4, reps: 6, weight: 225 },
      { id: 'ex-legs-2', exerciseId: 'romanian-deadlift', order: 1, sets: 3, reps: 10, weight: 185 },
      { id: 'ex-legs-3', exerciseId: 'leg-press', order: 2, sets: 3, reps: 12, weight: 360 },
    ],
    createdAt: now, updatedAt: now, lastUsedAt: null, usageCount: 0,
  };
  const templates = [pushTemplate, pullTemplate, legsTemplate];

  // 3. Create cycle plan: Feb 10 - Feb 16 (1 week)
  // Mon=Push, Wed=Pull, Fri=Legs
  const cyclePlan = {
    id: planId, name: 'PPL Week', startDate: '2026-02-10', weeks: 1,
    mapping: { kind: 'weekdays' as const, weekdays: [1, 3, 5] },
    templateIdsByWeekday: { 1: pushTemplate.id, 3: pullTemplate.id, 5: legsTemplate.id } as Partial<Record<number, string>>,
    active: false, endedAt: '2026-02-16',
    createdAt: now, updatedAt: now, lastUsedAt: now, usageCount: 1,
  };

  // 4. Create scheduled workouts (Mon Feb 10 = Push, Wed Feb 12 = Pull, Fri Feb 14 = Legs)
  const mkWorkout = (date: string, tmpl: typeof pushTemplate, completed: boolean) => ({
    id: `sw-seed-${date}`, date, templateId: tmpl.id,
    titleSnapshot: tmpl.name,
    warmupSnapshot: [] as any[], exercisesSnapshot: tmpl.items.map(i => ({ ...i })), accessorySnapshot: [] as any[],
    warmupCompletion: { completedItems: [] },
    workoutCompletion: { completedExercises: {}, completedSets: {} },
    accessoryCompletion: { completedItems: [] },
    status: (completed ? 'completed' : 'planned') as any,
    startedAt: completed ? `${date}T08:00:00.000Z` : null,
    completedAt: completed ? `${date}T09:15:00.000Z` : null,
    source: 'cycle' as const, programId: planId, programName: 'PPL Week',
    weekIndex: 0, dayIndex: null, isLocked: completed, cyclePlanId: planId,
  });

  const workouts = [
    mkWorkout('2026-02-10', pushTemplate, true),
    mkWorkout('2026-02-12', pullTemplate, true),
    mkWorkout('2026-02-14', legsTemplate, true),
  ];

  // 5. Save everything
  store.workoutTemplates = templates;
  store.cyclePlans = [cyclePlan];
  store.scheduledWorkouts = workouts;
  require('../store').useStore.setState({ workoutTemplates: templates, cyclePlans: [cyclePlan], scheduledWorkouts: workouts });
  await storage.saveWorkoutTemplates(templates);
  await storage.saveCyclePlans([cyclePlan]);
  await storage.saveScheduledWorkouts(workouts);

  console.log('🌱 Seed data created: PPL Week (Feb 10-16) with 3 completed workouts');
}

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Dark theme colors
const LIGHT_COLORS = {
  backgroundCanvas: '#0D0D0D',
  backgroundContainer: '#1C1C1E',
  secondary: '#FFFFFF',
  textSecondary: '#AEAEB2',
  textMeta: '#8E8E93',
  border: '#38383A',
  accentPrimary: COLORS.accentPrimary,
  dayButtonActive: COLORS.accentPrimary,
  dayButtonActiveText: COLORS.backgroundCanvas,
  progressDot: '#48484A',
  progressDotActive: '#FFFFFF',
};

interface TodayScreenProps {
  onDateChange?: (isToday: boolean) => void;
  onOpenSwapDrawer?: (selectedDate: string, weekDays: any[], isRestDay?: boolean) => void;
  onOpenAddWorkout?: (date: string) => void;
  onOpenBonusDrawer?: () => void;
}

export function TodayScreen({ onDateChange, onOpenSwapDrawer, onOpenAddWorkout, onOpenBonusDrawer }: TodayScreenProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    getWorkoutCompletionPercentage,
    getExerciseProgress,
    getBonusLogsForDate,
    settings,
    // Schedule-First Architecture
    scheduledWorkouts,
    getScheduledWorkout,
    getWarmupCompletion,
    getMainCompletion,
    cyclePlans,
    getActiveCyclePlan,
    getCyclePlanWeekProgress,
    getCyclePlanEffectiveEndDate,
    getCyclePlanStatus,
    pauseShiftCyclePlan,
    endCyclePlan,
    updateCyclePlan,
    repairPausedCycleSchedule,
  } = useStore();

  const today = dayjs();
  const { t } = useTranslation();

  // One-time repair for paused cycle schedule (safe to remove after fix is applied)
  React.useEffect(() => {
    repairPausedCycleSchedule();
  }, []);

  // State must be declared before any derived values that use it
  const [selectedDate, setSelectedDate] = useState(today.format('YYYY-MM-DD'));
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [bonusExpanded, setBonusExpanded] = useState(false);
  const [showCycleSheet, setShowCycleSheet] = useState(false);

  // TEMP: Seed dev data on mount (remove after use)
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (SEED_ENABLED && !seeded) {
      setSeeded(true);
      seedDevData().then(() => console.log('🌱 Seed complete'));
    }
  }, []);

  // Derived cycle state (depends on selectedDate)
  const activeCyclePlan = getActiveCyclePlan();
  const cycleWeekProgress = activeCyclePlan
    ? getCyclePlanWeekProgress(activeCyclePlan.id, selectedDate)
    : null;
  const isCyclePaused =
    !!activeCyclePlan?.pausedUntil &&
    dayjs(activeCyclePlan.pausedUntil).isAfter(today, 'day');
  const isPausedDay =
    isCyclePaused &&
    !dayjs(selectedDate).isBefore(today, 'day') &&
    dayjs(selectedDate).isBefore(dayjs(activeCyclePlan!.pausedUntil), 'day');

  // Which cycle plan does the selected date belong to?
  // If multiple plans overlap, prefer inactive for past dates, active for today/future.
  const selectedDateCyclePlan = React.useMemo(() => {
    let activeMatch: typeof cyclePlans[0] | null = null;
    let inactiveMatch: typeof cyclePlans[0] | null = null;
    for (const plan of cyclePlans) {
      const start = dayjs(plan.startDate);
      const end = dayjs(getCyclePlanEffectiveEndDate(plan));
      if (!dayjs(selectedDate).isBefore(start, 'day') && !dayjs(selectedDate).isAfter(end, 'day')) {
        if (plan.active) {
          if (!activeMatch) activeMatch = plan;
        } else {
          if (!inactiveMatch) inactiveMatch = plan;
        }
      }
    }
    if (activeMatch && !inactiveMatch) return activeMatch;
    if (inactiveMatch && !activeMatch) return inactiveMatch;
    if (activeMatch && inactiveMatch) {
      return !dayjs(selectedDate).isBefore(dayjs(), 'day') ? activeMatch : inactiveMatch;
    }
    return null;
  }, [cyclePlans, selectedDate]);
  const isSelectedDateInActiveCycle = selectedDateCyclePlan?.active === true;

  const cycleChipState: 'active' | 'paused' | 'none' = activeCyclePlan
    ? isCyclePaused ? 'paused' : 'active'
    : 'none';
  const activeCycleEndDate = activeCyclePlan
    ? getCyclePlanEffectiveEndDate(activeCyclePlan)
    : undefined;

  const cycleChipLabel = React.useMemo(() => {
    if (!activeCyclePlan) return t('startACycle');
    return activeCyclePlan.name;
  }, [activeCyclePlan, t]);

  // Force refresh when screen comes into focus (e.g., after scheduling a workout)
  useFocusEffect(
    React.useCallback(() => {
      setRefreshTrigger(prev => prev + 1);
    }, [scheduledWorkouts])
  );
  
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
  
  // Get start of week based on selected date (Monday)
  const weekStart = dayjs(selectedDate).startOf('isoWeek');
  
  const scheduleLabel = t('schedule');
  
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
  
  // Get selected day's workout (weekDays always covers the selected date's week)
  const selectedDay = weekDays.find(d => d.date === selectedDate);
  
  // Check if there are eligible workouts to swap with (using new architecture)
  const hasEligibleWorkoutsToSwap = (currentDate: string) => {
    const currentDay = weekDays.find(d => d.date === currentDate);
    const hasCurrentWorkout = !!currentDay?.scheduledWorkout;
    
    if (currentDay?.isCompleted || currentDay?.isLocked) {
      return false;
    }
    
    if (!hasCurrentWorkout && activeCyclePlan) {
      // Rest day: check ALL unstarted cycle workouts (past + future)
      const planId = activeCyclePlan.id;
      const effectiveEnd = getCyclePlanEffectiveEndDate(activeCyclePlan);
      return scheduledWorkouts.some(sw => {
        if (sw.source !== 'cycle') return false;
        if (sw.programId !== planId && sw.cyclePlanId !== planId) return false;
        if (sw.date === currentDate) return false;
        if (dayjs(sw.date).isAfter(effectiveEnd, 'day')) return false;
        const completion = getMainCompletion(sw.id);
        if (sw.isLocked || completion.percentage === 100 || completion.percentage > 0) return false;
        return true;
      });
    }
    
    // Day with workout: check current week for swap targets
    const eligibleDays = weekDays.filter(day => 
      !day.isLocked && 
      day.date !== currentDate &&
      !day.isCompleted
    );
    const unStartedWorkouts = eligibleDays.filter(day => {
      if (!day.scheduledWorkout) return false;
      return day.completionPercentage === 0;
    });
    const restDays = eligibleDays.filter(day => !day.scheduledWorkout);
    return unStartedWorkouts.length > 0 || restDays.length > 0;
  };
  
  const handleAddOrCreateWorkout = (currentDate: string) => {
    onOpenAddWorkout?.(currentDate);
  };
  
  const handleDayChange = (newDate: string) => {
    setSelectedDate(newDate);
  };

  const handleResumeCycleOnDay = async (resumeDateStr: string) => {
    if (!activeCyclePlan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await pauseShiftCyclePlan(activeCyclePlan.id, resumeDateStr);
    if (result.success) {
      await updateCyclePlan(activeCyclePlan.id, { pausedUntil: undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (result.conflicts && result.conflicts.length > 0) {
      (navigation as any).navigate('CycleConflicts', {
        planId: activeCyclePlan.id,
        plan: cyclePlans.find(p => p.id === activeCyclePlan.id),
        conflicts: result.conflicts,
        fromPauseShift: true,
        resumeDate: resumeDateStr,
      });
    }
  };
  
  const isInPastCycle = selectedDateCyclePlan ? !selectedDateCyclePlan.active : false;

  const handleWorkoutPress = () => {
    if (selectedDay?.scheduledWorkout) {
      const sw = selectedDay.scheduledWorkout;
      const mainCompletion = getMainCompletion(sw.id);
      const isCompleted = sw.isLocked || mainCompletion.percentage === 100;

      if (isInPastCycle && !isCompleted) return;
      
      (navigation as any).navigate('ExerciseExecution', {
        workoutKey: sw.id,
        workoutTemplateId: sw.templateId,
        type: 'main',
      });
    }
  };
  
  // Match device corner radius (iPhone rounded corners)
  const deviceCornerRadius = insets.bottom > 0 ? 40 : 24;
  
  return (
      <View style={styles.gradient}>
        <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]} edges={[]}>
          {/* Unified header + calendar card */}
          <View style={[styles.calendarCard, { paddingTop: insets.top }]}>
            {/* Header row: Schedule title + icons */}
            <View style={styles.topBar}>
              <Text style={styles.headerTitle}>{scheduleLabel}</Text>
              <View style={styles.headerRight}>
                {selectedDate !== today.format('YYYY-MM-DD') && (
                  <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() => {
                      setSelectedDate(today.format('YYYY-MM-DD'));
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={1}
                  >
                    <IconCalendar size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={() => (navigation as any).navigate('Profile')}
                  activeOpacity={1}
                >
                  <IconSettings size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
            {/* Cycle chip row below title */}
            <TouchableOpacity
              style={[
                styles.cycleChip,
                cycleChipState === 'paused' && styles.cycleChipPaused,
                cycleChipState === 'none' && styles.cycleChipNone,
                styles.cycleChipRow,
              ]}
              activeOpacity={0.7}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowCycleSheet(true);
              }}
            >
              <Text
                style={[
                  styles.cycleChipText,
                  cycleChipState === 'paused' && styles.cycleChipTextPaused,
                  cycleChipState === 'none' && styles.cycleChipTextNone,
                ]}
                numberOfLines={1}
              >
                {cycleChipLabel}
              </Text>
              <Text style={[
                styles.cycleChipArrow,
                cycleChipState === 'paused' && styles.cycleChipTextPaused,
                cycleChipState === 'none' && styles.cycleChipTextNone,
              ]}>▾</Text>
            </TouchableOpacity>

            {/* Calendar strip */}
            <ExpandableCalendarStrip
              selectedDate={selectedDate}
              onSelectDate={handleDayChange}
              cyclePlans={cyclePlans}
              scheduledWorkouts={scheduledWorkouts}
              getScheduledWorkout={getScheduledWorkout}
              getMainCompletion={getMainCompletion}
            />
          </View>
            
            {/* Day Detail Content */}
            {(
              <View style={styles.content}>
                {/* Workout Content Wrapper - Fixed height for consistent Intervals positioning */}
                <View style={styles.workoutContentWrapper}>
                <View style={styles.cardsContainer}>
              {/* Workout card or Empty Day */}
              {isPausedDay && (!selectedDay?.scheduledWorkout || selectedDay.scheduledWorkout.status === 'planned') ? (
                <View style={[styles.workoutCard, styles.pausedCard]}>
                  <TouchableOpacity
                    style={[styles.workoutCardInner, { backgroundColor: COLORS.signalWarningDimmed }]}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (!activeCyclePlan) return;
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      const resumeDate = dayjs().format('YYYY-MM-DD');
                      pauseShiftCyclePlan(activeCyclePlan.id, resumeDate).then(result => {
                        if (!result.success && result.conflicts) {
                          (navigation as any).navigate('CycleConflicts', {
                            plan: { ...activeCyclePlan, startDate: resumeDate },
                            conflicts: result.conflicts,
                            planId: activeCyclePlan.id,
                            fromPauseShift: true,
                            resumeDate,
                          });
                        }
                      });
                    }}
                  >
                    <View style={styles.workoutCardContent}>
                      <Text style={styles.pausedCardTitle}>{t('theCurrentCycleIsPaused')}</Text>
                      <Text style={styles.pausedCardMeta}>
                        Resumes {dayjs(activeCyclePlan!.pausedUntil).format('MMM D')}
                      </Text>
                    </View>
                    <View style={styles.workoutCardFooter} pointerEvents="none">
                      <View style={[styles.startButton, styles.pausedCardButton]}>
                        <Text style={[styles.startButtonText, styles.pausedCardButtonText]}>{t('resumeCycle')}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              ) : selectedDay?.scheduledWorkout ? (
                <View style={styles.workoutCard}>
                      <TouchableOpacity
                        testID="workout-card"
                        style={styles.workoutCardInner}
                        onPress={handleWorkoutPress}
                        activeOpacity={1}
                        disabled={isInPastCycle && !(selectedDay.scheduledWorkout.isLocked || getMainCompletion(selectedDay.scheduledWorkout.id).percentage === 100)}
                      >
                    {(() => {
                      const sw = selectedDay.scheduledWorkout;
                      
                      // Calculate completion percentage using mainCompletion (only strength workout, not warmup/core)
                      const mainCompletion = getMainCompletion(sw.id);
                      const completionPercentage = mainCompletion.percentage;
                      
                      // Determine button state
                      const progress = completionPercentage / 100;
                      const isCompleted = sw.isLocked || completionPercentage === 100;
                      
                      const isSkipped = isInPastCycle && !isCompleted;
                      let buttonState = t('start');
                      if (isSkipped) {
                        buttonState = t('skipped');
                      } else if (isCompleted) {
                        buttonState = t('workoutComplete');
                      } else if (completionPercentage > 0) {
                        buttonState = t('resume');
                      }
                      
                      return (
                        <>
                          <View style={styles.workoutCardContent}>
                          {/* Top Row: Workout Name + Progress/Checkmark */}
                          <View style={styles.workoutCardHeader}>
                            <Text style={styles.workoutName}>{sw.titleSnapshot}</Text>
                            {!isCompleted && progress > 0 ? (
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
                            <View style={[
                              styles.startButton,
                              isCompleted && styles.startButtonCompletedNoBg,
                              isSkipped && styles.startButtonCompletedNoBg,
                              !isCompleted && !isSkipped && selectedDate !== today.format('YYYY-MM-DD') && dayjs(selectedDate).isBefore(today, 'day') && styles.startButtonPast,
                              !isCompleted && !isSkipped && dayjs(selectedDate).isAfter(today, 'day') && styles.startButtonFuture,
                            ]}>
                              {isCompleted ? (
                                <View style={styles.startButtonCompletedRow}>
                                  <IconCheckmark size={16} color={COLORS.successBright} />
                                  <Text style={[styles.startButtonText, styles.startButtonTextCompleted]}>{buttonState}</Text>
                                </View>
                              ) : isSkipped ? (
                                <Text style={[styles.startButtonText, { color: COLORS.textMeta }]}>{buttonState}</Text>
                              ) : (
                                <Text style={[
                                  styles.startButtonText,
                                  selectedDate !== today.format('YYYY-MM-DD') && dayjs(selectedDate).isBefore(today, 'day') && styles.startButtonTextPast,
                                  dayjs(selectedDate).isAfter(today, 'day') && styles.startButtonTextFuture,
                                ]}>{buttonState}</Text>
                              )}
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
                      <Text style={styles.restDayQuestionGray}>
                        {dayjs(selectedDate).isBefore(today, 'day')
                          ? t('noWorkoutPerformedThisDay')
                          : activeCyclePlan && !dayjs(selectedDate).isBefore(dayjs(activeCyclePlan.startDate), 'day')
                            ? t('restDayTitle')
                            : t('noWorkoutPlanned')}
                      </Text>
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.cardActionsContainer}>
                {/* Per Product Spec: Show actions based on workout existence and lock status */}
                {isPausedDay ? (
                  null
                ) : selectedDay?.scheduledWorkout ? (
                  /* Workout EXISTS: Show swap button only on today (not locked, completed, or in progress) */
                  selectedDate === today.format('YYYY-MM-DD') && !selectedDay.isLocked && !selectedDay.isCompleted && selectedDay.completionPercentage === 0 && (
                    <TouchableOpacity 
                      style={styles.swapButton}
                      onPress={() => onOpenSwapDrawer?.(selectedDate, weekDays)}
                      activeOpacity={1}
                    >
                      <IconSwap size={24} color={COLORS.textMeta} />
                      <Text style={styles.swapButtonText}>{t('swap')}</Text>
                    </TouchableOpacity>
                  )
                ) : (
                  /* NO workout: show swap button on rest days when cycle is active */
                  !dayjs(selectedDate).isBefore(today, 'day') && activeCyclePlan && hasEligibleWorkoutsToSwap(selectedDate) ? (
                    <TouchableOpacity
                      style={styles.swapButton}
                      onPress={() => onOpenSwapDrawer?.(selectedDate, weekDays, true)}
                      activeOpacity={1}
                    >
                      <IconAdd size={24} color={COLORS.accentPrimary} />
                      <Text style={[styles.swapButtonText, { color: COLORS.accentPrimary }]}>{t('useWorkoutFromCycle')}</Text>
                    </TouchableOpacity>
                  ) : !dayjs(selectedDate).isBefore(today, 'day') && !activeCyclePlan ? (
                    <TouchableOpacity
                      style={styles.addWorkoutButton}
                      onPress={() => handleAddOrCreateWorkout(selectedDate)}
                      activeOpacity={1}
                    >
                      <IconAdd size={24} color={COLORS.accentPrimary} />
                      <Text style={styles.addWorkoutButtonText}>{t('addWorkout')}</Text>
                    </TouchableOpacity>
                  ) : null
                )}
              </View>
              </View>
              
              {/* Bonus Section — only visible on today */}
              {(() => {
                const todayDate = today.format('YYYY-MM-DD');
                const isToday = selectedDate === todayDate;
                const isPastDay = dayjs(selectedDate).isBefore(today, 'day');
                const isFutureDay = dayjs(selectedDate).isAfter(today, 'day');
                
                if (isFutureDay) return null;
                
                const bonusItems = getBonusLogsForDate(selectedDate);
                const BONUS_COLLAPSED_MAX = 3;
                const hasMore = bonusItems.length > BONUS_COLLAPSED_MAX;
                const visibleItems = bonusExpanded ? bonusItems : bonusItems.slice(0, BONUS_COLLAPSED_MAX);

                const typeLabel = (type: BonusType) =>
                  type === 'timer' ? t('timer') : type === 'warmup' ? t('warmUp') : t('core');
                
                return (
                  <View style={styles.bonusSection}>
                    <Text style={styles.intervalsSectionTitle}>{t('bonus')}</Text>
                    {bonusItems.length === 0 && isPastDay && (
                      <Text style={styles.noIntervalsText}>{t('noBonusPerformedThisDay')}</Text>
                    )}
                    {bonusItems.length === 0 && isToday && (
                      <TouchableOpacity
                        style={styles.addIntervalCardButton}
                        onPress={() => onOpenBonusDrawer?.()}
                        activeOpacity={0.7}
                      >
                        <DiagonalLinePattern width="100%" height={56} borderRadius={16} />
                        <IconAdd size={24} color={COLORS.text} />
                        <Text style={styles.addIntervalCardText}>{t('addBonus')}</Text>
                      </TouchableOpacity>
                    )}
                    
                    {visibleItems.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.intervalCardWrapper}
                        onPress={() => (navigation as any).navigate('BonusDetail', { bonusLogId: item.id })}
                        activeOpacity={0.7}
                      >
                        <View style={styles.intervalCard}>
                          <View style={styles.intervalCardInner}>
                            <View style={styles.bonusCardLeft}>
                              <Text style={styles.intervalName}>{item.presetName}</Text>
                              <Text style={styles.bonusTypeMeta}>{typeLabel(item.type)}</Text>
                            </View>
                            {item.status === 'completed' ? (
                              <IconCheckmark size={16} color={COLORS.successBright} />
                            ) : (
                              <Text style={styles.bonusStatusText}>{t('planned')}</Text>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                    
                    {hasMore && (
                      <TouchableOpacity
                        style={styles.addIntervalButton}
                        onPress={() => setBonusExpanded(!bonusExpanded)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.addIntervalButtonText}>
                          {bonusExpanded ? 'Show less' : `Show all (${bonusItems.length})`}
                        </Text>
                      </TouchableOpacity>
                    )}
                    
                    {bonusItems.length > 0 && isToday && (
                      <TouchableOpacity
                        style={styles.addIntervalButton}
                        onPress={() => onOpenBonusDrawer?.()}
                        activeOpacity={0.7}
                      >
                        <IconAdd size={24} color={COLORS.text} />
                        <Text style={styles.addIntervalButtonText}>{t('addBonus')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })()}
              
              </View>
              </View>
            )}
            
        </SafeAreaView>

        {/* Cycle Control Sheet */}
        <CycleControlSheet
          visible={showCycleSheet}
          onClose={() => setShowCycleSheet(false)}
          cycleState={cycleChipState}
          plan={activeCyclePlan}
          weekProgress={cycleWeekProgress}
          effectiveEndDate={activeCycleEndDate}
          onPause={(resumeDate: string) => {
            if (!activeCyclePlan) return;
            pauseShiftCyclePlan(activeCyclePlan.id, resumeDate).then(result => {
              if (!result.success && result.conflicts) {
                (navigation as any).navigate('CycleConflicts', {
                  plan: { ...activeCyclePlan, startDate: resumeDate },
                  conflicts: result.conflicts,
                  planId: activeCyclePlan.id,
                  fromPauseShift: true,
                  resumeDate,
                });
              }
            });
          }}
          onResume={() => {
            if (!activeCyclePlan) return;
            const resumeDate = dayjs().format('YYYY-MM-DD');
            pauseShiftCyclePlan(activeCyclePlan.id, resumeDate).then(result => {
              if (!result.success && result.conflicts) {
                (navigation as any).navigate('CycleConflicts', {
                  plan: { ...activeCyclePlan, startDate: resumeDate },
                  conflicts: result.conflicts,
                  planId: activeCyclePlan.id,
                  fromPauseShift: true,
                  resumeDate,
                });
              }
            });
          }}
          onEnd={() => {
            if (activeCyclePlan) endCyclePlan(activeCyclePlan.id);
          }}
          onStartCycle={() => {
            (navigation as any).navigate('CreateCycleFlow', { selectedDate: today.format('YYYY-MM-DD') });
          }}
        />
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
    backgroundColor: COLORS.accentPrimary,
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
    color: COLORS.backgroundCanvas,
  },
  
  // Unified header + calendar card
  calendarCard: {
    backgroundColor: COLORS.backgroundContainer,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingBottom: SPACING.xs,
    marginBottom: SPACING.md,
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

  scheduleTitleTouchable: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  scheduleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  scheduleSubtitleTouchable: {
    paddingHorizontal: SPACING.xxl,
    marginBottom: 12,
  },
  scheduleSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleSubtitle: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
  },
  scheduleSubtitlePauseIcon: {
    marginLeft: SPACING.xs,
  },

  // Cycle Chip
  cycleChipRow: {
    alignSelf: 'flex-start',
    marginLeft: SPACING.xxl,
    marginTop: SPACING.xs,
    marginBottom: 12,
  },
  cycleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successDimmed,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
    maxWidth: 180,
  },
  cycleChipPaused: {
    backgroundColor: COLORS.accentPrimaryDimmed,
  },
  cycleChipNone: {
    backgroundColor: COLORS.container,
  },
  cycleChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.successBright,
  },
  cycleChipTextPaused: {
    color: COLORS.accentPrimary,
  },
  cycleChipTextNone: {
    color: COLORS.textSecondary,
  },
  cycleChipArrow: {
    fontSize: 12,
    color: COLORS.successBright,
  },

  // Pause Banner
  pauseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 214, 10, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 10, 0.2)',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
  },
  pauseBannerLeft: {
    flex: 1,
  },
  pauseBannerTitle: {
    ...TYPOGRAPHY.meta,
    fontWeight: '600' as const,
    color: COLORS.signalWarning,
  },
  pauseBannerSubtext: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginTop: 2,
  },
  pauseBannerButton: {
    backgroundColor: COLORS.signalWarning,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: SPACING.md,
  },
  pauseBannerButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.backgroundCanvas,
  },
  // Paused Card
  pausedCard: {
    backgroundColor: COLORS.signalWarningDimmed,
    borderWidth: 1,
    borderColor: COLORS.signalWarningDimmed,
  },
  pausedCardTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.accentPrimary,
  },
  pausedCardMeta: {
    ...TYPOGRAPHY.meta,
    color: COLORS.text,
    marginTop: 4,
    marginBottom: 24,
  },
  pausedCardButton: {
    backgroundColor: COLORS.backgroundCanvas,
  },
  pausedCardButtonText: {
    color: COLORS.text,
  },

  // Workout Card
  workoutCard: {
    backgroundColor: COLORS.accentPrimaryDimmed,
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
    right: -4,
  },
  progressText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  workoutProgress: {
    ...TYPOGRAPHY.body,
    color: COLORS.successBright,
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
  startButtonCompletedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startButtonCompletedNoBg: {
    backgroundColor: 'transparent',
  },
  startButtonPast: {
    backgroundColor: COLORS.accentPrimaryDimmed,
  },
  startButtonFuture: {
    backgroundColor: 'transparent',
  },
  startButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.backgroundCanvas,
    textAlign: 'left',
  },
  startButtonTextCompleted: {
    color: COLORS.successBright,
  },
  startButtonTextPast: {
    color: COLORS.accentPrimary,
  },
  startButtonTextFuture: {
    color: COLORS.accentPrimary,
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
    alignItems: 'center',
  },
  restDayQuestion: {
    ...TYPOGRAPHY.h2,
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },
  restDayQuestionGray: {
    color: COLORS.text,
  },
  restDayQuestionBlack: {
    color: COLORS.text,
  },
  addWorkoutButton: {
    flexDirection: 'row',
    width: '100%',
    height: 56,
    backgroundColor: COLORS.accentPrimaryDimmed,
    borderRadius: BORDER_RADIUS.md,
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
    color: COLORS.textMeta,
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
  
  // Intervals / Bonus Section
  intervalsSectionTitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.text,
    textTransform: 'uppercase',
    marginBottom: SPACING.md,
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
  noIntervalsText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    marginTop: SPACING.sm,
  },
  
  // Bonus Section
  bonusSection: {
    marginTop: 56,
  },
  bonusCardLeft: {
    flex: 1,
    marginRight: SPACING.md,
  },
  bonusTypeMeta: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginTop: 2,
  },
  bonusStatusText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
});





