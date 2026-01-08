import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants';

interface ToggleProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function Toggle({ label, value, onValueChange }: ToggleProps) {
  const animatedValue = React.useRef(new Animated.Value(value ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value, animatedValue]);

  const trackColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['#D1D1D6', '#000000'], // Gray when off, black when on
  });

  const thumbTranslateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 17], // OFF: 2px from left, ON: 32 - 13 - 2 = 17px (2px from right)
  });

  const thumbColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['#000000', '#FFFFFF'], // Dark when off, white when on
  });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onValueChange(!value)}
      style={styles.container}
    >
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View
          style={[
            styles.thumb,
            {
              transform: [{ translateX: thumbTranslateX }],
              backgroundColor: thumbColor,
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // 8px between label and toggle
    height: 32, // 32px tall tappable area
  },
  label: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  track: {
    width: 32,
    height: 17,
    borderRadius: 8.5,
    justifyContent: 'center', // Vertically center the thumb
    borderCurve: 'continuous',
  },
  thumb: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});

