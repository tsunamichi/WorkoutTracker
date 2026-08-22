import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Pressable,
  Platform,
  Animated,
  Easing as AnimatedEasing,
} from 'react-native';
import Reanimated, {
  Easing,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Toggle } from '../Toggle';
import { EXPLORE_V2 } from './exploreV2Tokens';
import dayjs from 'dayjs';
import { SPACING, TYPOGRAPHY, hexToRgba } from '../../constants';
import { useAppTheme } from '../../theme/useAppTheme';
import { formatWeightForLoad } from '../../utils/weight';
import type { ExploreV2Exercise } from './exploreV2Types';
import { useTranslation } from '../../i18n/useTranslation';
import Svg, { Circle, Defs, Line, LinearGradient as SvgLinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

const DRAWER_TOP_DIVIDER_H = 1;
/** Settings header row (Settings + chevron) */
const DRAWER_HEADER_ROW_H = 48;
/** When rest timer is visible, push drawer down out of frame. */
const REST_TIMER_DRAWER_OFFSET = 56;
/** Space above “Settings” / label row */
const HEADER_PADDING_TOP = 0;
/**
 * Collapsed drawer: full soft panel height (divider + header row).
 * 49 = 1 + 48
 */
const COLLAPSED_SHELL_H = DRAWER_TOP_DIVIDER_H + DRAWER_HEADER_ROW_H;
/** Divider + expanded header row (before scroll body). */
const EXPANDED_TOP_STACK_H = DRAWER_TOP_DIVIDER_H + HEADER_PADDING_TOP + DRAWER_HEADER_ROW_H;
/** Collapsed strip sits 16px above the slot bottom; expanded is flush (0). */
const COLLAPSED_BOTTOM_OFFSET = 16;

/** Gap between hero (values + Log) and the top of the settings drawer (divider). */
export const EXPLORE_V2_CURRENT_SETTINGS_HERO_GAP = 24;

/** Vertical space from divider line down to the bottom of the drawer slot (collapsed). */
export const EXPLORE_V2_CURRENT_SETTINGS_COLLAPSED_STACK_H =
  COLLAPSED_BOTTOM_OFFSET + COLLAPSED_SHELL_H;

/** Horizontal inset + full-bleed math for settings body / actions row */
const CONTENT_PAD_H = 24;

function progressionPillLabel(name: string): string {
  const s = name.replace(/^Main\s+/i, '').replace(/\bAccessories\b/g, 'Accessory').trim();
  return s.length > 0 ? s : name;
}

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

function consolidateSetsForDisplay(
  sets: Array<{ setNumber: number; weight: number; reps: number }>,
): Array<{ setNumber: number; weight: number; reps: number }> {
  const unique = new Map<string, { setNumber: number; weight: number; reps: number }>();
  sets.forEach(set => {
    const weight = Number(set.weight) || 0;
    const reps = Number(set.reps) || 0;
    if (weight <= 0) return;
    const key = `${weight}|${reps}`;
    if (!unique.has(key)) {
      unique.set(key, { ...set, weight, reps });
    }
  });
  return Array.from(unique.values());
}

function HistoryMiniChart({
  values,
  dates,
  unit,
  color,
  indicatorBorderColor,
  variant = 'compact',
  interactive = false,
  heldIndex = null,
  onHoldIndexChange,
  onHoldEnd,
  onInteractionStart,
  onInteractionEnd,
}: {
  values: number[];
  dates?: string[];
  unit?: string;
  color: string;
  indicatorBorderColor?: string;
  variant?: 'compact' | 'hero';
  interactive?: boolean;
  heldIndex?: number | null;
  onHoldIndexChange?: (index: number) => void;
  onHoldEnd?: () => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}) {
  if (values.length === 0) return null;
  const isHero = variant === 'hero';
  const W = isHero ? 640 : 320;
  const H = isHero ? 128 : 92;
  const padLeft = 2;
  const padRight = isHero ? 48 : 2;
  const padTop = isHero ? 10 : 8;
  const padBottom = isHero && dates?.length ? 24 : 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const tickStep = Math.max(5, Math.ceil((max - min) / 20) * 5);
  let scaleMin = Math.max(0, Math.floor(min / tickStep) * tickStep);
  let scaleMax = scaleMin + tickStep * 4;
  if (max > scaleMax) {
    scaleMax = Math.ceil(max / tickStep) * tickStep;
    scaleMin = Math.max(0, scaleMax - tickStep * 4);
  }
  const range = scaleMax - scaleMin;
  const [chartWidth, setChartWidth] = useState(0);
  const resolvedW = chartWidth > 0 ? chartWidth : W;
  const plotRight = resolvedW - padRight;
  const drawableW = Math.max(1, plotRight - padLeft);
  const plotBottom = H - padBottom;
  const drawableH = Math.max(1, plotBottom - padTop);
  const pointX = (index: number) =>
    values.length === 1 ? padLeft + drawableW / 2 : padLeft + (index / (values.length - 1)) * drawableW;
  const pointY = (value: number) => padTop + (1 - (value - scaleMin) / range) * drawableH;
  const points = values.map((value, index) => ({ x: pointX(index), y: pointY(value) }));
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
  const areaPath = points.length
    ? `${linePath} L${points[points.length - 1].x} ${plotBottom} L${points[0].x} ${plotBottom} Z`
    : '';
  const areaGradientId = `history-area-${variant}`;
  const yTicks = Array.from({ length: 5 }, (_value, index) => scaleMax - index * tickStep);
  const dateTickIndexes = values.map((_value, index) => index);
  const handleTouch = (locationX: number) => {
    if (!interactive || !onHoldIndexChange || values.length === 0) return;
    const x = Math.max(padLeft, Math.min(plotRight, locationX));
    const rawIndex = values.length === 1 ? 0 : Math.round(((x - padLeft) / drawableW) * (values.length - 1));
    const index = Math.max(0, Math.min(values.length - 1, rawIndex));
    onHoldIndexChange(index);
  };

  return (
    <View
      style={styles.historyChartWrap}
      onLayout={e => {
        const w = Math.floor(e.nativeEvent.layout.width);
        if (w > 0 && w !== chartWidth) setChartWidth(w);
      }}
      onStartShouldSetResponder={() => interactive && values.length > 0}
      onMoveShouldSetResponder={() => interactive && values.length > 0}
      onResponderTerminationRequest={() => false}
      onResponderGrant={e => {
        onInteractionStart?.();
        handleTouch(e.nativeEvent.locationX);
      }}
      onResponderMove={e => {
        handleTouch(e.nativeEvent.locationX);
      }}
      onResponderRelease={() => {
        onInteractionEnd?.();
        onHoldEnd?.();
      }}
      onResponderTerminate={() => {
        onInteractionEnd?.();
        onHoldEnd?.();
      }}
    >
      <Svg width={resolvedW} height={H}>
        <Defs>
          <SvgLinearGradient id={areaGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={color} stopOpacity={isHero ? 0.1 : 0.08} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </SvgLinearGradient>
        </Defs>
        {isHero
          ? yTicks.map((tick, index) => {
              const y = pointY(tick);
              return (
                <React.Fragment key={`ytick-${index}`}>
                  <Line x1={padLeft} y1={y} x2={plotRight} y2={y} stroke={color} strokeWidth={1} opacity={0.12} />
                  <SvgText x={resolvedW - 2} y={y + 4} fill={color} opacity={0.58} fontSize={10} textAnchor="end">
                    {`${Math.round(tick)}${unit ? ` ${unit}` : ''}`}
                  </SvgText>
                </React.Fragment>
              );
            })
          : null}
        {areaPath ? <Path d={areaPath} fill={`url(#${areaGradientId})`} /> : null}
        {linePath ? <Path d={linePath} fill="none" stroke={color} strokeWidth={isHero ? 2 : 1.5} /> : null}
        {heldIndex != null && points[heldIndex] ? (
          <>
            <Circle
              cx={points[heldIndex].x}
              cy={points[heldIndex].y}
              r={6}
              fill={indicatorBorderColor ?? color}
            />
            <Circle cx={points[heldIndex].x} cy={points[heldIndex].y} r={4} fill={color} />
          </>
        ) : null}
        {isHero && dates?.length
          ? dateTickIndexes.map((index, tickPosition) => {
              const date = dates[index];
              if (!date) return null;
              return (
                <SvgText
                  key={`date-${index}`}
                  x={pointX(index)}
                  y={H - 4}
                  fill={color}
                  opacity={0.58}
                  fontSize={10}
                  textAnchor={tickPosition === 0 ? 'start' : tickPosition === dateTickIndexes.length - 1 ? 'end' : 'middle'}
                >
                  {dayjs(date).format('MM/DD')}
                </SvgText>
              );
            })
          : null}
      </Svg>
    </View>
  );
}

export type ExerciseDrawerHistoryEntry = {
  date: string;
  sets: Array<{ setNumber: number; weight: number; reps: number }>;
};

export type ExploreV2CurrentSettingsOverflowProps = {
  visible: boolean;
  onClose: () => void;
  onOpenSheet: () => void;
  exercise: ExploreV2Exercise;
  templateItemId: string;
  libraryExerciseId: string | undefined;
  /** Sorted oldest → newest (same source as legacy drawer); panel ignores today and shows last prior day. */
  history: ExerciseDrawerHistoryEntry[];
  useKg: boolean;
  weightUnit: string;
  timeBased: boolean;
  onTimeBasedChange: (v: boolean) => void;
  perSide: boolean;
  onPerSideChange: (v: boolean) => void;
  progressionGroups: Array<{ id: string; name: string; exerciseIds: string[] }>;
  currentProgressionGroupId: string | null;
  onProgressionGroupSelect: (groupId: string | null) => void | Promise<void>;
  onSwap: () => void;
  onDelete: () => void;
  onViewProgress: () => void;
  type: 'warmup' | 'main' | 'core';
  /** When rest timer starts, drawer collapses with animation then onClose runs (parent must not flip visible first). */
  inlineRestActive: boolean;
  /** Shared rest transition driver so drawer and hero reserve move in sync. */
  restThemeProgress: SharedValue<number>;
};

type PanelProps = ExploreV2CurrentSettingsOverflowProps & {
  containerHeight: number;
  interactive?: boolean;
  hideHeader?: boolean;
};

export function ExploreV2CurrentOverflowPanel({
  containerHeight,
  visible,
  onClose,
  onOpenSheet,
  exercise: _exercise,
  templateItemId: _templateItemId,
  libraryExerciseId: _libraryExerciseId,
  history,
  useKg,
  weightUnit,
  timeBased,
  onTimeBasedChange,
  perSide,
  onPerSideChange,
  progressionGroups,
  currentProgressionGroupId,
  onProgressionGroupSelect,
  onSwap,
  onDelete,
  onViewProgress,
  type,
  inlineRestActive,
  restThemeProgress,
  interactive = true,
  hideHeader = false,
}: PanelProps) {
  const { t } = useTranslation();
  const { colors: themeColors, explore } = useAppTheme();
  const historyUnitInk = themeColors.accentSecondaryDisabled;
  const accentSecondary20 = useMemo(() => hexToRgba(themeColors.accentSecondary, 0.2), [themeColors.accentSecondary]);
  const [scrollContentHeight, setScrollContentHeight] = useState(0);

  /** Same timing / motion as ExploreV2UpNextCard add exercise ↔ chevron swap. */
  const swapProgress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(swapProgress, {
      toValue: visible ? 1 : 0,
      duration: 180,
      easing: AnimatedEasing.out(AnimatedEasing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, swapProgress]);

  const settingsHeaderLayerStyle = {
    opacity: swapProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [{ translateY: swapProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }) }],
  };
  const closeHeaderLayerStyle = {
    opacity: swapProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
    transform: [{ translateY: swapProgress.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
  };

  const historyForDisplay = useMemo(() => {
    const usableHistory = history.filter(
      h =>
        Array.isArray(h.sets) &&
        h.sets.some(
          s =>
            Number.isFinite(Number(s.weight)) &&
            Number(s.weight) > 0 &&
            Number.isFinite(Number(s.reps)),
        ),
    );
    if (usableHistory.length > 0) return usableHistory;
    const base = dayjs().startOf('day');
    return [
      {
        date: base.subtract(10, 'day').toISOString(),
        sets: [
          { setNumber: 1, weight: 155, reps: 8 },
          { setNumber: 2, weight: 165, reps: 6 },
          { setNumber: 3, weight: 170, reps: 5 },
        ],
      },
      {
        date: base.subtract(6, 'day').toISOString(),
        sets: [
          { setNumber: 1, weight: 160, reps: 8 },
          { setNumber: 2, weight: 170, reps: 6 },
          { setNumber: 3, weight: 175, reps: 5 },
        ],
      },
      {
        date: base.subtract(2, 'day').toISOString(),
        sets: [
          { setNumber: 1, weight: 165, reps: 8 },
          { setNumber: 2, weight: 175, reps: 6 },
          { setNumber: 3, weight: 180, reps: 4 },
        ],
      },
    ];
  }, [history, _exercise.name]);

  /** Exclude today so the drawer shows the last completed workout from a prior day (sorted oldest → newest). */
  const latestPriorWorkout = useMemo(() => {
    const todayYmd = dayjs().format('YYYY-MM-DD');
    const prior = historyForDisplay.filter(h => dayjs(h.date).format('YYYY-MM-DD') !== todayYmd);
    return prior.length > 0 ? prior[prior.length - 1] : null;
  }, [historyForDisplay]);
  const latestWorkoutForDisplay = useMemo(() => {
    if (latestPriorWorkout) return latestPriorWorkout;
    return historyForDisplay.length > 0 ? historyForDisplay[historyForDisplay.length - 1] : null;
  }, [latestPriorWorkout, historyForDisplay]);
  const latestPriorConsolidatedSets = useMemo(
    () => (latestPriorWorkout ? consolidateSetsForDisplay(latestPriorWorkout.sets) : []),
    [latestPriorWorkout],
  );
  const latestWorkoutConsolidatedSets = useMemo(
    () => (latestWorkoutForDisplay ? consolidateSetsForDisplay(latestWorkoutForDisplay.sets) : []),
    [latestWorkoutForDisplay],
  );
  const historyTrendPoints = useMemo(() => {
    const points = historyForDisplay.flatMap(entry => {
      const sets = consolidateSetsForDisplay(entry.sets);
      if (sets.length === 0) return [];
      const strongestSet = sets.reduce((best, set) => (set.weight > best.weight ? set : best));
      return [{ date: entry.date, set: strongestSet }];
    });
    return points.slice(-5);
  }, [historyForDisplay]);
  const historyTrendValues = useMemo(() => {
    return historyTrendPoints.map(point => Number(point.set.weight) || 0).filter(v => v > 0);
  }, [historyTrendPoints]);
  const [heldHistoryIndex, setHeldHistoryIndex] = useState<number | null>(null);
  const [isHistoryChartInteracting, setIsHistoryChartInteracting] = useState(false);

  const expandedTarget = useMemo(() => {
    if (!visible || containerHeight <= 0) return COLLAPSED_SHELL_H;
    if (scrollContentHeight <= 0) return containerHeight;
    const intrinsic = EXPANDED_TOP_STACK_H + scrollContentHeight;
    return Math.min(containerHeight, Math.max(intrinsic, COLLAPSED_SHELL_H));
  }, [visible, containerHeight, scrollContentHeight]);

  /** Fill slot until content is measured, or when content is taller than the slot (scroll). */
  const bodyFillsSlot =
    visible &&
    (scrollContentHeight <= 0 ||
      EXPANDED_TOP_STACK_H + scrollContentHeight >= containerHeight - 1);

  const scrollInteractionNeeded =
    visible &&
    (scrollContentHeight <= 0 || EXPANDED_TOP_STACK_H + scrollContentHeight > containerHeight - 2);

  /** Whole panel height: collapsed strip, or content-hugging height when expanded (capped by slot). */
  const panelHeight = useSharedValue(COLLAPSED_SHELL_H);
  /** Collapsed strip sits above the slot bottom; must animate with height or motion cancels out visually. */
  const bottomOffset = useSharedValue(visible ? 0 : COLLAPSED_BOTTOM_OFFSET);

  /** Blocks height sync while rest-dismiss animation runs so wallet shrink doesn't snap panelHeight. */
  const dismissingForRestRef = useRef(false);
  /**
   * Must match initial `inlineRestActive` so mounting the panel while rest is **already** running
   * is not mistaken for a rising edge (which would immediately dismiss the sheet).
   */
  const prevInlineRestRef = useRef(inlineRestActive);

  useEffect(() => {
    if (!visible) setScrollContentHeight(0);
  }, [visible]);

  /** Rising edge: rest timer on while sheet open — collapse with timing, then notify parent (do not set visible false before this). */
  useLayoutEffect(() => {
    const rose = inlineRestActive && !prevInlineRestRef.current;
    prevInlineRestRef.current = inlineRestActive;

    if (!rose || !visible) return;

    dismissingForRestRef.current = true;
    const duration = 260;
    const easing = Easing.out(Easing.cubic);
    bottomOffset.value = withTiming(COLLAPSED_BOTTOM_OFFSET, { duration, easing });
    panelHeight.value = withTiming(COLLAPSED_SHELL_H, { duration, easing }, finished => {
      if (finished) {
        dismissingForRestRef.current = false;
        runOnJS(onClose)();
      }
    });
    Animated.timing(swapProgress, {
      toValue: 0,
      duration: 180,
      easing: AnimatedEasing.out(AnimatedEasing.cubic),
      useNativeDriver: true,
    }).start();
  }, [inlineRestActive, visible, onClose, bottomOffset, panelHeight, swapProgress]);

  useEffect(() => {
    if (dismissingForRestRef.current) return;

    const duration = visible ? 320 : 260;
    const easing = Easing.out(Easing.cubic);
    const bottomTarget = visible ? 0 : COLLAPSED_BOTTOM_OFFSET;
    bottomOffset.value = withTiming(bottomTarget, { duration, easing });

    if (containerHeight <= 0) {
      if (!visible) {
        panelHeight.value = withTiming(COLLAPSED_SHELL_H, { duration, easing });
      }
      return;
    }
    const heightTarget = visible ? expandedTarget : COLLAPSED_SHELL_H;
    panelHeight.value = withTiming(heightTarget, { duration, easing });
  }, [visible, containerHeight, expandedTarget, panelHeight, bottomOffset]);

  const shellAnimStyle = useAnimatedStyle(() => ({
    height: panelHeight.value,
    bottom:
      bottomOffset.value -
      interpolate(restThemeProgress.value, [0, 1], [0, REST_TIMER_DRAWER_OFFSET]),
  }));

  const onHeaderPress = () => {
    if (!interactive) return;
    if (visible) onClose();
    else onOpenSheet();
  };

  const embeddedBody = (
    <>
      <View style={[styles.drawerTopDivider, { backgroundColor: accentSecondary20 }]} />
      <View style={[styles.panelSoftBase, styles.panelSoftFill, { backgroundColor: explore.surfaceCurrentCard }]}>
        <View style={styles.drawerBodyFill}>
          <ScrollView
            style={styles.scrollFill}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            bounces
            scrollEnabled
            onContentSizeChange={(_w, h) => setScrollContentHeight(h)}
          >
            <View style={styles.pad}>
              {!latestPriorWorkout ? (
                <View style={styles.historyLeadRow}>
                  <Text style={[styles.historyDateMuted, { color: themeColors.accentSecondary }]}>
                    {t('noHistoryRecordedYet')}
                  </Text>
                </View>
              ) : (
                <View style={styles.historyBlock}>
                  <View style={styles.historyDataRow}>
                    <View style={styles.historyLeftColumn}>
                      <Text style={[styles.historyDateMuted, { color: themeColors.accentSecondary }]}>
                        {dayjs(latestPriorWorkout.date).format('MMMM D')}
                        {getOrdinalSuffix(dayjs(latestPriorWorkout.date).date())}
                      </Text>
                    </View>
                    <View style={styles.historySetsColumn}>
                      {latestPriorConsolidatedSets.map((set, setIndex) => (
                        <View key={setIndex} style={styles.historySetRow}>
                          <Text style={[styles.historySetText, { color: themeColors.text }]}>
                            {formatWeightForLoad(set.weight, useKg)}
                            <Text style={[styles.historySetText, { color: historyUnitInk }]}> {weightUnit}</Text>
                            {' '}
                            {set.reps}
                            <Text style={[styles.historySetText, { color: historyUnitInk }]}>
                              {' '}
                              {timeBased ? 'sec' : 'reps'}
                            </Text>
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <HistoryMiniChart
                    values={latestPriorConsolidatedSets.map(set => Number(set.weight) || 0)}
                    color={themeColors.text}
                  />
                </View>
              )}

              <View style={[styles.sectionDivider, styles.useTimerDivider, { backgroundColor: accentSecondary20 }]} />
              <View style={styles.row}>
                <Text style={styles.labelMeta}>Use timer</Text>
                <Toggle
                  label=""
                  hideLabel
                  value={timeBased}
                  trackOffColor={themeColors.containerPrimaryDark}
                  thumbOnColor={explore.skipRestCtaBg}
                  thumbOffColor={themeColors.containerSecondary}
                  onValueChange={() => {
                    const next = !timeBased;
                    onTimeBasedChange(next);
                    if (!next && perSide) onPerSideChange(false);
                  }}
                />
              </View>
              <Text style={[styles.helperText, { color: themeColors.accentSecondary }]}>
                Track each set by duration instead of reps
              </Text>
              <View style={styles.row}>
                <Text style={[styles.labelMeta, { color: timeBased ? themeColors.text : accentSecondary20 }]}>
                  Alternate sides
                </Text>
                <Toggle
                  label=""
                  hideLabel
                  value={perSide}
                  disabled={!timeBased}
                  trackOffColor={timeBased ? themeColors.containerPrimaryDark : accentSecondary20}
                  thumbOnColor={explore.skipRestCtaBg}
                  thumbOffColor={themeColors.containerSecondary}
                  onValueChange={() => onPerSideChange(!perSide)}
                />
              </View>
              <Text style={[styles.helperText, { color: timeBased ? themeColors.accentSecondary : accentSecondary20 }]}>
                Runs the timer once per side for each set
              </Text>

              {type === 'main' && (
                <>
                  <View style={styles.progressionCardsRow}>
                    {progressionGroups.map(g => {
                      const isSelected = currentProgressionGroupId === g.id;
                      return (
                        <TouchableOpacity
                          key={g.id}
                          style={[
                            styles.pill,
                            { borderColor: accentSecondary20 },
                            isSelected && { backgroundColor: accentSecondary20 },
                          ]}
                          onPress={() => onProgressionGroupSelect(isSelected ? null : g.id)}
                          activeOpacity={1}
                        >
                          <View style={[styles.pillIconPlaceholder, { backgroundColor: themeColors.containerPrimaryDark }]} />
                          <Text style={[styles.pillText, isSelected && { color: themeColors.accentPrimary }]} numberOfLines={1}>
                            {progressionPillLabel(g.name)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View
                    style={[
                      styles.sectionDivider,
                      styles.progressionCardsDivider,
                      { backgroundColor: accentSecondary20 },
                    ]}
                  />
                </>
              )}
            </View>

            <View style={styles.actionsWrap}>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionCell, { backgroundColor: explore.skipRestCtaBg }]}
                  onPress={onSwap}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.actionText, { color: themeColors.text }]}>Swap exercise</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionCell, { backgroundColor: explore.skipRestCtaBg }]}
                  onPress={() => {
                    Alert.alert(t('deleteExerciseTitle'), t('deleteExerciseMessage'), [
                      { text: t('cancel'), style: 'cancel' },
                      { text: t('remove'), style: 'destructive', onPress: onDelete },
                    ]);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.actionText, { color: themeColors.signalNegative }]}>Remove exercise</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </>
  );

  if (hideHeader) {
    const settingsValueInk = themeColors.containerSecondary;
    const selectedProgressionGroup = progressionGroups.find(g => g.id === currentProgressionGroupId) ?? null;
    const progressionGroupName = selectedProgressionGroup
      ? progressionPillLabel(selectedProgressionGroup.name)
      : 'None';
    const progressionRepLine =
      selectedProgressionGroup &&
      typeof (selectedProgressionGroup as any).repRangeMin === 'number' &&
      typeof (selectedProgressionGroup as any).repRangeMax === 'number'
        ? `${(selectedProgressionGroup as any).repRangeMin}—${(selectedProgressionGroup as any).repRangeMax} reps`
        : null;
    const progressionIncLine =
      selectedProgressionGroup && typeof (selectedProgressionGroup as any).weightIncrement === 'number'
        ? `↑ ${(selectedProgressionGroup as any).weightIncrement} ${weightUnit}`
        : null;
    const liveHistoryIndex =
      heldHistoryIndex == null
        ? Math.max(0, historyTrendPoints.length - 1)
        : Math.max(0, Math.min(historyTrendPoints.length - 1, heldHistoryIndex));
    const liveHistoryPoint =
      historyTrendPoints.length > 0 ? historyTrendPoints[liveHistoryIndex] : null;
    const fallbackSet =
      latestWorkoutConsolidatedSets.length > 0
        ? latestWorkoutConsolidatedSets[latestWorkoutConsolidatedSets.length - 1]
        : null;
    const liveHistorySet = liveHistoryPoint?.set ?? fallbackSet;
    const liveHistoryWeightLabel = liveHistorySet
      ? formatWeightForLoad(liveHistorySet.weight, useKg)
      : null;

    return (
      <View style={[styles.embeddedPanel, { height: containerHeight }]} pointerEvents={interactive ? 'auto' : 'none'}>
        <ScrollView
          style={styles.embeddedScroll}
          contentContainerStyle={styles.embeddedContent}
          showsVerticalScrollIndicator={false}
          bounces
          keyboardShouldPersistTaps="always"
          scrollEnabled={!isHistoryChartInteracting}
        >
          <View style={[styles.embeddedSection, styles.embeddedHistorySection]}>
            {liveHistorySet ? (
              <View style={styles.embeddedHistoryHeroRow}>
                <Text style={[styles.embeddedHistoryHeroValue, { color: settingsValueInk }]}>
                  {liveHistorySet.reps}
                  <Text style={{ color: hexToRgba(settingsValueInk, 0.58) }}>×</Text>
                  {liveHistoryWeightLabel}
                </Text>
              </View>
            ) : (
              <Text style={[styles.embeddedHistoryValue, { color: settingsValueInk }]}>{t('noHistoryRecordedYet')}</Text>
            )}
            {historyTrendValues.length > 0 ? (
              <HistoryMiniChart
                values={historyTrendValues}
                dates={historyTrendPoints.map(point => point.date)}
                unit={weightUnit}
                color={settingsValueInk}
                indicatorBorderColor={explore.surfaceCurrentCard}
                variant="hero"
                interactive
                heldIndex={liveHistoryIndex}
                onHoldIndexChange={setHeldHistoryIndex}
                onHoldEnd={() => setHeldHistoryIndex(null)}
                onInteractionStart={() => setIsHistoryChartInteracting(true)}
                onInteractionEnd={() => setIsHistoryChartInteracting(false)}
              />
            ) : null}
          </View>

          <View style={styles.embeddedTwoColumnRow}>
            <View style={[styles.embeddedSplitModule, { borderTopColor: accentSecondary20 }]}>
              <Pressable
                style={styles.embeddedSplitRow}
                onPress={() => {
                  const next = !timeBased;
                  onTimeBasedChange(next);
                  if (!next && perSide) onPerSideChange(false);
                }}
              >
                <Text style={styles.embeddedLabel}>Time-based{'\n'}exercise</Text>
                <Text style={[styles.embeddedHeroValue, { color: settingsValueInk }]}>
                  {timeBased ? 'on' : 'off'}
                </Text>
              </Pressable>
            </View>

            <View style={[styles.embeddedSplitModule, { borderTopColor: accentSecondary20 }]}>
              <Pressable
                style={styles.embeddedSplitRow}
                onPress={() => {
                  if (!timeBased) return;
                  onPerSideChange(!perSide);
                }}
              >
                <Text style={styles.embeddedLabel}>Two-sides{'\n'}exercise</Text>
                <Text
                  style={[
                    styles.embeddedHeroValue,
                    { color: timeBased ? settingsValueInk : accentSecondary20 },
                  ]}
                >
                  {perSide ? 'on' : 'off'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.embeddedSection, { borderTopColor: accentSecondary20 }]}>
            <View style={styles.embeddedRow}>
              <Text style={styles.embeddedLabel}>Auto progression</Text>
              <View style={styles.embeddedRightColumn}>
                <Text style={[styles.embeddedHeroValue, { color: settingsValueInk }]}>{progressionGroupName}</Text>
                {progressionRepLine ? (
                  <Text style={[styles.embeddedProgressMeta, { color: settingsValueInk }]}>
                    {progressionRepLine}
                  </Text>
                ) : null}
                {progressionIncLine ? (
                  <Text style={[styles.embeddedProgressMeta, { color: settingsValueInk }]}>
                    {progressionIncLine}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </ScrollView>
        <View style={[styles.embeddedActionsBar, { borderTopColor: accentSecondary20 }]}>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionCell, { backgroundColor: explore.skipRestCtaBg }]}
              onPress={onSwap}
              activeOpacity={0.75}
            >
              <Text style={[styles.actionText, { color: themeColors.text }]}>Swap exercise</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionCell, { backgroundColor: explore.skipRestCtaBg }]}
              onPress={() => {
                Alert.alert(t('deleteExerciseTitle'), t('deleteExerciseMessage'), [
                  { text: t('cancel'), style: 'cancel' },
                  { text: t('remove'), style: 'destructive', onPress: onDelete },
                ]);
              }}
              activeOpacity={0.75}
            >
              <Text style={[styles.actionText, { color: themeColors.signalNegative }]}>Remove exercise</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <Reanimated.View
      pointerEvents={interactive ? 'auto' : 'none'}
      style={[styles.panelOuter, shellAnimStyle]}
    >
      {/** Outside rounded clip so the hairline spans the full drawer width (true full bleed). */}
      <View style={[styles.drawerTopDivider, { backgroundColor: accentSecondary20 }]} />
      <View
        style={[
          styles.panelSoftBase,
          bodyFillsSlot ? styles.panelSoftFill : styles.panelSoftHug,
          { backgroundColor: explore.surfaceCurrentCard },
        ]}
      >
        <Pressable
          style={[styles.drawerHeaderRow, visible ? styles.drawerHeaderRowExpanded : styles.drawerHeaderRowCollapsed]}
          onPress={onHeaderPress}
          disabled={!interactive}
          accessibilityRole="button"
          accessibilityLabel={visible ? t('done') : t('settings')}
          hitSlop={10}
        >
          <View style={styles.settingsHeaderBtn}>
            <View style={styles.settingsHeaderSwapSlot}>
              <Animated.View style={[styles.settingsHeaderLayer, settingsHeaderLayerStyle]} pointerEvents="none">
                <Text
                  style={[
                    styles.settingsLinkText,
                    {
                      color: themeColors.accentSecondary,
                      borderBottomColor: themeColors.accentSecondary,
                    },
                  ]}
                >
                  {t('settings')}
                </Text>
              </Animated.View>
              <Animated.View style={[styles.settingsHeaderLayer, closeHeaderLayerStyle]} pointerEvents="none">
                <Text
                  style={[
                    styles.settingsLinkText,
                    {
                      color: themeColors.accentSecondary,
                      borderBottomColor: themeColors.accentSecondary,
                    },
                  ]}
                >
                  {t('done')}
                </Text>
              </Animated.View>
            </View>
          </View>
        </Pressable>

        <View style={bodyFillsSlot ? styles.drawerBodyFill : styles.drawerBodyHug}>
          <ScrollView
            style={bodyFillsSlot ? styles.scrollFill : styles.scrollHug}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            bounces
            scrollEnabled={scrollInteractionNeeded}
            onContentSizeChange={(_w, h) => setScrollContentHeight(h)}
    >
      <View style={styles.pad}>
              {!latestPriorWorkout ? (
                <View style={styles.historyLeadRow}>
                  <Text style={[styles.historyDateMuted, { color: themeColors.accentSecondary }]}>
                    {t('noHistoryRecordedYet')}
                  </Text>
                </View>
              ) : (
                <View style={styles.historyBlock}>
                  <View style={styles.historyDataRow}>
                    <View style={styles.historyLeftColumn}>
                      <Text style={[styles.historyDateMuted, { color: themeColors.accentSecondary }]}>
                        {dayjs(latestPriorWorkout.date).format('MMMM D')}
                        {getOrdinalSuffix(dayjs(latestPriorWorkout.date).date())}
                      </Text>
                    </View>
                    <View style={styles.historySetsColumn}>
                      {latestPriorConsolidatedSets.map((set, setIndex) => (
                        <View key={setIndex} style={styles.historySetRow}>
                          <Text style={[styles.historySetText, { color: themeColors.text }]}>
                            {formatWeightForLoad(set.weight, useKg)}
                            <Text style={[styles.historySetText, { color: historyUnitInk }]}> {weightUnit}</Text>
                            {' '}
                            {set.reps}
                            <Text style={[styles.historySetText, { color: historyUnitInk }]}>
                              {' '}
                              {timeBased ? 'sec' : 'reps'}
                            </Text>
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <HistoryMiniChart
                    values={latestPriorConsolidatedSets.map(set => Number(set.weight) || 0)}
                    color={themeColors.text}
                  />
        </View>
              )}

              <View style={[styles.sectionDivider, styles.useTimerDivider, { backgroundColor: accentSecondary20 }]} />
        <View style={styles.row}>
                <Text style={styles.labelMeta}>Use timer</Text>
                <Toggle
                  label=""
                  hideLabel
                  value={timeBased}
                  trackOffColor={themeColors.containerPrimaryDark}
                  thumbOnColor={explore.skipRestCtaBg}
                  thumbOffColor={themeColors.containerSecondary}
                  onValueChange={() => {
                    const next = !timeBased;
                    onTimeBasedChange(next);
                    if (!next && perSide) onPerSideChange(false);
                  }}
                />
        </View>
              <Text style={[styles.helperText, { color: themeColors.accentSecondary }]}>
                Track each set by duration instead of reps
              </Text>
        <View style={styles.row}>
                <Text style={[styles.labelMeta, { color: timeBased ? themeColors.text : accentSecondary20 }]}>
                  Alternate sides
                </Text>
                <Toggle
                  label=""
                  hideLabel
                  value={perSide}
                  disabled={!timeBased}
                  trackOffColor={timeBased ? themeColors.containerPrimaryDark : accentSecondary20}
                  thumbOnColor={explore.skipRestCtaBg}
                  thumbOffColor={themeColors.containerSecondary}
                  onValueChange={() => onPerSideChange(!perSide)}
                />
        </View>
              <Text style={[styles.helperText, { color: timeBased ? themeColors.accentSecondary : accentSecondary20 }]}>
                Runs the timer once per side for each set
              </Text>

        {type === 'main' && (
          <>
            <View style={styles.progressionCardsRow}>
              {progressionGroups.map(g => (
                (() => {
                  const isSelected = currentProgressionGroupId === g.id;
                  return (
                <TouchableOpacity
                  key={g.id}
                  style={[
                    styles.pill,
                    { borderColor: accentSecondary20 },
                    isSelected && { backgroundColor: accentSecondary20 },
                  ]}
                        onPress={() =>
                          onProgressionGroupSelect(isSelected ? null : g.id)
                        }
                  activeOpacity={1}
                >
                  <View style={[styles.pillIconPlaceholder, { backgroundColor: themeColors.containerPrimaryDark }]} />
                  <Text style={[styles.pillText, isSelected && { color: themeColors.accentPrimary }]} numberOfLines={1}>
                          {progressionPillLabel(g.name)}
                  </Text>
                </TouchableOpacity>
                  );
                })()
              ))}
            </View>
            <View
              style={[
                styles.sectionDivider,
                styles.progressionCardsDivider,
                { backgroundColor: accentSecondary20 },
              ]}
            />
          </>
        )}
            </View>

            <View style={styles.actionsWrap}>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionCell, { backgroundColor: explore.skipRestCtaBg }]}
            onPress={onSwap}
            activeOpacity={0.75}
          >
            <Text style={[styles.actionText, { color: themeColors.text }]}>Swap exercise</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionCell, { backgroundColor: explore.skipRestCtaBg }]}
            onPress={() => {
              Alert.alert(t('deleteExerciseTitle'), t('deleteExerciseMessage'), [
                { text: t('cancel'), style: 'cancel' },
                { text: t('remove'), style: 'destructive', onPress: onDelete },
              ]);
            }}
            activeOpacity={0.75}
          >
                  <Text style={[styles.actionText, { color: themeColors.signalNegative }]}>Remove exercise</Text>
          </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  embeddedPanel: {
    flex: 1,
    minHeight: 0,
  },
  embeddedScroll: {
    flex: 1,
    minHeight: 0,
  },
  embeddedContent: {
    paddingHorizontal: CONTENT_PAD_H,
    paddingBottom: 24,
    paddingTop: 8,
  },
  embeddedActionsBar: {
    borderTopWidth: 1,
    paddingHorizontal: CONTENT_PAD_H,
    paddingTop: 16,
    paddingBottom: 16,
  },
  embeddedSection: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginBottom: 56,
  },
  embeddedHistorySection: {
    borderTopWidth: 0,
  },
  embeddedTwoColumnRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 56,
  },
  embeddedSplitModule: {
    flex: 1,
    borderTopWidth: 1,
    paddingTop: 16,
  },
  embeddedSplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  embeddedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  embeddedLabel: {
    ...TYPOGRAPHY.legal,
    textTransform: 'uppercase',
    color: EXPLORE_V2.colors.textPrimary,
    paddingTop: 2,
    flexShrink: 0,
  },
  embeddedRightColumn: {
    alignItems: 'flex-end',
    flexShrink: 1,
  },
  embeddedHistoryTitle: {
    ...TYPOGRAPHY.legal,
    textTransform: 'uppercase',
  },
  embeddedHistoryValue: {
    ...TYPOGRAPHY.legal,
    marginTop: 2,
    textAlign: 'right',
  },
  embeddedHistoryHeroRow: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  embeddedHistoryHeroValue: {
    ...TYPOGRAPHY.h1,
    includeFontPadding: false,
  },
  embeddedHistoryHeroUnit: {
    ...TYPOGRAPHY.h1,
    lineHeight: TYPOGRAPHY.h1.fontSize,
    marginTop: 18,
  },
  embeddedHeroValue: {
    ...TYPOGRAPHY.h1,
    textAlign: 'right',
  },
  embeddedProgressMeta: {
    ...TYPOGRAPHY.legal,
    textAlign: 'right',
    marginTop: 2,
  },
  /** Root: no top radius / clip — divider is full width; shadow wraps whole drawer. */
  panelOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  /** Soft surface + rounded corners; divider sits above so the hairline isn’t corner-clipped. */
  panelSoftBase: {
    overflow: 'hidden',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: EXPLORE_V2.cardRadius,
    borderBottomRightRadius: EXPLORE_V2.cardRadius,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
  },
  panelSoftFill: {
    flex: 1,
    minHeight: 0,
  },
  /** Short content: no extra soft area below Swap/Remove. */
  panelSoftHug: {
    flexGrow: 0,
    flexShrink: 0,
  },
  drawerTopDivider: {
    height: DRAWER_TOP_DIVIDER_H,
    alignSelf: 'stretch',
    width: '100%',
    flexShrink: 0,
  },
  /** Centered header — matches ExploreV2UpNextCard `addExerciseBtn` / `addExerciseText` */
  drawerHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: HEADER_PADDING_TOP,
    paddingHorizontal: CONTENT_PAD_H,
    paddingBottom: 0,
    flexShrink: 0,
  },
  /** Same tap target / layout intent as Up Next `addExerciseBtn` (centered variant) */
  settingsHeaderBtn: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  /** Cross-fade slot for Settings ↔ Close — matches Up Next `countOrPlusSlot` layering. */
  settingsHeaderSwapSlot: {
    position: 'relative',
    minHeight: 30,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsHeaderLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Underlined link — colors from theme (container-secondary) at runtime */
  settingsLinkText: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
    flexShrink: 0,
    paddingBottom: 2,
    borderBottomWidth: 1,
  },
  /** Collapsed shell − 1px divider (header row = 48px) */
  drawerHeaderRowCollapsed: {
    height: COLLAPSED_SHELL_H - DRAWER_TOP_DIVIDER_H,
  },
  drawerHeaderRowExpanded: {
    minHeight: HEADER_PADDING_TOP + DRAWER_HEADER_ROW_H,
  },
  drawerBodyFill: {
    flex: 1,
    minHeight: 0,
  },
  drawerBodyHug: {
    flexGrow: 0,
    flexShrink: 0,
  },
  scrollFill: {
    flex: 1,
    minHeight: 0,
  },
  scrollHug: {
    flexGrow: 0,
  },
  /** Single horizontal inset for Structure, toggles, and Swap/Remove; bottom inset for whole sheet body. */
  scrollContent: {
    flexGrow: 0,
    paddingHorizontal: CONTENT_PAD_H,
    paddingBottom: 32,
  },
  pad: {
    paddingTop: 8,
    paddingBottom: 0,
  },
  actionsWrap: {
    marginTop: 44,
    alignSelf: 'stretch',
  },
  sectionDivider: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.24)',
    marginTop: 16,
    marginBottom: 8,
  },
  sectionAfter: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingTop: 16,
    marginTop: 0,
    marginBottom: 8,
  },
  sectionAfterTight: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingTop: 16,
    marginTop: 0,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    ...TYPOGRAPHY.body,
    color: EXPLORE_V2.colors.textPrimary,
    flex: 1,
  },
  labelMeta: {
    ...TYPOGRAPHY.meta,
    color: EXPLORE_V2.colors.textPrimary,
    flex: 1,
  },
  labelDisabled: {
    color: EXPLORE_V2.colors.textMeta,
  },
  helperText: {
    ...TYPOGRAPHY.meta,
    marginTop: -4,
    marginBottom: 8,
    maxWidth: '82%',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    alignItems: 'stretch',
  },
  progressionCardsRow: {
    marginTop: 24,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    alignItems: 'stretch',
  },
  progressionCardsDivider: {
    marginTop: 24,
  },
  useTimerDivider: {
    marginBottom: 24,
  },
  pill: {
    flex: 1,
    height: 80,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillIconPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 6,
    marginBottom: 8,
  },
  pillText: {
    ...TYPOGRAPHY.meta,
    color: EXPLORE_V2.colors.textPrimary,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  actionCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
  },
  actionText: {
    ...TYPOGRAPHY.meta,
    fontWeight: '500',
  },
  historyBlock: {
    alignSelf: 'stretch',
    paddingBottom: 4,
  },
  historyLeadRow: {
    paddingVertical: 8,
    alignSelf: 'stretch',
  },
  historyLeftColumn: {
    flex: 1,
  },
  historyLeadLabel: {
    ...TYPOGRAPHY.meta,
    color: EXPLORE_V2.colors.textPrimary,
  },
  historyDateMuted: {
    ...TYPOGRAPHY.meta,
    marginTop: 2,
  },
  historyChartWrap: {
    marginTop: 12,
    alignSelf: 'stretch',
  },
  historyDataRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: 0,
  },
  historySetsColumn: {
    alignItems: 'flex-end',
  },
  historySetRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.lg,
    paddingVertical: 2,
  },
  historyValueColumn: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 4,
    width: 48,
  },
  historySetText: {
    ...TYPOGRAPHY.meta,
  },
  historySetUnit: {
    ...TYPOGRAPHY.meta,
    color: EXPLORE_V2.colors.textMeta,
  },
});
