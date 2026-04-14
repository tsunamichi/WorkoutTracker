import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants';
import { useAppTheme } from '../theme/useAppTheme';
import { BackTextButton } from '../components/common/BackTextButton';
import { FourWeekActivityChart } from '../components/history/FourWeekActivityChart';
import { HistoryWorkoutDetailPanel } from '../components/history/HistoryWorkoutDetailPanel';
import { HISTORY_VISUAL } from '../components/history/historyVisualTokens';
import { useStore } from '../store';
import { buildWorkoutHistoryByDateFromSchedule } from '../utils/buildWorkoutHistoryByDateFromSchedule';
import { pickDefaultHistorySelection } from '../utils/historyDefaultSelection';
import {
  buildSundayFirstFourWeekGrid,
  formatHistorySelectedHeading,
} from '../utils/historyWeekGrid';

export function HistoryScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      <BackTextButton label="Home" chevronPointsLeft onPress={() => navigation.goBack()} textStyle={styles.backText} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + SPACING.xxxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleBlock}>
          <Text style={styles.titlePrimary}>History</Text>
          <Text style={styles.titleSecondary}>Last 4 weeks</Text>
        </View>

        <View style={{ height: SPACING.xxxl }} />

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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HISTORY_VISUAL.canvas,
  },
  backText: {
    color: HISTORY_VISUAL.textGray,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
  },
  titleBlock: {
    marginTop: SPACING.sm,
  },
  /** Match Today schedule header (`scheduleHeaderTitle` / `scheduleHeaderDateLabel`). */
  titlePrimary: {
    ...TYPOGRAPHY.displayLarge,
    color: COLORS.textPrimary,
  },
  titleSecondary: {
    ...TYPOGRAPHY.displayLarge,
    color: COLORS.textMeta,
  },
});
