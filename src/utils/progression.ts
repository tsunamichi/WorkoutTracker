import type { WorkoutTemplateExercise } from '../types';

/**
 * Calculate the exercise parameters for a specific week based on user-provided values or progression settings
 */
export function calculateWeeklyProgression(
  exercise: WorkoutTemplateExercise,
  weekNumber: number
): {
  targetWeight: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
} {
  console.log(`🔢 calculateWeeklyProgression for week ${weekNumber}`);
  console.log('Exercise:', exercise);
  console.log('weeklyOverrides:', exercise.weeklyOverrides);
  
  // FIRST: Check if user provided exact values for this week (1:1 match from input)
  if (exercise.weeklyOverrides && exercise.weeklyOverrides[weekNumber]) {
    const override = exercise.weeklyOverrides[weekNumber];
    console.log(`✅ Found override for week ${weekNumber}:`, override);
    return {
      targetWeight: override.targetWeight ?? exercise.targetWeight ?? 0,
      targetSets: override.targetSets ?? exercise.targetSets,
      targetRepsMin: override.targetRepsMin ?? exercise.targetRepsMin,
      targetRepsMax: override.targetRepsMax ?? exercise.targetRepsMax ?? override.targetRepsMin ?? exercise.targetRepsMin,
    };
  }
  
  console.log(`⚠️ No override found for week ${weekNumber}, using fallback progression`);
  
  // FALLBACK: Calculate based on progression if no exact values provided
  const baseWeight = exercise.targetWeight || 0;
  const baseSets = exercise.targetSets;
  const baseRepsMin = exercise.targetRepsMin;
  const baseRepsMax = exercise.targetRepsMax || baseRepsMin;
  const progressionValue = exercise.progressionValue || 0;
  
  // Week 1 uses base values, Week 2+ applies progression
  const weeksOfProgression = weekNumber - 1;
  
  let targetWeight = baseWeight;
  let targetSets = baseSets;
  let targetRepsMin = baseRepsMin;
  let targetRepsMax = baseRepsMax;
  
  switch (exercise.progressionType) {
    case 'weight':
      // Add weight each week (e.g., +5lbs per week)
      targetWeight = baseWeight + (progressionValue * weeksOfProgression);
      break;
      
    case 'reps':
      // Add reps each week (e.g., +1 rep per week)
      targetRepsMin = baseRepsMin + (progressionValue * weeksOfProgression);
      targetRepsMax = baseRepsMax + (progressionValue * weeksOfProgression);
      break;
      
    case 'double':
      // Double progression: increase reps until max, then increase weight
      // This is complex and would need additional logic
      // For now, just increase weight
      targetWeight = baseWeight + (progressionValue * weeksOfProgression);
      break;
      
    case 'none':
    default:
      // No progression
      break;
  }
  
  return {
    targetWeight: Math.max(0, targetWeight),
    targetSets,
    targetRepsMin: Math.max(1, targetRepsMin),
    targetRepsMax: Math.max(targetRepsMin, targetRepsMax),
  };
}

/**
 * Calculate cycle end date given start date and length
 */
export function calculateCycleEndDate(startDate: string, weeks: number): string {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + (weeks * 7));
  return end.toISOString();
}

/**
 * Calculate the current week of a cycle based on start date
 */
export function getCurrentCycleWeek(cycleStartDate: string, lengthInWeeks: number): number {
  const startDate = new Date(cycleStartDate);
  const today = new Date();
  
  const diffTime = today.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  
  // Return week number (1-based), capped at cycle length
  return Math.max(1, Math.min(diffWeeks + 1, lengthInWeeks));
}
