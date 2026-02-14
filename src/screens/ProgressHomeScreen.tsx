import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconAdd, IconSettings } from '../components/icons';
import dayjs from 'dayjs';
import { formatWeight, fromDisplayWeight } from '../utils/weight';
import { BottomDrawer } from '../components/common/BottomDrawer';
import { DiagonalLinePattern } from '../components/common/DiagonalLinePattern';
import { useTranslation } from '../i18n/useTranslation';
import isoWeek from 'dayjs/plugin/isoWeek';
import * as ImagePicker from 'expo-image-picker';

dayjs.extend(isoWeek);

interface ProgressHomeScreenProps {
  navigation: any;
}

const LIGHT_COLORS = {
  secondary: '#FFFFFF',
  textMeta: '#8E8E93',
};

const SCREEN_WIDTH = Dimensions.get('window').width;

export function ProgressHomeScreen({ navigation }: ProgressHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const {
    settings,
    progressLogs,
    addProgressLog,
    sessions,
    cycles,
    workoutAssignments,
  } = useStore();
  
  const [showWeeklyCheckIn, setShowWeeklyCheckIn] = useState(false);
  const [checkInPhotoUris, setCheckInPhotoUris] = useState<string[]>([]);
  const [checkInWeight, setCheckInWeight] = useState('');
  const [isSavingCheckIn, setIsSavingCheckIn] = useState(false);
  const { t } = useTranslation();

  const openWeeklyCheckIn = () => {
    setShowWeeklyCheckIn(true);
  };

  const handlePickCheckInPhoto = async (mode: 'camera' | 'library') => {
    if (!ImagePicker) return;
    if (checkInPhotoUris.length >= 5) {
      Alert.alert(t('alertErrorTitle'), 'You can add up to 5 photos.');
      return;
    }
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
          setCheckInPhotoUris(prev => [...prev, result.assets[0].uri]);
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(t('photoLibraryPermissionTitle'), t('photoLibraryPermissionBody'));
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          allowsMultipleSelection: true,
          quality: 1,
        });
        if (!result.canceled && result.assets) {
          const availableSlots = 5 - checkInPhotoUris.length;
          const newUris = result.assets.slice(0, availableSlots).map(asset => asset.uri);
          setCheckInPhotoUris(prev => [...prev, ...newUris]);
        }
      }
    } catch (error) {
      Alert.alert(t('alertErrorTitle'), t('failedToPickImage'));
    }
  };

  const handleRemovePhoto = (index: number) => {
    setCheckInPhotoUris(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveWeeklyCheckIn = async () => {
    const displayWeight = parseFloat(checkInWeight);
    const hasPhotos = checkInPhotoUris.length > 0;
    const hasWeight = Number.isFinite(displayWeight) && displayWeight > 0;
    
    if (!hasPhotos && !hasWeight) {
      Alert.alert(t('alertErrorTitle'), 'Please add at least one photo or weight entry.');
      return;
    }

    setIsSavingCheckIn(true);
    const weightLbs = hasWeight ? fromDisplayWeight(displayWeight, settings.useKg) : undefined;
    const result = await addProgressLog({ photoUris: checkInPhotoUris, weightLbs });
    setIsSavingCheckIn(false);

    if (!result.success) {
      Alert.alert(t('alertErrorTitle'), t('progressLogFailed'));
      return;
    }

    setCheckInPhotoUris([]);
    setCheckInWeight('');
    setShowWeeklyCheckIn(false);
  };

  const sortedProgressLogs = useMemo(() => {
    return [...progressLogs]
      .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf())
      .map((log) => ({
        ...log,
        dateLabel: dayjs(log.createdAt).format('MMM D'),
      }));
  }, [progressLogs]);

  // Calculate stats
  const totalWorkouts = sessions.length;
  
  const currentStreak = useMemo(() => {
    if (sessions.length === 0) return 0;
    
    const sortedSessions = [...sessions].sort((a, b) => 
      dayjs(b.startTime).valueOf() - dayjs(a.startTime).valueOf()
    );
    
    let streak = 0;
    let currentDate = dayjs().startOf('day');
    
    const sessionDates = new Set(
      sortedSessions.map(s => dayjs(s.startTime).startOf('day').format('YYYY-MM-DD'))
    );
    
    if (!sessionDates.has(currentDate.format('YYYY-MM-DD'))) {
      currentDate = currentDate.subtract(1, 'day');
    }
    
    while (sessionDates.has(currentDate.format('YYYY-MM-DD'))) {
      streak++;
      currentDate = currentDate.subtract(1, 'day');
    }
    
    return streak;
  }, [sessions]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.topBar}>
            <Text style={styles.headerTitle}>{t('progress')}</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => navigation.navigate('Profile')}
                activeOpacity={1}
              >
                <IconSettings size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Stats Overview */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalWorkouts}</Text>
            <Text style={styles.statLabel}>{t('totalWorkouts')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{currentStreak}</Text>
            <Text style={styles.statLabel}>{t('currentStreak')}</Text>
          </View>
        </View>

        {/* Add Progress Button - Above Grid */}
        <View style={styles.addProgressContainer}>
          <TouchableOpacity
            onPress={openWeeklyCheckIn}
            activeOpacity={1}
            style={styles.addProgressButton}
          >
            <DiagonalLinePattern width="100%" height={56} borderRadius={BORDER_RADIUS.lg} />
            <IconAdd size={20} color={COLORS.text} />
            <Text style={styles.addProgressButtonText}>
              {t('add')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Progress Grid - Full Bleed */}
        <View style={styles.progressGridContainer}>
          <View style={styles.progressGrid}>
            {(() => {
              const tileSize = SCREEN_WIDTH / 3;
              const tileHeight = tileSize * (16 / 9);

              const logTiles = sortedProgressLogs.slice(0, 6).map((log, index) => {
                const hasPhoto = (log.photoUris && log.photoUris.length > 0) || !!log.photoUri;
                const hasWeight = log.weightLbs !== undefined;
                
                return (
                  <TouchableOpacity
                    key={log.id}
                    activeOpacity={0.9}
                    onPress={() => navigation.navigate('ProgressLogDetail', { progressLogId: log.id })}
                    style={[
                      styles.progressTile,
                      !hasPhoto && styles.progressTileNoPhoto,
                      {
                        width: tileSize,
                        height: tileHeight,
                      },
                    ]}
                  >
                    {hasPhoto ? (
                      <>
                        <Image source={{ uri: log.photoUris?.[0] || log.photoUri || '' }} style={styles.progressTileImage} />
                        <View style={styles.progressTileOverlay}>
                          {hasWeight ? (
                            <>
                              <Text style={styles.progressTileWeight}>
                                {formatWeight(log.weightLbs!, settings.useKg)} {settings.useKg ? 'kg' : 'lb'}
                              </Text>
                              <Text style={styles.progressTileDate}>{log.dateLabel}</Text>
                            </>
                          ) : (
                            <Text style={styles.progressTileDate}>{log.dateLabel}</Text>
                          )}
                        </View>
                      </>
                    ) : (
                      <View style={styles.progressTileNoPhotoContent}>
                        {hasWeight && (
                          <Text style={styles.progressTileNoPhotoWeight}>
                            {formatWeight(log.weightLbs!, settings.useKg)} {settings.useKg ? 'kg' : 'lb'}
                          </Text>
                        )}
                        <Text style={styles.progressTileNoPhotoDate}>{log.dateLabel}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              });

              return logTiles;
            })()}
          </View>
        </View>

        {/* See All Button - Back in padded area */}
        {sortedProgressLogs.length > 6 && (
          <View style={styles.seeAllContainer}>
            <TouchableOpacity
              style={styles.progressSeeAllButton}
              onPress={() => navigation.navigate('ProgressGallery')}
              activeOpacity={1}
            >
              <Text style={styles.viewAllText}>{t('seeAllProgress')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Progress Log Bottom Drawer */}
      <BottomDrawer
        visible={showWeeklyCheckIn}
        onClose={() => {
          setShowWeeklyCheckIn(false);
          setCheckInPhotoUris([]);
          setCheckInWeight('');
        }}
      >
        <View style={styles.checkInContent}>
          <Text style={styles.checkInTitle}>{t('weeklyCheckIn')}</Text>
          <Text style={styles.checkInSubtitle}>{t('weeklyCheckInSubtitle')}</Text>

          {/* Photos */}
          <View style={styles.checkInSection}>
            <Text style={styles.checkInSectionLabel}>{t('photos')} ({t('optional')})</Text>
            <View style={styles.photoGridCheckIn}>
              {checkInPhotoUris.map((uri, index) => (
                <View key={index} style={styles.photoItemCheckIn}>
                  <Image source={{ uri }} style={styles.photoImageCheckIn} />
                  <TouchableOpacity
                    style={styles.photoRemoveButton}
                    onPress={() => handleRemovePhoto(index)}
                  >
                    <Text style={styles.photoRemoveButtonText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {checkInPhotoUris.length < 5 && (
                <TouchableOpacity
                  style={styles.photoAddButton}
                  onPress={() => handlePickCheckInPhoto('library')}
                >
                  <IconAdd size={24} color={COLORS.textMeta} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Weight */}
          <View style={styles.checkInSection}>
            <Text style={styles.checkInSectionLabel}>
              {t('bodyWeight')} ({settings.useKg ? 'kg' : 'lb'}) ({t('optional')})
            </Text>
            <TextInput
              style={styles.weightInput}
              placeholder={settings.useKg ? '70' : '155'}
              placeholderTextColor={COLORS.textMeta}
              keyboardType="decimal-pad"
              value={checkInWeight}
              onChangeText={setCheckInWeight}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, isSavingCheckIn && styles.saveButtonDisabled]}
            onPress={handleSaveWeeklyCheckIn}
            disabled={isSavingCheckIn}
          >
            <Text style={styles.saveButtonText}>
              {isSavingCheckIn ? t('saving') : t('save')}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomDrawer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    marginBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: 40,
    paddingHorizontal: SPACING.xxl,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  statValue: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    textAlign: 'center',
  },
  addProgressContainer: {
    paddingHorizontal: SPACING.xxl,
    marginBottom: SPACING.xl,
  },
  addProgressButton: {
    width: '100%',
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    overflow: 'hidden',
  },
  addProgressButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  progressGridContainer: {
    marginBottom: SPACING.xl,
  },
  progressGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  seeAllContainer: {
    paddingHorizontal: SPACING.xxl,
  },
  progressTile: {
    overflow: 'hidden',
  },
  progressTileImage: {
    width: '100%',
    height: '100%',
  },
  progressTileOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  progressTileWeight: {
    ...TYPOGRAPHY.metaBold,
    color: '#FFFFFF',
  },
  progressTileDate: {
    ...TYPOGRAPHY.meta,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  progressTileNoPhoto: {
    backgroundColor: COLORS.activeCard,
  },
  progressTileNoPhotoContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.sm,
  },
  progressTileNoPhotoWeight: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  progressTileNoPhotoDate: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  progressSeeAllButton: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  viewAllText: {
    ...TYPOGRAPHY.body,
    color: COLORS.accentPrimary,
    fontWeight: '600',
  },
  checkInContent: {
    padding: SPACING.xl,
  },
  checkInTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  checkInSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    marginBottom: SPACING.xl,
  },
  checkInSection: {
    marginBottom: SPACING.xl,
  },
  checkInSectionLabel: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  photoGridCheckIn: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  photoItemCheckIn: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImageCheckIn: {
    width: '100%',
    height: '100%',
  },
  photoRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoRemoveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 20,
  },
  photoAddButton: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.activeCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  weightInput: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  saveButton: {
    backgroundColor: COLORS.accentPrimary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.backgroundCanvas,
  },
});
