import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, type LayoutChangeEvent } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SPACING, TYPOGRAPHY } from '../../constants';
import { useAppTheme } from '../../theme/useAppTheme';
import type { HistoryTabId } from '../../types/exerciseWeightProgress';

const INDICATOR_TIMING = { duration: 280, easing: Easing.out(Easing.cubic) };
/** Underline sits 8px above the row bottom (closer to tab labels). */
const INDICATOR_OFFSET_FROM_BOTTOM = 8;
const INDICATOR_HEIGHT = 3;

type Props = {
  activeTab: HistoryTabId;
  onChange: (tab: HistoryTabId) => void;
  last4WeeksLabel: string;
  progressLabel: string;
};

type TabLayout = { x: number; width: number };

export function HistoryTabBar({ activeTab, onChange, last4WeeksLabel, progressLabel }: Props) {
  const { colors: themeColors } = useAppTheme();
  const tabLayouts = useRef<Partial<Record<HistoryTabId, TabLayout>>>({});
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const indicatorReady = useSharedValue(0);

  const tabs: { id: HistoryTabId; label: string }[] = [
    { id: 'last4Weeks', label: last4WeeksLabel },
    { id: 'weightProgress', label: progressLabel },
  ];

  const moveIndicatorTo = useCallback(
    (tabId: HistoryTabId, animated: boolean) => {
      const layout = tabLayouts.current[tabId];
      if (!layout) return;
      if (animated) {
        indicatorX.value = withTiming(layout.x, INDICATOR_TIMING);
        indicatorWidth.value = withTiming(layout.width, INDICATOR_TIMING);
      } else {
        indicatorX.value = layout.x;
        indicatorWidth.value = layout.width;
      }
      indicatorReady.value = 1;
    },
    [indicatorReady, indicatorWidth, indicatorX],
  );

  useEffect(() => {
    moveIndicatorTo(activeTab, indicatorReady.value === 1);
  }, [activeTab, moveIndicatorTo, indicatorReady]);

  const handleTabLayout = useCallback(
    (tabId: HistoryTabId, event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      tabLayouts.current[tabId] = { x, width };
      if (tabId === activeTab) {
        moveIndicatorTo(tabId, indicatorReady.value === 1);
      }
    },
    [activeTab, indicatorReady, moveIndicatorTo],
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorReady.value,
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));

  return (
    <View style={styles.row}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.indicator,
          { backgroundColor: themeColors.textMeta },
          indicatorStyle,
        ]}
      />
      {tabs.map(tab => (
        <Pressable
          key={tab.id}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === tab.id }}
          style={styles.tab}
          onLayout={e => handleTabLayout(tab.id, e)}
          onPress={() => {
            if (activeTab === tab.id) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(tab.id);
          }}
        >
          <Text style={[styles.label, { color: themeColors.textMeta }]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: SPACING.xl,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    position: 'relative',
  },
  tab: {
    alignItems: 'flex-start',
    paddingBottom: INDICATOR_OFFSET_FROM_BOTTOM + INDICATOR_HEIGHT,
  },
  label: {
    ...TYPOGRAPHY.displayLarge,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    bottom: INDICATOR_OFFSET_FROM_BOTTOM,
    height: INDICATOR_HEIGHT,
    borderRadius: 1,
  },
});
