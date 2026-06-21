import React, { useCallback } from 'react';
import type { Exercise as CatalogExercise } from '../../types';
import type { Exercise as OnboardingExercise } from '../../types/workout';
import { ExerciseSearchPickModal } from '../workoutBuilder/ExerciseSearchPickModal';
import { useStore } from '../../store';

interface AddExerciseBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  onSelectExercise: (exercise: OnboardingExercise) => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function mapCatalogToOnboardingExercise(ex: CatalogExercise): OnboardingExercise {
  return {
    id: generateId(),
    name: ex.name,
    sets: 3,
    reps: '8',
    restSec: 90,
  };
}

/** Onboarding add-exercise flow — searches personal catalog only (no static library). */
export function AddExerciseBottomSheet({ isVisible, onClose, onSelectExercise }: AddExerciseBottomSheetProps) {
  const exercises = useStore(s => s.exercises);
  const ensureUserExercise = useStore(s => s.ensureUserExercise);

  const handleSelect = useCallback(
    (ex: CatalogExercise) => {
      onSelectExercise(mapCatalogToOnboardingExercise(ex));
    },
    [onSelectExercise],
  );

  const handleCreate = useCallback(
    async (name: string) => {
      const ex = await ensureUserExercise(name);
      onSelectExercise(mapCatalogToOnboardingExercise(ex));
    },
    [ensureUserExercise, onSelectExercise],
  );

  return (
    <ExerciseSearchPickModal
      visible={isVisible}
      exercises={exercises}
      onClose={onClose}
      onSelectExercise={handleSelect}
      onCreateCustom={handleCreate}
    />
  );
}
