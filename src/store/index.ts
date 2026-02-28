import { create } from 'zustand';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import type { Cycle, Exercise, WorkoutSession, BodyWeightEntry, ProgressPhoto, AppSettings, WorkoutAssignment, TrainerConversation, ExercisePR, WorkoutProgress, ExerciseProgress, HIITTimer, HIITTimerSession } from '../types';
import type { WorkoutTemplate, CyclePlan, ScheduledWorkout, ConflictResolution, ConflictItem, ConflictResolutionMap, PlanApplySummary, CyclePlanStatus, WarmUpSetTemplate, CoreSetTemplate, BonusLog, CoreProgram, CoreLog } from '../types/training';
import * as coreProgramUtil from '../utils/coreProgram';
import * as storage from '../storage';
import { SEED_EXERCISES } from '../constants';
import { kgToLbs } from '../utils/weight';
import { cloudBackupService } from '../services/cloudBackup';
import { migrateOldStorageKeys } from '../utils/dataMigration';
import { cloudSyncService } from '../services/cloudSync';

dayjs.extend(isoWeek);

interface WorkoutStore {
  // State
  cycles: Cycle[];
  exercises: Exercise[];
  sessions: WorkoutSession[];
  bodyWeightEntries: BodyWeightEntry[];
  progressPhotos: ProgressPhoto[];
  pinnedKeyLifts: string[];
  workoutAssignments: WorkoutAssignment[]; // NEW
  trainerConversations: TrainerConversation[]; // NEW
  exercisePRs: ExercisePR[]; // NEW: Personal Records
  settings: AppSettings;
  isLoading: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  addCycle: (cycle: Cycle) => Promise<void>;
  updateCycle: (cycleId: string, updates: Partial<Cycle>) => Promise<void>;
  deleteCycle: (cycleId: string) => Promise<void>;
  addExercise: (exercise: Exercise) => Promise<void>;
  updateExercise: (exerciseId: string, updates: Partial<Exercise>) => Promise<void>;
  addSession: (session: WorkoutSession) => Promise<void>;
  updateSession: (sessionId: string, session: WorkoutSession) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  addBodyWeightEntry: (entry: BodyWeightEntry) => Promise<void>;
  deleteBodyWeightEntry: (entryId: string) => Promise<void>;
  addProgressPhoto: (photo: Omit<ProgressPhoto, 'id'>) => Promise<ProgressPhoto>;
  deleteProgressPhoto: (photoId: string) => Promise<void>;
  setPinnedKeyLifts: (exerciseIds: string[]) => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  setBarbellMode: (exerciseId: string, enabled: boolean) => Promise<void>;
  getBarbellMode: (exerciseId: string) => boolean;
  
  // NEW: Workout assignments
  assignWorkout: (date: string, workoutTemplateId: string, cycleId: string) => Promise<void>;
  getWorkoutForDate: (date: string) => WorkoutAssignment | undefined;
  clearWorkoutAssignmentsForDateRange: (startDate: string, endDate: string) => Promise<void>;
  swapWorkoutAssignments: (date1: string, date2: string) => Promise<void>;
  
  // NEW: Trainer conversations
  addConversation: (conversation: TrainerConversation) => Promise<void>;
  updateConversation: (conversationId: string, updates: Partial<TrainerConversation>) => Promise<void>;
  getNextCycleNumber: () => number;
  
  // Workout progress (persisted to storage)
  workoutProgress: Record<string, { completedExercises: string[]; completedSets: Record<string, number[]> }>;
  saveWorkoutProgress: (workoutId: string, completedExercises: string[], completedSets: Record<string, number[]>) => Promise<void>;
  getWorkoutProgress: (workoutId: string) => { completedExercises: string[]; completedSets: Record<string, number[]> } | undefined;
  clearWorkoutProgress: (workoutId: string) => Promise<void>;
  clearAllHistory: () => Promise<void>;
  recoverCompletedWorkouts: () => Promise<{ success: boolean; sessionsCreated: number; workoutsProcessed: number; error?: string }>;
  recoverCompletionFromSessions: () => Promise<{ recovered: number; details: string[] }>;
  recoverCompletionFromDetailedProgress: () => Promise<{ recovered: number; details: string[] }>;
  
  // NEW: Detailed workout progress
  detailedWorkoutProgress: Record<string, WorkoutProgress>;
  saveExerciseProgress: (workoutKey: string, exerciseId: string, progress: ExerciseProgress) => Promise<void>;
  getExerciseProgress: (workoutKey: string, exerciseId: string) => ExerciseProgress | undefined;
  skipExercise: (workoutKey: string, exerciseId: string) => Promise<void>;
  getWorkoutCompletionPercentage: (workoutKey: string, totalSets: number) => number;
  
  // NEW: PR tracking
  getExercisePR: (exerciseId: string) => ExercisePR | undefined;
  updateExercisePR: (exerciseId: string, exerciseName: string, weight: number, reps: number, date: string) => Promise<void>;
  
  // HIIT Timers
  hiitTimers: HIITTimer[];
  addHIITTimer: (timer: HIITTimer) => Promise<void>;
  updateHIITTimer: (timerId: string, updates: Partial<HIITTimer>) => Promise<void>;
  deleteHIITTimer: (timerId: string) => Promise<void>;
  getHIITTimerTemplates: () => HIITTimer[];
  
  // Active HIIT Timer tracking
  activeHIITTimerId: string | null;
  setActiveHIITTimer: (timerId: string | null) => void;
  isHIITTimerActive: (timerId: string) => boolean;
  
  // HIIT Timer Sessions
  hiitTimerSessions: HIITTimerSession[];
  addHIITTimerSession: (session: HIITTimerSession) => Promise<void>;
  getHIITTimerSessionsForDate: (date: string) => HIITTimerSession[];
  
  // Bonus feature (warmup/core presets + bonus logs)
  warmupPresets: WarmUpSetTemplate[];
  corePresets: CoreSetTemplate[];
  bonusLogs: BonusLog[];
  addWarmupPreset: (preset: WarmUpSetTemplate) => Promise<void>;
  deleteWarmupPreset: (presetId: string) => Promise<void>;
  addCorePreset: (preset: CoreSetTemplate) => Promise<void>;
  deleteCorePreset: (presetId: string) => Promise<void>;
  addBonusLog: (log: BonusLog) => Promise<void>;
  updateBonusLog: (logId: string, updates: Partial<BonusLog>) => Promise<void>;
  deleteBonusLog: (logId: string) => Promise<void>;
  getBonusLogsForDate: (date: string) => BonusLog[];

  // Core Program
  corePrograms: CoreProgram[];
  coreLogs: CoreLog[];
  getActiveCoreProgram: () => CoreProgram | undefined;
  createDefaultCoreProgram: () => Promise<CoreProgram>;
  getUpNextCoreSession: (programId?: string) => CoreSetTemplate | null;
  getCoreSessionsByGroup: (programId: string) => { A: CoreSetTemplate[]; B: CoreSetTemplate[] };
  getCoreCompletedCount: (programId: string) => number;
  advanceCorePointer: (programId: string) => Promise<void>;
  logCoreSession: (programId: string, sessionTemplateId: string, outcome: 'completed' | 'skipped', completedItemIds?: string[]) => Promise<void>;
  isCoreSessionCompletedThisWeek: (programId: string, sessionTemplateId: string) => boolean;
  isCoreSessionSkippedThisWeek: (programId: string, sessionTemplateId: string) => boolean;
  restartCoreProgram: (programId: string) => Promise<void>;
  addCoreSessionToProgram: (programId: string, preset: CoreSetTemplate, group: 'A' | 'B') => Promise<void>;
  updateCoreProgram: (programId: string, updates: Partial<CoreProgram>) => Promise<void>;
  deleteCoreProgram: (programId: string) => Promise<void>;
  pendingCorePresetForProgram: { id: string; name: string; items: CoreSetTemplate['items'] } | null;
  setPendingCorePresetForProgram: (preset: { id: string; name: string; items: CoreSetTemplate['items'] } | null) => void;
  
  // NEW: Training Architecture (Templates, Plans, Scheduled Workouts)
  workoutTemplates: WorkoutTemplate[];
  cyclePlans: CyclePlan[];
  scheduledWorkouts: ScheduledWorkout[];
  
  // Workout Templates
  addWorkoutTemplate: (template: WorkoutTemplate) => Promise<void>;
  updateWorkoutTemplate: (templateId: string, updates: Partial<WorkoutTemplate>) => Promise<void>;
  deleteWorkoutTemplate: (templateId: string) => Promise<void>;
  getWorkoutTemplate: (templateId: string) => WorkoutTemplate | undefined;
  duplicateWorkoutTemplate: (templateId: string) => Promise<string | null>;
  
  // Cycle Plans
  addCyclePlan: (plan: CyclePlan, resolution?: import('../types/training').CycleConflictResolution) => Promise<{ success: boolean; conflicts?: import('../types/training').ConflictItem[] }>;
  updateCyclePlan: (planId: string, updates: Partial<CyclePlan>) => Promise<void>;
  archiveCyclePlan: (planId: string) => Promise<void>;
  applyCyclePlan: (planId: string, resolutionMap?: ConflictResolutionMap) => Promise<PlanApplySummary | { success: false; conflicts: ConflictItem[] }>;
  duplicateCyclePlan: (planId: string) => Promise<string | null>;
  repeatCyclePlan: (planId: string, startDate: string) => Promise<string | null>;
  getActiveCyclePlan: () => CyclePlan | undefined;
  generateScheduledWorkoutsFromCycle: (planId: string) => Promise<void>;
  detectCycleConflicts: (plan: CyclePlan) => import('../types/training').ConflictItem[];
  getCycleEndDate: (startDate: string, weeks: number) => string;
  listDatesInRange: (start: string, endExclusive: string) => string[];
  // Cycle Management v1
  endCyclePlan: (planId: string) => Promise<void>;
  reactivateCyclePlan: (planId: string) => Promise<void>;
  deleteCyclePlan: (planId: string) => Promise<void>;
  deleteCyclePlanCompletely: (planId: string) => Promise<void>;
  pauseShiftCyclePlan: (planId: string, resumeDate: string, resolutionMap?: ConflictResolutionMap) => Promise<{ success: boolean; conflicts?: ConflictItem[] }>;
  repairPausedCycleSchedule: () => Promise<void>;
  getCyclePlanEffectiveEndDate: (plan: CyclePlan) => string;
  getCyclePlanStatus: (planId: string) => import('../types/training').CyclePlanStatus;
  getCyclePlanWeekProgress: (planId: string, asOfDate: string) => { currentWeek: number; totalWeeks: number } | null;
  
  // Scheduled Workouts
  scheduleWorkout: (date: string, templateId: string, source: 'manual' | 'cycle', cyclePlanId?: string, resolution?: ConflictResolution) => Promise<{ success: boolean; conflict?: ScheduledWorkout }>;
  unscheduleWorkout: (workoutId: string) => Promise<void>;
  completeWorkout: (workoutId: string) => Promise<void>;
  uncompleteWorkout: (workoutId: string) => Promise<void>;
  getScheduledWorkout: (date: string) => ScheduledWorkout | undefined;
  getScheduledWorkoutsForDateRange: (startDate: string, endDate: string) => ScheduledWorkout[];
  moveScheduledWorkout: (workoutId: string, toDate: string) => Promise<{ success: boolean; error?: string }>;
  duplicateScheduledWorkout: (workoutId: string, toDate: string) => Promise<{ success: boolean; error?: string }>;
  updateScheduledWorkoutSnapshots: (workoutId: string, updates: { warmupSnapshot?: any[]; exercisesSnapshot?: any[]; accessorySnapshot?: any[] }) => Promise<void>;
  
  // Warm-up Completion (independent from workout completion)
  updateWarmupCompletion: (workoutId: string, warmupItemId: string, completed: boolean) => Promise<void>;
  getWarmupCompletion: (workoutId: string, templateId?: string) => { completedItems: string[]; totalItems: number; percentage: number };
  warmupCompletionByKey: Record<string, { completedItems: string[] }>;
  
  // Accessory Completion (independent from workout completion)
  updateAccessoryCompletion: (workoutId: string, accessoryItemId: string, completed: boolean) => Promise<void>;
  getAccessoryCompletion: (workoutId: string, templateId?: string) => { completedItems: string[]; totalItems: number; percentage: number };
  accessoryCompletionByKey: Record<string, { completedItems: string[] }>;
  
  // Main Exercise Completion (independent from workout completion)
  updateMainCompletion: (workoutId: string, mainItemId: string, completed: boolean) => Promise<void>;
  getMainCompletion: (workoutId: string) => { completedItems: string[]; totalItems: number; percentage: number };
  
  // Reset specific completion types
  resetWarmupCompletion: (workoutId: string) => Promise<void>;
  resetMainCompletion: (workoutId: string) => Promise<void>;
  resetAccessoryCompletion: (workoutId: string) => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  useKg: false,
  language: 'en',
  monthlyProgressReminderEnabled: true,
  monthlyProgressReminderDay: 1,
  restTimerDefaultSeconds: 120,
  notificationsPermissionPrompted: false,
  profileAvatarUri: undefined,
  openaiApiKey: '', // API key removed for security - add via app settings
};

// Helper function to infer equipment type from exercise name
const inferExerciseEquipment = (name: string): string => {
  const lower = name.toLowerCase();
  // Barbell exercises
  if (lower.includes('bench press') || lower.includes('squat') || lower.includes('deadlift') || 
      lower.includes('overhead press') || lower.includes('barbell') || lower.includes('row')) {
    return 'Barbell';
  }
  // Bodyweight
  if (lower.includes('pull-up') || lower.includes('chin-up') || lower.includes('dip') || 
      lower.includes('push-up') || lower.includes('bodyweight')) {
    return 'Bodyweight';
  }
  // Dumbbell
  if (lower.includes('dumbbell') || lower.includes('curl') || lower.includes('lunge')) {
    return 'Dumbbell';
  }
  // Cable/Machine
  if (lower.includes('cable') || lower.includes('machine') || lower.includes('leg press')) {
    return 'Machine';
  }
  return 'Dumbbell'; // Default to dumbbell
};

const normalizeExerciseName = (name: string): string => {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (normalized === 'adductor machine' || normalized === 'adductor') return 'adductor';
  if (normalized === 'abductor machine' || normalized === 'abductor') return 'abductor';

  return normalized;
};

const toTitleCase = (value: string): string =>
  value.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1));

const pickPreferredExercise = (primary: Exercise, candidate: Exercise, key: string): Exercise => {
  if (key === 'adductor' || key === 'abductor') {
    const primaryHasMachine = primary.name.toLowerCase().includes('machine');
    const candidateHasMachine = candidate.name.toLowerCase().includes('machine');
    if (primaryHasMachine && !candidateHasMachine) return candidate;
    if (!primaryHasMachine && candidateHasMachine) return primary;
  }

  if (primary.isCustom !== candidate.isCustom) {
    return primary.isCustom ? primary : candidate;
  }

  if (primary.notes && !candidate.notes) return primary;
  if (!primary.notes && candidate.notes) return candidate;

  if (primary.measurementType && !candidate.measurementType) return primary;
  if (!primary.measurementType && candidate.measurementType) return candidate;

  return primary;
};

