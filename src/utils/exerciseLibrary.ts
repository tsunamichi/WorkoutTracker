import { MovementPattern, Equipment } from '../types/workout';
import exercisesData from '../data/exercises.json';

export type ExerciseLibraryEntry = {
  name: string;
  pattern?: MovementPattern;
  equipment?: Equipment;
};

export type ExerciseFilters = {
  pattern?: MovementPattern;
  equipment?: Equipment;
};

export function getAllExercises(): ExerciseLibraryEntry[] {
  return exercisesData as ExerciseLibraryEntry[];
}

export function searchExercises(
  query: string = '',
  filters?: ExerciseFilters
): ExerciseLibraryEntry[] {
  let results = getAllExercises();

  // Apply filters
  if (filters?.pattern) {
    results = results.filter(ex => ex.pattern === filters.pattern);
  }

  if (filters?.equipment) {
    results = results.filter(ex => ex.equipment === filters.equipment);
  }

  // Apply search query
  if (query.trim()) {
    const lowerQuery = query.toLowerCase();
    results = results.filter(ex =>
      ex.name.toLowerCase().includes(lowerQuery)
    );
  }

  return results;
}

export function getExercisesByPattern(pattern: MovementPattern): ExerciseLibraryEntry[] {
  return getAllExercises().filter(ex => ex.pattern === pattern);
}

export function getExercisesByEquipment(equipment: Equipment): ExerciseLibraryEntry[] {
  return getAllExercises().filter(ex => ex.equipment === equipment);
}

