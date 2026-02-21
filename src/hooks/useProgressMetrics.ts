import { useMemo } from 'react';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { useStore } from '../store';
import type { ExercisePR } from '../types';
import type { CyclePlan, ScheduledWorkout } from '../types/training';

dayjs.extend(isoWeek);

// ─── Types ───────────────────────────────────────────────────────────

export interface KeyLift {
  exerciseId: string;
  exerciseName: string;
  latestWeight: number;
  latestReps: number;
  previousWeight: number;
  deltaPercent: number | null;
  occurrences: number;
  pr: ExercisePR | undefined;
  isPR: boolean;
  sparklineData: number[];
}

export interface CycleSnapshot {
  type: 'cycle';
  cycleName: string;
  currentWeek: number;
  totalWeeks: number;
  workoutsCompleted: number;
  workoutsPlanned: number;
  volumeThisWeek: number;
  volumeWeekOne: number;
  volumeDeltaPercent: number | null;
  completionPercent: number;
  totalVolume: number;
  previousCycleTotalVolume: number | null;
  volumeVsPreviousCyclePercent: number | null;
  primaryLiftName: string | null;
  primaryLiftCurrent: string | null;
  primaryLiftPrevious: string | null;
  bodyweightStart: number | null;
  bodyweightCurrent: number | null;
}

export interface WeeklySnapshot {
  type: 'weekly';
  weekLabel: string;
  workoutsCompleted: number;
  workoutsPlanned: number;
  volumeThisWeek: number;
  volumeLastWeek: number;
  volumeDeltaPercent: number | null;
  topLiftName: string | null;
  topLiftWeight: number;
}

export type HeroData = CycleSnapshot | WeeklySnapshot;

