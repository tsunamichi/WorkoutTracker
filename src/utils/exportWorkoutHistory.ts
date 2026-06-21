import dayjs from 'dayjs';
import type { Exercise } from '../types';
import type { WorkoutProgress } from '../types';
import type { ScheduledWorkout } from '../types/training';
import type { WorkoutHistoryEntry } from '../types/workoutHistory';
import {
  buildWorkoutHistoryByDateFromSchedule,
  type MainCompletionGetter,
} from './buildWorkoutHistoryByDateFromSchedule';

export type WorkoutHistoryExportPayload = {
  startDate: string;
  endDate: string;
  workouts: WorkoutHistoryEntry[];
  isEmpty: boolean;
};

export function buildWorkoutHistoryExportPayload(
  startDate: string,
  endDate: string,
  scheduledWorkouts: ScheduledWorkout[],
  getMainCompletion: MainCompletionGetter,
  detailedWorkoutProgress: Record<string, WorkoutProgress>,
  exercises: Exercise[],
  useKg: boolean,
): WorkoutHistoryExportPayload {
  const byDate = buildWorkoutHistoryByDateFromSchedule(
    scheduledWorkouts,
    getMainCompletion,
    detailedWorkoutProgress,
    exercises,
    useKg,
  );

  const workouts = [...byDate.entries()]
    .filter(([iso]) => iso >= startDate && iso <= endDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, entry]) => entry);

  return {
    startDate,
    endDate,
    workouts,
    isEmpty: workouts.length === 0,
  };
}

export function isValidHistoryDateRange(startDate: string, endDate: string): boolean {
  if (!startDate || !endDate) return false;
  return !dayjs(startDate).isAfter(dayjs(endDate), 'day');
}

export const defaultExportEndDate = (): string => dayjs().format('YYYY-MM-DD');

export const defaultExportStartDate = (): string =>
  dayjs().subtract(3, 'month').format('YYYY-MM-DD');
