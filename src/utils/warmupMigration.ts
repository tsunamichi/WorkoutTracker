import { WarmupItem_DEPRECATED, ExerciseInstance, Exercise } from '../types/training';

/**
 * Migrates old WarmupItem structure to new ExerciseInstance structure
 * - Removes notes field
 * - Creates proper sets structure
 * - Determines mode based on which field has data (duration vs reps)
 * - Creates/finds matching movement in exercise library
 */
export function migrateWarmupItem(
  oldItem: WarmupItem_DEPRECATED,
  exercises: Exercise[],
  onCreateMovement: (name: string) => string // callback to create movement if not found, returns movementId
): ExerciseInstance {
  // Determine mode based on what data exists
  const hasTime = oldItem.duration !== undefined && oldItem.duration > 0;
  const hasReps = oldItem.reps !== undefined && oldItem.reps > 0;
  
  // Default to time mode if warmup (spec requirement)
  const mode: 'reps' | 'time' = hasTime ? 'time' : 'reps';
  
  // Find or create matching movement
  let movementId = exercises.find(e => 
    e.name.toLowerCase() === oldItem.exerciseName.toLowerCase()
  )?.id;
  
  if (!movementId) {
    // Create new movement for this warmup exercise
    movementId = onCreateMovement(oldItem.exerciseName);
  }
  
  // Create single set with appropriate data
  const sets = [{
    id: `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...(mode === 'time' ? { durationSec: oldItem.duration || 30 } : {}),
    ...(mode === 'reps' ? { reps: oldItem.reps || 10 } : {}),
  }];
  
  return {
    id: oldItem.id || `ei-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    movementId,
    mode,
    sets,
    restSec: undefined, // warmups typically don't have rest
  };
}

/**
 * Migrates an array of old warmup items
 */
export function migrateWarmupItems(
  oldItems: WarmupItem_DEPRECATED[],
  exercises: Exercise[],
  onCreateMovement: (name: string) => string
): ExerciseInstance[] {
  return oldItems.map(item => migrateWarmupItem(item, exercises, onCreateMovement));
}

/**
 * Checks if a warmup item needs migration (has old structure)
 */
export function needsMigration(item: any): item is WarmupItem_DEPRECATED {
  return (
    item &&
    typeof item === 'object' &&
    'exerciseName' in item &&
    !('movementId' in item)
  );
}

/**
 * Validates an ExerciseInstance
 */
export function validateExerciseInstance(instance: ExerciseInstance): string[] {
  const errors: string[] = [];
  
  if (!instance.movementId) {
    errors.push('Movement ID is required');
  }
  
  if (!instance.sets || instance.sets.length === 0) {
    errors.push('At least one set is required');
  }
  
  instance.sets.forEach((set, index) => {
    if (instance.mode === 'reps' && !set.reps) {
      errors.push(`Set ${index + 1}: Reps required for reps mode`);
    }
    if (instance.mode === 'time' && !set.durationSec) {
      errors.push(`Set ${index + 1}: Duration required for time mode`);
    }
  });
  
  return errors;
}

/**
 * Creates a blank ExerciseInstance for a given context
 */
export function createBlankExerciseInstance(
  movementId: string,
  context: 'workout' | 'warmup'
): ExerciseInstance {
  const mode = context === 'warmup' ? 'time' : 'reps';
  
  return {
    id: `ei-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    movementId,
    mode,
    sets: [{
      id: `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...(mode === 'time' ? { durationSec: 30 } : { reps: 10 }),
    }],
    restSec: context === 'workout' ? 60 : undefined,
  };
}

/**
 * Clones an ExerciseInstance with new IDs (for inserting warm up sets)
 */
export function cloneExerciseInstance(instance: ExerciseInstance): ExerciseInstance {
  return {
    ...instance,
    id: `ei-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sets: instance.sets.map(set => ({
      ...set,
      id: `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    })),
  };
}
