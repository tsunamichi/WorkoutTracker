import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants';
import { useStore } from '../store';
import { formatWeightForLoad } from '../utils/weight';
import { TertiaryButton } from '../components/common/UnderlinedActionButton';
import { CycleControlSheet } from '../components/CycleControlSheet';
import { ShareCycleDrawer } from '../components/ShareCycleDrawer';

type RouteParams = {
  CycleProgress: { planId?: string; asOfDate?: string } | undefined;
};

type TimelineRowType = 'completed' | 'rest' | 'available';

type CycleTimelineItem = {
  id: string;
  dateLabel: string;
  label: string;
  type: TimelineRowType;
};

type CycleProgressViewModel = {
  cycleTitle: string;
  completedCount: number;
  totalCount: number;
  weekLabel: string;
  timeline: CycleTimelineItem[];
  remaining: string[];
};

const SAMPLE_MODEL: CycleProgressViewModel = {
  cycleTitle: 'Cycle Progress',
  completedCount: 3,
  totalCount: 5,
  weekLabel: 'WEEK 1',
  timeline: [
    { id: 'mon-25', dateLabel: 'Mon 25th', label: 'Upper Push', type: 'completed' },
    { id: 'tue-26', dateLabel: 'Tue 26th', label: 'Lower Hinge', type: 'completed' },
    { id: 'wed-27', dateLabel: 'Wed 27th', label: 'Rest', type: 'rest' },
    { id: 'thu-28', dateLabel: 'Thu 28th', label: 'Upper Push', type: 'completed' },
    { id: 'fri-29', dateLabel: 'Fri 29th', label: 'Available today', type: 'available' },
  ],
  remaining: ['Lower Quads', 'Upper Pull', 'Upper Pump'],
};

function formatDateWithOrdinal(d: dayjs.Dayjs): string {
  const day = d.date();
  const mod100 = day % 100;
  let suffix = 'th';
  if (mod100 < 11 || mod100 > 13) {
    const mod10 = day % 10;
    if (mod10 === 1) suffix = 'st';
    else if (mod10 === 2) suffix = 'nd';
    else if (mod10 === 3) suffix = 'rd';
  }
  return `${d.format('ddd')} ${day}${suffix}`;
}

function isWorkoutFinished(
  sw: { status: string; isLocked: boolean; id: string },
  getMainCompletion: (workoutKey: string) => { percentage: number },
) {
  const completion = getMainCompletion(sw.id);
  return sw.isLocked || sw.status === 'completed' || completion.percentage === 100;
}

function hasWorkoutLogs(sw: any) {
  const main = Object.values(sw.workoutCompletion?.completedSets ?? {}).reduce(
    (sum, sets) => sum + ((sets as number[])?.length ?? 0),
    0,
  );
  const warmup = sw.warmupCompletion?.completedItems?.length ?? 0;
  const accessory = sw.accessoryCompletion?.completedItems?.length ?? 0;
  return main > 0 || warmup > 0 || accessory > 0;
}

function getWorkoutDisplayDate(sw: any) {
  if (sw.status === 'completed' && sw.completedAt) {
    return dayjs(sw.completedAt).format('YYYY-MM-DD');
  }
  if (sw.status === 'in_progress' && hasWorkoutLogs(sw) && sw.startedAt) {
    return dayjs(sw.startedAt).format('YYYY-MM-DD');
  }
  return sw.date;
}

