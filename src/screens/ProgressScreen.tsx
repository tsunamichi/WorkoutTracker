import React, { useCallback, useMemo, useState } from 'react';
import { Animated, Easing, PanResponder, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import { SPACING, TYPOGRAPHY } from '../constants';
import { useStore } from '../store';
import { useAppTheme } from '../theme/useAppTheme';

type RouteParams = {
  Progress: { exerciseId?: string; exerciseName?: string } | undefined;
};

type ExerciseSeries = {
  id: string;
  name: string;
  metrics: {
    weight: number[];
    reps: number[];
    time: number[];
  };
  weightDates?: string[];
};

const MAX_PROGRESS_LOGS = 16;

function getRealExerciseSeries(params: {
  scheduledWorkouts: any[];
  detailedWorkoutProgress: Record<string, any>;
  exercises: any[];
}): ExerciseSeries[] {
  const { scheduledWorkouts, detailedWorkoutProgress, exercises } = params;
  const sorted = [...scheduledWorkouts].sort((a, b) => a.date.localeCompare(b.date));
  const byExercise = new Map<string, ExerciseSeries>();

  for (const sw of sorted) {
    const progressBySchedule = detailedWorkoutProgress[sw.id];
    const progressByTemplateDate = detailedWorkoutProgress[`${sw.templateId}-${sw.date}`];
    const progress = progressBySchedule ?? progressByTemplateDate;
    if (!progress?.exercises) continue;

    for (const ex of sw.exercisesSnapshot ?? []) {
      const exProgress = progress.exercises?.[ex.id] ?? progress.exercises?.[ex.exerciseId];
      if (!exProgress?.sets || exProgress.sets.length === 0) continue;

      const exerciseMeta = exercises.find((e: any) => e.id === ex.exerciseId);
      const id = ex.exerciseId;
      const name = exerciseMeta?.name ?? 'Unknown';
      if (!byExercise.has(id)) {
        byExercise.set(id, {
          id,
          name,
          metrics: { weight: [], reps: [], time: [] },
        });
      }
      const series = byExercise.get(id)!;
      const sets = exProgress.sets.filter((s: any) => Number.isFinite(s.reps) || Number.isFinite(s.weight));
      if (sets.length === 0) continue;

      const maxWeight = Math.max(
        0,
        ...sets.map((s: any) => (Number.isFinite(s.weight) ? Number(s.weight) : 0)),
      );
      const maxReps = Math.max(
        0,
        ...sets.map((s: any) => (Number.isFinite(s.reps) ? Number(s.reps) : 0)),
      );

      if (ex.isTimeBased) {
        if (maxReps > 0) series.metrics.time.push(maxReps);
      } else {
        if (maxWeight > 0) {
          series.metrics.weight.push(maxWeight);
          if (!series.weightDates) series.weightDates = [];
          series.weightDates.push(sw.date);
        }
        if (maxReps > 0) series.metrics.reps.push(maxReps);
      }
    }
  }

  return Array.from(byExercise.values()).filter(s => {
    const total = s.metrics.weight.length + s.metrics.reps.length + s.metrics.time.length;
    return total > 0;
  });
}

function getInsight(values: number[]): string {
  if (values.length < 2) return 'Add more sessions to see a trend';
  const latest = values[values.length - 1];
  const first = values[0];
  const highest = Math.max(...values);
  const delta = latest - first;
  const unit = 'lb';
  const nonZeroDiffs = values
    .slice(1)
    .map((v, i) => v - values[i])
    .filter(d => d !== 0);
  const mostlyStable = nonZeroDiffs.length <= 2;
  if (latest === highest) {
    if (delta >= 3) return `+${delta} ${unit} in last ${values.length} sessions`;
    return 'New PR';
  }
  const allSame = values.every(v => v === values[0]);
  if (allSame) return `Holding steady`;
  if (mostlyStable) return `Consistent over last ${values.length} sessions`;
  if (delta > 0) return `+${delta} ${unit} in last ${values.length} sessions`;
  if (Math.abs(delta) <= 1) return `Consistent over last ${values.length} sessions`;
  return `${delta} ${unit} in last ${values.length} sessions`;
}

function ProgressChart({
  values,
  onHoldIndexChange,
  onHoldEnd,
  animationSeed,
  heldEntryIndex,
  colors,
}: {
  values: number[];
  onHoldIndexChange?: (index: number) => void;
  onHoldEnd?: () => void;
  animationSeed?: string;
  heldEntryIndex?: number | null;
  colors: {
    containerPrimary: string;
    textMeta: string;
  };
}) {
  const [chartW, setChartW] = useState(0);
  const fallbackChartW = 260;
  const resolvedChartW = chartW > 0 ? chartW : fallbackChartW;
  const chartH = 240;
  const padX = 8;
  const padTop = 20;
  const padBottom = 2;
  const drawProgressMs = React.useRef(new Animated.Value(0)).current;
  const [drawMs, setDrawMs] = useState(0);

  if (values.length === 0) {
    return (
      <View style={[styles.chartEmpty, { width: resolvedChartW, height: chartH }]}>
        <Text style={[styles.chartEmptyText, { color: colors.textMeta }]}>No data yet</Text>
      </View>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const COLUMN_GAP = 1;
  const columnCount = Math.max(1, values.length);
  const drawableW = Math.max(1, resolvedChartW - padX * 2);
  const columnW = Math.max(1, (drawableW - COLUMN_GAP * (columnCount - 1)) / columnCount);
  const columnStride = columnW + COLUMN_GAP;
  const points = values.map((v, i) => {
    const x = padX + i * columnStride + columnW / 2;
    const t = (v - min) / range;
    const y = padTop + (1 - t) * (chartH - padTop - padBottom);
    return { x, y, v };
  });
  const prValue = Math.max(...values);
  const prIndex = values.lastIndexOf(prValue);
  const prY = points[prIndex]?.y ?? chartH;
  const baseY = chartH;
  const STAGGER_MS = 50;
  const RISE_MS = 260;
  const BOUNCE_UP_MS = 90;
  const BOUNCE_DOWN_MS = 110;
  const BOUNCE_OVERSHOOT = 1.03;
  const pointAnimMs = RISE_MS + BOUNCE_UP_MS + BOUNCE_DOWN_MS;
  const totalMs = Math.max(1, (values.length - 1) * STAGGER_MS + pointAnimMs);
  const easeRise = Easing.out(Easing.cubic);
  const easeBounceUp = Easing.out(Easing.cubic);
  const easeBounceDown = Easing.out(Easing.quad);
  const animatedPoints = points.map((point, index) => ({
    ...point,
    y: (() => {
      const localMs = drawMs - index * STAGGER_MS;
      let progress = 0;
      if (localMs <= 0) {
        progress = 0;
      } else if (localMs < RISE_MS) {
        progress = easeRise(localMs / RISE_MS);
      } else if (localMs < RISE_MS + BOUNCE_UP_MS) {
        const t = easeBounceUp((localMs - RISE_MS) / BOUNCE_UP_MS);
        progress = 1 + (BOUNCE_OVERSHOOT - 1) * t;
      } else if (localMs < pointAnimMs) {
        const t = easeBounceDown((localMs - RISE_MS - BOUNCE_UP_MS) / BOUNCE_DOWN_MS);
        progress = BOUNCE_OVERSHOOT + (1 - BOUNCE_OVERSHOOT) * t;
      } else {
        progress = 1;
      }
      return baseY + (point.y - baseY) * progress;
    })(),
  }));
  React.useEffect(() => {
    drawProgressMs.setValue(0);
    const sub = drawProgressMs.addListener(({ value }) => {
      setDrawMs(value);
    });
    Animated.sequence([
      Animated.delay(90),
      Animated.timing(drawProgressMs, {
        toValue: totalMs,
        duration: totalMs,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ]).start();
    return () => {
      drawProgressMs.removeListener(sub);
    };
  }, [animationSeed, drawProgressMs, totalMs, values]);

  return (
    <View
      style={{ width: '100%' }}
      onLayout={evt => {
        const nextWidth = Math.floor(evt.nativeEvent.layout.width);
        if (nextWidth > 0 && nextWidth !== chartW) setChartW(nextWidth);
      }}
      onStartShouldSetResponder={() => values.length > 0}
      onMoveShouldSetResponder={() => values.length > 0}
      onResponderTerminationRequest={() => false}
      onResponderGrant={evt => {
        if (drawMs < totalMs) return;
        if (!onHoldIndexChange || values.length === 0) return;
        const x = Math.max(padX, Math.min(resolvedChartW - padX, evt.nativeEvent.locationX));
        const rawIndex = Math.floor((x - padX) / columnStride);
        const index = Math.max(0, Math.min(values.length - 1, rawIndex));
        onHoldIndexChange(index);
      }}
      onResponderMove={evt => {
        if (drawMs < totalMs) return;
        if (!onHoldIndexChange || values.length === 0) return;
        const x = Math.max(padX, Math.min(resolvedChartW - padX, evt.nativeEvent.locationX));
        const rawIndex = Math.floor((x - padX) / columnStride);
        const index = Math.max(0, Math.min(values.length - 1, rawIndex));
        onHoldIndexChange(index);
      }}
      onResponderRelease={() => {
        onHoldEnd?.();
      }}
      onResponderTerminate={() => {
        onHoldEnd?.();
      }}
    >
      <Svg width={resolvedChartW} height={chartH}>
        <Line
          x1={padX + 22}
          y1={prY}
          x2={resolvedChartW - padX}
          y2={prY}
          stroke={colors.containerPrimary}
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.4}
        />
        <SvgText
          x={padX}
          y={prY}
          fontSize={TYPOGRAPHY.legal.fontSize}
          fontWeight="600"
          fill={colors.containerPrimary}
          textAnchor="start"
          alignmentBaseline="middle"
        >
          PR
        </SvgText>
        {animatedPoints.map((p, i) => {
          const left = padX + i * columnStride;
          const right = left + columnW;
          const width = Math.max(1, right - left);
          const topY = p.y;
          const isHeldMode = heldEntryIndex != null;
          const columnOpacity = isHeldMode && i !== heldEntryIndex ? 0.6 : 1;
          return (
            <React.Fragment key={`seg-${i}`}>
              <Rect
                x={left}
                y={topY}
                width={width}
                height={Math.max(0, chartH - topY)}
                fill={colors.containerPrimary}
                opacity={0.08 * columnOpacity}
              />
              <Line
                x1={left}
                y1={topY}
                x2={right}
                y2={topY}
                stroke={colors.containerPrimary}
                strokeWidth={1.4}
                opacity={columnOpacity}
              />
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

export function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'Progress'>>();
  const { scheduledWorkouts, detailedWorkoutProgress, exercises, progressionGroups } = useStore();
  const theme = useAppTheme();
  const { colors: themeColors } = theme;
  const isV2Theme = theme.id === 'v2';
  const progressCardBackground = isV2Theme ? themeColors.containerSecondary : themeColors.accentSecondarySoft;
  const progressInk = themeColors.containerPrimary;

  const realSeries = useMemo(
    () => getRealExerciseSeries({ scheduledWorkouts, detailedWorkoutProgress, exercises }),
    [detailedWorkoutProgress, exercises, scheduledWorkouts],
  );

  const mainGroupExerciseIds = useMemo(() => {
    const isMainGroup = (name: string, id: string) => {
      const n = name.trim().toLowerCase();
      return n === 'main upper' || n === 'main lower' || id === 'pg-main-upper' || id === 'pg-main-lower';
    };
    return progressionGroups
      .filter(group => isMainGroup(group.name, group.id))
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .flatMap(group => group.exerciseIds)
      .filter((exerciseId, index, all) => all.indexOf(exerciseId) === index);
  }, [progressionGroups]);

  const sourceSeries = useMemo(() => {
    const byId = new Map(realSeries.map(item => [item.id, item]));
    if (mainGroupExerciseIds.length > 0) {
      return mainGroupExerciseIds
        .map(exerciseId => byId.get(exerciseId))
        .filter((item): item is ExerciseSeries => !!item);
    }
    return realSeries;
  }, [mainGroupExerciseIds, realSeries]);

  const pinned = sourceSeries;
  const routeExerciseName = route.params?.exerciseName?.trim().toLowerCase();
  const routeExerciseId = route.params?.exerciseId;
  const routeExerciseByName = routeExerciseName
    ? pinned.find(p => p.name.trim().toLowerCase() === routeExerciseName)
    : undefined;
  const initialExerciseId =
    (routeExerciseId && pinned.some(p => p.id === routeExerciseId)
      ? routeExerciseId
      : (routeExerciseByName?.id ?? pinned[0]?.id)) ?? '';

  const [activeExerciseId, setActiveExerciseId] = useState(initialExerciseId);
  const [heldEntryIndex, setHeldEntryIndex] = useState<number | null>(null);
  const [transitionDirection, setTransitionDirection] = useState<1 | -1>(1);
  const exerciseTransition = React.useRef(new Animated.Value(1)).current;

  const activeExercise = pinned.find(p => p.id === activeExerciseId) ?? pinned[0] ?? {
    id: 'no-exercise',
    name: 'No logged exercises',
    metrics: { weight: [], reps: [], time: [] },
  };
  const rawValues = activeExercise.metrics.weight;
  const values = useMemo(
    () => rawValues.slice(-MAX_PROGRESS_LOGS),
    [rawValues],
  );
  const visibleDates = useMemo(() => {
    const allDates = (activeExercise.weightDates ?? []).filter(Boolean);
    if (allDates.length === 0) return [] as string[];
    return allDates.slice(Math.max(0, allDates.length - values.length));
  }, [activeExercise.weightDates, values.length]);
  const latestIndex = Math.max(0, values.length - 1);
  const displayIndex = heldEntryIndex == null ? latestIndex : heldEntryIndex;
  const latest = values.length > 0 ? values[displayIndex] : 0;
  const insight = getInsight(values);
  const dateContext = useMemo(() => {
    if (visibleDates.length === 0) {
      return { first: '--', last: '--' };
    }
    const first = dayjs(visibleDates[0]).format('MMM D');
    const last = dayjs(visibleDates[visibleDates.length - 1]).format('MMM D');
    return { first, last };
  }, [visibleDates]);
  const selectedDateLabel = useMemo(() => {
    if (displayIndex < 0 || displayIndex >= visibleDates.length) return null;
    return dayjs(visibleDates[displayIndex]).format('MMM D');
  }, [displayIndex, visibleDates]);
  const metadataText =
    heldEntryIndex == null
      ? insight
      : (selectedDateLabel ?? '');
  const exerciseCount = Math.max(1, pinned.length);
  const exerciseIndex = Math.max(0, pinned.findIndex(p => p.id === activeExercise.id));
  const exercisePagination = `${exerciseIndex + 1}/${exerciseCount}`;

  const switchExerciseByDelta = useCallback(
    (delta: -1 | 1) => {
      const current = pinned.findIndex(p => p.id === activeExercise.id);
      if (current < 0) return;
      const next = Math.min(pinned.length - 1, Math.max(0, current + delta));
      if (next === current) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTransitionDirection(delta);
      exerciseTransition.setValue(0);
      setActiveExerciseId(pinned[next].id);
      setHeldEntryIndex(null);
    },
    [activeExercise.id, exerciseTransition, pinned],
  );

  const activateExercise = useCallback(
    (exerciseId: string) => {
      if (exerciseId === activeExercise.id) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTransitionDirection(1);
      exerciseTransition.setValue(0);
      setActiveExerciseId(exerciseId);
      setHeldEntryIndex(null);
    },
    [activeExercise.id, exerciseTransition],
  );

  React.useEffect(() => {
    Animated.timing(exerciseTransition, {
      toValue: 1,
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeExercise.id, exerciseTransition]);

  const exerciseTransitionStyle = {
    opacity: exerciseTransition,
    transform: [
      {
        translateX: exerciseTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [14 * transitionDirection, 0],
        }),
      },
    ],
  };

  const pageSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          const horizontal = Math.abs(gestureState.dx) > 18;
          const mostlyHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2;
          return horizontal && mostlyHorizontal;
        },
        onPanResponderRelease: (_evt, gestureState) => {
          if (gestureState.dx <= -45) switchExerciseByDelta(1);
          else if (gestureState.dx >= 45) switchExerciseByDelta(-1);
        },
      }),
    [switchExerciseByDelta],
  );

  return (
    <View style={[styles.gradient, { backgroundColor: themeColors.canvasLight, paddingTop: insets.top }]}>
      <SafeAreaView style={styles.container} edges={[]} {...pageSwipeResponder.panHandlers}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.goBack();
            }}
            activeOpacity={0.8}
            style={styles.backButton}
          >
            <Text style={[styles.backText, { color: themeColors.textMeta }]}>‹ Schedule</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
          bounces={false}
        >
          <View style={styles.headerBlock}>
            <Text style={[styles.contextTitle, { color: themeColors.textMeta }]}>My Progress</Text>
            <Animated.View style={exerciseTransitionStyle}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => switchExerciseByDelta(1)}>
                <Text style={[styles.exerciseTitle, { color: progressInk }]}>{activeExercise.name}</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          <Animated.View style={exerciseTransitionStyle}>
            <View style={[styles.chartCard, { backgroundColor: progressCardBackground }]}>
              <View style={styles.chartCardTop}>
                <View style={styles.valueRow}>
                  <Text style={[styles.currentValueCard, { color: progressInk }]}>{latest > 0 ? `${latest}` : '--'}</Text>
                  <Text style={[styles.currentValueUnit, { color: progressInk }]}>lbs</Text>
                </View>
                <Text style={[styles.insightCardText, { color: progressInk }]}>{metadataText}</Text>
              </View>
              <ProgressChart
                values={values}
                onHoldIndexChange={setHeldEntryIndex}
                onHoldEnd={() => setHeldEntryIndex(null)}
                animationSeed={activeExercise.id}
                heldEntryIndex={heldEntryIndex}
                colors={{
                  containerPrimary: progressInk,
                  textMeta: themeColors.textMeta,
                }}
              />
            </View>
            <View style={styles.chartDateContextRow}>
              <Text style={[styles.chartDateContextText, { color: themeColors.textMeta }]}>{dateContext.first}</Text>
              <Text style={[styles.chartDateContextText, { color: themeColors.textMeta }]}>{dateContext.last}</Text>
            </View>
          </Animated.View>
        </ScrollView>
        <View style={[styles.paginationFooter, { paddingBottom: insets.bottom + SPACING.lg }]}>
          <Text style={[styles.exercisePaginationText, { color: themeColors.textMeta }]}>{exercisePagination}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  backText: {
    ...TYPOGRAPHY.meta,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xl,
  },
  headerBlock: {
    marginBottom: SPACING.lg,
  },
  contextTitle: {
    ...TYPOGRAPHY.displayLarge,
  },
  exerciseTitle: {
    ...TYPOGRAPHY.displayLarge,
    marginTop: SPACING.xs,
  },
  chartCard: {
    marginTop: SPACING.lg,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  chartCardTop: {
    padding: 16,
    paddingBottom: 8,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 2,
  },
  currentValueCard: {
    ...TYPOGRAPHY.valueDisplay,
    letterSpacing: -1.4,
  },
  currentValueUnit: {
    ...TYPOGRAPHY.h2,
    fontWeight: '500',
    marginTop: 14,
  },
  insightCardText: {
    ...TYPOGRAPHY.meta,
    fontWeight: '500',
    marginTop: 0,
    transform: [{ translateY: -8 }],
  },
  exercisePaginationText: {
    ...TYPOGRAPHY.meta,
  },
  paginationFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: SPACING.sm,
  },
  chartDateContextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  chartDateContextText: {
    ...TYPOGRAPHY.legal,
  },
  chartEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartEmptyText: {
    ...TYPOGRAPHY.meta,
  },
});

