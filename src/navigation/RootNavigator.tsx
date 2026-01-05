import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './AppNavigator';

// TEMPORARY FIX: Bypassing onboarding store to avoid Zustand initialization error
// TODO: Fix useOnboardingStore() "Cannot call a class as a function" error
export function RootNavigator() {
  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
}
