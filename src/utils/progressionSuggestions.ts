/**
 * Progression suggestion algorithm (v1: double progression, no deload/RPE).
 * Uses most recent completed log; suggests add reps → increase weight → repeat.
 */

import type {
  EffectiveProgressionRule,
  LastLogForExercise,
  ProgressionSuggestion,
  ProgressionSuggestionRationale,
} from '../types/progression';

/**
 * Working sets: completed sets only, sorted by set number.
 * For "pass" we require all working sets to meet the condition (double progression).
 */
function getWorkingSets(lastLog: LastLogForExercise): LastLogForExercise['workingSets'] {
  return [...lastLog.workingSets].sort((a, b) => a.setNumber - b.setNumber);
}

/**
 * Double progression pass: all working sets at or above rep max, same weight.
 */
function passedDouble(workingSets: LastLogForExercise['workingSets'], repMax: number): boolean {
  if (workingSets.length === 0) return false;
  return workingSets.every(set => set.reps >= repMax);
}

/**
 * Compute next session suggestion from last log and effective rule.
 */
export function computeNextSuggestion(
  exerciseId: string,
  rule: EffectiveProgressionRule,
  lastLog: LastLogForExercise | null,
  templateSetCount?: number,
  templateItemId?: string
): ProgressionSuggestion {
  const repMin = rule.repRangeMin;
  const repMax = rule.repRangeMax;
  const weightInc = rule.weightIncrement;

  if (!lastLog || lastLog.workingSets.length === 0) {
    return {
      exerciseId,
      templateItemId,
      suggestedWeight: 0,
      suggestedRepsMin: repMin,
      suggestedRepsMax: repMax,
      rationale: 'repeat',
      rationaleMessage: undefined,
      source: 'no_log',
    };
  }

  const workingSets = getWorkingSets(lastLog);
  const numSets = templateSetCount ?? workingSets.length;
  const refWeight = workingSets[0]?.weight ?? 0;
  const refReps = workingSets.map(s => s.reps);

  switch (rule.progressionMode) {
    case 'double': {
      if (passedDouble(workingSets, repMax)) {
        // All sets hit the rep ceiling → bump weight, reset reps to bottom of range
        return {
          exerciseId,
          templateItemId,
          suggestedWeight: refWeight + weightInc,
          suggestedRepsMin: repMin,
          suggestedRepsMax: repMax,
          rationale: 'increase_weight',
          rationaleMessage: undefined,
          source: 'last_log',
        };
      }
      // Not all sets at repMax → keep weight, target one more rep on the weakest set
      const minReps = Math.min(...refReps);
      const targetReps = Math.min(minReps + 1, repMax);
      return {
        exerciseId,
        templateItemId,
        suggestedWeight: refWeight,
        suggestedRepsMin: targetReps,
        suggestedRepsMax: repMax,
        rationale: 'add_reps',
        rationaleMessage: undefined,
        source: 'last_log',
      };
    }
    case 'weight_only': {
      return {
        exerciseId,
        templateItemId,
        suggestedWeight: refWeight + weightInc,
        suggestedRepsMin: repMin,
        suggestedRepsMax: repMax,
        rationale: 'increase_weight',
        rationaleMessage: undefined,
        source: 'last_log',
      };
    }
    case 'reps_only': {
      const repsMinSet = Math.min(...refReps);
      const targetRepsOnly = Math.min(repsMinSet + 1, repMax);
      return {
        exerciseId,
        templateItemId,
        suggestedWeight: refWeight,
        suggestedRepsMin: targetRepsOnly,
        suggestedRepsMax: repMax,
        rationale: repsMinSet >= repMax ? 'add_reps' : 'repeat',
        rationaleMessage: undefined,
        source: 'last_log',
      };
    }
    default:
      return {
        exerciseId,
        templateItemId,
        suggestedWeight: refWeight,
        suggestedRepsMin: repMin,
        suggestedRepsMax: repMax,
        rationale: 'repeat',
        source: 'last_log',
      };
  }
}
