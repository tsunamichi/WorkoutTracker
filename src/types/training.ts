// Clean training architecture types
// Separates reusable templates from scheduled instances

// ============================================
// EXERCISES (Catalog)
// ============================================

export type Exercise = {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles?: string[];
  equipment: string[];
  notes?: string;
  isCustom?: boolean;
};

// ============================================
// WARM-UP ITEMS & UNIFIED EXERCISE INSTANCES
// ============================================

// DEPRECATED: Old warmup structure (kept for migration)
export type WarmupItem_DEPRECATED = {
  id: string;
  exerciseName: string;
  sets: number;
  reps: number; // if isTimeBased, this is seconds; otherwise it's reps
  weight: number; // in lbs (internal storage)
  isTimeBased: boolean;
  isPerSide?: boolean; // if true, timer runs for one side, then 10s countdown, then repeats for other side
  cycleId?: string; // optional ID to group warmup items in a cycle/circuit
  cycleOrder?: number; // order within the cycle (0-indexed)
};

// Unified structure for both warmup and workout exercises
export type ExerciseInstanceMode = 'reps' | 'time';

export type ExerciseInstanceSet = {
  id: string;
  reps?: number;        // required when mode === "reps"
  durationSec?: number; // required when mode === "time"
  weight?: number;      // optional, in lbs (stored)
};

export type ExerciseInstance = {
  id: string;
  movementId: string; // reference to Exercise in library
  mode: ExerciseInstanceMode;
  sets: ExerciseInstanceSet[];
  restSec?: number;
};

// Warm Up Set Template (reusable warmup routine)
export type WarmUpSetTemplate = {
  id: string;
  name: string;
  items: ExerciseInstance[];
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
};

// For backward compatibility, alias WarmupItem to ExerciseInstance
// This allows gradual migration
export type WarmupItem = ExerciseInstance;

// ============================================
// WORKOUT TEMPLATES (Reusable Definitions)
// ============================================

export type WorkoutTemplateExercise = {
  id: string;
  exerciseId: string;
  order: number;
  sets: number;
  reps: string | number; // string for "8-10", "AMRAP", or numeric
  weight?: number; // optional placeholder
  isTimeBased?: boolean; // true for time-based exercises (seconds instead of reps)
  restSeconds?: number; // optional
  cycleId?: string; // optional ID to group exercises in a cycle/superset
  cycleOrder?: number; // order within the cycle (0-indexed)
};

export type WorkoutTemplate = {
  id: string;
  kind: 'workout';
  name: string;
  warmupItems: WarmupItem[]; // optional array; can be empty
  items: WorkoutTemplateExercise[]; // formerly "exercises"; can be empty only during draft
  createdAt: string; // ISO
  updatedAt: string; // ISO
  lastUsedAt: string | null; // updates ONLY when applied to schedule
  usageCount: number; // increments ONLY when applied to schedule
  source?: 'user' | 'ai' | 'import'; // optional but helpful
};

// ============================================
// SCHEDULED WORKOUTS (Dated Instances)
// ============================================

export type ScheduledWorkoutStatus = 'planned' | 'in_progress' | 'completed';

export type ScheduledWorkoutSource = 'manual' | 'cycle';

export type WarmupCompletionState = {
  completedItems: string[]; // warmup item IDs
};

export type WorkoutCompletionState = {
  completedExercises: Record<string, boolean>; // exerciseId -> completed
  completedSets: Record<string, number[]>; // exerciseId -> array of completed set indices
};

export type ScheduledWorkout = {
  id: string;
  date: string; // YYYY-MM-DD (local)
  templateId: string; // points to WorkoutTemplate used to create this instance
  
  // Snapshots (copied at time of scheduling)
  titleSnapshot: string; // copy of template name
  warmupSnapshot: WarmupItem[]; // copy at time of scheduling
  exercisesSnapshot: WorkoutTemplateExercise[]; // copy at time of scheduling
  
  // Completion state
  warmupCompletion: WarmupCompletionState;
  workoutCompletion: WorkoutCompletionState;
  status: ScheduledWorkoutStatus;
  startedAt: string | null;
  completedAt: string | null;
  
  // Program metadata (required for plan/cycle scheduling)
  source: ScheduledWorkoutSource;
  programId: string | null; // cyclePlanId
  programName: string | null;
  weekIndex: number | null;
  dayIndex: number | null;
  
  // Integrity flags
  isLocked: boolean; // true when completed; enforce lock rules
  
  // Legacy
  notes?: string;
  cyclePlanId?: string; // deprecated, use programId
};

// ============================================
// PLAN TEMPLATES (Cycle Plans / Programs)
// ============================================

export type PlanSubtype = 'plan' | 'cycle';

export type CycleDayMapping =
  | { kind: 'weekdays'; weekdays: number[] } // 0=Sun, 1=Mon, ..., 6=Sat
  | { kind: 'daysPerWeek'; daysPerWeek: number }; // simple X days/week

export type PlanStructure = {
  daysPerWeek: number;
  weeks: number;
  mapping: CycleDayMapping;
  templateIdsByWeekday: Partial<Record<number, string>>; // weekday (0-6) -> templateId
};

export type PlanTemplate = {
  id: string;
  kind: 'plan';
  subtype: PlanSubtype;
  name: string;
  structure: PlanStructure;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  lastUsedAt: string | null; // updates ONLY when applied to schedule
  usageCount: number; // increments ONLY when applied to schedule
};

// Backward compatibility alias
export type CyclePlan = {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  weeks: number;
  mapping: CycleDayMapping;
  templateIdsByWeekday: Partial<Record<number, string>>; // weekday (0-6) -> templateId
  active: boolean;
  archivedAt?: string; // ISO timestamp when archived
  createdAt: string; // ISO
  updatedAt: string; // ISO
  lastUsedAt?: string | null; // NEW: updates ONLY when applied to schedule
  usageCount?: number; // NEW: increments ONLY when applied to schedule
};

// ============================================
// HELPER TYPES
// ============================================

export type ConflictResolution = 'replace' | 'cancel';

export type ScheduleWorkoutAction = 
  | { action: 'schedule'; date: string }
  | { action: 'addToCycle'; cyclePlanId?: string }
  | { action: 'done' };

export type CycleConflictResolution = 'replace' | 'keep' | 'cancel';

export type ConflictItem = {
  date: string; // YYYY-MM-DD
  existing: ScheduledWorkout;
  incomingTemplateName: string;
  isLocked: boolean; // true if existing workout is completed (cannot be replaced)
};

// Per-conflict decision for atomic conflict resolution
export type ConflictDecision = 'keep' | 'replace';

// Conflict resolution model for atomic plan apply
export type ConflictResolutionMap = Record<string, ConflictDecision>; // date -> decision

// Summary returned after atomic plan apply
export type PlanApplySummary = {
  success: boolean;
  applied: number; // workouts successfully scheduled
  kept: number; // existing workouts kept
  replaced: number; // existing workouts replaced
  locked: number; // completed workouts that were preserved
};
