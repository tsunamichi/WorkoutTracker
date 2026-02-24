import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { COLORS, SPACING, TYPOGRAPHY } from '../../constants';
import { CalendarDayButton } from './CalendarDayButton';
import { DragHandle } from './DragHandle';
import type { CyclePlan, ScheduledWorkout } from '../../types/training';

dayjs.extend(isoWeek);

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const ROW_HEIGHT = 50;
const DAY_LETTERS_HEIGHT = 24;
const MONTH_LABEL_HEIGHT = 24;
const COLLAPSED_HEIGHT = DAY_LETTERS_HEIGHT + ROW_HEIGHT;
const EXPANDED_HEIGHT = DAY_LETTERS_HEIGHT + MONTH_LABEL_HEIGHT + ROW_HEIGHT * 5;
const SNAP_THRESHOLD = 0.35;

const SPRING_CONFIG = {
  damping: 22,
  stiffness: 220,
  mass: 0.8,
};

interface ExpandableCalendarStripProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  cyclePlans: CyclePlan[];
  scheduledWorkouts: ScheduledWorkout[];
  getScheduledWorkout: (date: string) => ScheduledWorkout | undefined;
  getMainCompletion: (workoutId: string) => { percentage: number };
}

type DayData = {
  date: string;
  dayNumber: number;
  isToday: boolean;
  hasWorkout: boolean;
  isCompleted: boolean;
  cycleColor?: string;
  isInActiveCycle: boolean;
  isPaused: boolean;
};

