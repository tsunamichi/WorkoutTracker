/**
 * When the user edits load values for an incomplete set, copy that pair to all later
 * incomplete sets for the same exercise. Edits to completed sets do not propagate.
 *
 * `reps` is rep count for normal exercises and **seconds (time)** when the exercise is time-based.
 */
export function applyForwardPropagationForExerciseRounds(
  prev: Record<string, { weight: number; reps: number }>,
  exerciseId: string,
  fromRound: number,
  totalRounds: number,
  completedSets: Set<string>,
  setId: string,
  newEntry: { weight: number; reps: number },
): Record<string, { weight: number; reps: number }> {
  const next: Record<string, { weight: number; reps: number }> = { ...prev, [setId]: newEntry };
  if (completedSets.has(setId)) {
    return next;
  }
  for (let r = fromRound + 1; r < totalRounds; r++) {
    const sid = `${exerciseId}-set-${r}`;
    if (!completedSets.has(sid)) {
      next[sid] = { weight: newEntry.weight, reps: newEntry.reps };
    }
  }
  return next;
}
