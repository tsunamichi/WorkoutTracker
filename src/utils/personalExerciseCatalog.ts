import type {
  AppSettings,
  Exercise,
  ExercisePR,
  WorkoutProgress,
  WorkoutSession,
} from '../types';
import type { ProgressionGroup, ProgressionRule } from '../types/progression';
import type { ScheduledWorkout, WorkoutTemplate, WorkoutTemplateExercise } from '../types/training';
import { normalizeExerciseLabel } from './exerciseIdentity';
import {
  buildMigrationCatalogLookup,
  resolveMigrationExerciseName,
} from './legacyMigrationExerciseLookup';
import {
  inferDefaultProgressionTypeFromGroupId,
  type UserExerciseProgressionType,
} from './resolveProgressionType';
import * as storage from '../storage';

export const PERSONAL_CATALOG_MIGRATION_VERSION = 1;

/** Alias requested in product spec — same normalization as catalog search. */
export const normalizeExerciseName = normalizeExerciseLabel;

type LoggedExerciseRef = {
  exerciseId: string;
  displayName: string;
};

export type PersonalCatalogMigrationInput = {
  exercises: Exercise[];
  sessions: WorkoutSession[];
  detailedWorkoutProgress: Record<string, WorkoutProgress>;
  exercisePRs: ExercisePR[];
  workoutTemplates: WorkoutTemplate[];
  scheduledWorkouts: ScheduledWorkout[];
  progressionGroups: ProgressionGroup[];
  progressionRules: ProgressionRule[];
  pinnedKeyLifts: string[];
  settings: AppSettings;
};

export type PersonalCatalogMigrationResult = PersonalCatalogMigrationInput & {
  changed: boolean;
};

function collectLoggedExerciseRefs(
  input: PersonalCatalogMigrationInput,
  legacyLookup: Map<string, Exercise>,
): LoggedExerciseRef[] {
  const refs: LoggedExerciseRef[] = [];

  for (const session of input.sessions) {
    for (const set of session.sets) {
      if (!set.isCompleted) continue;
      const displayName = resolveMigrationExerciseName(set.exerciseId, legacyLookup);
      refs.push({ exerciseId: set.exerciseId, displayName });
    }
  }

  for (const wp of Object.values(input.detailedWorkoutProgress)) {
    for (const ep of Object.values(wp.exercises)) {
      if (ep.skipped) continue;
      const completed = (ep.sets ?? []).some(s => s.completed);
      if (!completed) continue;
      const displayName = resolveMigrationExerciseName(ep.exerciseId, legacyLookup);
      refs.push({ exerciseId: ep.exerciseId, displayName });
    }
  }

  for (const pr of input.exercisePRs) {
    const displayName =
      pr.exerciseName?.trim() ||
      resolveMigrationExerciseName(pr.exerciseId, legacyLookup);
    refs.push({ exerciseId: pr.exerciseId, displayName });
  }

  return refs;
}

function progressionTypeForExerciseId(
  exerciseId: string,
  groups: ProgressionGroup[],
): UserExerciseProgressionType | undefined {
  for (const group of groups) {
    if (!group.exerciseIds.includes(exerciseId)) continue;
    return inferDefaultProgressionTypeFromGroupId(group.id);
  }
  return undefined;
}

function mergeAliases(existing: string[], ...names: string[]): string[] {
  const out = new Set(existing.map(normalizeExerciseLabel));
  const aliases: string[] = [...(existing ?? [])];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const norm = normalizeExerciseLabel(trimmed);
    if (!norm || out.has(norm)) continue;
    out.add(norm);
    aliases.push(trimmed);
  }
  return aliases;
}

function pickPreferredExercise(primary: Exercise, candidate: Exercise): Exercise {
  if (primary.createdAt && !candidate.createdAt) return primary;
  if (!primary.createdAt && candidate.createdAt) return candidate;
  if (primary.isCustom && !candidate.isCustom) return primary;
  if (!primary.isCustom && candidate.isCustom) return candidate;
  return primary.createdAt && candidate.createdAt && primary.createdAt <= candidate.createdAt
    ? primary
    : candidate;
}

function buildPersonalExercise(
  displayName: string,
  source: Exercise | undefined,
  defaultProgressionType: UserExerciseProgressionType | undefined,
  now: string,
): Exercise {
  const trimmed = displayName.trim() || 'Exercise';
  const norm = normalizeExerciseLabel(trimmed);
  const slug = norm.slice(0, 40).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'ex';
  const id =
    source && (source.isCustom || source.id.startsWith('ex-user-'))
      ? source.id
      : `ex-user-${slug}`;

  return {
    id,
    name: trimmed,
    canonicalName: norm,
    aliases: mergeAliases(source?.aliases ?? [], ...(source && source.name !== trimmed ? [source.name] : [])),
    category: source?.category ?? 'Other',
    equipment: source?.equipment,
    isCustom: true,
    measurementType: source?.measurementType,
    notes: source?.notes,
    defaultProgressionType: source?.defaultProgressionType ?? defaultProgressionType,
    createdAt: source?.createdAt ?? now,
    archivedAt: source?.archivedAt,
  };
}

