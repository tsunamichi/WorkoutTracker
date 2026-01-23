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
// WORKOUT TEMPLATES (Reusable Definitions)
// ============================================

export type WorkoutTemplateExercise = {
  exerciseId: string;
  order: number;
  sets: number;
  reps: number;
  weight?: number; // optional placeholder
  restSeconds?: number; // optional
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  items: WorkoutTemplateExercise[];
};

// ============================================
// SCHEDULED WORKOUTS (Dated Instances)
// ============================================

export type ScheduledWorkoutStatus = 'planned' | 'completed' | 'skipped';

export type ScheduledWorkoutSource = 'manual' | 'cycle';

export type ScheduledWorkout = {
  id: string;
  date: string; // YYYY-MM-DD (local)
  templateId: string;
  source: ScheduledWorkoutSource;
  cyclePlanId?: string; // present if source='cycle'
  status: ScheduledWorkoutStatus;
  completedAt?: string; // ISO timestamp when completed
  notes?: string;
};

// ============================================
// CYCLE PLANS (Template → Schedule Generators)
// ============================================

export type CycleDayMapping =
  | { kind: 'weekdays'; weekdays: number[] } // 0=Sun, 1=Mon, ..., 6=Sat
  | { kind: 'daysPerWeek'; daysPerWeek: number }; // simple X days/week

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
  templateName: string;
};
