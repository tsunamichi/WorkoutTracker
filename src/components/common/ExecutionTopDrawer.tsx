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
import * as Haptics from 'expo-haptics';
import Reanimated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { TYPOGRAPHY } from '../../constants';
import { EXPLORE_V2 } from '../exploreV2/exploreV2Tokens';
import { useAppTheme } from '../../theme/useAppTheme';

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
  const appTheme = useAppTheme();
  const { colors: themeColors } = appTheme;
  const [localRestSeconds, setLocalRestSeconds] = useState(restTimeSeconds);
  const animatedHeight = useSharedValue(0);
  const sliderWidthRef = useRef(0);
  const dragStartXRef = useRef(0);
  const dragStartValueRef = useRef(restTimeSeconds);
  const localRestRef = useRef(restTimeSeconds);
  const lastHapticValueRef = useRef(restTimeSeconds);
  const actionCount = (onComplete ? 1 : 0) + 1 + (onSecondaryDestructive ? 1 : 0);

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
    // No card chrome/padding: keep menu compact and content-driven.
    const expandedHeight = 132 + actionCount * 52;
    const target = visible ? expandedHeight : 0;
    animatedHeight.value = withTiming(target, {
      duration: visible ? 420 : 240,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, animatedHeight, actionCount]);

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
        style={styles.sheetWrap}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <View style={styles.sheet}>
          <View style={styles.timerSection}>
            <Text style={[styles.timerLabel, { color: themeColors.textMeta }]}>REST TIME</Text>
            <Text style={[styles.timerValue, { color: themeColors.containerPrimary }]}>{formatTime}</Text>

            <View
              style={styles.sliderTouchArea}
              onLayout={(e: LayoutChangeEvent) => {
                sliderWidthRef.current = e.nativeEvent.layout.width;
              }}
              {...panResponder.panHandlers}
            >
              <View style={[styles.sliderTrack, { backgroundColor: themeColors.border }]} />
              <View style={[styles.sliderFill, { width: `${progress * 100}%`, backgroundColor: themeColors.containerPrimary }]} />
              <View style={[styles.sliderThumb, { left: `${progress * 100}%`, backgroundColor: themeColors.canvasLight }]}>
                <View style={[styles.sliderThumbInner, { backgroundColor: themeColors.containerPrimary }]} />
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
              <Text style={[styles.completeText, { color: themeColors.containerPrimary }]}>Mark as complete</Text>
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
            <Text style={[styles.resetText, { color: themeColors.signalNegative }]}>Reset workout</Text>
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
              <Text style={[styles.resetText, { color: themeColors.signalNegative }]}>{secondaryDestructiveLabel ?? 'Remove'}</Text>
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
  sheetWrap: {},
  sheet: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
    paddingTop: 0,
  },
  timerSection: {
    marginBottom: 16,
  },
  timerLabel: {
    ...TYPOGRAPHY.legal,
  },
  timerValue: {
    ...TYPOGRAPHY.timer,
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
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    height: 2,
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderThumbInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  textAction: {
    paddingVertical: 16,
  },
  completeText: {
    ...TYPOGRAPHY.h1,
  },
  resetText: {
    ...TYPOGRAPHY.h1,
  },
});

