import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolate, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconSettings, IconEdit } from '../components/icons';
import { formatWeight, fromDisplayWeight } from '../utils/weight';
import { BottomDrawer } from '../components/common/BottomDrawer';
import { DragHandle } from '../components/calendar/DragHandle';
import { useTranslation } from '../i18n/useTranslation';
import { useProgressMetrics, CycleSnapshot, WeeklySnapshot } from '../hooks/useProgressMetrics';
import { KeyLiftCard } from '../components/progress/KeyLiftCard';
import { WeeklyWeightCard } from '../components/progress/WeeklyWeightCard';
import { PhotoCheckInCard } from '../components/progress/PhotoCheckInCard';

dayjs.extend(isoWeek);

interface ProgressHomeScreenProps {
  navigation: any;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export function ProgressHomeScreen({ navigation }: ProgressHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const {
    settings,
    bodyWeightEntries,
    progressPhotos,
    addBodyWeightEntry,
    addProgressPhoto,
  } = useStore();

  const [showWeightInput, setShowWeightInput] = useState(false);
  const [weightValue, setWeightValue] = useState('');
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const { t } = useTranslation();

  const metrics = useProgressMetrics();
  const useKg = settings.useKg;

  // ─── Body weight data ──────────────────────────────────────────

  const sortedWeightEntries = useMemo(() =>
    [...bodyWeightEntries].sort((a, b) => b.date.localeCompare(a.date)),
    [bodyWeightEntries]
  );

  const latestWeightEntry = sortedWeightEntries[0] || null;

  const previousWeekEntry = useMemo(() => {
    const lastWeekEnd = dayjs().startOf('isoWeek').subtract(1, 'day').format('YYYY-MM-DD');
    const lastWeekStart = dayjs().startOf('isoWeek').subtract(7, 'day').format('YYYY-MM-DD');
    const entry = sortedWeightEntries.find(e => e.date >= lastWeekStart && e.date <= lastWeekEnd);
    return entry || null;
  }, [sortedWeightEntries]);

  const weightTrend = useMemo(() => {
    const weeks: number[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = dayjs().startOf('isoWeek').subtract(i, 'week').format('YYYY-MM-DD');
      const weekEnd = dayjs().endOf('isoWeek').subtract(i, 'week').format('YYYY-MM-DD');
      const weekEntries = bodyWeightEntries.filter(e => e.date >= weekStart && e.date <= weekEnd);
      if (weekEntries.length > 0) {
        const latest = weekEntries.sort((a, b) => b.date.localeCompare(a.date))[0];
        weeks.push(latest.weight);
      }
    }
    return weeks;
  }, [bodyWeightEntries]);

  // ─── Photo data ────────────────────────────────────────────────

  const sortedPhotos = useMemo(() =>
    [...progressPhotos].sort((a, b) => b.date.localeCompare(a.date)),
    [progressPhotos]
  );

  const latestFrontPhoto = useMemo(() =>
    sortedPhotos.find(p => p.label === 'Front') || sortedPhotos[0] || null,
    [sortedPhotos]
  );

  // ─── Weight logging ────────────────────────────────────────────

  const handleSaveWeight = useCallback(async () => {
    const displayWeight = parseFloat(weightValue);
    if (!Number.isFinite(displayWeight) || displayWeight <= 0) {
      Alert.alert(t('alertErrorTitle'), 'Please enter a valid weight.');
      return;
    }

    const weightInLbs = fromDisplayWeight(displayWeight, settings.useKg);
    await addBodyWeightEntry({
      id: `bw-${Date.now()}`,
      date: dayjs().format('YYYY-MM-DD'),
      weight: weightInLbs,
      unit: 'lb',
    });

    setWeightValue('');
    setShowWeightInput(false);
  }, [weightValue, settings.useKg, addBodyWeightEntry, t]);

  // ─── Photo capture ─────────────────────────────────────────────

  const handlePickPhoto = useCallback(async (label: 'Front' | 'Side' | 'Back') => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('photoLibraryPermissionTitle'), t('photoLibraryPermissionBody'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        await addProgressPhoto({
          date: dayjs().format('YYYY-MM-DD'),
          imageUri: result.assets[0].uri,
          label,
        });
        setShowPhotoCapture(false);
      }
    } catch {
      Alert.alert(t('alertErrorTitle'), t('failedToPickImage'));
    }
  }, [addProgressPhoto, t]);

  const handleTakePhoto = useCallback(async (label: 'Front' | 'Side' | 'Back') => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('photoLibraryPermissionTitle'), t('photoLibraryPermissionBody'));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        await addProgressPhoto({
          date: dayjs().format('YYYY-MM-DD'),
          imageUri: result.assets[0].uri,
          label,
        });
        setShowPhotoCapture(false);
      }
    } catch {
      Alert.alert(t('alertErrorTitle'), t('failedToPickImage'));
    }
  }, [addProgressPhoto, t]);

  // ─── Render ────────────────────────────────────────────────────

  return (
    <View testID="progress-screen" style={styles.container}>
      <ScrollView
        testID="progress-scroll-view"
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══ CURRENT CYCLE MODULE ═══ */}
        <CurrentCycleModule
          hero={metrics.hasAnyData ? metrics.hero : null}
          adherence={metrics.adherence}
          useKg={useKg}
          t={t}
          topInset={insets.top}
          onSettingsPress={() => navigation.navigate('Profile')}
          onViewCycleSummary={
            metrics.hero?.type === 'cycle'
              ? () => {
                  const activePlan = useStore.getState().cyclePlans.find(p => p.active);
                  if (activePlan) navigation.navigate('CyclePlanDetail', { planId: activePlan.id });
                }
              : undefined
          }
        />

        {!metrics.hasAnyData ? (
          <View testID="progress-empty-state" style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>{t('noDataYet')}</Text>
            <Text style={styles.emptySubtitle}>{t('completeFirstWorkout')}</Text>
          </View>
        ) : (
          <>
            {/* ═══ LIFTS ═══ */}
            <View testID="progress-lifts-section" style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Lifts</Text>
                  <Text style={styles.sectionSubtitle}>Strength trends across time</Text>
                </View>
                <TouchableOpacity
                  testID="progress-lifts-edit-key-lifts"
                  onPress={() => navigation.navigate('EditKeyLifts')}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <IconEdit size={20} color={COLORS.textMeta} />
                </TouchableOpacity>
              </View>

              {metrics.keyLifts.length === 0 ? (
                <Text style={styles.emptyHint}>
                  Complete your first workout to see lift trends
                </Text>
              ) : (
                metrics.keyLifts.map((lift, index) => (
                  <KeyLiftCard
                    key={lift.exerciseId}
                    testID={`progress-lift-card-${index}`}
                    lift={lift}
                    useKg={useKg}
                    onPress={() => navigation.navigate('LiftHistory', {
                      exerciseId: lift.exerciseId,
                      exerciseName: lift.exerciseName,
                    })}
                  />
                ))
              )}
            </View>

            {/* ═══ BODY ═══ */}
            <View testID="progress-body-section" style={styles.section}>
              <Text style={styles.sectionTitle}>Body</Text>
              <Text style={styles.sectionSubtitle}>Check-ins and physical changes</Text>

              <View style={styles.bodyCards}>
                <WeeklyWeightCard
                  latestEntry={latestWeightEntry}
                  previousWeekEntry={previousWeekEntry}
                  weightTrend={weightTrend}
                  useKg={useKg}
                  onLogWeight={() => setShowWeightInput(true)}
                />

                <PhotoCheckInCard
                  latestPhoto={latestFrontPhoto}
                  recentPhotos={sortedPhotos}
                  onAddPhoto={() => setShowPhotoCapture(true)}
                  onPhotoPress={(photo) => navigation.navigate('PhotoViewer', { photoId: photo.id })}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* ═══ WEIGHT LOG DRAWER ═══ */}
      <BottomDrawer
        visible={showWeightInput}
        onClose={() => { setShowWeightInput(false); setWeightValue(''); }}
      >
        <View style={styles.drawerContent}>
          <Text style={styles.drawerTitle}>Log weight</Text>
          <View style={styles.drawerSection}>
            <Text style={styles.drawerSectionLabel}>
              {t('bodyWeight')} ({settings.useKg ? 'kg' : 'lb'})
            </Text>
            <TextInput
              style={styles.weightInput}
              placeholder={settings.useKg ? '70' : '155'}
              placeholderTextColor={COLORS.textMeta}
              keyboardType="decimal-pad"
              value={weightValue}
              onChangeText={setWeightValue}
              autoFocus
            />
          </View>
          <TouchableOpacity style={styles.saveButton} onPress={handleSaveWeight}>
            <Text style={styles.saveButtonText}>{t('save')}</Text>
          </TouchableOpacity>
        </View>
      </BottomDrawer>

      {/* ═══ PHOTO CAPTURE DRAWER ═══ */}
      <BottomDrawer
        visible={showPhotoCapture}
        onClose={() => setShowPhotoCapture(false)}
      >
        <View style={styles.drawerContent}>
          <Text style={styles.drawerTitle}>Add check-in photo</Text>
          <Text style={styles.drawerSubtitle}>Choose a label and source</Text>

          {(['Front', 'Side', 'Back'] as const).map((label) => (
            <View key={label} style={styles.photoLabelRow}>
              <Text style={styles.photoLabelText}>{label}</Text>
              <View style={styles.photoActions}>
                <TouchableOpacity
                  style={styles.photoActionBtn}
                  onPress={() => handleTakePhoto(label)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.photoActionText}>{t('takePhoto')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoActionBtn}
                  onPress={() => handlePickPhoto(label)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.photoActionText}>{t('chooseFromLibrary')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </BottomDrawer>
    </View>
  );
}

// ─── Expandable Current Cycle Module ─────────────────────────────

const MODULE_HEADER_HEIGHT = 48;
const MODULE_COLLAPSED_EXTRA = 0;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const MODULE_EXPANDED_EXTRA = Math.min(180, SCREEN_HEIGHT * 0.4 - MODULE_HEADER_HEIGHT);
const MODULE_SNAP_THRESHOLD = 0.35;
const MODULE_SPRING = { damping: 22, stiffness: 220, mass: 0.8 };

function CurrentCycleModule({
  hero,
  adherence,
  useKg,
  t,
  topInset,
  onSettingsPress,
  onViewCycleSummary,
}: {
  hero: (CycleSnapshot | WeeklySnapshot) | null;
  adherence: { completed: number; planned: number; hasSchedule: boolean };
  useKg: boolean;
  t: any;
  topInset: number;
  onSettingsPress: () => void;
  onViewCycleSummary?: () => void;
}) {
  const expansion = useSharedValue(0);
  const isExpanded = useSharedValue(false);

  const hasHero = hero !== null;
  const isCycle = hero?.type === 'cycle';
  const cycle = isCycle ? (hero as CycleSnapshot) : null;
  const weekly = !isCycle && hero ? (hero as WeeklySnapshot) : null;

  const subtitle = cycle
    ? cycle.cycleName
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
    <View testID="progress-drawer" style={styles.moduleWrapper}>
      <View style={[styles.moduleCard, { paddingTop: topInset }]}>
        <View style={styles.topBar}>
          <Text style={styles.headerTitle}>{t('currentCycle')}</Text>
          <TouchableOpacity style={styles.settingsButton} onPress={onSettingsPress} activeOpacity={1}>
            <IconSettings size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        {subtitle && (
          <Text style={styles.moduleWeekLabel}>{subtitle}</Text>
        )}

        {hasHero && (
          <Animated.View style={[styles.moduleBody, bodyStyle]}>
            <Animated.View testID="progress-drawer-expanded" style={[styles.moduleExpandedContent, expandedContentStyle]}>
              {cycle ? (
                <>
                  {/* Completion */}
                  <View style={styles.drawerRow}>
                    <Text style={styles.drawerRowLabel}>{t('completed')}</Text>
                    <View style={styles.drawerRowRight}>
                      <Text style={styles.drawerRowValue}>{cycle.completionPercent}%</Text>
                    </View>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${cycle.completionPercent}%` }]} />
                  </View>

                  {/* Volume */}
                  <View style={styles.drawerRow}>
                    <Text style={styles.drawerRowLabel}>{t('volume')}</Text>
                    <Text style={styles.drawerRowValue}>
                      {cycle.totalVolume > 0 ? `${Math.round(cycle.totalVolume / 1000)}k` : '—'}
                      {cycle.volumeVsPreviousCyclePercent !== null
                        ? ` (${cycle.volumeVsPreviousCyclePercent > 0 ? '+' : ''}${cycle.volumeVsPreviousCyclePercent}%)`
                        : ''}
                    </Text>
                  </View>

                  {/* Primary lift */}
                  {cycle.primaryLiftName && (
                    <View style={styles.drawerRow}>
                      <Text style={styles.drawerRowLabel}>{cycle.primaryLiftName}</Text>
                      <Text style={styles.drawerRowValue}>
                        {cycle.primaryLiftPrevious
                          ? `${cycle.primaryLiftPrevious} → ${cycle.primaryLiftCurrent}`
                          : cycle.primaryLiftCurrent}
                      </Text>
                    </View>
                  )}

                  {/* Bodyweight */}
                  {cycle.bodyweightStart !== null && cycle.bodyweightCurrent !== null && (
                    <View style={styles.drawerRow}>
                      <Text style={styles.drawerRowLabel}>{t('bodyWeight')}</Text>
                      <Text style={styles.drawerRowValue}>
                        {formatWeight(cycle.bodyweightStart, useKg)} → {formatWeight(cycle.bodyweightCurrent, useKg)} {useKg ? 'kg' : 'lb'}
                      </Text>
                    </View>
                  )}

                  {/* CTA */}
                  {onViewCycleSummary && (
                    <TouchableOpacity testID="progress-drawer-view-cycle-summary" style={styles.drawerCta} onPress={onViewCycleSummary} activeOpacity={0.7}>
                      <Text style={styles.drawerCtaText}>View Cycle Summary</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <>
                  {/* Weekly mode: keep existing layout */}
                  <View style={styles.heroStatsRow}>
                    <View style={styles.heroStat}>
                      <Text style={styles.heroStatValue}>{completedCount}</Text>
                      <Text style={styles.heroStatLabel}>{t('completed')}</Text>
                      {hero!.workoutsPlanned > 0 && (
                        <Text style={styles.heroStatMeta}>of {hero!.workoutsPlanned}</Text>
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
                </>
              )}
            </Animated.View>
          </Animated.View>
        )}

        {hasHero && (
          <GestureDetector gesture={panGesture}>
            <Animated.View>
              <DragHandle testID="progress-drawer-handle" />
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h2,
    color: '#FFFFFF',
    marginTop: 32,
  },
  sectionSubtitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginTop: 4,
  },

  // Body section
  bodyCards: {
    marginTop: SPACING.lg,
    gap: SPACING.md,
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
    marginTop: SPACING.md,
  },

  // Module
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

  // Drawer
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
  saveButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.backgroundCanvas,
  },

  // Photo capture drawer
  photoLabelRow: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDimmed,
  },
  photoLabelText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  photoActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  photoActionBtn: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  photoActionText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.accentPrimary,
    fontWeight: '600',
  },

  // Drawer intelligence rows
  drawerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  drawerRowLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  drawerRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  drawerRowValue: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: COLORS.activeCard,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: COLORS.accentPrimary,
    borderRadius: 2,
  },
  drawerCta: {
    marginTop: SPACING.sm,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  drawerCtaText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.accentPrimary,
    fontWeight: '600',
  },
});
