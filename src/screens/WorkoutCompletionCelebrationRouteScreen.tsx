/**
 * Stack route: workout completion celebration with real data (replaces ExerciseExecution).
 */
import React from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  WorkoutCompletionCelebrationScreen,
  type WorkoutCompletionCelebrationData,
} from '../components/celebration/WorkoutCompletionCelebrationScreen';

type CelebrationParams = {
  WorkoutCompletionCelebration: { celebrationData: WorkoutCompletionCelebrationData };
};

export function WorkoutCompletionCelebrationRouteScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CelebrationParams>>();
  const route = useRoute<RouteProp<CelebrationParams, 'WorkoutCompletionCelebration'>>();
  const celebrationData = route.params?.celebrationData;

  if (!celebrationData) {
    navigation.goBack();
    return null;
  }

  return (
    <WorkoutCompletionCelebrationScreen
      data={celebrationData}
      autoPlay
      onRequestClose={() => navigation.goBack()}
    />
  );
}
