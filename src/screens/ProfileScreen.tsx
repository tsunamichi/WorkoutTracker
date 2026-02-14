import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { TimerValueSheet } from '../components/timer/TimerValueSheet';
import { IconArrowLeft, IconTriangle } from '../components/icons';
import { Toggle } from '../components/Toggle';
import { useTranslation } from '../i18n/useTranslation';
import { cloudBackupService } from '../services/cloudBackup';
import { exportDataToFile, importDataFromFile } from '../services/dataExportImport';
import { signInWithApple, getCurrentUser, signOut, isAppleSignInAvailable, AuthUser } from '../services/authService';
import { uploadBackup, downloadBackup, getCloudBackupInfo } from '../services/cloudSync';
import { isSupabaseConfigured } from '../services/supabase';
import { migrateOldStorageKeys, scanForOldData, validateAndRepairSessions, convertPartialWorkoutsToSessions, recoverSessionsFromCompletionStates } from '../utils/dataMigration';

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
  const [showRestTimePicker, setShowRestTimePicker] = useState(false);
  const [notificationsSystemEnabled, setNotificationsSystemEnabled] = useState<boolean | null>(null);
  const [cloudBackupInfo, setCloudBackupInfo] = useState<{ exists: boolean; timestamp?: string } | null>(null);
  const [showBackupOptions, setShowBackupOptions] = useState(false);
  const [showAdvancedRecovery, setShowAdvancedRecovery] = useState(false);
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
    // Load cloud backup info
    (async () => {
      const info = await cloudBackupService.getBackupInfo();
      setCloudBackupInfo(info);
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        {/* Top Bar with Back button */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <IconArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.backButton} />
        </View>
        
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={styles.pageTitle}>{t('settings')}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Group 1: Quick Settings - 3 Column Layout */}
        <View style={styles.threeColumnRow}>
          {/* Unit Card */}
          <TouchableOpacity 
            style={styles.columnCard}
            onPress={handleToggleUnit}
            activeOpacity={0.7}
          >
            <Text style={styles.columnCardValue}>{unitLabel}</Text>
            <Text style={styles.columnCardLabel}>{t('unit')}</Text>
          </TouchableOpacity>

          {/* Language Card */}
          <TouchableOpacity 
            style={styles.columnCard}
            onPress={handleToggleLanguage}
            activeOpacity={0.7}
          >
            <Text style={styles.columnCardEmoji}>{languageEmoji}</Text>
            <Text style={styles.columnCardLabel}>{t('language')}</Text>
          </TouchableOpacity>

          {/* Rest Time Card */}
          <TouchableOpacity 
            style={styles.columnCard}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowRestTimePicker(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.columnCardValue}>{restTimeFormatted}</Text>
            <Text style={styles.columnCardLabel}>{t('restTime')}</Text>
          </TouchableOpacity>
        </View>

        {/* Group 2: Toggle Settings - Combined Card */}
        <View style={styles.settingCard}>
          {/* Monthly Progress Check */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{t('monthlyProgressCheck')}</Text>
              <Text style={styles.settingDescription}>
                {t('monthlyProgressReminder').replace('{day}', String(settings.monthlyProgressReminderDay))}
              </Text>
            </View>
            <Toggle
              label=""
              value={settings.monthlyProgressReminderEnabled}
              onValueChange={(value) => updateSettings({ monthlyProgressReminderEnabled: value })}
            />
          </View>

          {/* Divider */}
          <View style={styles.settingDivider} />

          {/* Timer Notifications */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{t('timerNotifications')}</Text>
              <Text style={styles.settingDescription}>
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
          <View style={styles.settingCard}>
            {authUser ? (
              <>
                {/* Signed in state */}
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Signed in with Apple</Text>
                    <Text style={styles.settingDescription}>
                      {authUser.email || 'Private email relay'}
                      {cloudSyncInfo?.syncedAt
                        ? `\nLast sync: ${new Date(cloudSyncInfo.syncedAt).toLocaleString()}`
                        : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.settingDivider} />

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
                    <Text style={styles.settingLabel}>
                      {isSyncing ? '⏳ Syncing...' : '☁️ Sync Now'}
                    </Text>
                    <Text style={styles.settingDescription}>Upload your data to the cloud</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.settingDivider} />

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
                    <Text style={styles.settingLabel}>📥 Restore from Cloud</Text>
                    <Text style={styles.settingDescription}>Download backup after reinstall</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.settingDivider} />

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
                    <Text style={[styles.settingLabel, { color: COLORS.textMeta }]}>Sign Out</Text>
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
                    <Text style={styles.settingLabel}> Sign in with Apple</Text>
                    <Text style={styles.settingDescription}>
                      Back up your data to the cloud. Survives app deletion and device changes.
                    </Text>
                  </View>
                  <IconTriangle size={16} color={COLORS.text} />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* iCloud Backup Section - Collapsible */}
        <TouchableOpacity 
          style={[styles.settingCard, styles.settingCardRow]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowBackupOptions(!showBackupOptions);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>☁️ iCloud Backup</Text>
            <Text style={styles.settingDescription}>
              {cloudBackupInfo?.exists 
                ? `Last backup: ${cloudBackupInfo.timestamp ? new Date(cloudBackupInfo.timestamp).toLocaleDateString() : 'Unknown'}`
                : 'Automatic backup enabled'}
            </Text>
          </View>
          <IconTriangle 
            size={16} 
            color={COLORS.text} 
            style={{ transform: [{ rotate: showBackupOptions ? '90deg' : '0deg' }] }}
          />
        </TouchableOpacity>

        {showBackupOptions && (
          <View style={styles.nestedOptionsContainer}>
            <TouchableOpacity 
              style={[styles.settingCard, styles.settingCardRow, styles.nestedOption]}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const info = await cloudBackupService.getBackupInfo();
                const timestamp = info.timestamp 
                  ? new Date(info.timestamp).toLocaleString()
                  : 'Never';
                
                Alert.alert(
                  'iCloud Backup Status',
                  info.exists
                    ? `✅ Backup exists\n\nLast backup: ${timestamp}\n\nYour workout data is automatically backed up to iCloud every 5 minutes.`
                    : `No backup found\n\nBackups will start automatically. Your first backup will happen within 5 minutes.`,
                  [{ text: 'OK' }]
                );
              }}
              activeOpacity={0.7}
            >
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>View Status</Text>
                <Text style={styles.settingDescription}>Check backup details</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingCard, styles.settingCardRow, styles.nestedOption]}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert(
                  'Backup to iCloud Now',
                  'Create a backup of all your workout data to iCloud?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Backup Now',
                      onPress: async () => {
                        const result = await cloudBackupService.manualBackup();
                        if (result.success) {
                          const newInfo = await cloudBackupService.getBackupInfo();
                          setCloudBackupInfo(newInfo);
                          Alert.alert(
                            'Success',
                            'Your workout data has been backed up to iCloud!',
                            [{ text: 'OK' }]
                          );
                        } else {
                          Alert.alert(
                            'Error',
                            result.error || 'Failed to backup. Please try again.',
                            [{ text: 'OK' }]
                          );
                        }
                      }
                    }
                  ]
                );
              }}
              activeOpacity={0.7}
            >
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Backup Now</Text>
                <Text style={styles.settingDescription}>Create manual backup</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingCard, styles.settingCardRow, styles.nestedOption]}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const hasBackup = await cloudBackupService.hasCloudBackup();
                if (!hasBackup) {
                  Alert.alert(
                    'No Backup Found',
                    'There is no iCloud backup to restore from.',
                    [{ text: 'OK' }]
                  );
                  return;
                }
                
                Alert.alert(
                  'Restore from iCloud',
                  'This will restore your workout data from your iCloud backup. Current data will be replaced.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Restore',
                      style: 'destructive',
                      onPress: async () => {
                        const result = await cloudBackupService.restoreFromCloud();
                        if (result.success) {
                          // Reload the store
                          await initialize();
                          Alert.alert(
                            'Success',
                            `Restored ${result.restoredKeys} items from iCloud backup!`,
                            [{ text: 'OK' }]
                          );
                        } else {
                          Alert.alert(
                            'Error',
                            result.error || 'Failed to restore. Please try again.',
                            [{ text: 'OK' }]
                          );
                        }
                      }
                    }
                  ]
                );
              }}
              activeOpacity={0.7}
            >
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Restore from Backup</Text>
                <Text style={styles.settingDescription}>Replace current data</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Export / Import Data */}
        <View style={styles.settingCard}>
          <TouchableOpacity 
            style={styles.settingRow}
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const result = await exportDataToFile();
              if (!result.success && result.error !== undefined) {
                Alert.alert('Export Failed', result.error, [{ text: 'OK' }]);
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>📤 Export Data</Text>
              <Text style={styles.settingDescription}>
                Save a backup file to Files, AirDrop, etc.
              </Text>
            </View>
            <IconTriangle size={16} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          <TouchableOpacity 
            style={styles.settingRow}
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert(
                'Import Backup',
                'This will restore data from a backup file. Your current data will be merged with the imported data.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Choose File',
                    onPress: async () => {
                      const result = await importDataFromFile();
                      if (result.success) {
                        await initialize();
                        Alert.alert(
                          'Import Successful',
                          `Restored ${result.restoredKeys} data entries from backup!\n\nYour workouts and progress have been restored.`,
                          [{ text: 'OK' }]
                        );
                      } else if (result.error && result.error !== 'No file selected.') {
                        Alert.alert('Import Failed', result.error, [{ text: 'OK' }]);
                      }
                    }
                  }
                ]
              );
            }}
            activeOpacity={0.7}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>📥 Import Data</Text>
              <Text style={styles.settingDescription}>
                Restore from a previously exported backup file
              </Text>
            </View>
            <IconTriangle size={16} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Data Recovery Section */}
        <TouchableOpacity 
          style={[styles.settingCard, styles.settingCardRow]}
          onPress={async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert(
              'Recover Old Data',
              'This will scan for workout data from older app versions and migrate it to the new format.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Scan & Migrate',
                  onPress: async () => {
                    try {
                      console.log('🔍 Starting data recovery...');
                      
                      // First scan for old data
                      const scanResult = await scanForOldData();
                      console.log('📊 Scan result:', scanResult);
                      
                      if (scanResult.potentialOldKeys.length === 0) {
                        Alert.alert(
                          'No Old Data Found',
                          'No workout data from older app versions was found.',
                          [{ text: 'OK' }]
                        );
                        return;
                      }
                      
                      // Convert partial workouts to sessions
                      console.log('💾 Converting partial workouts to sessions...');
                      const conversionResult = await convertPartialWorkoutsToSessions();
                      console.log('✅ Conversion result:', conversionResult);
                      
                      // Validate and repair sessions data
                      console.log('🔧 Validating and repairing sessions data...');
                      const repairResult = await validateAndRepairSessions();
                      console.log('✅ Repair result:', repairResult);
                      
                      // Now migrate the data (for old keys)
                      console.log('🔄 Migrating old data...');
                      const migrationResult = await migrateOldStorageKeys();
                      console.log('✅ Migration result:', migrationResult);
                      
                      // Reload store to load the migrated/repaired data
                      console.log('♻️  Reloading store...');
                      await initialize();
                      
                      // Check what was loaded
                      const store = useStore.getState();
                      const sessionsCount = store.sessions?.length || 0;
                      
                      // Build success message
                      const sessionsText = scanResult.sessionsInfo
                        ? `\n🎯 Sessions found in storage: ${scanResult.sessionsInfo.count} workouts`
                        : '';
                      
                      const convertedText = conversionResult.sessionsCreated > 0
                        ? `\n💾 Recovered ${conversionResult.sessionsCreated} partial workouts (${conversionResult.workoutsProcessed} processed)`
                        : '';
                      
                      const repairText = repairResult.repaired
                        ? `\n🔧 Repaired ${repairResult.sessionsCount} sessions`
                        : '';
                      
                      const migratedText = migrationResult.migratedKeys.length > 0
                        ? `\n✅ Migrated ${migrationResult.migratedKeys.length} storage keys`
                        : '';
                      
                      const currentStateText = `\n\n📱 Current state:\n- Sessions loaded in app: ${sessionsCount}`;
                      
                      if (sessionsCount > 0) {
                        Alert.alert(
                          'Recovery Successful! 🎉',
                          `Your workout data has been recovered!${sessionsText}${convertedText}${repairText}${migratedText}${currentStateText}\n\nYou can now view your workout history in any exercise detail screen!`,
                          [{ text: 'OK' }]
                        );
                      } else if (conversionResult.sessionsCreated > 0) {
                        Alert.alert(
                          'Partial Recovery',
                          `Recovered ${conversionResult.sessionsCreated} workouts from progress data!${convertedText}${currentStateText}\n\nTap "Force Reload" in Advanced Options to load them into the app.`,
                          [{ text: 'OK' }]
                        );
                      } else if (repairResult.success && repairResult.sessionsCount > 0) {
                        Alert.alert(
                          'Data Found But Not Loading',
                          `Found ${repairResult.sessionsCount} sessions in storage, but they're not loading into the app.${repairText}${currentStateText}\n\nTry the "Advanced Options" below for more troubleshooting.`,
                          [{ text: 'OK' }]
                        );
                      } else if (repairResult.error) {
                        Alert.alert(
                          'Data Format Issue',
                          `Found sessions data but there was an error:\n${repairResult.error}\n\nThe data may be corrupted or in an incompatible format.`,
                          [{ text: 'OK' }]
                        );
                      } else {
                        Alert.alert(
                          'Migration Complete',
                          `Data scan complete.${sessionsText}${convertedText}${repairText}${migratedText}${currentStateText}\n\n${migrationResult.errors.length > 0 ? `Errors: ${migrationResult.errors.join(', ')}` : 'No errors.'}`,
                          [{ text: 'OK' }]
                        );
                      }
                    } catch (error) {
                      console.error('❌ Error during data recovery:', error);
                      Alert.alert(
                        'Error',
                        `Failed to recover data: ${error}`,
                        [{ text: 'OK' }]
                      );
                    }
                  }
                }
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>🔄 Recover Old Data</Text>
            <Text style={styles.settingDescription}>
              Scan and migrate old workout history
            </Text>
          </View>
          <IconTriangle size={16} color={COLORS.text} />
        </TouchableOpacity>

        {/* Advanced Recovery Options - Collapsible */}
        <TouchableOpacity 
          style={[styles.settingCard, styles.settingCardRow]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowAdvancedRecovery(!showAdvancedRecovery);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>⚙️ Advanced Options</Text>
            <Text style={styles.settingDescription}>
              Additional troubleshooting tools
            </Text>
          </View>
          <IconTriangle 
            size={16} 
            color={COLORS.text} 
            style={{ transform: [{ rotate: showAdvancedRecovery ? '90deg' : '0deg' }] }}
          />
        </TouchableOpacity>

        {showAdvancedRecovery && (
          <View style={styles.nestedOptionsContainer}>
            <TouchableOpacity 
              style={[styles.settingCard, styles.settingCardRow, styles.nestedOption]}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert(
                  'Force Reload Data',
                  'This will reload all data from storage. Use this if your workouts or history disappeared.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Reload',
                      onPress: async () => {
                        try {
                          console.log('🔄 Starting force reload...');
                          await initialize();
                          
                          // Check what was loaded
                          const store = useStore.getState();
                          console.log('✅ Reload complete. Current state:');
                          console.log(`  - Sessions: ${store.sessions?.length || 0}`);
                          console.log(`  - Workout Templates: ${store.workoutTemplates?.length || 0}`);
                          console.log(`  - Cycle Plans: ${store.cyclePlans?.length || 0}`);
                          console.log(`  - Scheduled Workouts: ${store.scheduledWorkouts?.length || 0}`);
                          console.log(`  - Exercises: ${store.exercises?.length || 0}`);
                          
                          Alert.alert(
                            'Success',
                            `Data reloaded!\n\n` +
                            `Sessions: ${store.sessions?.length || 0}\n` +
                            `Templates: ${store.workoutTemplates?.length || 0}\n` +
                            `Plans: ${store.cyclePlans?.length || 0}\n` +
                            `Scheduled: ${store.scheduledWorkouts?.length || 0}\n\n` +
                            `Check console for details.`,
                            [{ text: 'OK' }]
                          );
                        } catch (error) {
                          Alert.alert(
                            'Error',
                            'Failed to reload data. Check console for details.',
                            [{ text: 'OK' }]
                          );
                          console.error('❌ Error reloading data:', error);
                        }
                      }
                    }
                  ]
                );
              }}
              activeOpacity={0.7}
            >
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Force Reload</Text>
                <Text style={styles.settingDescription}>Reload all data from storage</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingCard, styles.settingCardRow, styles.nestedOption]}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert(
                  'Recover Completed Workouts',
                  'This will scan your completed exercises and create workout sessions for your history. This is useful if your previously completed workouts are not showing up in the progress tab.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Recover',
                      onPress: async () => {
                        try {
                          console.log('🔄 Starting workout recovery...');
                          const result = await useStore.getState().recoverCompletedWorkouts();
                          
                          if (result.success) {
                            Alert.alert(
                              'Recovery Complete',
                              result.sessionsCreated > 0
                                ? `Successfully recovered ${result.sessionsCreated} workout session(s) from ${result.workoutsProcessed} completed workout(s)!\n\nYour history and progress should now be updated.`
                                : `No new sessions to recover. All completed workouts already have session records.`,
                              [{ text: 'OK' }]
                            );
                          } else {
                            Alert.alert(
                              'Recovery Failed',
                              result.error || 'An error occurred during recovery. Check console for details.',
                              [{ text: 'OK' }]
                            );
                          }
                        } catch (error) {
                          Alert.alert(
                            'Error',
                            'Failed to recover workouts. Check console for details.',
                            [{ text: 'OK' }]
                          );
                          console.error('❌ Error recovering workouts:', error);
                        }
                      }
                    }
                  ]
                );
              }}
              activeOpacity={0.7}
            >
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Recover Completed Workouts</Text>
                <Text style={styles.settingDescription}>Create history records from completed exercises</Text>
              </View>
            </TouchableOpacity>
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
    backgroundColor: COLORS.backgroundCanvas,
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
    color: COLORS.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
  },
  // Group 1: Three Column Layout
  threeColumnRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  columnCard: {
    flex: 1,
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
  },
  columnCardValue: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  columnCardEmoji: {
    fontSize: 32,
    marginBottom: SPACING.xs,
  },
  columnCardLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    textTransform: 'lowercase',
  },
  // Shared Setting Card
  settingCard: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  settingCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Nested Options Container
  nestedOptionsContainer: {
    marginTop: -SPACING.md,
    marginBottom: SPACING.lg,
    paddingLeft: SPACING.md,
  },
  nestedOption: {
    marginLeft: SPACING.lg,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.backgroundCanvas,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.borderDimmed,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  settingDivider: {
    height: 1,
    backgroundColor: COLORS.borderDimmed,
    marginVertical: SPACING.lg,
  },
  settingInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  settingLabel: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  settingDescription: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  settingChevron: {
    marginLeft: SPACING.sm,
  },
  chevronText: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textMeta,
  },
});
