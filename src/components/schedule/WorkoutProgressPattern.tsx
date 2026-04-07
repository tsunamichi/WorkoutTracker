import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useAppTheme } from '../../theme/useAppTheme';

const COLS = 6;
const ROWS = 3;
const TOTAL_CELLS = COLS * ROWS;
const GAP = 1;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function makePermutation(length: number, rng: () => number): number[] {
  const arr = Array.from({ length }, (_, idx) => idx);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

type Rotation = 0 | 90 | 180 | 270;

function generatePattern(seedKey: string): { rotations: Rotation[]; fillOrder: number[] } {
  const seed = hashString(seedKey);
  const rotationRng = mulberry32(seed ^ 0x9e3779b9);
  const fillRng = mulberry32(seed ^ 0x85ebca6b);
  const rotations: Rotation[] = Array.from({ length: TOTAL_CELLS }, () => {
    const quarterTurns = Math.floor(rotationRng() * 4) as 0 | 1 | 2 | 3;
    return (quarterTurns * 90) as Rotation;
  });
  const fillOrder = makePermutation(TOTAL_CELLS, fillRng);
  return { rotations, fillOrder };
}

function getQuarterCircleOffset(rotation: Rotation, cellSize: number): { top: number; left: number } {
  if (rotation === 0) return { top: 0, left: 0 };
  if (rotation === 90) return { top: 0, left: -cellSize };
  if (rotation === 180) return { top: -cellSize, left: -cellSize };
  return { top: -cellSize, left: 0 };
}

type Props = {
  workoutId: string;
  completionRatio: number;
  style?: StyleProp<ViewStyle>;
};

export function WorkoutProgressPattern({ workoutId, completionRatio, style }: Props) {
  const { colors: themeColors } = useAppTheme();
  const [containerWidth, setContainerWidth] = useState(0);

  const { rotations, fillOrder } = useMemo(
    () => generatePattern(workoutId || 'workout-pattern'),
    [workoutId],
  );

  const clamped = clamp01(completionRatio);
  const highlightedCount = Math.round(clamped * TOTAL_CELLS);

  const highlightedSet = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < highlightedCount; i += 1) {
      set.add(fillOrder[i]);
    }
    return set;
  }, [highlightedCount, fillOrder]);

  const cellSize = containerWidth > 0 ? (containerWidth - GAP * (COLS - 1)) / COLS : 0;
  const patternHeight = cellSize > 0 ? ROWS * cellSize + GAP * (ROWS - 1) : 0;

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - containerWidth) > 0.5) {
      setContainerWidth(width);
    }
  };

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      {patternHeight > 0 ? (
        <View style={[styles.grid, { height: patternHeight }]}>
          {Array.from({ length: TOTAL_CELLS }, (_, index) => {
            const isHighlighted = highlightedSet.has(index);
            const color = isHighlighted ? themeColors.accentPrimary : themeColors.containerPrimaryDark;
            const rotation = rotations[index];
            const row = Math.floor(index / COLS);
            const col = index % COLS;
            const { top, left } = getQuarterCircleOffset(rotation, cellSize);
            return (
              <View
                key={`${workoutId}-${index}`}
                style={[
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellSize,
                    top: row * (cellSize + GAP),
                    left: col * (cellSize + GAP),
                  },
                ]}
              >
                <View
                  style={[
                    styles.quarterCircle,
                    {
                      width: cellSize * 2,
                      height: cellSize * 2,
                      borderRadius: cellSize,
                      top,
                      left,
                      backgroundColor: color,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  grid: {
    width: '100%',
    position: 'relative',
  },
  cell: {
    position: 'absolute',
    overflow: 'hidden',
  },
  quarterCircle: {
    position: 'absolute',
  },
});
