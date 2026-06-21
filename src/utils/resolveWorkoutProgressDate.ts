import type { WorkoutProgress } from '../types';
import type { ScheduledWorkout } from '../types/training';
import { workoutHistoryDisplayDate } from './buildWorkoutHistoryByDateFromSchedule';

/** Resolve calendar date (`YYYY-MM-DD`) for a detailedWorkoutProgress key. */
export function resolveWorkoutProgressDate(
  workoutKey: string,
  progress: WorkoutProgress,
  scheduledWorkouts: ScheduledWorkout[],
): string {
  const sw = scheduledWorkouts.find(s => s.id === workoutKey);
  if (sw) {
    return workoutHistoryDisplayDate(sw);
  }

  const dateMatch = workoutKey.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    return dateMatch[1];
  }

  return progress.lastUpdated?.split('T')[0] ?? '';
}
