import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import dayjs from 'dayjs';
import type { HistoryGridRow } from '../../utils/historyWeekGrid';
import {
  HISTORY_CHART,
  HISTORY_CHART_RING_OFFSET,
  HISTORY_CHART_RING_OUTER,
} from './historyChartLayout';
import { HISTORY_VISUAL } from './historyVisualTokens';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

const SLOT = HISTORY_CHART.slotSize;
const FACE_UNSELECTED = HISTORY_CHART.unselectedFaceDiameter;
const FACE_SELECTED = HISTORY_CHART.selectedFaceDiameter;
const RING_OUTER = HISTORY_CHART_RING_OUTER;
const RING_OFFSET = HISTORY_CHART_RING_OFFSET;

/** Delay between each dot’s pulse start (snake along the path). */
const SNAKE_STAGGER_MS = 26;
/** Subtle pulse — keeps motion readable without feeling bouncy. */
const SNAKE_PEAK_SCALE = 1.07;
const SNAKE_GROW_MS = 280;
const SNAKE_SHRINK_MS = 320;
const SNAKE_EASE_OUT = Easing.bezier(0.33, 0, 0.2, 1);
const SNAKE_EASE_IN = Easing.bezier(0.4, 0, 0.2, 1);

export type FourWeekActivityChartProps = {
  rows: HistoryGridRow[];
  selectedIso: string;
  completedIsoSet: ReadonlySet<string>;
  /** Local “today” for empty/future treatment. */
  todayIso: string;
  onSelectIso: (iso: string) => void;
  /** Theme token — days with completed workout logs. */
  completedWorkoutColor: string;
};

type DotState = 'completed' | 'empty';

function cellState(iso: string, completed: ReadonlySet<string>, todayIso: string): DotState {
  if (iso > todayIso) return 'empty';
  return completed.has(iso) ? 'completed' : 'empty';
}

