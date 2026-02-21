import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconArrowLeft, IconPR } from '../components/icons';
import { Sparkline } from '../components/common/Sparkline';
import { formatWeight } from '../utils/weight';
import { useTranslation } from '../i18n/useTranslation';

interface SessionEntry {
  date: string;
  topWeight: number;
  topReps: number;
  sets: number;
  isPR: boolean;
}

export function LiftHistoryScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { exerciseId, exerciseName } = route.params;
  const { sessions, exercisePRs, settings } = useStore();
  const { t } = useTranslation();
  const useKg = settings.useKg;

  const pr = useMemo(() =>
    exercisePRs.find((p: any) => p.exerciseId === exerciseId),
    [exercisePRs, exerciseId]
  );

  const history = useMemo((): SessionEntry[] => {
    const entries: SessionEntry[] = [];
    const sortedSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date));

    for (const session of sortedSessions) {
      if (!session.sets) continue;
      const exerciseSets = session.sets.filter(
        (s: any) => s.exerciseId === exerciseId && s.isCompleted && s.weight > 0
      );
      if (exerciseSets.length === 0) continue;

      const topSet = exerciseSets.reduce(
        (best: any, set: any) => (set.weight > best.weight ? set : best),
        exerciseSets[0]
      );

      entries.push({
        date: session.date,
        topWeight: topSet.weight,
        topReps: topSet.reps,
        sets: exerciseSets.length,
        isPR: pr ? topSet.weight >= pr.weight && session.date === pr.date : false,
      });
    }

    return entries;
  }, [sessions, exerciseId, pr]);

  const chartData = useMemo(() =>
    [...history].reverse().map(e => e.topWeight),
    [history]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={1}>
          <IconArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{exerciseName}</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Chart */}
      {chartData.length >= 2 && (
        <View style={styles.chartContainer}>
          <Sparkline
            data={chartData}
            width={SCREEN_WIDTH - SPACING.xxl * 2}
            height={120}
            color={COLORS.accentPrimary}
            strokeWidth={2}
          />
        </View>
      )}

      {/* PR Banner */}
      {pr && (
        <View style={styles.prBanner}>
          <IconPR size={16} color={COLORS.accentPrimary} />
          <Text style={styles.prBannerText}>
            PR: {formatWeight(pr.weight, useKg)} {useKg ? 'kg' : 'lb'} × {pr.reps} · {dayjs(pr.date).format('MMM D')}
          </Text>
        </View>
      )}

      {/* Session list */}
      <FlatList
        data={history}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No sessions yet for this exercise</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.sessionRow}>
            <View style={styles.sessionLeft}>
              <Text style={styles.sessionDate}>{dayjs(item.date).format('MMM D, YYYY')}</Text>
              <Text style={styles.sessionSets}>{item.sets} {item.sets === 1 ? 'set' : 'sets'}</Text>
            </View>
            <View style={styles.sessionRight}>
              <View style={styles.sessionWeightRow}>
                <Text style={styles.sessionWeight}>
                  {formatWeight(item.topWeight, useKg)} {useKg ? 'kg' : 'lb'} × {item.topReps}
                </Text>
                {item.isPR && <IconPR size={12} color={COLORS.accentPrimary} />}
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const SCREEN_WIDTH = Dimensions.get('window').width;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  header: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -4,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    flex: 1,
    textAlign: 'center',
  },
  chartContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  prBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.xxl,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.accentPrimaryDimmed,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  prBannerText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
  },
  listContent: {
    paddingHorizontal: SPACING.xxl,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDimmed,
  },
  sessionLeft: {
    flex: 1,
  },
  sessionDate: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  sessionSets: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginTop: 2,
  },
  sessionRight: {
    alignItems: 'flex-end',
  },
  sessionWeightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sessionWeight: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
  },
  emptyState: {
    paddingTop: 80,
    alignItems: 'center',
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
});
