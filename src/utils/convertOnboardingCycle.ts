import { SavedCycle } from '../types/workout';
import { Cycle, WorkoutTemplate, WorkoutTemplateExercise, Exercise, ExerciseCategory, WorkoutType } from '../types';
import dayjs from 'dayjs';

// Helper to create a normalized key for matching exercises
function normalizeExerciseName(name: string): string {
  return name.toLowerCase().trim();
}

// Helper to generate unique IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper to parse reps string (e.g., "8-12" or "5" or "AMRAP")
function parseReps(repsString: string): { min: number; max?: number } {
  if (!repsString || repsString === 'AMRAP') {
    return { min: 8, max: 12 }; // Default
  }
  
  if (repsString.includes('-')) {
    const [min, max] = repsString.split('-').map(r => parseInt(r.trim(), 10));
    return { min: min || 8, max: max || 12 };
  }
  
  const parsed = parseInt(repsString, 10);
  return { min: parsed || 8 };
}

// Helper to map movement pattern to exercise category
function mapPatternToCategory(pattern?: string): ExerciseCategory {
  if (!pattern) return 'Other';
  
  const mapping: Record<string, ExerciseCategory> = {
    'squat': 'Legs',
    'hinge': 'Legs',
    'push': 'Chest',
    'pull': 'Back',
    'carry': 'Full Body',
    'core': 'Core',
    'cardio': 'Cardio',
  };
  
  return mapping[pattern.toLowerCase()] || 'Other';
}

// Helper to determine workout type from day title
function determineWorkoutType(dayTitle: string): WorkoutType {
  const lower = dayTitle.toLowerCase();
  if (lower.includes('push')) return 'Push';
  if (lower.includes('pull')) return 'Pull';
  if (lower.includes('leg')) return 'Legs';
  if (lower.includes('full')) return 'Full Body';
  if (lower.includes('mobility')) return 'Mobility';
  return 'Other';
}

export interface ConversionResult {
  cycle: Cycle;
  exercises: Exercise[];
}

/**
 * Convert a SavedCycle from onboarding to a Cycle for the main app
 * Also returns Exercise records that need to be added to the store
 * 
 * @param savedCycle - The cycle from the onboarding flow
 * @param cycleNumber - The cycle number to assign
 * @param existingExercises - Existing exercises from the store to reuse
 */
export function convertOnboardingCycleToAppCycle(
  savedCycle: SavedCycle,
  cycleNumber: number,
  existingExercises: Exercise[] = []
): ConversionResult {
  const startDate = dayjs().format('YYYY-MM-DD');
  const endDate = dayjs().add(savedCycle.cycleLengthWeeks, 'weeks').format('YYYY-MM-DD');

  // Build a map of existing exercises by normalized name for quick lookup
  const existingExercisesByName = new Map<string, Exercise>();
  existingExercises.forEach(ex => {
    existingExercisesByName.set(normalizeExerciseName(ex.name), ex);
  });

  // Collect all unique exercises by NAME (not by ID)
  // This ensures that exercises with the same name share the same exerciseId
  const exercisesMap = new Map<string, Exercise>();
  const exerciseNameToId = new Map<string, string>();
  
  // Convert each DayPlan to a WorkoutTemplate
  const workoutTemplates: WorkoutTemplate[] = savedCycle.days.map((day, index) => {
    const workoutTemplate: WorkoutTemplate = {
      id: `wt-${savedCycle.id}-${day.dayIndex}`,
      cycleId: savedCycle.id,
      name: day.title,
      workoutType: determineWorkoutType(day.title),
      orderIndex: index,
      exercises: day.exercises.map((exercise, exIndex): WorkoutTemplateExercise => {
        // Get or create a consistent exerciseId based on exercise name
        const normalizedName = normalizeExerciseName(exercise.name);
        let exerciseId = exerciseNameToId.get(normalizedName);
        
        if (!exerciseId) {
          // Check if this exercise already exists in the store
          const existingExercise = existingExercisesByName.get(normalizedName);
          
          if (existingExercise) {
            // Reuse existing exercise
            exerciseId = existingExercise.id;
            exerciseNameToId.set(normalizedName, exerciseId);
          } else {
            // First time seeing this exercise name - create new ID and Exercise record
            exerciseId = generateId();
            exerciseNameToId.set(normalizedName, exerciseId);
            
            const appExercise: Exercise = {
              id: exerciseId,
              name: exercise.name,
              category: mapPatternToCategory(exercise.pattern),
              equipment: exercise.equipment,
              isCustom: true, // Mark as custom since created via onboarding
              notes: exercise.notes,
            };
            exercisesMap.set(exerciseId, appExercise);
          }
        }

        const { min, max } = parseReps(exercise.reps || '8-12');

        return {
          id: generateId(),
          exerciseId: exerciseId, // Use the consistent exerciseId
          orderIndex: exIndex,
          targetSets: exercise.sets || 3,
          targetRepsMin: min,
          targetRepsMax: max,
          notes: exercise.notes,
          progressionType: 'double', // Default to double progression
          repRangeMin: min,
          repRangeMax: max || min,
        };
      }),
    };
    return workoutTemplate;
  });

  const cycle: Cycle = {
    id: savedCycle.id,
    cycleNumber,
    startDate,
    lengthInWeeks: savedCycle.cycleLengthWeeks,
    endDate,
    workoutsPerWeek: savedCycle.prefs.daysPerWeek,
    goal: `${savedCycle.templateName} - ${savedCycle.prefs.sessionMinutes} min sessions`,
    isActive: true,
    workoutTemplates,
    createdAt: savedCycle.createdAt,
  };

  return {
    cycle,
    exercises: Array.from(exercisesMap.values()),
  };
}

