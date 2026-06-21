import type { Exercise } from '../types';
import type { WorkoutTemplateExercise } from '../types/training';

function formatExerciseLine(
  exerciseName: string,
  ex: WorkoutTemplateExercise,
  weightUnit: string,
): string {
  const weight = ex.weight != null ? ` @ ${ex.weight} ${weightUnit}` : '';
  if (ex.isTimeBased) {
    const reps = typeof ex.reps === 'number' ? ex.reps : parseInt(String(ex.reps), 10) || 30;
    return `- ${exerciseName} — ${ex.sets}×${reps} sec${weight}`;
  }
  const reps = typeof ex.reps === 'string' ? ex.reps : String(ex.reps);
  return `- ${exerciseName} — ${ex.sets}×${reps}${weight}`;
}

/**
 * Paste-friendly text for Messages / notes (same line shape as cycle share).
 */
export function buildWorkoutShareText(
  workoutTitle: string,
  items: WorkoutTemplateExercise[],
  exercises: Exercise[],
  weightUnit: string,
): string {
  const lines: string[] = [workoutTitle.trim(), '⸻'];
  for (const ex of items) {
    const exercise = exercises.find(e => e.id === ex.exerciseId);
    const name = exercise?.name ?? 'Unknown';
    lines.push(formatExerciseLine(name, ex, weightUnit));
  }
  return lines.join('\n').trim();
}
