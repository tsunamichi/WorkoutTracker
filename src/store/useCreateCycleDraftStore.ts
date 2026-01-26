// Manual Cycle Creation Draft Store

import { create } from 'zustand';
import {
  Weekday,
  WorkoutLength,
  WorkoutDay,
  ExerciseBlock,
  ExerciseWeekPlan,
  DAY_ORDER,
} from '../types/manualCycle';
import { sortWeekdays, generateId } from '../utils/manualCycleUtils';
import dayjs from 'dayjs';

interface CreateCycleDraftStore {
  // State
  weeks: number;
  frequencyDays: Weekday[];
  workoutLength: WorkoutLength | null;
  workouts: WorkoutDay[];
  startDate: string | null;

  // Actions
  resetDraft: () => void;
  initializeWithSelectedDate: (date: string) => void;
  setWeeks: (weeks: number) => void;
  toggleFrequencyDay: (day: Weekday) => void;
  setDaysPerWeek: (count: number) => void;
  setWorkoutLength: (length: WorkoutLength) => void;
  ensureWorkoutsForSelectedDays: () => void;
  setWorkoutDayName: (weekday: Weekday, name: string) => void;
  addExerciseToDay: (weekday: Weekday, exerciseId: string) => ExerciseBlock;
  removeExerciseFromDay: (weekday: Weekday, exerciseBlockId: string) => void;
  reorderExercises: (weekday: Weekday, fromIndex: number, toIndex: number) => void;
  reorderWorkoutDays: (newOrder: Weekday[]) => void;
  updateExerciseWeekPlan: (
    weekday: Weekday,
    exerciseBlockId: string,
    weekIndex: number,
    patch: Partial<ExerciseWeekPlan>
  ) => void;
  applyExercisePlanToAllWeeks: (
    weekday: Weekday,
    exerciseBlockId: string,
    fromWeekIndex: number
  ) => void;
  setStartDate: (date: string) => void;

  // Selectors
  selectedDaysSorted: () => Weekday[];
  isBasicsValid: () => boolean;
  areAllDaysComplete: () => boolean;
}

const DEFAULT_WEEKS = 1;

