import type { Exercise } from '../types';
import type { WorkoutTemplateExercise } from '../types/training';
import type { WorkoutDraft, WorkoutDraftLine } from '../types/workoutDraft';
import { newDraftId } from './workoutBuilderPaste';

/**
 * Build an editable draft from a frozen main snapshot.
 * Prefer catalog match by exerciseId; then normalized name; else keep a custom row label.
 */
export function hydrateWorkoutDraftFromSnapshot(
  workoutTitle: string,
  snapshot: WorkoutTemplateExercise[],
  exercises: Exercise[],
): WorkoutDraft {
  const lines: WorkoutDraftLine[] = snapshot.map((ex, i) => {
    let displayName: string | undefined;
    let exerciseId: string | undefined;

    const byId = exercises.find(e => e.id === ex.exerciseId);
    if (byId) {
      displayName = byId.name;
      exerciseId = byId.id;
    } else {
      displayName = `Custom exercise ${i + 1}`;
      exerciseId = undefined;
    }

    return {
      id: newDraftId('line'),
      name: displayName ?? `Exercise ${i + 1}`,
      exerciseId,
    };
  });

  const title = workoutTitle.trim() || 'Untitled';

  return {
    id: newDraftId('wd'),
    name: title,
    lines,
  };
}
