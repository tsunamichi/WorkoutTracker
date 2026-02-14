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
  onPress: () => void;
}

export function CalendarDayButton({
  dayNumber,
  isSelected,
  isToday,
  isCompleted,
  hasWorkout,
  cycleColor,
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
          isSelected && isToday && styles.dayButtonTodaySelected,
        ]}
      >
        <Text
          style={[
            styles.dayNumber,
            isSelected && !isToday && styles.dayNumberSelected,
            isToday && !isSelected && styles.dayNumberToday,
            isToday && isSelected && cycleColor ? { color: cycleColor } : isToday && isSelected ? styles.dayNumberSelected : undefined,
          ]}
        >
          {dayNumber}
        </Text>
      </View>
      {/* Completed indicator: pill inside the card, 2px from bottom */}
      {isCompleted && (
        <View
          style={[
            styles.completedPill,
            isSelected && styles.completedPillSelected,
          ]}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderCurve: 'continuous' as any,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonToday: {
    // No background box — just the label color changes
  },
  dayButtonSelected: {
    backgroundColor: COLORS.accentPrimary,
  },
  dayButtonTodaySelected: {
    backgroundColor: COLORS.todayIndicator,
  },
  dayNumber: {
    ...TYPOGRAPHY.metaBold,
    color: '#FFFFFF',
  },
  dayNumberSelected: {
    color: COLORS.backgroundCanvas,
  },
  dayNumberToday: {
    color: COLORS.todayIndicator,
  },
  completedPill: {
    position: 'absolute',
    bottom: 2,
    width: 8,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  completedPillSelected: {
    backgroundColor: COLORS.backgroundCanvas,
  },
});
