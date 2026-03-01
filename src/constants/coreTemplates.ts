import { createNewExerciseItem } from '../utils/exerciseMigration';
import type { CoreSetTemplate } from '../types/training';
import type { ExerciseInstanceWithCycle } from '../types/training';

export type BuiltinCoreTemplateItem = {
  exerciseName: string;
  sets: number;
  reps: number;
  weight: number;
  isTimeBased: boolean;
  isPerSide?: boolean;
  cycleId?: string;
  cycleOrder?: number;
};

export type BuiltinCoreTemplate = {
  name: string;
  items: BuiltinCoreTemplateItem[];
};

export const BUILTIN_CORE_TEMPLATES: Record<string, BuiltinCoreTemplate> = {
  dayA: { name: 'A — Anti-Extension (Advanced)', items: [
    { exerciseName: 'Stability Ball Rollout', sets: 3, reps: 10, weight: 0, isTimeBased: false },
    { exerciseName: 'Body Saw (on sliders)', sets: 3, reps: 8, weight: 0, isTimeBased: false },
    { exerciseName: 'Hollow Body Hold', sets: 3, reps: 30, weight: 0, isTimeBased: true },
  ]},
  dayB: { name: 'B — Rotational Strength', items: [
    { exerciseName: 'Half-Kneeling Cable Chop (heavier)', sets: 3, reps: 8, weight: 0, isTimeBased: false, isPerSide: true },
    { exerciseName: 'Cable Lift (low to high)', sets: 3, reps: 8, weight: 0, isTimeBased: false, isPerSide: true },
    { exerciseName: 'Landmine Rotation', sets: 3, reps: 6, weight: 0, isTimeBased: false, isPerSide: true },
  ]},
  dayC: { name: 'C — Lateral + Athletic Bracing', items: [
    { exerciseName: 'Suitcase Carry (heavier)', sets: 3, reps: 35, weight: 0, isTimeBased: true, isPerSide: true },
    { exerciseName: 'Copenhagen Plank (top leg straight)', sets: 3, reps: 20, weight: 0, isTimeBased: true, isPerSide: true },
    { exerciseName: 'Offset KB Front Rack March', sets: 3, reps: 12, weight: 0, isTimeBased: false, isPerSide: true },
  ]},
  dayD: { name: 'D — Anti-Extension (Single-Leg Emphasis)', items: [
    { exerciseName: 'Single-Leg Stability Ball Rollout', sets: 3, reps: 8, weight: 0, isTimeBased: false },
    { exerciseName: 'Long-Lever Plank with Reach', sets: 3, reps: 20, weight: 0, isTimeBased: true },
    { exerciseName: 'Dead Bug with Band Pulldown', sets: 3, reps: 6, weight: 0, isTimeBased: false, isPerSide: true },
  ]},
  dayE: { name: 'E — Anti-Rotation Control', items: [
    { exerciseName: 'Pallof Press Step-Out', sets: 3, reps: 8, weight: 0, isTimeBased: false, isPerSide: true },
    { exerciseName: 'Single-Arm Cable Row (anti-rotation focus)', sets: 3, reps: 8, weight: 0, isTimeBased: false, isPerSide: true },
    { exerciseName: 'Bear Crawl (slow, controlled)', sets: 3, reps: 20, weight: 0, isTimeBased: true },
  ]},
  dayF: { name: 'F — Flexion (Controlled) + Lateral Integration', items: [
    { exerciseName: 'GHD Sit-Up (short ROM)', sets: 3, reps: 8, weight: 0, isTimeBased: false },
    { exerciseName: 'Weighted Side Plank', sets: 3, reps: 25, weight: 0, isTimeBased: true, isPerSide: true },
    { exerciseName: 'Kettlebell Cross-Body Hold', sets: 3, reps: 20, weight: 0, isTimeBased: true, isPerSide: true },
  ]},
};

export function resolveBuiltinCoreItems(template: BuiltinCoreTemplate): ExerciseInstanceWithCycle[] {
  const cycleIdMap = new Map<string, string>();
  return template.items.map(item => {
    let cycleId = item.cycleId;
    if (cycleId) {
      if (!cycleIdMap.has(cycleId)) {
        cycleIdMap.set(cycleId, `bonus-cycle-${Date.now()}-${cycleIdMap.size}`);
      }
      cycleId = cycleIdMap.get(cycleId);
    }
    return createNewExerciseItem({
      exerciseName: item.exerciseName,
      totalSets: item.sets,
      repsPerSet: item.reps,
      weightPerSet: item.weight,
      isTimeBased: item.isTimeBased,
      isPerSide: item.isPerSide,
      cycleId,
      cycleOrder: item.cycleOrder,
    });
  });
}

/** Returns built-in core workouts (Day A–F) as CoreSetTemplate for display and starting a session. */
export function getBuiltinCoreWorkouts(): CoreSetTemplate[] {
  const now = Date.now();
  return Object.entries(BUILTIN_CORE_TEMPLATES).map(([key, tmpl]) => ({
    id: `builtin-${key}`,
    name: tmpl.name,
    items: resolveBuiltinCoreItems(tmpl),
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
  }));
}
