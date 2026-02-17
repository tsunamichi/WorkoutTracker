import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolate, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconAdd, IconSettings, IconPR, IconChevronDown } from '../components/icons';
import dayjs from 'dayjs';
import { formatWeight, fromDisplayWeight } from '../utils/weight';
import { BottomDrawer } from '../components/common/BottomDrawer';
import { DiagonalLinePattern } from '../components/common/DiagonalLinePattern';
import { DragHandle } from '../components/calendar/DragHandle';
import { useTranslation } from '../i18n/useTranslation';
import { useProgressMetrics, CycleSnapshot, WeeklySnapshot, KeyLift } from '../hooks/useProgressMetrics';
import isoWeek from 'dayjs/plugin/isoWeek';
import * as ImagePicker from 'expo-image-picker';

dayjs.extend(isoWeek);

interface ProgressHomeScreenProps {
  navigation: any;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

function DeltaBadge({ value, suffix }: { value: number | null; suffix?: string }) {
  if (value === null) return <Text style={styles.deltaNeutral}>—</Text>;

  const isPositive = value > 0;
  const isNegative = value < 0;
  const color = isPositive ? COLORS.successBright : isNegative ? COLORS.textMeta : COLORS.textMeta;
  const prefix = isPositive ? '+' : '';

  return (
    <Text style={[styles.deltaText, { color }]}>
      {prefix}{value}%{suffix ? ` ${suffix}` : ''}
    </Text>
  );
}

export function ProgressHomeScreen({ navigation }: ProgressHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const {
    settings,
    progressLogs,
    addProgressLog,
  } = useStore();

  const [showWeeklyCheckIn, setShowWeeklyCheckIn] = useState(false);
  const [checkInPhotoUris, setCheckInPhotoUris] = useState<string[]>([]);
  const [checkInWeight, setCheckInWeight] = useState('');
  const [isSavingCheckIn, setIsSavingCheckIn] = useState(false);
  const [showAllLifts, setShowAllLifts] = useState(false);
  const { t } = useTranslation();

  const metrics = useProgressMetrics();
  const useKg = settings.useKg;

  // ─── Check-in logic (preserved from original) ──────────────────

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

  // ─── Derived data ──────────────────────────────────────────────

  const sortedProgressLogs = useMemo(() => {
    return [...progressLogs]
      .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf());
  }, [progressLogs]);

  // ──────────────────────────────────────────────────────────────
  // ⚠️  FAKE DATA — remove this block when done reviewing design
  // ──────────────────────────────────────────────────────────────
  const FAKE_KEY_LIFTS: KeyLift[] = [
    { exerciseId: 'fake-1', exerciseName: 'Bench Press', latestWeight: 225, latestReps: 5, previousWeight: 215, deltaPercent: 4.7, occurrences: 8, pr: undefined, isPR: true },
    { exerciseId: 'fake-2', exerciseName: 'Squat', latestWeight: 315, latestReps: 3, previousWeight: 305, deltaPercent: 3.3, occurrences: 7, pr: undefined, isPR: false },
    { exerciseId: 'fake-3', exerciseName: 'Deadlift', latestWeight: 405, latestReps: 2, previousWeight: 405, deltaPercent: 0, occurrences: 6, pr: undefined, isPR: false },
    { exerciseId: 'fake-4', exerciseName: 'Overhead Press', latestWeight: 135, latestReps: 6, previousWeight: 125, deltaPercent: 8.0, occurrences: 5, pr: undefined, isPR: true },
    { exerciseId: 'fake-5', exerciseName: 'Barbell Row', latestWeight: 185, latestReps: 8, previousWeight: 190, deltaPercent: -2.6, occurrences: 4, pr: undefined, isPR: false },
  ];

  const FAKE_CHECK_INS = [
    { id: 'fake-ci-1', createdAt: dayjs().subtract(1, 'day').toISOString(), weightLbs: 178, photoUris: ['https://placekitten.com/200/200'] },
    { id: 'fake-ci-2', createdAt: dayjs().subtract(8, 'day').toISOString(), weightLbs: 180, photoUris: ['https://placekitten.com/201/201'] },
  ];

