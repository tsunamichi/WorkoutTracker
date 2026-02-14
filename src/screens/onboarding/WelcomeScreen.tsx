import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { COLORS } from '../../constants';
import { useTranslation } from '../../i18n/useTranslation';

type OnboardingStackParamList = {
  Welcome: undefined;
  ScheduleSetup: undefined;
};

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Welcome'>;
};

export function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const { setAuthStatus, finishOnboarding } = useOnboardingStore();
  const { t } = useTranslation();

  const handleContinueWithApple = async () => {
    // TODO: Implement Apple Sign In
    setAuthStatus('apple');
    await finishOnboarding();
    // Navigation will be handled by RootNavigator
  };

  const handleContinueAsGuest = async () => {
    setAuthStatus('guest');
    await finishOnboarding();
    // Navigation will be handled by RootNavigator
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.title}>{t('welcomeTitle')}</Text>
          <Text style={styles.subtitle}>
            Let's build a training plan that fits your schedule and goals.
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleContinueWithApple}
            activeOpacity={1}
          >
            <Text style={styles.primaryButtonText}>{t('continueWithApple')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleContinueAsGuest}
            activeOpacity={1}
          >
            <Text style={styles.secondaryButtonText}>{t('continueAsGuest')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 17,
    color: '#817B77',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#FD6B00',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#2C2C2E',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    fontWeight: '600',
    color: '#3C3C43',
  },
});

