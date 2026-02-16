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
            isToday && !isSelected && styles.dayNumberToday,
            isSelected && styles.dayNumberSelected,
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
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  dayButtonSelected: {
    backgroundColor: '#FFFFFF',
  },
  dayButtonTodaySelected: {
    backgroundColor: '#FFFFFF',
  },
  dayNumber: {
    ...TYPOGRAPHY.metaBold,
    color: '#FFFFFF',
  },
  dayNumberSelected: {
    color: COLORS.backgroundCanvas,
  },
  dayNumberToday: {
    color: '#FFFFFF',
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
