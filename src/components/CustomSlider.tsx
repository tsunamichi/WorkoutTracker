import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants';

interface CustomSliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

const LIGHT_COLORS = {
  text: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#AEAEB2',
};

const CIRCLE_SIZE = 40;
const EXPANDED_HEIGHT = 100;
const EXPANDED_WIDTH = 44;
const LINE_HEIGHT = 2;

export function CustomSlider({
  value,
  onValueChange,
  min,
  max,
  step,
  unit = '',
}: CustomSliderProps) {
  const [sliderWidth, setSliderWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [previewValue, setPreviewValue] = useState(value);
  const pan = useRef(new Animated.Value(0)).current;
  const handleWidth = useRef(new Animated.Value(CIRCLE_SIZE)).current;
  const handleHeight = useRef(new Animated.Value(CIRCLE_SIZE)).current;
  const startPositionRef = useRef(0);
  const currentValueRef = useRef(value);
  const lastHapticValueRef = useRef(value);

  // Keep current value in sync
  React.useEffect(() => {
    currentValueRef.current = value;
    if (!isDragging) {
      setPreviewValue(value);
    }
  }, [value, isDragging]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setSliderWidth(width);
  };

  const getPositionFromValue = (val: number): number => {
    if (sliderWidth === 0 || isNaN(val)) return 0;
    const percentage = (val - min) / (max - min);
    // Account for handle width so it doesn't go beyond track edges
    const availableWidth = sliderWidth - CIRCLE_SIZE;
    return percentage * availableWidth;
  };

  const getValueFromPosition = (position: number): number => {
    if (sliderWidth === 0) return currentValueRef.current;
    // Account for handle width
    const availableWidth = sliderWidth - CIRCLE_SIZE;
    const percentage = Math.max(0, Math.min(1, position / availableWidth));
    const rawValue = min + percentage * (max - min);
    const steppedValue = Math.round(rawValue / step) * step;
    const finalValue = Math.max(min, Math.min(max, steppedValue));
    return isNaN(finalValue) ? currentValueRef.current : finalValue;
  };

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: () => {
          // Store the starting position and mark as dragging
          startPositionRef.current = getPositionFromValue(currentValueRef.current);
          setIsDragging(true);
          
          // Strong haptic on touch start
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          
          // Reset haptic tracking
          lastHapticValueRef.current = currentValueRef.current;
          
          // Stop any ongoing animations first
          handleWidth.stopAnimation();
          handleHeight.stopAnimation();
          
          // Animate handle expansion
          Animated.parallel([
            Animated.spring(handleWidth, {
              toValue: EXPANDED_WIDTH,
              useNativeDriver: false,
              tension: 60,
              friction: 8,
            }),
            Animated.spring(handleHeight, {
              toValue: EXPANDED_HEIGHT,
              useNativeDriver: false,
              tension: 60,
              friction: 8,
            }),
          ]).start();
        },
        onPanResponderMove: (_, gestureState) => {
          if (sliderWidth === 0) return;
          
          // Calculate new position - allow continuous smooth movement
          const newPosition = startPositionRef.current + gestureState.dx;
          const clampedPosition = Math.max(0, Math.min(sliderWidth, newPosition));
          
          // Update animated value for smooth visual feedback
          pan.setValue(clampedPosition);
          
          // Calculate the stepped value for preview display only
          const newValue = getValueFromPosition(clampedPosition);
          if (!isNaN(newValue)) {
            setPreviewValue(newValue);
            
            // Soft haptic when value changes
            if (newValue !== lastHapticValueRef.current) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              lastHapticValueRef.current = newValue;
            }
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (sliderWidth === 0) {
            setIsDragging(false);
            return;
          }
          
          // Get final position and snap to stepped value
          const finalPosition = startPositionRef.current + gestureState.dx;
          const clampedPosition = Math.max(0, Math.min(sliderWidth, finalPosition));
          const finalValue = getValueFromPosition(clampedPosition);
          
          // Strong haptic on release
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          
          // Update to final stepped value - only on release
          if (!isNaN(finalValue)) {
            onValueChange(finalValue);
          }
          
          // Calculate the stepped position
          const steppedPosition = getPositionFromValue(finalValue);
          
          // Animate handle back to default size
          Animated.parallel([
            Animated.spring(handleWidth, {
              toValue: CIRCLE_SIZE,
              useNativeDriver: false,
              tension: 60,
              friction: 8,
            }),
            Animated.spring(handleHeight, {
              toValue: CIRCLE_SIZE,
              useNativeDriver: false,
              tension: 60,
              friction: 8,
            }),
          ]).start();
          
          // Separately animate snap to position (cannot use native driver because of filledTrack width)
          Animated.spring(pan, {
            toValue: steppedPosition,
            useNativeDriver: false, // Changed to false because pan controls width
            tension: 60,
            friction: 10,
            velocity: 0,
          }).start(() => {
            // Mark dragging as false after animation completes
            setIsDragging(false);
          });
        },
      }),
    [sliderWidth]
  );

  // Set initial position when slider width is measured or value changes
  React.useEffect(() => {
    if (sliderWidth > 0 && !isNaN(value)) {
      pan.setValue(getPositionFromValue(value));
    }
  }, [sliderWidth, value]);

  // Use preview value during dragging, actual value otherwise
  const displayedValue = isDragging ? previewValue : value;
  const safeValue = isNaN(displayedValue) ? min : displayedValue;
  const displayValue = unit ? `${safeValue}${unit}` : safeValue.toString();

  return (
    <View 
      style={styles.container} 
      onLayout={handleLayout}
    >
      {/* Track line (background) */}
      <View style={styles.track} />
      
      {/* Bottom decorative line */}
      <View style={styles.bottomLine} />
      
      {/* Filled track (left side) - animated */}
      {sliderWidth > 0 && (
        <Animated.View 
          style={[
            styles.filledTrack,
            {
              width: pan.interpolate({
                inputRange: [0, sliderWidth - CIRCLE_SIZE],
                outputRange: [CIRCLE_SIZE / 2, sliderWidth - CIRCLE_SIZE / 2],
                extrapolate: 'clamp',
              }),
            }
          ]} 
        />
      )}
      
      {/* Draggable handle */}
      {sliderWidth > 0 && (
        <Animated.View
          style={[
            styles.circle,
            {
              width: handleWidth,
              height: handleHeight,
              backgroundColor: '#212121',
              left: 0, // Start from left edge
              transform: [
                {
                  translateX: pan.interpolate({
                    inputRange: [0, sliderWidth - CIRCLE_SIZE],
                    outputRange: [0, sliderWidth - CIRCLE_SIZE],
                    extrapolate: 'clamp',
                  }),
                },
                {
                  // Move handle up as it expands so bottom stays in place (grows upward)
                  translateY: handleHeight.interpolate({
                    inputRange: [CIRCLE_SIZE, EXPANDED_HEIGHT],
                    outputRange: [0, -(EXPANDED_HEIGHT - CIRCLE_SIZE)],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <Animated.View 
            style={[
              styles.circleTextContainer, 
              { 
                width: handleWidth,
                // Add 1px down in default position
                marginTop: handleHeight.interpolate({
                  inputRange: [CIRCLE_SIZE, EXPANDED_HEIGHT],
                  outputRange: [1, 0],
                  extrapolate: 'clamp',
                }),
              }
            ]}
          >
            <Text style={styles.circleText}>{displayValue}</Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: CIRCLE_SIZE + 20, // Just enough space for handle and track
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: LINE_HEIGHT,
    backgroundColor: COLORS.border,
    borderRadius: 1,
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: -LINE_HEIGHT / 2,
  },
  bottomLine: {
    height: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: LINE_HEIGHT / 2, // Position directly below the track
  },
  filledTrack: {
    position: 'absolute',
    height: LINE_HEIGHT,
    backgroundColor: COLORS.text,
    borderRadius: 1,
    left: 0,
    top: '50%',
    marginTop: -LINE_HEIGHT / 2,
  },
  circle: {
    position: 'absolute',
    // width is animated
    // height is animated
    // backgroundColor is animated
    borderRadius: 12,
    borderCurve: 'continuous' as any,
    borderWidth: 0,
    justifyContent: 'flex-start', // Text at top
    alignItems: 'center',
    top: '50%',
    marginTop: -CIRCLE_SIZE / 2, // Center vertically initially
    paddingTop: 10, // Space from top for text
  },
  circleTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleText: {
    ...TYPOGRAPHY.meta,
    color: '#FFFFFF',
  },
});

