// Dependencies required (install if missing):
// npm install zustand @react-native-async-storage/async-storage

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CycleDraft, SavedCycle, UserPrefs, CycleTemplateId, Exercise, DayPlan } from '../types/workout';
import { generateDraftFromTemplate, getTemplateById } from '../utils/templateGenerator';
import { parsePlanText } from '../utils/parsePlanText';

type AuthStatus = 'unknown' | 'guest' | 'apple' | 'logged_in';

interface OnboardingStore {
  // State
  authStatus: AuthStatus;
  prefs: UserPrefs;
  draft: CycleDraft | null;
  hasCompletedOnboarding: boolean;
  savedCycles: SavedCycle[];
  activeCycleId: string | null;
  isHydrated: boolean;

  // Actions
  hydrate: () => Promise<void>;
  setAuthStatus: (status: AuthStatus) => void;
  setPrefs: (prefs: Partial<UserPrefs>) => void;
  
  // Draft management
  startDraftFromTemplate: (templateId: CycleTemplateId) => void;
  startDraftFromCustomText: () => void;
  updateDayTitle: (dayIndex: number, title: string) => void;
  addExerciseToDay: (dayIndex: number, exercise: Exercise) => void;
  removeExerciseFromDay: (dayIndex: number, exerciseId: string) => void;
  reorderExercisesInDay: (dayIndex: number, nextExercises: Exercise[]) => void;
  updateExercise: (dayIndex: number, exerciseId: string, patch: Partial<Exercise>) => void;
  setRawText: (text: string) => void;
  parseRawTextIntoDraft: () => void;
  resetDraftToTemplateDefaults: () => void;
  
  // Finalization
  finalizeCycle: (cycleLengthWeeks: number) => Promise<boolean>;
  
  // Cycle management
  deleteCycle: (cycleId: string) => void;
  setActiveCycle: (cycleId: string | null) => void;
}

const STORAGE_KEYS = {
  ONBOARDING_STATE: '@app/onboardingState',
  CYCLES: '@app/cycles',
};

