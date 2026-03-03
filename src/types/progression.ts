/**
 * Progression Rules – types for v1 (double progression, no deload/RPE).
 */

export type ProgressionMode = 'double' | 'weight_only' | 'reps_only';

export interface ProgressionGroup {
  id: string;
  name: string;
  orderIndex: number;
  repRangeMin: number;
  repRangeMax: number;
  weightIncrement: number;
  progressionMode: ProgressionMode;
  exerciseIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProgressionRule {
  id: string;
  exerciseId: string;
  groupId: string | null;
  repRangeMin: number | null;
  repRangeMax: number | null;
  weightIncrement: number | null;
  progressionMode: ProgressionMode | null;
  updatedAt?: string;
}

export interface ProgressionDefaults {
  repRangeMin: number;
  repRangeMax: number;
  weightIncrement: number;
  progressionMode: ProgressionMode;
}

/** Resolved rule for an exercise (group or rule override + defaults). */
export interface EffectiveProgressionRule {
  repRangeMin: number;
  repRangeMax: number;
  weightIncrement: number;
  progressionMode: ProgressionMode;
  source: 'rule' | 'group' | 'defaults';
}

export type ProgressionSuggestionRationale = 'increase_weight' | 'add_reps' | 'repeat';

export interface ProgressionSuggestion {
  exerciseId: string;
  templateItemId?: string;
  suggestedWeight: number;
  suggestedRepsMin: number;
  suggestedRepsMax: number;
  rationale: ProgressionSuggestionRationale;
  rationaleMessage?: string;
  source: 'last_log' | 'template_only' | 'no_log';
}

/** One working set from a completed log (for suggestion input). */
export interface LastLogSet {
  weight: number;
  reps: number;
  setNumber: number;
}

export interface LastLogForExercise {
  date: string;
  workingSets: LastLogSet[];
}
