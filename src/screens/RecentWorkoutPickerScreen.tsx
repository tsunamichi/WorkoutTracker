import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Reanimated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import dayjs from 'dayjs';
import * as Haptics from 'expo-haptics';
import { SPACING, TYPOGRAPHY } from '../constants';
import { IconArrowDiagonal } from '../components/icons';
import { useAppTheme } from '../theme/useAppTheme';
import { BackTextButton } from '../components/common/BackTextButton';
import { useTranslation } from '../i18n/useTranslation';
import { useStore } from '../store';
import { findActiveTemplateByName } from '../utils/workoutNameCollision';
import { hydrateWorkoutDraftFromSnapshot } from '../utils/hydrateWorkoutDraftFromSnapshot';
import { buildRecentWorkoutPickerOptions, type RecentWorkoutPickerOption } from '../utils/recentWorkoutPickerOptions';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { getAppThemeFromStore } from '../theme/getAppThemeFromStore';
import {
  SCHEDULE_DECK_HOME_SCALE_MAX,
  SCHEDULE_DECK_T,
  SCHEDULE_DECK_EXECUTION_INCOMING_SCALE_START,
  SCHEDULE_DECK_WITH_TIMING_CONFIG,
  useScheduleDeckTransition,
} from '../context/ScheduleDeckTransitionContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RecentWorkoutPicker'>;
type RRoute = RouteProp<RootStackParamList, 'RecentWorkoutPicker'>;

const TITLE_TO_GRID_GAP_PX = 48;
const CARD_COLUMN_GAP = SPACING.md;
/** Same as Today `footerEntryCard` / `timerGridCardShell` on the timer grid. */
const TIMER_PAGE_CARD_HEIGHT = 112;

