import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import type { WorkoutHistoryEntry } from '../../types/workoutHistory';
import { SPACING } from '../../constants';
import { HISTORY_VISUAL } from './historyVisualTokens';

const ROW_STAGGER_MS = 42;
const ROW_ANIM_MS = 240;
const ROW_SLIDE_PX = 14;
const ROW_EASING = Easing.out(Easing.cubic);

export type HistoryWorkoutDetailPanelProps = {
  entry: WorkoutHistoryEntry | null;
  /** e.g. "April 2nd" */
  selectedDateLabel: string;
};

type RowAnim = { opacity: Animated.Value; translateY: Animated.Value };

export function HistoryWorkoutDetailPanel({ entry, selectedDateLabel }: HistoryWorkoutDetailPanelProps) {
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
      <Text style={styles.workoutName}>{title}</Text>
      <Text style={styles.dateLine}>{selectedDateLabel}</Text>

      {entry && entry.exercises.length > 0 ? (
        <>
          <View style={{ height: SPACING.xl }} />
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
                <View style={styles.exerciseRow}>
                  <Text style={styles.exerciseName} numberOfLines={2}>
                    {ex.name}
                  </Text>
                  <View style={styles.setsCol}>
                    {ex.sets.map((set, si) => (
                      <View key={si} style={styles.setLine}>
                        <Text style={styles.setLineInner}>
                          <Text style={styles.setValue}>{set.weight}</Text>
                          <Text style={styles.setUnit}> lbs</Text>
                          <Text style={styles.setSep}> </Text>
                          <Text style={styles.setValue}>{set.reps}</Text>
                          <Text style={styles.setUnit}> reps</Text>
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
                {index < entry.exercises.length - 1 ? <View style={styles.divider} /> : null}
              </Animated.View>
            );
          })}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingTop: SPACING.lg,
  },
  workoutName: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '600',
    color: HISTORY_VISUAL.forest,
    letterSpacing: -0.3,
  },
  dateLine: {
    marginTop: SPACING.xs,
    fontSize: 16,
    fontWeight: '400',
    color: HISTORY_VISUAL.textGray,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    gap: SPACING.lg,
  },
  exerciseName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: HISTORY_VISUAL.titleInk,
    paddingRight: SPACING.md,
  },
  setsCol: {
    alignItems: 'flex-end',
  },
  setLine: {
    marginBottom: 4,
  },
  setLineInner: {
    textAlign: 'right',
  },
  setValue: {
    fontSize: 15,
    fontWeight: '600',
    color: HISTORY_VISUAL.textGray,
  },
  setUnit: {
    fontSize: 13,
    fontWeight: '400',
    color: HISTORY_VISUAL.textGraySoft,
  },
  setSep: {
    fontSize: 15,
    color: HISTORY_VISUAL.textGray,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: HISTORY_VISUAL.divider,
  },
});