function buildViewModel(params: {
  plan: any;
  asOfDate: string;
  scheduledWorkouts: any[];
  getMainCompletion: (workoutKey: string) => { percentage: number };
  getCyclePlanWeekProgress: (planId: string, asOfDate: string) => { currentWeek: number; totalWeeks: number } | null;
}): CycleProgressViewModel {
  const { plan, asOfDate, scheduledWorkouts, getMainCompletion, getCyclePlanWeekProgress } = params;

  const planWorkouts = scheduledWorkouts
    .filter(
      sw =>
        sw.source === 'cycle' &&
        (sw.programId === plan.id || sw.cyclePlanId === plan.id),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  if (planWorkouts.length === 0) return SAMPLE_MODEL;

  const weekProgress = getCyclePlanWeekProgress(plan.id, asOfDate);
  const currentWeek = weekProgress?.currentWeek ?? 1;
  const weekLabel = `WEEK ${currentWeek}`;
  const weekStart = dayjs(plan.startDate).add(currentWeek - 1, 'week');
  const weekEnd = weekStart.add(6, 'day');
  const asOf = dayjs(asOfDate);
  const todayIso = dayjs().format('YYYY-MM-DD');
  const timelineEnd = asOf.isAfter(weekEnd, 'day') ? weekEnd : asOf;
  const dayCount = Math.max(1, timelineEnd.diff(weekStart, 'day') + 1);

  const completedByDisplayDate = new Map<string, any>();
  const completedByScheduledDate = new Map<string, any>();
  for (const sw of planWorkouts) {
    if (!isWorkoutFinished(sw, getMainCompletion)) continue;
    const displayDate = getWorkoutDisplayDate(sw);
    if (!completedByDisplayDate.has(displayDate)) {
      completedByDisplayDate.set(displayDate, sw);
    }
    if (!completedByScheduledDate.has(sw.date)) {
      completedByScheduledDate.set(sw.date, sw);
    }
  }
  const unfinishedByDisplayDate = new Map<string, any[]>();
  for (const sw of planWorkouts) {
    if (isWorkoutFinished(sw, getMainCompletion)) continue;
    const key = getWorkoutDisplayDate(sw);
    const list = unfinishedByDisplayDate.get(key) ?? [];
    list.push(sw);
    unfinishedByDisplayDate.set(key, list);
  }
  const timeline: CycleTimelineItem[] = [];
  for (let i = 0; i < dayCount; i += 1) {
    const d = weekStart.add(i, 'day');
    const iso = d.format('YYYY-MM-DD');
    const completedWorkout = completedByDisplayDate.get(iso) ?? completedByScheduledDate.get(iso);
    if (completedWorkout) {
      timeline.push({
        id: completedWorkout.id,
        dateLabel: formatDateWithOrdinal(d),
        label: completedWorkout.titleSnapshot,
        type: 'completed',
      });
      continue;
    }
    const unfinishedForDay = unfinishedByDisplayDate.get(iso) ?? [];
    if (iso === todayIso && unfinishedForDay.length > 0) {
      timeline.push({
        id: `available-${iso}`,
        dateLabel: formatDateWithOrdinal(d),
        label: 'Available today',
        type: 'available',
      });
      continue;
    }
    timeline.push({
      id: `rest-${iso}`,
      dateLabel: formatDateWithOrdinal(d),
      label: 'Rest',
      type: 'rest',
    });
  }

  const completedCount = planWorkouts.filter(sw => isWorkoutFinished(sw, getMainCompletion)).length;
  const totalCount = planWorkouts.length;
  const remainingOpen = planWorkouts
    .filter(sw => !isWorkoutFinished(sw, getMainCompletion))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const selectedDayPriority = remainingOpen.filter(sw => getWorkoutDisplayDate(sw) === asOfDate);
  const selectedIds = new Set(selectedDayPriority.map(sw => sw.id));
  const alignedQueue = [
    ...selectedDayPriority,
    ...remainingOpen.filter(sw => !selectedIds.has(sw.id)),
  ];
  const remaining = alignedQueue
    .map(sw => sw.titleSnapshot);

  return {
    cycleTitle: 'Cycle Progress',
    completedCount,
    totalCount,
    weekLabel,
    timeline: timeline.length > 0 ? timeline : SAMPLE_MODEL.timeline,
    remaining: remaining.length > 0 ? remaining : SAMPLE_MODEL.remaining,
  };
}

function CycleProgressDots({ completedCount, totalCount }: { completedCount: number; totalCount: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: Math.max(0, totalCount) }).map((_, i) => (
        <View
          key={`dot-${i}`}
          style={[styles.dot, i < completedCount ? styles.dotCompleted : styles.dotRemaining]}
        />
      ))}
    </View>
  );
}

