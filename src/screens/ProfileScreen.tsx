import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, TextInput, Alert, Linking, Image, Dimensions } from 'react-native';
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
import isoWeek from 'dayjs/plugin/isoWeek';
import * as ImagePicker from 'expo-image-picker';

dayjs.extend(isoWeek);

// Optional local notifications (expo-notifications). If not installed, toggle is disabled.
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.log('⚠️ expo-notifications not installed, notifications toggle disabled');
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

const SCREEN_WIDTH = Dimensions.get('window').width;

export function ProfileScreen({ navigation, route }: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const {
    settings,
    updateSettings,
    progressLogs,
    addProgressLog,
    sessions,
    clearAllHistory,
    cycles,
    workoutAssignments,
    getWorkoutCompletionPercentage,
    getExerciseProgress,
  } = useStore();
  const isSettingsMode = route?.params?.mode === 'settings';
  const [showWeeklyCheckIn, setShowWeeklyCheckIn] = useState(false);
  const [checkInPhotoUri, setCheckInPhotoUri] = useState<string | null>(null);
  const [checkInWeight, setCheckInWeight] = useState('');
  const [isSavingCheckIn, setIsSavingCheckIn] = useState(false);
  const [showRestTimePicker, setShowRestTimePicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [notificationsSystemEnabled, setNotificationsSystemEnabled] = useState<boolean | null>(null);
  const { t, language } = useTranslation();
  const languageLabel = language === 'es' ? t('spanish') : t('english');
  const notificationsEnabled = settings.notificationsEnabled !== false;

  const today = dayjs();
  const currentWeekKey = `${today.isoWeekYear()}-W${String(today.isoWeek()).padStart(2, '0')}`;
  const isFriday = today.isoWeekday() === 5;
  const hasLoggedThisWeek = progressLogs.some(l => l.weekKey === currentWeekKey);
  // Dev-only override: allow logging any day for testing.
  const canLogToday = (__DEV__ || isFriday) && !hasLoggedThisWeek;

  const openWeeklyCheckIn = () => {
    if (!canLogToday) return;
    setShowWeeklyCheckIn(true);
  };

  const handlePickCheckInPhoto = async (mode: 'camera' | 'library') => {
    if (!ImagePicker) return;
    try {
      if (mode === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(t('photoLibraryPermissionTitle'), t('photoLibraryPermissionBody'));
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 1,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
          setCheckInPhotoUri(result.assets[0].uri);
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(t('photoLibraryPermissionTitle'), t('photoLibraryPermissionBody'));
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 1,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
          setCheckInPhotoUri(result.assets[0].uri);
        }
      }
    } catch (error) {
      Alert.alert(t('alertErrorTitle'), t('failedToPickImage'));
    }
  };

  const handleSaveWeeklyCheckIn = async () => {
    const displayWeight = parseFloat(checkInWeight);
    if (!checkInPhotoUri) {
      Alert.alert(t('alertErrorTitle'), t('progressPhotoRequired'));
      return;
    }
    if (!Number.isFinite(displayWeight) || displayWeight <= 0) {
      Alert.alert(t('alertErrorTitle'), t('progressWeightRequired'));
      return;
    }

    setIsSavingCheckIn(true);
    const weightLbs = fromDisplayWeight(displayWeight, settings.useKg);
    const result = await addProgressLog({ photoUri: checkInPhotoUri, weightLbs });
    setIsSavingCheckIn(false);

    if (!result.success) {
      if (result.error === 'already_logged') {
        Alert.alert(t('alertErrorTitle'), t('progressAlreadyLoggedThisWeek'));
      } else if (result.error === 'not_friday') {
        Alert.alert(t('alertErrorTitle'), t('progressOnlyAvailableFriday'));
      } else {
        Alert.alert(t('alertErrorTitle'), t('failedToSaveProgress'));
      }
      return;
    }

    setShowWeeklyCheckIn(false);
    setCheckInPhotoUri(null);
    setCheckInWeight('');
  };

  const handlePickAvatar = async () => {
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

    const hasNotificationsApi =
      !!Notifications &&
      typeof Notifications.getPermissionsAsync === 'function' &&
      typeof Notifications.requestPermissionsAsync === 'function';

    if (!hasNotificationsApi) {
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
    const hasNotificationsApi =
      !!Notifications &&
      typeof Notifications.getPermissionsAsync === 'function' &&
      typeof Notifications.requestPermissionsAsync === 'function';

    if (!hasNotificationsApi) {
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
  
  const sortedProgressLogs = useMemo(
    () => [...progressLogs].sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf()),
    [progressLogs]
  );
  
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
              
              {/* Progress */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('progress')}</Text>
                  {canLogToday ? (
                    <TouchableOpacity onPress={openWeeklyCheckIn} activeOpacity={1} style={styles.progressActionButton}>
                      <IconAdd size={18} color={COLORS.text} />
                      <Text style={styles.progressActionText}>{t('add')}</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.progressActionButton, styles.progressActionButtonDisabled]}>
                      <Text style={[styles.progressActionText, styles.progressActionTextDisabled]}>{t('nextLogOnFriday')}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.progressHelperText}>
                  {canLogToday ? t('progressHelperAvailable') : t('progressHelperLocked')}
                </Text>

                {sortedProgressLogs.length === 0 ? (
                  <View style={styles.progressEmptyState}>
                    <Text style={styles.progressEmptyTitle}>{t('noProgressYet')}</Text>
                    <Text style={styles.progressEmptySubtitle}>
                      {canLogToday ? t('progressEmptyCtaAvailable') : t('progressEmptyCtaLocked')}
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.progressGrid}>
                      {sortedProgressLogs.slice(0, 6).map((log, index) => {
                        const gap = SPACING.xs;
                        const horizontalPadding = SPACING.xxl;
                        const tileSize = (SCREEN_WIDTH - horizontalPadding * 2 - gap * 2) / 3;
                        const isEndOfRow = index % 3 === 2;
                        return (
                          <TouchableOpacity
                            key={log.id}
                            activeOpacity={0.9}
                            onPress={() => navigation.navigate('ProgressLogDetail', { progressLogId: log.id })}
                            style={[
                              styles.progressTile,
                              {
                                width: tileSize,
                                height: tileSize,
                                marginRight: isEndOfRow ? 0 : gap,
                                marginBottom: gap,
                              },
                            ]}
                          >
                            <Image source={{ uri: log.photoUri }} style={styles.progressTileImage} />
                            <View style={styles.progressTileOverlay}>
                              <Text style={styles.progressTileWeight}>
                                {formatWeight(log.weightLbs, settings.useKg)} {settings.useKg ? 'kg' : 'lb'}
                              </Text>
                              <Text style={styles.progressTileDate}>{log.dateLabel}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {sortedProgressLogs.length > 6 && (
                      <TouchableOpacity
                        style={styles.progressSeeAllButton}
                        onPress={() => navigation.navigate('ProgressGallery')}
                        activeOpacity={1}
                      >
                        <Text style={styles.viewAllText}>{t('seeAllProgress')}</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
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

        {/* Weekly Check-in Drawer */}
        <BottomDrawer visible={showWeeklyCheckIn} onClose={() => setShowWeeklyCheckIn(false)}>
          <View style={styles.checkInSheet}>
            <View style={styles.checkInHeader}>
              <Text style={styles.checkInTitle}>{t('weeklyCheckIn')}</Text>
              <Text style={styles.checkInSubtitle}>
                {t('weeklyCheckInSubtitle').replace('{unit}', settings.useKg ? 'kg' : 'lb')}
              </Text>
            </View>

            <View style={styles.checkInPhotoRow}>
              <View style={styles.checkInPhotoPreview}>
                {checkInPhotoUri ? (
                  <Image source={{ uri: checkInPhotoUri }} style={styles.checkInPhotoImage} />
                ) : (
                  <Text style={styles.checkInPhotoPlaceholder}>{t('progressPhoto')}</Text>
                )}
              </View>
              <View style={styles.checkInPhotoActions}>
                <TouchableOpacity
                  style={styles.checkInPhotoButton}
                  onPress={() => handlePickCheckInPhoto('camera')}
                  activeOpacity={1}
                >
                  <Text style={styles.checkInPhotoButtonText}>{t('takePhoto')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.checkInPhotoButton}
                  onPress={() => handlePickCheckInPhoto('library')}
                  activeOpacity={1}
                >
                  <Text style={styles.checkInPhotoButtonText}>{t('chooseFromLibrary')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.checkInField}>
              <Text style={styles.checkInFieldLabel}>{t('weight')}</Text>
              <TextInput
                style={styles.checkInWeightInput}
                placeholder={t('weightPlaceholder').replace('{unit}', settings.useKg ? 'kg' : 'lb')}
                placeholderTextColor={COLORS.textMeta}
                keyboardType="decimal-pad"
                value={checkInWeight}
                onChangeText={setCheckInWeight}
              />
            </View>

            <TouchableOpacity
              style={[styles.checkInSaveButton, isSavingCheckIn && styles.checkInSaveButtonDisabled]}
              onPress={handleSaveWeeklyCheckIn}
              activeOpacity={0.9}
              disabled={isSavingCheckIn}
            >
              <Text style={styles.checkInSaveButtonText}>{t('save')}</Text>
            </TouchableOpacity>
          </View>
        </BottomDrawer>
        
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
  progressActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.activeCard,
  },
  progressActionButtonDisabled: {
    backgroundColor: 'transparent',
  },
  progressActionText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.text,
  },
  progressActionTextDisabled: {
    color: COLORS.textMeta,
  },
  progressHelperText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: SPACING.md,
  },
  progressEmptyState: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.activeCard,
  },
  progressEmptyTitle: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.secondary,
    marginBottom: 4,
  },
  progressEmptySubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  progressGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  progressTile: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.activeCard,
  },
  progressTileImage: {
    width: '100%',
    height: '100%',
  },
  progressTileOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  progressTileWeight: {
    ...TYPOGRAPHY.meta,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  progressTileDate: {
    ...TYPOGRAPHY.meta,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  progressSeeAllButton: {
    marginTop: SPACING.md,
    alignSelf: 'flex-start',
  },
  checkInSheet: {
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xxl,
    gap: SPACING.lg,
  },
  checkInHeader: {
    gap: 6,
  },
  checkInTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
  },
  checkInSubtitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  checkInPhotoRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'center',
  },
  checkInPhotoPreview: {
    width: 96,
    height: 96,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.activeCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInPhotoImage: {
    width: '100%',
    height: '100%',
  },
  checkInPhotoPlaceholder: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    textAlign: 'center',
  },
  checkInPhotoActions: {
    flex: 1,
    gap: SPACING.sm,
  },
  checkInPhotoButton: {
    height: 44,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.activeCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInPhotoButtonText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.text,
    fontWeight: '600',
  },
  checkInField: {
    gap: 8,
  },
  checkInFieldLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  checkInWeightInput: {
    height: 52,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    color: COLORS.text,
    backgroundColor: COLORS.activeCard,
    ...TYPOGRAPHY.body,
  },
  checkInSaveButton: {
    height: 52,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: LIGHT_COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInSaveButtonDisabled: {
    opacity: 0.6,
  },
  checkInSaveButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.backgroundCanvas,
    fontWeight: '700',
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


