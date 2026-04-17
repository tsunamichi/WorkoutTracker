import dayjs from 'dayjs';
import type { ScheduledWorkout, WorkoutTemplateExercise } from '../types/training';

export type RecentWorkoutPickerOption = {
  workoutName: string;
  /** ISO timestamp for display + sorting */
  lastPerformedAt: string;
  exerciseCount: number;
  exercisesSnapshot: WorkoutTemplateExercise[];
  /** Immutable source row id (for debugging / analytics only — do not mutate) */
  sourceScheduledWorkoutId: string;
};

/**
 * Group completed logs by display name; each option uses the most recent instance’s snapshot.
 */
export function buildRecentWorkoutPickerOptions(
  scheduledWorkouts: ScheduledWorkout[],
): RecentWorkoutPickerOption[] {
  const completed = scheduledWorkouts.filter(sw => {
    const done = sw.status === 'completed' || sw.isLocked;
    const snap = sw.exercisesSnapshot;
    return done && Array.isArray(snap) && snap.length > 0;
  });

  const byName = new Map<string, ScheduledWorkout[]>();
  for (const sw of completed) {
    const name = (sw.titleSnapshot || '').trim() || 'Untitled';
    const arr = byName.get(name) ?? [];
    arr.push(sw);
    byName.set(name, arr);
  }

  const out: RecentWorkoutPickerOption[] = [];

  for (const [workoutName, group] of byName) {
    const sorted = [...group].sort((a, b) => {
      const ta = dayjs(a.completedAt ?? a.startedAt ?? `${a.date}T12:00:00`).valueOf();
      const tb = dayjs(b.completedAt ?? b.startedAt ?? `${b.date}T12:00:00`).valueOf();
      return tb - ta;
    });
    const latest = sorted[0];
    const snap = latest.exercisesSnapshot;
    if (!snap?.length) continue;

    out.push({
      workoutName,
      lastPerformedAt: latest.completedAt ?? latest.startedAt ?? `${latest.date}T12:00:00.000Z`,
      exerciseCount: snap.length,
      exercisesSnapshot: snap,
      sourceScheduledWorkoutId: latest.id,
    });
  }

  out.sort(
    (a, b) => dayjs(b.lastPerformedAt).valueOf() - dayjs(a.lastPerformedAt).valueOf(),
  );
  return out;
}
