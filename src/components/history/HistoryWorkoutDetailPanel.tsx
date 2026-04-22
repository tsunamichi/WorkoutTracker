import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';
import type { WorkoutHistoryEntry } from '../../types/workoutHistory';
import { SPACING, TYPOGRAPHY } from '../../constants';
import { COMPLETED_EXERCISE_LIST_LAYOUT, EXPLORE_V2 } from '../exploreV2/exploreV2Tokens';
import { useAppTheme } from '../../theme/useAppTheme';
import { textMetaForHistoryWorkoutDetailExerciseDivider } from './historyTextMetaDerive';
import { useStore } from '../../store';

const L = COMPLETED_EXERCISE_LIST_LAYOUT;

const ROW_STAGGER_MS = 42;
const ROW_ANIM_MS = 240;
const ROW_SLIDE_PX = 14;
const ROW_EASING = Easing.out(Easing.cubic);

function hasPositiveDisplayWeight(weightStr: string): boolean {
  const n = parseFloat(String(weightStr).replace(/,/g, ''));
  return !Number.isNaN(n) && n > 0;
}

export type HistoryWorkoutDetailPanelProps = {
  entry: WorkoutHistoryEntry | null;
  /** e.g. "April 2nd" */
  selectedDateLabel: string;
};

type RowAnim = { opacity: Animated.Value; translateY: Animated.Value };

export function HistoryWorkoutDetailPanel({ entry, selectedDateLabel }: HistoryWorkoutDetailPanelProps) {
  const { colors: themeColors } = useAppTheme();
  const useKg = useStore(s => s.settings?.useKg ?? false);
  const weightUnitLabel = useKg ? 'kg' : 'lbs';
  const titleInk = themeColors.containerPrimary;
  const unitInk = themeColors.textMeta;
  const exerciseRowDividerColor = textMetaForHistoryWorkoutDetailExerciseDivider(themeColors.textMeta);

  const selectionKey = `${selectedDateLabel}|${entry?.id ?? 'none'}`;

  const exerciseRowAnims = useMemo((): RowAnim[] => {
    if (!entry) return [];
    return entry.exercises.map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(ROW_SLIDE_PX),
    }));
  }, [selectionKey, entry?.exercises.length]);

  useEffect(() => {
    if (!entry || exerciseRowAnims.length === 0) {
      return;
    }
    exerciseRowAnims.forEach(a => {
      a.opacity.setValue(0);
      a.translateY.setValue(ROW_SLIDE_PX);
    });

    const rowAnimations = exerciseRowAnims.map(a =>
      Animated.parallel([
        Animated.timing(a.opacity, {
          toValue: 1,
          duration: ROW_ANIM_MS,
          easing: ROW_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(a.translateY, {
          toValue: 0,
          duration: ROW_ANIM_MS,
          easing: ROW_EASING,
          useNativeDriver: true,
        }),
      ]),
    );

    const staggered = Animated.stagger(ROW_STAGGER_MS, rowAnimations);
    staggered.start();
    return () => staggered.stop();
  }, [selectionKey, entry, exerciseRowAnims]);

  const title = entry?.workoutName ?? 'No workout logged';

  return (
    <View style={styles.block}>
      {/* e.g. screenshot: workout name "Push" — h2 + `containerPrimary` (same as exercise + values) */}
      <Text style={[styles.workoutName, { color: titleInk }]}>{title}</Text>
      {/* e.g. screenshot: selected log date "April 14th" under the workout name — `textMeta` */}
      <Text style={[styles.dateLine, { color: unitInk }]}>{selectedDateLabel}</Text>

      {entry && entry.exercises.length > 0 ? (
        <>
          <View style={{ height: EXPLORE_V2.headerToContentGap }} />
          {entry.exercises.map((ex, index) => {
            const a = exerciseRowAnims[index];
            if (!a) {
              return null;
            }
            return (
              <Animated.View
                key={`${entry.id}-${index}`}
                style={{
                  opacity: a.opacity,
                  transform: [{ translateY: a.translateY }],
                }}
              >
                <View
                  style={[
                    styles.row,
                    index < entry.exercises.length - 1 && styles.rowWithDivider,
                    index < entry.exercises.length - 1 && { borderBottomColor: exerciseRowDividerColor },
                  ]}
                >
                  <View style={styles.nameCol}>
                    <Text style={[styles.exerciseName, { color: titleInk }]} numberOfLines={2}>
                      {ex.name}
                    </Text>
                  </View>
                  <View style={styles.valCol}>
                    {ex.sets.map((set, si) => (
                      <View
                        key={si}
                        style={[
                          styles.valRow,
                          si < ex.sets.length - 1 && styles.valRowGapAfter,
                        ]}
                      >
                        {hasPositiveDisplayWeight(set.weight) ? (
                          <View style={styles.valWithUnit}>
                            <View style={styles.valueWeightSlot}>
                              <Text
                                style={[styles.val, styles.valueTextRight, { color: titleInk }]}
                                numberOfLines={1}
                              >
                                {set.weight}
                              </Text>
                            </View>
                            <Text style={[styles.valUnit, { color: unitInk }]}>{weightUnitLabel}</Text>
                          </View>
                        ) : null}
                        <View style={styles.valWithUnit}>
                          <View style={styles.valueRepsSlot}>
                            <Text style={[styles.val, styles.valueTextRight, { color: titleInk }]}>
                              {set.reps}
                            </Text>
                          </View>
                          <Text style={[styles.valUnit, { color: unitInk }]}>reps</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </>
      ) : null}
    </View>
  );
}

const metaBase = {
  ...TYPOGRAPHY.meta,
  lineHeight: 20,
  ...(Platform.OS === 'android' ? { includeFontPadding: false as const } : {}),
};

const styles = StyleSheet.create({
  block: {
    paddingTop: SPACING.lg,
  },
  workoutName: {
    ...TYPOGRAPHY.h2,
  },
  dateLine: {
    marginTop: SPACING.xs,
    fontSize: 16,
    fontWeight: '400',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 0,
  },
  rowWithDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    paddingBottom: L.rowDividerPadBottom,
    marginBottom: L.rowDividerMarginBottom,
  },
  nameCol: {
    flex: 1,
    paddingRight: L.nameColPaddingRight,
  },
  exerciseName: {
    ...metaBase,
  },
  valCol: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  valRow: {
    flexDirection: 'row',
    gap: L.valRowGap,
    justifyContent: 'flex-end',
  },
  valRowGapAfter: {
    marginBottom: L.setLogGap,
  },
  valWithUnit: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: L.valWithUnitGap,
  },
  valueWeightSlot: {
    maxWidth: L.weightNumeralMaxWidth,
    minWidth: 0,
  },
  valueRepsSlot: {
    width: L.repsValueWidth,
  },
  valueTextRight: {
    textAlign: 'right',
    width: '100%',
  },
  val: {
    ...metaBase,
    fontVariant: ['tabular-nums'],
  },
  valUnit: {
    ...metaBase,
  },
});
