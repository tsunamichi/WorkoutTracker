import type { Exercise, WorkoutSession } from '../types';

/**
 * Ranks library exercises by number of completed sets in saved sessions, then by name.
 * If no session data exists, returns the first `limit` exercises in name order.
 */
export function getTopExercisesByCompletedSetCount(
  exercises: Exercise[],
  sessions: WorkoutSession[],
  limit: number = 5,
): Exercise[] {
  if (exercises.length === 0) return [];

  const counts = new Map<string, number>();
  for (const session of sessions) {
    for (const set of session.sets) {
      if (set.exerciseId && set.isCompleted) {
        const id = set.exerciseId;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
  }

  const scored = exercises
    .map(ex => ({ ex, c: counts.get(ex.id) ?? 0 }))
    .sort((a, b) => {
      if (b.c !== a.c) return b.c - a.c;
      return a.ex.name.localeCompare(b.ex.name);
    });

  const withAnyUsage = scored.filter(s => s.c > 0);
  const pick = withAnyUsage.length > 0 ? withAnyUsage : scored;
  return pick.slice(0, limit).map(s => s.ex);
}