function CycleProgressHeader({
  cycleTitle,
  completedCount,
  totalCount,
}: {
  cycleTitle: string;
  completedCount: number;
  totalCount: number;
}) {
  return (
    <View style={styles.headerBlock}>
      <Text style={styles.contextTitle}>{cycleTitle}</Text>
      <Text style={styles.heroTitle}>{`${completedCount} of ${totalCount} completed`}</Text>
      <CycleProgressDots completedCount={completedCount} totalCount={totalCount} />
    </View>
  );
}

function CycleTimelineRow({ item }: { item: CycleTimelineItem }) {
  return (
    <View style={styles.timelineRow}>
      <Text style={styles.timelineDate}>{item.dateLabel}</Text>
      <Text
        style={[
          styles.timelineLabel,
          item.type === 'completed' && styles.timelineLabelCompleted,
          item.type === 'rest' && styles.timelineLabelMuted,
          item.type === 'available' && styles.timelineLabelMuted,
        ]}
      >
        {item.label}
      </Text>
    </View>
  );
}

function CycleTimeline({ weekLabel, timeline }: { weekLabel: string; timeline: CycleTimelineItem[] }) {
  return (
    <View style={styles.timelineSection}>
      <Text style={styles.weekLabel}>{weekLabel}</Text>
      {timeline.map(item => (
        <CycleTimelineRow key={item.id} item={item} />
      ))}
    </View>
  );
}

function RemainingWorkoutList({ items }: { items: string[] }) {
  return (
    <View style={styles.remainingSection}>
      {items.map((name, index) => (
        <Text key={`${name}-${index}`} style={styles.remainingItem}>
          {name}
        </Text>
      ))}
    </View>
  );
}