  const FAKE_HERO: CycleSnapshot = {
    type: 'cycle',
    cycleName: 'Hypertrophy Block',
    currentWeek: 3,
    totalWeeks: 6,
    workoutsCompleted: 3,
    workoutsPlanned: 5,
    volumeThisWeek: 42500,
    volumeWeekOne: 35000,
    volumeDeltaPercent: 21.4,
  };

  const FAKE_ADHERENCE = { completed: 3, planned: 5, hasSchedule: true };

  const previewMetrics = {
    ...metrics,
    hero: metrics.hero ?? FAKE_HERO,
    keyLifts: metrics.keyLifts.length > 0 ? metrics.keyLifts : FAKE_KEY_LIFTS,
    adherence: metrics.adherence.hasSchedule ? metrics.adherence : FAKE_ADHERENCE,
    hasAnyData: true,
  };

  const previewLogs = sortedProgressLogs.length > 0 ? sortedProgressLogs : FAKE_CHECK_INS;
  // ──────────────────────────────────────────────────────────────
  // ⚠️  END FAKE DATA
  // ──────────────────────────────────────────────────────────────

  const latestCheckIn = previewLogs[0];

  const liftsToShow = showAllLifts ? previewMetrics.keyLifts : previewMetrics.keyLifts.slice(0, 3);

  // ─── Render ────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══ CURRENT CYCLE MODULE (includes page header) ═══ */}
        <CurrentCycleModule
          hero={previewMetrics.hasAnyData ? previewMetrics.hero : null}
          adherence={previewMetrics.adherence}
          useKg={useKg}
          t={t}
          topInset={insets.top}
          onSettingsPress={() => navigation.navigate('Profile')}
        />

