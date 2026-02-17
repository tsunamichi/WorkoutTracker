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
  deltaPercent: number | null; // null = insufficient data
  occurrences: number;
  pr: ExercisePR | undefined;
  isPR: boolean; // true if current PR was set in the active time window
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

function getSessionsInRange(
  sessions: any[],
  start: string,
  end: string
): any[] {
  return sessions.filter(s => {
    const d = s.date;
    return d >= start && d <= end;
  });
}

function getScheduledInRange(
  scheduled: ScheduledWorkout[],
  start: string,
  end: string
): ScheduledWorkout[] {
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

// ─── Hook ────────────────────────────────────────────────────────────

export function useProgressMetrics(): ProgressMetrics {
  const sessions = useStore(s => s.sessions);
  const scheduledWorkouts = useStore(s => s.scheduledWorkouts);
  const cyclePlans = useStore(s => s.cyclePlans);
  const exercisePRs = useStore(s => s.exercisePRs);
  const exercises = useStore(s => s.exercises);

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
      const currentWeek = Math.min(
        Math.max(1, Math.ceil(today.diff(cycleStart, 'day') / 7) + (today.diff(cycleStart, 'day') % 7 === 0 ? 0 : 0)),
        activeCycle.weeks
      );
      const weekNum = Math.floor(today.diff(cycleStart, 'day') / 7) + 1;

      // Cycle-scoped data
      const cycleEnd = cycleStart.add(activeCycle.weeks * 7, 'day').format('YYYY-MM-DD');
      const cycleScheduled = getScheduledInRange(scheduledWorkouts, activeCycle.startDate, cycleEnd);
      const cycleCompleted = cycleScheduled.filter(sw => sw.status === 'completed' || sw.isLocked);

      // Week 1 volume
      const week1Range = getWeekRange(cycleStart);
      const sessionsWeek1 = getSessionsInRange(sessions, week1Range.start, week1Range.end);
      const volumeWeekOne = computeVolume(sessionsWeek1);

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
      };
    } else {
      // Find top lift of the week
      let topLiftName: string | null = null;
      let topLiftWeight = 0;

      for (const session of sessionsThisWeek) {
        if (!session.sets) continue;
        for (const set of session.sets) {
          if (set.isCompleted && set.weight > topLiftWeight) {
            topLiftWeight = set.weight;
            const ex = exercises.find(e => e.id === set.exerciseId);
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

    // ── Key Lifts (combined with PR data) ────────────────────────
    // Count frequency of exercises in the last 4 weeks
    const fourWeeksAgo = today.subtract(4, 'week').format('YYYY-MM-DD');
    const recentSessions = sessions.filter(s => s.date >= fourWeeksAgo);

    // Build per-exercise stats
    const exerciseStats: Record<string, {
      exerciseId: string;
      exerciseName: string;
      totalOccurrences: number;
      lastDate: string;
      // Weight data bucketed by week
      weeklyWeights: Record<string, number[]>; // weekKey -> weights
    }> = {};

    for (const session of recentSessions) {
      if (!session.sets) continue;
      const sessionWeekKey = dayjs(session.date).startOf('isoWeek').format('YYYY-MM-DD');

      for (const set of session.sets) {
        if (!set.isCompleted || set.weight <= 0) continue;

        const exId = set.exerciseId;
        if (!exerciseStats[exId]) {
          const ex = exercises.find(e => e.id === exId);
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
      .filter(s => Object.keys(s.weeklyWeights).length >= 2) // need 2+ weeks of data
      .sort((a, b) => {
        if (b.totalOccurrences !== a.totalOccurrences) return b.totalOccurrences - a.totalOccurrences;
        return b.lastDate.localeCompare(a.lastDate);
      })
      .slice(0, 5);

    // Determine time window for PR detection
    const prWindowStart = activeCycle ? activeCycle.startDate : thisWeek.start;

    const keyLifts: KeyLift[] = ranked.map(stat => {
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

      // Find latest reps at max weight
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

      const pr = exercisePRs.find(p => p.exerciseId === stat.exerciseId);
      const isPR = pr ? pr.date >= prWindowStart : false;

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
      };
    });

    // ── Recent PRs count ─────────────────────────────────────────
    const recentPRCount = exercisePRs.filter(pr => pr.date >= prWindowStart).length;

    // ── Adherence ────────────────────────────────────────────────
    // Only count scheduled workouts up to today (not future)
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
  }, [sessions, scheduledWorkouts, cyclePlans, exercisePRs, exercises]);
}