function ChartDayDot({
  isSunday,
  isSelected,
  dotState,
  sundayNumber,
  accessibilityLabel,
  onPress,
  completedWorkoutColor,
  pulseScale,
}: {
  isSunday: boolean;
  isSelected: boolean;
  dotState: DotState;
  sundayNumber: number | null;
  accessibilityLabel: string;
  onPress: () => void;
  completedWorkoutColor: string;
  pulseScale: Animated.Value;
}) {
  const innerFill =
    dotState === 'completed' ? completedWorkoutColor : HISTORY_VISUAL.noLogDayFill;

  const sundayTextColor = dotState === 'completed' ? '#FFFFFF' : completedWorkoutColor;

  const selectedRingColor =
    dotState === 'completed' ? HISTORY_VISUAL.noLogDayFill : completedWorkoutColor;

  const faceSize = isSelected ? FACE_SELECTED : FACE_UNSELECTED;

  return (
    <Pressable
      onPress={onPress}
      style={styles.hit}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[styles.slot, { transform: [{ scale: pulseScale }] }]}>
        {isSelected ? (
          <>
            <View
              style={[
                styles.ringBackdrop,
                {
                  width: RING_OUTER,
                  height: RING_OUTER,
                  borderRadius: RING_OUTER / 2,
                  left: RING_OFFSET,
                  top: RING_OFFSET,
                  backgroundColor: selectedRingColor,
                },
              ]}
            />
            <View
              style={[
                styles.face,
                styles.faceAboveRing,
                {
                  width: faceSize,
                  height: faceSize,
                  borderRadius: faceSize / 2,
                  backgroundColor: innerFill,
                },
              ]}
            >
              {isSunday && sundayNumber != null ? (
                <Text style={[styles.sundayNumber, { color: sundayTextColor }]}>{sundayNumber}</Text>
              ) : null}
            </View>
          </>
        ) : (
          <View
            style={[
              styles.face,
              {
                width: faceSize,
                height: faceSize,
                borderRadius: faceSize / 2,
                backgroundColor: innerFill,
              },
            ]}
          >
            {isSunday && sundayNumber != null ? (
              <Text style={[styles.sundayNumber, { color: sundayTextColor }]}>{sundayNumber}</Text>
            ) : null}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function FourWeekActivityChart({
  rows,
  selectedIso,
  completedIsoSet,
  todayIso,
  onSelectIso,
  completedWorkoutColor,
}: FourWeekActivityChartProps) {
  const flatCells = useMemo(() => rows.flat(), [rows]);
  const cellCount = flatCells.length;

  const pulseScales = useMemo(
    () => Array.from({ length: Math.max(1, cellCount) }, () => new Animated.Value(1)),
    [cellCount],
  );

  const prevSelectedIsoRef = useRef<string | null>(null);
  const snakeAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const prevIso = prevSelectedIsoRef.current;
    prevSelectedIsoRef.current = selectedIso;

    if (prevIso === null) {
      return;
    }
    if (prevIso === selectedIso || cellCount === 0) {
      return;
    }

    const i0 = flatCells.findIndex(c => c.isoDate === prevIso);
    const i1 = flatCells.findIndex(c => c.isoDate === selectedIso);
    if (i0 < 0 || i1 < 0) {
      return;
    }

    snakeAnimRef.current?.stop();
    pulseScales.forEach(s => s.setValue(1));

    const path: number[] = [];
    const step = i1 >= i0 ? 1 : -1;
    for (let i = i0; step > 0 ? i <= i1 : i >= i1; i += step) {
      path.push(i);
    }

    /**
     * Full path including the new selection. `Animated.stagger` starts each dot’s
     * pulse in order, so the tapped day stays at scale 1 until the wave reaches it
     * (last in the chain).
     */
    if (path.length === 0) {
      return;
    }

    const pulses = path.map(idx =>
      Animated.sequence([
        Animated.timing(pulseScales[idx], {
          toValue: SNAKE_PEAK_SCALE,
          duration: SNAKE_GROW_MS,
          useNativeDriver: true,
          easing: SNAKE_EASE_OUT,
        }),
        Animated.timing(pulseScales[idx], {
          toValue: 1,
          duration: SNAKE_SHRINK_MS,
          useNativeDriver: true,
          easing: SNAKE_EASE_IN,
        }),
      ]),
    );

    const snake = Animated.stagger(SNAKE_STAGGER_MS, pulses);
    snakeAnimRef.current = snake;
    snake.start(() => {
      if (snakeAnimRef.current === snake) {
        snakeAnimRef.current = null;
      }
    });

    return () => {
      snake.stop();
    };
  }, [selectedIso, flatCells, cellCount, pulseScales]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <View key={`${label}-${i}`} style={styles.headerCell}>
            <Text style={styles.headerText}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={{ height: HISTORY_CHART.headerToGridGap }} />

      {rows.map((row, ri) => (
        <View key={ri} style={[styles.row, ri < rows.length - 1 && { marginBottom: HISTORY_CHART.rowGap }]}>
          {row.map((cell, ci) => {
            const dotState = cellState(cell.isoDate, completedIsoSet, todayIso);
            const isSelected = cell.isoDate === selectedIso;
            const sundayNumber = cell.isSunday ? cell.instant.date() : null;
            const a11yLabel = dayjs(cell.isoDate).format('dddd, MMMM D');
            const flatIndex = ri * row.length + ci;
            return (
              <View key={cell.isoDate} style={styles.cell}>
                <ChartDayDot
                  isSunday={cell.isSunday}
                  isSelected={isSelected}
                  dotState={dotState}
                  sundayNumber={sundayNumber}
                  accessibilityLabel={a11yLabel}
                  onPress={() => onSelectIso(cell.isoDate)}
                  completedWorkoutColor={completedWorkoutColor}
                  pulseScale={pulseScales[flatIndex] ?? pulseScales[0]}
                />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'visible',
  },
  headerRow: {
    flexDirection: 'row',
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.2,
    color: HISTORY_VISUAL.columnLabel,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'visible',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  hit: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  slot: {
    width: SLOT,
    height: SLOT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  ringBackdrop: {
    position: 'absolute',
  },
  face: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceAboveRing: {
    zIndex: 1,
  },
  sundayNumber: {
    fontSize: HISTORY_CHART.sundayNumberSize,
    fontWeight: '600',
  },
});
