/** Per-exercise strength summary for the History → Weight progress tab. */
export type ExerciseWeightProgressRow = {
  exerciseId: string;
  exerciseName: string;
  firstLoggedWeightLbs: number;
  firstLoggedDate: string;
  highestLoggedWeightLbs: number;
  highestLoggedDate: string;
  isKeyLift: boolean;
};

export type HistoryTabId = 'last4Weeks' | 'weightProgress';
