import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useStore } from './src/store';
import { COLORS } from './src/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

class RootErrorBoundary extends React.Component<
  { onFatal: (error: Error) => void; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    const err = error instanceof Error ? error : new Error(String(error));
    try {
      AsyncStorage.setItem(
        'lastFatalJsError',
        JSON.stringify({ message: err.message, stack: err.stack, isFatal: true, at: new Date().toISOString() })
      ).catch(() => {});
      // eslint-disable-next-line no-console
      console.error('Fatal render error:', err.message, err.stack);
    } catch {}
    this.props.onFatal(err);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function App() {
  const { initialize, isLoading } = useStore();
  const [fatalError, setFatalError] = useState<Error | null>(null);
  
  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    // Prevent hard-crashes on production builds by intercepting fatal JS errors.
    // Also persists the error so we can inspect it on next launch / via logs.
    const ErrorUtilsAny = (global as any)?.ErrorUtils;
    const previousHandler =
      typeof ErrorUtilsAny?.getGlobalHandler === 'function'
        ? ErrorUtilsAny.getGlobalHandler()
        : undefined;

    if (typeof ErrorUtilsAny?.setGlobalHandler === 'function') {
      ErrorUtilsAny.setGlobalHandler((error: any, isFatal?: boolean) => {
        try {
          const message = typeof error?.message === 'string' ? error.message : String(error);
          const stack = typeof error?.stack === 'string' ? error.stack : undefined;
          AsyncStorage.setItem(
            'lastFatalJsError',
            JSON.stringify({ message, stack, isFatal: !!isFatal, at: new Date().toISOString() })
          ).catch(() => {});
          // eslint-disable-next-line no-console
          console.error('Fatal JS error:', message, stack);
        } catch {}

        if (__DEV__ && typeof previousHandler === 'function') {
          previousHandler(error, isFatal);
          return;
        }

        if (isFatal) {
          setFatalError(error instanceof Error ? error : new Error(String(error)));
        }
      });
    }

    return () => {
      if (typeof ErrorUtilsAny?.setGlobalHandler === 'function' && typeof previousHandler === 'function') {
        ErrorUtilsAny.setGlobalHandler(previousHandler);
      }
    };
  }, []);
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (fatalError) {
    return (
      <View style={styles.fatalContainer}>
        <Text style={styles.fatalTitle}>Something went wrong</Text>
        <Text style={styles.fatalBody} numberOfLines={6}>
          {fatalError.message}
        </Text>
        <Text style={styles.fatalHint}>
          Please close and reopen the app. This error was saved as “lastFatalJsError”.
        </Text>
        <TouchableOpacity style={styles.fatalButton} onPress={() => setFatalError(null)} activeOpacity={0.9}>
          <Text style={styles.fatalButtonText}>Try to continue</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <RootErrorBoundary onFatal={setFatalError}>
          <RootNavigator />
        </RootErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fatalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  fatalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  fatalBody: {
    fontSize: 14,
    color: COLORS.text,
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: 12,
  },
  fatalHint: {
    fontSize: 12,
    color: COLORS.text,
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 18,
  },
  fatalButton: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fatalButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
