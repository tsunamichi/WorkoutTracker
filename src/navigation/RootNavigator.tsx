import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { OnboardingStack } from './OnboardingStack';
import AppNavigator from './AppNavigator';

type RootStackParamList = {
  OnboardingStack: undefined;
  AppTabs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FD6B00" />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
}

export function RootNavigator() {
  const {
    isHydrated,
    authStatus,
    hasCompletedOnboarding,
    activeCycleId,
    hydrate,
  } = useOnboardingStore();

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    hydrate().then(() => {
      setIsLoading(false);
    });
  }, [hydrate]);

  if (!isHydrated || isLoading) {
    return <LoadingScreen />;
  }

  // Determine which stack to show
  const showOnboarding = authStatus === 'unknown' || !hasCompletedOnboarding || !activeCycleId;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {showOnboarding ? (
          <Stack.Screen name="OnboardingStack" component={OnboardingStack} />
        ) : (
          <Stack.Screen name="AppTabs" component={AppNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#817B77',
  },
});

