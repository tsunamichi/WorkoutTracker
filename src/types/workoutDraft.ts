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
  /** Display / matching label */
  name: string;
  /** Library exercise id when resolved */
  exerciseId?: string;
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
