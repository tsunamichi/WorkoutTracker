import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY } from '../../constants';

interface CalendarDayButtonProps {
  dayNumber: number;
  isSelected: boolean;
  isToday: boolean;
  isCompleted: boolean;
  hasWorkout: boolean;
  onPress: () => void;
}

export function CalendarDayButton({
  dayNumber,
  isSelected,
  isToday,
  isCompleted,
  hasWorkout,
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
          isSelected && styles.dayButtonSelected,
        ]}
      >
        <Text
          style={[
            styles.dayNumber,
            isSelected && styles.dayNumberSelected,
            isToday && !isSelected && styles.dayNumberToday,
          ]}
        >
          {dayNumber}
        </Text>
      </View>
      {/* Workout dot indicator */}
      {hasWorkout && (
        <View
          style={[
            styles.workoutDot,
            isCompleted && styles.workoutDotCompleted,
            isSelected && styles.workoutDotSelected,
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
  dayButtonSelected: {
    backgroundColor: COLORS.accentPrimary,
  },
  dayNumber: {
    ...TYPOGRAPHY.metaBold,
    color: '#1B1B1B',
  },
  dayNumberSelected: {
    color: '#FFFFFF',
  },
  dayNumberToday: {
    color: COLORS.accentPrimary,
  },
  workoutDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D1D6',
    marginTop: 3,
  },
  workoutDotCompleted: {
    backgroundColor: '#1B1B1B',
  },
  workoutDotSelected: {
    backgroundColor: '#FFFFFF',
  },
});
