import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { useTranslation } from '../i18n/useTranslation';
import {
  signInWithApple,
  isAppleSignInAvailable,
} from '../services/authService';
import { isSupabaseConfigured } from '../services/supabase';

interface LoginScreenProps {
  onAuthenticated: () => void;
  onContinueAsGuest: () => void;
}

export function LoginScreen({ onAuthenticated, onContinueAsGuest }: LoginScreenProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  // Animations
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(30)).current;
  const buttonsFade = React.useRef(new Animated.Value(0)).current;
  const buttonsSlide = React.useRef(new Animated.Value(20)).current;

  useEffect(() => {
    (async () => {
      const available = await isAppleSignInAvailable();
      setAppleAvailable(available && isSupabaseConfigured());
    })();
  }, []);

  useEffect(() => {
    // Staggered entrance animation
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(buttonsFade, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(buttonsSlide, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const handleSignInWithApple = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await signInWithApple();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onAuthenticated();
    } catch (e: any) {
      // User cancelled Apple Sign-In -- don't show an error
      if (e?.code === 'ERR_REQUEST_CANCELED') {
        setIsSigningIn(false);
        return;
      }
      Alert.alert(t('signInFailed'), e?.message || 'Unknown error', [
        { text: 'OK' },
      ]);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleContinueAsGuest = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onContinueAsGuest();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Hero Section */}
      <Animated.View
        style={[
          styles.heroSection,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* App Icon */}
        <Image
          source={require('../../assets/icon.png')}
          style={styles.appIcon}
        />

        <Text style={styles.title}>{t('welcomeTitle')}</Text>
        <Text style={styles.subtitle}>{t('loginSubtitle')}</Text>
      </Animated.View>

      {/* Actions Section */}
      <Animated.View
        style={[
          styles.actionsSection,
          {
            opacity: buttonsFade,
            transform: [{ translateY: buttonsSlide }],
          },
        ]}
      >
        {/* Sign in with Apple */}
        {appleAvailable && (
          <TouchableOpacity
            style={styles.appleButton}
            onPress={handleSignInWithApple}
            activeOpacity={0.8}
            disabled={isSigningIn}
          >
            {isSigningIn ? (
              <ActivityIndicator size="small" color={COLORS.backgroundCanvas} />
            ) : (
              <>
                <Text style={styles.appleIcon}>{'\uF8FF'}</Text>
                <Text style={styles.appleButtonText}>
                  {t('continueWithApple')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Continue as Guest */}
        <TouchableOpacity
          style={styles.guestButton}
          onPress={handleContinueAsGuest}
          activeOpacity={0.8}
        >
          <Text style={styles.guestButtonText}>{t('continueAsGuest')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xxl,
  },
  heroSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  appIcon: {
    width: 96,
    height: 96,
    borderRadius: 22,
    marginBottom: SPACING.xxxl,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 40,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  actionsSection: {
    gap: 12,
    paddingBottom: 32,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.md,
    gap: 8,
    minHeight: 54,
  },
  appleIcon: {
    fontSize: 20,
    color: '#000000',
  },
  appleButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  guestButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.activeCard,
    minHeight: 54,
  },
  guestButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});
