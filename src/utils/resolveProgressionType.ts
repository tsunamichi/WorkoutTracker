import type { Exercise } from '../types';
import type { EffectiveProgressionRule } from '../types/progression';

export type UserExerciseProgressionType = 'main_upper' | 'main_lower' | 'accessory' | 'none';

const ACCESSORY_DEFAULT: EffectiveProgressionRule = {
  repRangeMin: 10,
  repRangeMax: 15,
  weightIncrement: 2.5,
  progressionMode: 'double',
  source: 'defaults',
};

const MAIN_UPPER_DEFAULT: EffectiveProgressionRule = {
  repRangeMin: 5,
  repRangeMax: 8,
  weightIncrement: 2.5,
  progressionMode: 'double',
  source: 'defaults',
};

const MAIN_LOWER_DEFAULT: EffectiveProgressionRule = {
  repRangeMin: 5,
  repRangeMax: 8,
  weightIncrement: 5,
  progressionMode: 'double',
  source: 'defaults',
};

const NONE_DEFAULT: EffectiveProgressionRule = {
  repRangeMin: 8,
  repRangeMax: 12,
  weightIncrement: 0,
  progressionMode: 'double',
  source: 'defaults',
};

export function resolveProgressionType(
  itemProgressionType?: UserExerciseProgressionType | string | null,
  exercise?: Pick<Exercise, 'defaultProgressionType'>,
): UserExerciseProgressionType {
  const fromItem = normalizeProgressionTypeToken(itemProgressionType);
  if (fromItem) return fromItem;
  if (exercise?.defaultProgressionType) return exercise.defaultProgressionType;
  return 'accessory';
}

function normalizeProgressionTypeToken(
  raw?: UserExerciseProgressionType | string | null,
): UserExerciseProgressionType | null {
  if (!raw) return null;
  if (raw === 'main_upper' || raw === 'main_lower' || raw === 'main_down') return raw === 'main_down' ? 'main_lower' : raw;
  if (raw === 'accessory' || raw === 'none') return raw;
  return null;
}

export function effectiveRuleForProgressionType(type: UserExerciseProgressionType): EffectiveProgressionRule {
  switch (type) {
    case 'main_upper':
      return MAIN_UPPER_DEFAULT;
    case 'main_lower':
      return MAIN_LOWER_DEFAULT;
    case 'none':
      return NONE_DEFAULT;
    case 'accessory':
    default:
      return ACCESSORY_DEFAULT;
  }
}

export function inferDefaultProgressionTypeFromGroupId(groupId: string): UserExerciseProgressionType | undefined {
  if (groupId === 'pg-main-upper') return 'main_upper';
  if (groupId === 'pg-main-lower') return 'main_lower';
  if (groupId === 'pg-accessories') return 'accessory';
  return undefined;
}
