import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './AppNavigator';
import { navigationRef } from './navigationService';
import { LoginScreen } from '../screens/LoginScreen';
import { getCurrentUser } from '../services/authService';
import { isSupabaseConfigured } from '../services/supabase';
import { COLORS } from '../constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_MODE_KEY = '@app/guestMode';

export function RootNavigator() {
  const [authState, setAuthState] = useState<'loading' | 'unauthenticated' | 'authenticated'>('loading');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check if user previously chose guest mode
      const guestMode = await AsyncStorage.getItem(GUEST_MODE_KEY);
      if (guestMode === 'true') {
        setAuthState('authenticated');
        return;
      }

      // Check Supabase auth state
      if (isSupabaseConfigured()) {
        const user = await getCurrentUser();
        if (user) {
          setAuthState('authenticated');
          return;
        }
      }

      // Not authenticated
      setAuthState('unauthenticated');
    } catch (error) {
      console.error('Auth check failed:', error);
      // On error, show login screen rather than blocking
      setAuthState('unauthenticated');
    }
  };

  const handleAuthenticated = () => {
    setAuthState('authenticated');
  };

  const handleContinueAsGuest = async () => {
    await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
    setAuthState('authenticated');
  };

  if (authState === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <LoginScreen
        onAuthenticated={handleAuthenticated}
        onContinueAsGuest={handleContinueAsGuest}
      />
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <AppNavigator />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
