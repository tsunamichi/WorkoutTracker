import dayjs from 'dayjs';
import type { Exercise } from '../types';
import type { WorkoutProgress } from '../types';
import type { ScheduledWorkout } from '../types/training';
import type { WorkoutHistoryEntry, WorkoutHistoryExercise, WorkoutHistorySet } from '../types/workoutHistory';
import { formatWeightForLoad } from './weight';

export type MainCompletionGetter = (workoutId: string) => {
  completedItems: string[];
  totalItems: number;
  percentage: number;
};

function hasWorkoutLogs(sw: ScheduledWorkout): boolean {
  const main = sw.mainCompletion?.completedItems?.length ?? 0;
  const warmup = sw.warmupCompletion?.completedItems?.length ?? 0;
  const accessory = sw.accessoryCompletion?.completedItems?.length ?? 0;
  return main > 0 || warmup > 0 || accessory > 0;
}

function isWorkoutActuallyInProgress(sw: ScheduledWorkout): boolean {
  return sw.status === 'in_progress' && hasWorkoutLogs(sw);
}

/** Matches TodayScreen — completion day vs scheduled day. */
export function workoutHistoryDisplayDate(sw: ScheduledWorkout): string {
  if (sw.status === 'completed' && sw.completedAt) {
    return dayjs(sw.completedAt).format('YYYY-MM-DD');
  }
  if (isWorkoutActuallyInProgress(sw) && sw.startedAt) {
    return dayjs(sw.startedAt).format('YYYY-MM-DD');
  }
  return sw.date;
}

function isWorkoutFinished(sw: ScheduledWorkout, getMainCompletion: MainCompletionGetter): boolean {
  const mc = getMainCompletion(sw.id);
  return sw.isLocked || sw.status === 'completed' || mc.percentage === 100;
}

function getWorkoutProgressForSw(
  sw: ScheduledWorkout,
  detailedWorkoutProgress: Record<string, WorkoutProgress>,
): WorkoutProgress | undefined {
  return detailedWorkoutProgress[sw.id] ?? detailedWorkoutProgress[`${sw.templateId}-${sw.date}`];
}

function exerciseProgressForTemplateExercise(
  wp: WorkoutProgress | undefined,
  templateExercise: { id: string; exerciseId: string },
) {
  if (!wp?.exercises) return undefined;
  return wp.exercises[templateExercise.id] ?? wp.exercises[templateExercise.exerciseId];
}

function scheduledWorkoutToHistoryEntry(
  sw: ScheduledWorkout,
  detailedWorkoutProgress: Record<string, WorkoutProgress>,
  exercises: Exercise[],
  useKg: boolean,
): WorkoutHistoryEntry {
  const wp = getWorkoutProgressForSw(sw, detailedWorkoutProgress);
  const displayIso = workoutHistoryDisplayDate(sw);
  const snapshot = sw.exercisesSnapshot ?? [];

  const exercisesOut: WorkoutHistoryExercise[] = snapshot.map(tex => {
    const exMeta = exercises.find(e => e.id === tex.exerciseId);
    const name = exMeta?.name ?? 'Exercise';
    const ep = exerciseProgressForTemplateExercise(wp, tex);
    const sets: WorkoutHistorySet[] = [];
    if (ep?.sets?.length) {
      for (const sp of ep.sets) {
        if (!sp.completed) continue;
        sets.push({
          weight: formatWeightForLoad(sp.weight ?? 0, useKg),
          reps: String(sp.reps ?? 0),
        });
      }
    }
    if (sets.length === 0) {
      sets.push({ weight: '—', reps: '—' });
    }
    return { name, sets };
  });

  const title = sw.titleSnapshot?.trim() || 'Workout';

  return {
    id: sw.id,
    date: displayIso,
    workoutName: title,
    exercises:
      exercisesOut.length > 0
        ? exercisesOut
        : [{ name: title, sets: [{ weight: '—', reps: '—' }] }],
  };
}

/**
 * One entry per calendar day (local `YYYY-MM-DD`): the most recently completed
 * scheduled workout that maps to that day via {@link workoutHistoryDisplayDate}.
 */
export function buildWorkoutHistoryByDateFromSchedule(
  scheduledWorkouts: ScheduledWorkout[],
  getMainCompletion: MainCompletionGetter,
  detailedWorkoutProgress: Record<string, WorkoutProgress>,
  exercises: Exercise[],
  useKg: boolean,
): Map<string, WorkoutHistoryEntry> {
  const finished = scheduledWorkouts.filter(sw => isWorkoutFinished(sw, getMainCompletion));
  const byDisplayIso = new Map<string, ScheduledWorkout[]>();

  for (const sw of finished) {
    const iso = workoutHistoryDisplayDate(sw);
    const list = byDisplayIso.get(iso) ?? [];
    list.push(sw);
    byDisplayIso.set(iso, list);
  }

  const map = new Map<string, WorkoutHistoryEntry>();
  for (const [iso, list] of byDisplayIso) {
    const sorted = [...list].sort((a, b) => {
      const aTs = dayjs(a.completedAt ?? a.startedAt ?? `${a.date}T00:00:00.000Z`).valueOf();
      const bTs = dayjs(b.completedAt ?? b.startedAt ?? `${b.date}T00:00:00.000Z`).valueOf();
      return bTs - aTs;
    });
    const winner = sorted[0];
    if (winner) {
      map.set(iso, scheduledWorkoutToHistoryEntry(winner, detailedWorkoutProgress, exercises, useKg));
    }
  }

  return map;
}
