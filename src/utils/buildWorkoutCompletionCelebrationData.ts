import dayjs from 'dayjs';
import type { ExercisePR } from '../types';
import { useStore } from '../store';
import { formatWeightForLoad } from './weight';

type StoreState = ReturnType<typeof useStore.getState>;

/**
 * Total training volume (weight × reps) for the workout from persisted detailed progress.
 * Weights are stored in lbs internally.
 */
export function computeWorkoutVolumeFromDetailedProgress(
  state: StoreState,
  workoutKey: string,
): number {
  const progress = state.detailedWorkoutProgress[workoutKey];
  if (!progress?.exercises) return 0;
  let volume = 0;
  for (const ex of Object.values(progress.exercises)) {
    const sets = (ex as { sets?: Array<{ weight: number; reps: number; completed?: boolean }> }).sets;
    if (!sets) continue;
    for (const set of sets) {
      if (set.completed !== false && set.weight > 0 && set.reps > 0) {
        volume += set.weight * set.reps;
      }
    }
  }
  return volume;
}

/**
 * Consecutive calendar days with at least one session ending on `anchorDate` (inclusive).
 */
export function computeWorkoutDayStreak(state: StoreState, anchorDate: string): number {
  const dates = new Set<string>();
  for (const s of state.sessions) {
    if (s.date) dates.add(s.date);
  }
  let streak = 0;
  let d = dayjs(anchorDate);
  const maxDays = 730;
  for (let i = 0; i < maxDays; i++) {
    const iso = d.format('YYYY-MM-DD');
    if (dates.has(iso)) {
      streak += 1;
      d = d.subtract(1, 'day');
    } else {
      break;
    }
  }
  return streak;
}

function pickPrSetToday(exercisePRs: ExercisePR[], sessionDate: string): ExercisePR | null {
  const todays = exercisePRs.filter(pr => pr.date === sessionDate);
  if (todays.length === 0) return null;
  return [...todays].sort((a, b) => b.weight - a.weight)[0];
}

export type BuiltWorkoutCompletionCelebration = {
  completionLabel: string;
  headerLiftSummary: string;
  streakIntro: string;
  streakNumber: string;
  streakDetail: string;
  prIntro: string;
  prMain: string;
  prDetail: string;
  showPr: boolean;
};

/**
 * Builds copy + numeric strings for `WorkoutCompletionCelebrationScreen` from store + workout key.
 */
export function buildWorkoutCompletionCelebrationData(
  state: StoreState,
  workoutKey: string,
  useKg: boolean,
): BuiltWorkoutCompletionCelebration {
  const dateMatch = workoutKey?.match(/(\d{4}-\d{2}-\d{2})/);
  const sessionDate = dateMatch ? dateMatch[1] : dayjs().format('YYYY-MM-DD');

  const volumeLbs = computeWorkoutVolumeFromDetailedProgress(state, workoutKey);
  const volumeRounded = Math.round(volumeLbs);
  const volumeDisplay = volumeRounded.toLocaleString('en-US');
  const unitShort = useKg ? 'kg' : 'lb';

  const streak = Math.max(1, computeWorkoutDayStreak(state, sessionDate));
  const streakStr = String(streak);
  const streakDetail = streak === 1 ? 'day streak' : 'days streak';

  const bestPr = pickPrSetToday(state.exercisePRs, sessionDate);
  const showPr = bestPr != null;
  const prIntro = showPr ? `New ${bestPr!.exerciseName} PR` : '';
  const prMain = showPr ? formatWeightForLoad(bestPr!.weight, useKg) : '';
  const prDetail = unitShort;

  return {
    completionLabel: 'Workout complete',
    headerLiftSummary: `You lifted ${volumeDisplay} ${unitShort}`,
    streakIntro: "You're on a",
    streakNumber: streakStr,
    streakDetail,
    prIntro,
    prMain,
    prDetail,
    showPr,
  };
}
