import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY } from '../../constants';

interface CalendarDayButtonProps {
  dayNumber: number;
  isSelected: boolean;
  isToday: boolean;
  isCompleted: boolean;
  hasWorkout: boolean;
  cycleColor?: string;
  isInActiveCycle?: boolean;
  isPaused?: boolean;
  /** When false, day is from adjacent month (e.g. in a full grid); use meta color unless selected. */
  isCurrentMonth?: boolean;
  onPress: () => void;
}

export function CalendarDayButton({
  dayNumber,
  isSelected,
  isToday,
  isCompleted,
  hasWorkout,
  cycleColor,
  isInActiveCycle,
  isPaused,
  isCurrentMonth = true,
  onPress,
}: CalendarDayButtonProps) {
  return (
    <TouchableOpacity
      style={styles.touchable}
      onPress={onPress}
      activeOpacity={1}
    >
      <View
        style={[
          styles.dayButton,
          isToday && !isSelected && styles.dayButtonToday,
          isSelected && !isToday && styles.dayButtonSelected,
          isSelected && isToday && (isInActiveCycle ? styles.dayButtonSelected : styles.dayButtonTodaySelected),
        ]}
      >
        <Text
          style={[
            styles.dayNumber,
            isCurrentMonth === false && !isSelected && styles.dayNumberOtherMonth,
            isPaused && !isSelected && styles.dayNumberPaused,
            isToday && !isSelected && styles.dayNumberToday,
            isSelected && styles.dayNumberSelected,
          ]}
        >
          {dayNumber}
        </Text>
        {/* Workout indicator: 2x2 circle — outline when scheduled, filled when completed */}
        {(hasWorkout || isCompleted) && (
          <View
            style={[
              styles.completionCircle,
              isCompleted ? styles.completionCircleFilled : styles.completionCircleOutline,
              isSelected && (isCompleted ? styles.completionCircleFilledSelected : styles.completionCircleOutlineSelected),
            ]}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonToday: {
    // no background or border — just text color change
  },
  dayButtonSelected: {
    backgroundColor: COLORS.accentPrimary,
  },
  dayButtonTodaySelected: {
    backgroundColor: COLORS.accentPrimary,
  },
  dayNumber: {
    ...TYPOGRAPHY.metaBold,
    color: '#FFFFFF',
  },
  dayNumberOtherMonth: {
    color: COLORS.textMeta,
  },
  dayNumberSelected: {
    color: COLORS.backgroundCanvas,
  },
  dayNumberToday: {
    color: COLORS.accentPrimary,
  },
  dayNumberPaused: {
    color: COLORS.textMeta,
  },
  completionCircle: {
    position: 'absolute',
    bottom: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  completionCircleOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  completionCircleOutlineSelected: {
    borderColor: COLORS.backgroundCanvas,
  },
  completionCircleFilled: {
    backgroundColor: '#FFFFFF',
  },
  completionCircleFilledSelected: {
    backgroundColor: COLORS.backgroundCanvas,
  },
});
