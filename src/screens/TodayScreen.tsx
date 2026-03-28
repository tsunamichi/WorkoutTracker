import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Alert, Share, Dimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconCheckmark, IconAdd, IconSettings, IconCalendar, IconPlay, IconCore, IconWarmup, IconStopwatch, IconChevronDown } from '../components/icons';
import { DiagonalLinePattern } from '../components/common/DiagonalLinePattern';
import { ScheduleWorkoutCardStack } from '../components/schedule/ScheduleWorkoutCardStack';
import { CycleControlSheet } from '../components/CycleControlSheet';
import { ShareCycleDrawer } from '../components/ShareCycleDrawer';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { useTranslation } from '../i18n/useTranslation';
import { useAppTheme } from '../theme/useAppTheme';
import { formatWeightForLoad } from '../utils/weight';
import type { BonusType, CyclePlan } from '../types/training';
import type { ScheduledWorkout } from '../types/training';
import type { ExerciseProgress } from '../types';

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

/** ISO weekday 1–7 (Mon–Sun) → two-letter labels */
const ISO_DAY_TWO_LETTER = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

type WeekStripDay = {
  dateStr: string;
  dayNumber: number;
  dayLetters: string;
  isToday: boolean;
  isSelected: boolean;
  scheduledWorkout: ScheduledWorkout | undefined;
  isCompleted: boolean;
  isLocked: boolean;
  completionPercentage: number;
};

/** Reserve vertical space above home indicator for pinned Extras bar */
const EXTRAS_PIN_BAR_HEIGHT = 56;

/** Week strip: swipe snap animation (ms) */
const WEEK_STRIP_PAN_MS = 240;

const SCHEDULE_CARD_MAX_EXERCISES = 6;
const SCHEDULE_CARD_EXERCISES_WHEN_MORE = 5;

interface TodayScreenProps {
  onDateChange?: (isToday: boolean) => void;
  onOpenAddWorkout?: (date: string) => void;
  onOpenBonusDrawer?: () => void;
}

