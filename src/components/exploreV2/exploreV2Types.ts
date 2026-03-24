export type ExploreV2Exercise = {
  id: string;
  exerciseName: string;
  weight?: number;
  reps?: number;
  isTimeBased?: boolean;
  exerciseId?: string;
  isPerSide?: boolean;
};

export type ExploreV2Group = {
  id: string;
  totalRounds: number;
  exercises: ExploreV2Exercise[];
};

export type PrimaryRevealedCard = 'complete' | 'up_next' | 'current';
