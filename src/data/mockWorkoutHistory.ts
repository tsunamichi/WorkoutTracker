import dayjs, { type Dayjs } from 'dayjs';
import type { WorkoutHistoryEntry } from '../types/workoutHistory';
import { buildSundayFirstFourWeekGrid, startOfWeekSunday } from '../utils/historyWeekGrid';

const UPPER_PUSH: Omit<WorkoutHistoryEntry, 'id' | 'date'> = {
  workoutName: 'Upper Push',
  muscleGroups: ['Chest', 'Shoulders'],
  exercises: [
    {
      name: 'Chest Dips',
      sets: [
        { weight: '5', reps: '9' },
        { weight: '5', reps: '9' },
        { weight: '5', reps: '9' },
      ],
    },
    {
      name: 'Chest Flies',
      sets: [
        { weight: '22.5', reps: '12' },
        { weight: '22.5', reps: '12' },
        { weight: '22.5', reps: '12' },
      ],
    },
    {
      name: 'Landmine Shoulder Press',
      sets: [
        { weight: '20', reps: '15' },
        { weight: '20', reps: '15' },
        { weight: '20', reps: '15' },
      ],
    },
    {
      name: 'Lateral Raises',
      sets: [
        { weight: '25', reps: '14' },
        { weight: '25', reps: '14' },
        { weight: '25', reps: '14' },
      ],
    },
  ],
};

function compactEntry(iso: string, name: string): WorkoutHistoryEntry {
  return {
    id: `${iso}-${name}`,
    date: iso,
    workoutName: name,
    exercises: [
      {
        name: 'Sample movement',
        sets: [
          { weight: '10', reps: '8' },
          { weight: '10', reps: '8' },
        ],
      },
    ],
  };
}

/**
 * Mock history keyed by ISO date for the last four Sunday-first weeks ending at `reference`.
 * Uses only dates on/before `reference` (local day) for completed workouts, except the
 * featured "Upper Push" week anchor is always populated when that Sunday is not in the future.
 */
export function buildMockWorkoutHistoryByDate(reference: Dayjs = dayjs()): Map<string, WorkoutHistoryEntry> {
  const map = new Map<string, WorkoutHistoryEntry>();
  const refDay = reference.startOf('day');
  const rows = buildSundayFirstFourWeekGrid(reference);
  const bottomSunday = startOfWeekSunday(reference);
  const featuredSunday = bottomSunday.subtract(7, 'day');

  for (const row of rows) {
    for (const cell of row) {
      if (cell.instant.isAfter(refDay, 'day')) continue;

      const diffFromBottomWeek = cell.instant.diff(bottomSunday, 'day');
      const isCurrentWeek = diffFromBottomWeek >= 0 && diffFromBottomWeek < 7;
      if (isCurrentWeek) {
        const dow = cell.instant.day();
        if (dow === 5 || dow === 6) continue;
      }

      if (cell.isoDate === featuredSunday.format('YYYY-MM-DD')) {
        map.set(cell.isoDate, {
          id: `mock-upper-push-${cell.isoDate}`,
          date: cell.isoDate,
          ...UPPER_PUSH,
        });
        continue;
      }

      const dow = cell.instant.day();
      if (dow === 0) {
        map.set(cell.isoDate, compactEntry(cell.isoDate, 'Recovery walk'));
      } else {
        const label = dow % 2 === 1 ? 'Strength A' : 'Strength B';
        map.set(cell.isoDate, compactEntry(cell.isoDate, label));
      }
    }
  }

  return map;
}
