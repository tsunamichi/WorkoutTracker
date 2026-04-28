/**
 * Editable builder state — not persisted until the user saves a **WorkoutDefinition**
 * (`WorkoutTemplate` in the store).
 *
 * Related concepts:
 * - **WorkoutLog / history row**: completed `ScheduledWorkout` + `sessions` entries are immutable.
 * - **WorkoutSnapshot**: `titleSnapshot` + `exercisesSnapshot` on a scheduled instance (frozen at schedule / completion).
 * - **WorkoutDraft** (this file): ephemeral builder state only.
 */
export type WorkoutDraftLine = {
  id: string;
  /** Display label (from catalog name when resolved) */
  name: string;
  /** Library exercise id — required for save once resolved */
  exerciseId?: string;
  /**
   * Import/paste could not auto-resolve to one exercise — user must pick from library
   * or create custom before save.
   */
  resolutionStatus?: 'needs_pick';
  /** When ambiguous import — short list for quick pick */
  matchCandidateIds?: string[];
  /**
   * Optional main-template seed copied from a scheduled workout snapshot.
   * Keeps set/rep/load structure when reusing recent workouts.
   */
  templateSeed?: {
    sets?: number;
    reps?: string | number;
    weight?: number;
    isTimeBased?: boolean;
    isPerSide?: boolean;
    restSeconds?: number;
    cycleId?: string;
    cycleOrder?: number;
  };
};

export type WorkoutDraft = {
  id: string;
  name: string;
  lines: WorkoutDraftLine[];
  /** Pasted name collided with an active definition — user must rename before save */
  requiresRenameBeforeSave?: boolean;
  /** When `requiresRenameBeforeSave`, preferred starting title */
  suggestedDisplayName?: string;
  /**
   * When opening from history and the title matches an existing reusable template,
   * saving updates this template instead of creating a duplicate.
   */
  linkedTemplateId?: string;
};

/** Serializable route payload for WorkoutBuilder */
export type WorkoutBuilderInitialDraftPayload = {
  drafts: WorkoutDraft[];
  activeIndex?: number;
};