        {!previewMetrics.hasAnyData ? (
          /* ═══ Empty State ═══ */
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>{t('noDataYet')}</Text>
            <Text style={styles.emptySubtitle}>{t('completeFirstWorkout')}</Text>
          </View>
        ) : (
          <>

            {/* ═══ ALL-TIME RECORDS ═══ */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('allTimeRecords')}</Text>
              <Text style={styles.sectionLabel}>{t('keyLifts')}</Text>
              {previewMetrics.keyLifts.length === 0 ? (
                <Text style={styles.emptyHint}>{t('noRepeatExercisesYet')}</Text>
              ) : (
                <>
                  {liftsToShow.map((lift) => (
                    <TouchableOpacity
                      key={lift.exerciseId}
                      style={styles.liftRow}
                      onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: lift.exerciseId })}
                      activeOpacity={0.7}
                    >
                      <View style={styles.liftLeft}>
                        <View style={styles.liftNameRow}>
                          <Text style={styles.liftName} numberOfLines={1}>{lift.exerciseName}</Text>
                          {lift.isPR && (
                            <View style={styles.prBadge}>
                              <IconPR size={12} color={COLORS.accentPrimary} />
                              <Text style={styles.prBadgeText}>{t('pr')}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.liftDetail}>
                          {formatWeight(lift.latestWeight, useKg)} {useKg ? 'kg' : 'lb'} × {lift.latestReps}
                        </Text>
                      </View>
                      <DeltaBadge value={lift.deltaPercent} />
                    </TouchableOpacity>
                  ))}
                  {previewMetrics.keyLifts.length > 3 && (
                    <TouchableOpacity
                      style={styles.showAllButton}
                      onPress={() => setShowAllLifts(!showAllLifts)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.showAllText}>
                        {showAllLifts ? t('hideHistory') : t('viewAll')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            {/* ═══ BODY CHECK-IN ═══ */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('bodyCheckIn')}</Text>
              {latestCheckIn ? (
                <TouchableOpacity
                  style={styles.checkInCard}
                  onPress={() => navigation.navigate('ProgressLogDetail', { progressLogId: latestCheckIn.id })}
                  activeOpacity={0.7}
                >
                  {(latestCheckIn.photoUris?.[0] || latestCheckIn.photoUri) ? (
                    <Image
                      source={{ uri: latestCheckIn.photoUris?.[0] || latestCheckIn.photoUri || '' }}
                      style={styles.checkInThumbnail}
                    />
                  ) : (
                    <View style={styles.checkInPlaceholder} />
                  )}
                  <View style={styles.checkInInfo}>
                    {latestCheckIn.weightLbs !== undefined && (
                      <Text style={styles.checkInWeight}>
                        {formatWeight(latestCheckIn.weightLbs, useKg)} {useKg ? 'kg' : 'lb'}
                      </Text>
                    )}
                    <Text style={styles.checkInDate}>
                      {dayjs(latestCheckIn.createdAt).format('MMM D')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={() => setShowWeeklyCheckIn(true)}
                activeOpacity={0.7}
                style={styles.addCheckInButton}
              >
                <DiagonalLinePattern width="100%" height={48} borderRadius={BORDER_RADIUS.md} />
                <IconAdd size={18} color={COLORS.text} />
                <Text style={styles.addCheckInText}>{t('addCheckIn')}</Text>
              </TouchableOpacity>

              {previewLogs.length > 1 && (
                <TouchableOpacity
                  style={styles.seeAllButton}
                  onPress={() => navigation.navigate('ProgressGallery')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.seeAllText}>{t('seeAllProgress')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
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
        <View style={styles.drawerContent}>
          <Text style={styles.drawerTitle}>{t('weeklyCheckIn')}</Text>
          <Text style={styles.drawerSubtitle}>{t('weeklyCheckInSubtitle')}</Text>

          {/* Photos */}
          <View style={styles.drawerSection}>
            <Text style={styles.drawerSectionLabel}>{t('photos')} ({t('optional')})</Text>
            <View style={styles.photoGrid}>
              {checkInPhotoUris.map((uri, index) => (
                <View key={index} style={styles.photoItem}>
                  <Image source={{ uri }} style={styles.photoImage} />
                  <TouchableOpacity
                    style={styles.photoRemoveBtn}
                    onPress={() => handleRemovePhoto(index)}
                  >
                    <Text style={styles.photoRemoveText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {checkInPhotoUris.length < 5 && (
                <TouchableOpacity
                  style={styles.photoAddBtn}
                  onPress={() => handlePickCheckInPhoto('library')}
                >
                  <IconAdd size={24} color={COLORS.textMeta} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Weight */}
          <View style={styles.drawerSection}>
            <Text style={styles.drawerSectionLabel}>
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

          {/* Save */}
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

// ─── Sub-components ────────────────────────────────────────────────

// ─── Expandable Current Cycle Module ─────────────────────────────

const MODULE_HEADER_HEIGHT = 48;
const MODULE_COLLAPSED_EXTRA = 0;
const MODULE_EXPANDED_EXTRA = 100;
const MODULE_SNAP_THRESHOLD = 0.35;
const MODULE_SPRING = { damping: 22, stiffness: 220, mass: 0.8 };

function CurrentCycleModule({
  hero,
  adherence,
  useKg,
  t,
  topInset,
  onSettingsPress,
}: {
  hero: (CycleSnapshot | WeeklySnapshot) | null;
  adherence: { completed: number; planned: number; hasSchedule: boolean };
  useKg: boolean;
  t: any;
  topInset: number;
  onSettingsPress: () => void;
}) {
  const expansion = useSharedValue(0);
  const isExpanded = useSharedValue(false);

  const hasHero = hero !== null;
  const isCycle = hero?.type === 'cycle';
  const cycle = isCycle ? (hero as CycleSnapshot) : null;
  const weekly = !isCycle && hero ? (hero as WeeklySnapshot) : null;

  const subtitle = cycle
    ? t('weekOf').replace('{current}', String(cycle.currentWeek)).replace('{total}', String(cycle.totalWeeks))
    : weekly
      ? weekly.weekLabel
      : null;

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      const maxDrag = MODULE_EXPANDED_EXTRA - MODULE_COLLAPSED_EXTRA;
      if (isExpanded.value) {
        expansion.value = Math.max(0, Math.min(1, 1 + e.translationY / maxDrag));
      } else {
        expansion.value = Math.max(0, Math.min(1, e.translationY / maxDrag));
      }
    })
    .onEnd(() => {
      if (isExpanded.value) {
        if (expansion.value < 1 - MODULE_SNAP_THRESHOLD) {
          expansion.value = withSpring(0, MODULE_SPRING);
          isExpanded.value = false;
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        } else {
          expansion.value = withSpring(1, MODULE_SPRING);
        }
      } else {
        if (expansion.value > MODULE_SNAP_THRESHOLD) {
          expansion.value = withSpring(1, MODULE_SPRING);
          isExpanded.value = true;
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        } else {
          expansion.value = withSpring(0, MODULE_SPRING);
        }
      }
    });

  const bodyStyle = useAnimatedStyle(() => ({
    height: interpolate(
      expansion.value,
      [0, 1],
      [hasHero ? MODULE_COLLAPSED_EXTRA : 0, hasHero ? MODULE_EXPANDED_EXTRA : 0],
    ),
  }));

  const expandedContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expansion.value, [0, 0.4, 1], [0, 0, 1]),
    transform: [{ translateY: interpolate(expansion.value, [0, 1], [8, 0]) }],
  }));

  const completedCount = hero ? `${hero.workoutsCompleted}` : '0';
  const consistencyLabel = adherence.hasSchedule ? `${adherence.completed}/${adherence.planned}` : null;
  const consistencyPct = adherence.planned > 0 ? Math.min(100, (adherence.completed / adherence.planned) * 100) : 0;

  return (
    <View style={styles.moduleWrapper}>
      <View style={[styles.moduleCard, { paddingTop: topInset }]}>
        {/* Header row — matches TodayScreen exactly */}
        <View style={styles.topBar}>
          <Text style={styles.headerTitle}>{t('currentCycle')}</Text>
          <TouchableOpacity style={styles.settingsButton} onPress={onSettingsPress} activeOpacity={1}>
            <IconSettings size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        {subtitle && (
          <Text style={styles.moduleWeekLabel}>{subtitle}</Text>
        )}

        {/* Expandable body */}
        {hasHero && (
          <Animated.View style={[styles.moduleBody, bodyStyle]}>
            {/* Expanded details */}
            <Animated.View style={[styles.moduleExpandedContent, expandedContentStyle]}>
              <View style={styles.heroStatsRow}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{completedCount}</Text>
                  <Text style={styles.heroStatLabel}>{t('completed')}</Text>
                  {hero.workoutsPlanned > 0 && (
                    <Text style={styles.heroStatMeta}>of {hero.workoutsPlanned}</Text>
                  )}
                </View>
                {consistencyLabel && (
                  <>
                    <View style={styles.heroStatDivider} />
                    <View style={styles.heroStat}>
                      <Text style={styles.heroStatValue}>{consistencyLabel}</Text>
                      <Text style={styles.heroStatLabel}>{t('consistency')}</Text>
                      <View style={styles.heroConsistencyBar}>
                        <View style={[styles.heroConsistencyFill, { width: `${consistencyPct}%` }]} />
                      </View>
                    </View>
                  </>
                )}
              </View>

              {weekly?.topLiftName && (
                <View style={styles.heroTopLift}>
                  <Text style={styles.heroTopLiftLabel}>Top lift</Text>
                  <Text style={styles.heroTopLiftValue}>
                    {weekly.topLiftName} · {formatWeight(weekly.topLiftWeight, useKg)} {useKg ? 'kg' : 'lb'}
                  </Text>
                </View>
              )}
            </Animated.View>
          </Animated.View>
        )}

        {hasHero && (
          <GestureDetector gesture={panGesture}>
            <Animated.View>
              <DragHandle />
            </Animated.View>
          </GestureDetector>
        )}
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  scrollView: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MODULE_HEADER_HEIGHT,
    paddingHorizontal: SPACING.xxl,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: '#FFFFFF',
  },
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Sections
  section: {
    paddingHorizontal: SPACING.xxl,
    marginBottom: 32,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h2,
    color: '#FFFFFF',
    marginTop: 40,
    marginBottom: SPACING.lg,
  },
  sectionLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },

  // Empty state
  emptyContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: 80,
    alignItems: 'center',
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyHint: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },

  // Expandable module (full-bleed, matches calendar card)
  moduleWrapper: {
    marginBottom: SPACING.md,
  },
  moduleCard: {
    backgroundColor: COLORS.backgroundContainer,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingBottom: SPACING.xs,
    overflow: 'hidden',
  },
  moduleWeekLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    paddingHorizontal: SPACING.xxl,
    marginTop: 8,
  },
  moduleBody: {
    paddingHorizontal: SPACING.xxl,
    overflow: 'hidden',
  },
  moduleExpandedContent: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  heroStat: {
    flex: 1,
  },
  heroStatValue: {
    fontSize: 28,
    fontWeight: '300',
    color: COLORS.text,
    marginBottom: 2,
  },
  heroStatLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: 4,
  },
  heroStatMeta: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMetaSoft,
  },
  heroStatDivider: {
    width: 1,
    height: 48,
    backgroundColor: COLORS.borderDimmed,
    marginHorizontal: SPACING.lg,
    alignSelf: 'center',
  },
  heroTopLift: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDimmed,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTopLiftLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  heroTopLiftValue: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },

  // Delta badge
  deltaText: {
    ...TYPOGRAPHY.meta,
    fontWeight: '600',
  },
  deltaNeutral: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMetaSoft,
  },

  // Key Lifts
  liftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDimmed,
  },
  liftLeft: {
    flex: 1,
    marginRight: SPACING.md,
  },
  liftNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 2,
  },
  liftName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    flexShrink: 1,
  },
  liftDetail: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.accentPrimaryDimmed,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  prBadgeText: {
    ...TYPOGRAPHY.note,
    color: COLORS.accentPrimary,
    fontWeight: '700',
  },
  showAllButton: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  showAllText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.accentPrimary,
    fontWeight: '600',
  },

