import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { WorkoutHistoryEntry } from '../../types/workoutHistory';
import { SPACING } from '../../constants';
import { HISTORY_VISUAL } from './historyVisualTokens';

export type HistoryWorkoutDetailPanelProps = {
  entry: WorkoutHistoryEntry | null;
  /** e.g. "Sunday 19th" */
  selectedDateLabel: string;
};

export function HistoryWorkoutDetailPanel({ entry, selectedDateLabel }: HistoryWorkoutDetailPanelProps) {
  if (!entry) {
    return (
      <View style={styles.emptyBlock}>
        <Text style={styles.emptyTitle}>No workout logged</Text>
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <Text style={styles.workoutName}>{entry.workoutName}</Text>
      <Text style={styles.dateLine}>{selectedDateLabel}</Text>

      <View style={{ height: SPACING.xl }} />

      {entry.exercises.map((ex, index) => (
        <View key={`${ex.name}-${index}`}>
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
        </View>
      ))}
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
    marginTop: SPACING.sm,
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
  emptyBlock: {
    paddingTop: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: HISTORY_VISUAL.titleInk,
    marginBottom: SPACING.sm,
  },
});