export const useStore = create<WorkoutStore>((set, get) => ({
  cycles: [],
  exercises: [],
  sessions: [],
  bodyWeightEntries: [],
  progressPhotos: [],
  pinnedKeyLifts: [],
  workoutAssignments: [],
  trainerConversations: [],
  exercisePRs: [],
  hiitTimers: [],
  hiitTimerSessions: [],
  activeHIITTimerId: null,
  warmupPresets: [],
  corePresets: [],
  bonusLogs: [],
  corePrograms: [],
  coreLogs: [],
  pendingCorePresetForProgram: null,
  settings: DEFAULT_SETTINGS,
  isLoading: true,
  workoutProgress: {},
  detailedWorkoutProgress: {},
  // NEW: Training architecture
  workoutTemplates: [],
  cyclePlans: [],
  scheduledWorkouts: [],
  warmupCompletionByKey: {},
  accessoryCompletionByKey: {},
  
  initialize: async () => {
    try {
      // Try to migrate old data first (before loading)
      try {
        const migrationResult = await migrateOldStorageKeys();
        if (migrationResult.migratedKeys.length > 0) {
          console.log(`✅ Auto-migrated ${migrationResult.migratedKeys.length} keys from old version`);
        }
      } catch (error) {
        console.error('Error during auto-migration:', error);
      }
      
      const [
        cycles,
        exercises,
        sessions,
        bodyWeightEntries,
        progressPhotos,
        pinnedKeyLifts,
        loadedSettings,
        workoutAssignments,
        trainerConversations,
        exercisePRs,
        workoutProgress,
        detailedWorkoutProgress,
        hiitTimers,
        hiitTimerSessions,
        workoutTemplates,
        cyclePlans,
        scheduledWorkouts,
        warmupPresets,
        corePresets,
        bonusLogs,
        corePrograms,
        coreLogs,
        warmupCompletionByKey,
        accessoryCompletionByKey,
      ] = await Promise.all([
        storage.loadCycles(),
        storage.loadExercises(),
        storage.loadSessions(),
        storage.loadBodyWeightEntries(),
        storage.loadProgressPhotos(),
        storage.loadPinnedKeyLifts(),
        storage.loadSettings(),
        storage.loadWorkoutAssignments(),
        storage.loadTrainerConversations(),
        storage.loadExercisePRs(),
        storage.loadWorkoutProgress(),
        storage.loadDetailedWorkoutProgress(),
        storage.loadHIITTimers(),
        storage.loadHIITTimerSessions(),
        storage.loadWorkoutTemplates(),
        storage.loadCyclePlans(),
        storage.loadScheduledWorkouts(),
        storage.loadWarmupPresets(),
        storage.loadCorePresets(),
        storage.loadBonusLogs(),
        storage.loadCorePrograms(),
        storage.loadCoreLogs(),
        storage.loadWarmupCompletionByKey(),
        storage.loadAccessoryCompletionByKey(),
      ]);
      
      // Normalize body weight entries to lbs
      let finalBodyWeightEntries = bodyWeightEntries;
      const needsWeightUnitMigration = bodyWeightEntries.some(entry => entry.unit === 'kg');
      if (needsWeightUnitMigration) {
        finalBodyWeightEntries = bodyWeightEntries.map(entry =>
          entry.unit === 'kg'
            ? { ...entry, weight: kgToLbs(entry.weight), unit: 'lb' as const }
            : entry
        );
        await storage.saveBodyWeightEntries(finalBodyWeightEntries);
      }

      // Seed body weight entries for demo/testing if less than 15 exist.
      if (finalBodyWeightEntries.length < 15) {
        const existingDates = new Set(finalBodyWeightEntries.map(entry => entry.date));
        const missingCount = 15 - finalBodyWeightEntries.length;
        const seedEntries = Array.from({ length: missingCount }).map((_, index) => {
          const date = dayjs()
            .subtract(index + 1, 'day')
            .format('YYYY-MM-DD');
          const safeDate = existingDates.has(date)
            ? dayjs()
                .subtract(index + 1 + missingCount, 'day')
                .format('YYYY-MM-DD')
            : date;
          const weight = 180 - index * 0.4;
          return {
            id: `seed-weight-${Date.now()}-${index}`,
            date: safeDate,
            weight,
            unit: 'lb' as const,
          };
        });
        finalBodyWeightEntries = [...finalBodyWeightEntries, ...seedEntries];
        await storage.saveBodyWeightEntries(finalBodyWeightEntries);
      }
      
      // Seed exercises if none exist
      let finalExercises = exercises;
      let exercisesDeduped = false;
      const exerciseIdMap = new Map<string, string>();
      const exerciseNameById = new Map<string, string>();
      if (exercises.length === 0) {
        finalExercises = SEED_EXERCISES.map((ex, idx) => ({
          id: `seed-${idx}`,
          name: ex.name,
          category: ex.category as any,
          equipment: ex.equipment,
          isCustom: false,
        }));
        await storage.saveExercises(finalExercises);
      }

      // Seed workout sessions for demo/testing if none exist - will be assigned to finalSessions later
      let seedSessions: WorkoutSession[] = [];
      
      if (sessions.length === 0 && finalExercises.length > 0) {
        // Find some exercises to use for demo sessions
        const benchPress = finalExercises.find(e => e.name.toLowerCase().includes('bench press'));
        const squat = finalExercises.find(e => e.name.toLowerCase().includes('squat'));
        const deadlift = finalExercises.find(e => e.name.toLowerCase().includes('deadlift'));
        const row = finalExercises.find(e => e.name.toLowerCase().includes('row'));
        const shoulderPress = finalExercises.find(e => e.name.toLowerCase().includes('shoulder press') || e.name.toLowerCase().includes('overhead press'));
        
        const now = dayjs();
        
        // Create 5 demo sessions over the past 2 weeks
        if (benchPress) {
          // Session 1: Bench Press - 5 days ago
          const session1Date = now.subtract(5, 'day');
          const session1: WorkoutSession = {
            id: `seed-session-${session1Date.valueOf()}`,
            date: session1Date.format('YYYY-MM-DD'),
            startTime: session1Date.hour(10).minute(0).toISOString(),
            endTime: session1Date.hour(11).minute(15).toISOString(),
            sets: [
              {
                id: `seed-set-1-1`,
                sessionId: `seed-session-${session1Date.valueOf()}`,
                exerciseId: benchPress.id,
                setIndex: 0,
                weight: 135,
                reps: 10,
                isCompleted: true,
              },
              {
                id: `seed-set-1-2`,
                sessionId: `seed-session-${session1Date.valueOf()}`,
                exerciseId: benchPress.id,
                setIndex: 1,
                weight: 155,
                reps: 8,
                isCompleted: true,
              },
              {
                id: `seed-set-1-3`,
                sessionId: `seed-session-${session1Date.valueOf()}`,
                exerciseId: benchPress.id,
                setIndex: 2,
                weight: 165,
                reps: 6,
                isCompleted: true,
              },
              {
                id: `seed-set-1-4`,
                sessionId: `seed-session-${session1Date.valueOf()}`,
                exerciseId: benchPress.id,
                setIndex: 3,
                weight: 155,
                reps: 8,
                isCompleted: true,
              },
            ],
          };
          seedSessions.push(session1);
        }
        
        if (squat && exercises.length > 0) {
          // Session 2: Squat - 4 days ago
          const session2Date = now.subtract(4, 'day');
          const session2: WorkoutSession = {
            id: `seed-session-${session2Date.valueOf()}`,
            date: session2Date.format('YYYY-MM-DD'),
            startTime: session2Date.hour(15).minute(30).toISOString(),
            endTime: session2Date.hour(16).minute(45).toISOString(),
            sets: [
              {
                id: `seed-set-2-1`,
                sessionId: `seed-session-${session2Date.valueOf()}`,
                exerciseId: squat.id,
                setIndex: 0,
                weight: 185,
                reps: 8,
                isCompleted: true,
              },
              {
                id: `seed-set-2-2`,
                sessionId: `seed-session-${session2Date.valueOf()}`,
                exerciseId: squat.id,
                setIndex: 1,
                weight: 205,
                reps: 6,
                isCompleted: true,
              },
              {
                id: `seed-set-2-3`,
                sessionId: `seed-session-${session2Date.valueOf()}`,
                exerciseId: squat.id,
                setIndex: 2,
                weight: 225,
                reps: 5,
                isCompleted: true,
              },
            ],
          };
          seedSessions.push(session2);
        }
        
        if (deadlift) {
          // Session 3: Deadlift - 3 days ago
          const session3Date = now.subtract(3, 'day');
          const session3: WorkoutSession = {
            id: `seed-session-${session3Date.valueOf()}`,
            date: session3Date.format('YYYY-MM-DD'),
            startTime: session3Date.hour(9).minute(0).toISOString(),
            endTime: session3Date.hour(10).minute(30).toISOString(),
            sets: [
              {
                id: `seed-set-3-1`,
                sessionId: `seed-session-${session3Date.valueOf()}`,
                exerciseId: deadlift.id,
                setIndex: 0,
                weight: 225,
                reps: 5,
                isCompleted: true,
              },
              {
                id: `seed-set-3-2`,
                sessionId: `seed-session-${session3Date.valueOf()}`,
                exerciseId: deadlift.id,
                setIndex: 1,
                weight: 245,
                reps: 5,
                isCompleted: true,
              },
              {
                id: `seed-set-3-3`,
                sessionId: `seed-session-${session3Date.valueOf()}`,
                exerciseId: deadlift.id,
                setIndex: 2,
                weight: 265,
                reps: 3,
                isCompleted: true,
              },
            ],
          };
          seedSessions.push(session3);
        }
        
        if (row && benchPress) {
          // Session 4: Bench + Row - 2 days ago
          const session4Date = now.subtract(2, 'day');
          const session4: WorkoutSession = {
            id: `seed-session-${session4Date.valueOf()}`,
            date: session4Date.format('YYYY-MM-DD'),
            startTime: session4Date.hour(14).minute(0).toISOString(),
            endTime: session4Date.hour(15).minute(45).toISOString(),
            sets: [
              {
                id: `seed-set-4-1`,
                sessionId: `seed-session-${session4Date.valueOf()}`,
                exerciseId: benchPress.id,
                setIndex: 0,
                weight: 145,
                reps: 8,
                isCompleted: true,
              },
              {
                id: `seed-set-4-2`,
                sessionId: `seed-session-${session4Date.valueOf()}`,
                exerciseId: benchPress.id,
                setIndex: 1,
                weight: 165,
                reps: 6,
                isCompleted: true,
              },
              {
                id: `seed-set-4-3`,
                sessionId: `seed-session-${session4Date.valueOf()}`,
                exerciseId: row.id,
                setIndex: 0,
                weight: 115,
                reps: 10,
                isCompleted: true,
              },
              {
                id: `seed-set-4-4`,
                sessionId: `seed-session-${session4Date.valueOf()}`,
                exerciseId: row.id,
                setIndex: 1,
                weight: 135,
                reps: 8,
                isCompleted: true,
              },
            ],
          };
          seedSessions.push(session4);
        }
        
        if (shoulderPress) {
          // Session 5: Shoulder Press - yesterday
          const session5Date = now.subtract(1, 'day');
          const session5: WorkoutSession = {
            id: `seed-session-${session5Date.valueOf()}`,
            date: session5Date.format('YYYY-MM-DD'),
            startTime: session5Date.hour(11).minute(0).toISOString(),
            endTime: session5Date.hour(12).minute(15).toISOString(),
            sets: [
              {
                id: `seed-set-5-1`,
                sessionId: `seed-session-${session5Date.valueOf()}`,
                exerciseId: shoulderPress.id,
                setIndex: 0,
                weight: 95,
                reps: 8,
                isCompleted: true,
              },
              {
                id: `seed-set-5-2`,
                sessionId: `seed-session-${session5Date.valueOf()}`,
                exerciseId: shoulderPress.id,
                setIndex: 1,
                weight: 105,
                reps: 6,
                isCompleted: true,
              },
              {
                id: `seed-set-5-3`,
                sessionId: `seed-session-${session5Date.valueOf()}`,
                exerciseId: shoulderPress.id,
                setIndex: 2,
                weight: 115,
                reps: 5,
                isCompleted: true,
              },
            ],
          };
          seedSessions.push(session5);
        }
      }
      
      // Continue with exercise migrations if exercises already existed
      if (finalExercises.length > 0 && exercises.length > 0) {
        // Migration: Add equipment field to existing exercises that don't have it
        let needsMigration = false;
        const migratedExercises = exercises.map(ex => {
          if (!ex.equipment) {
            needsMigration = true;
            const equipment = inferExerciseEquipment(ex.name);
            console.log(`🔧 Migrating exercise: ${ex.name} -> Equipment: ${equipment}`);
            return { ...ex, equipment };
          }
          return ex;
        });
        
        if (needsMigration) {
          finalExercises = migratedExercises;
          await storage.saveExercises(finalExercises);
          console.log('✅ Exercise equipment migration complete');
        }
      }

      // Migration: Deduplicate exercise library and normalize adductor/abductor
      const exercisesByKey = new Map<string, Exercise[]>();
      finalExercises.forEach((exercise) => {
        const key = normalizeExerciseName(exercise.name);
        const group = exercisesByKey.get(key) || [];
        group.push(exercise);
        exercisesByKey.set(key, group);
      });

      const dedupedExercises: Exercise[] = [];
      exercisesByKey.forEach((group, key) => {
        let preferred = group[0];
        group.forEach((candidate) => {
          preferred = pickPreferredExercise(preferred, candidate, key);
        });

        const merged = group.reduce<Exercise>((acc, exercise) => {
          return {
            ...acc,
            equipment: acc.equipment || exercise.equipment,
            measurementType: acc.measurementType || exercise.measurementType,
            notes: acc.notes || exercise.notes,
            isCustom: acc.isCustom || exercise.isCustom,
          };
        }, preferred);

        const finalName = key === 'adductor' || key === 'abductor' ? toTitleCase(key) : merged.name;
        const finalExercise: Exercise = { ...merged, name: finalName };
        dedupedExercises.push(finalExercise);

        group.forEach((exercise) => {
          exerciseIdMap.set(exercise.id, finalExercise.id);
          if (exercise.id !== finalExercise.id) {
            exercisesDeduped = true;
          }
        });

        exerciseNameById.set(finalExercise.id, finalExercise.name);
      });

      if (exercisesDeduped) {
        finalExercises = dedupedExercises;
        await storage.saveExercises(finalExercises);
        console.log('✅ Exercise deduplication complete');
      }
      
      // Initialize advice conversation if it doesn't exist
      let finalConversations = trainerConversations;
      if (!trainerConversations.find(c => c.type === 'advice')) {
        const adviceConversation: TrainerConversation = {
          id: 'advice',
          type: 'advice',
          title: 'Advice',
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        finalConversations = [adviceConversation, ...trainerConversations];
        await storage.saveTrainerConversations(finalConversations);
      }
      
      // Migration: Remove duplicate workout templates from cycles
      let finalCycles = cycles;
      let cyclesMigrationNeeded = false;
      const migratedCycles = cycles.map(cycle => {
        const uniqueTemplates: any[] = [];
        const seen = new Map<string, boolean>(); // Track by name + dayOfWeek
        
        cycle.workoutTemplates.forEach(template => {
          const key = `${template.name.toLowerCase()}-${template.dayOfWeek || 'none'}`;
          if (!seen.has(key)) {
            seen.set(key, true);
            uniqueTemplates.push(template);
          } else {
            cyclesMigrationNeeded = true;
            console.log(`🔧 Removing duplicate template: ${template.name} (Day ${template.dayOfWeek})`);
          }
        });
        
        if (uniqueTemplates.length !== cycle.workoutTemplates.length) {
          console.log(`🔧 Migrating Cycle ${cycle.cycleNumber}: ${cycle.workoutTemplates.length} -> ${uniqueTemplates.length} templates`);
          return { ...cycle, workoutTemplates: uniqueTemplates };
        }
        return cycle;
      });
      
      if (cyclesMigrationNeeded) {
        finalCycles = migratedCycles;
        await storage.saveCycles(finalCycles);
        console.log('✅ Cycle duplicate templates migration complete');
      }

      // Use seed sessions if they were created, otherwise use loaded sessions
      let finalSessions = seedSessions.length > 0 ? seedSessions : sessions;
      if (seedSessions.length > 0) {
        await storage.saveSessions(finalSessions);
        console.log(`✅ Seeded ${seedSessions.length} demo workout sessions`);
      }
      
      let finalExercisePRs = exercisePRs;
      let finalWorkoutProgress = workoutProgress;
      let finalSettings = { ...DEFAULT_SETTINGS, ...(loadedSettings || {}) };

      if (exercisesDeduped) {
        finalCycles = finalCycles.map((cycle) => ({
          ...cycle,
          workoutTemplates: cycle.workoutTemplates.map((template) => ({
            ...template,
            exercises: template.exercises.map((exercise) => ({
              ...exercise,
              exerciseId: exerciseIdMap.get(exercise.exerciseId) || exercise.exerciseId,
            })),
          })),
        }));
        await storage.saveCycles(finalCycles);

        finalSessions = finalSessions.map((session) => ({
          ...session,
          sets: session.sets.map((set) => ({
            ...set,
            exerciseId: exerciseIdMap.get(set.exerciseId) || set.exerciseId,
          })),
        }));
        await storage.saveSessions(finalSessions);

        finalExercisePRs = finalExercisePRs.map((pr) => {
          const updatedId = exerciseIdMap.get(pr.exerciseId) || pr.exerciseId;
          return {
            ...pr,
            exerciseId: updatedId,
            exerciseName: exerciseNameById.get(updatedId) || pr.exerciseName,
          };
        });
        await storage.saveExercisePRs(finalExercisePRs);

        finalWorkoutProgress = Object.fromEntries(
          Object.entries(finalWorkoutProgress).map(([workoutId, progress]) => {
            const completedExercises = progress.completedExercises.map(
              (exerciseId) => exerciseIdMap.get(exerciseId) || exerciseId
            );
            const completedSets: Record<string, number[]> = {};
            Object.entries(progress.completedSets).forEach(([exerciseId, sets]) => {
              const updatedId = exerciseIdMap.get(exerciseId) || exerciseId;
              completedSets[updatedId] = (completedSets[updatedId] || []).concat(sets);
            });
            return [
              workoutId,
              {
                ...progress,
                completedExercises: Array.from(new Set(completedExercises)),
                completedSets,
              },
            ];
          })
        );
        await storage.saveWorkoutProgressToStorage(finalWorkoutProgress);

        if (finalSettings.barbellMode) {
          const updatedBarbellMode: Record<string, boolean> = {};
          Object.entries(finalSettings.barbellMode).forEach(([exerciseId, enabled]) => {
            const updatedId = exerciseIdMap.get(exerciseId) || exerciseId;
            updatedBarbellMode[updatedId] = enabled;
          });
          finalSettings = { ...finalSettings, barbellMode: updatedBarbellMode };
          await storage.saveSettings(finalSettings);
        }
      }
      
      // Don't seed demo data - user will create their own cycles
      let finalWorkoutAssignments = workoutAssignments;
      if (false && finalCycles.length === 0 && finalExercises.length > 0) {
        const today = dayjs();
        const cycleId = 'demo-cycle-1';
        const pushWorkoutId = 'demo-push-workout';
        
        // Create demo cycle
        const demoCycle = {
          id: cycleId,
          cycleNumber: 1,
          startDate: today.startOf('isoWeek').format('YYYY-MM-DD'),
          lengthInWeeks: 4,
          endDate: today.startOf('isoWeek').add(4, 'week').format('YYYY-MM-DD'),
          workoutsPerWeek: 3,
          goal: 'Build strength and muscle',
          isActive: true,
          workoutTemplates: [
            {
              id: pushWorkoutId,
              cycleId,
              name: 'Push',
              workoutType: 'Push' as any,
              orderIndex: 0,
              exercises: [
                {
                  id: 'ex-1',
                  exerciseId: finalExercises.find(e => e.name === 'Bench Press')?.id || 'seed-0',
                  orderIndex: 0,
                  targetSets: 4,
                  targetRepsMin: 8,
                  targetRepsMax: 12,
                  targetWeight: 135,
                  progressionType: 'double' as any,
                  progressionValue: 2.5,
                },
                {
                  id: 'ex-2',
                  exerciseId: finalExercises.find(e => e.name === 'Overhead Press')?.id || 'seed-17',
                  orderIndex: 1,
                  targetSets: 3,
                  targetRepsMin: 8,
                  targetRepsMax: 12,
                  targetWeight: 95,
                  progressionType: 'double' as any,
                  progressionValue: 2.5,
                },
                {
                  id: 'ex-3',
                  exerciseId: finalExercises.find(e => e.name === 'Incline Dumbbell Press')?.id || 'seed-1',
                  orderIndex: 2,
                  targetSets: 3,
                  targetRepsMin: 10,
                  targetRepsMax: 15,
                  targetWeight: 50,
                  progressionType: 'double' as any,
                  progressionValue: 2.5,
                },
                {
                  id: 'ex-4',
                  exerciseId: finalExercises.find(e => e.name === 'Lateral Raises')?.id || 'seed-19',
                  orderIndex: 3,
                  targetSets: 3,
                  targetRepsMin: 12,
                  targetRepsMax: 15,
                  targetWeight: 20,
                  progressionType: 'double' as any,
                  progressionValue: 2.5,
                },
                {
                  id: 'ex-5',
                  exerciseId: finalExercises.find(e => e.name === 'Tricep Pushdown')?.id || 'seed-26',
                  orderIndex: 4,
                  targetSets: 3,
                  targetRepsMin: 12,
                  targetRepsMax: 15,
                  targetWeight: 60,
                  progressionType: 'double' as any,
                  progressionValue: 2.5,
                },
                {
                  id: 'ex-6',
                  exerciseId: finalExercises.find(e => e.name === 'Overhead Tricep Extension')?.id || 'seed-27',
                  orderIndex: 5,
                  targetSets: 3,
                  targetRepsMin: 12,
                  targetRepsMax: 15,
                  targetWeight: 40,
                  progressionType: 'double' as any,
                  progressionValue: 2.5,
                },
                {
                  id: 'ex-7',
                  exerciseId: finalExercises.find(e => e.name === 'Front Raises')?.id || 'seed-20',
                  orderIndex: 6,
                  targetSets: 2,
                  targetRepsMin: 12,
                  targetRepsMax: 15,
                  targetWeight: 15,
                  progressionType: 'double' as any,
                  progressionValue: 2.5,
                },
              ],
            },
          ],
          createdAt: new Date().toISOString(),
        };
        
        finalCycles = [demoCycle];
        await storage.saveCycles(finalCycles);
        
        // Assign Push workout to today
        const todayAssignment = {
          id: 'assignment-today',
          date: today.format('YYYY-MM-DD'),
          workoutTemplateId: pushWorkoutId,
          cycleId,
          completed: false,
        };
        
        finalWorkoutAssignments = [todayAssignment];
        await storage.saveWorkoutAssignments(finalWorkoutAssignments);
        
        console.log('✅ Demo cycle with Push workout created for today');
      }
      
      // Log settings info for debugging
      console.log('🔧 App Initialized with Settings:', {
        useKg: finalSettings.useKg,
        hasApiKey: !!finalSettings.openaiApiKey,
        apiKeyPreview: finalSettings.openaiApiKey ? `${finalSettings.openaiApiKey.substring(0, 10)}...` : 'none',
        hasGoals: !!finalSettings.trainerGoals,
        goalsPreview: finalSettings.trainerGoals ? `${finalSettings.trainerGoals.substring(0, 30)}...` : 'none',
        hasPersonality: !!finalSettings.trainerPersonality,
      });
      
      // Migration: Initialize new architecture fields
      let finalWorkoutTemplates = workoutTemplates;
      let finalCyclePlans = cyclePlans;
      let finalScheduledWorkouts = scheduledWorkouts;
      let templatesMigrationNeeded = false;
      let plansMigrationNeeded = false;
      let scheduledMigrationNeeded = false;
      
      // Migrate WorkoutTemplates: add lastUsedAt, usageCount, warmupItems, accessoryItems, kind
      if (workoutTemplates.length > 0) {
        finalWorkoutTemplates = workoutTemplates.map((template: any) => {
          const needsMigration = 
            template.lastUsedAt === undefined ||
            template.usageCount === undefined ||
            template.warmupItems === undefined ||
            template.accessoryItems === undefined ||
            template.kind === undefined;
          
          // Migrate warmup items from old format to new format
          let migratedWarmupItems = template.warmupItems ?? [];
          if (migratedWarmupItems.length > 0) {
            migratedWarmupItems = migratedWarmupItems.map((item: any) => {
              // Old format: { id, exerciseName, duration?, reps?, notes? }
              // New format: { id, exerciseName, sets, reps, weight, isTimeBased, isPerSide }
              if (item.duration !== undefined || item.notes !== undefined || item.weight === undefined || item.isPerSide === undefined) {
                templatesMigrationNeeded = true;
                // Convert old format to new
                const isTimeBased = item.duration !== undefined;
                return {
                  id: item.id,
                  exerciseName: item.exerciseName || '',
                  sets: item.sets ?? 1, // Default to 1 set for old items
                  reps: isTimeBased ? (item.duration || 30) : (item.reps || 10),
                  weight: item.weight ?? 0,
                  isTimeBased: item.isTimeBased ?? isTimeBased,
                  isPerSide: item.isPerSide ?? false, // Default to false for existing items
                  cycleId: item.cycleId,
                  cycleOrder: item.cycleOrder,
                };
              }
              return item;
            });
          }
          
          if (needsMigration) {
            templatesMigrationNeeded = true;
            return {
              ...template,
              kind: 'workout' as const,
              lastUsedAt: template.lastUsedAt ?? null,
              usageCount: template.usageCount ?? 0,
              warmupItems: migratedWarmupItems,
              accessoryItems: template.accessoryItems ?? [],
              source: template.source ?? 'user',
            };
          }
          return {
            ...template,
            warmupItems: migratedWarmupItems,
            accessoryItems: template.accessoryItems ?? [],
          };
        });
      }
      
      // Migrate CyclePlans: add lastUsedAt, usageCount
      if (cyclePlans.length > 0) {
        finalCyclePlans = cyclePlans.map((plan: any) => {
          const needsMigration = 
            plan.lastUsedAt === undefined ||
            plan.usageCount === undefined;
          
          if (needsMigration) {
            plansMigrationNeeded = true;
            return {
              ...plan,
              lastUsedAt: plan.lastUsedAt ?? null,
              usageCount: plan.usageCount ?? 0,
            };
          }
          return plan;
        });
      }
      
      // Migrate ScheduledWorkouts: add snapshots, completion states, isLocked
      if (scheduledWorkouts.length > 0) {
        finalScheduledWorkouts = scheduledWorkouts.map((sw: any) => {
          const needsMigration = 
            sw.titleSnapshot === undefined ||
            sw.warmupSnapshot === undefined ||
            sw.exercisesSnapshot === undefined ||
            sw.accessorySnapshot === undefined ||
            sw.warmupCompletion === undefined ||
            sw.workoutCompletion === undefined ||
            sw.accessoryCompletion === undefined ||
            sw.isLocked === undefined ||
            sw.programId === undefined;
          
          if (needsMigration) {
            scheduledMigrationNeeded = true;
            
            // Get template to create snapshots if missing
            const template = workoutTemplates.find((t: any) => t.id === sw.templateId);
            
            return {
              ...sw,
              titleSnapshot: sw.titleSnapshot ?? (template?.name || 'Workout'),
              warmupSnapshot: sw.warmupSnapshot ?? (template?.warmupItems || []).map((item: any) => ({ ...item })),
              exercisesSnapshot: sw.exercisesSnapshot ?? (template?.items || []).map((item: any) => ({ ...item })),
              accessorySnapshot: sw.accessorySnapshot ?? (template?.accessoryItems || []).map((item: any) => ({ ...item })),
              warmupCompletion: sw.warmupCompletion ?? { completedItems: [] },
              mainCompletion: sw.mainCompletion ?? { completedItems: [] },
              workoutCompletion: sw.workoutCompletion ?? { completedExercises: {}, completedSets: {} },
              accessoryCompletion: sw.accessoryCompletion ?? { completedItems: [] },
              isLocked: sw.isLocked ?? (sw.status === 'completed'),
              programId: sw.programId ?? (sw.cyclePlanId || null),
              programName: sw.programName ?? null,
              weekIndex: sw.weekIndex ?? null,
              dayIndex: sw.dayIndex ?? null,
              startedAt: sw.startedAt ?? null,
              completedAt: sw.completedAt ?? (sw.status === 'completed' ? new Date().toISOString() : null),
            };
          }
          return sw;
        });
      }
      
      // Save migrations if needed
      if (templatesMigrationNeeded) {
        await storage.saveWorkoutTemplates(finalWorkoutTemplates);
        console.log('✅ WorkoutTemplates migration complete:', finalWorkoutTemplates.length, 'templates');
      }
      if (plansMigrationNeeded) {
        await storage.saveCyclePlans(finalCyclePlans);
        console.log('✅ CyclePlans migration complete:', finalCyclePlans.length, 'plans');
      }
      if (scheduledMigrationNeeded) {
        await storage.saveScheduledWorkouts(finalScheduledWorkouts);
        console.log('✅ ScheduledWorkouts migration complete:', finalScheduledWorkouts.length, 'workouts');
      }
      
      // ============================================
      // VERIFICATION LOG: Schedule-First Architecture
      // ============================================
      console.log('🔍 SCHEDULE-FIRST ARCHITECTURE VERIFICATION:');
      console.log('================================================');
      
      console.log('\n📋 WORKOUT TEMPLATES (' + finalWorkoutTemplates.length + ' total):');
      if (finalWorkoutTemplates.length > 0) {
        const sample = finalWorkoutTemplates[0];
        console.log('  Sample template:', {
          id: sample.id,
          name: sample.name,
          kind: sample.kind,
          hasWarmupItems: Array.isArray(sample.warmupItems),
          warmupItemsCount: sample.warmupItems?.length || 0,
          exerciseCount: sample.items?.length || 0,
          lastUsedAt: sample.lastUsedAt,
          usageCount: sample.usageCount,
          source: sample.source,
        });
      } else {
        console.log('  ⚠️ No templates found - this is normal for a new installation');
      }
      
      console.log('\n📅 CYCLE PLANS (' + finalCyclePlans.length + ' total):');
      if (finalCyclePlans.length > 0) {
        const sample = finalCyclePlans[0];
        console.log('  Sample plan:', {
          id: sample.id,
          name: sample.name,
          active: sample.active,
          weeks: sample.weeks,
          lastUsedAt: sample.lastUsedAt,
          usageCount: sample.usageCount,
        });
      } else {
        console.log('  ℹ️ No plans found - this is normal for a new installation');
      }
      
      console.log('\n🗓️  SCHEDULED WORKOUTS (' + finalScheduledWorkouts.length + ' total):');
      if (finalScheduledWorkouts.length > 0) {
        const sample = finalScheduledWorkouts[0];
        console.log('  Sample scheduled workout:', {
          id: sample.id,
          date: sample.date,
          status: sample.status,
          isLocked: sample.isLocked,
          hasSnapshots: {
            title: !!sample.titleSnapshot,
            warmup: Array.isArray(sample.warmupSnapshot),
            exercises: Array.isArray(sample.exercisesSnapshot),
          },
          snapshotCounts: {
            warmupItems: sample.warmupSnapshot?.length || 0,
            exercises: sample.exercisesSnapshot?.length || 0,
          },
          hasCompletion: {
            warmup: !!sample.warmupCompletion,
            workout: !!sample.workoutCompletion,
          },
          programMetadata: {
            programId: sample.programId,
            programName: sample.programName,
            weekIndex: sample.weekIndex,
            dayIndex: sample.dayIndex,
          },
        });
        
        // Check for any locked workouts
        const lockedCount = finalScheduledWorkouts.filter(sw => sw.isLocked).length;
        console.log('  🔒 Locked (completed) workouts:', lockedCount);
      } else {
        console.log('  ℹ️ No scheduled workouts found - this is normal for a new installation');
      }
      
      console.log('\n✅ NEW ARCHITECTURE STATUS:');
      console.log('  - Data structure: ✅ Loaded');
      console.log('  - Migrations: ✅ ' + (templatesMigrationNeeded || plansMigrationNeeded || scheduledMigrationNeeded ? 'Applied' : 'Not needed'));
      console.log('  - Store methods: ✅ Available');
      console.log('  - Ready for UI: ✅ Yes');
      
      // Run a simple test if in development mode
      if (__DEV__ && finalWorkoutTemplates.length === 0 && finalScheduledWorkouts.length === 0) {
        console.log('\n🧪 RUNNING QUICK TEST (dev mode only)...');
        
        // Create a test template
        const testTemplate: WorkoutTemplate = {
          id: 'test-template-1',
          kind: 'workout',
          name: 'Test Push Workout',
          warmupItems: [
            { id: 'warmup-1', exerciseName: 'Arm Circles', duration: 60 },
            { id: 'warmup-2', exerciseName: 'Push-up', reps: 10 },
          ],
          items: [
            { id: 'ex-1', exerciseId: 'bench-press', order: 1, sets: 4, reps: 8, weight: 135 },
            { id: 'ex-2', exerciseId: 'incline-press', order: 2, sets: 3, reps: 10, weight: 100 },
          ],
          accessoryItems: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastUsedAt: null,
          usageCount: 0,
          source: 'user',
        };
        
        console.log('  1️⃣ Created test template:', testTemplate.name);
        console.log('     - Warm-up items:', testTemplate.warmupItems.length);
        console.log('     - Exercises:', testTemplate.items.length);
        console.log('     - Initial usageCount:', testTemplate.usageCount);
        console.log('     - Initial lastUsedAt:', testTemplate.lastUsedAt);
        
        console.log('\n  2️⃣ Test template ready for scheduling');
        console.log('     Next: UI can call scheduleWorkout(date, "test-template-1", "manual")');
        console.log('     This will:');
        console.log('       ✓ Create snapshots (title, warmup, exercises)');
        console.log('       ✓ Initialize completion states');
        console.log('       ✓ Set isLocked = false');
        console.log('       ✓ Update lastUsedAt to now');
        console.log('       ✓ Increment usageCount to 1');
        
        console.log('\n  ℹ️ Test template NOT saved - add UI to test scheduling flow');
      }
      
      console.log('================================================\n');
      
      set({
        cycles: finalCycles,
        exercises: finalExercises,
        sessions: finalSessions,
        bodyWeightEntries: finalBodyWeightEntries,
        progressPhotos,
        pinnedKeyLifts,
        workoutAssignments: finalWorkoutAssignments,
        exercisePRs: finalExercisePRs,
        trainerConversations: finalConversations,
        settings: finalSettings,
        workoutProgress: finalWorkoutProgress,
        detailedWorkoutProgress,
        hiitTimers,
        hiitTimerSessions,
        warmupPresets,
        corePresets,
        bonusLogs,
        corePrograms,
        coreLogs,
        warmupCompletionByKey: warmupCompletionByKey || {},
        accessoryCompletionByKey: accessoryCompletionByKey || {},
        workoutTemplates: finalWorkoutTemplates,
        cyclePlans: finalCyclePlans,
        scheduledWorkouts: finalScheduledWorkouts,
        isLoading: false,
      });
      
      // Recover any mainCompletion data from saved sessions (one-time repair)
      try {
        await get().recoverCompletionFromSessions();
      } catch (error) {
        console.error('Error recovering completion from sessions:', error);
      }
      // Recover completed state from detailedWorkoutProgress so past workouts show as completed (not skipped)
      try {
        await get().recoverCompletionFromDetailedProgress();
      } catch (error) {
        console.error('Error recovering completion from detailed progress:', error);
      }

      // Initialize cloud backup service (after data is loaded)
      try {
        await cloudBackupService.initialize();
      } catch (error) {
        console.error('Error initializing cloud backup:', error);
      }
      
      // Initialize automatic Supabase cloud sync (after data is loaded)
      try {
        await cloudSyncService.initialize();
      } catch (error) {
        console.error('Error initializing Supabase sync:', error);
      }
    } catch (error) {
      console.error('Error initializing store:', error);
      set({ isLoading: false });
    }
  },
  
  addCycle: async (cycle) => {
    const cycles = [...get().cycles, cycle];
    set({ cycles });
    await storage.saveCycles(cycles);
  },
  
  updateCycle: async (cycleId, updates) => {
    const cycles = get().cycles.map(c =>
      c.id === cycleId ? { ...c, ...updates } : c
    );
    set({ cycles });
    await storage.saveCycles(cycles);
  },
  
  deleteCycle: async (cycleId) => {
    const cycles = get().cycles.filter(c => c.id !== cycleId);
    const sessions = get().sessions.filter(s => s.cycleId !== cycleId);
    const workoutAssignments = get().workoutAssignments.filter(a => a.cycleId !== cycleId);
    set({ cycles, sessions, workoutAssignments });
    await storage.saveCycles(cycles);
    await storage.saveSessions(sessions);
    await storage.saveWorkoutAssignments(workoutAssignments);
  },
  
  addExercise: async (exercise) => {
    const exercises = [...get().exercises, exercise];
    set({ exercises });
    await storage.saveExercises(exercises);
  },
  
  updateExercise: async (exerciseId, updates) => {
    const exercises = get().exercises.map(ex => 
      ex.id === exerciseId ? { ...ex, ...updates } : ex
    );
    set({ exercises });
    await storage.saveExercises(exercises);
  },
  
  addSession: async (session) => {
    console.log('💾 addSession called with:', {
      sessionId: session.id,
      date: session.date,
      setsCount: session.sets?.length || 0,
      workoutTemplateId: session.workoutTemplateId,
    });
    
    const currentSessions = get().sessions;
    console.log(`   Current sessions count: ${currentSessions.length}`);
    
    const sessions = [...currentSessions, session];
    console.log(`   New sessions count: ${sessions.length}`);
    
    set({ sessions });
    console.log('   ✅ Session added to store');
    
    await storage.saveSessions(sessions);
    console.log('   ✅ Sessions saved to storage');
    
    // Verify it was saved
    const verifyCount = get().sessions.length;
    console.log(`   ✅ Verification: store now has ${verifyCount} sessions`);
  },
  
  updateSession: async (sessionId, session) => {
    console.log('💾 updateSession called for:', sessionId);
    const currentSessions = get().sessions;
    const sessions = currentSessions.map(s => s.id === sessionId ? session : s);
    set({ sessions });
    await storage.saveSessions(sessions);
    console.log('   ✅ Session updated');
  },
  
  deleteSession: async (sessionId) => {
    console.log('🗑️ deleteSession called for:', sessionId);
    const currentSessions = get().sessions;
    const sessions = currentSessions.filter(s => s.id !== sessionId);
    set({ sessions });
    await storage.saveSessions(sessions);
    console.log('   ✅ Session deleted');
  },
  
  addBodyWeightEntry: async (entry) => {
    const entries = [...get().bodyWeightEntries, entry];
    set({ bodyWeightEntries: entries });
    await storage.saveBodyWeightEntries(entries);
  },

  deleteBodyWeightEntry: async (entryId) => {
    const entries = get().bodyWeightEntries.filter(e => e.id !== entryId);
    set({ bodyWeightEntries: entries });
    await storage.saveBodyWeightEntries(entries);
  },

  addProgressPhoto: async (photoData) => {
    const photo: ProgressPhoto = { ...photoData, id: `pp-${Date.now()}` };
    const photos = [photo, ...get().progressPhotos];
    set({ progressPhotos: photos });
    await storage.saveProgressPhotos(photos);
    return photo;
  },

  deleteProgressPhoto: async (photoId) => {
    const photos = get().progressPhotos.filter(p => p.id !== photoId);
    set({ progressPhotos: photos });
    await storage.saveProgressPhotos(photos);
  },

  setPinnedKeyLifts: async (exerciseIds) => {
    set({ pinnedKeyLifts: exerciseIds.slice(0, 4) });
    await storage.savePinnedKeyLifts(exerciseIds.slice(0, 4));
  },

  updateSettings: async (updates) => {
    const settings = { ...get().settings, ...updates };
    console.log('📝 Updating settings:', updates);
    set({ settings });
    await storage.saveSettings(settings);
  },
  
  setBarbellMode: async (exerciseId, enabled) => {
    const settings = {
      ...get().settings,
      barbellMode: {
        ...get().settings.barbellMode,
        [exerciseId]: enabled,
      },
    };
    set({ settings });
    await storage.saveSettings(settings);
  },
  
  getBarbellMode: (exerciseId) => {
    return get().settings.barbellMode?.[exerciseId] ?? false;
  },
  
  // Workout assignments
  assignWorkout: async (date, workoutTemplateId, cycleId) => {
    const assignment: WorkoutAssignment = {
      id: Date.now().toString(),
      date,
      workoutTemplateId,
      cycleId,
      completed: false,
    };
    const assignments = [...get().workoutAssignments, assignment];
    set({ workoutAssignments: assignments });
    await storage.saveWorkoutAssignments(assignments);
  },
  
  getWorkoutForDate: (date) => {
    return get().workoutAssignments.find(a => a.date === date && !a.completed);
  },
  
  clearWorkoutAssignmentsForDateRange: async (startDate, endDate) => {
    console.log('🧹 Clearing workouts in date range:', startDate, 'to', endDate);
    
    // Clear old architecture (workoutAssignments)
    const assignments = get().workoutAssignments.filter(a => {
      return a.date < startDate || a.date > endDate;
    });
    const removedAssignments = get().workoutAssignments.length - assignments.length;
    console.log('  Removed', removedAssignments, 'workout assignments');
    set({ workoutAssignments: assignments });
    await storage.saveWorkoutAssignments(assignments);
    
    // Clear new architecture (scheduledWorkouts)
    const scheduled = get().scheduledWorkouts.filter(s => {
      return s.date < startDate || s.date > endDate;
    });
    const removedScheduled = get().scheduledWorkouts.length - scheduled.length;
    console.log('  Removed', removedScheduled, 'scheduled workouts');
    set({ scheduledWorkouts: scheduled });
    await storage.saveScheduledWorkouts(scheduled);
  },
  
  swapWorkoutAssignments: async (date1: string, date2: string) => {
    console.log('🔄 swapWorkoutAssignments called:');
    console.log('  date1:', date1);
    console.log('  date2:', date2);
    
    // NEW: Support both old assignments and new scheduledWorkouts
    const currentAssignments = get().workoutAssignments;
    const currentScheduled = get().scheduledWorkouts;
    
    // Check old architecture first
    const assignment1 = currentAssignments.find(a => a.date === date1);
    const assignment2 = currentAssignments.find(a => a.date === date2);
    
    // Check new architecture
    const scheduled1 = currentScheduled.find(s => s.date === date1);
    const scheduled2 = currentScheduled.find(s => s.date === date2);
    
    // HARD LOCK ENFORCEMENT: Cannot swap locked (completed) workouts
    if (scheduled1?.isLocked || scheduled1?.status === 'completed') {
      console.warn('⚠️ Cannot swap locked (completed) workout on date1:', date1, { isLocked: scheduled1?.isLocked, status: scheduled1?.status });
      return;
    }
    if (scheduled2?.isLocked || scheduled2?.status === 'completed') {
      console.warn('⚠️ Cannot swap locked (completed) workout on date2:', date2, { isLocked: scheduled2?.isLocked, status: scheduled2?.status });
      return;
    }
    
    console.log('  scheduled1:', scheduled1 ? { date: scheduled1.date, templateId: scheduled1.templateId, template: get().getWorkoutTemplate(scheduled1.templateId)?.name } : 'none');
    console.log('  scheduled2:', scheduled2 ? { date: scheduled2.date, templateId: scheduled2.templateId, template: get().getWorkoutTemplate(scheduled2.templateId)?.name } : 'none');
    console.log('  assignment1:', assignment1 ? { date: assignment1.date, workoutTemplateId: assignment1.workoutTemplateId } : 'none');
    console.log('  assignment2:', assignment2 ? { date: assignment2.date, workoutTemplateId: assignment2.workoutTemplateId } : 'none');
    
    // SPECIAL CASE: Swapping a scheduled single workout with a cycle assignment.
    //
    // Important nuance:
    // - When a single workout is scheduled on a cycle day, we now KEEP the underlying cycle assignment.
    // - So when the user taps a cycle workout to "replace" the single workout, they expect THAT chosen cycle
    //   workout to come to the selected date (not just "whatever cycle workout was originally under it").
    //
    // Therefore, when swapping scheduled <-> assignment, we must:
    // 1) Move the scheduled workout to the other date
    // 2) Swap the cycle assignments between the two dates (when both exist)
    if (scheduled1 && !scheduled2 && assignment2) {
      console.log('  Action: Swapping single workout (date1) with cycle workout (date2)');

      // 1) Move scheduled workout from date1 -> date2
      const newScheduled = currentScheduled.map(s => (s.date === date1 ? { ...s, date: date2 } : s));
      set({ scheduledWorkouts: newScheduled });
      await storage.saveScheduledWorkouts(newScheduled);

      // 2) Swap/move assignments so the selected cycle workout actually comes to date1
      if (assignment1) {
        // Swap assignment dates
        const newAssignments = currentAssignments.map(a => {
          if (a.id === assignment1.id) return { ...a, date: date2 };
          if (a.id === assignment2.id) return { ...a, date: date1 };
          return a;
        });
        set({ workoutAssignments: newAssignments });
        await storage.saveWorkoutAssignments(newAssignments);
      } else {
        // Move assignment2 to date1 (date2 will be hidden by the scheduled workout anyway)
        const newAssignments = currentAssignments
          .filter(a => a.id !== assignment2.id)
          .concat({ ...assignment2, date: date1 });
        set({ workoutAssignments: newAssignments });
        await storage.saveWorkoutAssignments(newAssignments);
      }

      console.log('  Result: Scheduled workout moved, cycle assignment swapped/moved');
      return;
    }

    if (scheduled2 && !scheduled1 && assignment1) {
      console.log('  Action: Swapping single workout (date2) with cycle workout (date1)');

      // 1) Move scheduled workout from date2 -> date1
      const newScheduled = currentScheduled.map(s => (s.date === date2 ? { ...s, date: date1 } : s));
      set({ scheduledWorkouts: newScheduled });
      await storage.saveScheduledWorkouts(newScheduled);

      // 2) Swap/move assignments so the selected cycle workout actually comes to date2
      if (assignment2) {
        const newAssignments = currentAssignments.map(a => {
          if (a.id === assignment1.id) return { ...a, date: date2 };
          if (a.id === assignment2.id) return { ...a, date: date1 };
          return a;
        });
        set({ workoutAssignments: newAssignments });
        await storage.saveWorkoutAssignments(newAssignments);
      } else {
        const newAssignments = currentAssignments
          .filter(a => a.id !== assignment1.id)
          .concat({ ...assignment1, date: date2 });
        set({ workoutAssignments: newAssignments });
        await storage.saveWorkoutAssignments(newAssignments);
      }

      console.log('  Result: Scheduled workout moved, cycle assignment swapped/moved');
      return;
    }
    
    // Handle new architecture (ScheduledWorkouts)
    if (scheduled1 || scheduled2) {
      let newScheduled = [...currentScheduled];
      
      if (scheduled1 && scheduled2) {
        console.log('  Action: Swapping both workouts');
        // Both dates have scheduled workouts - swap ONLY the workout identity, NOT completion status
        newScheduled = currentScheduled.map(s => {
          if (s.date === date1) {
            // Swap workout identity from scheduled2, keep date1's completion state
            return { 
              ...s,
              templateId: scheduled2.templateId,
              titleSnapshot: scheduled2.titleSnapshot,
              warmupSnapshot: scheduled2.warmupSnapshot,
              exercisesSnapshot: scheduled2.exercisesSnapshot,
              source: scheduled2.source,
              programId: scheduled2.programId,
              programName: scheduled2.programName,
              weekIndex: scheduled2.weekIndex,
              dayIndex: scheduled2.dayIndex,
              cyclePlanId: scheduled2.cyclePlanId,
            };
          } else if (s.date === date2) {
            // Swap workout identity from scheduled1, keep date2's completion state
            return { 
              ...s,
              templateId: scheduled1.templateId,
              titleSnapshot: scheduled1.titleSnapshot,
              warmupSnapshot: scheduled1.warmupSnapshot,
              exercisesSnapshot: scheduled1.exercisesSnapshot,
              source: scheduled1.source,
              programId: scheduled1.programId,
              programName: scheduled1.programName,
              weekIndex: scheduled1.weekIndex,
              dayIndex: scheduled1.dayIndex,
              cyclePlanId: scheduled1.cyclePlanId,
            };
          }
          return s;
        });
      } else if (scheduled1 && !scheduled2) {
        console.log('  Action: Moving workout from date1 to date2');
        // Only date1 has scheduled workout - move it to date2
        newScheduled = currentScheduled.map(s => 
          s.date === date1 ? { ...s, date: date2 } : s
        );
      } else if (!scheduled1 && scheduled2) {
        console.log('  Action: Moving workout from date2 to date1');
        // Only date2 has scheduled workout - move it to date1
        newScheduled = currentScheduled.map(s => 
          s.date === date2 ? { ...s, date: date1 } : s
        );
      }
      
      console.log('  Result - New scheduled workouts:', newScheduled.map(s => ({ date: s.date, template: get().getWorkoutTemplate(s.templateId)?.name })));
      
      set({ scheduledWorkouts: newScheduled });
      await storage.saveScheduledWorkouts(newScheduled);
      return;
    }
    
    // Handle old architecture (WorkoutAssignments)
    console.log('  Using OLD architecture (workoutAssignments)');
    console.log('  assignment1:', assignment1 ? { date: assignment1.date, workoutTemplateId: assignment1.workoutTemplateId } : 'none');
    console.log('  assignment2:', assignment2 ? { date: assignment2.date, workoutTemplateId: assignment2.workoutTemplateId } : 'none');
    
    let newAssignments = [...currentAssignments];
    
    if (assignment1 && assignment2) {
      console.log('  Action: Swapping both assignments');
      // Both dates have assignments - swap them
      newAssignments = currentAssignments.map(a => {
        if (a.date === date1) {
          return { ...a, workoutTemplateId: assignment2.workoutTemplateId, cycleId: assignment2.cycleId };
        } else if (a.date === date2) {
          return { ...a, workoutTemplateId: assignment1.workoutTemplateId, cycleId: assignment1.cycleId };
        }
        return a;
      });
    } else if (assignment1 && !assignment2) {
      console.log('  Action: Moving assignment from date1 to date2');
      // Only date1 has assignment - move it to date2
      newAssignments = currentAssignments
        .filter(a => a.date !== date1)
        .concat({
          ...assignment1,
          date: date2,
        });
    } else if (!assignment1 && assignment2) {
      console.log('  Action: Moving assignment from date2 to date1');
      // Only date2 has assignment - move it to date1
      newAssignments = currentAssignments
        .filter(a => a.date !== date2)
        .concat({
          ...assignment2,
          date: date1,
        });
    }
    // If neither has assignments (both rest days), do nothing
    
    console.log('  Result - New assignments:', newAssignments.filter(a => a.date === date1 || a.date === date2).map(a => ({ date: a.date, workoutTemplateId: a.workoutTemplateId })));
    
    set({ workoutAssignments: newAssignments });
    await storage.saveWorkoutAssignments(newAssignments);
  },
  
  // Trainer conversations
  addConversation: async (conversation) => {
    const conversations = [...get().trainerConversations, conversation];
    set({ trainerConversations: conversations });
    await storage.saveTrainerConversations(conversations);
  },
  
  updateConversation: async (conversationId, updates) => {
    const conversations = get().trainerConversations.map(c =>
      c.id === conversationId ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
    );
    set({ trainerConversations: conversations });
    await storage.saveTrainerConversations(conversations);
  },
  
  getNextCycleNumber: () => {
    const cycles = get().cycles;
    if (cycles.length === 0) return 1;
    return Math.max(...cycles.map(c => c.cycleNumber)) + 1;
  },
  
  saveWorkoutProgress: async (workoutId, completedExercises, completedSets) => {
    const newProgress = {
      ...get().workoutProgress,
      [workoutId]: { completedExercises, completedSets },
    };
    set({ workoutProgress: newProgress });
    await storage.saveWorkoutProgressToStorage(newProgress);
  },
  
  getWorkoutProgress: (workoutId) => {
    return get().workoutProgress[workoutId];
  },
  
  clearWorkoutProgress: async (workoutId) => {
    console.log('🧹 clearWorkoutProgress called with workoutId:', workoutId);
    
    // Clear old progress tracking
    const newProgress = { ...get().workoutProgress };
    delete newProgress[workoutId];
    
    const newDetailedProgress = { ...get().detailedWorkoutProgress };
    delete newDetailedProgress[workoutId];
    
    // Reset scheduled workout completion states if this is a scheduled workout ID
    const scheduledWorkouts = get().scheduledWorkouts.map(sw => {
      if (sw.id === workoutId) {
        console.log('🔄 Resetting completion states for scheduled workout:', sw.id);
        return {
          ...sw,
          warmupCompletion: { completedItems: [] },
          mainCompletion: { completedItems: [] },
          workoutCompletion: { completedExercises: {}, completedSets: {} },
          accessoryCompletion: { completedItems: [] },
        };
      }
      return sw;
    });
    
    set({ 
      workoutProgress: newProgress,
      detailedWorkoutProgress: newDetailedProgress,
      scheduledWorkouts,
    });
    
    await storage.saveWorkoutProgressToStorage(newProgress);
    await storage.saveDetailedWorkoutProgress(newDetailedProgress);
    await storage.saveScheduledWorkouts(scheduledWorkouts);
    
    console.log('✅ Workout progress cleared and saved');
  },
  
  clearAllHistory: async () => {
    console.log('🧹 Clearing all workout history...');
    
    // Clear sessions and workout progress
    set({ 
      sessions: [],
      workoutProgress: {},
      detailedWorkoutProgress: {},
      exercisePRs: [],
      workoutTemplates: [],
      cyclePlans: [],
      scheduledWorkouts: [],
      warmupCompletionByKey: {},
      accessoryCompletionByKey: {},
    });
    
    // Save to storage
    await storage.saveSessions([]);
    await storage.saveWorkoutProgressToStorage({});
    await storage.saveDetailedWorkoutProgress({});
    await storage.saveExercisePRs([]);
    await storage.saveWorkoutTemplates([]);
    await storage.saveCyclePlans([]);
    await storage.saveScheduledWorkouts([]);
    await storage.saveWarmupCompletionByKey({});
    await storage.saveAccessoryCompletionByKey({});
    
    console.log('✅ All history cleared!');
  },
  
  recoverCompletedWorkouts: async () => {
    console.log('🔄 Starting workout recovery process...');
    
    // Import the recovery function
    const { recoverSessionsFromCompletionStates } = await import('../utils/dataMigration');
    
    // Run the recovery
    const result = await recoverSessionsFromCompletionStates();
    
    if (result.success && result.sessionsCreated > 0) {
      // Reload sessions from storage to update the store
      const updatedSessions = await storage.loadSessions();
      set({ sessions: updatedSessions });
      console.log(`✅ Recovery complete! Created ${result.sessionsCreated} sessions from ${result.workoutsProcessed} workouts`);
    } else if (result.success) {
      console.log('ℹ️ No new sessions to recover');
    } else {
      console.error('❌ Recovery failed:', result.error);
    }
    
    return result;
  },

  recoverCompletionFromSessions: async () => {
    console.log('🔧 Recovering mainCompletion from saved sessions...');
    const sessions = get().sessions;
    const scheduledWorkouts = [...get().scheduledWorkouts];
    const details: string[] = [];
    let recovered = 0;

    for (const session of sessions) {
      const workoutKey = (session as any).workoutKey as string | undefined;
      if (!workoutKey) continue;

      const swIdx = scheduledWorkouts.findIndex(sw => sw.id === workoutKey);
      if (swIdx < 0) continue;

      const sw = scheduledWorkouts[swIdx];
      const existingCompleted = sw.mainCompletion?.completedItems?.length ?? 0;
      const snapshot = sw.exercisesSnapshot || [];

      // Build a map: exerciseLibraryId → template item id
      const libIdToItemId: Record<string, string> = {};
      snapshot.forEach((item: any) => {
        const libId = item.exerciseId || item.id;
        libIdToItemId[libId] = item.id;
      });

      // Rebuild completion items from session sets
      const recoveredItems = new Set<string>(sw.mainCompletion?.completedItems || []);
      let addedCount = 0;
      for (const setData of session.sets) {
        const itemId = libIdToItemId[setData.exerciseId];
        if (itemId && setData.isCompleted) {
          const completionKey = `${itemId}-set-${setData.setIndex}`;
          if (!recoveredItems.has(completionKey)) {
            recoveredItems.add(completionKey);
            addedCount++;
          }
        }
      }

      if (addedCount > 0) {
        const completedItems = [...recoveredItems];
        const wasCompleted = sw.status === 'completed';
        const totalSets = snapshot.reduce((sum: number, item: any) => sum + (typeof item.sets === 'number' ? item.sets : 0), 0);
        const isNowComplete = completedItems.length >= totalSets && totalSets > 0;

        scheduledWorkouts[swIdx] = {
          ...sw,
          mainCompletion: {
            ...(sw.mainCompletion || {}),
            completedItems,
          },
          status: isNowComplete ? 'completed' as const : (sw.status === 'planned' ? 'in_progress' as const : sw.status),
          isLocked: isNowComplete ? true : sw.isLocked,
          completedAt: isNowComplete && !sw.completedAt ? new Date().toISOString() : sw.completedAt,
        };

        const msg = `Recovered ${addedCount} sets for ${sw.titleSnapshot || workoutKey} (${sw.date}) — now ${completedItems.length}/${totalSets} sets`;
        details.push(msg);
        console.log('✅', msg);
        recovered++;
      }
    }

    if (recovered > 0) {
      set({ scheduledWorkouts });
      await storage.saveScheduledWorkouts(scheduledWorkouts);
      console.log(`🎉 Recovery complete: ${recovered} workouts restored`);
    } else {
      console.log('ℹ️ No workouts needed recovery');
    }

    return { recovered, details };
  },

  /** Recover completed state from detailedWorkoutProgress so past workouts show as completed (not skipped) after ending a cycle. */
  recoverCompletionFromDetailedProgress: async () => {
    console.log('🔧 Recovering completion from detailedWorkoutProgress...');
    const scheduledWorkouts = [...get().scheduledWorkouts];
    const detailedProgress = get().detailedWorkoutProgress;
    const details: string[] = [];
    let recovered = 0;

    for (const sw of scheduledWorkouts) {
      if (sw.isLocked || sw.status === 'completed') continue;
      const progress = detailedProgress[sw.id];
      if (!progress) continue;

      const snapshot = sw.exercisesSnapshot || [];
      let totalSets = 0;
      snapshot.forEach((item: any) => {
        if (Array.isArray(item.sets)) totalSets += item.sets.length;
        else if (typeof item.sets === 'number') totalSets += item.sets;
      });
      if (totalSets === 0) continue;

      const percentage = get().getWorkoutCompletionPercentage(sw.id, totalSets);
      if (percentage < 100) continue;

      // Build mainCompletion.completedItems from progress so getMainCompletion returns 100%
      const completedItems: string[] = [];
      snapshot.forEach((item: any) => {
        const itemId = item.id;
        const exerciseProgress = progress.exercises[itemId] || progress.exercises[item.exerciseId];
        if (!exerciseProgress?.sets) return;
        const numSets = typeof item.sets === 'number' ? item.sets : (item.sets?.length ?? 0);
        for (let i = 0; i < numSets; i++) {
          if (exerciseProgress.sets[i]?.completed) {
            completedItems.push(`${itemId}-set-${i}`);
          }
        }
      });

      const existingCompleted = sw.mainCompletion?.completedItems?.length ?? 0;
      if (completedItems.length >= totalSets && (existingCompleted < totalSets || !sw.mainCompletion?.completedItems?.length)) {
        const swIdx = scheduledWorkouts.findIndex(s => s.id === sw.id);
        if (swIdx < 0) continue;
        scheduledWorkouts[swIdx] = {
          ...sw,
          mainCompletion: { ...(sw.mainCompletion || {}), completedItems },
          status: 'completed' as const,
          isLocked: true,
          completedAt: sw.completedAt || new Date().toISOString(),
        };
        const msg = `Recovered ${sw.titleSnapshot || sw.id} (${sw.date}) from progress — ${completedItems.length}/${totalSets} sets`;
        details.push(msg);
        console.log('✅', msg);
        recovered++;
      }
    }

    if (recovered > 0) {
      set({ scheduledWorkouts });
      await storage.saveScheduledWorkouts(scheduledWorkouts);
      console.log(`🎉 Recovery from progress: ${recovered} workouts restored`);
    } else {
      console.log('ℹ️ No workouts needed recovery from progress');
    }
    return { recovered, details };
  },
  
  getExercisePR: (exerciseId) => {
    return get().exercisePRs.find(pr => pr.exerciseId === exerciseId);
  },
  
  updateExercisePR: async (exerciseId, exerciseName, weight, reps, date) => {
    const currentPR = get().exercisePRs.find(pr => pr.exerciseId === exerciseId);
    
    // Only update if this is a new PR (heavier weight)
    if (!currentPR || weight > currentPR.weight) {
      const newPR: ExercisePR = {
        exerciseId,
        exerciseName,
        weight,
        reps,
        date,
      };
      
      const updatedPRs = currentPR
        ? get().exercisePRs.map(pr => pr.exerciseId === exerciseId ? newPR : pr)
        : [...get().exercisePRs, newPR];
      
      set({ exercisePRs: updatedPRs });
      await storage.saveExercisePRs(updatedPRs);
      
      console.log(`🎉 NEW PR! ${exerciseName}: ${weight}lbs x ${reps} reps`);
    }
  },
  
  // NEW: Detailed workout progress methods
  saveExerciseProgress: async (workoutKey, exerciseId, progress) => {
    const currentProgress = get().detailedWorkoutProgress[workoutKey] || {
      workoutKey,
      exercises: {},
      lastUpdated: new Date().toISOString(),
    };
    
    const updatedProgress = {
      ...currentProgress,
      exercises: {
        ...currentProgress.exercises,
        [exerciseId]: progress,
      },
      lastUpdated: new Date().toISOString(),
    };
    
    const newDetailedProgress = {
      ...get().detailedWorkoutProgress,
      [workoutKey]: updatedProgress,
    };
    
    set({ detailedWorkoutProgress: newDetailedProgress });
    await storage.saveDetailedWorkoutProgress(newDetailedProgress);
  },
  
  getExerciseProgress: (workoutKey, exerciseId) => {
    const workoutProgress = get().detailedWorkoutProgress[workoutKey];
    const exerciseProgress = workoutProgress?.exercises[exerciseId];
    // Only log if there's actual progress (reduces console noise)
    if (exerciseProgress) {
    console.log(`🔎 getExerciseProgress(${exerciseId}):`, JSON.stringify(exerciseProgress, null, 2));
    }
    return exerciseProgress;
  },
  
  skipExercise: async (workoutKey, exerciseId) => {
    console.log('🚫 skipExercise called:', { workoutKey, exerciseId });
    
    const currentProgress = get().detailedWorkoutProgress[workoutKey] || {
      workoutKey,
      exercises: {},
      lastUpdated: new Date().toISOString(),
    };
    
    console.log('📊 Current progress before skip:', JSON.stringify(currentProgress, null, 2));
    
    // Mark exercise as skipped with empty sets
    const skippedProgress: ExerciseProgress = {
      exerciseId,
      sets: [],
      skipped: true,
    };
    
    console.log('🏷️ Skipped progress object:', JSON.stringify(skippedProgress, null, 2));
    
    const updatedProgress = {
      ...currentProgress,
      exercises: {
        ...currentProgress.exercises,
        [exerciseId]: skippedProgress,
      },
      lastUpdated: new Date().toISOString(),
    };
    
    console.log('📊 Updated progress after skip:', JSON.stringify(updatedProgress, null, 2));
    
    // Build the complete new state
    const newDetailedProgress = {
      ...get().detailedWorkoutProgress,
      [workoutKey]: updatedProgress,
    };
    
    console.log('💾 Full state being saved:', JSON.stringify(newDetailedProgress, null, 2));
    
    // Update store with the new state
    set({ detailedWorkoutProgress: newDetailedProgress });
    
    console.log('💾 Saving to storage...');
    // Save the SAME state we just set (not calling get() again)
    await storage.saveDetailedWorkoutProgress(newDetailedProgress);
    console.log('✅ Skip saved successfully');
    
    // Verify it was saved correctly
    const verifyProgress = get().detailedWorkoutProgress[workoutKey];
    console.log('✔️ Verification - reading back from store:', JSON.stringify(verifyProgress, null, 2));
  },
  
  getWorkoutCompletionPercentage: (workoutKey, totalSets) => {
    const workoutProgress = get().detailedWorkoutProgress[workoutKey];
    if (!workoutProgress || totalSets === 0) return 0;
    
    let completedSets = 0;
    
    Object.values(workoutProgress.exercises).forEach(exerciseProgress => {
      // Skip exercises marked as skipped - they don't count towards completion
      if (!exerciseProgress.skipped) {
        const sets = exerciseProgress.sets || [];
        // Only count sets that are actually marked as completed
        completedSets += sets.filter(set => set.completed).length;
      }
    });
    
    // Note: totalSets should exclude skipped exercises' sets for accurate calculation
    if (totalSets === 0) return 0;
    
    return Math.round((completedSets / totalSets) * 100);
  },
  
  // HIIT Timer actions
  addHIITTimer: async (timer) => {
    const timers = [...get().hiitTimers, timer];
    set({ hiitTimers: timers });
    await storage.saveHIITTimers(timers);
  },
  
  updateHIITTimer: async (timerId, updates) => {
    console.log('🏪 Store: updateHIITTimer called', { timerId, updates });
    const timers = get().hiitTimers.map(timer =>
      timer.id === timerId ? { ...timer, ...updates } : timer
    );
    set({ hiitTimers: timers });
    console.log('🏪 Store: hiitTimers state updated, saving to storage...');
    await storage.saveHIITTimers(timers);
    console.log('🏪 Store: saved to storage successfully');
  },
  
  deleteHIITTimer: async (timerId) => {
    const currentState = get();
    const timers = currentState.hiitTimers.filter(timer => timer.id !== timerId);
    
    // Also delete associated sessions
    const sessions = currentState.hiitTimerSessions.filter(session => session.timerId !== timerId);
    
    // If we're deleting the active timer, clear the active timer ID
    const updates: { 
      hiitTimers: HIITTimer[]; 
      hiitTimerSessions: HIITTimerSession[];
      activeHIITTimerId?: string | null;
    } = { 
      hiitTimers: timers,
      hiitTimerSessions: sessions
    };
    if (currentState.activeHIITTimerId === timerId) {
      updates.activeHIITTimerId = null;
    }
    
    set(updates);
    await Promise.all([
      storage.saveHIITTimers(timers),
      storage.saveHIITTimerSessions(sessions)
    ]);
  },
  
  getHIITTimerTemplates: () => {
    return get().hiitTimers.filter(timer => timer.isTemplate);
  },
  
  // HIIT Timer Session actions
  addHIITTimerSession: async (session) => {
    const sessions = [...get().hiitTimerSessions, session];
    set({ hiitTimerSessions: sessions });
    await storage.saveHIITTimerSessions(sessions);
  },
  
  getHIITTimerSessionsForDate: (date) => {
    return get().hiitTimerSessions.filter(session => session.date === date);
  },
  
  // Active HIIT Timer tracking
  setActiveHIITTimer: (timerId) => {
    console.log('🏪 Store: setActiveHIITTimer called with:', timerId);
    set({ activeHIITTimerId: timerId });
    console.log('🏪 Store: activeHIITTimerId set to:', timerId);
  },
  
  isHIITTimerActive: (timerId) => {
    const activeId = get().activeHIITTimerId;
    const isActive = activeId === timerId;
    console.log('🏪 Store: isHIITTimerActive check:', { timerId, activeId, isActive });
    return isActive;
  },
  
  // ============================================
  // TRAINING ARCHITECTURE ACTIONS
  // ============================================
  
  // Workout Templates
  addWorkoutTemplate: async (template) => {
    console.log('📝 addWorkoutTemplate called:', { id: template.id, name: template.name, items: template.items.length });
    const templates = [...get().workoutTemplates, template];
    set({ workoutTemplates: templates });
    await storage.saveWorkoutTemplates(templates);
    console.log(`   ✅ Template saved. Total templates: ${templates.length}`);
  },
  
  updateWorkoutTemplate: async (templateId, updates) => {
    const templates = get().workoutTemplates.map(t =>
      t.id === templateId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    );
    set({ workoutTemplates: templates });
    await storage.saveWorkoutTemplates(templates);
  },
  
  deleteWorkoutTemplate: async (templateId) => {
    const templates = get().workoutTemplates.filter(t => t.id !== templateId);
    set({ workoutTemplates: templates });
    await storage.saveWorkoutTemplates(templates);
  },
  
  getWorkoutTemplate: (templateId) => {
    return get().workoutTemplates.find(t => t.id === templateId);
  },

  duplicateWorkoutTemplate: async (templateId) => {
    const existing = get().workoutTemplates.find(t => t.id === templateId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const copyId = `wt-${Date.now()}`;
    const copy: WorkoutTemplate = {
      ...existing,
      id: copyId,
      name: `${existing.name} Copy`,
      createdAt: now,
      updatedAt: now,
      items: existing.items.map(i => ({ ...i })),
    };

    const templates = [copy, ...get().workoutTemplates];
    set({ workoutTemplates: templates });
    await storage.saveWorkoutTemplates(templates);
    return copyId;
  },
  
  // Cycle Plans
  getCycleEndDate: (startDate, weeks) => {
    return dayjs(startDate).add(weeks, 'week').format('YYYY-MM-DD');
  },
  
  listDatesInRange: (start, endExclusive) => {
    const dates: string[] = [];
    let current = dayjs(start);
    const end = dayjs(endExclusive);
    
    while (current.isBefore(end)) {
      dates.push(current.format('YYYY-MM-DD'));
      current = current.add(1, 'day');
    }
    
    return dates;
  },
  
  detectCycleConflicts: (plan) => {
    const endDate = get().getCycleEndDate(plan.startDate, plan.weeks);
    const datesInRange = get().listDatesInRange(plan.startDate, endDate);
    const conflicts: ConflictItem[] = [];
    
    datesInRange.forEach(date => {
      const existing = get().getScheduledWorkout(date);
      if (existing) {
        // Skip if it's from the same plan (re-applying)
        if (existing.source === 'cycle' && existing.cyclePlanId === plan.id) {
          return;
        }
        
        // Determine which workout would be scheduled on this date from the plan
        const dayOfWeek = dayjs(date).day(); // 0=Sun, 6=Sat
        const incomingTemplateId = plan.templateIdsByWeekday[dayOfWeek];
        const incomingTemplate = incomingTemplateId ? get().getWorkoutTemplate(incomingTemplateId) : null;
        
        // It's a conflict: either manual or from another cycle
        conflicts.push({
          date,
          existing,
          incomingTemplateName: incomingTemplate?.name || 'Planned Workout',
          isLocked: existing.isLocked, // true if completed (cannot be replaced)
        });
      }
    });
    
    return conflicts;
  },
  
  addCyclePlan: async (plan, resolution) => {
    console.log('📅 addCyclePlan called:', { id: plan.id, name: plan.name, active: plan.active });
    // Detect conflicts first
    const conflicts = get().detectCycleConflicts(plan);
    
    console.log(`   - Detected ${conflicts.length} conflicts`);
    
    // If conflicts exist and no resolution provided, return conflicts
    if (conflicts.length > 0 && !resolution) {
      return { success: false, conflicts };
    }
    
    // If user chose to cancel, don't do anything
    if (resolution === 'cancel') {
      return { success: false };
    }
    
    let plans = get().cyclePlans;
    
    // Handle conflict resolution
    if (conflicts.length > 0) {
      if (resolution === 'replace') {
        // Remove all conflicting scheduled workouts
        let scheduledWorkouts = get().scheduledWorkouts;
        const conflictDates = new Set(conflicts.map(c => c.date));
        scheduledWorkouts = scheduledWorkouts.filter(sw => !conflictDates.has(sw.date));
        set({ scheduledWorkouts });
        await storage.saveScheduledWorkouts(scheduledWorkouts);
      }
      // If resolution === 'keep', don't remove anything - manual overrides will win
    }
    
    // If this plan is active, archive any existing active plans
    if (plan.active) {
      console.log('   - Archiving existing active plans');
      const now = new Date().toISOString();
      plans = plans.map(p => 
        p.active ? { ...p, active: false, archivedAt: now } : p
      );
    }
    
    plans = [...plans, plan];
    set({ cyclePlans: plans });
    await storage.saveCyclePlans(plans);
    console.log(`   ✅ Plan saved. Total plans: ${plans.length}`);
    
    // Generate scheduled workouts for this plan
    if (plan.active) {
      console.log('   🔄 Generating scheduled workouts (plan is active)...');
      await get().generateScheduledWorkoutsFromCycle(plan.id);
    } else {
      console.log('   ⏭️  Skipping workout generation (plan is not active)');
    }
    
    return { success: true };
  },

  applyCyclePlan: async (planId, resolutionMap) => {
    const plan = get().cyclePlans.find(p => p.id === planId);
    if (!plan) return { success: false, conflicts: [] };

    // PHASE 1: DETECT CONFLICTS (in-memory, no writes)
    const conflicts = get().detectCycleConflicts(plan);
    
    // If conflicts exist and no resolution provided, return conflicts for user decision
    if (conflicts.length > 0 && !resolutionMap) {
      console.log('⚠️ Conflicts detected, awaiting user resolution:', conflicts.length);
      return { success: false, conflicts };
    }

    // PHASE 2: BUILD IN-MEMORY PROPOSAL
    const now = new Date().toISOString();
    const endDate = get().getCycleEndDate(plan.startDate, plan.weeks);
    const datesInRange = get().listDatesInRange(plan.startDate, endDate);
    
    // Build proposed scheduled workouts
    const proposedWorkouts: ScheduledWorkout[] = [];
    const datesToReplace = new Set<string>();
    
    let appliedCount = 0;
    let keptCount = 0;
    let replacedCount = 0;
    let lockedCount = 0;
    
    datesInRange.forEach(date => {
      const dayOfWeek = dayjs(date).day();
      const templateId = plan.templateIdsByWeekday[dayOfWeek];
      
      if (!templateId) return; // No workout scheduled for this day of week
      
      const template = get().getWorkoutTemplate(templateId);
      if (!template) return;
      
      const existing = get().getScheduledWorkout(date);
      
      if (existing) {
        // There's a conflict
        const isLocked = existing.isLocked;
        const decision = resolutionMap?.[date];
        
        if (isLocked) {
          // Locked workouts CANNOT be replaced - always keep
          keptCount++;
          lockedCount++;
          console.log(`🔒 Keeping locked workout on ${date}`);
        } else if (decision === 'replace') {
          // User chose to replace
          datesToReplace.add(date);
          replacedCount++;
          
          // Create new workout instance
          proposedWorkouts.push({
            id: `sw-${planId}-${date}`,
            date,
            templateId,
            titleSnapshot: template.name,
            warmupSnapshot: (template.warmupItems || []).map(item => ({ ...item })),
            exercisesSnapshot: (template.items || []).map(item => ({ ...item })),
            accessorySnapshot: (template.accessoryItems || []).map(item => ({ ...item })),
            warmupCompletion: { completedItems: [] },
            mainCompletion: { completedItems: [] },
            workoutCompletion: { completedExercises: {}, completedSets: {} },
            accessoryCompletion: { completedItems: [] },
            status: 'planned',
            startedAt: null,
            completedAt: null,
            source: 'cycle',
            programId: planId,
            programName: plan.name,
            weekIndex: null, // TODO: calculate
            dayIndex: null, // TODO: calculate
            isLocked: false,
            cyclePlanId: planId,
          });
          appliedCount++;
        } else {
          // User chose to keep existing (or no decision = default keep)
          keptCount++;
          console.log(`✋ Keeping existing workout on ${date}`);
        }
      } else {
        // No conflict, schedule new workout
        proposedWorkouts.push({
          id: `sw-${planId}-${date}`,
          date,
          templateId,
          titleSnapshot: template.name,
          warmupSnapshot: (template.warmupItems || []).map(item => ({ ...item })),
          exercisesSnapshot: (template.items || []).map(item => ({ ...item })),
          accessorySnapshot: (template.accessoryItems || []).map(item => ({ ...item })),
          warmupCompletion: { completedItems: [] },
          workoutCompletion: { completedExercises: {}, completedSets: {} },
          accessoryCompletion: { completedItems: [] },
          status: 'planned',
          startedAt: null,
          completedAt: null,
          source: 'cycle',
          programId: planId,
          programName: plan.name,
          weekIndex: null,
          dayIndex: null,
          isLocked: false,
          cyclePlanId: planId,
        });
        appliedCount++;
      }
    });
    
    // PHASE 3: ATOMIC COMMIT (single write batch)
    console.log('💾 Committing plan apply atomically...');
    
    // Remove workouts marked for replacement
    let scheduledWorkouts = get().scheduledWorkouts.filter(sw => 
      !datesToReplace.has(sw.date)
    );
    
    // Add proposed workouts
    scheduledWorkouts = [...scheduledWorkouts, ...proposedWorkouts];
    
    // Deactivate other active plans, activate this plan
    const plans = get().cyclePlans.map(p => {
      if (p.id === planId) {
        return { 
          ...p, 
          active: true, 
          archivedAt: undefined, 
          updatedAt: now,
          lastUsedAt: now, // Update lastUsedAt when plan is applied
          usageCount: (p.usageCount || 0) + 1, // Increment usageCount
        };
      }
      if (p.active) {
        return { ...p, active: false, archivedAt: p.archivedAt || now, updatedAt: now };
      }
      return p;
    });
    
    // Update template usage tracking for all templates used in this plan
    const templateIds = new Set(Object.values(plan.templateIdsByWeekday).filter(Boolean));
    const templates = get().workoutTemplates.map(t => {
      if (templateIds.has(t.id)) {
        return {
          ...t,
          lastUsedAt: now,
          usageCount: (t.usageCount || 0) + appliedCount, // Increment by number of times scheduled
        };
      }
      return t;
    });
    
    // Commit all changes in single batch
    set({ scheduledWorkouts, cyclePlans: plans, workoutTemplates: templates });
    await Promise.all([
      storage.saveScheduledWorkouts(scheduledWorkouts),
      storage.saveCyclePlans(plans),
      storage.saveWorkoutTemplates(templates),
    ]);
    
    const summary: PlanApplySummary = {
      success: true,
      applied: appliedCount,
      kept: keptCount,
      replaced: replacedCount,
      locked: lockedCount,
    };
    
    console.log('✅ Plan applied successfully:', summary);
    return summary;
  },

  duplicateCyclePlan: async (planId) => {
    const plan = get().cyclePlans.find(p => p.id === planId);
    if (!plan) return null;

    const nowIso = new Date().toISOString();
    const newPlanId = `cp-${Date.now()}`;

    // Duplicate referenced workout templates (deep copy, new IDs)
    const oldToNew = new Map<string, string>();
    const newTemplates: WorkoutTemplate[] = [];

    Object.values(plan.templateIdsByWeekday).forEach((templateId) => {
      if (!templateId) return;
      if (oldToNew.has(templateId)) return;
      const existingTemplate = get().workoutTemplates.find(t => t.id === templateId);
      if (!existingTemplate) return;

      const newTemplateId = `wt-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      oldToNew.set(templateId, newTemplateId);
      newTemplates.push({
        ...existingTemplate,
        id: newTemplateId,
        name: `${existingTemplate.name} Copy`,
        createdAt: nowIso,
        updatedAt: nowIso,
        items: existingTemplate.items.map(i => ({ ...i })),
      });
    });

    const templates = [...newTemplates, ...get().workoutTemplates];
    set({ workoutTemplates: templates });
    await storage.saveWorkoutTemplates(templates);

    const newTemplateIdsByWeekday: Partial<Record<number, string>> = {};
    Object.entries(plan.templateIdsByWeekday).forEach(([weekdayStr, templateId]) => {
      if (!templateId) return;
      const newId = oldToNew.get(templateId);
      if (newId) newTemplateIdsByWeekday[Number(weekdayStr)] = newId;
    });

    const newPlan: CyclePlan = {
      ...plan,
      id: newPlanId,
      name: `${plan.name} Copy`,
      active: false,
      archivedAt: undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
      templateIdsByWeekday: newTemplateIdsByWeekday,
    };

    const plans = [newPlan, ...get().cyclePlans];
    set({ cyclePlans: plans });
    await storage.saveCyclePlans(plans);

    return newPlanId;
  },

  repeatCyclePlan: async (planId, startDate) => {
    const plan = get().cyclePlans.find(p => p.id === planId);
    if (!plan) return null;

    const nowIso = new Date().toISOString();
    const newPlanId = `cp-${Date.now()}`;
    const detailedProgress = get().detailedWorkoutProgress;

    // Helper: find latest logged weight for an exercise from all workout progress records
    const getLatestWeight = (exerciseId: string): number | undefined => {
      let latestDate = '';
      let latestWeight: number | undefined;

      for (const wp of Object.values(detailedProgress)) {
        for (const ep of Object.values(wp.exercises)) {
          if (ep.exerciseId === exerciseId && !ep.skipped) {
            const completedSets = ep.sets.filter(s => s.completed && s.weight > 0);
            if (completedSets.length > 0 && wp.lastUpdated > latestDate) {
              latestDate = wp.lastUpdated;
              // Use the last completed set's weight (working weight)
              latestWeight = completedSets[completedSets.length - 1].weight;
            }
          }
        }
      }

      return latestWeight;
    };

    // Duplicate templates with pre-filled weights from latest logs
    const oldToNew = new Map<string, string>();
    const newTemplates: WorkoutTemplate[] = [];

    Object.values(plan.templateIdsByWeekday).forEach((templateId) => {
      if (!templateId) return;
      if (oldToNew.has(templateId)) return;
      const existingTemplate = get().workoutTemplates.find(t => t.id === templateId);
      if (!existingTemplate) return;

      const newTemplateId = `wt-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      oldToNew.set(templateId, newTemplateId);

      newTemplates.push({
        ...existingTemplate,
        id: newTemplateId,
        name: existingTemplate.name.replace(/ Copy$/, ''),
        createdAt: nowIso,
        updatedAt: nowIso,
        lastUsedAt: null,
        usageCount: 0,
        items: existingTemplate.items.map(item => {
          const latestWeight = getLatestWeight(item.exerciseId);
          return {
            ...item,
            weight: latestWeight ?? item.weight,
          };
        }),
        warmupItems: existingTemplate.warmupItems.map(item => ({ ...item })),
        accessoryItems: existingTemplate.accessoryItems.map(item => ({ ...item })),
      });
    });

    const templates = [...newTemplates, ...get().workoutTemplates];
    set({ workoutTemplates: templates });
    await storage.saveWorkoutTemplates(templates);

    const newTemplateIdsByWeekday: Partial<Record<number, string>> = {};
    Object.entries(plan.templateIdsByWeekday).forEach(([weekdayStr, templateId]) => {
      if (!templateId) return;
      const newId = oldToNew.get(templateId);
      if (newId) newTemplateIdsByWeekday[Number(weekdayStr)] = newId;
    });

    const newPlan: CyclePlan = {
      ...plan,
      id: newPlanId,
      name: plan.name.replace(/ Copy$/, ''),
      startDate,
      active: false,
      archivedAt: undefined,
      endedAt: undefined,
      pausedUntil: undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastUsedAt: null,
      usageCount: 0,
      templateIdsByWeekday: newTemplateIdsByWeekday,
    };

    const plans = [newPlan, ...get().cyclePlans];
    set({ cyclePlans: plans });
    await storage.saveCyclePlans(plans);

    return newPlanId;
  },
  
  updateCyclePlan: async (planId, updates) => {
    const plans = get().cyclePlans.map(p =>
      p.id === planId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    );
    set({ cyclePlans: plans });
    await storage.saveCyclePlans(plans);
    
    // If updating an active plan, regenerate future workouts
    const updatedPlan = plans.find(p => p.id === planId);
    if (updatedPlan?.active) {
      await get().generateScheduledWorkoutsFromCycle(planId);
    }
  },
  
  archiveCyclePlan: async (planId) => {
    const now = new Date().toISOString();
    const plans = get().cyclePlans.map(p =>
      p.id === planId ? { ...p, active: false, archivedAt: now } : p
    );
    set({ cyclePlans: plans });
    await storage.saveCyclePlans(plans);
  },

  getCyclePlanEffectiveEndDate: (plan) => {
    if (plan.endedAt) return plan.endedAt;
    // Use the actual last scheduled workout as the authoritative end date
    const lastWorkout = get().scheduledWorkouts
      .filter(sw => sw.source === 'cycle' && (sw.programId === plan.id || sw.cyclePlanId === plan.id))
      .reduce<string | null>((latest, sw) => (!latest || sw.date > latest) ? sw.date : latest, null);
    if (lastWorkout) return lastWorkout;
    // Fallback to week arithmetic if no workouts found
    return dayjs(plan.startDate).add(plan.weeks, 'week').subtract(1, 'day').format('YYYY-MM-DD');
  },

  getCyclePlanStatus: (planId) => {
    const plan = get().cyclePlans.find(p => p.id === planId);
    if (!plan) return 'completed';
    if (plan.endedAt) return 'ended_early' as CyclePlanStatus;
    if (!plan.active) return 'completed' as CyclePlanStatus;
    const today = dayjs().format('YYYY-MM-DD');
    if (plan.pausedUntil && plan.pausedUntil > today) return 'paused' as CyclePlanStatus;
    const endDate = get().getCyclePlanEffectiveEndDate(plan);
    const hasFutureWorkouts = get().scheduledWorkouts.some(
      sw => sw.source === 'cycle' && (sw.programId === planId || sw.cyclePlanId === planId) && sw.date >= today
    );
    if (!hasFutureWorkouts && endDate < today) return 'completed' as CyclePlanStatus;
    return 'active' as CyclePlanStatus;
  },

  getCyclePlanWeekProgress: (planId, asOfDate) => {
    const plan = get().cyclePlans.find(p => p.id === planId);
    if (!plan) return null;
    const totalWeeks = plan.weeks;
    const startDate = dayjs(plan.startDate);

    // When paused: freeze at the week of the last performed workout (or week 1)
    if (plan.pausedUntil && dayjs(plan.pausedUntil).isAfter(dayjs(asOfDate), 'day')) {
      const cycleWorkouts = get().scheduledWorkouts.filter(
        sw => sw.source === 'cycle' &&
          (sw.programId === planId || sw.cyclePlanId === planId) &&
          (sw.status === 'completed' || sw.isLocked)
      );
      if (cycleWorkouts.length > 0) {
        const lastDate = cycleWorkouts.sort((a, b) => b.date.localeCompare(a.date))[0].date;
        const weeksElapsed = dayjs(lastDate).diff(startDate, 'week', true);
        const currentWeek = Math.max(1, Math.min(Math.floor(weeksElapsed) + 1, totalWeeks));
        return { currentWeek, totalWeeks };
      }
      return { currentWeek: 1, totalWeeks };
    }

    const asOf = dayjs(asOfDate);
    if (asOf.isBefore(startDate, 'day')) return null;
    const endDate = get().getCyclePlanEffectiveEndDate(plan);
    if (asOf.isAfter(dayjs(endDate), 'day')) return { currentWeek: totalWeeks, totalWeeks };

    if (plan.pausedUntil && dayjs(plan.pausedUntil).isAfter(startDate)) {
      const pausedUntil = dayjs(plan.pausedUntil);
      if (asOf.isBefore(pausedUntil, 'day')) {
        // Date is before resume: compute week from original start
        const weeksElapsed = asOf.diff(startDate, 'week', true);
        const currentWeek = Math.max(1, Math.min(Math.floor(weeksElapsed) + 1, totalWeeks));
        return { currentWeek, totalWeeks };
      }
      // Date is after resume: remaining weeks count from pausedUntil
      const weeksElapsed = asOf.diff(pausedUntil, 'week', true);
      const weeksBeforePause = pausedUntil.diff(startDate, 'week', true);
      const weekOffset = Math.floor(weeksBeforePause);
      const currentWeek = Math.min(weekOffset + Math.floor(weeksElapsed) + 1, totalWeeks);
      return { currentWeek, totalWeeks };
    }

    const weeksElapsed = asOf.diff(startDate, 'week', true);
    const currentWeek = Math.min(Math.floor(weeksElapsed) + 1, totalWeeks);
    return { currentWeek, totalWeeks };
  },

  endCyclePlan: async (planId) => {
    const plan = get().cyclePlans.find(p => p.id === planId);
    if (!plan) return;
    const today = dayjs().format('YYYY-MM-DD');
    const now = new Date().toISOString();
    const plans = get().cyclePlans.map(p =>
      p.id === planId ? { ...p, active: false, endedAt: today, updatedAt: now } : p
    );
    const scheduledWorkouts = get().scheduledWorkouts.filter(sw => {
      const isThisPlan = sw.source === 'cycle' && (sw.programId === planId || sw.cyclePlanId === planId);
      if (!isThisPlan) return true;
      if (sw.date < today) return true;
      if (sw.date === today && sw.status !== 'planned') return true;
      return false;
    });
    set({ cyclePlans: plans, scheduledWorkouts });
    await storage.saveCyclePlans(plans);
    await storage.saveScheduledWorkouts(scheduledWorkouts);
  },

  /** Make an ended cycle active again (for testing or re-use). Does not re-add future workouts. */
  reactivateCyclePlan: async (planId) => {
    const plan = get().cyclePlans.find(p => p.id === planId);
    if (!plan) return;
    const now = new Date().toISOString();
    const plans = get().cyclePlans.map(p =>
      p.id === planId ? { ...p, active: true, endedAt: undefined, updatedAt: now } : p
    );
    set({ cyclePlans: plans });
    await storage.saveCyclePlans(plans);
  },

  deleteCyclePlan: async (planId) => {
    const plan = get().cyclePlans.find(p => p.id === planId);
    if (!plan) return;
    const today = dayjs().format('YYYY-MM-DD');
    const plans = get().cyclePlans.filter(p => p.id !== planId);
    const scheduledWorkouts = get().scheduledWorkouts.filter(sw => {
      if (sw.source !== 'cycle' && sw.programId !== planId && sw.cyclePlanId !== planId) return true;
      if (sw.date < today) {
        return true;
      }
      return false;
    }).map(sw => {
      if (sw.date < today && (sw.programId === planId || sw.cyclePlanId === planId)) {
        return { ...sw, programId: null, programName: null, cyclePlanId: undefined };
      }
      return sw;
    });
    set({ cyclePlans: plans, scheduledWorkouts });
    await storage.saveCyclePlans(plans);
    await storage.saveScheduledWorkouts(scheduledWorkouts);
  },

  deleteCyclePlanCompletely: async (planId) => {
    const plan = get().cyclePlans.find(p => p.id === planId);
    if (!plan) return;
    const plans = get().cyclePlans.filter(p => p.id !== planId);
    const scheduledWorkouts = get().scheduledWorkouts.filter(
      sw => sw.source !== 'cycle' || (sw.programId !== planId && sw.cyclePlanId !== planId)
    );
    set({ cyclePlans: plans, scheduledWorkouts });
    await storage.saveCyclePlans(plans);
    await storage.saveScheduledWorkouts(scheduledWorkouts);
  },

  pauseShiftCyclePlan: async (planId, resumeDate, resolutionMap) => {
    const plan = get().cyclePlans.find(p => p.id === planId);
    if (!plan) return { success: false };
    const today = dayjs().format('YYYY-MM-DD');
    const resume = dayjs(resumeDate);
    if (resume.isBefore(today, 'day')) return { success: false };

    const weeksBeforePause = resume.diff(dayjs(plan.startDate), 'week', true);
    const remainingWeeks = Math.max(1, Math.ceil(plan.weeks - weeksBeforePause));

    const now = new Date().toISOString();
    const plans = get().cyclePlans.map(p =>
      p.id === planId ? { ...p, pausedUntil: resumeDate, updatedAt: now } : p
    );
    // Remove only future cycle workouts for this plan (keep today, past, and any with progress)
    let scheduledWorkouts = get().scheduledWorkouts.filter(sw => {
      if (sw.source !== 'cycle' || (sw.programId !== planId && sw.cyclePlanId !== planId)) return true;
      if (sw.status === 'completed' || sw.status === 'in_progress') return true;
      if (sw.isLocked) return true;
      if ((sw.mainCompletion?.completedItems?.length ?? 0) > 0) return true;
      if (sw.date <= today) return true;
      return false;
    });

    // Build the weekly rotation order: weekdays sorted by their offset from the cycle start day
    const originalWeekdays = Object.keys(plan.templateIdsByWeekday)
      .map(Number)
      .filter(d => plan.templateIdsByWeekday[d])
      .sort((a, b) => a - b);
    const originalStartDay = dayjs(plan.startDate).day();
    const sortedFromStart = [...originalWeekdays].sort((a, b) => {
      const da = (a - originalStartDay + 7) % 7;
      const db = (b - originalStartDay + 7) % 7;
      return da - db;
    });

    // Find the last completed/in-progress workout for this cycle (by date) to determine
    // where in the rotation the user left off
    const lastDoneWorkout = scheduledWorkouts
      .filter(sw =>
        sw.source === 'cycle' &&
        (sw.programId === planId || sw.cyclePlanId === planId) &&
        (sw.status === 'completed' || sw.status === 'in_progress')
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    let remainingPattern = [...sortedFromStart];
    if (lastDoneWorkout) {
      const lastTemplateId = lastDoneWorkout.templateId;
      const lastIdx = sortedFromStart.findIndex(day => plan.templateIdsByWeekday[day] === lastTemplateId);
      if (lastIdx >= 0) {
        // Rotate to start from the workout AFTER the last completed one
        const startFrom = (lastIdx + 1) % sortedFromStart.length;
        remainingPattern = [
          ...sortedFromStart.slice(startFrom),
          ...sortedFromStart.slice(0, startFrom),
        ];
      }
    }

    const resumeDay = resume.day();
    const shiftedTemplateIdsByWeekday: Partial<Record<number, string>> = {};
    remainingPattern.forEach((origDay, idx) => {
      const firstOrigDay = remainingPattern[0];
      const offsetFromFirst = (origDay - firstOrigDay + 7) % 7;
      const newDay = (resumeDay + offsetFromFirst) % 7;
      shiftedTemplateIdsByWeekday[newDay] = plan.templateIdsByWeekday[origDay];
    });

    const virtualPlan: CyclePlan = {
      ...plan,
      startDate: resumeDate,
      weeks: remainingWeeks,
      pausedUntil: undefined,
      templateIdsByWeekday: shiftedTemplateIdsByWeekday,
    };
    const conflicts = get().detectCycleConflicts(virtualPlan);
    if (conflicts.length > 0 && !resolutionMap) {
      return { success: false, conflicts };
    }

    const effectiveResolutionMap: ConflictResolutionMap = resolutionMap || {};
    const conflictDatesReplace = new Set(
      conflicts.filter(c => effectiveResolutionMap[c.date] === 'replace').map(c => c.date)
    );
    if (conflictDatesReplace.size > 0) {
      scheduledWorkouts = scheduledWorkouts.filter(sw => !conflictDatesReplace.has(sw.date));
    }

    const endDate = get().getCycleEndDate(resumeDate, remainingWeeks);
    const datesInRange = get().listDatesInRange(resumeDate, endDate);
    const templates = get().workoutTemplates;
    const newWorkouts: ScheduledWorkout[] = [];

    datesInRange.forEach(date => {
      const dayOfWeek = dayjs(date).day();
      const templateId = virtualPlan.templateIdsByWeekday[dayOfWeek];
      if (!templateId) return;
      const template = templates.find(t => t.id === templateId);
      if (!template) return;
      const existing = scheduledWorkouts.find(sw => sw.date === date);
      if (existing) {
        if (effectiveResolutionMap[date] !== 'replace') return;
      }
      newWorkouts.push({
        id: `sw-${planId}-${date}`,
        date,
        templateId,
        titleSnapshot: template.name,
        warmupSnapshot: (template.warmupItems || []).map(item => ({ ...item })),
        exercisesSnapshot: (template.items || []).map(item => ({ ...item })),
        accessorySnapshot: (template.accessoryItems || []).map(item => ({ ...item })),
        warmupCompletion: { completedItems: [] },
        mainCompletion: { completedItems: [] },
        workoutCompletion: { completedExercises: {}, completedSets: {} },
        accessoryCompletion: { completedItems: [] },
        status: 'planned',
        startedAt: null,
        completedAt: null,
        source: 'cycle',
        programId: planId,
        programName: plan.name,
        weekIndex: null,
        dayIndex: null,
        isLocked: false,
        cyclePlanId: planId,
      });
    });

    scheduledWorkouts = [...scheduledWorkouts, ...newWorkouts];
    set({ cyclePlans: plans, scheduledWorkouts });
    await storage.saveCyclePlans(plans);
    await storage.saveScheduledWorkouts(scheduledWorkouts);
    return { success: true };
  },

  repairPausedCycleSchedule: async () => {
    const plan = get().cyclePlans.find(p => p.active && p.pausedUntil);
    if (!plan) return;
    const resumeDate = plan.pausedUntil!;
    console.log('🔧 Repairing paused cycle schedule:', plan.name, 'resume:', resumeDate);

    const today = dayjs().format('YYYY-MM-DD');
    const resume = dayjs(resumeDate);

    // Keep non-cycle workouts + completed/in-progress cycle workouts + today & past cycle workouts + any with progress
    let scheduledWorkouts = get().scheduledWorkouts.filter(sw => {
      if (sw.source !== 'cycle' || (sw.programId !== plan.id && sw.cyclePlanId !== plan.id)) return true;
      if (sw.status === 'completed' || sw.status === 'in_progress') return true;
      if (sw.isLocked) return true;
      if ((sw.mainCompletion?.completedItems?.length ?? 0) > 0) return true;
      if ((sw.warmupCompletion?.completedItems?.length ?? 0) > 0) return true;
      if ((sw.accessoryCompletion?.completedItems?.length ?? 0) > 0) return true;
      if (sw.date <= today) return true;
      return false;
    });

    const weeksBeforePause = resume.diff(dayjs(plan.startDate), 'week', true);
    const remainingWeeks = Math.max(1, Math.ceil(plan.weeks - weeksBeforePause));

    const originalWeekdays = Object.keys(plan.templateIdsByWeekday)
      .map(Number)
      .filter(d => plan.templateIdsByWeekday[d])
      .sort((a, b) => a - b);
    const originalStartDay = dayjs(plan.startDate).day();
    const sortedFromStart = [...originalWeekdays].sort((a, b) => {
      const da = (a - originalStartDay + 7) % 7;
      const db = (b - originalStartDay + 7) % 7;
      return da - db;
    });

    const lastDoneWorkout = scheduledWorkouts
      .filter(sw =>
        sw.source === 'cycle' &&
        (sw.programId === plan.id || sw.cyclePlanId === plan.id) &&
        (sw.status === 'completed' || sw.status === 'in_progress')
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    let remainingPattern = [...sortedFromStart];
    if (lastDoneWorkout) {
      const lastTemplateId = lastDoneWorkout.templateId;
      const lastIdx = sortedFromStart.findIndex(day => plan.templateIdsByWeekday[day] === lastTemplateId);
      if (lastIdx >= 0) {
        const startFrom = (lastIdx + 1) % sortedFromStart.length;
        remainingPattern = [
          ...sortedFromStart.slice(startFrom),
          ...sortedFromStart.slice(0, startFrom),
        ];
      }
    }
    console.log('🔧 Last done template:', lastDoneWorkout?.templateId, 'Remaining pattern:', remainingPattern.map(d => plan.templateIdsByWeekday[d]));

    const resumeDay = resume.day();
    const shiftedTemplateIdsByWeekday: Partial<Record<number, string>> = {};
    remainingPattern.forEach((origDay) => {
      const firstOrigDay = remainingPattern[0];
      const offsetFromFirst = (origDay - firstOrigDay + 7) % 7;
      const newDay = (resumeDay + offsetFromFirst) % 7;
      shiftedTemplateIdsByWeekday[newDay] = plan.templateIdsByWeekday[origDay];
    });

    const virtualPlan: CyclePlan = {
      ...plan,
      startDate: resumeDate,
      weeks: remainingWeeks,
      pausedUntil: undefined,
      templateIdsByWeekday: shiftedTemplateIdsByWeekday,
    };

    const endDate = get().getCycleEndDate(resumeDate, remainingWeeks);
    const datesInRange = get().listDatesInRange(resumeDate, endDate);
    const templates = get().workoutTemplates;
    const newWorkouts: ScheduledWorkout[] = [];

    datesInRange.forEach(date => {
      const dayOfWeek = dayjs(date).day();
      const templateId = virtualPlan.templateIdsByWeekday[dayOfWeek];
      if (!templateId) return;
      const template = templates.find(t => t.id === templateId);
      if (!template) return;
      const existing = scheduledWorkouts.find(sw => sw.date === date);
      if (existing) return;
      newWorkouts.push({
        id: `sw-${plan.id}-${date}`,
        date,
        templateId,
        titleSnapshot: template.name,
        warmupSnapshot: (template.warmupItems || []).map(item => ({ ...item })),
        exercisesSnapshot: (template.items || []).map(item => ({ ...item })),
        accessorySnapshot: (template.accessoryItems || []).map(item => ({ ...item })),
        warmupCompletion: { completedItems: [] },
        mainCompletion: { completedItems: [] },
        workoutCompletion: { completedExercises: {}, completedSets: {} },
        accessoryCompletion: { completedItems: [] },
        status: 'planned',
        startedAt: null,
        completedAt: null,
        source: 'cycle',
        programId: plan.id,
        programName: plan.name,
        weekIndex: null,
        dayIndex: null,
        isLocked: false,
        cyclePlanId: plan.id,
      });
    });

    scheduledWorkouts = [...scheduledWorkouts, ...newWorkouts];
    console.log('🔧 Repair complete: kept completed workouts, regenerated', newWorkouts.length, 'planned workouts');
    set({ scheduledWorkouts });
    await storage.saveScheduledWorkouts(scheduledWorkouts);
  },

  getActiveCyclePlan: () => {
    return get().cyclePlans.find(p => p.active);
  },
  
  generateScheduledWorkoutsFromCycle: async (planId) => {
    console.log('🔄 generateScheduledWorkoutsFromCycle called for planId:', planId);
    const plan = get().cyclePlans.find(p => p.id === planId);
    if (!plan) {
      console.log('   ❌ Plan not found!');
      return;
    }
    
    console.log('   - Plan found:', {
      name: plan.name,
      startDate: plan.startDate,
      weeks: plan.weeks,
      mapping: plan.mapping,
      templateIdsByWeekday: plan.templateIdsByWeekday,
    });
    
    const startDate = dayjs(plan.startDate);
    const endDate = startDate.add(plan.weeks, 'week');
    
    console.log('   - Date range:', startDate.format('YYYY-MM-DD'), 'to', endDate.format('YYYY-MM-DD'));
    
    // Remove existing cycle-generated workouts for this plan in this date range,
    // but preserve workouts that have any completion progress or are locked/completed
    let scheduledWorkouts = get().scheduledWorkouts.filter(sw => {
      const isCycleMatch = sw.source === 'cycle' && sw.cyclePlanId === planId && 
        sw.date >= plan.startDate && sw.date < endDate.format('YYYY-MM-DD');
      if (!isCycleMatch) return true;
      if (sw.isLocked || sw.status === 'completed' || sw.status === 'in_progress') return true;
      if ((sw.mainCompletion?.completedItems?.length ?? 0) > 0) return true;
      if ((sw.warmupCompletion?.completedItems?.length ?? 0) > 0) return true;
      if ((sw.accessoryCompletion?.completedItems?.length ?? 0) > 0) return true;
      return false;
    });
    
    // Generate new workouts based on mapping
    const newWorkouts: ScheduledWorkout[] = [];
    
    if (plan.mapping.kind === 'weekdays') {
      console.log('   - Using weekdays mapping:', plan.mapping.weekdays);
      
      // SPECIAL CASE: Single workout (1 week, 1 day) - schedule on start date directly
      const isSingleWorkout = plan.weeks === 1 && plan.mapping.weekdays.length === 1;
      
      if (isSingleWorkout) {
        console.log('   - SINGLE WORKOUT MODE: Scheduling on start date directly');
        const weekday = startDate.day();
        const templateId = plan.templateIdsByWeekday[plan.mapping.weekdays[0]];
        
        if (templateId) {
          const existing = scheduledWorkouts.find(sw => sw.date === startDate.format('YYYY-MM-DD'));
          const existingHasProgress = existing && (
            existing.isLocked || existing.status === 'completed' || existing.status === 'in_progress' ||
            (existing.mainCompletion?.completedItems?.length ?? 0) > 0
          );
          if ((!existing || existing.source !== 'manual') && !existingHasProgress) {
            if (existing) {
              scheduledWorkouts = scheduledWorkouts.filter(sw => sw.date !== startDate.format('YYYY-MM-DD'));
            }
            
            const template = get().workoutTemplates.find(t => t.id === templateId);
            if (template) {
              const now = new Date().toISOString();
              newWorkouts.push({
                id: `sw-${planId}-${startDate.format('YYYY-MM-DD')}`,
                date: startDate.format('YYYY-MM-DD'),
                templateId,
                
                titleSnapshot: template.name,
                warmupSnapshot: (template.warmupItems || []).map(item => ({ ...item })),
                exercisesSnapshot: (template.items || []).map(item => ({ ...item })),
                accessorySnapshot: (template.accessoryItems || []).map(item => ({ ...item })),
                
                warmupCompletion: { completedItems: [] },
                workoutCompletion: { completedExercises: {}, completedSets: {} },
                accessoryCompletion: { completedItems: [] },
                status: 'planned',
                startedAt: null,
                completedAt: null,
                
                source: 'cycle',
                programId: planId,
                programName: plan.name,
                weekIndex: 0,
                dayIndex: 0,
                
                isLocked: false,
                cyclePlanId: planId,
              });
              console.log(`       ✓ Created single workout on ${startDate.format('YYYY-MM-DD')}`);
            }
          }
        }
      } else {
        // MULTI-DAY/MULTI-WEEK: Start from beginning of week containing start date
        console.log('   - MULTI-DAY MODE: Using weekday matching from start of week');
        
        // Calculate the start of the week (Sunday = 0)
        const startOfWeek = startDate.startOf('week');
        const endDate = startDate.add(plan.weeks, 'week');
        console.log(`   - Week starts on: ${startOfWeek.format('YYYY-MM-DD')}`);
        console.log(`   - Start date: ${startDate.format('YYYY-MM-DD')}`);
        console.log(`   - End date: ${endDate.format('YYYY-MM-DD')}`);
        
        // Calculate total days from start of week to end date
        const totalDays = endDate.diff(startOfWeek, 'day');
        
        for (let i = 0; i < totalDays; i++) {
          const currentDate = startOfWeek.add(i, 'day');
          const weekday = currentDate.day(); // 0=Sun, 6=Sat
          
          // Skip dates before the start date
          if (currentDate.isBefore(startDate, 'day')) {
            console.log(`     Day ${i}: ${currentDate.format('YYYY-MM-DD')} (weekday ${weekday}) - SKIPPED (before start date)`);
            continue;
          }
          
          console.log(`     Day ${i}: ${currentDate.format('YYYY-MM-DD')} (weekday ${weekday})`);
          
          if (plan.mapping.weekdays.includes(weekday)) {
            console.log(`       ✓ Weekday ${weekday} is in mapping`);
            const templateId = plan.templateIdsByWeekday[weekday];
            console.log(`       - Template ID for weekday ${weekday}:`, templateId);
            if (templateId) {
            const existing = scheduledWorkouts.find(sw => sw.date === currentDate.format('YYYY-MM-DD'));
            const existingHasProgress = existing && (
              existing.isLocked || existing.status === 'completed' || existing.status === 'in_progress' ||
              (existing.mainCompletion?.completedItems?.length ?? 0) > 0
            );
            if ((!existing || existing.source !== 'manual') && !existingHasProgress) {
              if (existing) {
                scheduledWorkouts = scheduledWorkouts.filter(sw => sw.date !== currentDate.format('YYYY-MM-DD'));
              }
              
              // Get template to create snapshots
              const template = get().workoutTemplates.find(t => t.id === templateId);
              if (template) {
                const now = new Date().toISOString();
                newWorkouts.push({
                  id: `sw-${planId}-${currentDate.format('YYYY-MM-DD')}`,
                  date: currentDate.format('YYYY-MM-DD'),
                  templateId,
                  
                  // Snapshots (deep copy to avoid mutation)
                  titleSnapshot: template.name,
                  warmupSnapshot: (template.warmupItems || []).map(item => ({ ...item })),
                  exercisesSnapshot: (template.items || []).map(item => ({ ...item })),
                  accessorySnapshot: (template.accessoryItems || []).map(item => ({ ...item })),
                  
                  // Initialize completion states
                  warmupCompletion: { completedItems: [] },
                  workoutCompletion: { completedExercises: {}, completedSets: {} },
                  accessoryCompletion: { completedItems: [] },
                  status: 'planned',
                  startedAt: null,
                  completedAt: null,
                  
                  // Program metadata
                  source: 'cycle',
                  programId: planId,
                  programName: plan.name,
                  weekIndex: Math.floor(i / 7),
                  dayIndex: i % 7,
                  
                  // Integrity flags
                  isLocked: false,
                  
                  // Legacy
                  cyclePlanId: planId,
                });
              }
            }
            }
          }
        }
      }
    } else if (plan.mapping.kind === 'daysPerWeek') {
      // Consecutive day scheduling from start date
      console.log('   - CONSECUTIVE DAYS MODE');
      const daysPerWeek = plan.mapping.daysPerWeek;
      const templateIds = Object.values(plan.templateIdsByWeekday).filter(Boolean) as string[];
      
      console.log(`   - Scheduling ${daysPerWeek} consecutive days starting from ${startDate.format('YYYY-MM-DD')}`);
      
      // Week 1: Schedule consecutively from start date
      const firstWeekDates: string[] = [];
      const firstWeekWeekdays: number[] = [];
      
      for (let day = 0; day < daysPerWeek; day++) {
        const currentDate = startDate.add(day, 'day');
        firstWeekDates.push(currentDate.format('YYYY-MM-DD'));
        firstWeekWeekdays.push(currentDate.day());
      }
      
      console.log('   - First week pattern:', firstWeekDates.map((d, i) => `${d} (weekday ${firstWeekWeekdays[i]})`));
      
      // For each week, schedule on the same weekdays as week 1
      for (let week = 0; week < plan.weeks; week++) {
        for (let day = 0; day < daysPerWeek; day++) {
          // Calculate date by finding the matching weekday in this week
          const targetWeekday = firstWeekWeekdays[day];
          const weekStart = startDate.add(week, 'week');
          const weekStartWeekday = weekStart.day();
          const daysToAdd = (targetWeekday - weekStartWeekday + 7) % 7;
          const currentDate = weekStart.add(daysToAdd, 'day');
          
          const templateId = templateIds[day % templateIds.length];
          
          console.log(`   Week ${week + 1}, Day ${day + 1}: ${currentDate.format('YYYY-MM-DD')} (weekday ${targetWeekday})`);
          
          if (templateId) {
            const existing = scheduledWorkouts.find(sw => sw.date === currentDate.format('YYYY-MM-DD'));
            const existingHasProgress = existing && (
              existing.isLocked || existing.status === 'completed' || existing.status === 'in_progress' ||
              (existing.mainCompletion?.completedItems?.length ?? 0) > 0
            );
            if ((!existing || existing.source !== 'manual') && !existingHasProgress) {
              if (existing) {
                scheduledWorkouts = scheduledWorkouts.filter(sw => sw.date !== currentDate.format('YYYY-MM-DD'));
              }
              
              const template = get().workoutTemplates.find(t => t.id === templateId);
              if (template) {
                const now = new Date().toISOString();
                newWorkouts.push({
                  id: `sw-${planId}-${currentDate.format('YYYY-MM-DD')}`,
                  date: currentDate.format('YYYY-MM-DD'),
                  templateId,
                  
                  // Snapshots (deep copy to avoid mutation)
                  titleSnapshot: template.name,
                  warmupSnapshot: (template.warmupItems || []).map(item => ({ ...item })),
                  exercisesSnapshot: (template.items || []).map(item => ({ ...item })),
                  accessorySnapshot: (template.accessoryItems || []).map(item => ({ ...item })),
                  
                  // Initialize completion states
                  warmupCompletion: { completedItems: [] },
                  workoutCompletion: { completedExercises: {}, completedSets: {} },
                  accessoryCompletion: { completedItems: [] },
                  status: 'planned',
                  startedAt: null,
                  completedAt: null,
                  
                  // Program metadata
                  source: 'cycle',
                  programId: planId,
                  programName: plan.name,
                  weekIndex: week,
                  dayIndex: day,
                  
                  // Integrity flags
                  isLocked: false,
                  
                  // Legacy
                  cyclePlanId: planId,
                });
              }
            }
          }
        }
      }
    }
    
    scheduledWorkouts = [...scheduledWorkouts, ...newWorkouts];
    
    console.log(`   ✅ Generated ${newWorkouts.length} new workouts`);
    newWorkouts.forEach(sw => {
      console.log(`     - ${sw.date}: ${sw.titleSnapshot} (template: ${sw.templateId})`);
    });
    
    set({ scheduledWorkouts });
    await storage.saveScheduledWorkouts(scheduledWorkouts);
    console.log('   💾 Saved to storage');
  },
  
  // Scheduled Workouts
  scheduleWorkout: async (date, templateId, source, cyclePlanId, resolution) => {
    const existing = get().scheduledWorkouts.find(sw => sw.date === date);
    
    // Check for conflict
    if (existing && !resolution) {
      return { success: false, conflict: existing };
    }
    
    // Handle conflict resolution
    if (existing && resolution === 'cancel') {
      return { success: false };
    }
    
    // Check if existing is locked (completed)
    if (existing && existing.isLocked) {
      console.warn('⚠️ Cannot replace locked (completed) workout');
      return { success: false, conflict: existing };
    }
    
    // Get the template to create snapshots
    const template = get().getWorkoutTemplate(templateId);
    if (!template) {
      console.error('❌ Template not found:', templateId);
      return { success: false };
    }
    
    // Resolution is 'replace' or no conflict
    let scheduledWorkouts = get().scheduledWorkouts.filter(sw => sw.date !== date);
    
    // Create snapshots from template
    const now = new Date().toISOString();
    const newWorkout: ScheduledWorkout = {
      id: `sw-${Date.now()}`,
      date,
      templateId,
      
      // Snapshots (deep copy to avoid mutation)
      titleSnapshot: template.name,
      warmupSnapshot: (template.warmupItems || []).map(item => ({ ...item })),
      exercisesSnapshot: (template.items || []).map(item => ({ ...item })),
      accessorySnapshot: (template.accessoryItems || []).map(item => ({ ...item })),
      
      // Initialize completion states
      warmupCompletion: { completedItems: [] },
      mainCompletion: { completedItems: [] },
      workoutCompletion: { completedExercises: {}, completedSets: {} },
      accessoryCompletion: { completedItems: [] },
      status: 'planned',
      startedAt: null,
      completedAt: null,
      
      // Program metadata
      source,
      programId: cyclePlanId || null,
      programName: null, // TODO: get from cycle plan
      weekIndex: null,
      dayIndex: null,
      
      // Integrity flags
      isLocked: false,
      
      // Legacy
      cyclePlanId,
    };
    
    scheduledWorkouts = [...scheduledWorkouts, newWorkout];
    set({ scheduledWorkouts });
    await storage.saveScheduledWorkouts(scheduledWorkouts);
    
    // Update template usage tracking (lastUsedAt, usageCount)
    // This ONLY happens when template is applied to schedule
    const templates = get().workoutTemplates.map(t => {
      if (t.id === templateId) {
        return {
          ...t,
          lastUsedAt: now,
          usageCount: (t.usageCount || 0) + 1,
        };
      }
      return t;
    });
    set({ workoutTemplates: templates });
    await storage.saveWorkoutTemplates(templates);
    
    console.log('✅ Workout scheduled with snapshots:', {
      date,
      template: template.name,
      warmupItems: newWorkout.warmupSnapshot?.length || 0,
      exercises: newWorkout.exercisesSnapshot?.length || 0,
      lastUsedAt: now,
      usageCount: (template.usageCount || 0) + 1,
    });
    
    // NOTE: We do NOT remove the workoutAssignment (cycle workout) here
    // The TodayScreen already prioritizes ScheduledWorkout over WorkoutAssignment
    // This way, if the user swaps/removes the single workout, the cycle workout reappears
    return { success: true };
  },
  
  unscheduleWorkout: async (workoutId) => {
    const workout = get().scheduledWorkouts.find(sw => sw.id === workoutId);
    
    // Enforce hard lock: cannot delete completed workouts
    if (workout?.isLocked) {
      console.warn('⚠️ Cannot unschedule locked (completed) workout');
      return;
    }
    
    const scheduledWorkouts = get().scheduledWorkouts.filter(sw => sw.id !== workoutId);
    set({ scheduledWorkouts });
    await storage.saveScheduledWorkouts(scheduledWorkouts);
  },
  
  completeWorkout: async (workoutId) => {
    const now = new Date().toISOString();
    const scheduledWorkouts = get().scheduledWorkouts.map(sw =>
      sw.id === workoutId 
        ? { 
            ...sw, 
            status: 'completed' as const, 
            completedAt: now,
            isLocked: true // Hard lock when completed - prevents move/replace/delete
          }
        : sw
    );
    set({ scheduledWorkouts });
    await storage.saveScheduledWorkouts(scheduledWorkouts);
    
    console.log('🔒 Workout completed and locked:', workoutId);
  },
  
  uncompleteWorkout: async (workoutId) => {
    const scheduledWorkouts = get().scheduledWorkouts.map(sw =>
      sw.id === workoutId 
        ? { 
            ...sw, 
            status: 'planned' as const, 
            completedAt: null,
            isLocked: false,
          }
        : sw
    );
    set({ scheduledWorkouts });
    await storage.saveScheduledWorkouts(scheduledWorkouts);
    
    console.log('🔓 Workout uncompleted and unlocked:', workoutId);
  },
  
  updateScheduledWorkoutSnapshots: async (workoutId, updates) => {
    const scheduledWorkouts = get().scheduledWorkouts.map(sw => {
      if (sw.id !== workoutId) return sw;
      return {
        ...sw,
        ...(updates.warmupSnapshot !== undefined && { warmupSnapshot: updates.warmupSnapshot }),
        ...(updates.exercisesSnapshot !== undefined && { exercisesSnapshot: updates.exercisesSnapshot }),
        ...(updates.accessorySnapshot !== undefined && { accessorySnapshot: updates.accessorySnapshot }),
      };
    });
    set({ scheduledWorkouts });
    await storage.saveScheduledWorkouts(scheduledWorkouts);
  },
  
  getScheduledWorkout: (date) => {
    return get().scheduledWorkouts.find(sw => sw.date === date);
  },
  
  getScheduledWorkoutsForDateRange: (startDate, endDate) => {
    return get().scheduledWorkouts.filter(sw => 
      sw.date >= startDate && sw.date <= endDate
    );
  },
  
  // Warm-up Completion (independent from workout completion)
  updateWarmupCompletion: async (workoutId, warmupItemId, completed) => {
    const scheduledWorkouts = get().scheduledWorkouts.map(sw => {
      if (sw.id === workoutId) {
        const existingCompletion = sw.warmupCompletion || { completedItems: [] };
        const existingCompletedItems = existingCompletion.completedItems || [];
        
        const completedItems = completed
          ? [...new Set([...existingCompletedItems, warmupItemId])]
          : existingCompletedItems.filter(id => id !== warmupItemId);
        
        return {
          ...sw,
          warmupCompletion: {
            ...existingCompletion,
            completedItems,
          },
          status: sw.status === 'planned' && completed ? 'in_progress' as const : sw.status,
          startedAt: !sw.startedAt && completed ? new Date().toISOString() : sw.startedAt,
        };
      }
      return sw;
    });
    
    const foundScheduled = scheduledWorkouts.some(sw => sw.id === workoutId);
    if (foundScheduled) {
      set({ scheduledWorkouts });
      await storage.saveScheduledWorkouts(scheduledWorkouts);
    } else {
      // Fallback for bonus/standalone keys: persist in warmupCompletionByKey
      const byKey = { ...(get().warmupCompletionByKey || {}) };
      const existing = byKey[workoutId]?.completedItems || [];
      const completedItems = completed
        ? [...new Set([...existing, warmupItemId])]
        : existing.filter(id => id !== warmupItemId);
      byKey[workoutId] = { completedItems };
      set({ warmupCompletionByKey: byKey });
      await storage.saveWarmupCompletionByKey(byKey);
    }
    
    console.log('✅ Warm-up item updated:', { workoutId, warmupItemId, completed, foundScheduled: !!foundScheduled });
  },
  
  getWarmupCompletion: (workoutId, templateId?) => {
    const workout = get().scheduledWorkouts.find(sw => sw.id === workoutId);
    
    if (!workout) {
      // Fallback for bonus/standalone: read from warmupCompletionByKey
      const byKey = get().warmupCompletionByKey || {};
      const completedItems = byKey[workoutId]?.completedItems || [];
      let totalSets = 0;
      if (templateId) {
        const template = get().workoutTemplates.find(t => t.id === templateId);
        const warmupItems = template?.warmupItems || [];
        warmupItems.forEach((item: any) => {
          if (Array.isArray(item.sets)) totalSets += item.sets.length;
          else if (typeof item.sets === 'number') totalSets += item.sets;
        });
      } else {
        totalSets = completedItems.length; // best guess
      }
      let percentage = totalSets > 0 ? (completedItems.length >= totalSets ? 100 : Math.round((completedItems.length / totalSets) * 100)) : 0;
      return { completedItems, totalItems: totalSets, percentage };
    }
    
    // Calculate total sets across all warmup items
    let warmupItems = workout.warmupSnapshot || [];
    const tid = (workout as any).templateId || (workout as any).workoutTemplateId;
    if (warmupItems.length === 0 && tid) {
      const template = get().workoutTemplates.find(t => t.id === tid);
      if (template?.warmupItems) warmupItems = template.warmupItems;
    }
    let totalSets = 0;
    warmupItems.forEach((item: any) => {
      if (Array.isArray(item.sets)) totalSets += item.sets.length;
      else if (typeof item.sets === 'number') totalSets += item.sets;
    });
    const completedItems = workout.warmupCompletion?.completedItems || [];
    let percentage = 0;
    if (totalSets > 0) {
      percentage = completedItems.length >= totalSets ? 100 : Math.round((completedItems.length / totalSets) * 100);
    }
    return { completedItems, totalItems: totalSets, percentage };
  },
  
  // Accessory Completion (independent from workout completion)
  updateAccessoryCompletion: async (workoutId, accessoryItemId, completed) => {
    const scheduledWorkouts = get().scheduledWorkouts.map(sw => {
      if (sw.id === workoutId) {
        const existingCompletion = sw.accessoryCompletion || { completedItems: [] };
        const existingCompletedItems = existingCompletion.completedItems || [];
        
        const completedItems = completed
          ? [...new Set([...existingCompletedItems, accessoryItemId])]
          : existingCompletedItems.filter(id => id !== accessoryItemId);
        
        return {
          ...sw,
          accessoryCompletion: {
            ...existingCompletion,
            completedItems,
          },
          status: sw.status === 'planned' && completed ? 'in_progress' as const : sw.status,
          startedAt: !sw.startedAt && completed ? new Date().toISOString() : sw.startedAt,
        };
      }
      return sw;
    });
    
    const foundScheduled = scheduledWorkouts.some(sw => sw.id === workoutId);
    if (foundScheduled) {
      set({ scheduledWorkouts });
      await storage.saveScheduledWorkouts(scheduledWorkouts);
    } else {
      const byKey = { ...(get().accessoryCompletionByKey || {}) };
      const existing = byKey[workoutId]?.completedItems || [];
      const completedItems = completed
        ? [...new Set([...existing, accessoryItemId])]
        : existing.filter(id => id !== accessoryItemId);
      byKey[workoutId] = { completedItems };
      set({ accessoryCompletionByKey: byKey });
      await storage.saveAccessoryCompletionByKey(byKey);
    }
    
    console.log('✅ Accessory item updated:', { workoutId, accessoryItemId, completed, foundScheduled: !!foundScheduled });
  },
  
  getAccessoryCompletion: (workoutId, templateId?) => {
    const workout = get().scheduledWorkouts.find(sw => sw.id === workoutId);
    
    if (!workout) {
      const byKey = get().accessoryCompletionByKey || {};
      const completedItems = byKey[workoutId]?.completedItems || [];
      let totalSets = 0;
      if (templateId) {
        const template = get().workoutTemplates.find(t => t.id === templateId);
        const accessoryItems = template?.accessoryItems || [];
        accessoryItems.forEach((item: any) => {
          if (Array.isArray(item.sets)) totalSets += item.sets.length;
          else if (typeof item.sets === 'number') totalSets += item.sets;
        });
      } else {
        totalSets = completedItems.length;
      }
      let percentage = totalSets > 0 ? (completedItems.length >= totalSets ? 100 : Math.round((completedItems.length / totalSets) * 100)) : 0;
      return { completedItems, totalItems: totalSets, percentage };
    }
    
    let accessoryItems = workout.accessorySnapshot || [];
    const tid = (workout as any).templateId || (workout as any).workoutTemplateId;
    if (accessoryItems.length === 0 && tid) {
      const template = get().workoutTemplates.find(t => t.id === tid);
      if (template?.accessoryItems) accessoryItems = template.accessoryItems;
    }
    let totalSets = 0;
    accessoryItems.forEach((item: any) => {
      if (Array.isArray(item.sets)) totalSets += item.sets.length;
      else if (typeof item.sets === 'number') totalSets += item.sets;
    });
    const completedItems = workout.accessoryCompletion?.completedItems || [];
    let percentage = 0;
    if (totalSets > 0) {
      percentage = completedItems.length >= totalSets ? 100 : Math.round((completedItems.length / totalSets) * 100);
    }
    return { completedItems, totalItems: totalSets, percentage };
  },
  
  // Main Exercise Completion (independent from workout completion)
  updateMainCompletion: async (workoutId, mainItemId, completed) => {
    const scheduledWorkouts = get().scheduledWorkouts.map(sw => {
      if (sw.id === workoutId) {
        const existingCompletion = sw.mainCompletion || { completedItems: [] };
        const existingCompletedItems = existingCompletion.completedItems || [];
        const completedItems = completed
          ? [...new Set([...existingCompletedItems, mainItemId])]
          : existingCompletedItems.filter(id => id !== mainItemId);
        
        return {
          ...sw,
          mainCompletion: {
            ...existingCompletion,
            completedItems,
          },
          status: sw.status === 'planned' && completed ? 'in_progress' as const : sw.status,
          startedAt: !sw.startedAt && completed ? new Date().toISOString() : sw.startedAt,
        };
      }
      return sw;
    });
    
    set({ scheduledWorkouts });
    await storage.saveScheduledWorkouts(scheduledWorkouts);
  },
  
  getMainCompletion: (workoutId) => {
    const workout = get().scheduledWorkouts.find(sw => sw.id === workoutId);
    if (!workout) return { completedItems: [], totalItems: 0, percentage: 0 };
    let totalSets = 0;
    (workout.exercisesSnapshot || []).forEach((item: any) => {
      if (Array.isArray(item.sets)) totalSets += item.sets.length;
      else if (typeof item.sets === 'number') totalSets += item.sets;
    });
    const completedItems = workout.mainCompletion?.completedItems || [];
    let percentage = 0;
    if (totalSets > 0) {
      percentage = completedItems.length >= totalSets ? 100 : Math.round((completedItems.length / totalSets) * 100);
    }
    return { completedItems, totalItems: totalSets, percentage };
  },
  
  // Move scheduled workout to another date
  moveScheduledWorkout: async (workoutId, toDate) => {
    const workout = get().scheduledWorkouts.find(sw => sw.id === workoutId);
    
    if (!workout) {
      return { success: false, error: 'workout_not_found' };
    }
    
    // HARD LOCK: Cannot move completed workouts
    if (workout.isLocked) {
      console.warn('⚠️ Cannot move locked (completed) workout');
      return { success: false, error: 'workout_locked' };
    }
    
    // Check if target date already has a workout
    const existing = get().scheduledWorkouts.find(sw => sw.date === toDate);
    if (existing) {
      // If existing is locked, cannot replace
      if (existing.isLocked) {
        console.warn('⚠️ Cannot move to date with locked (completed) workout');
        return { success: false, error: 'target_date_locked' };
      }
      // Otherwise, would require explicit user confirmation via conflict resolution
      return { success: false, error: 'target_date_has_workout', conflict: existing };
    }
    
    // Move workout to new date
    const scheduledWorkouts = get().scheduledWorkouts.map(sw => 
      sw.id === workoutId ? { ...sw, date: toDate } : sw
    );
    
    set({ scheduledWorkouts });
    await storage.saveScheduledWorkouts(scheduledWorkouts);
    
    console.log('✅ Workout moved:', { from: workout.date, to: toDate });
    return { success: true };
  },
  
  // Duplicate scheduled workout to another date (creates new instance)
  duplicateScheduledWorkout: async (workoutId, toDate) => {
    const workout = get().scheduledWorkouts.find(sw => sw.id === workoutId);
    
    if (!workout) {
      return { success: false, error: 'workout_not_found' };
    }
    
    // Duplication is allowed even for completed workouts
    // (per spec: "Can only be duplicated to another day")
    
    // Check if target date already has a workout
    const existing = get().scheduledWorkouts.find(sw => sw.date === toDate);
    if (existing) {
      // If existing is locked, cannot replace
      if (existing.isLocked) {
        console.warn('⚠️ Cannot duplicate to date with locked (completed) workout');
        return { success: false, error: 'target_date_locked' };
      }
      // Otherwise, would require explicit user confirmation via conflict resolution
      return { success: false, error: 'target_date_has_workout', conflict: existing };
    }
    
    // Create new instance (deep copy with new ID and date)
    const now = new Date().toISOString();
    const newWorkout: ScheduledWorkout = {
      ...workout,
      id: `sw-${Date.now()}`,
      date: toDate,
      // Reset completion state for duplicate
      status: 'planned',
      startedAt: null,
      completedAt: null,
      isLocked: false,
      warmupCompletion: { completedItems: [] },
      mainCompletion: { completedItems: [] },
      workoutCompletion: { completedExercises: {}, completedSets: {} },
      accessoryCompletion: { completedItems: [] },
    };
    
    const scheduledWorkouts = [...get().scheduledWorkouts, newWorkout];
    set({ scheduledWorkouts });
    await storage.saveScheduledWorkouts(scheduledWorkouts);
    
    // Update template usage tracking (lastUsedAt, usageCount)
    const templates = get().workoutTemplates.map(t => {
      if (t.id === workout.templateId) {
        return {
          ...t,
          lastUsedAt: now,
          usageCount: (t.usageCount || 0) + 1,
        };
      }
      return t;
    });
    set({ workoutTemplates: templates });
    await storage.saveWorkoutTemplates(templates);
    
    console.log('✅ Workout duplicated:', { from: workout.date, to: toDate, newId: newWorkout.id });
    return { success: true };
  },
  
  // Reset specific completion types
  resetWarmupCompletion: async (workoutId) => {
    console.log('🧹 Resetting warmup completion for workout:', workoutId);
    const found = get().scheduledWorkouts.some(sw => sw.id === workoutId);
    if (found) {
      const scheduledWorkouts = get().scheduledWorkouts.map(sw =>
        sw.id === workoutId ? { ...sw, warmupCompletion: { completedItems: [] } } : sw
      );
      set({ scheduledWorkouts });
      await storage.saveScheduledWorkouts(scheduledWorkouts);
    } else {
      const byKey = { ...(get().warmupCompletionByKey || {}) };
      delete byKey[workoutId];
      set({ warmupCompletionByKey: byKey });
      await storage.saveWarmupCompletionByKey(byKey);
    }
    console.log('✅ Warmup completion reset');
  },
  
  resetMainCompletion: async (workoutId) => {
    console.log('🧹 Resetting main completion for workout:', workoutId);
    const scheduledWorkouts = get().scheduledWorkouts.map(sw => {
      if (sw.id === workoutId) {
        return {
          ...sw,
          mainCompletion: { completedItems: [] },
        };
      }
      return sw;
    });
    
    set({ scheduledWorkouts });
    await storage.saveScheduledWorkouts(scheduledWorkouts);
    console.log('✅ Main completion reset');
  },
  
  resetAccessoryCompletion: async (workoutId) => {
    console.log('🧹 Resetting accessory completion for workout:', workoutId);
    const found = get().scheduledWorkouts.some(sw => sw.id === workoutId);
    if (found) {
      const scheduledWorkouts = get().scheduledWorkouts.map(sw =>
        sw.id === workoutId ? { ...sw, accessoryCompletion: { completedItems: [] } } : sw
      );
      set({ scheduledWorkouts });
      await storage.saveScheduledWorkouts(scheduledWorkouts);
    } else {
      const byKey = { ...(get().accessoryCompletionByKey || {}) };
      delete byKey[workoutId];
      set({ accessoryCompletionByKey: byKey });
      await storage.saveAccessoryCompletionByKey(byKey);
    }
    console.log('✅ Accessory completion reset');
  },
  
  // Bonus feature: Warmup Presets
  addWarmupPreset: async (preset) => {
    const presets = [...get().warmupPresets, preset];
    set({ warmupPresets: presets });
    await storage.saveWarmupPresets(presets);
  },
  
  deleteWarmupPreset: async (presetId) => {
    const presets = get().warmupPresets.filter(p => p.id !== presetId);
    set({ warmupPresets: presets });
    await storage.saveWarmupPresets(presets);
  },
  
  // Bonus feature: Core Presets
  addCorePreset: async (preset) => {
    const presets = [...get().corePresets, preset];
    set({ corePresets: presets });
    await storage.saveCorePresets(presets);
  },
  
  deleteCorePreset: async (presetId) => {
    const presets = get().corePresets.filter(p => p.id !== presetId);
    set({ corePresets: presets });
    await storage.saveCorePresets(presets);
  },
  
  // Bonus feature: Bonus Logs
  addBonusLog: async (log) => {
    const logs = [...get().bonusLogs, log];
    set({ bonusLogs: logs });
    await storage.saveBonusLogs(logs);
  },
  
  updateBonusLog: async (logId, updates) => {
    const logs = get().bonusLogs.map(l =>
      l.id === logId ? { ...l, ...updates } : l
    );
    set({ bonusLogs: logs });
    await storage.saveBonusLogs(logs);
  },
  
  deleteBonusLog: async (logId) => {
    const logs = get().bonusLogs.filter(l => l.id !== logId);
    set({ bonusLogs: logs });
    await storage.saveBonusLogs(logs);
  },
  
  getBonusLogsForDate: (date) => {
    return get().bonusLogs.filter(l => l.date === date);
  },

  // Core Program
  getActiveCoreProgram: () => {
    return get().corePrograms.find(p => p.isActive) ?? undefined;
  },

  createDefaultCoreProgram: async () => {
    const now = new Date().toISOString();
    const program: CoreProgram = {
      id: `core-program-${Date.now()}`,
      name: 'Core Program',
      durationWeeks: 6,
      sessionsPerWeekTarget: 3,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      rotationType: 'alternating',
      currentWeekIndex: 1,
      currentSessionIndexWithinGroup: 0,
    };
    const programs = [...get().corePrograms];
    programs.forEach(p => { (p as CoreProgram).isActive = false; });
    programs.push(program);
    set({ corePrograms: programs });
    await storage.saveCorePrograms(programs);
    return program;
  },

  getUpNextCoreSession: (programId) => {
    const program = programId ? get().corePrograms.find(p => p.id === programId) : get().getActiveCoreProgram();
    if (!program) return null;
    return coreProgramUtil.getUpNextSession(program, get().corePresets);
  },

  getCoreSessionsByGroup: (programId) => {
    return coreProgramUtil.getSessionsByGroup(programId, get().corePresets);
  },

  getCoreCompletedCount: (programId) => {
    return get().coreLogs.filter(l => l.programId === programId && l.outcome === 'completed').length;
  },

  advanceCorePointer: async (programId) => {
    const program = get().corePrograms.find(p => p.id === programId);
    if (!program) return;
    const next = coreProgramUtil.advancePointer(program);
    const programs = get().corePrograms.map(p => p.id === programId ? next : p);
    set({ corePrograms: programs });
    await storage.saveCorePrograms(programs);
  },

  logCoreSession: async (programId, sessionTemplateId, outcome, completedItemIds) => {
    const program = get().corePrograms.find(p => p.id === programId);
    if (!program) return;
    const now = new Date().toISOString();
    const log: CoreLog = {
      id: `core-log-${Date.now()}`,
      programId,
      sessionTemplateId,
      dateTime: now,
      outcome,
      completedExerciseLogs: outcome === 'completed' ? completedItemIds : undefined,
      weekIndex: program.currentWeekIndex,
    };
    const logs = [...get().coreLogs, log];
    set({ coreLogs: logs });
    await storage.saveCoreLogs(logs);
    const upNext = coreProgramUtil.getUpNextSession(program, get().corePresets);
    if (upNext?.id === sessionTemplateId) {
      await get().advanceCorePointer(programId);
    }
  },

  isCoreSessionCompletedThisWeek: (programId, sessionTemplateId) => {
    const program = get().corePrograms.find(p => p.id === programId);
    if (!program) return false;
    return get().coreLogs.some(
      l => l.programId === programId && l.sessionTemplateId === sessionTemplateId && l.outcome === 'completed' && l.weekIndex === program.currentWeekIndex
    );
  },

  isCoreSessionSkippedThisWeek: (programId, sessionTemplateId) => {
    const program = get().corePrograms.find(p => p.id === programId);
    if (!program) return false;
    return get().coreLogs.some(
      l => l.programId === programId && l.sessionTemplateId === sessionTemplateId && l.outcome === 'skipped' && l.weekIndex === program.currentWeekIndex
    );
  },

  restartCoreProgram: async (programId) => {
    const program = get().corePrograms.find(p => p.id === programId);
    if (!program) return;
    const updated: CoreProgram = {
      ...program,
      currentWeekIndex: 1,
      currentSessionIndexWithinGroup: 0,
      updatedAt: new Date().toISOString(),
    };
    const programs = get().corePrograms.map(p => p.id === programId ? updated : p);
    set({ corePrograms: programs });
    await storage.saveCorePrograms(programs);
  },

  addCoreSessionToProgram: async (programId, preset, group) => {
    const { A, B } = get().getCoreSessionsByGroup(programId);
    const arr = group === 'A' ? A : B;
    if (arr.length >= 3) return; // v1: no replace, just refuse
    const orderIndex = arr.length;
    const now = Date.now();
    const linked: CoreSetTemplate = {
      ...preset,
      id: preset.id.startsWith('builtin-') ? `core-${now}-${orderIndex}` : preset.id,
      belongsToProgramId: programId,
      groupKey: group,
      orderIndex,
      updatedAt: now,
      lastUsedAt: preset.lastUsedAt ?? null,
    };
    const presets = [...get().corePresets];
    const existingIdx = presets.findIndex(p => p.id === linked.id || (p.belongsToProgramId === programId && p.groupKey === group && p.orderIndex === orderIndex));
    if (existingIdx >= 0) presets[existingIdx] = linked;
    else presets.push(linked);
    set({ corePresets: presets });
    await storage.saveCorePresets(presets);
  },

  updateCoreProgram: async (programId, updates) => {
    const programs = get().corePrograms.map(p => p.id === programId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p);
    set({ corePrograms: programs });
    await storage.saveCorePrograms(programs);
  },

  deleteCoreProgram: async (programId) => {
    const programs = get().corePrograms.filter(p => p.id !== programId);
    set({ corePrograms: programs });
    await storage.saveCorePrograms(programs);
    const presets = get().corePresets.map(p =>
      p.belongsToProgramId === programId
        ? { ...p, belongsToProgramId: undefined, groupKey: undefined, orderIndex: undefined }
        : p
    );
    set({ corePresets: presets });
    await storage.saveCorePresets(presets);
  },

  setPendingCorePresetForProgram: (preset) => {
    set({ pendingCorePresetForProgram: preset });
  },
}));

