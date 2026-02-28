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
  dayA: { name: 'Day A', items: [
    { exerciseName: 'Ab Wheel Rollout', sets: 3, reps: 8, weight: 0, isTimeBased: false },
    { exerciseName: 'Cable Crunch', sets: 3, reps: 12, weight: 0, isTimeBased: false },
    { exerciseName: 'Dead Bug', sets: 2, reps: 8, weight: 0, isTimeBased: false, isPerSide: true },
  ]},
  dayB: { name: 'Day B', items: [
    { exerciseName: 'Pallof Press', sets: 3, reps: 10, weight: 0, isTimeBased: false, isPerSide: true },
    { exerciseName: 'Half-Kneeling Cable Chop', sets: 3, reps: 8, weight: 0, isTimeBased: false, isPerSide: true },
    { exerciseName: 'Single-Arm Farmer Hold', sets: 2, reps: 35, weight: 0, isTimeBased: true, isPerSide: true },
  ]},
  dayC: { name: 'Day C', items: [
    { exerciseName: 'Suitcase Carry', sets: 4, reps: 35, weight: 0, isTimeBased: true, isPerSide: true },
    { exerciseName: 'Weighted Side Plank', sets: 3, reps: 25, weight: 0, isTimeBased: true, isPerSide: true },
    { exerciseName: 'Offset Kettlebell March', sets: 2, reps: 10, weight: 0, isTimeBased: false, isPerSide: true },
  ]},
  dayD: { name: 'Day D', items: [
    { exerciseName: 'Long-Lever Plank', sets: 4, reps: 25, weight: 0, isTimeBased: true },
    { exerciseName: 'Cable Pulldown Crunch', sets: 3, reps: 10, weight: 0, isTimeBased: false },
    { exerciseName: 'Dead Bug (Straight-Leg)', sets: 2, reps: 6, weight: 0, isTimeBased: false, isPerSide: true },
  ]},
  dayE: { name: 'Day E', items: [
    { exerciseName: 'Cable Lift', sets: 3, reps: 8, weight: 0, isTimeBased: false, isPerSide: true },
    { exerciseName: 'Pallof Press ISO Hold', sets: 3, reps: 25, weight: 0, isTimeBased: true, isPerSide: true },
    { exerciseName: 'Single-Arm DB Carry', sets: 2, reps: 25, weight: 0, isTimeBased: true, isPerSide: true },
  ]},
  dayF: { name: 'Day F', items: [
    { exerciseName: 'Hanging Knee Raise', sets: 3, reps: 10, weight: 0, isTimeBased: false },
    { exerciseName: 'Decline Sit-Up', sets: 3, reps: 8, weight: 0, isTimeBased: false },
    { exerciseName: 'Side Plank Reach-Through', sets: 2, reps: 8, weight: 0, isTimeBased: false, isPerSide: true },
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
