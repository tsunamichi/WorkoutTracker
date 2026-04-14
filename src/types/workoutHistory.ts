/** Workout history detail row — built from completed scheduled workouts + detailed progress. */
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
