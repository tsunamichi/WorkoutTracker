import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Cycle, Exercise, WorkoutSession, BodyWeightEntry, AppSettings, WorkoutAssignment, TrainerConversation, ExercisePR, WorkoutProgress, HIITTimer, HIITTimerSession } from '../types';

const STORAGE_KEYS = {
  CYCLES: '@workout_tracker_cycles',
  EXERCISES: '@workout_tracker_exercises',
  SESSIONS: '@workout_tracker_sessions',
  BODY_WEIGHT: '@workout_tracker_body_weight',
  SETTINGS: '@workout_tracker_settings',
  WORKOUT_ASSIGNMENTS: '@workout_tracker_assignments',
  TRAINER_CONVERSATIONS: '@workout_tracker_conversations',
  EXERCISE_PRS: '@workout_tracker_exercise_prs',
  WORKOUT_PROGRESS: '@workout_tracker_workout_progress',
  DETAILED_WORKOUT_PROGRESS: '@workout_tracker_detailed_progress',
  HIIT_TIMERS: '@workout_tracker_hiit_timers',
  HIIT_TIMER_SESSIONS: '@workout_tracker_hiit_timer_sessions',
};

// Cycles
export async function loadCycles(): Promise<Cycle[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CYCLES);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading cycles:', error);
    return [];
  }
}

export async function saveCycles(cycles: Cycle[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.CYCLES, JSON.stringify(cycles));
  } catch (error) {
    console.error('Error saving cycles:', error);
  }
}

// Exercises
export async function loadExercises(): Promise<Exercise[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.EXERCISES);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading exercises:', error);
    return [];
  }
}

export async function saveExercises(exercises: Exercise[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(exercises));
  } catch (error) {
    console.error('Error saving exercises:', error);
  }
}

// Sessions
export async function loadSessions(): Promise<WorkoutSession[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SESSIONS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading sessions:', error);
    return [];
  }
}

export async function saveSessions(sessions: WorkoutSession[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  } catch (error) {
    console.error('Error saving sessions:', error);
  }
}

// Body Weight
export async function loadBodyWeightEntries(): Promise<BodyWeightEntry[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.BODY_WEIGHT);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading body weight:', error);
    return [];
  }
}

export async function saveBodyWeightEntries(entries: BodyWeightEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.BODY_WEIGHT, JSON.stringify(entries));
  } catch (error) {
    console.error('Error saving body weight:', error);
  }
}

// Settings
export async function loadSettings(): Promise<AppSettings | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
    const settings = data ? JSON.parse(data) : null;
    if (settings) {
      console.log('✅ Settings loaded from storage:', {
        hasApiKey: !!settings.openaiApiKey,
        hasGoals: !!settings.trainerGoals,
        hasPersonality: !!settings.trainerPersonality,
      });
    }
    return settings;
  } catch (error) {
    console.error('Error loading settings:', error);
    return null;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    console.log('💾 Settings saved to storage:', {
      hasApiKey: !!settings.openaiApiKey,
      hasGoals: !!settings.trainerGoals,
      hasPersonality: !!settings.trainerPersonality,
      apiKeyLength: settings.openaiApiKey?.length || 0,
      goalsLength: settings.trainerGoals?.length || 0,
    });
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Workout Assignments
export async function loadWorkoutAssignments(): Promise<WorkoutAssignment[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUT_ASSIGNMENTS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading workout assignments:', error);
    return [];
  }
}

export async function saveWorkoutAssignments(assignments: WorkoutAssignment[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_ASSIGNMENTS, JSON.stringify(assignments));
  } catch (error) {
    console.error('Error saving workout assignments:', error);
  }
}

// Trainer Conversations
export async function loadTrainerConversations(): Promise<TrainerConversation[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.TRAINER_CONVERSATIONS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading trainer conversations:', error);
    return [];
  }
}

export async function saveTrainerConversations(conversations: TrainerConversation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.TRAINER_CONVERSATIONS, JSON.stringify(conversations));
  } catch (error) {
    console.error('Error saving trainer conversations:', error);
  }
}

// Exercise PRs
export async function loadExercisePRs(): Promise<ExercisePR[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.EXERCISE_PRS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading exercise PRs:', error);
    return [];
  }
}

export async function saveExercisePRs(prs: ExercisePR[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.EXERCISE_PRS, JSON.stringify(prs));
  } catch (error) {
    console.error('Error saving exercise PRs:', error);
  }
}

// Workout Progress
export async function loadWorkoutProgress(): Promise<Record<string, { completedExercises: string[]; completedSets: Record<string, number[]> }>> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUT_PROGRESS);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error loading workout progress:', error);
    return {};
  }
}

export async function saveWorkoutProgressToStorage(progress: Record<string, { completedExercises: string[]; completedSets: Record<string, number[]> }>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_PROGRESS, JSON.stringify(progress));
  } catch (error) {
    console.error('Error saving workout progress:', error);
  }
}

// Detailed Workout Progress
export async function loadDetailedWorkoutProgress(): Promise<Record<string, WorkoutProgress>> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.DETAILED_WORKOUT_PROGRESS);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error loading detailed workout progress:', error);
    return {};
  }
}

export async function saveDetailedWorkoutProgress(progress: Record<string, WorkoutProgress>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.DETAILED_WORKOUT_PROGRESS, JSON.stringify(progress));
  } catch (error) {
    console.error('Error saving detailed workout progress:', error);
  }
}

// HIIT Timers
export async function loadHIITTimers(): Promise<HIITTimer[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.HIIT_TIMERS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading HIIT timers:', error);
    return [];
  }
}

export async function saveHIITTimers(timers: HIITTimer[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.HIIT_TIMERS, JSON.stringify(timers));
  } catch (error) {
    console.error('Error saving HIIT timers:', error);
  }
}

// HIIT Timer Sessions
export async function loadHIITTimerSessions(): Promise<HIITTimerSession[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.HIIT_TIMER_SESSIONS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading HIIT timer sessions:', error);
    return [];
  }
}

export async function saveHIITTimerSessions(sessions: HIITTimerSession[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.HIIT_TIMER_SESSIONS, JSON.stringify(sessions));
  } catch (error) {
    console.error('Error saving HIIT timer sessions:', error);
  }
}

// Clear all data
export async function clearAllData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
  } catch (error) {
    console.error('Error clearing data:', error);
  }
}

