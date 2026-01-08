import { create } from 'zustand';
import dayjs from 'dayjs';
import type { Cycle, Exercise, WorkoutSession, BodyWeightEntry, AppSettings, WorkoutAssignment, TrainerConversation, ExercisePR, WorkoutProgress, ExerciseProgress, HIITTimer, HIITTimerSession } from '../types';
import * as storage from '../storage';
import { SEED_EXERCISES } from '../constants';

interface WorkoutStore {
  // State
  cycles: Cycle[];
  exercises: Exercise[];
  sessions: WorkoutSession[];
  bodyWeightEntries: BodyWeightEntry[];
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
  addBodyWeightEntry: (entry: BodyWeightEntry) => Promise<void>;
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
  
  // HIIT Timer Sessions
  hiitTimerSessions: HIITTimerSession[];
  addHIITTimerSession: (session: HIITTimerSession) => Promise<void>;
  getHIITTimerSessionsForDate: (date: string) => HIITTimerSession[];
}

const DEFAULT_SETTINGS: AppSettings = {
  useKg: true,
  monthlyProgressReminderEnabled: true,
  monthlyProgressReminderDay: 1,
  restTimerDefaultSeconds: 120,
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

export const useStore = create<WorkoutStore>((set, get) => ({
  cycles: [],
  exercises: [],
  sessions: [],
  bodyWeightEntries: [],
  workoutAssignments: [],
  trainerConversations: [],
  exercisePRs: [],
  hiitTimers: [],
  hiitTimerSessions: [],
  settings: DEFAULT_SETTINGS,
  isLoading: true,
  workoutProgress: {},
  detailedWorkoutProgress: {},
  
  initialize: async () => {
    try {
      const [cycles, exercises, sessions, bodyWeightEntries, settings, workoutAssignments, trainerConversations, exercisePRs, workoutProgress, detailedWorkoutProgress, hiitTimers, hiitTimerSessions] = await Promise.all([
        storage.loadCycles(),
        storage.loadExercises(),
        storage.loadSessions(),
        storage.loadBodyWeightEntries(),
        storage.loadSettings(),
        storage.loadWorkoutAssignments(),
        storage.loadTrainerConversations(),
        storage.loadExercisePRs(),
        storage.loadWorkoutProgress(),
        storage.loadDetailedWorkoutProgress(),
        storage.loadHIITTimers(),
        storage.loadHIITTimerSessions(),
      ]);
      
      // Seed exercises if none exist
      let finalExercises = exercises;
      if (exercises.length === 0) {
        finalExercises = SEED_EXERCISES.map((ex, idx) => ({
          id: `seed-${idx}`,
          name: ex.name,
          category: ex.category as any,
          equipment: ex.equipment,
          isCustom: false,
        }));
        await storage.saveExercises(finalExercises);
      } else {
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
      const finalSettings = settings || DEFAULT_SETTINGS;
      console.log('🔧 App Initialized with Settings:', {
        useKg: finalSettings.useKg,
        hasApiKey: !!finalSettings.openaiApiKey,
        apiKeyPreview: finalSettings.openaiApiKey ? `${finalSettings.openaiApiKey.substring(0, 10)}...` : 'none',
        hasGoals: !!finalSettings.trainerGoals,
        goalsPreview: finalSettings.trainerGoals ? `${finalSettings.trainerGoals.substring(0, 30)}...` : 'none',
        hasPersonality: !!finalSettings.trainerPersonality,
      });
      
      set({
        cycles: finalCycles,
        exercises: finalExercises,
        sessions,
        bodyWeightEntries,
        workoutAssignments: finalWorkoutAssignments,
        exercisePRs,
        trainerConversations: finalConversations,
        settings: finalSettings,
        workoutProgress,
        detailedWorkoutProgress,
        hiitTimers,
        hiitTimerSessions,
        isLoading: false,
      });
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
    const sessions = [...get().sessions, session];
    set({ sessions });
    await storage.saveSessions(sessions);
  },
  
  addBodyWeightEntry: async (entry) => {
    const entries = [...get().bodyWeightEntries, entry];
    set({ bodyWeightEntries: entries });
    await storage.saveBodyWeightEntries(entries);
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
    const assignments = get().workoutAssignments.filter(a => {
      return a.date < startDate || a.date > endDate;
    });
    set({ workoutAssignments: assignments });
    await storage.saveWorkoutAssignments(assignments);
  },
  
  swapWorkoutAssignments: async (date1: string, date2: string) => {
    const currentAssignments = get().workoutAssignments;
    const assignment1 = currentAssignments.find(a => a.date === date1);
    const assignment2 = currentAssignments.find(a => a.date === date2);
    
    let newAssignments = [...currentAssignments];
    
    if (assignment1 && assignment2) {
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
      // Only date1 has assignment - move it to date2
      newAssignments = currentAssignments
        .filter(a => a.date !== date1)
        .concat({
          ...assignment1,
          date: date2,
        });
    } else if (!assignment1 && assignment2) {
      // Only date2 has assignment - move it to date1
      newAssignments = currentAssignments
        .filter(a => a.date !== date2)
        .concat({
          ...assignment2,
          date: date1,
        });
    }
    // If neither has assignments (both rest days), do nothing
    
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
    const newProgress = { ...get().workoutProgress };
    delete newProgress[workoutId];
    
    const newDetailedProgress = { ...get().detailedWorkoutProgress };
    delete newDetailedProgress[workoutId];
    
    set({ 
      workoutProgress: newProgress,
      detailedWorkoutProgress: newDetailedProgress 
    });
    
    await storage.saveWorkoutProgressToStorage(newProgress);
    await storage.saveDetailedWorkoutProgress(newDetailedProgress);
  },
  
  clearAllHistory: async () => {
    console.log('🧹 Clearing all workout history...');
    
    // Clear sessions and workout progress
    set({ 
      sessions: [],
      workoutProgress: {},
      detailedWorkoutProgress: {},
      exercisePRs: [],
    });
    
    // Save to storage
    await storage.saveSessions([]);
    await storage.saveWorkoutProgressToStorage({});
    await storage.saveDetailedWorkoutProgress({});
    await storage.saveExercisePRs([]);
    
    console.log('✅ All history cleared!');
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
    console.log(`🔎 getExerciseProgress(${exerciseId}):`, JSON.stringify(exerciseProgress, null, 2));
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
        completedSets += exerciseProgress.sets.filter(set => set.completed).length;
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
    const timers = get().hiitTimers.map(timer =>
      timer.id === timerId ? { ...timer, ...updates } : timer
    );
    set({ hiitTimers: timers });
    await storage.saveHIITTimers(timers);
  },
  
  deleteHIITTimer: async (timerId) => {
    const timers = get().hiitTimers.filter(timer => timer.id !== timerId);
    set({ hiitTimers: timers });
    await storage.saveHIITTimers(timers);
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
}));

