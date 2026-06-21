import type { WorkoutProgress, WorkoutSession } from '../types';
import type { ScheduledWorkout } from '../types/training';
import { buildWorkoutHistoryByDateFromSchedule } from './buildWorkoutHistoryByDateFromSchedule';
import { getLatestExerciseLog } from './getLatestExerciseLog';
import {
  applyPersonalCatalogMigrationVersion,
  countCompletedLoggedSets,
  findExerciseByNormalizedName,
  migrateToPersonalExerciseCatalog,
  normalizeExerciseName,
  PERSONAL_CATALOG_MIGRATION_VERSION,
} from './personalExerciseCatalog';
import { buildMigrationCatalogLookup } from './legacyMigrationExerciseLookup';
import { effectiveRuleForProgressionType, resolveProgressionType } from './resolveProgressionType';

describe('normalizeExerciseName', () => {
  it('trims, lowercases, and collapses whitespace', () => {
    expect(normalizeExerciseName('  Bench   Press ')).toBe('bench press');
  });
});

describe('findExerciseByNormalizedName', () => {
  it('matches aliases and prevents duplicate creation', () => {
    const catalog = [
      {
        id: 'ex-1',
        name: 'Barbell Bench Press',
        canonicalName: 'barbell bench press',
        aliases: ['bench press'],
        category: 'Chest' as const,
        isCustom: true,
      },
    ];
    expect(findExerciseByNormalizedName(catalog, 'Bench Press')?.id).toBe('ex-1');
    expect(findExerciseByNormalizedName(catalog, 'barbell bench press')?.id).toBe('ex-1');
  });
});

describe('getLatestExerciseLog', () => {
  it('returns the most recent workout by date then timestamp', () => {
    const sessions: WorkoutSession[] = [];
    const scheduledWorkouts: ScheduledWorkout[] = [
      { id: 'sw-old', date: '2026-01-01' } as ScheduledWorkout,
      { id: 'sw-new', date: '2026-05-01' } as ScheduledWorkout,
    ];
    const detailedWorkoutProgress: Record<string, WorkoutProgress> = {
      'sw-old': {
        workoutKey: 'sw-old',
        lastUpdated: '2026-01-01T18:00:00.000Z',
        exercises: {
          item1: {
            exerciseId: 'ex-bench',
            sets: [{ setNumber: 1, weight: 135, reps: 8, completed: true }],
          },
        },
      },
      'sw-new': {
        workoutKey: 'sw-new',
        lastUpdated: '2026-05-01T10:00:00.000Z',
        exercises: {
          item1: {
            exerciseId: 'ex-bench',
            sets: [{ setNumber: 1, weight: 185, reps: 5, completed: true }],
          },
        },
      },
    };

    const latest = getLatestExerciseLog('ex-bench', sessions, detailedWorkoutProgress, scheduledWorkouts);
    expect(latest?.date).toBe('2026-05-01');
    expect(latest?.workingSets[0]?.weight).toBe(185);
  });
});

describe('resolveProgressionType', () => {
  it('defaults to accessory when no item or exercise type is set', () => {
    expect(resolveProgressionType(undefined, undefined)).toBe('accessory');
    const rule = effectiveRuleForProgressionType('accessory');
    expect(rule.repRangeMin).toBe(10);
    expect(rule.repRangeMax).toBe(15);
    expect(rule.weightIncrement).toBe(2.5);
  });

  it('uses exercise defaultProgressionType when item has none', () => {
    expect(
      resolveProgressionType(undefined, { defaultProgressionType: 'main_lower' }),
    ).toBe('main_lower');
  });
});

describe('legacy migration catalog lookup', () => {
  it('resolves seed ids from the static library when absent from stored catalog', () => {
    const lookup = buildMigrationCatalogLookup([]);
    expect(lookup.get('seed-0')?.name).toBe('Barbell Bench Press');
  });
});