  // Hero consistency bar
  heroConsistencyBar: {
    width: '100%',
    height: 4,
    backgroundColor: COLORS.activeCard,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 6,
  },
  heroConsistencyFill: {
    height: 4,
    backgroundColor: COLORS.accentPrimary,
    borderRadius: 2,
  },

  // Body check-in
  checkInCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderDimmed,
    marginBottom: SPACING.md,
  },
  checkInThumbnail: {
    width: 72,
    height: 72,
  },
  checkInPlaceholder: {
    width: 72,
    height: 72,
    backgroundColor: COLORS.activeCard,
  },
  checkInInfo: {
    flex: 1,
    padding: SPACING.md,
    justifyContent: 'center',
  },
  checkInWeight: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    marginBottom: 2,
  },
  checkInDate: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  addCheckInButton: {
    width: '100%',
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    overflow: 'hidden',
  },
  addCheckInText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  seeAllButton: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  seeAllText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.accentPrimary,
    fontWeight: '600',
  },

  // Drawer (check-in form)
  drawerContent: {
    padding: SPACING.xl,
  },
  drawerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  drawerSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    marginBottom: SPACING.xl,
  },
  drawerSection: {
    marginBottom: SPACING.xl,
  },
  drawerSectionLabel: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  photoItem: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoRemoveBtn: {
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
  photoRemoveText: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 20,
  },
  photoAddBtn: {
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
