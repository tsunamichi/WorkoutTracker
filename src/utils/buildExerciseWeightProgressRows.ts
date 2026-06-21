import type { Exercise, WorkoutProgress, WorkoutSession } from '../types';
import type { ScheduledWorkout } from '../types/training';
import type { ExerciseWeightProgressRow } from '../types/exerciseWeightProgress';
import { resolveWorkoutProgressDate } from './resolveWorkoutProgressDate';

type WeightEvent = {
  exerciseId: string;
  exerciseName: string;
  weightLbs: number;
  dateIso: string;
};

function exerciseNameForId(exerciseId: string, exercises: Exercise[], fallback?: string): string {
  const meta = exercises.find(e => e.id === exerciseId);
  return meta?.name?.trim() || fallback?.trim() || 'Exercise';
}

function addEvent(bucket: Map<string, WeightEvent[]>, event: WeightEvent) {
  if (!event.dateIso) return;
  const list = bucket.get(event.exerciseId) ?? [];
  list.push(event);
  bucket.set(event.exerciseId, list);
}

function collectFromDetailedProgress(
  detailedWorkoutProgress: Record<string, WorkoutProgress>,
  scheduledWorkouts: ScheduledWorkout[],
  exercises: Exercise[],
  bucket: Map<string, WeightEvent[]>,
) {
  for (const [workoutKey, progress] of Object.entries(detailedWorkoutProgress)) {
    const dateIso = resolveWorkoutProgressDate(workoutKey, progress, scheduledWorkouts);
    if (!dateIso) continue;

    for (const exProgress of Object.values(progress.exercises ?? {})) {
      if (!exProgress?.exerciseId || exProgress.skipped) continue;
      const exerciseId = exProgress.exerciseId;
      const exerciseName = exerciseNameForId(exerciseId, exercises);

      for (const set of exProgress.sets ?? []) {
        if (!set.completed) continue;
        const weightLbs = set.weight;
        if (typeof weightLbs !== 'number' || !(weightLbs > 0)) continue;
        addEvent(bucket, { exerciseId, exerciseName, weightLbs, dateIso });
      }
    }
  }
}

function collectFromSessions(
  sessions: WorkoutSession[],
  exercises: Exercise[],
  bucket: Map<string, WeightEvent[]>,
) {
  for (const session of sessions) {
    const dateIso = session.date;
    if (!dateIso) continue;
    for (const set of session.sets ?? []) {
      if (!set.isCompleted) continue;
      const weightLbs = set.weight;
      if (typeof weightLbs !== 'number' || !(weightLbs > 0)) continue;
      const exerciseId = set.exerciseId;
      addEvent(bucket, {
        exerciseId,
        exerciseName: exerciseNameForId(exerciseId, exercises),
        weightLbs,
        dateIso,
      });
    }
  }
}

function eventsToRow(exerciseId: string, events: WeightEvent[], isKeyLift: boolean): ExerciseWeightProgressRow | null {
  if (events.length === 0) return null;

  const sortedByDate = [...events].sort((a, b) => {
    if (a.dateIso !== b.dateIso) return a.dateIso.localeCompare(b.dateIso);
    return a.weightLbs - b.weightLbs;
  });

  const first = sortedByDate[0];
  let highestWeight = first.weightLbs;
  let highestDate = first.dateIso;

  for (const ev of sortedByDate) {
    if (ev.weightLbs > highestWeight) {
      highestWeight = ev.weightLbs;
      highestDate = ev.dateIso;
    } else if (ev.weightLbs === highestWeight && ev.dateIso < highestDate) {
      highestDate = ev.dateIso;
    }
  }

  return {
    exerciseId,
    exerciseName: first.exerciseName,
    firstLoggedWeightLbs: first.weightLbs,
    firstLoggedDate: first.dateIso,
    highestLoggedWeightLbs: highestWeight,
    highestLoggedDate: highestDate,
    isKeyLift,
  };
}

export type BuildExerciseWeightProgressInput = {
  detailedWorkoutProgress: Record<string, WorkoutProgress>;
  scheduledWorkouts: ScheduledWorkout[];
  sessions: WorkoutSession[];
  exercises: Exercise[];
  pinnedKeyLifts: string[];
};

/** Derive one row per exercise with at least one valid weighted set (> 0 lbs). */
export function buildExerciseWeightProgressRows(input: BuildExerciseWeightProgressInput): ExerciseWeightProgressRow[] {
  const bucket = new Map<string, WeightEvent[]>();
  collectFromDetailedProgress(input.detailedWorkoutProgress, input.scheduledWorkouts, input.exercises, bucket);
  collectFromSessions(input.sessions, input.exercises, bucket);

  const keyLiftSet = new Set(input.pinnedKeyLifts);
  const rows: ExerciseWeightProgressRow[] = [];

  for (const [exerciseId, events] of bucket) {
    const row = eventsToRow(exerciseId, events, keyLiftSet.has(exerciseId));
    if (row) rows.push(row);
  }

  return rows;
}