export function ExpandableCalendarStrip({
  selectedDate,
  onSelectDate,
  cyclePlans,
  scheduledWorkouts,
  getScheduledWorkout,
  getMainCompletion,
}: ExpandableCalendarStripProps) {
  const today = dayjs();
  const selectedDayjs = dayjs(selectedDate);
  const centerWeekStart = selectedDayjs.startOf('isoWeek');

  const expansion = useSharedValue(0);
  const isExpanded = useSharedValue(false);

  // Fingerprint to force recalc when any plan field changes
  const cyclePlansFingerprint = cyclePlans.map(p =>
    `${p.id}:${p.active}:${p.startDate}:${p.weeks}:${p.endedAt || ''}:${p.pausedUntil || ''}`
  ).join('|');

  const scheduledWorkoutsFingerprint = scheduledWorkouts.length + ':' +
    scheduledWorkouts.filter(sw => sw.source === 'cycle').map(sw => `${sw.date}:${sw.programId}`).join(',');

  // Build cycle color map and plan ID map: date -> color, date -> planId
  // Process inactive plans first so active plans always take priority on overlapping dates.
  // When a cycle is paused, the strip extends to the new effective end date and
  // skips the paused gap (days between today and pausedUntil).
  const { cycleColorMap, dateToPlanId, pausedDates } = useMemo(() => {
    const colorMap: Record<string, string> = {};
    const planIdMap: Record<string, string> = {};
    const paused = new Set<string>();
    const inactivePlans = cyclePlans.filter(p => !p.active);
    const activePlans = cyclePlans.filter(p => p.active);
    const todayStr = dayjs().format('YYYY-MM-DD');

    // Pre-compute last scheduled workout date per cycle plan
    const lastWorkoutByPlan: Record<string, string> = {};
    for (const sw of scheduledWorkouts) {
      if (sw.source === 'cycle' && (sw.programId || sw.cyclePlanId)) {
        const pid = sw.programId || sw.cyclePlanId!;
        if (!lastWorkoutByPlan[pid] || sw.date > lastWorkoutByPlan[pid]) {
          lastWorkoutByPlan[pid] = sw.date;
        }
      }
    }

    const paintPlan = (plan: CyclePlan) => {
      const color = plan.active ? COLORS.accentPrimaryDimmed : COLORS.backgroundCanvas;
      const start = dayjs(plan.startDate);

      let end: dayjs.Dayjs;
      if (plan.endedAt) {
        end = dayjs(plan.endedAt);
      } else if (lastWorkoutByPlan[plan.id]) {
        // Use the actual last scheduled workout as the cycle's visual end
        end = dayjs(lastWorkoutByPlan[plan.id]);
      } else {
        end = start.add(plan.weeks, 'week').subtract(1, 'day');
      }

      const isPaused = plan.pausedUntil && dayjs(plan.pausedUntil).isAfter(todayStr, 'day');

      const totalDays = end.diff(start, 'day') + 1;
      for (let d = 0; d < totalDays; d++) {
        const dateStr = start.add(d, 'day').format('YYYY-MM-DD');
        const isInPausedGap = isPaused && dateStr >= todayStr && dateStr < plan.pausedUntil!;
        if (isInPausedGap) {
          paused.add(dateStr);
        }
        colorMap[dateStr] = color;
        planIdMap[dateStr] = plan.id;
      }
    };

    inactivePlans.forEach(paintPlan);
    activePlans.forEach(paintPlan);

    return { cycleColorMap: colorMap, dateToPlanId: planIdMap, pausedDates: paused };
  }, [cyclePlansFingerprint, scheduledWorkoutsFingerprint]);

  // Set of active plan IDs for quick lookup
  const activePlanIds = useMemo(() => {
    return new Set(cyclePlans.filter(p => p.active).map(p => p.id));
  }, [cyclePlans]);

  // Build 5 weeks of data
  const weeksData = useMemo(() => {
    const weeks: DayData[][] = [];
    for (let weekIdx = -2; weekIdx <= 2; weekIdx++) {
      const weekStart = centerWeekStart.add(weekIdx, 'week');
      const days: DayData[] = [];
      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const date = weekStart.add(dayIdx, 'day');
        const dateStr = date.format('YYYY-MM-DD');
        const sw = getScheduledWorkout(dateStr);
        const isCompleted = sw
          ? sw.status === 'completed' || getMainCompletion(sw.id).percentage === 100
          : false;
        days.push({
          date: dateStr,
          dayNumber: date.date(),
          isToday: date.isSame(today, 'day'),
          hasWorkout: !!sw,
          isCompleted,
          cycleColor: cycleColorMap[dateStr],
          isInActiveCycle: activePlanIds.has(dateToPlanId[dateStr]),
          isPaused: pausedDates.has(dateStr),
        });
      }
      weeks.push(days);
    }
    return weeks;
  }, [centerWeekStart, today, getScheduledWorkout, getMainCompletion, cycleColorMap]);

  // Compute row-level cycle band info: show bands for ALL cycles (past and active).
  // Each row can have multiple bands if different plans cover different date ranges.
  // For simplicity, we render a single contiguous band per row per plan, grouped by planId.
  type BandInfo = { color: string; startIndex: number; endIndex: number; planId: string; pausedStartIndex: number | null; pausedEndIndex: number | null };
  const weekBandInfo = useMemo(() => {
    return weeksData.map((weekDays) => {
      const bands: BandInfo[] = [];
      let currentBand: BandInfo | null = null;

      weekDays.forEach((d, idx) => {
        const planId = dateToPlanId[d.date];
        if (d.cycleColor && planId) {
          if (currentBand && currentBand.planId === planId) {
            currentBand.endIndex = idx;
          } else {
            if (currentBand) bands.push(currentBand);
            currentBand = { color: d.cycleColor, startIndex: idx, endIndex: idx, planId, pausedStartIndex: null, pausedEndIndex: null };
          }
          if (pausedDates.has(d.date)) {
            if (currentBand!.pausedStartIndex === null) currentBand!.pausedStartIndex = idx;
            currentBand!.pausedEndIndex = idx;
          }
        } else {
          if (currentBand) { bands.push(currentBand); currentBand = null; }
        }
      });
      if (currentBand) bands.push(currentBand);

      return bands.length > 0 ? bands : null;
    });
  }, [weeksData, dateToPlanId, pausedDates]);

  // Month/year label
  const expandedLabel = useMemo(() => {
    const first = dayjs(weeksData[0][0].date);
    const last = dayjs(weeksData[4][6].date);
    if (first.month() === last.month()) {
      return first.format('MMMM YYYY');
    }
    return `${first.format('MMM')} - ${last.format('MMM YYYY')}`;
  }, [weeksData]);

  const handleSelectDate = useCallback(
    (date: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelectDate(date);
      if (isExpanded.value) {
        expansion.value = withSpring(0, SPRING_CONFIG);
        isExpanded.value = false;
      }
    },
    [onSelectDate, expansion, isExpanded],
  );

  // Pan gesture
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      const maxDrag = EXPANDED_HEIGHT - COLLAPSED_HEIGHT;
      if (isExpanded.value) {
        const progress = 1 + e.translationY / maxDrag;
        expansion.value = Math.max(0, Math.min(1, progress));
      } else {
        const progress = e.translationY / maxDrag;
        expansion.value = Math.max(0, Math.min(1, progress));
      }
    })
    .onEnd(() => {
      if (isExpanded.value) {
        if (expansion.value < 1 - SNAP_THRESHOLD) {
          expansion.value = withSpring(0, SPRING_CONFIG);
          isExpanded.value = false;
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        } else {
          expansion.value = withSpring(1, SPRING_CONFIG);
        }
      } else {
        if (expansion.value > SNAP_THRESHOLD) {
          expansion.value = withSpring(1, SPRING_CONFIG);
          isExpanded.value = true;
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        } else {
          expansion.value = withSpring(0, SPRING_CONFIG);
        }
      }
    });

  // -- Animated styles --
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(expansion.value, [0, 1], [COLLAPSED_HEIGHT, EXPANDED_HEIGHT]),
  }));

  // Month label: slides in above the day letters once expansion is underway
  const monthLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expansion.value, [0, 0.3, 0.6], [0, 0, 1]),
    height: interpolate(expansion.value, [0, 0.5, 1], [0, 0, MONTH_LABEL_HEIGHT]),
    overflow: 'hidden' as const,
  }));


  // All rows translate by -2*ROW_HEIGHT when collapsed to bring center row to top
  const weekRowStyle0 = useAnimatedStyle(() => ({
    opacity: interpolate(expansion.value, [0, 0.4, 1], [0, 0.2, 1]),
    transform: [{ translateY: interpolate(expansion.value, [0, 1], [-2 * ROW_HEIGHT, 0]) }],
  }));
  const weekRowStyle1 = useAnimatedStyle(() => ({
    opacity: interpolate(expansion.value, [0, 0.3, 1], [0, 0.3, 1]),
    transform: [{ translateY: interpolate(expansion.value, [0, 1], [-2 * ROW_HEIGHT, 0]) }],
  }));
  const weekRowStyle2 = useAnimatedStyle(() => ({
    opacity: 1,
    transform: [{ translateY: interpolate(expansion.value, [0, 1], [-2 * ROW_HEIGHT, 0]) }],
  }));
  const weekRowStyle3 = useAnimatedStyle(() => ({
    opacity: interpolate(expansion.value, [0, 0.3, 1], [0, 0.3, 1]),
    transform: [{ translateY: interpolate(expansion.value, [0, 1], [-2 * ROW_HEIGHT, 0]) }],
  }));
  const weekRowStyle4 = useAnimatedStyle(() => ({
    opacity: interpolate(expansion.value, [0, 0.4, 1], [0, 0.2, 1]),
    transform: [{ translateY: interpolate(expansion.value, [0, 1], [-2 * ROW_HEIGHT, 0]) }],
  }));
  const weekRowStyles = [weekRowStyle0, weekRowStyle1, weekRowStyle2, weekRowStyle3, weekRowStyle4];

  const renderWeekRow = (weekDays: DayData[], weekIdx: number) => {
    const bands = weekBandInfo[weekIdx];

    return (
      <Animated.View
        key={weekIdx}
        style={[styles.weekRow, weekRowStyles[weekIdx]]}
      >
        {/* Cycle background bands — one per plan segment in this row */}
        {bands && bands.map((band, bIdx) => {
          const bandLeft = `${(band.startIndex / 7) * 100}%` as const;
          const bandRight = `${((6 - band.endIndex) / 7) * 100}%` as const;
          return (
            <React.Fragment key={`band-${bIdx}`}>
              <View
                style={[
                  styles.cycleBand,
                  {
                    backgroundColor: band.color,
                    left: bandLeft as any,
                    right: bandRight as any,
                    marginLeft: 3,
                    marginRight: 3,
                  },
                ]}
              />
              {band.pausedStartIndex !== null && band.pausedEndIndex !== null && (
                <View
                  style={{
                    position: 'absolute',
                    top: 5,
                    bottom: 5,
                    left: `${(band.pausedStartIndex / 7) * 100}%` as any,
                    right: `${((6 - band.pausedEndIndex) / 7) * 100}%` as any,
                    marginLeft: 3,
                    marginRight: 3,
                    borderRadius: 20,
                    overflow: 'hidden',
                    zIndex: 1,
                    backgroundColor: COLORS.backgroundContainer,
                  }}
                  pointerEvents="none"
                >
                  <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                    {Array.from({ length: 200 }, (_, i) => {
                      const offset = (i - 100) * 6;
                      return (
                        <Line
                          key={i}
                          x1={offset}
                          y1={0}
                          x2={offset + 500}
                          y2={500}
                          stroke={COLORS.accentPrimaryDimmed}
                          strokeWidth={2}
                        />
                      );
                    })}
                  </Svg>
                </View>
              )}
            </React.Fragment>
          );
        })}

        {/* Day buttons on top */}
        {weekDays.map((day) => (
          <View key={day.date} style={styles.dayCell}>
            <CalendarDayButton
              dayNumber={day.dayNumber}
              isSelected={day.date === selectedDate}
              isToday={day.isToday}
              isCompleted={day.isCompleted}
              hasWorkout={day.hasWorkout}
              cycleColor={day.cycleColor}
              isInActiveCycle={day.isInActiveCycle}
              isPaused={day.isPaused}
              onPress={() => handleSelectDate(day.date)}
            />
          </View>
        ))}
      </Animated.View>
    );
  };

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.container, containerAnimatedStyle]}>
        {/* Month label — grows into view at ~50% expansion */}
        <Animated.View style={monthLabelStyle}>
          <Text style={styles.monthLabel}>{expandedLabel}</Text>
        </Animated.View>

        {/* Day letters — always visible, pushed down by month label's animated height */}
        <View style={styles.dayOfWeekRow}>
          {DAYS_SHORT.map((letter, i) => (
            <View key={i} style={styles.dayCell}>
              <Text style={styles.dayOfWeekText}>{letter}</Text>
            </View>
          ))}
        </View>

        {/* Week rows container — isolates row animations from day letters */}
        <View style={styles.weeksContainer}>
          {weeksData.map((weekDays, idx) => renderWeekRow(weekDays, idx))}
        </View>
      </Animated.View>

      {/* Drag handle */}
      <GestureDetector gesture={panGesture}>
        <Animated.View>
          <DragHandle />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
  },
  container: {
    overflow: 'hidden',
  },
  monthLabel: {
    ...TYPOGRAPHY.metaBold,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  dayOfWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: DAY_LETTERS_HEIGHT,
    alignItems: 'center',
  },
  dayOfWeekText: {
    ...TYPOGRAPHY.note,
    color: COLORS.textMeta,
    textAlign: 'center',
  },
  weeksContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: ROW_HEIGHT,
    alignItems: 'center',
    position: 'relative',
  },
  cycleBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 5,
    bottom: 5,
    borderRadius: 20,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    zIndex: 1,
  },
});
