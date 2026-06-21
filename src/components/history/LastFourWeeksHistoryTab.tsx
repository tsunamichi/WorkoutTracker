import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import dayjs from 'dayjs';
import { SPACING } from '../../constants';
import { useAppTheme } from '../../theme/useAppTheme';
import { TertiaryButton } from '../common/UnderlinedActionButton';
import { FourWeekActivityChart } from './FourWeekActivityChart';
import { HistoryWorkoutDetailPanel } from './HistoryWorkoutDetailPanel';
import { useStore } from '../../store';
import { buildWorkoutHistoryByDateFromSchedule } from '../../utils/buildWorkoutHistoryByDateFromSchedule';
import { pickDefaultHistorySelection } from '../../utils/historyDefaultSelection';
import {
  buildSundayFirstFourWeekGrid,
  formatHistorySelectedHeading,
} from '../../utils/historyWeekGrid';

type Props = {
  exportHistoryLabel: string;
  onPressExportHistory: () => void;
};

export function LastFourWeeksHistoryTab({ exportHistoryLabel, onPressExportHistory }: Props) {
  const { colors: themeColors } = useAppTheme();
  const scheduledWorkouts = useStore(s => s.scheduledWorkouts);
  const getMainCompletion = useStore(s => s.getMainCompletion);
  const detailedWorkoutProgress = useStore(s => s.detailedWorkoutProgress);
  const exercises = useStore(s => s.exercises);
  const settings = useStore(s => s.settings);

  const reference = useMemo(() => dayjs().startOf('day'), []);
  const rows = useMemo(() => buildSundayFirstFourWeekGrid(reference), [reference]);
  const byDate = useMemo(
    () =>
      buildWorkoutHistoryByDateFromSchedule(
        scheduledWorkouts,
        getMainCompletion,
        detailedWorkoutProgress,
        exercises,
        settings?.useKg ?? false,
      ),
    [scheduledWorkouts, getMainCompletion, detailedWorkoutProgress, exercises, settings?.useKg],
  );
  const completedIsoSet = useMemo(() => new Set(byDate.keys()), [byDate]);

  const [selectedIso, setSelectedIso] = useState(() =>
    pickDefaultHistorySelection(rows, completedIsoSet, reference),
  );

  const selectedEntry = byDate.get(selectedIso) ?? null;
  const selectedHeading = formatHistorySelectedHeading(selectedIso);
  const todayIso = reference.format('YYYY-MM-DD');

  const onSelectIso = useCallback((iso: string) => {
    setSelectedIso(iso);
  }, []);

  return (
    <View>
      <FourWeekActivityChart
        rows={rows}
        selectedIso={selectedIso}
        completedIsoSet={completedIsoSet}
        todayIso={todayIso}
        onSelectIso={onSelectIso}
        completedWorkoutColor={themeColors.containerPrimary}
        emptyDayFill={themeColors.containerSecondary}
      />

      <View style={{ height: SPACING.xxxl + SPACING.md }} />

      <HistoryWorkoutDetailPanel entry={selectedEntry} selectedDateLabel={selectedHeading} />

      <TertiaryButton
        label={exportHistoryLabel}
        onPress={onPressExportHistory}
        style={styles.exportLink}
        color={themeColors.textMeta}
        underlineColor={themeColors.textMeta}
        textStyle={styles.exportLinkText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  exportLink: {
    alignSelf: 'flex-start',
    marginTop: SPACING.xxxl,
    paddingTop: 8,
    paddingBottom: 2,
  },
  exportLinkText: {
    fontWeight: '400',
  },
});