export function RecentWorkoutPickerScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RRoute>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { t } = useTranslation();
  const appTheme = useAppTheme();
  const { colors: themeColors } = appTheme;
  const isV2Theme = appTheme.id === 'v2';
  const timerCardBackground = isV2Theme ? themeColors.canvasContainer : themeColors.containerTertiary;
  const timerTitleInk = themeColors.containerPrimary;

  const selectedDate = route.params?.selectedDate ?? '';
  const transitionSource = route.params?.transitionSource;
  const isScheduleOriginTransition = transitionSource === 'scheduleDeck';

  const scheduledWorkouts = useStore(s => s.scheduledWorkouts);
  const exercises = useStore(s => s.exercises);
  const workoutTemplates = useStore(s => s.workoutTemplates);

  const {
    progress: scheduleDeckProgressSV,
    reset: resetScheduleDeckTransition,
    startReverseTransition: startScheduleDeckReverseTransition,
    registerPrimeRecentPickerIncoming,
  } = useScheduleDeckTransition();
  const scheduleDeckTransitionActiveSV = useSharedValue(isScheduleOriginTransition ? 1 : 0);
  const allowScheduleDeckPopRef = useRef(false);
  const isClosingFromHeaderRef = useRef(false);
  /** 1 = picker fully visible; animates 1→0 when opening WorkoutBuilder (outgoing handoff). */
  const pickerForwardOutSV = useSharedValue(1);

  /** Builder calls `primeRecentPickerIncomingParallel` in parallel with its exit — primary path for smooth back. */
  useEffect(() => {
    if (!isScheduleOriginTransition) {
      registerPrimeRecentPickerIncoming(null);
      return;
    }
    registerPrimeRecentPickerIncoming(() => {
      pickerForwardOutSV.value = withTiming(1, SCHEDULE_DECK_WITH_TIMING_CONFIG);
    });
    return () => registerPrimeRecentPickerIncoming(null);
  }, [isScheduleOriginTransition, pickerForwardOutSV, registerPrimeRecentPickerIncoming]);

  /** Fallback if focus returns while still faded (e.g. prime did not run). */
  useFocusEffect(
    useCallback(() => {
      requestAnimationFrame(() => {
        if (pickerForwardOutSV.value < 0.5) {
          pickerForwardOutSV.value = withTiming(1, SCHEDULE_DECK_WITH_TIMING_CONFIG);
        }
      });
    }, [pickerForwardOutSV]),
  );

  useEffect(() => {
    scheduleDeckTransitionActiveSV.value = isScheduleOriginTransition ? 1 : 0;
  }, [isScheduleOriginTransition, scheduleDeckTransitionActiveSV]);

  /** Incoming (shared progress) × outgoing (picker → builder). Outgoing mirrors home layer: fade + scale toward max. */
  const scheduleDeckPickerCombinedStyle = useAnimatedStyle(() => {
    if (scheduleDeckTransitionActiveSV.value === 0) {
      return {};
    }
    const p = scheduleDeckProgressSV.value;
    const baseOpacity = interpolate(p, [SCHEDULE_DECK_T.inStart, SCHEDULE_DECK_T.inOpacityEnd], [0, 1], Extrapolation.CLAMP);
    const baseScale = interpolate(
      p,
      [SCHEDULE_DECK_T.inStart, SCHEDULE_DECK_T.inEnd],
      [SCHEDULE_DECK_EXECUTION_INCOMING_SCALE_START, 1],
      Extrapolation.CLAMP,
    );
    const out = pickerForwardOutSV.value;
    const opacity = baseOpacity * out;
    const exitScale = interpolate(out, [0, 1], [SCHEDULE_DECK_HOME_SCALE_MAX, 1], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ scale: baseScale * exitScale }],
    };
  });

  const runCloseToSchedule = useCallback(() => {
    if (!isScheduleOriginTransition) {
      navigation.goBack();
      return;
    }
    if (isClosingFromHeaderRef.current) {
      allowScheduleDeckPopRef.current = true;
      navigation.goBack();
      return;
    }
    isClosingFromHeaderRef.current = true;
    startScheduleDeckReverseTransition(finished => {
      if (!finished) {
        isClosingFromHeaderRef.current = false;
        return;
      }
      allowScheduleDeckPopRef.current = true;
      navigation.goBack();
      resetScheduleDeckTransition();
    });
  }, [isScheduleOriginTransition, navigation, resetScheduleDeckTransition, startScheduleDeckReverseTransition]);

  useEffect(() => {
    if (!isScheduleOriginTransition) return undefined;
    return navigation.addListener('beforeRemove', e => {
      if (useStore.getState().scheduleDeckBypassPickerBeforeRemove) {
        useStore.getState().setScheduleDeckBypassPickerBeforeRemove(false);
        return;
      }
      if (allowScheduleDeckPopRef.current) {
        allowScheduleDeckPopRef.current = false;
        return;
      }
      e.preventDefault();
      isClosingFromHeaderRef.current = true;
      startScheduleDeckReverseTransition(finished => {
        if (!finished) {
          isClosingFromHeaderRef.current = false;
          return;
        }
        allowScheduleDeckPopRef.current = true;
        navigation.dispatch(e.data.action);
        resetScheduleDeckTransition();
      });
    });
  }, [isScheduleOriginTransition, navigation, resetScheduleDeckTransition, startScheduleDeckReverseTransition]);

  const options = useMemo(() => buildRecentWorkoutPickerOptions(scheduledWorkouts), [scheduledWorkouts]);

  const cardWidth = useMemo(() => {
    const contentW = windowWidth - SPACING.xxl * 2;
    return (contentW - CARD_COLUMN_GAP) / 2;
  }, [windowWidth]);

  const onSelectOption = useCallback(
    (opt: RecentWorkoutPickerOption) => {
      let draft = hydrateWorkoutDraftFromSnapshot(opt.workoutName, opt.exercisesSnapshot, exercises);
      const match = findActiveTemplateByName(workoutTemplates, draft.name);
      if (match) {
        draft = { ...draft, linkedTemplateId: match.id };
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      /**
       * Push (not replace) so RecentWorkoutPicker stays under WorkoutBuilder while the builder shell
       * animates in — the crossfade reads as picker → exercises. Shared deck progress stays at **1**
       * (do not reset/startTransition) so the schedule home layer never flashes.
       */
      navigation.navigate('WorkoutBuilder', {
        selectedDate,
        shouldScheduleAfterCreate: true,
        initialDraftPayload: { drafts: [draft], activeIndex: 0 },
        skipDiscardConfirmOnBack: true,
        ...(isScheduleOriginTransition
          ? {
              transitionSource: 'scheduleDeck' as const,
              deckShellEntryFromRecentPicker: true,
            }
          : {}),
      });
      if (isScheduleOriginTransition) {
        pickerForwardOutSV.value = withTiming(0, SCHEDULE_DECK_WITH_TIMING_CONFIG);
      }
    },
    [exercises, isScheduleOriginTransition, navigation, pickerForwardOutSV, selectedDate, workoutTemplates],
  );

  const onPressBack = useCallback(() => {
    runCloseToSchedule();
  }, [runCloseToSchedule]);

  return (
    <Reanimated.View
      style={[
        styles.screen,
        { paddingTop: insets.top, backgroundColor: themeColors.canvasLight },
        isScheduleOriginTransition && scheduleDeckPickerCombinedStyle,
      ]}
    >
      <StatusBar style="dark" />

      <BackTextButton
        label="Home"
        chevronPointsLeft
        onPress={onPressBack}
        style={{ paddingHorizontal: SPACING.xxl, marginBottom: SPACING.md }}
        textStyle={{ color: themeColors.textMeta }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + SPACING.xxxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t('useRecentWorkoutPickerTitle')}</Text>

        {options.length === 0 ? (
          <Text style={[styles.empty, { color: themeColors.textMeta }]}>{t('noWorkoutHistoryYet')}</Text>
        ) : (
          <View style={styles.list}>
            {options.map(item => (
              <TouchableOpacity
                key={item.sourceScheduledWorkoutId}
                style={[styles.row, { width: cardWidth, backgroundColor: timerCardBackground }]}
                onPress={() => onSelectOption(item)}
                activeOpacity={0.85}
              >
                <View style={styles.rowTopRow}>
                  <Text style={[styles.rowMeta, { color: themeColors.textMeta }]}>
                    {dayjs(item.lastPerformedAt).format('MMM D, YYYY')}
                  </Text>
                  <View style={styles.rowChevron}>
                    <IconArrowDiagonal size={8} color={themeColors.textMeta} />
                  </View>
                </View>
                <Text style={[styles.rowTitle, { color: timerTitleInk }]} numberOfLines={2}>
                  {item.workoutName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </Reanimated.View>
  );
}

const themeColors = getAppThemeFromStore().colors;
const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
  },
  /** Match Today `scheduleHeaderTitle` (“Workout of the day”). */
  title: {
    ...TYPOGRAPHY.displayLarge,
    color: themeColors.containerPrimary,
    marginBottom: TITLE_TO_GRID_GAP_PX,
  },
  empty: {
    ...TYPOGRAPHY.body,
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: CARD_COLUMN_GAP,
    rowGap: CARD_COLUMN_GAP,
    paddingBottom: SPACING.sm,
  },
  /** Matches Today `footerEntryCard` shell + timer grid layout. */
  row: {
    borderRadius: 10,
    height: TIMER_PAGE_CARD_HEIGHT,
    paddingLeft: SPACING.lg,
    paddingRight: 6,
    paddingTop: 10,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  /** Same as Today `footerEntryTopRow`. */
  rowTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  /** Same as Today `footerEntryChevron`. */
  rowChevron: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Same as Today `footerEntryTitle`. */
  rowTitle: {
    ...TYPOGRAPHY.h3,
  },
  /** Same as Today `footerEntryMeta`. */
  rowMeta: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
  },
});