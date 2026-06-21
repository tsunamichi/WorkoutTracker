import type { ExerciseWeightProgressRow } from '../types/exerciseWeightProgress';

function defaultSortRows(rows: ExerciseWeightProgressRow[]): ExerciseWeightProgressRow[] {
  return [...rows].sort((a, b) => {
    if (a.isKeyLift !== b.isKeyLift) return a.isKeyLift ? -1 : 1;
    const dateCmp = b.highestLoggedDate.localeCompare(a.highestLoggedDate);
    if (dateCmp !== 0) return dateCmp;
    return a.exerciseName.localeCompare(b.exerciseName, undefined, { sensitivity: 'base' });
  });
}

/**
 * Apply persisted manual order first; append new exercises using default sort.
 * Manual order wins for exercises the user has already ordered.
 */
export function sortExerciseWeightProgressRows(
  rows: ExerciseWeightProgressRow[],
  historyExerciseOrder?: string[],
): ExerciseWeightProgressRow[] {
  if (!historyExerciseOrder?.length) {
    return defaultSortRows(rows);
  }

  const byId = new Map(rows.map(r => [r.exerciseId, r]));
  const ordered: ExerciseWeightProgressRow[] = [];
  const seen = new Set<string>();

  for (const id of historyExerciseOrder) {
    const row = byId.get(id);
    if (row) {
      ordered.push(row);
      seen.add(id);
    }
  }

  const remaining = rows.filter(r => !seen.has(r.exerciseId));
  return [...ordered, ...defaultSortRows(remaining)];
}
