// Manual Cycle Creation Types

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type WorkoutLength = 30 | 45 | 60 | 75 | 90;

export type CycleStatus = 'scheduled' | 'active' | 'completed';

export type ExerciseWeekPlan = {
  weekIndex: number; // 0..weeks-1
  sets?: number;
  reps?: string; // allow "8-10", "AMRAP"
  weight?: number;
  unit?: 'lb' | 'kg';
  restSec?: number;
  tempo?: string;
  notes?: string;
};

export type ExerciseBlock = {
  id: string;
  exerciseId: string; // references Exercise library
  weeks: ExerciseWeekPlan[]; // length === cycle.weeks
};

export type WorkoutDay = {
  id: string;
  weekday: Weekday;
  name?: string;
  exercises: ExerciseBlock[];
};

export type ManualCycle = {
  id: string;
  createdAt: string;
  startDate?: string; // chosen on Review screen
  weeks: number; // 1..12
  frequencyDays: Weekday[];
  workoutLength: WorkoutLength;
  status: CycleStatus;
  workouts: WorkoutDay[];
};

// Helper constants
export const DAY_ORDER: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export const WEEKDAY_FULL_LABELS: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export const WORKOUT_LENGTHS: WorkoutLength[] = [30, 45, 60, 75, 90];

