import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useStore } from '../../store';
import { SPACING, TYPOGRAPHY } from '../../constants';
import { useAppTheme } from '../../theme/useAppTheme';
import { useTranslation } from '../../i18n/useTranslation';
import { buildExerciseWeightProgressRows } from '../../utils/buildExerciseWeightProgressRows';
import { sortExerciseWeightProgressRows } from '../../utils/sortExerciseWeightProgressRows';
import { DraggableWeightProgressList } from './DraggableWeightProgressList';
import type { ExerciseWeightProgressRow } from '../../types/exerciseWeightProgress';

type Props = {
  onScrollEnabledChange?: (enabled: boolean) => void;
  contentPaddingBottom: number;
  horizontalPadding: number;
  listScrollEnabled?: boolean;
};

export function WeightProgressTab({
  onScrollEnabledChange,
  contentPaddingBottom,
  horizontalPadding,
  listScrollEnabled = true,
}: Props) {
  const { colors: themeColors } = useAppTheme();
  const { t } = useTranslation();
  const scheduledWorkouts = useStore(s => s.scheduledWorkouts);
  const detailedWorkoutProgress = useStore(s => s.detailedWorkoutProgress);
  const sessions = useStore(s => s.sessions);
  const exercises = useStore(s => s.exercises);
  const pinnedKeyLifts = useStore(s => s.pinnedKeyLifts);
  const settings = useStore(s => s.settings);
  const updateSettings = useStore(s => s.updateSettings);

  const useKg = settings.useKg ?? false;
  const weightUnitLabel = useKg ? t('kg') : t('lb');

  const derivedRows = useMemo(
    () =>
      buildExerciseWeightProgressRows({
        detailedWorkoutProgress,
        scheduledWorkouts,
        sessions,
        exercises,
        pinnedKeyLifts,
      }),
    [detailedWorkoutProgress, scheduledWorkouts, sessions, exercises, pinnedKeyLifts],
  );

  const sortedRows = useMemo(
    () => sortExerciseWeightProgressRows(derivedRows, settings.historyExerciseOrder),
    [derivedRows, settings.historyExerciseOrder],
  );

  const handleReorder = useCallback(
    (reordered: ExerciseWeightProgressRow[]) => {
      void updateSettings({ historyExerciseOrder: reordered.map(r => r.exerciseId) });
    },
    [updateSettings],
  );

  if (sortedRows.length === 0) {
    return (
      <View style={[styles.empty, { paddingHorizontal: horizontalPadding }]}>
        <Text style={[styles.emptyText, { color: themeColors.textMeta }]}>
          {t('historyWeightProgressEmpty')}
        </Text>
      </View>
    );
  }

  return (
    <DraggableWeightProgressList
      rows={sortedRows}
      useKg={useKg}
      onReorder={handleReorder}
      mainLiftBadgeLabel={t('historyMainLiftBadge')}
      weightUnitLabel={weightUnitLabel}
      onScrollEnabledChange={onScrollEnabledChange}
      scrollEnabled={listScrollEnabled}
      contentContainerStyle={{
        paddingHorizontal: horizontalPadding,
        paddingBottom: contentPaddingBottom,
      }}
    />
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    paddingVertical: SPACING.xxxl,
    paddingHorizontal: SPACING.lg,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    textAlign: 'center',
  },
});
