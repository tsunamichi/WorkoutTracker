import { buildExerciseWeightProgressRows } from './buildExerciseWeightProgressRows';
import type { WorkoutProgress } from '../types';

describe('buildExerciseWeightProgressRows', () => {
  it('aggregates first and highest weight per exercise from detailed progress', () => {
    const detailedWorkoutProgress: Record<string, WorkoutProgress> = {
      'sw-1': {
        workoutKey: 'sw-1',
        lastUpdated: '2026-01-10T12:00:00.000Z',
        exercises: {
          item1: {
            exerciseId: 'ex-bench',
            sets: [
              { setNumber: 1, weight: 135, reps: 8, completed: true },
              { setNumber: 2, weight: 145, reps: 6, completed: true },
            ],
          },
        },
      },
      'sw-2': {
        workoutKey: 'sw-2',
        lastUpdated: '2026-05-20T12:00:00.000Z',
        exercises: {
          item1: {
            exerciseId: 'ex-bench',
            sets: [{ setNumber: 1, weight: 185, reps: 5, completed: true }],
          },
        },
      },
    };

    const rows = buildExerciseWeightProgressRows({
      detailedWorkoutProgress,
      scheduledWorkouts: [
        {
          id: 'sw-1',
          date: '2026-01-12',
          templateId: 'tpl',
          status: 'completed',
        } as any,
        {
          id: 'sw-2',
          date: '2026-05-20',
          templateId: 'tpl',
          status: 'completed',
        } as any,
      ],
      sessions: [],
      exercises: [{ id: 'ex-bench', name: 'Bench Press', category: 'Chest', equipment: 'Barbell', isCustom: false }],
      pinnedKeyLifts: ['ex-bench'],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].exerciseName).toBe('Bench Press');
    expect(rows[0].firstLoggedWeightLbs).toBe(135);
    expect(rows[0].firstLoggedDate).toBe('2026-01-12');
    expect(rows[0].highestLoggedWeightLbs).toBe(185);
    expect(rows[0].highestLoggedDate).toBe('2026-05-20');
    expect(rows[0].isKeyLift).toBe(true);
  });

  it('excludes exercises without valid weighted sets', () => {
    const rows = buildExerciseWeightProgressRows({
      detailedWorkoutProgress: {
        'sw-1': {
          workoutKey: 'sw-1',
          lastUpdated: '2026-01-10T12:00:00.000Z',
          exercises: {
            item1: {
              exerciseId: 'ex-pushup',
              sets: [{ setNumber: 1, weight: 0, reps: 12, completed: true }],
            },
          },
        },
      },
      scheduledWorkouts: [{ id: 'sw-1', date: '2026-01-10', templateId: 'tpl', status: 'completed' } as any],
      sessions: [],
      exercises: [{ id: 'ex-pushup', name: 'Push-up', category: 'Chest', equipment: 'Bodyweight', isCustom: false }],
      pinnedKeyLifts: [],
    });

    expect(rows).toHaveLength(0);
  });
});