function attachNameSnapshotToItems(
  items: WorkoutTemplateExercise[],
  byId: Map<string, Exercise>,
): WorkoutTemplateExercise[] {
  return items.map(item => ({
    ...item,
    nameSnapshot: item.nameSnapshot ?? byId.get(item.exerciseId)?.name,
  }));
}

function remapId(id: string, idMap: Map<string, string>): string {
  return idMap.get(id) ?? id;
}

function remapIdList(ids: string[], idMap: Map<string, string>): string[] {
  return ids.map(id => remapId(id, idMap));
}

function remapDetailedProgress(
  detailedWorkoutProgress: Record<string, WorkoutProgress>,
  idMap: Map<string, string>,
): Record<string, WorkoutProgress> {
  const out: Record<string, WorkoutProgress> = {};
  for (const [key, wp] of Object.entries(detailedWorkoutProgress)) {
    out[key] = {
      ...wp,
      exercises: Object.fromEntries(
        Object.entries(wp.exercises).map(([templateItemId, ep]) => [
          templateItemId,
          { ...ep, exerciseId: remapId(ep.exerciseId, idMap) },
        ]),
      ),
    };
  }
  return out;
}

export function findExerciseByNormalizedName(exercises: Exercise[], raw: string): Exercise | undefined {
  const norm = normalizeExerciseLabel(raw);
  if (!norm) return undefined;
  return exercises.find(ex => {
    if (normalizeExerciseLabel(ex.name) === norm) return true;
    if (ex.canonicalName && normalizeExerciseLabel(ex.canonicalName) === norm) return true;
    return (ex.aliases ?? []).some(a => normalizeExerciseLabel(a) === norm);
  });
}

export function resolveExerciseByIdOrName(
  exercises: Exercise[],
  exerciseId?: string,
  nameSnapshot?: string,
): Exercise | undefined {
  if (exerciseId) {
    const byId = exercises.find(e => e.id === exerciseId);
    if (byId) return byId;
  }
  if (nameSnapshot?.trim()) {
    return findExerciseByNormalizedName(exercises, nameSnapshot);
  }
  return undefined;
}

export function buildUserExerciseDefinition(displayName: string, seed = Date.now()): Exercise {
  const now = new Date().toISOString();
  return buildPersonalExercise(displayName, undefined, 'accessory', now);
}

/**
 * Idempotent migration: shrink catalog to logged + user-created exercises only.
 * Remaps historical ids when normalized duplicates merge.
 */