describe('migrateToPersonalExerciseCatalog', () => {
  const baseSettings = {
    useKg: false,
    monthlyProgressReminderEnabled: true,
    monthlyProgressReminderDay: 1,
    restTimerDefaultSeconds: 120,
  };

  it('keeps only logged exercises and is idempotent', () => {
    const seedCatalog = [
      {
        id: 'seed-0',
        name: 'Barbell Bench Press',
        canonicalName: 'barbell bench press',
        category: 'Chest' as const,
        isCustom: false,
      },
      {
        id: 'seed-1',
        name: 'Back Squat',
        canonicalName: 'back squat',
        category: 'Legs' as const,
        isCustom: false,
      },
    ];

    const input = {
      exercises: seedCatalog,
      sessions: [],
      detailedWorkoutProgress: {
        'sw-1': {
          workoutKey: 'sw-1',
          lastUpdated: '2026-03-01T12:00:00.000Z',
          exercises: {
            t1: {
              exerciseId: 'seed-0',
              sets: [{ setNumber: 1, weight: 135, reps: 8, completed: true }],
            },
          },
        },
      },
      exercisePRs: [],
      workoutTemplates: [],
      scheduledWorkouts: [{ id: 'sw-1', date: '2026-03-01' } as ScheduledWorkout],
      progressionGroups: [],
      progressionRules: [],
      pinnedKeyLifts: [],
      settings: baseSettings,
    };

    const beforeCount = countCompletedLoggedSets(input);
    const first = migrateToPersonalExerciseCatalog(input);
    expect(first.changed).toBe(true);
    expect(first.exercises).toHaveLength(1);
    expect(first.exercises[0]?.name).toBe('Barbell Bench Press');
    expect(first.settings.personalCatalogMigrationVersion).toBeUndefined();

    const afterCount = countCompletedLoggedSets(first);
    expect(afterCount).toBe(beforeCount);

    const completed = applyPersonalCatalogMigrationVersion(first.settings);
    expect(completed.personalCatalogMigrationVersion).toBe(PERSONAL_CATALOG_MIGRATION_VERSION);

    const second = migrateToPersonalExerciseCatalog({
      ...first,
      settings: completed,
    });
    expect(second.changed).toBe(false);
    expect(second.exercises).toHaveLength(1);
  });

  it('resolves orphan seed exerciseId via static library during migration', () => {
    const input = {
      exercises: [],
      sessions: [],
      detailedWorkoutProgress: {
        'sw-1': {
          workoutKey: 'sw-1',
          lastUpdated: '2026-03-01T12:00:00.000Z',
          exercises: {
            t1: {
              exerciseId: 'seed-0',
              sets: [{ setNumber: 1, weight: 135, reps: 8, completed: true }],
            },
          },
        },
      },
      exercisePRs: [],
      workoutTemplates: [],
      scheduledWorkouts: [
        {
          id: 'sw-1',
          date: '2026-03-01',
          exercisesSnapshot: [{ id: 't1', exerciseId: 'seed-0', orderIndex: 0 }],
        } as unknown as ScheduledWorkout,
      ],
      progressionGroups: [],
      progressionRules: [],
      pinnedKeyLifts: [],
      settings: baseSettings,
    };

    const result = migrateToPersonalExerciseCatalog(input);
    expect(result.exercises[0]?.name).toBe('Barbell Bench Press');
    expect(result.scheduledWorkouts[0]?.exercisesSnapshot?.[0]?.nameSnapshot).toBe(
      'Barbell Bench Press',
    );
  });

  it('preserves custom exercise ids and latest-log lookup after remap', () => {
    const customId = 'ex-user-custom-bench';
    const input = {
      exercises: [
        {
          id: customId,
          name: 'My Bench',
          canonicalName: 'my bench',
          category: 'Chest' as const,
          isCustom: true,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      sessions: [],
      detailedWorkoutProgress: {
        'sw-1': {
          workoutKey: 'sw-1',
          lastUpdated: '2026-03-01T12:00:00.000Z',
          exercises: {
            t1: {
              exerciseId: customId,
              sets: [{ setNumber: 1, weight: 100, reps: 10, completed: true }],
            },
          },
        },
      },
      exercisePRs: [],
      workoutTemplates: [],
      scheduledWorkouts: [{ id: 'sw-1', date: '2026-03-01' } as ScheduledWorkout],
      progressionGroups: [],
      progressionRules: [],
      pinnedKeyLifts: [],
      settings: baseSettings,
    };

    const result = migrateToPersonalExerciseCatalog(input);
    expect(result.exercises[0]?.id).toBe(customId);

    const latest = getLatestExerciseLog(
      customId,
      result.sessions,
      result.detailedWorkoutProgress,
      result.scheduledWorkouts,
    );
    expect(latest?.workingSets[0]?.weight).toBe(100);
  });

  it('keeps history exercise names via nameSnapshot after catalog shrink', () => {
    const input = {
      exercises: [
        {
          id: 'seed-0',
          name: 'Barbell Bench Press',
          canonicalName: 'barbell bench press',
          category: 'Chest' as const,
          isCustom: false,
        },
      ],
      sessions: [],
      detailedWorkoutProgress: {
        'sw-1': {
          workoutKey: 'sw-1',
          lastUpdated: '2026-03-01T12:00:00.000Z',
          exercises: {
            t1: {
              exerciseId: 'seed-0',
              sets: [{ setNumber: 1, weight: 135, reps: 8, completed: true }],
            },
          },
        },
      },
      exercisePRs: [],
      workoutTemplates: [],
      scheduledWorkouts: [
        {
          id: 'sw-1',
          date: '2026-03-01',
          status: 'completed',
          completedAt: '2026-03-01T18:00:00.000Z',
          isLocked: true,
          mainCompletion: { completedItems: ['t1-set-0'] },
          exercisesSnapshot: [{ id: 't1', exerciseId: 'seed-0', orderIndex: 0 }],
        } as unknown as ScheduledWorkout,
      ],
      progressionGroups: [],
      progressionRules: [],
      pinnedKeyLifts: [],
      settings: baseSettings,
    };

    const migrated = migrateToPersonalExerciseCatalog(input);
    const history = buildWorkoutHistoryByDateFromSchedule(
      migrated.scheduledWorkouts,
      () => ({ completedItems: ['t1-set-0'], totalItems: 1, percentage: 100 }),
      migrated.detailedWorkoutProgress,
      migrated.exercises,
      false,
    );

    const entry = history.get('2026-03-01');
    expect(entry?.exercises[0]?.name).toBe('Barbell Bench Press');
    expect(entry?.exercises[0]?.sets[0]?.weight).toBe('135');
  });
});
