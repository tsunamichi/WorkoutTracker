import type { Exercise } from '../types';
import type { WorkoutTemplateExercise } from '../types/training';
import type { WorkoutDraft, WorkoutDraftLine } from '../types/workoutDraft';
import { resolveExerciseByIdOrName } from './personalExerciseCatalog';
import { newDraftId } from './workoutBuilderPaste';

/**
 * Build an editable draft from a frozen main snapshot.
 * Prefer catalog match by exerciseId; fall back to nameSnapshot; otherwise require re-pick.
 */
export function hydrateWorkoutDraftFromSnapshot(
  workoutTitle: string,
  snapshot: WorkoutTemplateExercise[],
  exercises: Exercise[],
): WorkoutDraft {
  const lines: WorkoutDraftLine[] = snapshot.map((ex, i) => {
    let displayName: string | undefined;
    let exerciseId: string | undefined;
    let resolutionStatus: WorkoutDraftLine['resolutionStatus'];

    const resolved = resolveExerciseByIdOrName(exercises, ex.exerciseId, ex.nameSnapshot);
    if (resolved) {
      displayName = resolved.name;
      exerciseId = resolved.id;
    } else if (ex.nameSnapshot?.trim()) {
      displayName = ex.nameSnapshot.trim();
      exerciseId = undefined;
      resolutionStatus = 'needs_pick';
    } else {
      displayName = `Custom exercise ${i + 1}`;
      exerciseId = undefined;
      resolutionStatus = 'needs_pick';
    }

    return {
      id: newDraftId('line'),
      name: displayName ?? `Exercise ${i + 1}`,
      exerciseId,
      resolutionStatus,
      templateSeed: {
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
        isTimeBased: ex.isTimeBased,
        isPerSide: ex.isPerSide,
        restSeconds: ex.restSeconds,
        cycleId: ex.cycleId,
        cycleOrder: ex.cycleOrder,
      },
    };
  });

  const title = workoutTitle.trim() || 'Untitled';

  return {
    id: newDraftId('wd'),
    name: title,
    lines,
  };
}
