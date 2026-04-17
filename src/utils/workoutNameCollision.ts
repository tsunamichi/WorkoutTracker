import type { WorkoutTemplate } from '../types/training';

export function findActiveTemplateByName(
  templates: WorkoutTemplate[],
  name: string,
): WorkoutTemplate | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return templates.find(t => t.name.trim().toLowerCase() === n);
}

/** Suggest a name that does not match any existing template (case-insensitive). */
export function suggestNonCollidingName(base: string, templates: WorkoutTemplate[]): string {
  const root = base.trim() || 'Workout';
  let candidate = `${root} Copy`;
  let i = 2;
  while (templates.some(t => t.name.trim().toLowerCase() === candidate.toLowerCase())) {
    candidate = `${root} Copy (${i})`;
    i += 1;
  }
  return candidate;
}