// Helper to generate unique IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  // Initial state
  authStatus: 'unknown',
  prefs: {
    daysPerWeek: 3,
    sessionMinutes: 60,
  },
  draft: null,
  hasCompletedOnboarding: false,
  savedCycles: [],
  activeCycleId: null,
  isHydrated: false,

  // Hydrate from AsyncStorage
  hydrate: async () => {
    try {
      const [onboardingData, cyclesData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_STATE),
        AsyncStorage.getItem(STORAGE_KEYS.CYCLES),
      ]);

      const updates: Partial<OnboardingStore> = { isHydrated: true };

      if (onboardingData) {
        const parsed = JSON.parse(onboardingData);
        if (parsed.authStatus) updates.authStatus = parsed.authStatus;
        if (parsed.prefs) updates.prefs = parsed.prefs;
        if (parsed.draft) updates.draft = parsed.draft;
        if (parsed.hasCompletedOnboarding !== undefined) {
          updates.hasCompletedOnboarding = parsed.hasCompletedOnboarding;
        }
      }

      if (cyclesData) {
        const parsed = JSON.parse(cyclesData);
        if (parsed.savedCycles) updates.savedCycles = parsed.savedCycles;
        if (parsed.activeCycleId) updates.activeCycleId = parsed.activeCycleId;
      }

      set(updates);
    } catch (error) {
      console.error('Failed to hydrate onboarding store:', error);
      set({ isHydrated: true });
    }
  },

  // Persist state to AsyncStorage
  _persist: async () => {
    const state = get();
    try {
      await Promise.all([
        AsyncStorage.setItem(
          STORAGE_KEYS.ONBOARDING_STATE,
          JSON.stringify({
            authStatus: state.authStatus,
            prefs: state.prefs,
            draft: state.draft,
            hasCompletedOnboarding: state.hasCompletedOnboarding,
          })
        ),
        AsyncStorage.setItem(
          STORAGE_KEYS.CYCLES,
          JSON.stringify({
            savedCycles: state.savedCycles,
            activeCycleId: state.activeCycleId,
          })
        ),
      ]);
    } catch (error) {
      console.error('Failed to persist onboarding store:', error);
    }
  },

  setAuthStatus: (status) => {
    set({ authStatus: status });
    get()._persist();
  },

  setPrefs: (prefsUpdate) => {
    set((state) => ({
      prefs: { ...state.prefs, ...prefsUpdate },
    }));
    get()._persist();
  },

  startDraftFromTemplate: (templateId) => {
    const state = get();
    const draft = generateDraftFromTemplate(templateId, state.prefs);
    set({ draft });
    get()._persist();
  },

  startDraftFromCustomText: () => {
    const state = get();
    const template = getTemplateById('custom');
    const dayTitles = Array.from(
      { length: state.prefs.daysPerWeek },
      (_, i) => `Day ${i + 1}`
    );

    const days: DayPlan[] = dayTitles.map((title, index) => ({
      dayIndex: index + 1,
      title,
      exercises: [],
    }));

    set({
      draft: {
        prefs: state.prefs,
        templateId: 'custom',
        templateName: template?.name || 'Custom Template',
        days,
        source: 'custom_text',
        rawText: '',
      },
    });
    get()._persist();
  },

  updateDayTitle: (dayIndex, title) => {
    set((state) => {
      if (!state.draft) return state;

      const updatedDays = state.draft.days.map((day) =>
        day.dayIndex === dayIndex ? { ...day, title } : day
      );

      return {
        draft: { ...state.draft, days: updatedDays },
      };
    });
    get()._persist();
  },

  addExerciseToDay: (dayIndex, exercise) => {
    set((state) => {
      if (!state.draft) return state;

      const updatedDays = state.draft.days.map((day) =>
        day.dayIndex === dayIndex
          ? { ...day, exercises: [...day.exercises, { ...exercise, id: exercise.id || generateId() }] }
          : day
      );

      return {
        draft: { ...state.draft, days: updatedDays },
      };
    });
    get()._persist();
  },

  removeExerciseFromDay: (dayIndex, exerciseId) => {
    set((state) => {
      if (!state.draft) return state;

      const updatedDays = state.draft.days.map((day) =>
        day.dayIndex === dayIndex
          ? { ...day, exercises: day.exercises.filter((ex) => ex.id !== exerciseId) }
          : day
      );

      return {
        draft: { ...state.draft, days: updatedDays },
      };
    });
    get()._persist();
  },

  reorderExercisesInDay: (dayIndex, nextExercises) => {
    set((state) => {
      if (!state.draft) return state;

      const updatedDays = state.draft.days.map((day) =>
        day.dayIndex === dayIndex ? { ...day, exercises: nextExercises } : day
      );

      return {
        draft: { ...state.draft, days: updatedDays },
      };
    });
    get()._persist();
  },

  updateExercise: (dayIndex, exerciseId, patch) => {
    set((state) => {
      if (!state.draft) return state;

      const updatedDays = state.draft.days.map((day) =>
        day.dayIndex === dayIndex
          ? {
              ...day,
              exercises: day.exercises.map((ex) =>
                ex.id === exerciseId ? { ...ex, ...patch } : ex
              ),
            }
          : day
      );

      return {
        draft: { ...state.draft, days: updatedDays },
      };
    });
    get()._persist();
  },

  setRawText: (text) => {
    set((state) => {
      if (!state.draft) return state;
      return {
        draft: { ...state.draft, rawText: text },
      };
    });
    get()._persist();
  },

  parseRawTextIntoDraft: () => {
    const state = get();
    if (!state.draft || !state.draft.rawText) return;

    const parsedDays = parsePlanText(state.draft.rawText, state.prefs);

    set({
      draft: {
        ...state.draft,
        days: parsedDays,
      },
    });
    get()._persist();
  },

  resetDraftToTemplateDefaults: () => {
    const state = get();
    if (!state.draft) return;

    const newDraft = generateDraftFromTemplate(state.draft.templateId, state.prefs);
    set({ draft: newDraft });
    get()._persist();
  },

  finalizeCycle: async (cycleLengthWeeks) => {
    const state = get();
    if (!state.draft) return false;

    // Validation
    const hasEmptyDay = state.draft.days.some((day) => day.exercises.length === 0);
    if (hasEmptyDay) {
      console.warn('Cannot finalize: some days have no exercises');
      return false;
    }

    const newCycle: SavedCycle = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      prefs: state.draft.prefs,
      templateId: state.draft.templateId,
      templateName: state.draft.templateName,
      days: state.draft.days,
      source: state.draft.source,
      rawText: state.draft.rawText,
      cycleLengthWeeks,
    };

    set({
      savedCycles: [...state.savedCycles, newCycle],
      activeCycleId: newCycle.id,
      hasCompletedOnboarding: true,
      draft: null, // Clear draft after finalization
    });

    await get()._persist();
    return true;
  },

  deleteCycle: (cycleId) => {
    set((state) => ({
      savedCycles: state.savedCycles.filter((c) => c.id !== cycleId),
      activeCycleId: state.activeCycleId === cycleId ? null : state.activeCycleId,
    }));
    get()._persist();
  },

  setActiveCycle: (cycleId) => {
    set({ activeCycleId: cycleId });
    get()._persist();
  },

  // Private method for persistence (TypeScript will complain but it works)
  _persist: async () => {
    const state = get();
    try {
      await Promise.all([
        AsyncStorage.setItem(
          STORAGE_KEYS.ONBOARDING_STATE,
          JSON.stringify({
            authStatus: state.authStatus,
            prefs: state.prefs,
            draft: state.draft,
            hasCompletedOnboarding: state.hasCompletedOnboarding,
          })
        ),
        AsyncStorage.setItem(
          STORAGE_KEYS.CYCLES,
          JSON.stringify({
            savedCycles: state.savedCycles,
            activeCycleId: state.activeCycleId,
          })
        ),
      ]);
    } catch (error) {
      console.error('Failed to persist onboarding store:', error);
    }
  },
}));

