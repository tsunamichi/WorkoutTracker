import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { COLORS } from '../constants';
import type { RootStackParamList } from '../navigation/AppNavigator';

export function WarmupExecutionRedirectScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'WarmupExecution'>>();

  useEffect(() => {
    const { workoutKey, workoutTemplateId } = route.params;
    (navigation as any).replace('ExerciseExecution', {
      workoutKey,
      workoutTemplateId,
      type: 'warmup',
    });
  }, [navigation, route.params]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.backgroundCanvas }}>
      <ActivityIndicator color={COLORS.accentPrimary} />
    </View>
  );
}

