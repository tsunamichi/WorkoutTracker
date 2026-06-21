import { SEED_EXERCISES } from '../constants';
import type { Exercise } from '../types';
import { normalizeExerciseLabel } from './exerciseIdentity';

/**
 * Migration-only catalog: merges persisted exercises with the legacy static seed library.
 * Never used for search/UI — only to resolve historical exerciseId → display name.
 */
export function buildStaticSeedExercisesForMigration(): Exercise[] {
  return SEED_EXERCISES.map((seed, index) => ({
    id: `seed-${index}`,
    name: seed.name,
    canonicalName: normalizeExerciseLabel(seed.name),
    category: seed.category as Exercise['category'],
    equipment: seed.equipment,
    isCustom: false,
  }));
}

export function buildMigrationCatalogLookup(storedExercises: Exercise[]): Map<string, Exercise> {
  const map = new Map<string, Exercise>();
  for (const ex of buildStaticSeedExercisesForMigration()) {
    map.set(ex.id, ex);
  }
  for (const ex of storedExercises) {
    map.set(ex.id, ex);
  }
  return map;
}

export function resolveMigrationExerciseName(
  exerciseId: string,
  lookup: Map<string, Exercise>,
): string {
  return lookup.get(exerciseId)?.name ?? exerciseId;
}
