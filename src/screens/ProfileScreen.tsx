import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, TextInput, Modal, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconArrowLeft, IconAdd, IconMenu, IconCheck, IconEdit } from '../components/icons';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { TimerValueSheet } from '../components/timer/TimerValueSheet';
import dayjs from 'dayjs';
import { formatWeight, fromDisplayWeight } from '../utils/weight';
import { BottomDrawer } from '../components/common/BottomDrawer';
import { useTranslation } from '../i18n/useTranslation';

// Optional local notifications (expo-notifications). If not installed, toggle is disabled.
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.log('⚠️ expo-notifications not installed, notifications toggle disabled');
}

// Optional media picker (expo-image-picker). If not installed, avatar upload is disabled.
let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  console.log('⚠️ expo-image-picker not installed, avatar upload disabled');
}

interface ProfileScreenProps {
  navigation: any;
  route?: {
    params?: {
      mode?: 'settings';
    };
  };
}

const LIGHT_COLORS = {
  secondary: '#1B1B1B',
  textMeta: '#817B77',
};

export function ProfileScreen({ navigation, route }: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const {
    settings,
    updateSettings,
    bodyWeightEntries,
    addBodyWeightEntry,
    sessions,
    clearAllHistory,
    cycles,
    workoutAssignments,
    getWorkoutCompletionPercentage,
    getExerciseProgress,
  } = useStore();
  const isSettingsMode = route?.params?.mode === 'settings';
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [showRestTimePicker, setShowRestTimePicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [notificationsSystemEnabled, setNotificationsSystemEnabled] = useState<boolean | null>(null);
  const { t, language } = useTranslation();
  const languageLabel = language === 'es' ? t('spanish') : t('english');
  const notificationsEnabled = settings.notificationsEnabled !== false;

  const handlePickAvatar = async () => {
    if (!ImagePicker) {
      Alert.alert(t('notificationPermissionTitle'), t('imagePickerUnavailable'));
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          t('photoLibraryPermissionTitle'),
          t('photoLibraryPermissionBody'),
          [
            { text: t('notNow'), style: 'cancel' },
            {
              text: t('openSettings'),
              onPress: () => Linking.openSettings().catch(() => {}),
            },
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        await updateSettings({ profileAvatarUri: result.assets[0].uri });
      }
    } catch (error) {
      console.log('⚠️ Failed to pick avatar:', error instanceof Error ? error.message : error);
    }
  };

  const handleToggleNotifications = async (value: boolean) => {
    if (!value) {
      await updateSettings({
        notificationsEnabled: false,
        notificationsPermissionPrompted: true,
      });
      return;
    }

    if (!Notifications) {
      Alert.alert(t('notificationPermissionTitle'), t('notificationUnavailable'));
      return;
    }

    try {
      const permission = await Notifications.getPermissionsAsync();
      const hasPermission = permission.granted || permission.ios?.status === 2;
      if (hasPermission) {
        await updateSettings({
          notificationsEnabled: true,
          notificationsPermissionPrompted: true,
        });
        return;
      }

      const requested = await Notifications.requestPermissionsAsync();
      const granted = requested.granted || requested.ios?.status === 2;
      await updateSettings({
        notificationsEnabled: granted,
        notificationsPermissionPrompted: true,
      });

      if (!granted) {
        Alert.alert(
          t('notificationPermissionTitle'),
          t('notificationPermissionBody'),
          [
            { text: t('notNow'), style: 'cancel' },
            {
              text: t('openSettings'),
              onPress: () => {
                Linking.openSettings().catch(() => {});
              },
            },
          ]
        );
      }
    } catch (error) {
      console.log('⚠️ Failed to request notification permissions:', error instanceof Error ? error.message : error);
    }
  };

  React.useEffect(() => {
    if (!Notifications) {
      setNotificationsSystemEnabled(false);
      return;
    }

    let isMounted = true;
    Notifications.getPermissionsAsync()
      .then((permission: any) => {
        if (!isMounted) return;
        const enabled = permission.granted || permission.ios?.status === 2;
        setNotificationsSystemEnabled(enabled);
      })
      .catch(() => {
        if (!isMounted) return;
        setNotificationsSystemEnabled(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isSettingsMode]);
  
  const handleAddWeight = async () => {
    if (newWeight.trim()) {
      const displayWeight = parseFloat(newWeight);
      if (Number.isNaN(displayWeight)) {
        return;
      }
      const entry = {
        id: Date.now().toString(),
        date: dayjs().format('YYYY-MM-DD'),
        weight: fromDisplayWeight(displayWeight, settings.useKg),
        unit: 'lb' as const,
      };
      await addBodyWeightEntry(entry);
      setNewWeight('');
      setShowAddWeight(false);
    }
  };

  const sortedWeightEntries = React.useMemo(
    () => [...bodyWeightEntries].sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf()),
    [bodyWeightEntries]
  );
  const recentWeightEntries = sortedWeightEntries.slice(0, 3);
  const weightDeltas = React.useMemo(() => {
    const deltas = new Map<string, number | null>();
    sortedWeightEntries.forEach((entry, index) => {
      const previous = sortedWeightEntries[index + 1];
      deltas.set(entry.id, previous ? entry.weight - previous.weight : null);
    });
    return deltas;
  }, [sortedWeightEntries]);
  
  // Calculate workout stats
  const totalWorkouts = React.useMemo(() => {
    let completed = 0;
    workoutAssignments.forEach(assignment => {
      const cycle = cycles.find(c => c.id === assignment.cycleId);
      const workout = cycle?.workoutTemplates.find(w => w.id === assignment.workoutTemplateId);
      if (!workout) return;

      const workoutKey = `${workout.id}-${assignment.date}`;
      let totalSets = 0;
      workout.exercises.forEach(exercise => {
        const progress = getExerciseProgress(workoutKey, exercise.id);
        if (!progress?.skipped) {
          totalSets += exercise.targetSets || 0;
        }
      });

      const completionPercentage = getWorkoutCompletionPercentage(workoutKey, totalSets);
      if (completionPercentage === 100) {
        completed += 1;
      }
    });

    return completed;
  }, [workoutAssignments, cycles, getExerciseProgress, getWorkoutCompletionPercentage]);

  const currentStreak = React.useMemo(() => {
    const completedDates = new Set<string>();
    workoutAssignments.forEach(assignment => {
      const cycle = cycles.find(c => c.id === assignment.cycleId);
      const workout = cycle?.workoutTemplates.find(w => w.id === assignment.workoutTemplateId);
      if (!workout) return;

      const workoutKey = `${workout.id}-${assignment.date}`;
      let totalSets = 0;
      workout.exercises.forEach(exercise => {
        const progress = getExerciseProgress(workoutKey, exercise.id);
        if (!progress?.skipped) {
          totalSets += exercise.targetSets || 0;
        }
      });

      if (getWorkoutCompletionPercentage(workoutKey, totalSets) === 100) {
        completedDates.add(assignment.date);
      }
    });

    if (completedDates.size === 0) {
      return 0;
    }

    let cursor = dayjs().startOf('day');
    if (!completedDates.has(cursor.format('YYYY-MM-DD'))) {
      cursor = cursor.subtract(1, 'day');
    }

    let streak = 0;
    while (completedDates.has(cursor.format('YYYY-MM-DD'))) {
      streak += 1;
      cursor = cursor.subtract(1, 'day');
    }

    return streak;
  }, [workoutAssignments, cycles, getExerciseProgress, getWorkoutCompletionPercentage]);
  
  return (
    <View style={styles.gradient}>
      <View style={styles.container}>
        {/* Header (includes topBar with back button + title) */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          {/* Back Button */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => {
                if (isSettingsMode) {
                  navigation.setParams({ mode: undefined });
                } else {
                  navigation.goBack();
                }
              }}
              style={styles.backButton}
            >
              <IconArrowLeft size={24} color="#000000" />
            </TouchableOpacity>
            {!isSettingsMode && (
              <TouchableOpacity
                onPress={() => navigation.navigate('Profile', { mode: 'settings' })}
                style={styles.menuButton}
              >
                <IconMenu size={24} color="#000000" />
              </TouchableOpacity>
            )}
          </View>
            
          {/* Title */}
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.titleContainer}>
                {isSettingsMode && (
                  <Text style={styles.headerTitle}>
                    {t('settings')}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>
        
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} bounces={false}>
          {!isSettingsMode ? (
            /* Progress Tab */
            <>
              <View style={styles.avatarContainer}>
                <View style={styles.avatarWrapper}>
                  <ProfileAvatar
                    size={96}
                    onPress={handlePickAvatar}
                    imageUri={settings.profileAvatarUri || null}
                  />
                  <TouchableOpacity
                    style={styles.avatarEditButton}
                    onPress={handlePickAvatar}
                    activeOpacity={1}
                  >
                    <IconEdit size={16} color={COLORS.text} />
                  </TouchableOpacity>
                </View>
              </View>
              {/* Workout Stats */}
              <View style={styles.section}>
                <View style={styles.statsGrid}>
                  <View style={styles.statBlock}>
                          <Text style={styles.statValue}>{totalWorkouts}</Text>
                    <Text style={styles.statLabel}>{t('totalWorkouts')}</Text>
                        </View>
                  <View style={styles.statBlock}>
                    <Text style={styles.statValue}>{currentStreak}</Text>
                    <Text style={styles.statLabel}>{t('currentStreak')}</Text>
                  </View>
                </View>
              </View>
              
              {/* Body Weight */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('bodyWeight')}</Text>
                  {bodyWeightEntries.length > 3 && (
                    <TouchableOpacity
                      onPress={() => navigation.navigate('BodyWeightHistory')}
                      activeOpacity={1}
                    >
                      <Text style={styles.viewAllText}>{t('viewAll')}</Text>
                  </TouchableOpacity>
                  )}
                </View>
                
                {recentWeightEntries.length > 0 && (
                  <View style={styles.weightCard}>
                    {recentWeightEntries.map((entry) => (
                      <View key={entry.id} style={styles.weightRow}>
                                <Text style={styles.weightDate}>
                                  {dayjs(entry.date).format('MMM D, YYYY')}
                                </Text>
                        <View style={styles.weightValueRow}>
                          {(() => {
                            const delta = weightDeltas.get(entry.id);
                            if (delta == null || delta === 0) {
                              return (
                                <Text style={[styles.weightDelta, styles.weightDeltaNeutral]}>
                                  —
                                </Text>
                              );
                            }
                            const direction = delta > 0 ? 'up' : 'down';
                            const arrow = delta > 0 ? '↑' : '↓';
                            const deltaValue = formatWeight(Math.abs(delta), settings.useKg);
                            return (
                              <Text
                                style={[
                                  styles.weightDelta,
                                  direction === 'up' ? styles.weightDeltaUp : styles.weightDeltaDown,
                                ]}
                              >
                                {arrow} {deltaValue}
                              </Text>
                            );
                          })()}
                                <Text style={styles.weightValue}>
                            {formatWeight(entry.weight, settings.useKg)}
                                </Text>
                          <Text style={styles.weightUnit}>{settings.useKg ? 'kg' : 'lb'}</Text>
                          </View>
                        </View>
                      ))}
                  </View>
                )}
                <TouchableOpacity
                  style={[
                    styles.addWeightButton,
                    recentWeightEntries.length === 0
                      ? styles.addWeightButtonDashed
                      : styles.addWeightButtonSolid,
                  ]}
                  onPress={() => setShowAddWeight(true)}
                  activeOpacity={1}
                >
                  <IconAdd size={20} color={COLORS.text} />
                  <Text style={styles.addWeightButtonText}>{t('addWeightEntry')}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            /* Settings Tab */
            <View style={styles.settingsList}>
              {/* Use Kilograms */}
              <View style={styles.settingsListItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>{t('useKilograms')}</Text>
                  <Text style={styles.settingDescription}>
                    {settings.useKg ? t('weightsShownInKg') : t('weightsShownInLb')}
                  </Text>
                </View>
                <Switch
                  value={settings.useKg}
                  onValueChange={(value) => updateSettings({ useKg: value })}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={styles.settingsDivider} />
              
              {/* Default Rest Time */}
              <TouchableOpacity 
                style={styles.settingsListItem}
                onPress={() => setShowRestTimePicker(true)}
                activeOpacity={1}
              >
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>{t('defaultRestTime')}</Text>
                  <Text style={styles.settingDescription}>
                    {Math.floor(settings.restTimerDefaultSeconds / 60)}:{(settings.restTimerDefaultSeconds % 60).toString().padStart(2, '0')} {t('betweenSets')}
                  </Text>
                </View>
                <View style={styles.settingChevron}>
                  <Text style={styles.chevronText}>›</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.settingsDivider} />

              {/* Language */}
              <TouchableOpacity 
                style={styles.settingsListItem}
                onPress={() => setShowLanguagePicker(true)}
                activeOpacity={1}
              >
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>{t('language')}</Text>
                  <Text style={styles.settingDescription}>{languageLabel}</Text>
                </View>
                <View style={styles.settingChevron}>
                  <Text style={styles.chevronText}>›</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.settingsDivider} />
              
              {/* Monthly Progress Check */}
              <View style={styles.settingsListItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>{t('monthlyProgressCheck')}</Text>
                  <Text style={styles.settingDescription}>
                    {t('monthlyProgressReminder').replace('{day}', String(settings.monthlyProgressReminderDay))}
                  </Text>
                </View>
                <Switch
                  value={settings.monthlyProgressReminderEnabled}
                  onValueChange={(value) => updateSettings({ monthlyProgressReminderEnabled: value })}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={styles.settingsDivider} />

              {/* Timer Notifications */}
              <View style={styles.settingsListItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>{t('timerNotifications')}</Text>
                  <Text style={styles.settingDescription}>
                    {notificationsSystemEnabled === false
                      ? t('notificationSystemDisabled')
                      : t('timerNotificationsDescription')}
                  </Text>
                </View>
                <Switch
                  value={notificationsEnabled && notificationsSystemEnabled !== false}
                  onValueChange={handleToggleNotifications}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={styles.settingsDivider} />
              
              {/* Design System */}
              <TouchableOpacity 
                style={styles.settingsListItem}
                onPress={() => navigation.navigate('DesignSystem')}
                activeOpacity={1}
              >
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>{t('designSystem')}</Text>
                  <Text style={styles.settingDescription}>
                    {t('viewDesignSystem')}
                  </Text>
                </View>
                <View style={styles.settingChevron}>
                  <Text style={styles.chevronText}>›</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.settingsDivider} />
              
              {/* Clear All History */}
              <TouchableOpacity 
                style={styles.settingsListItem}
                onPress={() => {
                  Alert.alert(
                    'Clear All History',
                    'This will delete all workout history, sessions, and progress records. This cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Clear All', 
                        style: 'destructive',
                        onPress: async () => {
                          await clearAllHistory();
                          Alert.alert(t('historyClearedTitle'), t('historyClearedMessage'));
                        }
                      }
                    ]
                  );
                }}
                activeOpacity={1}
              >
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: COLORS.signalNegative }]}>
                    {t('clearAllHistory')}
                  </Text>
                  <Text style={styles.settingDescription}>
                    {t('clearAllHistoryDescription')}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingsListItem}
                onPress={() => {
                  Alert.alert(
                    'Reset Onboarding',
                    'This will reset the app to the welcome screen. You can test the onboarding flow again.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Reset', 
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await AsyncStorage.multiRemove(['@app/onboardingState', '@app/cycles']);
                            Alert.alert(
                              'Onboarding Reset',
                              'Please reload the app to see the welcome screen.',
                              [{ text: 'OK' }]
                            );
                          } catch (error) {
                            console.error('Failed to reset onboarding:', error);
                            Alert.alert(t('alertErrorTitle'), t('resetOnboardingFailed'));
                          }
                        }
                      }
                    ]
                  );
                }}
                activeOpacity={1}
              >
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: COLORS.signalWarning }]}>
                    {t('resetOnboarding')}
                  </Text>
                  <Text style={styles.settingDescription}>
                    {t('resetOnboardingDescription')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
        
        {/* Add Weight Modal */}
        <Modal visible={showAddWeight} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>{t('addWeightEntry')}</Text>
              <TextInput
                style={styles.weightInput}
                placeholder={t('weightPlaceholder').replace('{unit}', settings.useKg ? 'kg' : 'lb')}
                placeholderTextColor={COLORS.textMeta}
                keyboardType="decimal-pad"
                value={newWeight}
                onChangeText={setNewWeight}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={() => {
                    setShowAddWeight(false);
                    setNewWeight('');
                  }}
                >
                  <Text style={styles.modalButtonSecondaryText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={handleAddWeight}
                >
                  <Text style={styles.modalButtonPrimaryText}>{t('add')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        
        {/* Rest Time Picker Drawer */}
        <TimerValueSheet
          visible={showRestTimePicker}
          onClose={() => setShowRestTimePicker(false)}
          onSave={(value) => updateSettings({ restTimerDefaultSeconds: value })}
          title="Rest time"
          label=""
          value={settings.restTimerDefaultSeconds}
          min={30}
          max={300}
          step={30}
          formatValue={(val) => {
            const minutes = Math.floor(val / 60);
            const seconds = val % 60;
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
          }}
        />

        <BottomDrawer
          visible={showLanguagePicker}
          onClose={() => setShowLanguagePicker(false)}
          maxHeight="40%"
          showHandle={false}
          scrollable={false}
          contentStyle={styles.languageDrawerContent}
        >
          <View style={styles.languageDrawerHeader}>
            <Text style={styles.languageDrawerTitle}>{t('language')}</Text>
          </View>
          <View style={styles.languageOptions}>
            {[
              { key: 'en' as const, label: t('english') },
              { key: 'es' as const, label: t('spanish') },
            ].map(option => {
              const isSelected = (settings.language || 'en') === option.key;
                  return (
                    <TouchableOpacity
                  key={option.key}
                  style={styles.languageOption}
                      onPress={() => {
                    updateSettings({ language: option.key });
                    setShowLanguagePicker(false);
                      }}
                      activeOpacity={1}
                    >
                  <Text style={styles.languageOptionText}>{option.label}</Text>
                  {isSelected && <IconCheck size={20} color={COLORS.text} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
        </BottomDrawer>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -4,
  },
  menuButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginRight: -4,
  },
  header: {
    paddingBottom: SPACING.md,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  titleContainer: {
    gap: 4,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
    marginLeft: 0,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  section: {
    marginBottom: 56,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md - 8,
  },
  viewAllText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.text,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarEditButton: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.activeCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addWeightButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: SPACING.md,
  },
  addWeightButtonDashed: {
    borderColor: COLORS.text,
    borderStyle: 'dashed',
  },
  addWeightButtonSolid: {
    borderWidth: 0,
  },
  addWeightButtonText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.text,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    width: '100%',
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...TYPOGRAPHY.h1,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.secondary,
    textAlign: 'center',
  },
  weightCard: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: SPACING.lg,
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weightValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  weightDate: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  weightValue: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  weightUnit: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textMeta,
  },
  weightDelta: {
    ...TYPOGRAPHY.meta,
  },
  weightDeltaUp: {
    color: COLORS.signalNegative,
  },
  weightDeltaDown: {
    color: COLORS.signalPositive,
  },
  weightDeltaNeutral: {
    color: COLORS.textMeta,
  },
  settingRow: {
    backgroundColor: COLORS.activeCard,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  settingRowInner: {
    backgroundColor: COLORS.activeCard,
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: SPACING.lg,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.75)',
    borderLeftColor: 'rgba(255, 255, 255, 0.75)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  settingLabel: {
    ...TYPOGRAPHY.bodyBold,
    color: LIGHT_COLORS.secondary,
    marginBottom: 4,
  },
  settingDescription: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.secondary,
  },
  settingChevron: {
    marginLeft: SPACING.sm,
  },
  chevronText: {
    fontSize: 24,
    color: LIGHT_COLORS.secondary,
    fontWeight: '300',
  },
  settingsList: {
    marginTop: SPACING.md,
  },
  settingsListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: COLORS.borderDimmed,
  },
  languageDrawerContent: {
    paddingBottom: SPACING.xl,
  },
  languageDrawerHeader: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDimmed,
  },
  languageDrawerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  languageOptions: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    gap: SPACING.md,
  },
  languageOption: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  languageOptionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modal: {
    backgroundColor: COLORS.canvas,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  weightInput: {
    backgroundColor: COLORS.backgroundCanvas,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: COLORS.primary,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: COLORS.accentPrimaryLight,
    borderLeftColor: COLORS.accentPrimaryLight,
    borderBottomColor: COLORS.accentPrimaryDark,
    borderRightColor: COLORS.accentPrimaryDark,
  },
  modalButtonPrimaryText: {
    ...TYPOGRAPHY.button,
    color: LIGHT_COLORS.secondary,
  },
  modalButtonSecondary: {
    backgroundColor: COLORS.backgroundCanvas,
  },
  modalButtonSecondaryText: {
    ...TYPOGRAPHY.button,
    color: LIGHT_COLORS.secondary,
  },
});


