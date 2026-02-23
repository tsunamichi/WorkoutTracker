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
            isPaused && !isSelected && styles.dayNumberPaused,
            isToday && !isSelected && styles.dayNumberToday,
            isSelected && styles.dayNumberSelected,
          ]}
        >
          {dayNumber}
        </Text>
        {/* Completed indicator: pill inside the circle, 2px below label */}
        {isCompleted && (
          <View
            style={[
              styles.completedPill,
              isSelected && styles.completedPillSelected,
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
  dayNumberSelected: {
    color: COLORS.backgroundCanvas,
  },
  dayNumberToday: {
    color: COLORS.accentPrimary,
  },
  dayNumberPaused: {
    color: COLORS.text,
  },
  completedPill: {
    position: 'absolute',
    bottom: 6,
    width: 6,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  completedPillSelected: {
    backgroundColor: COLORS.backgroundCanvas,
  },
});
