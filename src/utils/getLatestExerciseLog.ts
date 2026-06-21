import type { WorkoutSession, WorkoutProgress } from '../types';
import type { ScheduledWorkout } from '../types/training';
import type { LastLogForExercise } from '../types/progression';

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

type LogEntry = {
  date: string;
  completedAt: string;
  workingSets: LastLogForExercise['workingSets'];
};

/**
 * Latest completed log for a catalog exercise id.
 * Sort: workout date desc, then completedAt/lastUpdated desc.
 */
export function getLatestExerciseLog(
  exerciseId: string,
  sessions: WorkoutSession[],
  detailedWorkoutProgress: Record<string, WorkoutProgress>,
  scheduledWorkouts: ScheduledWorkout[],
): LastLogForExercise | null {
  const entries: LogEntry[] = [];

  for (const session of sessions) {
    const completedSets = session.sets.filter(s => s.exerciseId === exerciseId && s.isCompleted);
    if (completedSets.length === 0) continue;
    entries.push({
      date: session.date,
      completedAt: session.endTime ?? session.startTime,
      workingSets: completedSets
        .sort((a, b) => a.setIndex - b.setIndex)
        .map(s => ({ setNumber: s.setIndex + 1, weight: s.weight, reps: s.reps })),
    });
  }

  for (const [wKey, wp] of Object.entries(detailedWorkoutProgress)) {
    const dateStr = dateFromWorkoutProgressKey(wKey, scheduledWorkouts, wp.lastUpdated);
    if (!dateStr) continue;

    for (const ep of Object.values(wp.exercises)) {
      if (ep.skipped || ep.exerciseId !== exerciseId) continue;
      const completed = (ep.sets ?? []).filter(s => s.completed);
      if (completed.length === 0) continue;
      entries.push({
        date: dateStr,
        completedAt: wp.lastUpdated,
        workingSets: completed
          .sort((a, b) => a.setNumber - b.setNumber)
          .map(s => ({ setNumber: s.setNumber, weight: s.weight, reps: s.reps })),
      });
    }
  }

  if (entries.length === 0) return null;

  entries.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.completedAt.localeCompare(a.completedAt);
  });

  const best = entries[0]!;
  return { date: best.date, workingSets: best.workingSets };
}
