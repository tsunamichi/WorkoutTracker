import dayjs from 'dayjs';
import type { WorkoutSession, WorkoutProgress } from '../types';
import type { ScheduledWorkout } from '../types/training';
import { formatWeightForLoad } from './weight';

/** Most recent logged set for a library exercise (by session / progress timestamp). */
export type LastExerciseRecord = {
  /** Calendar day for display */
  date: string;
  weightLbs: number;
  reps: number;
  sortTs: number;
};

function dateFromWorkoutProgressKey(
  wKey: string,
  scheduledWorkouts: ScheduledWorkout[],
  lastUpdated: string,
): string | null {
  if (wKey.startsWith('sw-')) {
    return scheduledWorkouts.find(s => s.id === wKey)?.date ?? null;
  }
  const m = wKey.match(/(\d{4}-\d{2}-\d{2})/);
  if (m?.[1]) return m[1];
  const fromLu = lastUpdated.split('T')[0];
  return fromLu && /^\d{4}-\d{2}-\d{2}$/.test(fromLu) ? fromLu : null;
}

/**
 * Latest completed set for a catalog exercise id (sessions + detailed workout progress).
 */
export function getLastExerciseRecordForLibraryId(
  exerciseId: string,
  sessions: WorkoutSession[],
  detailedWorkoutProgress: Record<string, WorkoutProgress>,
  scheduledWorkouts: ScheduledWorkout[],
): LastExerciseRecord | null {
  const candidates: LastExerciseRecord[] = [];

  for (const session of sessions) {
    const sets = session.sets.filter(s => s.exerciseId === exerciseId && s.isCompleted);
    if (sets.length === 0) continue;
    const lastSet = sets.reduce((a, b) => (a.setIndex > b.setIndex ? a : b));
    const ts = new Date(session.endTime ?? session.startTime).getTime();
    candidates.push({
      date: session.date,
      weightLbs: lastSet.weight,
      reps: lastSet.reps,
      sortTs: ts,
    });
  }

  for (const [wKey, wp] of Object.entries(detailedWorkoutProgress)) {
    const dateStr = dateFromWorkoutProgressKey(wKey, scheduledWorkouts, wp.lastUpdated);
    if (!dateStr) continue;

    for (const ep of Object.values(wp.exercises)) {
      if (ep.skipped) continue;
      if (ep.exerciseId !== exerciseId) continue;
      const completed = (ep.sets ?? []).filter(s => s.completed);
      if (completed.length === 0) continue;
      const lastSet = completed.reduce((a, b) => (a.setNumber >= b.setNumber ? a : b));
      const ts = new Date(wp.lastUpdated).getTime();
      candidates.push({
        date: dateStr,
        weightLbs: lastSet.weight,
        reps: lastSet.reps,
        sortTs: ts,
      });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.sortTs - a.sortTs);
  return candidates[0]!;
}

/** e.g. `185 lb × 8 · Oct 12` (dayjs locale should match app language). */
export function formatLastExerciseRecordLine(r: LastExerciseRecord, useKg: boolean): string {
  const w = formatWeightForLoad(r.weightLbs, useKg);
  const unit = useKg ? 'kg' : 'lb';
  const dateShort = dayjs(r.date).format('MMM D');
  return `${w} ${unit} × ${r.reps} · ${dateShort}`;
}

/**
 * Latest activity timestamp (ms) per exercise id, from sessions + detailed progress.
 * Only ids present in `ids` are written — use for sorting search results without N full scans.
 */
export function buildMaxLastLogSortTsByExerciseIds(
  ids: ReadonlySet<string>,
  sessions: WorkoutSession[],
  detailedWorkoutProgress: Record<string, WorkoutProgress>,
  scheduledWorkouts: ScheduledWorkout[],
): Map<string, number> {
  const maxTs = new Map<string, number>();
  const bump = (id: string, ts: number) => {
    if (!ids.has(id)) return;
    const cur = maxTs.get(id);
    if (cur === undefined || ts > cur) maxTs.set(id, ts);
  };

  for (const session of sessions) {
    const sessionTs = new Date(session.endTime ?? session.startTime).getTime();
    const hasCompletedByExercise = new Map<string, boolean>();
    for (const set of session.sets) {
      if (!set.isCompleted || !ids.has(set.exerciseId)) continue;
      hasCompletedByExercise.set(set.exerciseId, true);
    }
    for (const eid of hasCompletedByExercise.keys()) {
      bump(eid, sessionTs);
    }
  }

  for (const [wKey, wp] of Object.entries(detailedWorkoutProgress)) {
    const dateStr = dateFromWorkoutProgressKey(wKey, scheduledWorkouts, wp.lastUpdated);
    if (!dateStr) continue;
    const ts = new Date(wp.lastUpdated).getTime();
    for (const ep of Object.values(wp.exercises)) {
      if (ep.skipped) continue;
      if (!ids.has(ep.exerciseId)) continue;
      const completed = (ep.sets ?? []).filter(s => s.completed);
      if (completed.length === 0) continue;
      bump(ep.exerciseId, ts);
    }
  }

  return maxTs;
}