export const useCreateCycleDraftStore = create<CreateCycleDraftStore>((set, get) => ({
  // Initial state
  weeks: DEFAULT_WEEKS,
  frequencyDays: [],
  workoutLength: null,
  workouts: [],
  startDate: null,

  // Actions
  resetDraft: () => {
    set({
      weeks: DEFAULT_WEEKS,
      frequencyDays: [],
      workoutLength: null,
      workouts: [],
      startDate: null,
    });
  },

  initializeWithSelectedDate: (date: string) => {
    // Convert date to weekday (using shortened format: 'mon', 'tue', etc.)
    const dayOfWeek = dayjs(date).day(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const weekdayMap: Record<number, Weekday> = {
      0: 'sun',
      1: 'mon',
      2: 'tue',
      3: 'wed',
      4: 'thu',
      5: 'fri',
      6: 'sat',
    };
    const weekday = weekdayMap[dayOfWeek];
    
    set({
      weeks: DEFAULT_WEEKS,
      frequencyDays: [weekday],
      workoutLength: null,
      workouts: [],
      startDate: null,
    });
  },

  setWeeks: (weeks: number) => {
    set((state) => {
      // Update all existing exercise week plans
      const updatedWorkouts = state.workouts.map((workout) => ({
        ...workout,
        exercises: workout.exercises.map((exercise) => {
          const currentWeeks = exercise.weeks.length;
          let newWeeks = [...exercise.weeks];

          if (weeks > currentWeeks) {
            // Append new empty week plans
            for (let i = currentWeeks; i < weeks; i++) {
              newWeeks.push({ weekIndex: i });
            }
          } else if (weeks < currentWeeks) {
            // Truncate week plans
            newWeeks = newWeeks.slice(0, weeks);
          }

          return {
            ...exercise,
            weeks: newWeeks,
          };
        }),
      }));

      return { weeks, workouts: updatedWorkouts };
    });
  },

  toggleFrequencyDay: (day: Weekday) => {
    set((state) => {
      const newDays = state.frequencyDays.includes(day)
        ? state.frequencyDays.filter((d) => d !== day)
        : [...state.frequencyDays, day];

      return { frequencyDays: newDays };
    });
  },

  setDaysPerWeek: (count: number) => {
    const validCount = Math.max(1, Math.min(7, count));
    // Use first N days from DAY_ORDER as placeholders
    const newDays = DAY_ORDER.slice(0, validCount);
    set({ frequencyDays: newDays });
  },

  setWorkoutLength: (length: WorkoutLength) => {
    set({ workoutLength: length });
  },

  ensureWorkoutsForSelectedDays: () => {
    set((state) => {
      const newWorkouts: WorkoutDay[] = [];

      // Create workouts for selected days
      state.frequencyDays.forEach((day) => {
        const existing = state.workouts.find((w) => w.weekday === day);
        if (existing) {
          newWorkouts.push(existing);
        } else {
          newWorkouts.push({
            id: generateId(),
            weekday: day,
            exercises: [],
          });
        }
      });

      return { workouts: newWorkouts };
    });
  },

  setWorkoutDayName: (weekday: Weekday, name: string) => {
    set((state) => ({
      workouts: state.workouts.map((workout) =>
        workout.weekday === weekday ? { ...workout, name } : workout
      ),
    }));
  },

  addExerciseToDay: (weekday: Weekday, exerciseId: string) => {
    let newExercise: ExerciseBlock | null = null;
    set((state) => {
      const weeks: ExerciseWeekPlan[] = [];
      for (let i = 0; i < state.weeks; i++) {
        weeks.push({ weekIndex: i, sets: 3, reps: '8', isTimeBased: false });
      }

      newExercise = {
        id: generateId(),
        exerciseId,
        weeks,
      };

      return {
        workouts: state.workouts.map((workout) =>
          workout.weekday === weekday
            ? { ...workout, exercises: [...workout.exercises, newExercise] }
            : workout
        ),
      };
    });
    return newExercise!;
  },

  removeExerciseFromDay: (weekday: Weekday, exerciseBlockId: string) => {
    set((state) => ({
      workouts: state.workouts.map((workout) =>
        workout.weekday === weekday
          ? {
              ...workout,
              exercises: workout.exercises.filter((e) => e.id !== exerciseBlockId),
            }
          : workout
      ),
    }));
  },

  reorderExercises: (weekday: Weekday, fromIndex: number, toIndex: number) => {
    set((state) => ({
      workouts: state.workouts.map((workout) => {
        if (workout.weekday !== weekday) return workout;

        const exercises = [...workout.exercises];
        const [removed] = exercises.splice(fromIndex, 1);
        exercises.splice(toIndex, 0, removed);

        return { ...workout, exercises };
      }),
    }));
  },

  reorderWorkoutDays: (newOrder: Weekday[]) => {
    set((state) => {
      // Create a new workouts array ordered by newOrder
      const reorderedWorkouts = newOrder
        .map(weekday => state.workouts.find(w => w.weekday === weekday))
        .filter(Boolean) as WorkoutDay[];
      
      // Also update frequencyDays to match
      return {
        workouts: reorderedWorkouts,
        frequencyDays: newOrder,
      };
    });
  },

  updateExerciseWeekPlan: (
    weekday: Weekday,
    exerciseBlockId: string,
    weekIndex: number,
    patch: Partial<ExerciseWeekPlan>
  ) => {
    set((state) => ({
      workouts: state.workouts.map((workout) => {
        if (workout.weekday !== weekday) return workout;

        return {
          ...workout,
          exercises: workout.exercises.map((exercise) => {
            if (exercise.id !== exerciseBlockId) return exercise;

            return {
              ...exercise,
              weeks: exercise.weeks.map((week, i) =>
                i === weekIndex ? { ...week, ...patch, weekIndex } : week
              ),
            };
          }),
        };
      }),
    }));
  },

  applyExercisePlanToAllWeeks: (
    weekday: Weekday,
    exerciseBlockId: string,
    fromWeekIndex: number
  ) => {
    set((state) => {
      const workout = state.workouts.find((w) => w.weekday === weekday);
      if (!workout) return state;

      const exercise = workout.exercises.find((e) => e.id === exerciseBlockId);
      if (!exercise) return state;

      const sourceWeek = exercise.weeks[fromWeekIndex];
      if (!sourceWeek) return state;

      return {
        workouts: state.workouts.map((w) => {
          if (w.weekday !== weekday) return w;

          return {
            ...w,
            exercises: w.exercises.map((e) => {
              if (e.id !== exerciseBlockId) return e;

              return {
                ...e,
                weeks: e.weeks.map((week) => ({
                  ...sourceWeek,
                  weekIndex: week.weekIndex,
                })),
              };
            }),
          };
        }),
      };
    });
  },

  setStartDate: (date: string) => {
    set({ startDate: date });
  },

  // Selectors
  selectedDaysSorted: () => {
    return sortWeekdays(get().frequencyDays);
  },

  isBasicsValid: () => {
    const state = get();
    return (
      state.frequencyDays.length > 0 &&
      state.weeks >= 1 &&
      state.weeks <= 12
    );
  },

  areAllDaysComplete: () => {
    const state = get();
    return (
      state.workouts.length === state.frequencyDays.length &&
      state.workouts.every((workout) => workout.exercises.length > 0)
    );
  },
}));

