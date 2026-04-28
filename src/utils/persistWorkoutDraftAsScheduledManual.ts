import { useStore } from '../store';
import type { WorkoutTemplate } from '../types/training';
import type { WorkoutDraft } from '../types/workoutDraft';
import { findActiveTemplateByName } from './workoutNameCollision';

export type PersistManualScheduleResult =
  | { ok: true; scheduledWorkoutId: string; templateId: string }
  | { ok: false; reason: 'validation' | 'schedule_failed' };

export function validateWorkoutDraftForManualSchedule(draft: WorkoutDraft): boolean {
  const w = draft;
  if (!w.name.trim() || w.lines.length === 0) return false;
  const unresolved = w.lines.filter(l => !l.exerciseId || l.resolutionStatus === 'needs_pick');
  if (unresolved.length > 0) return false;
  if (w.requiresRenameBeforeSave) {
    const collision = findActiveTemplateByName(useStore.getState().workoutTemplates, w.name);
    if (collision) return false;
  }
  return true;
}

/**
 * Create or update a library template from a builder draft and schedule it on `selectedDate`
 * (manual stack — same rules as WorkoutBuilder `persistWorkoutTemplate`).
 */
export async function persistWorkoutDraftAsScheduledManual(
  draft: WorkoutDraft,
  selectedDate: string,
): Promise<PersistManualScheduleResult> {
  if (!validateWorkoutDraftForManualSchedule(draft)) {
    return { ok: false, reason: 'validation' };
  }

  const w = draft;
  const { addWorkoutTemplate, updateWorkoutTemplate, scheduleWorkout } = useStore.getState();
  const workoutTemplates = useStore.getState().workoutTemplates;

  const buildItems = (templateId: string): WorkoutTemplate['items'] => {
    const items: WorkoutTemplate['items'] = [];
    for (let i = 0; i < w.lines.length; i++) {
      const line = w.lines[i]!;
      const seed = line.templateSeed;
      items.push({
        id: `tex-${templateId}-${i}`,
        exerciseId: line.exerciseId!,
        order: i,
        sets: typeof seed?.sets === 'number' && seed.sets > 0 ? seed.sets : 1,
        reps: seed?.reps ?? '',
        weight: seed?.weight,
        isTimeBased: seed?.isTimeBased,
        isPerSide: seed?.isPerSide,
        restSeconds: seed?.restSeconds,
        cycleId: seed?.cycleId,
        cycleOrder: seed?.cycleOrder,
      });
    }
    return items;
  };

  const finishSchedule = async (templateId: string): Promise<PersistManualScheduleResult> => {
    const result = await scheduleWorkout(selectedDate, templateId, 'manual');
    if (!result.success) {
      return { ok: false, reason: 'schedule_failed' };
    }
    const matches = useStore
      .getState()
      .scheduledWorkouts.filter(s => s.date === selectedDate && s.templateId === templateId);
    const sorted = matches.sort((a, b) => a.id.localeCompare(b.id));
    const sw = sorted[sorted.length - 1];
    if (!sw) {
      return { ok: false, reason: 'schedule_failed' };
    }
    return { ok: true, scheduledWorkoutId: sw.id, templateId };
  };

  const now = new Date().toISOString();

  if (w.linkedTemplateId) {
    await updateWorkoutTemplate(w.linkedTemplateId, {
      items: buildItems(w.linkedTemplateId),
      name: w.name.trim(),
    });
    return finishSchedule(w.linkedTemplateId);
  }

  const existing = findActiveTemplateByName(workoutTemplates, w.name);
  if (existing) {
    await updateWorkoutTemplate(existing.id, {
      items: buildItems(existing.id),
      name: w.name.trim(),
    });
    return finishSchedule(existing.id);
  }

  const templateId = `wt-${Date.now()}`;
  const items = buildItems(templateId);
  const template: WorkoutTemplate = {
    id: templateId,
    name: w.name.trim(),
    createdAt: now,
    updatedAt: now,
    kind: 'workout',
    warmupItems: [],
    accessoryItems: [],
    items,
    lastUsedAt: null,
    usageCount: 0,
  };
  await addWorkoutTemplate(template);
  return finishSchedule(templateId);
}
