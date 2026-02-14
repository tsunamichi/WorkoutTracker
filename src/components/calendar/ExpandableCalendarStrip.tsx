import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
import { COLORS, SPACING, TYPOGRAPHY, CYCLE_COLORS } from '../../constants';
import { CalendarDayButton } from './CalendarDayButton';
import { DragHandle } from './DragHandle';
import type { CyclePlan, ScheduledWorkout } from '../../types/training';

dayjs.extend(isoWeek);

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const ROW_HEIGHT = 50;
const COLLAPSED_HEIGHT = ROW_HEIGHT;
const HEADER_HEIGHT = 44;
const EXPANDED_HEIGHT = HEADER_HEIGHT + ROW_HEIGHT * 5;
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
};

export function ExpandableCalendarStrip({
  selectedDate,
  onSelectDate,
  cyclePlans,
  getScheduledWorkout,
  getMainCompletion,
}: ExpandableCalendarStripProps) {
  const today = dayjs();
  const selectedDayjs = dayjs(selectedDate);
  const centerWeekStart = selectedDayjs.startOf('isoWeek');

  const expansion = useSharedValue(0);
  const isExpanded = useSharedValue(false);

  // Build cycle color map: date -> color
  const cycleColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    const sortedPlans = [...cyclePlans]
      .filter(p => p.active || !p.archivedAt)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));

    sortedPlans.forEach((plan, planIndex) => {
      const colorIndex = planIndex % CYCLE_COLORS.length;
      const color = CYCLE_COLORS[colorIndex];
      const start = dayjs(plan.startDate);
      const totalDays = plan.weeks * 7;
      for (let d = 0; d < totalDays; d++) {
        const dateStr = start.add(d, 'day').format('YYYY-MM-DD');
        if (!map[dateStr]) {
          map[dateStr] = color;
        }
      }
    });
    return map;
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
        });
      }
      weeks.push(days);
    }
    return weeks;
  }, [centerWeekStart, today, getScheduledWorkout, getMainCompletion, cycleColorMap]);

  // Compute row-level cycle band color: if any day in the week is in a cycle, use that color
  const weekBandColors = useMemo(() => {
    return weeksData.map((weekDays) => {
      const firstCycleDay = weekDays.find(d => d.cycleColor);
      return firstCycleDay?.cycleColor || null;
    });
  }, [weeksData]);

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

  const expandedHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expansion.value, [0, 0.4, 1], [0, 0, 1]),
    height: interpolate(expansion.value, [0, 1], [0, HEADER_HEIGHT]),
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
    const bandColor = weekBandColors[weekIdx];

    return (
      <Animated.View
        key={weekIdx}
        style={[styles.weekRow, weekRowStyles[weekIdx]]}
      >
        {/* Cycle background band behind the day buttons */}
        {bandColor && (
          <View style={[styles.cycleBand, { backgroundColor: bandColor }]} />
        )}

        {/* Day buttons on top */}
        {weekDays.map((day) => (
          <View key={day.date} style={styles.dayCell}>
            <CalendarDayButton
              dayNumber={day.dayNumber}
              isSelected={day.date === selectedDate}
              isToday={day.isToday}
              isCompleted={day.isCompleted}
              hasWorkout={day.hasWorkout}
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
        {/* Expanded header */}
        <Animated.View style={[styles.expandedHeader, expandedHeaderStyle]}>
          <Text style={styles.monthLabel}>{expandedLabel}</Text>
          <View style={styles.dayOfWeekRow}>
            {DAYS_SHORT.map((letter, i) => (
              <View key={i} style={styles.dayCell}>
                <Text style={styles.dayOfWeekText}>{letter}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Week rows */}
        {weeksData.map((weekDays, idx) => renderWeekRow(weekDays, idx))}
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
  expandedHeader: {
    overflow: 'hidden',
  },
  monthLabel: {
    ...TYPOGRAPHY.metaBold,
    color: '#1B1B1B',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  dayOfWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  dayOfWeekText: {
    ...TYPOGRAPHY.note,
    color: COLORS.textMeta,
    textAlign: 'center',
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
    top: 4,
    bottom: 4,
    borderRadius: 14,
    borderCurve: 'continuous' as any,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    zIndex: 1,
  },
});
