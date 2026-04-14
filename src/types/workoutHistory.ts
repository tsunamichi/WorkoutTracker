/**
 * Future-facing workout history log shape (local mock for now).
 */
export type WorkoutHistorySet = {
  weight: string;
  reps: string;
};

export type WorkoutHistoryExercise = {
  name: string;
  sets: WorkoutHistorySet[];
};

export type WorkoutHistoryEntry = {
  id: string;
  /** ISO calendar date `YYYY-MM-DD` (local). */
  date: string;
  workoutName: string;
  muscleGroups?: string[];
  exercises: WorkoutHistoryExercise[];
};
