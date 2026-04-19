import type { Exercise } from '../types';
import type { WorkoutTemplateExercise } from '../types/training';
import type { WorkoutDraft, WorkoutDraftLine } from '../types/workoutDraft';
import { newDraftId } from './workoutBuilderPaste';

/**
 * Build an editable draft from a frozen main snapshot.
 * Prefer catalog match by exerciseId; if the id is missing (deleted catalog row), require re-pick.
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

    const byId = exercises.find(e => e.id === ex.exerciseId);
    if (byId) {
      displayName = byId.name;
      exerciseId = byId.id;
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
    };
  });

  const title = workoutTitle.trim() || 'Untitled';

  return {
    id: newDraftId('wd'),
    name: title,
    lines,
  };
}
