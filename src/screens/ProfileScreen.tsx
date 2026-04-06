import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import type { AppColorThemeId } from '../types';
import { useAppTheme } from '../theme/useAppTheme';
import { SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { TimerValueSheet } from '../components/timer/TimerValueSheet';
import { IconArrowLeft, IconTriangle, IconCheckmark } from '../components/icons';
import { Toggle } from '../components/Toggle';
import { useTranslation } from '../i18n/useTranslation';
import { signInWithApple, getCurrentUser, signOut, isAppleSignInAvailable, AuthUser } from '../services/authService';
import { uploadBackup, downloadBackup, getCloudBackupInfo } from '../services/cloudSync';
import { isSupabaseConfigured } from '../services/supabase';

// Optional local notifications
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.log('⚠️ expo-notifications not installed, notifications toggle disabled');
}

interface ProfileScreenProps {
  navigation: any;
}

export function ProfileScreen({ navigation }: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, initialize } = useStore();
  const { colors: themeColors } = useAppTheme();
  const [showRestTimePicker, setShowRestTimePicker] = useState(false);
  const [notificationsSystemEnabled, setNotificationsSystemEnabled] = useState<boolean | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [appleSignInAvailable, setAppleSignInAvailable] = useState(false);
  const [cloudSyncInfo, setCloudSyncInfo] = useState<{ exists: boolean; syncedAt?: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const { t, language } = useTranslation();
  const notificationsEnabled = settings.notificationsEnabled !== false;

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  useEffect(() => {
    if (!Notifications) return;
    (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        setNotificationsSystemEnabled(status === 'granted');
      } catch (e) {
        setNotificationsSystemEnabled(null);
      }
    })();
  }, []);


  useEffect(() => {
    // Check Apple Sign-In availability and current auth state
    (async () => {
      const available = await isAppleSignInAvailable();
      setAppleSignInAvailable(available);
      if (isSupabaseConfigured()) {
        const user = await getCurrentUser();
        setAuthUser(user);
        if (user) {
          const syncInfo = await getCloudBackupInfo();
          setCloudSyncInfo(syncInfo);
        }
      }
    })();
  }, []);

  const handleToggleNotifications = async (value: boolean) => {
    if (value && Notifications) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus === 'granted') {
        setNotificationsSystemEnabled(true);
        updateSettings({ notificationsEnabled: true });
      } else {
        setNotificationsSystemEnabled(false);
        Alert.alert(
          t('notificationPermissionDeniedTitle'),
          t('notificationPermissionDeniedBody'),
          [
            { text: t('cancel'), style: 'cancel' },
            { text: t('openSettings'), onPress: () => Linking.openSettings() }
          ]
        );
      }
    } else {
      updateSettings({ notificationsEnabled: value });
    }
  };

  const handleUpdateRestTime = (seconds: number) => {
    updateSettings({ restTimerDefaultSeconds: seconds });
    setShowRestTimePicker(false);
  };

  const handleToggleUnit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateSettings({ useKg: !settings.useKg });
  };

  const handleToggleLanguage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newLanguage = language === 'en' ? 'es' : 'en';
    updateSettings({ language: newLanguage });
  };

  const languageEmoji = language === 'es' ? '🇪🇸' : '🇬🇧';
  const restTimeFormatted = `${Math.floor(settings.restTimerDefaultSeconds / 60)}:${(settings.restTimerDefaultSeconds % 60).toString().padStart(2, '0')}`;
  const unitLabel = settings.useKg ? 'kg' : 'lb';
  const activeColorTheme: AppColorThemeId = settings.colorTheme ?? 'v1';

  const handleColorTheme = (id: AppColorThemeId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void updateSettings({ colorTheme: id });
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.canvasLight }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        {/* Top Bar with Back button */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <IconArrowLeft size={24} color={themeColors.text} />
          </TouchableOpacity>
          <View style={styles.backButton} />
        </View>
        
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={[styles.pageTitle, { color: themeColors.textPrimary }]}>{t('settings')}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Global Settings title */}
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Global Settings</Text>

        {/* Group 1: Quick Settings - 3 Column Layout */}
        <View style={styles.threeColumnRow}>
          {/* Unit Card */}
          <TouchableOpacity 
            style={[styles.columnCard, { backgroundColor: themeColors.canvasContainer }]}
            onPress={handleToggleUnit}
            activeOpacity={0.7}
          >
            <Text style={[styles.columnCardValue, { color: themeColors.textPrimary }]}>{unitLabel}</Text>
            <Text style={[styles.columnCardLabel, { color: themeColors.textPrimary }]}>{t('unit')}</Text>
          </TouchableOpacity>

          {/* Language Card */}
          <TouchableOpacity 
            style={[styles.columnCard, { backgroundColor: themeColors.canvasContainer }]}
            onPress={handleToggleLanguage}
            activeOpacity={0.7}
          >
            <Text style={styles.columnCardEmoji}>{languageEmoji}</Text>
            <Text style={[styles.columnCardLabel, { color: themeColors.textPrimary }]}>{t('language')}</Text>
          </TouchableOpacity>

          {/* Rest Time Card */}
          <TouchableOpacity 
            style={[styles.columnCard, { backgroundColor: themeColors.canvasContainer }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowRestTimePicker(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.columnCardValue, { color: themeColors.textPrimary }]}>{restTimeFormatted}</Text>
            <Text style={[styles.columnCardLabel, { color: themeColors.textPrimary }]}>{t('restTime')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{t('colorTheme')}</Text>
        <View style={[styles.settingCard, { backgroundColor: themeColors.canvasContainer }]}>
          <Text style={[styles.settingDescription, styles.themeHint, { color: themeColors.textPrimary }]}>{t('colorThemeFootnote')}</Text>
          {(
            [
              { id: 'v1' as const, label: t('colorThemeV1') },
              { id: 'v2' as const, label: t('colorThemeV2') },
            ] as const
          ).map((opt, i) => (
            <React.Fragment key={opt.id}>
              {i > 0 ? <View style={[styles.themeOptionDivider, { backgroundColor: themeColors.borderDimmed }]} /> : null}
              <TouchableOpacity
                style={styles.settingRow}
                activeOpacity={0.7}
                onPress={() => handleColorTheme(opt.id)}
              >
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>{opt.label}</Text>
                </View>
                {activeColorTheme === opt.id ? (
                  <IconCheckmark size={22} color={themeColors.accentPrimary} />
                ) : (
                  <View style={{ width: 22 }} />
                )}
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>

        {/* Progression Rules */}
        <TouchableOpacity
          style={[styles.settingCard, { backgroundColor: themeColors.canvasContainer }]}
          activeOpacity={0.7}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate('Progression');
          }}
        >
          <View style={styles.settingRow}>
            <View style={[styles.settingInfo, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
              <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>Progression rules</Text>
            </View>
            <View style={{ transform: [{ rotate: '90deg' }] }}>
              <IconTriangle size={12} color={themeColors.text} />
            </View>
          </View>
        </TouchableOpacity>

        {/* Group 2: Toggle Settings */}
        <View style={[styles.settingCard, { backgroundColor: themeColors.canvasContainer }]}>
          {/* Timer Notifications */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>{t('timerNotifications')}</Text>
              <Text style={[styles.settingDescription, { color: themeColors.textPrimary }]}>
                {notificationsSystemEnabled === false
                  ? t('notificationSystemDisabled')
                  : t('timerNotificationsDescription')}
              </Text>
            </View>
            <Toggle
              label=""
              value={notificationsEnabled && notificationsSystemEnabled !== false}
              onValueChange={handleToggleNotifications}
              disabled={notificationsSystemEnabled === false}
            />
          </View>
        </View>

        {/* Account & Cloud Sync Section */}
        {isSupabaseConfigured() && (
          <View style={[styles.settingCard, { backgroundColor: themeColors.canvasContainer }]}>
            {authUser ? (
              <>
                {/* Signed in state */}
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>Signed in with Apple</Text>
                    <Text style={[styles.settingDescription, { color: themeColors.textPrimary }]}>
                      {authUser.email || 'Private email relay'}
                      {cloudSyncInfo?.syncedAt
                        ? `\nLast sync: ${new Date(cloudSyncInfo.syncedAt).toLocaleString()}`
                        : ''}
                    </Text>
                  </View>
                </View>

                <View style={[styles.settingDivider, { backgroundColor: themeColors.borderDimmed }]} />

                {/* Sync Now */}
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={async () => {
                    if (isSyncing) return;
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsSyncing(true);
                    const result = await uploadBackup();
                    setIsSyncing(false);
                    if (result.success) {
                      const info = await getCloudBackupInfo();
                      setCloudSyncInfo(info);
                      Alert.alert('Sync Complete', 'Your data has been backed up to the cloud.', [{ text: 'OK' }]);
                    } else {
                      Alert.alert('Sync Failed', result.error || 'Unknown error.', [{ text: 'OK' }]);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
                      {isSyncing ? '⏳ Syncing...' : '☁️ Sync Now'}
                    </Text>
                    <Text style={[styles.settingDescription, { color: themeColors.textPrimary }]}>Upload your data to the cloud</Text>
                  </View>
                </TouchableOpacity>

                <View style={[styles.settingDivider, { backgroundColor: themeColors.borderDimmed }]} />

                {/* Restore from Cloud */}
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    Alert.alert(
                      'Restore from Cloud',
                      'This will download your cloud backup and replace current local data. Use this after reinstalling the app.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Restore',
                          style: 'destructive',
                          onPress: async () => {
                            setIsSyncing(true);
                            const result = await downloadBackup();
                            if (result.success) {
                              await initialize();
                              setIsSyncing(false);
                              Alert.alert(
                                'Restore Complete',
                                `Restored ${result.restoredKeys} data entries from the cloud!`,
                                [{ text: 'OK' }]
                              );
                            } else {
                              setIsSyncing(false);
                              Alert.alert('Restore Failed', result.error || 'Unknown error.', [{ text: 'OK' }]);
                            }
                          },
                        },
                      ]
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>📥 Restore from Cloud</Text>
                    <Text style={[styles.settingDescription, { color: themeColors.textPrimary }]}>Download backup after reinstall</Text>
                  </View>
                </TouchableOpacity>

                <View style={[styles.settingDivider, { backgroundColor: themeColors.borderDimmed }]} />

                {/* Sign Out */}
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    Alert.alert(
                      'Sign Out',
                      'Your local data will remain. You can sign back in anytime to sync again.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Sign Out',
                          style: 'destructive',
                          onPress: async () => {
                            await signOut();
                            setAuthUser(null);
                            setCloudSyncInfo(null);
                          },
                        },
                      ]
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>Sign Out</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Not signed in — show Sign In button */}
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    try {
                      const user = await signInWithApple();
                      setAuthUser(user);
                      // After sign-in, check if there's an existing cloud backup
                      const info = await getCloudBackupInfo();
                      setCloudSyncInfo(info);
                      if (info.exists) {
                        Alert.alert(
                          'Cloud Backup Found',
                          `A backup from ${new Date(info.syncedAt!).toLocaleDateString()} was found.\n\nWould you like to restore it or upload your current data instead?`,
                          [
                            {
                              text: 'Restore Backup',
                              onPress: async () => {
                                const result = await downloadBackup();
                                if (result.success) {
                                  await initialize();
                                  Alert.alert('Restored!', `${result.restoredKeys} data entries restored.`, [{ text: 'OK' }]);
                                }
                              },
                            },
                            {
                              text: 'Upload Current',
                              onPress: async () => {
                                await uploadBackup();
                                const newInfo = await getCloudBackupInfo();
                                setCloudSyncInfo(newInfo);
                              },
                            },
                            { text: 'Later', style: 'cancel' },
                          ]
                        );
                      } else {
                        // No backup exists — auto-upload current data
                        await uploadBackup();
                        const newInfo = await getCloudBackupInfo();
                        setCloudSyncInfo(newInfo);
                        Alert.alert(
                          'Signed In!',
                          'Your workout data has been backed up to the cloud. It will survive app reinstalls.',
                          [{ text: 'OK' }]
                        );
                      }
                    } catch (e: any) {
                      // User cancelled Apple Sign-In — don't show an error
                      if (e?.code === 'ERR_REQUEST_CANCELED') return;
                      Alert.alert('Sign-In Failed', e?.message || 'Unknown error', [{ text: 'OK' }]);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}> Sign in with Apple</Text>
                    <Text style={[styles.settingDescription, { color: themeColors.textPrimary }]}>
                      Back up your data to the cloud. Survives app deletion and device changes.
                    </Text>
                  </View>
                  <IconTriangle size={16} color={themeColors.text} />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

      </ScrollView>

      {/* Rest Time Picker */}
      <TimerValueSheet
        visible={showRestTimePicker}
        onClose={() => setShowRestTimePicker(false)}
        title={t('defaultRestTime')}
        label={t('restTime').toUpperCase()}
        value={settings.restTimerDefaultSeconds}
        min={15}
        max={300}
        step={5}
        onSave={handleUpdateRestTime}
        formatValue={(val) => `${Math.floor(val / 60)}:${(val % 60).toString().padStart(2, '0')}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: SPACING.md,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -12,
  },
  pageTitleContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    marginBottom: SPACING.xxxl + SPACING.sm,
  },
  pageTitle: {
    ...TYPOGRAPHY.h2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.legal,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  // Group 1: Three Column Layout
  threeColumnRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  columnCard: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
  },
  columnCardValue: {
    ...TYPOGRAPHY.h2,
    marginBottom: SPACING.xs,
  },
  columnCardEmoji: {
    fontSize: 32,
    marginBottom: SPACING.xs,
  },
  columnCardLabel: {
    ...TYPOGRAPHY.meta,
    textTransform: 'lowercase',
  },
  // Shared Setting Card
  settingCard: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  settingCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  settingDivider: {
    height: 1,
    marginVertical: SPACING.lg,
  },
  settingInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  settingLabel: {
    ...TYPOGRAPHY.bodyBold,
    marginBottom: SPACING.xs,
  },
  settingDescription: {
    ...TYPOGRAPHY.meta,
  },
  themeHint: {
    marginBottom: SPACING.md,
  },
  themeOptionDivider: {
    height: 1,
    marginVertical: SPACING.sm,
  },
  settingChevron: {
    marginLeft: SPACING.sm,
  },
  chevronText: {
    ...TYPOGRAPHY.h2,
  },
});
