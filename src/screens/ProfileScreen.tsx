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
  const { settings, updateSettings, clearAllHistory } = useStore();
  const [showRestTimePicker, setShowRestTimePicker] = useState(false);
  const [notificationsSystemEnabled, setNotificationsSystemEnabled] = useState<boolean | null>(null);
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
        
        {/* Group 4: Add Fake History - Standalone (Dev Tool) */}
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
            <Text style={styles.settingLabel}>Add Fake History</Text>
            <Text style={styles.settingDescription}>
              Adds test workout data for the past 3 weeks
            </Text>
          </View>
          <IconTriangle size={16} color={COLORS.text} />
        </TouchableOpacity>

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