export function TodayScreen({ onDateChange, onOpenAddWorkout, onOpenBonusDrawer }: TodayScreenProps) {
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
    deleteCyclePlanCompletely,
    updateCyclePlan,
    repairPausedCycleSchedule,
    exercises,
    detailedWorkoutProgress,
  } = useStore();

  const today = dayjs();
  const { t } = useTranslation();
  const { colors: themeColors } = useAppTheme();

  // One-time repair for paused cycle schedule (safe to remove after fix is applied)
  React.useEffect(() => {
    repairPausedCycleSchedule();
  }, []);

  // State must be declared before any derived values that use it
  const [selectedDate, setSelectedDate] = useState(today.format('YYYY-MM-DD'));
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showCycleSheet, setShowCycleSheet] = useState(false);
  const [showShareCycleSheet, setShowShareCycleSheet] = useState(false);
  const [shareCyclePlan, setShareCyclePlan] = useState<CyclePlan | undefined>(undefined);
  const [extrasExpanded, setExtrasExpanded] = useState(false);

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
  // For inactive (finished) plans, only match if there's an actual workout on that date.
  const selectedDateCyclePlan = React.useMemo(() => {
    let activeMatch: typeof cyclePlans[0] | null = null;
    let inactiveMatch: typeof cyclePlans[0] | null = null;
    const dateStr = dayjs(selectedDate).format('YYYY-MM-DD');
    for (const plan of cyclePlans) {
      const start = dayjs(plan.startDate);
      const end = dayjs(getCyclePlanEffectiveEndDate(plan));
      if (!dayjs(selectedDate).isBefore(start, 'day') && !dayjs(selectedDate).isAfter(end, 'day')) {
        if (plan.active) {
          if (!activeMatch) activeMatch = plan;
        } else {
          const hasWorkoutOnDate = scheduledWorkouts.some(
            sw => sw.date === dateStr && sw.source === 'cycle' && (sw.programId === plan.id || sw.cyclePlanId === plan.id)
          );
          if (hasWorkoutOnDate && !inactiveMatch) inactiveMatch = plan;
        }
      }
    }
    if (activeMatch && !inactiveMatch) return activeMatch;
    if (inactiveMatch && !activeMatch) return inactiveMatch;
    if (activeMatch && inactiveMatch) {
      return !dayjs(selectedDate).isBefore(dayjs(), 'day') ? activeMatch : inactiveMatch;
    }
    return null;
  }, [cyclePlans, selectedDate, scheduledWorkouts]);
  const isSelectedDateInActiveCycle = selectedDateCyclePlan?.active === true;

  const cycleChipState: 'active' | 'paused' | 'finished' | 'none' = (() => {
    if (selectedDateCyclePlan) {
      if (selectedDateCyclePlan.active) {
        const isPlanPaused = !!selectedDateCyclePlan.pausedUntil &&
          dayjs(selectedDateCyclePlan.pausedUntil).isAfter(today, 'day');
        return isPlanPaused ? 'paused' : 'active';
      }
      return 'finished';
    }
    return 'none';
  })();
  const activeCycleEndDate = activeCyclePlan
    ? getCyclePlanEffectiveEndDate(activeCyclePlan)
    : undefined;

  const cycleChipName = selectedDateCyclePlan?.name ?? '';
  const cycleChipStatus: string = (() => {
    if (cycleChipState === 'active') return 'Active';
    if (cycleChipState === 'paused') return 'Paused';
    if (cycleChipState === 'finished') return 'Finished';
    return '';
  })();

  const handleExportData = useCallback(
    async (plan: CyclePlan) => {
      const cycleId = plan.id;
      const cycleWorkouts = scheduledWorkouts
        .filter(sw => sw.programId === cycleId || sw.cyclePlanId === cycleId)
        .sort((a, b) => a.date.localeCompare(b.date));
      const startDate = dayjs(plan.startDate);
      const endDate = plan.endedAt
        ? dayjs(plan.endedAt)
        : cycleWorkouts.length > 0
          ? dayjs(cycleWorkouts[cycleWorkouts.length - 1].date)
          : dayjs(plan.startDate).add(plan.weeks, 'week').subtract(1, 'day');
      const weekGroups: { weekNumber: number; weekStart: string; weekEnd: string; workouts: ScheduledWorkout[] }[] = [];
      for (let w = 0; w < plan.weeks; w++) {
        const weekStart = startDate.add(w, 'week');
        const weekEnd = weekStart.add(6, 'day');
        const weekWorkouts = cycleWorkouts.filter(
          sw => sw.date >= weekStart.format('YYYY-MM-DD') && sw.date <= weekEnd.format('YYYY-MM-DD')
        );
        if (weekWorkouts.length > 0) {
          weekGroups.push({
            weekNumber: w + 1,
            weekStart: weekStart.format('MMM D'),
            weekEnd: weekEnd.format('MMM D'),
            workouts: weekWorkouts,
          });
        }
      }
      const useKg = settings?.useKg ?? false;
      const weightUnit = useKg ? 'kg' : 'lb';
      const getExerciseProgressForWorkout = (sw: ScheduledWorkout, templateItemId: string, exerciseId: string): ExerciseProgress | null => {
        const keyByScheduleId = detailedWorkoutProgress[sw.id];
        const keyByTemplateDate = detailedWorkoutProgress[`${sw.templateId}-${sw.date}`];
        const progress = keyByScheduleId ?? keyByTemplateDate;
        const exerciseProgress = progress?.exercises?.[templateItemId] ?? progress?.exercises?.[exerciseId];
        return exerciseProgress ?? null;
      };
      let exportText = `${plan.name}\n`;
      exportText += `Period: ${dayjs(plan.startDate).format('MMM D, YYYY')} - ${endDate.format('MMM D, YYYY')}\n\n`;
      for (const group of weekGroups) {
        exportText += `WEEK ${group.weekNumber} (${group.weekStart} - ${group.weekEnd})\n`;
        exportText += `${'-'.repeat(40)}\n`;
        for (const sw of group.workouts) {
          exportText += `\n  ${sw.titleSnapshot} — ${dayjs(sw.date).format('ddd, MMM D')}\n`;
          for (const ex of sw.exercisesSnapshot || []) {
            const exerciseData = exercises.find(e => e.id === ex.exerciseId);
            const progress = getExerciseProgressForWorkout(sw, ex.id, ex.exerciseId);
            const isTimeBased = ex.isTimeBased === true;
            const repUnit = isTimeBased ? 'sec' : 'reps';
            exportText += `    ${exerciseData?.name || 'Unknown'}\n`;
            if (progress?.sets && progress.sets.length > 0) {
              progress.sets.forEach((set, idx) => {
                const value = set.reps ?? 0;
                exportText += `      Set ${idx + 1}: ${formatWeightForLoad(set.weight ?? 0, useKg)} ${weightUnit} × ${value} ${repUnit}${set.completed ? ' ✓' : ''}\n`;
              });
            } else {
              exportText += `      No logged data\n`;
            }
          }
        }
        exportText += '\n';
      }
      try {
        await Share.share({ message: exportText, title: plan.name });
      } catch (error) {
        Alert.alert(t('alertErrorTitle'), t('failedToExportData'));
      }
    },
    [scheduledWorkouts, exercises, detailedWorkoutProgress, settings, t]
  );

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

  /** Monday (YYYY-MM-DD) of the week currently shown in the strip (tap does not change this; swipe does). */
  const [visibleWeekMonday, setVisibleWeekMonday] = useState(() =>
    today.startOf('isoWeek').format('YYYY-MM-DD'),
  );

  const buildWeekStripDaysForWeek = useCallback(
    (weekMondayStr: string, selectedDateStr: string): WeekStripDay[] => {
      const monday = dayjs(weekMondayStr).startOf('day');
      const out: WeekStripDay[] = [];
      for (let i = 0; i < 7; i++) {
        const date = monday.add(i, 'day');
        const dateStr = date.format('YYYY-MM-DD');
        const isTodayDate = date.isSame(today, 'day');
        const scheduledWorkout = getScheduledWorkout(dateStr);
        let completionPercentage = 0;
        if (scheduledWorkout) {
          completionPercentage = getMainCompletion(scheduledWorkout.id).percentage;
        }
        const isLocked = scheduledWorkout?.isLocked || false;
        const isCompleted =
          completionPercentage === 100 || isLocked || scheduledWorkout?.status === 'completed';
        out.push({
          dateStr,
          dayNumber: date.date(),
          dayLetters: ISO_DAY_TWO_LETTER[date.isoWeekday() - 1],
          isToday: isTodayDate,
          isSelected: dateStr === selectedDateStr,
          scheduledWorkout,
          isCompleted,
          isLocked,
          completionPercentage,
        });
      }
      return out;
    },
    [today, getScheduledWorkout, getMainCompletion, refreshTrigger],
  );

  const prevWeekMondayStr = useMemo(
    () => dayjs(visibleWeekMonday).subtract(1, 'week').format('YYYY-MM-DD'),
    [visibleWeekMonday],
  );
  const nextWeekMondayStr = useMemo(
    () => dayjs(visibleWeekMonday).add(1, 'week').format('YYYY-MM-DD'),
    [visibleWeekMonday],
  );

  const prevWeekStripDays = useMemo(
    () => buildWeekStripDaysForWeek(prevWeekMondayStr, selectedDate),
    [buildWeekStripDaysForWeek, prevWeekMondayStr, selectedDate],
  );
  const currWeekStripDays = useMemo(
    () => buildWeekStripDaysForWeek(visibleWeekMonday, selectedDate),
    [buildWeekStripDaysForWeek, visibleWeekMonday, selectedDate],
  );
  const nextWeekStripDays = useMemo(
    () => buildWeekStripDaysForWeek(nextWeekMondayStr, selectedDate),
    [buildWeekStripDaysForWeek, nextWeekMondayStr, selectedDate],
  );

  // Get workouts for this week (SCHEDULE-FIRST: Only use ScheduledWorkout)
  const weekDays = React.useMemo(() => {
    return [0, 1, 2, 3, 4, 5, 6].map(index => {
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
    
    // Completed: all sets done (100%) OR workout was marked complete (isLocked / status)
    const isLocked = scheduledWorkout?.isLocked || false;
    const isCompleted = completionPercentage === 100 || isLocked || scheduledWorkout?.status === 'completed';
    
    return {
      dayLetter: ISO_DAY_TWO_LETTER[date.isoWeekday() - 1],
      dayNumber: date.date(),
      date: dateStr,
      dateObj: date,
      isToday,
      scheduledWorkout, // NEW: direct reference to scheduled workout
      isCompleted,
      isLocked, // NEW: track if workout is locked
      completionPercentage,
    };
  });
  }, [
    weekStart, 
    scheduledWorkouts, 
    getScheduledWorkout, 
    getMainCompletion,
    refreshTrigger
  ]);
  
  // Get selected day's workout (weekDays always covers the selected date's week)
  const selectedDay = weekDays.find(d => d.date === selectedDate);

  /**
   * Swipe deck for the selected date:
   * - If this calendar day has an in-progress workout (`sw.date === selectedDate`), the deck is **only**
   *   that workout (so returning from execution still shows it; store may pull `date` to today on first set).
   * - Otherwise: planned, not-finished workouts from this day forward (remaining queue for other days).
   */
  const remainingWorkoutsQueue = React.useMemo(() => {
    const isNotFinished = (sw: ScheduledWorkout) => {
      const mc = getMainCompletion(sw.id);
      return !(
        sw.isLocked ||
        mc.percentage === 100 ||
        sw.status === 'completed'
      );
    };

    const onSelectedDate = scheduledWorkouts.filter(sw => sw.date === selectedDate);
    const finishedOnSelectedDay = onSelectedDate.filter(sw => !isNotFinished(sw));
    if (finishedOnSelectedDay.length > 0) {
      return [...finishedOnSelectedDay].sort((a, b) => a.id.localeCompare(b.id));
    }
    const inProgressOnSelectedDay = onSelectedDate.filter(
      sw => sw.status === 'in_progress' && isNotFinished(sw),
    );
    if (inProgressOnSelectedDay.length > 0) {
      return [...inProgressOnSelectedDay].sort((a, b) => a.id.localeCompare(b.id));
    }

    const isPlannedDeckTile = (sw: ScheduledWorkout) =>
      sw.status === 'planned' && isNotFinished(sw);

    return scheduledWorkouts
      .filter(sw => !dayjs(sw.date).isBefore(selectedDate, 'day'))
      .filter(isPlannedDeckTile)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  }, [scheduledWorkouts, selectedDate, getMainCompletion, refreshTrigger]);
  
  const handleAddOrCreateWorkout = (currentDate: string) => {
    onOpenAddWorkout?.(currentDate);
  };
  
  const [stripViewportWidth, setStripViewportWidth] = useState(0);
  const stripWidthSV = useSharedValue(0);
  const weekStripTranslateX = useSharedValue(0);
  const panStartTranslateX = useSharedValue(0);

  const applyWeekNavigateNext = useCallback(() => {
    setVisibleWeekMonday(m => dayjs(m).add(1, 'week').format('YYYY-MM-DD'));
    setSelectedDate(d => dayjs(d).add(1, 'week').format('YYYY-MM-DD'));
  }, []);

  const applyWeekNavigatePrev = useCallback(() => {
    setVisibleWeekMonday(m => dayjs(m).subtract(1, 'week').format('YYYY-MM-DD'));
    setSelectedDate(d => dayjs(d).subtract(1, 'week').format('YYYY-MM-DD'));
  }, []);

  React.useLayoutEffect(() => {
    if (stripViewportWidth <= 0) return;
    stripWidthSV.value = stripViewportWidth;
    weekStripTranslateX.value = -stripViewportWidth;
  }, [visibleWeekMonday, stripViewportWidth]);

  const handleSelectDay = useCallback(
    (dateStr: string) => {
      if (dateStr === selectedDate) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedDate(dateStr);
    },
    [selectedDate],
  );

  const goToTodayStrip = useCallback(() => {
    const d = today.format('YYYY-MM-DD');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(d);
    setVisibleWeekMonday(dayjs(d).startOf('isoWeek').format('YYYY-MM-DD'));
  }, [today]);

  const weekPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-14, 14])
        .failOffsetY([-12, 12])
        .onStart(() => {
          cancelAnimation(weekStripTranslateX);
          panStartTranslateX.value = weekStripTranslateX.value;
        })
        .onUpdate(e => {
          'worklet';
          const w = stripWidthSV.value;
          if (w <= 0) return;
          let x = panStartTranslateX.value + e.translationX;
          const minX = -2 * w;
          const maxX = 0;
          const rubber = 0.22;
          if (x < minX) x = minX + (x - minX) * rubber;
          else if (x > maxX) x = maxX + (x - maxX) * rubber;
          weekStripTranslateX.value = x;
        })
        .onEnd(e => {
          'worklet';
          const w = stripWidthSV.value;
          if (w <= 0) return;
          const x = weekStripTranslateX.value;
          const vx = e.velocityX;
          const threshold = w * 0.2;
          const rest = -w;
          let target = rest;
          if (x <= rest - threshold || vx < -420) {
            target = -2 * w;
          } else if (x >= rest + threshold || vx > 420) {
            target = 0;
          }
          const timing = {
            duration: WEEK_STRIP_PAN_MS,
            easing: Easing.out(Easing.cubic),
          };
          if (target === -2 * w) {
            weekStripTranslateX.value = withTiming(-2 * w, timing, finished => {
              if (finished) runOnJS(applyWeekNavigateNext)();
            });
          } else if (target === 0) {
            weekStripTranslateX.value = withTiming(0, timing, finished => {
              if (finished) runOnJS(applyWeekNavigatePrev)();
            });
          } else {
            weekStripTranslateX.value = withTiming(rest, timing);
          }
        }),
    [applyWeekNavigateNext, applyWeekNavigatePrev, panStartTranslateX, stripWidthSV, weekStripTranslateX],
  );

  const weekStripTrackAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: weekStripTranslateX.value }],
  }));

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

  const navigateToWorkoutExecution = useCallback(
    (sw: ScheduledWorkout) => {
      const mainCompletion = getMainCompletion(sw.id);
      const isCompleted = sw.isLocked || mainCompletion.percentage === 100;
      if (isInPastCycle && !isCompleted) return;
      (navigation as any).navigate('ExerciseExecution', {
        workoutKey: sw.id,
        workoutTemplateId: sw.templateId,
        type: 'main',
      });
    },
    [getMainCompletion, isInPastCycle, navigation],
  );

  const handleWorkoutPress = () => {
    if (selectedDay?.scheduledWorkout) {
      navigateToWorkoutExecution(selectedDay.scheduledWorkout);
    }
  };
  
  const isScheduleFutureDay = dayjs(selectedDate).isAfter(today, 'day');

  const renderWeekStripCells = (days: WeekStripDay[], keyPrefix: string) =>
    days.map(d => (
      <View key={`${keyPrefix}-${d.dateStr}`} style={styles.weekStripCell}>
        <GHTouchableOpacity
          style={styles.weekStripCellTouchable}
          onPress={() => handleSelectDay(d.dateStr)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`${d.dayLetters} ${d.dayNumber}`}
          accessibilityState={{ selected: d.isSelected }}
        >
          <View style={styles.weekStripCellSlideContent}>
            {d.isSelected ? (
              <View style={styles.weekStripSelectedPill}>
                <Text style={[styles.weekStripDayLetters, styles.weekStripTextOnSelection]}>
                  {d.dayLetters}
                </Text>
                <View style={styles.weekStripNumWrap}>
                  <Text
                    style={[
                      styles.weekStripNum,
                      styles.weekStripTextOnSelection,
                      styles.weekStripNumSelected,
                    ]}
                  >
                    {d.dayNumber}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.weekStripDayLetters}>{d.dayLetters}</Text>
                <View style={styles.weekStripNumWrap}>
                  <Text
                    style={[
                      styles.weekStripNum,
                    ]}
                  >
                    {d.dayNumber}
                  </Text>
                </View>
              </>
            )}
          </View>
        </GHTouchableOpacity>
      </View>
    ));

  return (
      <View style={[styles.gradient, { backgroundColor: themeColors.canvasLight }]}>
        <SafeAreaView style={styles.scheduleScreenRoot} edges={[]}>
          <View style={[styles.scheduleHeaderStack, { paddingTop: insets.top }]}>
            <View style={styles.topBar}>
              <TouchableOpacity
                style={styles.scheduleHeaderLeft}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={
                  cycleChipState === 'none'
                    ? `${scheduleLabel}, ${t('startACycle')}`
                    : `${scheduleLabel}, ${cycleChipName}, ${cycleChipStatus}`
                }
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (cycleChipState === 'none') {
                    onOpenAddWorkout?.(selectedDate);
                  } else {
                    setShowCycleSheet(true);
                  }
                }}
              >
                <Text style={styles.headerTitle}>{scheduleLabel}</Text>
                <Text style={styles.scheduleCycleMetaLine} numberOfLines={1}>
                  {cycleChipState === 'none'
                    ? t('startACycle')
                    : `${cycleChipName} · ${cycleChipStatus}`}
                </Text>
              </TouchableOpacity>
              <View style={styles.headerRight}>
                {selectedDate !== today.format('YYYY-MM-DD') && (
                  <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={goToTodayStrip}
                    activeOpacity={1}
                  >
                    <IconCalendar size={24} color={COLORS.inkCharcoal} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={() => (navigation as any).navigate('Profile')}
                  activeOpacity={1}
                >
                  <IconSettings size={24} color={COLORS.inkCharcoal} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.weekStripRow}>
              <GestureDetector gesture={weekPanGesture}>
                <View
                  style={styles.weekStripClip}
                  onLayout={e => {
                    const w = e.nativeEvent.layout.width;
                    if (w > 0) setStripViewportWidth(w);
                  }}
                >
                  {stripViewportWidth > 0 ? (
                    <Animated.View
                      style={[
                        styles.weekStripSlideRowInner,
                        { width: stripViewportWidth * 3 },
                        weekStripTrackAnimatedStyle,
                      ]}
                    >
                      <View style={[styles.weekStripPanel, { width: stripViewportWidth }]}>
                        {renderWeekStripCells(prevWeekStripDays, 'p')}
                      </View>
                      <View style={[styles.weekStripPanel, { width: stripViewportWidth }]}>
                        {renderWeekStripCells(currWeekStripDays, 'c')}
                      </View>
                      <View style={[styles.weekStripPanel, { width: stripViewportWidth }]}>
                        {renderWeekStripCells(nextWeekStripDays, 'n')}
                      </View>
                    </Animated.View>
                  ) : (
                    <View style={styles.weekStripSlideRowInner}>
                      <View style={[styles.weekStripPanel, { flex: 1 }]}>
                        {renderWeekStripCells(currWeekStripDays, 'c')}
                      </View>
                    </View>
                  )}
                </View>
              </GestureDetector>
            </View>
          </View>

              <ScrollView
                style={styles.contentScroll}
                contentContainerStyle={[
                  styles.contentScrollContent,
                  {
                    paddingBottom: SPACING.lg + (isScheduleFutureDay ? insets.bottom + 8 : EXTRAS_PIN_BAR_HEIGHT),
                    flexGrow: 1,
                  },
                ]}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
              >
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
              ) : remainingWorkoutsQueue.length > 0 ? (
                <ScheduleWorkoutCardStack
                  queue={remainingWorkoutsQueue}
                  exercises={exercises}
                  getMainCompletion={getMainCompletion}
                  isInPastCycle={isInPastCycle}
                  onOpenWorkout={navigateToWorkoutExecution}
                />
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
                      const mainCompletion = getMainCompletion(sw.id);
                      const completionPercentage = mainCompletion.percentage;
                      const isCompleted =
                        completionPercentage === 100 || sw.isLocked === true || sw.status === 'completed';
                      const progress = isCompleted ? 1 : completionPercentage / 100;
                      const orderedExercises = [...(sw.exercisesSnapshot ?? [])].sort(
                        (a, b) => a.order - b.order,
                      );
                      const exerciseDisplayName = (ex: (typeof orderedExercises)[0]) => {
                        const lib = exercises.find(e => e.id === ex.exerciseId);
                        return lib?.name ?? ex.exerciseId;
                      };
                      const exTotal = orderedExercises.length;
                      const visibleExercises =
                        exTotal <= SCHEDULE_CARD_MAX_EXERCISES
                          ? orderedExercises
                          : orderedExercises.slice(0, SCHEDULE_CARD_EXERCISES_WHEN_MORE);
                      const moreExercisesCount =
                        exTotal > SCHEDULE_CARD_MAX_EXERCISES
                          ? exTotal - SCHEDULE_CARD_EXERCISES_WHEN_MORE
                          : 0;

                      return (
                        <View style={styles.workoutCardContent}>
                          <View style={styles.workoutTitleSection}>
                            <Text style={styles.workoutName} numberOfLines={4}>
                              {sw.titleSnapshot}
                            </Text>
                            {!isCompleted && progress > 0 ? (
                              <View style={styles.workoutProgressRow}>
                                <View style={styles.progressIndicator}>
                                  <Text style={styles.progressText}>{completionPercentage}%</Text>
                                  <Svg height="16" width="16" viewBox="0 0 16 16" style={styles.progressCircle}>
                                    <Circle cx="8" cy="8" r="8" fill={COLORS.accentPrimaryDimmed} />
                                    <Path
                                      d={`M 8 8 L 8 0 A 8 8 0 ${progress > 0.5 ? 1 : 0} 1 ${
                                        8 + 8 * Math.sin(2 * Math.PI * progress)
                                      } ${8 - 8 * Math.cos(2 * Math.PI * progress)} Z`}
                                      fill={COLORS.signalWarning}
                                    />
                                  </Svg>
                                </View>
                              </View>
                            ) : null}
                          </View>
                          <View style={styles.workoutExerciseList}>
                            {visibleExercises.map(ex => (
                              <Text
                                key={ex.id}
                                style={styles.workoutExerciseListItem}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {exerciseDisplayName(ex)}
                              </Text>
                            ))}
                            {moreExercisesCount > 0 ? (
                              <Text style={styles.workoutMoreExercises} numberOfLines={1}>
                                {moreExercisesCount === 1
                                  ? '+ 1 more exercise'
                                  : `+ ${moreExercisesCount} more exercises`}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    })()}
                      </TouchableOpacity>
                </View>
              ) : (
                /* Per Product Spec: Empty Day State */
                <View style={styles.restDayContainer}>
                  <View style={styles.restDayContent}>
                    {dayjs(selectedDate).isBefore(today, 'day') ? (
                      <Text style={styles.restDayQuestion}>
                        <Text style={styles.restDayQuestionGray}>{t('noWorkoutPerformedThisDay')}</Text>
                      </Text>
                    ) : selectedDateCyclePlan?.active ? (
                      <Text style={styles.restDayQuestion}>
                        <Text style={styles.restDayQuestionGray}>{t('restDayTitle')}</Text>
                      </Text>
                    ) : (
                      <>
                        <Text style={styles.restDayQuestion}>
                          <Text style={styles.restDayQuestionGray}>No cycles in progress</Text>
                        </Text>
                        <TouchableOpacity
                          style={styles.createCycleButton}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onOpenAddWorkout?.(selectedDate);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.createCycleButtonText}>Create new one</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              )}

              <View style={styles.cardActionsContainer}>
                {!isPausedDay &&
                !selectedDay?.scheduledWorkout &&
                !dayjs(selectedDate).isBefore(today, 'day') &&
                activeCyclePlan &&
                selectedDateCyclePlan?.active ? (
                  <TouchableOpacity
                    style={styles.addWorkoutButton}
                    onPress={() => handleAddOrCreateWorkout(selectedDate)}
                    activeOpacity={1}
                  >
                    <IconAdd size={24} color={COLORS.accentPrimary} />
                    <Text style={styles.addWorkoutButtonText}>{t('addWorkout')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              </View>
              </View>
              </ScrollView>

          {!isScheduleFutureDay &&
            (() => {
              const todayDate = today.format('YYYY-MM-DD');
              const isTodaySelected = selectedDate === todayDate;
              const isPastDay = dayjs(selectedDate).isBefore(today, 'day');

              const rawBonusItems = getBonusLogsForDate(selectedDate);
              const bonusItems = [...rawBonusItems].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              );
              const count = bonusItems.length;
              const contentWidth = Dimensions.get('window').width - SPACING.xxl * 2;
              const carouselCardWidth = (contentWidth - SPACING.sm) / 2;
              const carouselSnapInterval = carouselCardWidth + SPACING.sm;

              const BonusTypeIcon = ({ type, size = 16 }: { type: BonusType; size?: number }) => {
                if (type === 'timer') return <IconStopwatch size={size} color={COLORS.textMeta} />;
                if (type === 'warmup') return <IconWarmup size={size} color={COLORS.textMeta} />;
                return <IconCore size={size} color={COLORS.textMeta} />;
              };

              const renderBonusCard = (
                item: (typeof bonusItems)[0],
                inCarousel?: boolean,
                carouselWidth?: number,
              ) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    inCarousel
                      ? [styles.bonusCarouselCard, carouselWidth !== undefined && { width: carouselWidth }]
                      : count === 2
                        ? styles.bonusCardHalf
                        : styles.bonusCardWrapper,
                  ]}
                  onPress={() => (navigation as any).navigate('BonusDetail', { bonusLogId: item.id })}
                  activeOpacity={0.85}
                >
                  <View style={styles.bonusPresetCard}>
                    <View style={[styles.bonusPresetCardInner, count === 2 && styles.bonusPresetCardInnerCompact]}>
                      <Text style={styles.bonusPresetCardName} numberOfLines={2}>
                        {item.presetName}
                      </Text>
                      <View style={styles.bonusPresetCardBottomRow}>
                        {item.status === 'completed' ? (
                          <View style={styles.bonusPresetCardCta}>
                            <IconCheckmark size={16} color={COLORS.successBright} />
                          </View>
                        ) : (
                          <View style={styles.bonusPresetCardCta} pointerEvents="none">
                            <Text style={styles.bonusPresetCardCtaStart}>{t('start')}</Text>
                            <IconPlay size={10} color={COLORS.accentPrimary} />
                          </View>
                        )}
                        <BonusTypeIcon type={item.type} size={20} />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );

              const extrasPanel = (
                <View style={styles.extrasPanelInner}>
                  <View style={styles.bonusSectionHeader}>
                    <Text style={styles.intervalsSectionTitle}>{t('extras')}</Text>
                  </View>
                  {count === 0 && isPastDay && (
                    <Text style={styles.noIntervalsText}>{t('noBonusPerformedThisDay')}</Text>
                  )}
                  {count === 0 && isTodaySelected && (
                    <TouchableOpacity
                      style={styles.addIntervalCardButton}
                      onPress={() => onOpenBonusDrawer?.()}
                      activeOpacity={0.7}
                    >
                      <DiagonalLinePattern width="100%" height={56} borderRadius={16} />
                      <IconAdd size={24} color={COLORS.inkCharcoal} />
                        <Text style={styles.addIntervalCardText}>{t('addBonus')}</Text>
                      </TouchableOpacity>
                    )}
                    {count === 1 && <View style={styles.bonusCardsRow}>{renderBonusCard(bonusItems[0])}</View>}
                  {count === 2 && (
                    <View style={styles.bonusCardsRow}>
                      {bonusItems.map(item => renderBonusCard(item))}
                    </View>
                  )}
                  {count >= 3 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.bonusCarouselContent}
                      style={styles.bonusCarousel}
                      snapToInterval={carouselSnapInterval}
                      snapToAlignment="start"
                      decelerationRate="fast"
                    >
                      {bonusItems.map(item => renderBonusCard(item, true, carouselCardWidth))}
                    </ScrollView>
                  )}
                  {isTodaySelected && count > 0 && (
                    <TouchableOpacity
                      style={[styles.addIntervalCardButton, styles.addIntervalCardButtonBelow]}
                      onPress={() => onOpenBonusDrawer?.()}
                      activeOpacity={0.7}
                    >
                      <DiagonalLinePattern width="100%" height={56} borderRadius={16} />
                      <IconAdd size={24} color={COLORS.inkCharcoal} />
                      <Text style={styles.addIntervalCardText}>{t('addBonus')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );

              return (
                <>
                  {extrasExpanded && (
                    <View
                      style={[
                        styles.extrasPanel,
                        { maxHeight: Dimensions.get('window').height * 0.4 },
                      ]}
                    >
                      <ScrollView
                        nestedScrollEnabled
                        showsVerticalScrollIndicator={false}
                        style={styles.extrasPanelScroll}
                        contentContainerStyle={styles.extrasPanelScrollContent}
                      >
                        {extrasPanel}
                      </ScrollView>
                    </View>
                  )}
                  <View style={[styles.extrasPinBarWrap, { paddingBottom: insets.bottom }]}>
                    <TouchableOpacity
                      style={styles.extrasPinBar}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setExtrasExpanded(v => !v);
                      }}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={t('extras')}
                      accessibilityState={{ expanded: extrasExpanded }}
                    >
                      <View style={styles.extrasPinBarInner}>
                        <View
                          style={{
                            transform: [{ rotate: extrasExpanded ? '0deg' : '180deg' }],
                          }}
                        >
                          <IconChevronDown size={20} color={COLORS.inkCharcoal} />
                        </View>
                        <Text style={styles.extrasPinLabel}>{t('extras')}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}

        </SafeAreaView>

        {/* Cycle Control Sheet */}
        <CycleControlSheet
          visible={showCycleSheet}
          onClose={() => setShowCycleSheet(false)}
          cycleState={cycleChipState}
          plan={cycleChipState === 'finished' ? selectedDateCyclePlan ?? undefined : (selectedDateCyclePlan?.active ? selectedDateCyclePlan : activeCyclePlan)}
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
          onDelete={() => {
            if (activeCyclePlan) deleteCyclePlanCompletely(activeCyclePlan.id);
          }}
          onShare={(plan) => {
            setShowCycleSheet(false);
            setShareCyclePlan(plan);
            setShowShareCycleSheet(true);
          }}
          onExportData={handleExportData}
          onStartCycle={() => {
            (navigation as any).navigate('CreateCycleFlow', { selectedDate: today.format('YYYY-MM-DD') });
          }}
        />

        <ShareCycleDrawer
          visible={showShareCycleSheet}
          onClose={() => {
            setShowShareCycleSheet(false);
            setShareCyclePlan(undefined);
          }}
          plan={shareCyclePlan}
          onExportData={handleExportData}
        />
      </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  scheduleScreenRoot: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    padding: SPACING.xxl,
  },
  contentScroll: {
    flex: 1,
    minHeight: 0,
  },
  contentScrollContent: {
    padding: SPACING.xxl,
    paddingBottom: SPACING.xxl,
  },
  workoutContentWrapper: {
    // Wrapper contains cardsContainer
  },
  cardsContainer: {
    position: 'relative',
    width: '100%',
    minHeight: 328,
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
    color: COLORS.inkCharcoal,
    marginBottom: SPACING.xs,
  },
  emptyText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.inkCharcoal,
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
  
  scheduleHeaderStack: {
    backgroundColor: 'transparent',
    paddingBottom: SPACING.sm,
  },
  weekStripRow: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    alignItems: 'stretch',
  },
  weekStripClip: {
    width: '100%',
    overflow: 'hidden',
  },
  weekStripSlideRowInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  weekStripPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  weekStripCell: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekStripCellTouchable: {
    width: '100%',
    alignItems: 'center',
  },
  weekStripCellSlideContent: {
    alignItems: 'center',
    width: '100%',
  },
  weekStripDayLetters: {
    ...TYPOGRAPHY.note,
    color: COLORS.textMeta,
    fontVariant: ['tabular-nums'],
  },
  weekStripSelectedPill: {
    backgroundColor: COLORS.containerTertiary,
    borderRadius: 10,
    paddingTop: 10,
    alignItems: 'center',
    alignSelf: 'center',
  },
  weekStripTextOnSelection: {
    color: COLORS.inkCharcoal,
  },
  weekStripNumWrap: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  weekStripNum: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textMeta,
    fontVariant: ['tabular-nums'],
  },
  weekStripNumSelected: {
    fontWeight: '500' as const,
  },
  extrasPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(31, 31, 31, 0.12)',
    backgroundColor: COLORS.canvasLight,
  },
  extrasPanelScroll: {
    flexGrow: 0,
  },
  extrasPanelScrollContent: {
    paddingBottom: SPACING.md,
  },
  extrasPanelInner: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  extrasPinBarWrap: {
    backgroundColor: COLORS.canvasLight,
  },
  extrasPinBar: {
    minHeight: EXTRAS_PIN_BAR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  extrasPinBarInner: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  extrasPinLabel: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.inkCharcoal,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
    marginBottom: 12,
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    fontWeight: '500' as const,
    color: COLORS.inkCharcoal,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /** Title + cycle line; tap opens cycle control (or start cycle when none). */
  scheduleHeaderLeft: {
    flex: 1,
    minWidth: 0,
    marginRight: SPACING.sm,
    justifyContent: 'center',
  },
  scheduleCycleMetaLine: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    marginTop: 2,
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
    color: COLORS.inkCharcoal,
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
    backgroundColor: COLORS.inkCharcoal,
    borderRadius: CARDS.cardDeep.outer.borderRadius,
    borderCurve: CARDS.cardDeep.outer.borderCurve,
    overflow: CARDS.cardDeep.outer.overflow,
    borderWidth: 2,
    borderColor: COLORS.canvasLight,
    width: '100%',
    minHeight: 300,
  },
  workoutCardInner: {
    flex: 1,
    minHeight: 300,
    padding: 16,
    justifyContent: 'flex-start',
    borderRadius: CARDS.cardDeep.inner.borderRadius,
    borderCurve: CARDS.cardDeep.inner.borderCurve,
    backgroundColor: 'transparent',
  },
  workoutCardContent: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    width: '100%',
  },
  workoutProgressRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    marginBottom: 4,
  },
  /** Workout title + optional progress; 64px below before exercise list */
  workoutTitleSection: {
    paddingBottom: 64,
    width: '100%',
  },
  workoutName: {
    ...TYPOGRAPHY.displayLarge,
    fontWeight: '400',
    color: COLORS.canvasLight,
    flexShrink: 1,
  },
  workoutExerciseList: {
    gap: 10,
    width: '100%',
  },
  workoutExerciseListItem: {
    ...TYPOGRAPHY.body,
    color: COLORS.canvasLight,
    opacity: 0.9,
  },
  workoutMoreExercises: {
    ...TYPOGRAPHY.body,
    color: COLORS.canvasLight,
    opacity: 0.65,
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
    color: COLORS.canvasLight,
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
    backgroundColor: COLORS.accentPrimaryDimmed,
  },
  startButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.inkCharcoal,
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
  startButtonTextSkippedOnCard: {
    color: 'rgba(245, 244, 244, 0.55)',
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
    color: COLORS.inkCharcoal,
  },
  createCycleButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.accentPrimaryDimmed,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createCycleButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.accentPrimary,
  },
  restDayQuestionBlack: {
    color: COLORS.inkCharcoal,
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
  
  cardActionsContainer: {
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  
  // Intervals / Bonus Section
  bonusSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  intervalsSectionTitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.inkCharcoal,
    textTransform: 'uppercase',
  },
  bonusShowAllText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
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
  addIntervalCardButtonBelow: {
    marginTop: SPACING.lg,
  },
  addIntervalCardText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.inkCharcoal,
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
    color: COLORS.inkCharcoal,
  },
  bonusCardWrapper: {
    marginBottom: SPACING.sm,
  },
  bonusPresetCard: {
    ...CARDS.cardDeepDimmed.outer,
  },
  bonusPresetCardInner: {
    ...CARDS.cardDeepDimmed.inner,
    paddingVertical: SPACING.lg,
    paddingHorizontal: 24,
    height: 100,
    justifyContent: 'space-between',
  },
  bonusPresetCardInnerCompact: {
    paddingVertical: SPACING.md,
    paddingHorizontal: 16,
    height: 100,
    justifyContent: 'space-between',
  },
  bonusPresetCardName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    marginBottom: 4,
  },
  bonusPresetCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bonusPresetCardMeta: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  bonusPresetCardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bonusPresetCardCtaStart: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
  },
  bonusCardsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  bonusCardHalf: {
    flex: 1,
    minWidth: 0,
  },
  bonusCarousel: {
    marginHorizontal: -SPACING.xxl,
    marginBottom: SPACING.sm,
  },
  bonusCarouselContent: {
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.sm,
    flexDirection: 'row',
  },
  bonusCarouselCard: {
    marginRight: 0,
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
    color: COLORS.inkCharcoal,
    marginTop: SPACING.sm,
  },
  
  bonusCardLeft: {
    flex: 1,
    marginRight: SPACING.md,
    gap: 4,
  },
  bonusTypeMeta: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginTop: 2,
  },
  bonusTypeIconWrap: {
    marginTop: 4,
  },
  bonusStatusText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
});





