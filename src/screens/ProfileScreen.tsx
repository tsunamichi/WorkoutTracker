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
import { addFakeHistory } from '../utils/addFakeHistory';
import { debugStorageContents, backupAllData } from '../utils/debugStorage';
import { cloudBackupService } from '../services/cloudBackup';
import { migrateOldStorageKeys, scanForOldData } from '../utils/dataMigration';

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
  const { settings, updateSettings, clearAllHistory, initialize } = useStore();
  const [showRestTimePicker, setShowRestTimePicker] = useState(false);
  const [notificationsSystemEnabled, setNotificationsSystemEnabled] = useState<boolean | null>(null);
  const [cloudBackupInfo, setCloudBackupInfo] = useState<{ exists: boolean; timestamp?: string } | null>(null);
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

        {/* Group 3: Design System - Standalone */}
        <TouchableOpacity 
          style={[styles.settingCard, styles.settingCardRow]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate('DesignSystem');
          }}
          activeOpacity={0.7}
        >
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>{t('designSystem')}</Text>
            <Text style={styles.settingDescription}>
              {t('viewDesignSystem')}
            </Text>
          </View>
          <IconTriangle size={16} color={COLORS.text} />
        </TouchableOpacity>
        
        {/* Group 4: Add Fake History - Dev Only */}
        {__DEV__ && (
          <TouchableOpacity 
            style={[styles.settingCard, styles.settingCardRow]}
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              try {
                await addFakeHistory();
                Alert.alert(
                  'Success!',
                  'Added fake workout history for testing. Check the exercise detail screens to see the history.',
                  [{ text: 'OK' }]
                );
              } catch (error) {
                Alert.alert('Error', 'Failed to add fake history. Check console for details.');
                console.error('Error adding fake history:', error);
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Add Fake History (Dev)</Text>
              <Text style={styles.settingDescription}>
                Adds test workout data for the past 3 weeks
              </Text>
            </View>
            <IconTriangle size={16} color={COLORS.text} />
          </TouchableOpacity>
        )}

        {/* iCloud Backup Section */}
        <TouchableOpacity 
          style={[styles.settingCard, styles.settingCardRow]}
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
            <Text style={styles.settingLabel}>
              ☁️ iCloud Backup Status
            </Text>
            <Text style={styles.settingDescription}>
              {cloudBackupInfo?.exists 
                ? `Last backup: ${cloudBackupInfo.timestamp ? new Date(cloudBackupInfo.timestamp).toLocaleDateString() : 'Unknown'}`
                : 'Automatic backup enabled'}
            </Text>
          </View>
          <IconTriangle size={16} color={COLORS.text} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.settingCard, styles.settingCardRow]}
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
            <Text style={styles.settingLabel}>☁️ Backup Now</Text>
            <Text style={styles.settingDescription}>
              Manually create an iCloud backup
            </Text>
          </View>
          <IconTriangle size={16} color={COLORS.text} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.settingCard, styles.settingCardRow]}
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
            <Text style={styles.settingLabel}>☁️ Restore from iCloud</Text>
            <Text style={styles.settingDescription}>
              Restore data from iCloud backup
            </Text>
          </View>
          <IconTriangle size={16} color={COLORS.text} />
        </TouchableOpacity>

        {/* Data Recovery - Migration from old versions */}
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
                      // First scan for old data
                      const scanResult = await scanForOldData();
                      console.log('Scan result:', scanResult);
                      
                      // Show ALL keys found
                      const keysList = scanResult.potentialOldKeys
                        .map(k => `- ${k.key}: ${k.preview}`)
                        .join('\n');
                      
                      const sessionsText = scanResult.sessionsInfo
                        ? `\n🎯 SESSIONS FOUND!\nKey: ${scanResult.sessionsInfo.key}\nCount: ${scanResult.sessionsInfo.count} workouts\n\n`
                        : '\n❌ No sessions data found\n\n';
                      
                      Alert.alert(
                        'Storage Scan Results',
                        `Total keys: ${scanResult.potentialOldKeys.length}\n${sessionsText}All keys:\n${keysList.substring(0, 500)}`,
                        [{ text: 'OK' }]
                      );
                    } catch (error) {
                      Alert.alert(
                        'Error',
                        `Failed to scan for old data: ${error}`,
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
              Migrate workout data from older app versions
            </Text>
          </View>
          <IconTriangle size={16} color={COLORS.text} />
        </TouchableOpacity>

        {/* Debug Storage - Available in all builds for data recovery */}
        <>
          <TouchableOpacity
              style={[styles.settingCard, styles.settingCardRow]}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const result = await debugStorageContents();
                if (result) {
                  // Get more detailed info from the result
                  const store = useStore.getState();
                  
                  const storageInfo = `📦 STORAGE (${result.allKeys.length} keys):\n` +
                    `- Sessions: ${result.sessionsCount}\n` +
                    `- Templates: ${result.templatesCount}\n` +
                    `- Plans: ${result.plansCount}\n` +
                    `- Progress: ${result.progressCount} workouts\n\n`;
                  
                  const appInfo = `📱 APP STATE:\n` +
                    `- Sessions: ${store.sessions?.length || 0}\n` +
                    `- Templates: ${store.workoutTemplates?.length || 0}\n` +
                    `- Plans: ${store.cyclePlans?.length || 0}\n` +
                    `- Scheduled: ${store.scheduledWorkouts?.length || 0}\n\n`;
                  
                  const keysList = `🔑 KEYS:\n${result.allKeys.map(k => {
                    const shortKey = k.replace('@workout_tracker_', '');
                    const info = result.keySummary[k];
                    if (info?.type === 'array') {
                      return `- ${shortKey}: ${info.count} items`;
                    } else if (info?.type === 'object') {
                      return `- ${shortKey}: ${info.keys} keys`;
                    }
                    return `- ${shortKey}`;
                  }).join('\n')}`;
                  
                  Alert.alert(
                    'Storage Debug Info',
                    storageInfo + appInfo + keysList,
                    [{ text: 'OK' }]
                  );
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>🔍 Check Storage</Text>
                <Text style={styles.settingDescription}>
                  See what data is in storage (check console)
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingCard, styles.settingCardRow]}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const backup = await backupAllData();
                if (backup) {
                  Alert.alert(
                    'Backup Created',
                    'Full backup logged to console. Copy the JSON data if needed.',
                    [{ text: 'OK' }]
                  );
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>💾 Backup Data</Text>
                <Text style={styles.settingDescription}>
                  Export all data to console
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingCard, styles.settingCardRow]}
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
                <Text style={styles.settingLabel}>🔄 Force Reload Data</Text>
                <Text style={styles.settingDescription}>
                  Reload all data from storage
                </Text>
              </View>
            </TouchableOpacity>
          </>
        
        {/* Dev Only: Clear All Data */}
        {__DEV__ && (
          <TouchableOpacity 
            style={[styles.settingCard, styles.settingCardRow]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert(
                'Clear All Data',
                'This will delete all workouts, templates, plans, and scheduled workouts. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Clear All', 
                    style: 'destructive',
                    onPress: async () => {
                      await clearAllHistory();
                      Alert.alert('Done', 'All data has been cleared!');
                    }
                  }
                ]
              );
            }}
            activeOpacity={0.7}
          >
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: COLORS.signalNegative }]}>Clear All Data (Dev)</Text>
              <Text style={styles.settingDescription}>
                Delete all workouts and templates
              </Text>
            </View>
          </TouchableOpacity>
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
