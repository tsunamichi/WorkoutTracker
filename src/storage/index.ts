import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Cycle, Exercise, WorkoutSession, BodyWeightEntry, AppSettings, WorkoutAssignment, TrainerConversation, ExercisePR, WorkoutProgress, HIITTimer, HIITTimerSession } from '../types';
import type { WorkoutTemplate, CyclePlan, ScheduledWorkout } from '../types/training';
import type { ProgressLog } from '../types/progress';

const STORAGE_KEYS = {
  CYCLES: '@workout_tracker_cycles',
  EXERCISES: '@workout_tracker_exercises',
  SESSIONS: '@workout_tracker_sessions',
  BODY_WEIGHT: '@workout_tracker_body_weight',
  PROGRESS_LOGS: '@workout_tracker_progress_logs',
  SETTINGS: '@workout_tracker_settings',
  WORKOUT_ASSIGNMENTS: '@workout_tracker_assignments',
  TRAINER_CONVERSATIONS: '@workout_tracker_conversations',
  EXERCISE_PRS: '@workout_tracker_exercise_prs',
  WORKOUT_PROGRESS: '@workout_tracker_workout_progress',
  DETAILED_WORKOUT_PROGRESS: '@workout_tracker_detailed_progress',
  HIIT_TIMERS: '@workout_tracker_hiit_timers',
  HIIT_TIMER_SESSIONS: '@workout_tracker_hiit_timer_sessions',
  // NEW: Training architecture
  WORKOUT_TEMPLATES: '@workout_tracker_workout_templates',
  CYCLE_PLANS: '@workout_tracker_cycle_plans',
  SCHEDULED_WORKOUTS: '@workout_tracker_scheduled_workouts',
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
    if (!data) {
      console.log('📦 No sessions data found in storage');
      return [];
    }
    
    try {
      const parsed = JSON.parse(data);
      console.log(`✅ Sessions loaded: ${parsed.length} sessions found`);
      if (parsed.length > 0) {
        console.log('  Sample session:', {
          id: parsed[0].id,
          date: parsed[0].date,
          setsCount: parsed[0].sets?.length || 0,
          hasDate: !!parsed[0].date,
          hasStartTime: !!parsed[0].startTime,
        });
      }
      return Array.isArray(parsed) ? parsed : [];
    } catch (parseError) {
      console.error('❌ Error parsing sessions JSON:', parseError);
      console.error('  Raw data preview:', data.substring(0, 200));
      return [];
    }
  } catch (error) {
    console.error('❌ Error loading sessions:', error);
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

// Progress Logs (Weekly check-ins)
export async function loadProgressLogs(): Promise<ProgressLog[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PROGRESS_LOGS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading progress logs:', error);
    return [];
  }
}

export async function saveProgressLogs(logs: ProgressLog[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.PROGRESS_LOGS, JSON.stringify(logs));
  } catch (error) {
    console.error('Error saving progress logs:', error);
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

// Workout Templates
export async function loadWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUT_TEMPLATES);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading workout templates:', error);
    return [];
  }
}

export async function saveWorkoutTemplates(templates: WorkoutTemplate[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_TEMPLATES, JSON.stringify(templates));
  } catch (error) {
    console.error('Error saving workout templates:', error);
  }
}

// Cycle Plans
export async function loadCyclePlans(): Promise<CyclePlan[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CYCLE_PLANS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading cycle plans:', error);
    return [];
  }
}

export async function saveCyclePlans(plans: CyclePlan[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.CYCLE_PLANS, JSON.stringify(plans));
  } catch (error) {
    console.error('Error saving cycle plans:', error);
  }
}

// Scheduled Workouts
export async function loadScheduledWorkouts(): Promise<ScheduledWorkout[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SCHEDULED_WORKOUTS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading scheduled workouts:', error);
    return [];
  }
}

export async function saveScheduledWorkouts(workouts: ScheduledWorkout[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SCHEDULED_WORKOUTS, JSON.stringify(workouts));
  } catch (error) {
    console.error('Error saving scheduled workouts:', error);
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