export function migrateToPersonalExerciseCatalog(
  input: PersonalCatalogMigrationInput,
): PersonalCatalogMigrationResult {
  const version = input.settings.personalCatalogMigrationVersion ?? 0;
  if (version >= PERSONAL_CATALOG_MIGRATION_VERSION) {
    return { ...input, changed: false };
  }

  const now = new Date().toISOString();
  const legacyLookup = buildMigrationCatalogLookup(input.exercises);
  const oldById = legacyLookup;
  const loggedRefs = collectLoggedExerciseRefs(input, legacyLookup);

  const explicitlyCreated = input.exercises.filter(
    ex => ex.isCustom || ex.createdAt || ex.id.startsWith('ex-user-'),
  );

  const byNorm = new Map<string, Exercise>();
  const idMap = new Map<string, string>();

  const ingest = (exerciseId: string, displayName: string) => {
    const source = oldById.get(exerciseId);
    const name = (displayName.trim() || source?.name || exerciseId).trim();
    const norm = normalizeExerciseLabel(name);
    if (!norm) return;

    const progressionType =
      source?.defaultProgressionType ?? progressionTypeForExerciseId(exerciseId, input.progressionGroups);

    let personal = byNorm.get(norm);
    if (!personal) {
      personal = buildPersonalExercise(name, source, progressionType, source?.createdAt ?? now);
      byNorm.set(norm, personal);
    } else {
      personal = {
        ...personal,
        aliases: mergeAliases(personal.aliases ?? [], name, source?.name ?? ''),
        defaultProgressionType: personal.defaultProgressionType ?? progressionType,
        equipment: personal.equipment ?? source?.equipment,
        measurementType: personal.measurementType ?? source?.measurementType,
      };
      if (source) personal = pickPreferredExercise(personal, source);
      byNorm.set(norm, personal);
    }

    idMap.set(exerciseId, personal.id);
  };

  for (const ref of loggedRefs) ingest(ref.exerciseId, ref.displayName);
  for (const ex of explicitlyCreated) ingest(ex.id, ex.name);

  const personalExercises = [...byNorm.values()].filter(ex => !ex.archivedAt);

  let workoutTemplates = input.workoutTemplates.map(t => ({
    ...t,
    items: attachNameSnapshotToItems(t.items ?? [], oldById),
  }));

  let scheduledWorkouts = input.scheduledWorkouts.map(sw => ({
    ...sw,
    exercisesSnapshot: attachNameSnapshotToItems(sw.exercisesSnapshot ?? [], oldById),
  }));

  if (idMap.size > 0) {
    workoutTemplates = workoutTemplates.map(t => ({
      ...t,
      items: (t.items ?? []).map(item => ({
        ...item,
        exerciseId: remapId(item.exerciseId, idMap),
      })),
    }));
    scheduledWorkouts = scheduledWorkouts.map(sw => ({
      ...sw,
      exercisesSnapshot: (sw.exercisesSnapshot ?? []).map(item => ({
        ...item,
        exerciseId: remapId(item.exerciseId, idMap),
      })),
    }));
  }

  const sessions = input.sessions.map(session => ({
    ...session,
    sets: session.sets.map(set => ({
      ...set,
      exerciseId: remapId(set.exerciseId, idMap),
    })),
  }));

  const exercisePRs = input.exercisePRs.map(pr => {
    const mappedId = remapId(pr.exerciseId, idMap);
    const name = personalExercises.find(e => e.id === mappedId)?.name ?? pr.exerciseName;
    return { ...pr, exerciseId: mappedId, exerciseName: name };
  });

  const detailedWorkoutProgress = remapDetailedProgress(input.detailedWorkoutProgress, idMap);

  const progressionGroups = input.progressionGroups.map(g => ({
    ...g,
    exerciseIds: remapIdList(g.exerciseIds, idMap),
  }));

  const progressionRules = input.progressionRules.map(r => ({
    ...r,
    exerciseId: remapId(r.exerciseId, idMap),
  }));

  const pinnedKeyLifts = remapIdList(input.pinnedKeyLifts, idMap);

  const barbellMode = input.settings.barbellMode
    ? Object.fromEntries(
        Object.entries(input.settings.barbellMode).map(([id, enabled]) => [
          remapId(id, idMap),
          enabled,
        ]),
      )
    : input.settings.barbellMode;

  const historyExerciseOrder = input.settings.historyExerciseOrder
    ? remapIdList(input.settings.historyExerciseOrder, idMap)
    : input.settings.historyExerciseOrder;

  const settings: AppSettings = {
    ...input.settings,
    barbellMode,
    historyExerciseOrder,
  };

  return {
    exercises: personalExercises,
    sessions,
    detailedWorkoutProgress,
    exercisePRs,
    workoutTemplates,
    scheduledWorkouts,
    progressionGroups,
    progressionRules,
    pinnedKeyLifts,
    settings,
    changed: true,
  };
}

export function getSearchableExercises(exercises: Exercise[]): Exercise[] {
  return exercises.filter(ex => !ex.archivedAt);
}

/** Mark migration complete — call only after all migrated data is persisted. */
export function applyPersonalCatalogMigrationVersion(settings: AppSettings): AppSettings {
  return {
    ...settings,
    personalCatalogMigrationVersion: PERSONAL_CATALOG_MIGRATION_VERSION,
  };
}

/** Count completed set rows across sessions + detailed progress (for migration safety checks). */
export function countCompletedLoggedSets(input: PersonalCatalogMigrationInput): number {
  let count = 0;
  for (const session of input.sessions) {
    count += session.sets.filter(s => s.isCompleted).length;
  }
  for (const wp of Object.values(input.detailedWorkoutProgress)) {
    for (const ep of Object.values(wp.exercises)) {
      if (ep.skipped) continue;
      count += (ep.sets ?? []).filter(s => s.completed).length;
    }
  }
  return count;
}

/**
 * Persist migrated data sequentially; bump personalCatalogMigrationVersion last so a
 * failed run can safely rerun without marking migration complete.
 */
export async function persistPersonalCatalogMigration(
  migration: PersonalCatalogMigrationResult,
): Promise<AppSettings> {
  await storage.saveExercises(migration.exercises);
  await storage.saveSessions(migration.sessions);
  await storage.saveExercisePRs(migration.exercisePRs);
  await storage.saveWorkoutTemplates(migration.workoutTemplates);
  await storage.saveScheduledWorkouts(migration.scheduledWorkouts);
  await storage.saveProgressionGroups(migration.progressionGroups);
  await storage.saveProgressionRules(migration.progressionRules);
  await storage.saveDetailedWorkoutProgress(migration.detailedWorkoutProgress);
  await storage.savePinnedKeyLifts(migration.pinnedKeyLifts);

  const settingsWithVersion = applyPersonalCatalogMigrationVersion(migration.settings);
  await storage.saveSettings(settingsWithVersion);
  return settingsWithVersion;
}
