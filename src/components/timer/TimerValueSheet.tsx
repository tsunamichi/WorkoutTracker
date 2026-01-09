import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  GestureResponderEvent,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, TYPOGRAPHY } from '../../constants';
import { BottomDrawer } from '../common/BottomDrawer';

interface TimerValueSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (value: number) => void;
  title: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue?: (val: number) => string;
}

const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  textPrimary: '#000000',
  textSecondary: '#3C3C43',
  textMeta: '#817B77',
  border: '#C7C7CC',
};

const VISUAL_BAR_HEIGHT = 280;

export function TimerValueSheet({
  visible,
  onClose,
  onSave,
  title,
  label,
  value,
  min,
  max,
  step,
  formatValue = (val) => `${val}s`,
}: TimerValueSheetProps) {
  const [selectedValue, setSelectedValue] = useState(value);
  
  // Use ref to track current value in touch handlers (avoid stale closures)
  const selectedValueRef = useRef(value);
  const barLayoutRef = useRef({ y: 0, height: VISUAL_BAR_HEIGHT });
  const progressBarRef = useRef<View>(null);
  const touchStartRef = useRef({ y: 0, value: value });
  
  // Animated progress for smooth transitions
  const progressAnim = useRef(new Animated.Value((value - min) / (max - min))).current;
  
  const progress = (selectedValue - min) / (max - min);
  
  // Keep ref in sync with state and animate progress
  useEffect(() => {
    selectedValueRef.current = selectedValue;
    // Animate progress bar smoothly
    Animated.spring(progressAnim, {
      toValue: progress,
      useNativeDriver: false,
      tension: 300,
      friction: 30,
    }).start();
  }, [selectedValue, progress, progressAnim]);
  
  // Reset value when sheet opens
  useEffect(() => {
    if (visible) {
      setSelectedValue(value);
      selectedValueRef.current = value;
      touchStartRef.current = { y: 0, value };
      progressAnim.setValue((value - min) / (max - min));
    }
  }, [visible, value, min, max, progressAnim]);

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave(selectedValue);
    // Small delay to ensure onSave is processed before closing
    setTimeout(() => {
      onClose();
    }, 0);
  };

  const handleTouchStart = (event: GestureResponderEvent) => {
    const touchY = event.nativeEvent.pageY;
    // Store the starting touch position and current value
    touchStartRef.current = {
      y: touchY,
      value: selectedValueRef.current,
    };
  };

  const handleTouchMove = (event: GestureResponderEvent) => {
    const touchY = event.nativeEvent.pageY;
    const { height: barHeight } = barLayoutRef.current;
    
    // Calculate how much the finger moved (negative = up, positive = down)
    const deltaY = touchY - touchStartRef.current.y;
    
    // Convert delta to value change
    // Moving up (negative deltaY) increases value, moving down decreases it
    const deltaProgress = -deltaY / barHeight;
    const deltaValue = deltaProgress * (max - min);
    
    // Apply delta to the starting value
    const rawValue = touchStartRef.current.value + deltaValue;
    
    // Round to nearest step
    const steppedValue = Math.round(rawValue / step) * step;
    
    // Clamp to bounds
    const newValue = Math.max(min, Math.min(max, steppedValue));
    
    // Only update if changed
    if (newValue !== selectedValueRef.current) {
      selectedValueRef.current = newValue;
      setSelectedValue(newValue);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <BottomDrawer
      visible={visible}
      onClose={onClose}
      maxHeight="75%"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.type}>{label}</Text>
          <Text style={styles.label}>{title}</Text>
          <Text style={styles.valueDisplay}>{formatValue(selectedValue)}</Text>
        </View>

            <View style={styles.visualContainer}>
              <View
                ref={progressBarRef}
                style={styles.progressBarTouchArea}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderTerminationRequest={() => false}
                onLayout={(event) => {
                  const { height } = event.nativeEvent.layout;
                  barLayoutRef.current = { y: 0, height };
                }}
              >
                <View style={styles.progressBarContainer}>
                  <Animated.View 
                    style={[
                      styles.progressBarFilled, 
                      { 
                        height: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['100%', '0%'],
                        }),
                      }
                    ]} 
                  />
                  <Animated.View 
                    style={[
                      styles.progressBarUnfilled, 
                      { 
                        height: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      }
                    ]} 
                  />
                </View>
              </View>
            </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
          <Text style={styles.saveButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </BottomDrawer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.xxl,
  },
  header: {
    alignItems: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  type: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  label: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  valueDisplay: {
    ...TYPOGRAPHY.h1,
    color: LIGHT_COLORS.textPrimary,
    textAlign: 'center',
  },
  visualContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    height: VISUAL_BAR_HEIGHT + (SPACING.lg * 2),
  },
  progressBarTouchArea: {
    paddingHorizontal: 40,
    paddingVertical: 20,
  },
  progressBarContainer: {
    width: 120,
    height: VISUAL_BAR_HEIGHT,
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    flexDirection: 'column',
  },
  progressBarFilled: {
    width: '100%',
    backgroundColor: '#CDCABB',
  },
  progressBarUnfilled: {
    width: '100%',
    backgroundColor: '#000000',
  },
  saveButton: {
    backgroundColor: '#FD6B00',
    paddingVertical: SPACING.lg,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 56,
    marginBottom: 0,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
