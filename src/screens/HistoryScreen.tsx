import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Reanimated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants';
import { useAppTheme } from '../theme/useAppTheme';
import { BackTextButton } from '../components/common/BackTextButton';
import { FourWeekActivityChart } from '../components/history/FourWeekActivityChart';
import { HistoryWorkoutDetailPanel } from '../components/history/HistoryWorkoutDetailPanel';
import { HISTORY_VISUAL } from '../components/history/historyVisualTokens';
import { useStore } from '../store';
import { buildWorkoutHistoryByDateFromSchedule } from '../utils/buildWorkoutHistoryByDateFromSchedule';
import { pickDefaultHistorySelection } from '../utils/historyDefaultSelection';
import {
  buildSundayFirstFourWeekGrid,
  formatHistorySelectedHeading,
} from '../utils/historyWeekGrid';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  SCHEDULE_DECK_T,
  SCHEDULE_DECK_EXECUTION_INCOMING_SCALE_START,
  useScheduleDeckTransition,
} from '../context/ScheduleDeckTransitionContext';

type HistoryNavProp = NativeStackNavigationProp<RootStackParamList, 'History'>;
type HistoryRouteProp = RouteProp<RootStackParamList, 'History'>;

export function HistoryScreen() {
  const navigation = useNavigation<HistoryNavProp>();
  const route = useRoute<HistoryRouteProp>();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useAppTheme();
  const scheduledWorkouts = useStore(s => s.scheduledWorkouts);
  const getMainCompletion = useStore(s => s.getMainCompletion);
  const detailedWorkoutProgress = useStore(s => s.detailedWorkoutProgress);
  const exercises = useStore(s => s.exercises);
  const settings = useStore(s => s.settings);

  const transitionSource = route.params?.transitionSource;
  const isScheduleOriginTransition = transitionSource === 'scheduleDeck';
  const {
    progress: scheduleDeckProgressSV,
    reset: resetScheduleDeckTransition,
    startReverseTransition: startScheduleDeckReverseTransition,
  } = useScheduleDeckTransition();
  const scheduleDeckTransitionActiveSV = useSharedValue(isScheduleOriginTransition ? 1 : 0);
  const allowScheduleDeckPopRef = useRef(false);
  const isClosingFromHeaderRef = useRef(false);

  useEffect(() => {
    scheduleDeckTransitionActiveSV.value = isScheduleOriginTransition ? 1 : 0;
  }, [isScheduleOriginTransition, scheduleDeckTransitionActiveSV]);

  /** Same incoming shell as ExerciseExecution (shared schedule-deck timeline). */
  const scheduleDeckIncomingShellStyle = useAnimatedStyle(() => {
    if (scheduleDeckTransitionActiveSV.value === 0) {
      return {};
    }
    const p = scheduleDeckProgressSV.value;
    const opacity = interpolate(p, [SCHEDULE_DECK_T.inStart, SCHEDULE_DECK_T.inOpacityEnd], [0, 1], Extrapolation.CLAMP);
    const scale = interpolate(
      p,
      [SCHEDULE_DECK_T.inStart, SCHEDULE_DECK_T.inEnd],
      [SCHEDULE_DECK_EXECUTION_INCOMING_SCALE_START, 1],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ scale }] };
  });

  const runCloseToScheduleCard = useCallback(() => {
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

  const reference = useMemo(() => dayjs().startOf('day'), []);
  const rows = useMemo(() => buildSundayFirstFourWeekGrid(reference), [reference]);
  const byDate = useMemo(
    () =>
      buildWorkoutHistoryByDateFromSchedule(
        scheduledWorkouts,
        getMainCompletion,
        detailedWorkoutProgress,
        exercises,
        settings?.useKg ?? false,
      ),
    [scheduledWorkouts, getMainCompletion, detailedWorkoutProgress, exercises, settings?.useKg],
  );
  const completedIsoSet = useMemo(() => new Set(byDate.keys()), [byDate]);

  const [selectedIso, setSelectedIso] = useState(() =>
    pickDefaultHistorySelection(rows, completedIsoSet, reference),
  );

  const selectedEntry = byDate.get(selectedIso) ?? null;
  const selectedHeading = formatHistorySelectedHeading(selectedIso);
  const todayIso = reference.format('YYYY-MM-DD');

  const onSelectIso = useCallback((iso: string) => {
    setSelectedIso(iso);
  }, []);

  const onPressBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    runCloseToScheduleCard();
  }, [runCloseToScheduleCard]);

  return (
    <Reanimated.View
      style={[
        styles.screen,
        { paddingTop: insets.top, backgroundColor: themeColors.canvasLight },
        isScheduleOriginTransition && scheduleDeckIncomingShellStyle,
      ]}
    >
      <StatusBar style="dark" />

      <BackTextButton label="Home" chevronPointsLeft onPress={onPressBack} textStyle={styles.backText} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + SPACING.xxxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleBlock}>
          <Text style={styles.titlePrimary}>History</Text>
          <Text style={styles.titleSecondary}>Last 4 weeks</Text>
        </View>

        <View style={{ height: SPACING.xxxl }} />

        <FourWeekActivityChart
          rows={rows}
          selectedIso={selectedIso}
          completedIsoSet={completedIsoSet}
          todayIso={todayIso}
          onSelectIso={onSelectIso}
          completedWorkoutColor={themeColors.containerPrimary}
          emptyDayFill={themeColors.containerSecondary}
        />

        <View style={{ height: SPACING.xxxl + SPACING.md }} />

        <HistoryWorkoutDetailPanel entry={selectedEntry} selectedDateLabel={selectedHeading} />
      </ScrollView>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  backText: {
    color: HISTORY_VISUAL.textGray,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
  },
  titleBlock: {
    marginTop: SPACING.sm,
  },
  /** Match Today schedule header (`scheduleHeaderTitle` / `scheduleHeaderDateLabel`). */
  titlePrimary: {
    ...TYPOGRAPHY.displayLarge,
    color: COLORS.textPrimary,
  },
  titleSecondary: {
    ...TYPOGRAPHY.displayLarge,
    color: COLORS.textMeta,
  },
});
