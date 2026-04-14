import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';
import { SPACING } from '../constants';
import { useAppTheme } from '../theme/useAppTheme';
import { BackTextButton } from '../components/common/BackTextButton';
import { FourWeekActivityChart } from '../components/history/FourWeekActivityChart';
import { HistoryWorkoutDetailPanel } from '../components/history/HistoryWorkoutDetailPanel';
import { HISTORY_VISUAL } from '../components/history/historyVisualTokens';
import { buildMockWorkoutHistoryByDate } from '../data/mockWorkoutHistory';
import { pickDefaultHistorySelection } from '../utils/historyDefaultSelection';
import {
  buildSundayFirstFourWeekGrid,
  formatHistorySelectedHeading,
} from '../utils/historyWeekGrid';

export function HistoryScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useAppTheme();

  const reference = useMemo(() => dayjs().startOf('day'), []);
  const rows = useMemo(() => buildSundayFirstFourWeekGrid(reference), [reference]);
  const byDate = useMemo(() => buildMockWorkoutHistoryByDate(reference), [reference]);
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
  titlePrimary: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '600',
    color: HISTORY_VISUAL.titleInk,
    letterSpacing: -0.6,
  },
  titleSecondary: {
    marginTop: SPACING.xs,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '600',
    color: HISTORY_VISUAL.forest,
    letterSpacing: -0.6,
  },
});