export interface ProgressMetrics {
  hero: HeroData | null;
  keyLifts: KeyLift[];
  recentPRCount: number;
  adherence: { completed: number; planned: number; hasSchedule: boolean };
  hasAnyData: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function getWeekRange(date: dayjs.Dayjs): { start: string; end: string } {
  const start = date.startOf('isoWeek').format('YYYY-MM-DD');
  const end = date.endOf('isoWeek').format('YYYY-MM-DD');
  return { start, end };
}

function getSessionsInRange(sessions: any[], start: string, end: string): any[] {
  return sessions.filter(s => s.date >= start && s.date <= end);
}

function getScheduledInRange(scheduled: ScheduledWorkout[], start: string, end: string): ScheduledWorkout[] {
  return scheduled.filter(sw => sw.date >= start && sw.date <= end);
}

function computeVolume(sessions: any[]): number {
  let volume = 0;
  for (const session of sessions) {
    if (!session.sets) continue;
    for (const set of session.sets) {
      if (set.isCompleted && set.weight > 0 && set.reps > 0) {
        volume += set.weight * set.reps;
      }
    }
  }
  return volume;
}

function volumeDelta(current: number, baseline: number): number | null {
  if (baseline <= 0) return null;
  return Math.round(((current - baseline) / baseline) * 100);
}

function getTopSetWeightPerSession(
  sessions: any[],
  exerciseId: string,
  maxSessions: number
): number[] {
  const topSets: { date: string; weight: number }[] = [];

  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));

  for (const session of sorted) {
    if (!session.sets) continue;
    let maxWeight = 0;
    for (const set of session.sets) {
      if (set.exerciseId === exerciseId && set.isCompleted && set.weight > maxWeight) {
        maxWeight = set.weight;
      }
    }
    if (maxWeight > 0) {
      topSets.push({ date: session.date, weight: maxWeight });
    }
  }

  return topSets.slice(-maxSessions).map(s => s.weight);
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useProgressMetrics(): ProgressMetrics {
  const sessions = useStore(s => s.sessions);
  const scheduledWorkouts = useStore(s => s.scheduledWorkouts);
  const cyclePlans = useStore(s => s.cyclePlans);
  const exercisePRs = useStore(s => s.exercisePRs);
  const exercises = useStore(s => s.exercises);
  const pinnedKeyLifts = useStore(s => s.pinnedKeyLifts);
  const bodyWeightEntries = useStore(s => s.bodyWeightEntries);

  return useMemo(() => {
    const today = dayjs();
    const todayStr = today.format('YYYY-MM-DD');

    // ── Active cycle detection ───────────────────────────────────
    const activeCycle = cyclePlans.find(plan => {
      if (!plan.active) return false;
      const start = dayjs(plan.startDate);
      const end = start.add(plan.weeks * 7, 'day');
      return today.isBefore(end) && !today.isBefore(start);
    });

    // ── Week ranges ──────────────────────────────────────────────
    const thisWeek = getWeekRange(today);
    const lastWeek = getWeekRange(today.subtract(1, 'week'));

    const sessionsThisWeek = getSessionsInRange(sessions, thisWeek.start, thisWeek.end);
    const sessionsLastWeek = getSessionsInRange(sessions, lastWeek.start, lastWeek.end);

    const scheduledThisWeek = getScheduledInRange(scheduledWorkouts, thisWeek.start, thisWeek.end);
    const completedThisWeek = scheduledThisWeek.filter(
      sw => sw.status === 'completed' || sw.isLocked
    );

    const volumeThisWeek = computeVolume(sessionsThisWeek);
    const volumeLastWeek = computeVolume(sessionsLastWeek);

    // ── Hero ─────────────────────────────────────────────────────
    let hero: HeroData | null = null;

    if (activeCycle) {
      const cycleStart = dayjs(activeCycle.startDate);
      const weekNum = Math.floor(today.diff(cycleStart, 'day') / 7) + 1;

      const cycleEnd = cycleStart.add(activeCycle.weeks * 7, 'day').format('YYYY-MM-DD');
      const cycleScheduled = getScheduledInRange(scheduledWorkouts, activeCycle.startDate, cycleEnd);
      const cycleCompleted = cycleScheduled.filter(sw => sw.status === 'completed' || sw.isLocked);

      const week1Range = getWeekRange(cycleStart);
      const sessionsWeek1 = getSessionsInRange(sessions, week1Range.start, week1Range.end);
      const volumeWeekOne = computeVolume(sessionsWeek1);

      // Total cycle volume
      const cycleSessions = getSessionsInRange(sessions, activeCycle.startDate, cycleEnd);
      const totalVolume = computeVolume(cycleSessions);

      // Previous cycle comparison
      const previousCycle = cyclePlans
        .filter(p => !p.active && (p.endedAt || !p.active) && p.startDate < activeCycle.startDate)
        .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] || null;

      let previousCycleTotalVolume: number | null = null;
      let primaryLiftPrevious: string | null = null;

      if (previousCycle) {
        const prevEnd = dayjs(previousCycle.startDate).add(previousCycle.weeks * 7, 'day').format('YYYY-MM-DD');
        const prevSessions = getSessionsInRange(sessions, previousCycle.startDate, prevEnd);
        previousCycleTotalVolume = computeVolume(prevSessions);
      }

      const volumeVsPreviousCyclePercent = previousCycleTotalVolume !== null
        ? volumeDelta(totalVolume, previousCycleTotalVolume)
        : null;

      // Completion percent
      const completionPercent = cycleScheduled.length > 0
        ? Math.round((cycleCompleted.length / cycleScheduled.length) * 100)
        : 0;

      // Primary lift (highest volume in cycle)
      const cycleLiftVolume: Record<string, number> = {};
      for (const session of cycleSessions) {
        if (!session.sets) continue;
        for (const set of session.sets) {
          if (set.isCompleted && set.weight > 0 && set.reps > 0) {
            cycleLiftVolume[set.exerciseId] = (cycleLiftVolume[set.exerciseId] || 0) + set.weight * set.reps;
          }
        }
      }

      let primaryLiftName: string | null = null;
      let primaryLiftCurrent: string | null = null;
      const topLiftId = Object.entries(cycleLiftVolume).sort(([, a], [, b]) => b - a)[0]?.[0];

      if (topLiftId) {
        const ex = exercises.find((e: any) => e.id === topLiftId);
        primaryLiftName = ex?.name || null;

        let bestWeight = 0;
        let bestReps = 0;
        for (const session of cycleSessions) {
          if (!session.sets) continue;
          for (const set of session.sets) {
            if (set.exerciseId === topLiftId && set.isCompleted && set.weight > bestWeight) {
              bestWeight = set.weight;
              bestReps = set.reps;
            }
          }
        }
        if (bestWeight > 0) primaryLiftCurrent = `${bestWeight}×${bestReps}`;

        if (previousCycle) {
          const prevEnd = dayjs(previousCycle.startDate).add(previousCycle.weeks * 7, 'day').format('YYYY-MM-DD');
          const prevSessions = getSessionsInRange(sessions, previousCycle.startDate, prevEnd);
          let prevBestWeight = 0;
          let prevBestReps = 0;
          for (const session of prevSessions) {
            if (!session.sets) continue;
            for (const set of session.sets) {
              if (set.exerciseId === topLiftId && set.isCompleted && set.weight > prevBestWeight) {
                prevBestWeight = set.weight;
                prevBestReps = set.reps;
              }
            }
          }
          if (prevBestWeight > 0) primaryLiftPrevious = `${prevBestWeight}×${prevBestReps}`;
        }
      }

      // Bodyweight in cycle range
      const cycleWeightEntries = bodyWeightEntries.filter(
        (e: any) => e.date >= activeCycle.startDate && e.date <= cycleEnd
      ).sort((a: any, b: any) => a.date.localeCompare(b.date));

      const bodyweightStart = cycleWeightEntries.length > 0 ? cycleWeightEntries[0].weight : null;
      const bodyweightCurrent = cycleWeightEntries.length > 0 ? cycleWeightEntries[cycleWeightEntries.length - 1].weight : null;

      hero = {
        type: 'cycle',
        cycleName: activeCycle.name,
        currentWeek: Math.min(weekNum, activeCycle.weeks),
        totalWeeks: activeCycle.weeks,
        workoutsCompleted: cycleCompleted.length,
        workoutsPlanned: cycleScheduled.length,
        volumeThisWeek,
        volumeWeekOne,
        volumeDeltaPercent: volumeDelta(volumeThisWeek, volumeWeekOne),
        completionPercent,
        totalVolume,
        previousCycleTotalVolume,
        volumeVsPreviousCyclePercent,
        primaryLiftName,
        primaryLiftCurrent,
        primaryLiftPrevious,
        bodyweightStart,
        bodyweightCurrent,
      };
    } else {
      let topLiftName: string | null = null;
      let topLiftWeight = 0;

      for (const session of sessionsThisWeek) {
        if (!session.sets) continue;
        for (const set of session.sets) {
          if (set.isCompleted && set.weight > topLiftWeight) {
            topLiftWeight = set.weight;
            const ex = exercises.find((e: any) => e.id === set.exerciseId);
            topLiftName = ex?.name || null;
          }
        }
      }

      hero = {
        type: 'weekly',
        weekLabel: `${dayjs(thisWeek.start).format('MMM D')} – ${dayjs(thisWeek.end).format('MMM D')}`,
        workoutsCompleted: completedThisWeek.length,
        workoutsPlanned: scheduledThisWeek.length,
        volumeThisWeek,
        volumeLastWeek,
        volumeDeltaPercent: volumeDelta(volumeThisWeek, volumeLastWeek),
        topLiftName,
        topLiftWeight,
      };
    }

    // ── Key Lifts ────────────────────────────────────────────────
    const fourWeeksAgo = today.subtract(4, 'week').format('YYYY-MM-DD');
    const recentSessions = sessions.filter((s: any) => s.date >= fourWeeksAgo);

    const exerciseStats: Record<string, {
      exerciseId: string;
      exerciseName: string;
      totalOccurrences: number;
      lastDate: string;
      weeklyWeights: Record<string, number[]>;
    }> = {};

    for (const session of recentSessions) {
      if (!session.sets) continue;
      const sessionWeekKey = dayjs(session.date).startOf('isoWeek').format('YYYY-MM-DD');

      for (const set of session.sets) {
        if (!set.isCompleted || set.weight <= 0) continue;

        const exId = set.exerciseId;
        if (!exerciseStats[exId]) {
          const ex = exercises.find((e: any) => e.id === exId);
          exerciseStats[exId] = {
            exerciseId: exId,
            exerciseName: ex?.name || 'Unknown',
            totalOccurrences: 0,
            lastDate: session.date,
            weeklyWeights: {},
          };
        }

        const stat = exerciseStats[exId];
        stat.totalOccurrences++;
        if (session.date > stat.lastDate) stat.lastDate = session.date;

        if (!stat.weeklyWeights[sessionWeekKey]) {
          stat.weeklyWeights[sessionWeekKey] = [];
        }
        stat.weeklyWeights[sessionWeekKey].push(set.weight);
      }
    }

    // Rank by frequency, then recency
    const ranked = Object.values(exerciseStats)
      .filter(s => Object.keys(s.weeklyWeights).length >= 2)
      .sort((a, b) => {
        if (b.totalOccurrences !== a.totalOccurrences) return b.totalOccurrences - a.totalOccurrences;
        return b.lastDate.localeCompare(a.lastDate);
      })
      .slice(0, 8);

    const prWindowStart = activeCycle ? activeCycle.startDate : thisWeek.start;

    const buildKeyLift = (stat: typeof ranked[0]): KeyLift => {
      const weekKeys = Object.keys(stat.weeklyWeights).sort();
      const latestWeekKey = weekKeys[weekKeys.length - 1];
      const previousWeekKey = weekKeys.length >= 2 ? weekKeys[weekKeys.length - 2] : null;

      const latestWeights = stat.weeklyWeights[latestWeekKey];
      const latestWeight = Math.max(...latestWeights);

      let previousWeight = 0;
      if (previousWeekKey) {
        const prevWeights = stat.weeklyWeights[previousWeekKey];
        previousWeight = Math.max(...prevWeights);
      }

      const delta = previousWeight > 0
        ? Math.round(((latestWeight - previousWeight) / previousWeight) * 100)
        : null;

      let latestReps = 0;
      for (const session of [...recentSessions].reverse()) {
        if (!session.sets) continue;
        for (const set of session.sets) {
          if (set.exerciseId === stat.exerciseId && set.weight === latestWeight && set.isCompleted) {
            latestReps = set.reps;
            break;
          }
        }
        if (latestReps > 0) break;
      }

      const pr = exercisePRs.find((p: ExercisePR) => p.exerciseId === stat.exerciseId);
      const isPR = pr ? pr.date >= prWindowStart : false;

      const sparklineData = getTopSetWeightPerSession(sessions, stat.exerciseId, 8);

      return {
        exerciseId: stat.exerciseId,
        exerciseName: stat.exerciseName,
        latestWeight,
        latestReps,
        previousWeight,
        deltaPercent: delta,
        occurrences: stat.totalOccurrences,
        pr,
        isPR,
        sparklineData,
      };
    };

    let keyLifts: KeyLift[];

    if (pinnedKeyLifts.length > 0) {
      keyLifts = pinnedKeyLifts
        .map(exId => {
          const stat = exerciseStats[exId];
          if (!stat) {
            const ex = exercises.find((e: any) => e.id === exId);
            return {
              exerciseId: exId,
              exerciseName: ex?.name || 'Unknown',
              latestWeight: 0,
              latestReps: 0,
              previousWeight: 0,
              deltaPercent: null,
              occurrences: 0,
              pr: exercisePRs.find((p: ExercisePR) => p.exerciseId === exId),
              isPR: false,
              sparklineData: getTopSetWeightPerSession(sessions, exId, 8),
            } as KeyLift;
          }
          return buildKeyLift(stat);
        });
    } else {
      keyLifts = ranked.slice(0, 4).map(buildKeyLift);
    }

    // ── Recent PRs count ─────────────────────────────────────────
    const recentPRCount = exercisePRs.filter((pr: ExercisePR) => pr.date >= prWindowStart).length;

    // ── Adherence ────────────────────────────────────────────────
    const scheduledUpToToday = scheduledThisWeek.filter(sw => sw.date <= todayStr);
    const adherence = {
      completed: completedThisWeek.length,
      planned: scheduledUpToToday.length,
      hasSchedule: scheduledThisWeek.length > 0,
    };

    // ── Has any data ─────────────────────────────────────────────
    const hasAnyData = sessions.length > 0;

    return {
      hero: hasAnyData ? hero : null,
      keyLifts,
      recentPRCount,
      adherence,
      hasAnyData,
    };
  }, [sessions, scheduledWorkouts, cyclePlans, exercisePRs, exercises, pinnedKeyLifts, bodyWeightEntries]);
}
