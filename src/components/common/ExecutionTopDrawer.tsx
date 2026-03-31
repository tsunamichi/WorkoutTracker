import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Reanimated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { COLORS, TYPOGRAPHY } from '../../constants';

type Props = {
  visible: boolean;
  onClose: () => void;
  onComplete?: () => void;
  onReset: () => void;
  onSecondaryDestructive?: () => void;
  secondaryDestructiveLabel?: string;
  restTimeSeconds: number;
  onRestTimeChange: (seconds: number) => void;
  minRestSeconds?: number;
  maxRestSeconds?: number;
  stepSeconds?: number;
};

export function ExecutionTopDrawer({
  visible,
  onClose,
  onComplete,
  onReset,
  onSecondaryDestructive,
  secondaryDestructiveLabel,
  restTimeSeconds,
  onRestTimeChange,
  minRestSeconds = 15,
  maxRestSeconds = 300,
  stepSeconds = 5,
}: Props) {
  const insets = useSafeAreaInsets();
  const [localRestSeconds, setLocalRestSeconds] = useState(restTimeSeconds);
  const animatedHeight = useSharedValue(0);
  const sliderWidthRef = useRef(0);
  const dragStartXRef = useRef(0);
  const dragStartValueRef = useRef(restTimeSeconds);
  const localRestRef = useRef(restTimeSeconds);
  const lastHapticValueRef = useRef(restTimeSeconds);

  useEffect(() => {
    localRestRef.current = localRestSeconds;
  }, [localRestSeconds]);

  useEffect(() => {
    if (!visible) return;
    setLocalRestSeconds(restTimeSeconds);
    localRestRef.current = restTimeSeconds;
    lastHapticValueRef.current = restTimeSeconds;
  }, [visible, restTimeSeconds]);

  useEffect(() => {
    const expandedHeight = 420 + insets.top;
    const target = visible ? expandedHeight : 0;
    animatedHeight.value = withTiming(target, {
      duration: visible ? 200 : 160,
    });
  }, [visible, insets.top, animatedHeight]);

  const drawerAnimatedStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
  }));

  const formatTime = useMemo(() => {
    const m = Math.floor(localRestSeconds / 60);
    const s = localRestSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, [localRestSeconds]);

  const clampAndStep = (value: number) => {
    const stepped = Math.round(value / stepSeconds) * stepSeconds;
    return Math.max(minRestSeconds, Math.min(maxRestSeconds, stepped));
  };

  const updateFromTouchX = (touchX: number) => {
    const width = sliderWidthRef.current;
    if (width <= 0) return;
    const deltaX = touchX - dragStartXRef.current;
    const deltaValue = (deltaX / width) * (maxRestSeconds - minRestSeconds);
    const next = clampAndStep(dragStartValueRef.current + deltaValue);
    if (next !== localRestRef.current) {
      localRestRef.current = next;
      setLocalRestSeconds(next);
      onRestTimeChange(next);
      if (next !== lastHapticValueRef.current) {
        lastHapticValueRef.current = next;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          dragStartXRef.current = e.nativeEvent.pageX;
          dragStartValueRef.current = localRestRef.current;
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          updateFromTouchX(e.nativeEvent.pageX);
        },
        onPanResponderRelease: (e: GestureResponderEvent) => {
          updateFromTouchX(e.nativeEvent.pageX);
        },
      }),
    [maxRestSeconds, minRestSeconds, stepSeconds],
  );

  const progress = (localRestSeconds - minRestSeconds) / (maxRestSeconds - minRestSeconds || 1);

  return (
    <Reanimated.View style={[styles.drawerContainer, drawerAnimatedStyle]}>
      <View
        style={[styles.sheetWrap, { paddingTop: 24 }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <View style={styles.sheet}>
          <View style={styles.timerSection}>
            <Text style={styles.timerLabel}>REST TIME</Text>
            <Text style={styles.timerValue}>{formatTime}</Text>

            <View
              style={styles.sliderTouchArea}
              onLayout={(e: LayoutChangeEvent) => {
                sliderWidthRef.current = e.nativeEvent.layout.width;
              }}
              {...panResponder.panHandlers}
            >
              <View style={styles.sliderTrack} />
              <View style={[styles.sliderFill, { width: `${progress * 100}%` }]} />
              <View style={[styles.sliderThumb, { left: `${progress * 100}%` }]}>
                <View style={styles.sliderThumbInner} />
              </View>
            </View>
          </View>

          {onComplete ? (
            <TouchableOpacity
              style={styles.textAction}
              onPress={() => {
                onComplete();
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.completeText}>Mark as complete</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.textAction}
            onPress={() => {
              onReset();
              onClose();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.resetText}>Reset workout</Text>
          </TouchableOpacity>
          {onSecondaryDestructive ? (
            <TouchableOpacity
              style={styles.textAction}
              onPress={() => {
                onSecondaryDestructive();
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.resetText}>{secondaryDestructiveLabel ?? 'Remove'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    overflow: 'hidden',
    width: '100%',
  },
  sheetWrap: {
    paddingHorizontal: 16,
  },
  sheet: {
    backgroundColor: COLORS.canvasLight,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 24,
  },
  timerSection: {
    marginBottom: 24,
  },
  timerLabel: {
    ...TYPOGRAPHY.legal,
    color: COLORS.textMeta,
  },
  timerValue: {
    ...TYPOGRAPHY.timer,
    color: COLORS.containerPrimary,
    marginTop: 8,
  },
  sliderTouchArea: {
    marginTop: 8,
    height: 30,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrack: {
    height: 2,
    borderRadius: 2,
    backgroundColor: COLORS.containerTertiary,
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    height: 2,
    borderRadius: 2,
    backgroundColor: COLORS.containerPrimary,
  },
  sliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.canvasLight,
    marginLeft: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderThumbInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.containerPrimary,
  },
  textAction: {
    paddingVertical: 16,
  },
  completeText: {
    ...TYPOGRAPHY.h1,
    color: COLORS.containerPrimary,
  },
  resetText: {
    ...TYPOGRAPHY.h1,
    color: COLORS.signalNegative,
  },
});

