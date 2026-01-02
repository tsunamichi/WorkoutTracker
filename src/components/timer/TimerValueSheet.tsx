import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  GestureResponderEvent,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, TYPOGRAPHY } from '../../constants';

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
const SCREEN_HEIGHT = Dimensions.get('window').height;

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
  const insets = useSafeAreaInsets();
  const [selectedValue, setSelectedValue] = useState(value);
  const [isVisible, setIsVisible] = useState(false);
  
  // Use ref to track current value in touch handlers (avoid stale closures)
  const selectedValueRef = useRef(value);
  const barLayoutRef = useRef({ y: 0, height: VISUAL_BAR_HEIGHT });
  const progressBarRef = useRef<View>(null);
  const touchStartRef = useRef({ y: 0, value: value });
  
  // Animated progress for smooth transitions
  const progressAnim = useRef(new Animated.Value((value - min) / (max - min))).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  
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

  // Animate sheet in/out
  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 20,
          velocity: 2,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsVisible(false);
      });
    }
  }, [visible, slideAnim, backdropAnim]);

  const handleSave = () => {
    onSave(selectedValue);
    onClose();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0],
  });

  const backdropOpacity = backdropAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  if (!isVisible && !visible) return null;

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          activeOpacity={1}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                opacity: backdropOpacity,
              },
            ]}
            pointerEvents="none"
          />
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + 8,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.sheetInner}>
            <View style={styles.handle} />

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
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  sheet: {
    marginHorizontal: 8,
    marginBottom: 8,
    backgroundColor: LIGHT_COLORS.backgroundCanvas,
    borderRadius: 40,
  },
  sheetInner: {
    paddingHorizontal: SPACING.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: LIGHT_COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
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
