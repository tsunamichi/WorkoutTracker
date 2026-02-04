// Core types for Workout Tracker

export type WorkoutType = 'Push' | 'Pull' | 'Legs' | 'Full Body' | 'Mobility' | 'Other';

export type ExerciseCategory = 
  | 'Chest' 
  | 'Back' 
  | 'Legs' 
  | 'Shoulders' 
  | 'Arms' 
  | 'Core' 
  | 'Full Body' 
  | 'Mobility' 
  | 'Cardio' 
  | 'Other';

export type ProgressionType = 'weight' | 'reps' | 'double' | 'none';

export interface Cycle {
  id: string;
  cycleNumber: number; // NEW: Cycles identified by number (Cycle 1, Cycle 2, etc.)
  startDate: string;
  lengthInWeeks: number;
  endDate?: string; // Auto-calculated from startDate + lengthInWeeks
  workoutsPerWeek: number;
  goal?: string;
  notes?: string;
  isActive: boolean;
  completionDate?: string; // NEW: When cycle was finished
  workoutTemplates: WorkoutTemplate[];
  createdAt?: string;
}

export interface WorkoutTemplate {
  id: string;
  cycleId: string;
  name: string; // e.g., "Push A", "Pull B"
  workoutType: WorkoutType;
  dayOfWeek?: number; // 1 = Monday, 7 = Sunday
  orderIndex: number;
  week?: number; // Which week of the cycle this template belongs to
  exercises: WorkoutTemplateExercise[];
}

// NEW: For assigning workouts to specific dates
export interface WorkoutAssignment {
  id: string;
  date: string; // YYYY-MM-DD
  workoutTemplateId: string;
  cycleId: string;
  completed: boolean;
}

export interface WorkoutTemplateExercise {
  id: string;
  exerciseId: string;
  orderIndex: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax?: number;
  targetWeight?: number;
  notes?: string;
  
  // NEW: Progression logic
  progressionType: ProgressionType;
  progressionValue?: number; // e.g., 2.5 for +2.5kg or 1 for +1 rep
  repRangeMin?: number; // For double progression
  repRangeMax?: number; // For double progression
  
  // NEW: Week-specific overrides (exact user input, no calculations)
  weeklyOverrides?: {
    [weekNumber: number]: {
      targetWeight?: number;
      targetRepsMin?: number;
      targetRepsMax?: number;
      targetSets?: number;
    };
  };
}

export type ExerciseMeasurementType = 'reps' | 'time';

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  equipment?: string;
  isCustom: boolean;
  measurementType?: ExerciseMeasurementType; // 'reps' (default) or 'time' (for isometric/time-based exercises)
  notes?: string;
}

export interface ExercisePR {
  exerciseId: string;
  exerciseName: string;
  weight: number; // Heaviest weight ever lifted
  reps: number; // Reps achieved at that weight
  date: string; // When the PR was set
}

export interface WorkoutSession {
  id: string;
  cycleId?: string;
  workoutTemplateId?: string;
  cycleWeekNumber?: number; // NEW: Which week of the cycle (for progression)
  date: string;
  startTime: string;
  endTime?: string;
  notes?: string;
  sets: WorkoutSet[];
  warmupSets?: WarmupSet[]; // NEW: Warmup exercise sets
  accessorySets?: AccessorySet[]; // NEW: Accessory/core exercise sets
}

export interface WarmupSet {
  id: string;
  exerciseName: string;
  setIndex: number; // which round/set
  weight?: number; // in lbs (internal storage)
  reps?: number; // reps or seconds depending on isTimeBased
  isTimeBased: boolean;
  isPerSide?: boolean;
  completedAt: string; // ISO timestamp
}

export interface AccessorySet {
  id: string;
  exerciseName: string;
  setIndex: number; // which round/set
  weight?: number; // in lbs (internal storage)
  reps?: number; // reps or seconds depending on isTimeBased
  isTimeBased: boolean;
  isPerSide?: boolean;
  completedAt: string; // ISO timestamp
}

export interface WorkoutSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  setIndex: number;
  weight: number;
  reps: number;
  rpe?: number;
  restSecondsPlanned?: number;
  restSecondsActual?: number;
  notes?: string;
  isCompleted: boolean;
}

export interface BodyWeightEntry {
  id: string;
  date: string;
  weight: number;
  unit: 'kg' | 'lb';
  notes?: string;
}

export interface ProgressPhoto {
  id: string;
  date: string;
  imageUri: string;
  label: 'Front' | 'Side' | 'Back';
  notes?: string;
}

export interface AppSettings {
  useKg: boolean;
  language?: 'en' | 'es';
  monthlyProgressReminderEnabled: boolean;
  monthlyProgressReminderDay: number;
  restTimerDefaultSeconds: number;
  notificationsEnabled?: boolean;
  notificationsPermissionPrompted?: boolean;
  profileAvatarUri?: string;
  // AI Trainer settings
  openaiApiKey?: string;
  trainerGoals?: string; // User's fitness goals
  trainerPersonality?: string; // Preferred trainer personality/style
  // Exercise preferences
  barbellMode?: Record<string, boolean>; // exerciseId -> barbell mode preference
}

// Helper type for cycle creation flow
export interface CycleFormData {
  cycleNumber: number;
  lengthInWeeks: number;
  workoutsPerWeek: number;
  goal?: string;
  startDate: Date;
}

// NEW: Trainer conversation types
export type ConversationType = 'advice' | 'cycle-creation';

export interface TrainerConversation {
  id: string;
  type: ConversationType;
  cycleNumber?: number; // Only for cycle-creation type
  title: string; // "Advice" or "Cycle 6 Creation"
  messages: TrainerMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface TrainerMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
}

// Helper type for workout template creation
export interface WorkoutTemplateFormData {
  name: string;
  workoutType: WorkoutType;
  dayOfWeek?: number;
  exercises: WorkoutTemplateExercise[];
}

// Exercise set progress data
export interface SetProgress {
  setNumber: number;
  weight: number;
  reps: number;
  completed: boolean;
}

// Exercise progress within a workout
export interface ExerciseProgress {
  exerciseId: string;
  sets: SetProgress[];
  skipped?: boolean; // If true, exercise is skipped and won't count towards completion
}

// Complete workout progress
export interface WorkoutProgress {
  workoutKey: string; // workoutTemplateId-date
  exercises: Record<string, ExerciseProgress>; // exerciseId -> progress
  lastUpdated: string;
}

// HIIT Timer
export interface HIITTimer {
  id: string;
  name: string;
  work: number; // seconds
  workRest: number; // seconds
  sets: number;
  rounds: number;
  roundRest: number; // seconds
  createdAt: string;
  isTemplate: boolean;
}

// HIIT Timer Session (completed interval)
export interface HIITTimerSession {
  id: string;
  timerId: string; // Reference to the timer template
  timerName: string;
  date: string; // YYYY-MM-DD
  completedAt: string; // ISO timestamp
  totalDuration: number; // Total time in seconds
}