export function CycleProgressScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'CycleProgress'>>();
  const {
    cyclePlans,
    scheduledWorkouts,
    getActiveCyclePlan,
    getCyclePlanWeekProgress,
    getCyclePlanEffectiveEndDate,
    getMainCompletion,
    pauseShiftCyclePlan,
    endCyclePlan,
    deleteCyclePlanCompletely,
    updateCyclePlan,
    exercises,
    detailedWorkoutProgress,
    settings,
  } = useStore();
  const [showCycleSheet, setShowCycleSheet] = useState(false);
  const [showShareCycleSheet, setShowShareCycleSheet] = useState(false);
  const [shareCyclePlan, setShareCyclePlan] = useState<any | undefined>(undefined);
  const asOfDate = route.params?.asOfDate ?? dayjs().format('YYYY-MM-DD');

  const plan = useMemo(() => {
    if (route.params?.planId) {
      const byRoute = cyclePlans.find(p => p.id === route.params?.planId);
      if (byRoute) return byRoute;
    }
    return getActiveCyclePlan() ?? cyclePlans[0];
  }, [cyclePlans, getActiveCyclePlan, route.params?.planId]);

  const viewModel = useMemo(() => {
    if (!plan) return SAMPLE_MODEL;
    return buildViewModel({
      plan,
      asOfDate,
      scheduledWorkouts,
      getMainCompletion,
      getCyclePlanWeekProgress,
    });
  }, [asOfDate, getCyclePlanWeekProgress, getMainCompletion, plan, scheduledWorkouts]);

  const cycleState: 'active' | 'paused' | 'finished' | 'none' = useMemo(() => {
    if (!plan) return 'none';
    if (plan.active) {
      const isPlanPaused = !!plan.pausedUntil && dayjs(plan.pausedUntil).isAfter(dayjs(), 'day');
      return isPlanPaused ? 'paused' : 'active';
    }
    return 'finished';
  }, [plan]);

  const weekProgress = useMemo(() => {
    if (!plan) return null;
    return getCyclePlanWeekProgress(plan.id, asOfDate);
  }, [asOfDate, getCyclePlanWeekProgress, plan]);

  const effectiveEndDate = useMemo(() => {
    if (!plan) return undefined;
    return getCyclePlanEffectiveEndDate(plan);
  }, [getCyclePlanEffectiveEndDate, plan]);

  const handleExportData = useCallback(
    async (targetPlan: any) => {
      const cycleId = targetPlan.id;
      const cycleWorkouts = scheduledWorkouts
        .filter(sw => sw.programId === cycleId || sw.cyclePlanId === cycleId)
        .sort((a, b) => a.date.localeCompare(b.date));
      const startDate = dayjs(targetPlan.startDate);
      const endDate = targetPlan.endedAt
        ? dayjs(targetPlan.endedAt)
        : cycleWorkouts.length > 0
          ? dayjs(cycleWorkouts[cycleWorkouts.length - 1].date)
          : dayjs(targetPlan.startDate).add(targetPlan.weeks, 'week').subtract(1, 'day');
      const weekGroups: { weekNumber: number; weekStart: string; weekEnd: string; workouts: any[] }[] = [];
      for (let w = 0; w < targetPlan.weeks; w += 1) {
        const ws = startDate.add(w, 'week');
        const we = ws.add(6, 'day');
        const weekWorkouts = cycleWorkouts.filter(
          sw => sw.date >= ws.format('YYYY-MM-DD') && sw.date <= we.format('YYYY-MM-DD'),
        );
        if (weekWorkouts.length > 0) {
          weekGroups.push({
            weekNumber: w + 1,
            weekStart: ws.format('MMM D'),
            weekEnd: we.format('MMM D'),
            workouts: weekWorkouts,
          });
        }
      }
      const useKg = settings?.useKg ?? false;
      const weightUnit = useKg ? 'kg' : 'lb';
      const getExerciseProgressForWorkout = (sw: any, templateItemId: string, exerciseId: string) => {
        const keyByScheduleId = detailedWorkoutProgress[sw.id];
        const keyByTemplateDate = detailedWorkoutProgress[`${sw.templateId}-${sw.date}`];
        const progress = keyByScheduleId ?? keyByTemplateDate;
        const exerciseProgress = progress?.exercises?.[templateItemId] ?? progress?.exercises?.[exerciseId];
        return exerciseProgress ?? null;
      };
      let exportText = `${targetPlan.name}\n`;
      exportText += `Period: ${dayjs(targetPlan.startDate).format('MMM D, YYYY')} - ${endDate.format('MMM D, YYYY')}\n\n`;
      for (const group of weekGroups) {
        exportText += `WEEK ${group.weekNumber} (${group.weekStart} - ${group.weekEnd})\n`;
        exportText += `${'-'.repeat(40)}\n`;
        for (const sw of group.workouts) {
          exportText += `\n  ${sw.titleSnapshot} — ${dayjs(sw.date).format('ddd, MMM D')}\n`;
          for (const ex of sw.exercisesSnapshot || []) {
            const exerciseData = exercises.find(e => e.id === ex.exerciseId);
            const progress = getExerciseProgressForWorkout(sw, ex.id, ex.exerciseId);
            const isTimeBased = ex.isTimeBased === true;
            const repUnit = isTimeBased ? 'sec' : 'reps';
            exportText += `    ${exerciseData?.name || 'Unknown'}\n`;
            if (progress?.sets && progress.sets.length > 0) {
              progress.sets.forEach((set: any, idx: number) => {
                const value = set.reps ?? 0;
                exportText += `      Set ${idx + 1}: ${formatWeightForLoad(set.weight ?? 0, useKg)} ${weightUnit} × ${value} ${repUnit}${set.completed ? ' ✓' : ''}\n`;
              });
            } else {
              exportText += '      No logged data\n';
            }
          }
        }
        exportText += '\n';
      }
      try {
        await Share.share({ message: exportText, title: targetPlan.name });
      } catch (_error) {
        Alert.alert('Error', 'Failed to export data');
      }
    },
    [detailedWorkoutProgress, exercises, scheduledWorkouts, settings],
  );

  return (
    <View style={[styles.gradient, { backgroundColor: COLORS.canvasLight, paddingTop: insets.top }]}>
      <SafeAreaView style={styles.container} edges={[]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
          activeOpacity={0.8}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹ Schedule</Text>
        </TouchableOpacity>
        {plan ? (
          <View style={styles.optionsButtonWrap}>
            <TertiaryButton
              label="Options"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowCycleSheet(true);
              }}
            />
          </View>
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + SPACING.xxxl }]}
          showsVerticalScrollIndicator={false}
        >
          <CycleProgressHeader
            cycleTitle={viewModel.cycleTitle}
            completedCount={viewModel.completedCount}
            totalCount={viewModel.totalCount}
          />
          <CycleTimeline weekLabel={viewModel.weekLabel} timeline={viewModel.timeline} />
          <RemainingWorkoutList items={viewModel.remaining} />
        </ScrollView>
      </SafeAreaView>

      <CycleControlSheet
        visible={showCycleSheet}
        onClose={() => setShowCycleSheet(false)}
        cycleState={cycleState}
        plan={plan}
        weekProgress={weekProgress}
        effectiveEndDate={effectiveEndDate}
        onPause={async (resumeDateStr: string) => {
          if (!plan) return;
          const result = await pauseShiftCyclePlan(plan.id, resumeDateStr);
          if (!result.success && result.conflicts && result.conflicts.length > 0) {
            const latestPlan = cyclePlans.find(p => p.id === plan.id);
            (navigation as any).navigate('CycleConflicts', {
              planId: plan.id,
              plan: latestPlan,
              conflicts: result.conflicts,
              fromPauseShift: true,
              resumeDate: resumeDateStr,
            });
          }
        }}
        onResume={async () => {
          if (!plan) return;
          await updateCyclePlan(plan.id, { pausedUntil: undefined });
        }}
        onEnd={() => {
          if (!plan) return;
          endCyclePlan(plan.id);
        }}
        onDelete={() => {
          if (!plan) return;
          deleteCyclePlanCompletely(plan.id);
          navigation.goBack();
        }}
        onShare={targetPlan => {
          setShowCycleSheet(false);
          setShareCyclePlan(targetPlan);
          setShowShareCycleSheet(true);
        }}
        onExportData={handleExportData}
        onStartCycle={() => {}}
      />

      <ShareCycleDrawer
        visible={showShareCycleSheet}
        onClose={() => {
          setShowShareCycleSheet(false);
          setShareCyclePlan(undefined);
        }}
        plan={shareCyclePlan}
        onExportData={handleExportData}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  backText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  optionsButtonWrap: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.xxl,
    zIndex: 10,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
  },
  headerBlock: {
    marginBottom: SPACING.xxxl,
  },
  contextTitle: {
    ...TYPOGRAPHY.displayLarge,
    color: COLORS.textMeta,
  },
  heroTitle: {
    ...TYPOGRAPHY.displayLarge,
    color: COLORS.containerPrimary,
    marginTop: SPACING.xs,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.md,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotCompleted: {
    backgroundColor: COLORS.containerPrimary,
  },
  dotRemaining: {
    backgroundColor: COLORS.border,
  },
  timelineSection: {
    marginTop: SPACING.sm,
  },
  weekLabel: {
    ...TYPOGRAPHY.legal,
    color: COLORS.textMeta,
    textTransform: 'uppercase',
    marginBottom: SPACING.lg,
  },
  timelineRow: {
    marginBottom: SPACING.xxl,
  },
  timelineDate: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textMeta,
  },
  timelineLabel: {
    ...TYPOGRAPHY.h2,
    marginTop: 2,
    color: COLORS.containerPrimary,
  },
  timelineLabelCompleted: {
    color: COLORS.containerPrimary,
  },
  timelineLabelMuted: {
    color: COLORS.textMeta,
  },
  remainingSection: {
    marginTop: SPACING.xxxl + SPACING.xl,
    gap: SPACING.md,
  },
  remainingItem: {
    ...TYPOGRAPHY.h2,
    color: COLORS.containerPrimary,
  },
});
