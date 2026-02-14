import type { WarmupItem_DEPRECATED, ExerciseInstanceWithCycle, ExerciseInstanceSet } from '../types/training';

/**
 * Migrates old WarmupItem_DEPRECATED structure to new ExerciseInstanceWithCycle structure
 */
export function migrateDeprecatedItem(oldItem: WarmupItem_DEPRECATED): ExerciseInstanceWithCycle {
  // Create sets array from the old sets count
  const setsArray: ExerciseInstanceSet[] = [];
  for (let i = 0; i < oldItem.sets; i++) {
    setsArray.push({
      id: `${oldItem.id}-set-${i}`,
      reps: oldItem.isTimeBased ? undefined : oldItem.reps,
      durationSec: oldItem.isTimeBased ? oldItem.reps : undefined,
      weight: oldItem.weight > 0 ? oldItem.weight : undefined,
    });
  }

  return {
    id: oldItem.id,
    movementId: oldItem.exerciseName, // Use exercise name as movement ID for legacy items
    mode: oldItem.isTimeBased ? 'time' : 'reps',
    sets: setsArray,
    restSec: undefined,
    isPerSide: oldItem.isPerSide,
    cycleId: oldItem.cycleId,
    cycleOrder: oldItem.cycleOrder,
  };
}

/**
 * Checks if an item is using the old deprecated structure
 */
export function isDeprecatedItem(item: any): item is WarmupItem_DEPRECATED {
  return (
    typeof item === 'object' &&
    item !== null &&
    'exerciseName' in item &&
    typeof item.sets === 'number' &&
    'reps' in item &&
    'isTimeBased' in item
  );
}

/**
 * Migrates an array of items, converting old ones to new structure
 */
export function migrateItemsArray(items: (WarmupItem_DEPRECATED | ExerciseInstanceWithCycle)[]): ExerciseInstanceWithCycle[] {
  return items.map(item => {
    if (isDeprecatedItem(item)) {
      console.log('🔄 Migrating deprecated item:', item.exerciseName);
      return migrateDeprecatedItem(item);
    }
    return item;
  });
}

/**
 * Creates a new exercise item with the proper structure
 */
export function createNewExerciseItem(params: {
  exerciseName: string;
  totalSets: number;
  repsPerSet: number;
  weightPerSet: number;
  isTimeBased: boolean;
  isPerSide?: boolean;
  cycleId?: string;
  cycleOrder?: number;
}): ExerciseInstanceWithCycle {
  const setsArray: ExerciseInstanceSet[] = [];
  
  for (let i = 0; i < params.totalSets; i++) {
    setsArray.push({
      id: `${Date.now()}-set-${i}-${Math.random()}`,
      reps: params.isTimeBased ? undefined : params.repsPerSet,
      durationSec: params.isTimeBased ? params.repsPerSet : undefined,
      weight: params.weightPerSet > 0 ? params.weightPerSet : undefined,
    });
  }

  return {
    id: `exercise-${Date.now()}-${Math.random()}`,
    movementId: params.exerciseName, // For now, use name as ID until we have a proper exercise library
    mode: params.isTimeBased ? 'time' : 'reps',
    sets: setsArray,
    restSec: undefined,
    isPerSide: params.isPerSide,
    cycleId: params.cycleId,
    cycleOrder: params.cycleOrder,
  };
}

/**
 * Helper to get display values from a new exercise item (for backward compatibility with UI)
 */
export function getDisplayValuesFromItem(item: ExerciseInstanceWithCycle) {
  const firstSet = item.sets[0];
  
  return {
    exerciseName: item.movementId, // Use movementId as exercise name
    sets: item.sets.length,
    reps: item.mode === 'time' ? (firstSet?.durationSec ?? 0) : (firstSet?.reps ?? 0),
    weight: firstSet?.weight ?? 0,
    isTimeBased: item.mode === 'time',
    isPerSide: item.isPerSide,
    cycleId: item.cycleId,
    cycleOrder: item.cycleOrder,
  };
}
