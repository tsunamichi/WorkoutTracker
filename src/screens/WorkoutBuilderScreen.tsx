import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  InteractionManager,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackActions, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Reanimated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import { SPACING, TYPOGRAPHY } from '../constants';
import { exploreV2UpNextQueueExerciseNameStyle } from '../components/exploreV2/exploreV2Tokens';
import { IconTrash } from '../components/icons';
import { useTranslation } from '../i18n/useTranslation';
import type { Exercise } from '../types';
import type { WorkoutTemplate } from '../types/training';
import type { WorkoutDraft, WorkoutDraftLine } from '../types/workoutDraft';
import { useAppTheme } from '../theme/useAppTheme';
import { EXECUTION_CTA_ROW_GAP } from '../components/execution/executionCtaTokens';
import { BackTextButton } from '../components/common/BackTextButton';
import { TertiaryButton } from '../components/common/UnderlinedActionButton';
import { newDraftId } from '../utils/workoutBuilderPaste';
import { findActiveTemplateByName } from '../utils/workoutNameCollision';
import { ExerciseSearchPickModal } from '../components/workoutBuilder/ExerciseSearchPickModal';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { getAppThemeFromStore } from '../theme/getAppThemeFromStore';
import {
  SCHEDULE_DECK_T,
  SCHEDULE_DECK_EXECUTION_INCOMING_SCALE_START,
  SCHEDULE_DECK_TRANSITION_MS,
  SCHEDULE_DECK_WITH_TIMING_CONFIG,
  useScheduleDeckTransition,
} from '../context/ScheduleDeckTransitionContext';

/** Bold exercise list on light builder canvas (matches product mock). */
const LIST_EXERCISE_INK = '#1B4332';

/** Match RecentWorkoutPickerScreen `title` (gap before cards / next section). */
const TITLE_TO_CONTENT_GAP_PX = 48;

type WorkoutBuilderRouteParams = {
  selectedDate?: string;
  shouldScheduleAfterCreate?: boolean;
  initialDraftPayload?: import('../types/workoutDraft').WorkoutBuilderInitialDraftPayload;
  transitionSource?: 'scheduleDeck';
  focusWorkoutNameOnOpen?: boolean;
  skipDiscardConfirmOnBack?: boolean;
  deckShellEntryFromRecentPicker?: boolean;
};

type WorkoutBuilderNavProp = NativeStackNavigationProp<RootStackParamList, 'WorkoutBuilder'>;
type WorkoutBuilderRouteProp = RouteProp<RootStackParamList, 'WorkoutBuilder'>;

export function WorkoutBuilderScreen() {
  const navigation = useNavigation<WorkoutBuilderNavProp>();
  const route = useRoute<WorkoutBuilderRouteProp>();
  const params = route.params as WorkoutBuilderRouteParams | undefined;
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { addWorkoutTemplate, updateWorkoutTemplate, scheduleWorkout, ensureUserExercise, workoutTemplates } = useStore();
  const exercises = useStore(s => s.exercises);
  const { t } = useTranslation();
  const { colors: themeColors } = useAppTheme();

  const transitionSource = params?.transitionSource;
  const isScheduleOriginTransition = transitionSource === 'scheduleDeck';
  /** Builder was pushed on top of RecentWorkoutPicker; back pops to picker with local shell animation (no shared reverse). */
  const deckShellEntryFromRecentPicker = params?.deckShellEntryFromRecentPicker === true;
  const {
    progress: scheduleDeckProgressSV,
    reset: resetScheduleDeckTransition,
    startReverseTransition: startScheduleDeckReverseTransition,
    primeRecentPickerIncomingParallel,
  } = useScheduleDeckTransition();
  const scheduleDeckTransitionActiveSV = useSharedValue(isScheduleOriginTransition ? 1 : 0);
  const allowScheduleDeckPopRef = useRef(false);
  const isClosingFromHeaderRef = useRef(false);

  useEffect(() => {
    scheduleDeckTransitionActiveSV.value = isScheduleOriginTransition ? 1 : 0;
  }, [isScheduleOriginTransition, scheduleDeckTransitionActiveSV]);

  /** Local 0→1 for picker→builder only; shared `scheduleDeckProgressSV` stays at 1 so home never flashes. */
  const recentPickerToBuilderEntrySV = useSharedValue(
    params?.deckShellEntryFromRecentPicker && isScheduleOriginTransition ? 0 : 1,
  );

  useEffect(() => {
    if (!params?.deckShellEntryFromRecentPicker || !isScheduleOriginTransition) return;
    recentPickerToBuilderEntrySV.value = withTiming(1, SCHEDULE_DECK_WITH_TIMING_CONFIG);
  }, [isScheduleOriginTransition, params?.deckShellEntryFromRecentPicker, recentPickerToBuilderEntrySV]);

  const scheduleDeckIncomingShellStyle = useAnimatedStyle(() => {
    if (scheduleDeckTransitionActiveSV.value === 0) {
      return {};
    }
    const entryStillRunning = recentPickerToBuilderEntrySV.value < 0.995;
    const p = entryStillRunning ? recentPickerToBuilderEntrySV.value : scheduleDeckProgressSV.value;
    const opacity = interpolate(p, [SCHEDULE_DECK_T.inStart, SCHEDULE_DECK_T.inOpacityEnd], [0, 1], Extrapolation.CLAMP);
    const scale = interpolate(
      p,
      [SCHEDULE_DECK_T.inStart, SCHEDULE_DECK_T.inEnd],
      [SCHEDULE_DECK_EXECUTION_INCOMING_SCALE_START, 1],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ scale }] };
  });

  const goBackAfterRecentPickerShellOut = useCallback(() => {
    allowScheduleDeckPopRef.current = true;
    isClosingFromHeaderRef.current = false;
    navigation.goBack();
  }, [navigation]);

  /** Reverse the local entry SV (1→0), then pop — mirrors forward picker→builder without touching shared deck progress. */
  const runCloseFromRecentPickerAnimated = useCallback(() => {
    if (isClosingFromHeaderRef.current) {
      allowScheduleDeckPopRef.current = true;
      navigation.goBack();
      return;
    }
    primeRecentPickerIncomingParallel();
    isClosingFromHeaderRef.current = true;
    recentPickerToBuilderEntrySV.value = withTiming(0, SCHEDULE_DECK_WITH_TIMING_CONFIG, finished => {
      if (finished) {
        runOnJS(goBackAfterRecentPickerShellOut)();
      } else {
        runOnJS(() => {
          isClosingFromHeaderRef.current = false;
        })();
      }
    });
  }, [goBackAfterRecentPickerShellOut, navigation, primeRecentPickerIncomingParallel, recentPickerToBuilderEntrySV]);

  const runCloseToSchedule = useCallback(() => {
    if (!isScheduleOriginTransition) {
      navigation.goBack();
      return;
    }
    if (deckShellEntryFromRecentPicker) {
      runCloseFromRecentPickerAnimated();
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
  }, [
    deckShellEntryFromRecentPicker,
    isScheduleOriginTransition,
    navigation,
    resetScheduleDeckTransition,
    runCloseFromRecentPickerAnimated,
    startScheduleDeckReverseTransition,
  ]);

  useEffect(() => {
    if (!isScheduleOriginTransition || !deckShellEntryFromRecentPicker) return undefined;
    return navigation.addListener('beforeRemove', e => {
      if (allowScheduleDeckPopRef.current) {
        allowScheduleDeckPopRef.current = false;
        return;
      }
      e.preventDefault();
      if (isClosingFromHeaderRef.current) {
        allowScheduleDeckPopRef.current = true;
        navigation.dispatch(e.data.action);
        return;
      }
      primeRecentPickerIncomingParallel();
      isClosingFromHeaderRef.current = true;
      recentPickerToBuilderEntrySV.value = withTiming(0, SCHEDULE_DECK_WITH_TIMING_CONFIG, finished => {
        if (finished) {
          runOnJS(() => {
            allowScheduleDeckPopRef.current = true;
            isClosingFromHeaderRef.current = false;
            navigation.dispatch(e.data.action);
          })();
        } else {
          runOnJS(() => {
            isClosingFromHeaderRef.current = false;
          })();
        }
      });
    });
  }, [deckShellEntryFromRecentPicker, isScheduleOriginTransition, navigation, primeRecentPickerIncomingParallel, recentPickerToBuilderEntrySV]);

  useEffect(() => {
    if (!isScheduleOriginTransition || deckShellEntryFromRecentPicker) return undefined;
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
  }, [deckShellEntryFromRecentPicker, isScheduleOriginTransition, navigation, resetScheduleDeckTransition, startScheduleDeckReverseTransition]);

  const workoutNameInputRef = useRef<TextInput>(null);
  useEffect(() => {
    if (!params?.focusWorkoutNameOnOpen) return undefined;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      const focusDelayMs = Math.max(0, Math.round(SCHEDULE_DECK_TRANSITION_MS * SCHEDULE_DECK_T.inOpacityEnd) - 48);
      timeoutId = setTimeout(() => {
        workoutNameInputRef.current?.focus();
      }, focusDelayMs);
    });
    return () => {
      cancelled = true;
      task.cancel();
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [params?.focusWorkoutNameOnOpen]);

  const [draftWorkouts, setDraftWorkouts] = useState<WorkoutDraft[]>(() => {
    const initial = params?.initialDraftPayload?.drafts;
    if (initial && initial.length > 0) return initial;
    return [{ id: newDraftId('wd'), name: '', lines: [] }];
  });
  const [activeWorkoutIndex, setActiveWorkoutIndex] = useState(
    () => params?.initialDraftPayload?.activeIndex ?? 0,
  );
  const pagerRef = useRef<FlatList<WorkoutDraft>>(null);
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [pickerInitialQuery, setPickerInitialQuery] = useState('');
  /** When set, library/custom pick assigns this row; when null, appends a new line */
  const [resolvingLineId, setResolvingLineId] = useState<string | null>(null);

  /** Full screen width so `pagingEnabled` aligns with each workout page. */
  const pageWidth = Math.max(0, windowWidth);
  const footerReserve = 100;

  const activeDraft = draftWorkouts[activeWorkoutIndex] ?? draftWorkouts[0];
  const showMultiWorkoutChrome = draftWorkouts.length > 1;

  const hasDraft = useMemo(
    () => draftWorkouts.some(w => w.name.trim().length > 0 || w.lines.length > 0),
    [draftWorkouts],
  );

  const defaultWorkoutLabel = useCallback(
    (index: number) => `${t('builderDefaultWorkoutName')} ${index + 1}`,
    [t],
  );

  const skipDiscardConfirmOnBack = params?.skipDiscardConfirmOnBack === true;

  const handleBack = () => {
    if (hasDraft && !skipDiscardConfirmOnBack) {
      Alert.alert(t('discardWorkout'), t('discardWorkoutMessage'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('discard'),
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (deckShellEntryFromRecentPicker) {
              runCloseFromRecentPickerAnimated();
            } else if (isScheduleOriginTransition) {
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
            } else {
              navigation.goBack();
            }
          },
        },
      ]);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      runCloseToSchedule();
    }
  };

  const resetCreationForm = useCallback(() => {
    setDraftWorkouts([{ id: newDraftId('wd'), name: '', lines: [] }]);
    setActiveWorkoutIndex(0);
    setResolvingLineId(null);
    useStore.getState().setScheduleDeckFocusAfterCreate(null);
  }, []);

  const openLibraryPickerForNewLine = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setResolvingLineId(null);
    setPickerInitialQuery('');
    setLibraryPickerOpen(true);
  }, []);

  const applyExerciseToTargetLine = useCallback(
    (ex: Exercise, targetLineId: string | null) => {
      setDraftWorkouts(prev =>
        prev.map((w, wi) => {
          if (wi !== activeWorkoutIndex) return w;
          if (targetLineId) {
            return {
              ...w,
              lines: w.lines.map(l =>
                l.id === targetLineId
                  ? {
                      ...l,
                      name: ex.name,
                      exerciseId: ex.id,
                      resolutionStatus: undefined,
                      matchCandidateIds: undefined,
                    }
                  : l,
              ),
            };
          }
          return {
            ...w,
            lines: [
              ...w.lines,
              {
                id: `line-${Date.now()}-${w.lines.length}`,
                name: ex.name,
                exerciseId: ex.id,
              },
            ],
          };
        }),
      );
      setResolvingLineId(null);
    },
    [activeWorkoutIndex],
  );

  const setActiveWorkoutName = useCallback((name: string) => {
    setDraftWorkouts(prev =>
      prev.map((w, i) => (i === activeWorkoutIndex ? { ...w, name } : w)),
    );
  }, [activeWorkoutIndex]);

  const removeLine = (workoutId: string, lineId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraftWorkouts(prev =>
      prev.map(w => (w.id !== workoutId ? w : { ...w, lines: w.lines.filter(l => l.id !== lineId) })),
    );
  };

  const persistWorkoutTemplate = async (w: WorkoutDraft, templateId: string, isNew: boolean) => {
    const now = new Date().toISOString();
    const items: WorkoutTemplate['items'] = [];
    for (let i = 0; i < w.lines.length; i++) {
      const line = w.lines[i]!;
      const seed = line.templateSeed;
      items.push({
        id: `tex-${templateId}-${i}`,
        exerciseId: line.exerciseId!,
        order: i,
        sets: typeof seed?.sets === 'number' && seed.sets > 0 ? seed.sets : 1,
        reps: seed?.reps ?? '',
        weight: seed?.weight,
        isTimeBased: seed?.isTimeBased,
        isPerSide: seed?.isPerSide,
        restSeconds: seed?.restSeconds,
        cycleId: seed?.cycleId,
        cycleOrder: seed?.cycleOrder,
      });
    }

    if (isNew) {
      const template: WorkoutTemplate = {
        id: templateId,
        name: w.name.trim(),
        createdAt: now,
        updatedAt: now,
        kind: 'workout',
        warmupItems: [],
        accessoryItems: [],
        items,
        lastUsedAt: null,
        usageCount: 0,
      };
      await addWorkoutTemplate(template);
    } else {
      await updateWorkoutTemplate(templateId, { items, name: w.name.trim() });
    }

    // Schedule for Home / Today when requested — must run for new *and* updated templates
    // (e.g. paste/history with linkedTemplateId, or "update existing" from name collision).
    if (params?.shouldScheduleAfterCreate && params?.selectedDate) {
      const result = await scheduleWorkout(params.selectedDate, templateId, 'manual');
      if (result.success) {
        const matches = useStore
          .getState()
          .scheduledWorkouts.filter(s => s.date === params.selectedDate && s.templateId === templateId);
        const sw = matches.sort((a, b) => a.id.localeCompare(b.id)).at(-1);
        if (sw) {
          useStore.getState().setScheduleDeckFocusAfterCreate({
            scheduledWorkoutId: sw.id,
            isoDate: params.selectedDate,
            templateId,
          });
        }
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (deckShellEntryFromRecentPicker) {
      /**
       * Same reverse handoff as blank create → Home (`runCloseToSchedule`): shared deck progress 1→0,
       * then pop builder + picker. `scheduleDeckBypassPickerBeforeRemove` skips picker `beforeRemove` animation.
       */
      useStore.getState().setScheduleDeckBypassPickerBeforeRemove(true);
      isClosingFromHeaderRef.current = true;
      startScheduleDeckReverseTransition(finished => {
        if (!finished) {
          isClosingFromHeaderRef.current = false;
          return;
        }
        allowScheduleDeckPopRef.current = true;
        resetScheduleDeckTransition();
        navigation.dispatch(StackActions.pop(2));
        isClosingFromHeaderRef.current = false;
      });
      return;
    }
    allowScheduleDeckPopRef.current = true;
    if (isScheduleOriginTransition) {
      resetScheduleDeckTransition();
    }
    navigation.goBack();
  };

  const handleSaveWorkout = async () => {
    const w = draftWorkouts[activeWorkoutIndex];
    if (!w) return;
    if (!w.name.trim()) {
      Alert.alert(t('enterWorkoutName'), t('pleaseEnterWorkoutName'));
      return;
    }
    if (w.lines.length === 0) {
      Alert.alert(t('noExercisesSelected'), t('pleaseAddExercises'));
      return;
    }

    const unresolved = w.lines.filter(l => !l.exerciseId || l.resolutionStatus === 'needs_pick');
    if (unresolved.length > 0) {
      Alert.alert(t('alertErrorTitle'), t('resolveExercisesBeforeSave'));
      return;
    }

    if (w.requiresRenameBeforeSave) {
      const collision = findActiveTemplateByName(workoutTemplates, w.name);
      if (collision) {
        Alert.alert(t('renameRequiredTitle'), t('renameRequiredBody'));
        return;
      }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (w.linkedTemplateId) {
      await persistWorkoutTemplate(w, w.linkedTemplateId, false);
      return;
    }

    const existing = findActiveTemplateByName(workoutTemplates, w.name);
    if (existing) {
      Alert.alert(t('workoutExistsTitle'), t('workoutExistsBody'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('updateExistingWorkout'),
          onPress: () => void persistWorkoutTemplate(w, existing.id, false),
        },
        { text: t('chooseDifferentName'), onPress: () => openLibraryPickerForNewLine() },
      ]);
      return;
    }

    const templateId = `wt-${Date.now()}`;
    await persistWorkoutTemplate(w, templateId, true);
  };

  const onPagerMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth <= 0) return;
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / pageWidth);
      const clamped = Math.max(0, Math.min(idx, draftWorkouts.length - 1));
      setActiveWorkoutIndex(clamped);
    },
    [pageWidth, draftWorkouts.length],
  );

  const onTabPress = useCallback((index: number) => {
    Haptics.selectionAsync();
    setActiveWorkoutIndex(index);
    pagerRef.current?.scrollToOffset({ offset: index * pageWidth, animated: true });
  }, [pageWidth]);

  const openPickerForLine = useCallback((lineId: string, initial: string) => {
    setResolvingLineId(lineId);
    setPickerInitialQuery(initial);
    setLibraryPickerOpen(true);
  }, []);

  const renderExercisePage = useCallback(
    ({ item }: { item: WorkoutDraft }) => (
      <View style={[styles.page, { width: pageWidth }]}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.pageScrollContent, { paddingBottom: insets.bottom + footerReserve }]}
        >
          <View style={styles.listBlock}>
            {item.lines.map(line => {
              const needsPick = !line.exerciseId;
              return (
                <View key={line.id} style={styles.exerciseRow}>
                  <TouchableOpacity
                    style={styles.exerciseRowLabelWrap}
                    onPress={() => {
                      if (needsPick) openPickerForLine(line.id, line.name);
                    }}
                    disabled={!needsPick}
                    activeOpacity={needsPick ? 0.7 : 1}
                  >
                    <Text
                      style={[
                        styles.exerciseRowText,
                        needsPick && { color: themeColors.signalNegative },
                      ]}
                      numberOfLines={3}
                    >
                      {line.name}
                      {needsPick ? ` — ${t('chooseFromLibrary')}` : ''}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeLine(item.id, line.id)}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('remove')}: ${line.name}`}
                  >
                    <IconTrash size={20} color={themeColors.signalNegative} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    ),
    [pageWidth, insets.bottom, footerReserve, t, openPickerForLine],
  );

  const canvas = themeColors.canvasLight;
  const meta = themeColors.textMeta;

  return (
    <Reanimated.View
      style={[
        styles.safe,
        {
          backgroundColor: canvas,
          /** Manual top inset: `SafeAreaView` + animated transform under transparent modal can under-apply top padding. */
          paddingTop: insets.top,
        },
        isScheduleOriginTransition && scheduleDeckIncomingShellStyle,
      ]}
    >
      <View style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <View style={styles.column}>
          {/**
           * Match RecentWorkoutPickerScreen: back row uses the same BackTextButton padding as that page,
           * then title/tabs sit in a padded block — avoids double `paddingTop` vs the picker.
           */}
          <BackTextButton
            label={deckShellEntryFromRecentPicker ? t('useRecentWorkoutPickerTitle') : 'Home'}
            onPress={handleBack}
            chevronPointsLeft
            style={{ paddingHorizontal: SPACING.xxl, marginBottom: SPACING.md }}
            textStyle={{ color: meta }}
          />

          <View style={[styles.headerBlock, { paddingHorizontal: SPACING.xxl }]}>
            {showMultiWorkoutChrome ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.tabRow}
                accessibilityRole="tablist"
              >
                {draftWorkouts.map((w, i) => {
                  const tabNumber = String(i + 1);
                  const nameForA11y = w.name.trim() || defaultWorkoutLabel(i);
                  const active = i === activeWorkoutIndex;
                  return (
                    <TouchableOpacity
                      key={w.id}
                      onPress={() => onTabPress(i)}
                      style={styles.tabChip}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${tabNumber}. ${nameForA11y}`}
                    >
                      <Text
                        style={[styles.tabChipText, { color: active ? LIST_EXERCISE_INK : meta }]}
                        numberOfLines={1}
                      >
                        {tabNumber}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}

            <TextInput
              ref={workoutNameInputRef}
              style={styles.titleInput}
              placeholder={t('workoutName')}
              placeholderTextColor={themeColors.textMeta}
              value={activeDraft?.name ?? ''}
              onChangeText={setActiveWorkoutName}
              autoCapitalize="sentences"
              returnKeyType="next"
              onSubmitEditing={openLibraryPickerForNewLine}
              accessibilityLabel={t('workoutName')}
            />
          </View>

          <FlatList
            ref={pagerRef}
            style={styles.pager}
            data={draftWorkouts}
            keyExtractor={w => w.id}
            horizontal
            pagingEnabled
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            renderItem={renderExercisePage}
            onMomentumScrollEnd={onPagerMomentumEnd}
            getItemLayout={(_, index) => ({
              length: pageWidth,
              offset: pageWidth * index,
              index,
            })}
            extraData={{ activeWorkoutIndex, draftWorkouts }}
          />
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: canvas }]}>
          <View style={styles.footerActionsRow}>
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: themeColors.containerPrimary }]}
              onPress={handleSaveWorkout}
              activeOpacity={0.9}
            >
              <Text style={[styles.createButtonText, { color: themeColors.containerSecondary }]}>
                {t('createWorkout')}
              </Text>
            </TouchableOpacity>
            <TertiaryButton
              label={t('addExercise')}
              onPress={openLibraryPickerForNewLine}
              activeOpacity={0.85}
              style={styles.footerAddExerciseButton}
              textStyle={styles.footerAddExerciseText}
              color={themeColors.containerPrimary}
              underlineColor={themeColors.containerPrimary}
              accessibilityLabel={t('addExercise')}
            />
          </View>
        </View>

        <ExerciseSearchPickModal
          visible={libraryPickerOpen}
          exercises={exercises}
          initialQuery={pickerInitialQuery}
          onClose={() => {
            setLibraryPickerOpen(false);
            setResolvingLineId(null);
          }}
          onSelectExercise={ex => {
            applyExerciseToTargetLine(ex, resolvingLineId);
          }}
          onCreateCustom={async name => {
            const def = await ensureUserExercise(name);
            applyExerciseToTargetLine(def, resolvingLineId);
          }}
        />
      </KeyboardAvoidingView>
      </View>
    </Reanimated.View>
  );
}

const themeColors = getAppThemeFromStore().colors;
const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  column: {
    flex: 1,
  },
  headerBlock: {
    flexShrink: 0,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingBottom: SPACING.sm,
    flexWrap: 'nowrap',
  },
  tabChip: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    maxWidth: 200,
  },
  tabChipText: {
    ...TYPOGRAPHY.body,
    fontWeight: '500',
  },
  pager: {
    flex: 1,
    alignSelf: 'stretch',
  },
  page: {
    flex: 1,
  },
  pageScrollContent: {
    paddingHorizontal: SPACING.xxl,
    /** 48px below title comes from `titleInput.marginBottom`. */
    paddingTop: 0,
  },
  /**
   * Match RecentWorkoutPickerScreen page title: `TYPOGRAPHY.displayLarge`, primary ink, 48px below before next block.
   */
  titleInput: {
    ...TYPOGRAPHY.displayLarge,
    color: themeColors.textPrimary,
    paddingVertical: 0,
    paddingHorizontal: 0,
    marginBottom: TITLE_TO_CONTENT_GAP_PX,
    minHeight: TYPOGRAPHY.displayLarge.lineHeight,
    ...Platform.select({
      android: { includeFontPadding: false },
      default: {},
    }),
  },
  listBlock: {
    gap: SPACING.xl,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.lg,
  },
  exerciseRowLabelWrap: {
    flex: 1,
  },
  exerciseRowText: {
    flex: 1,
    ...exploreV2UpNextQueueExerciseNameStyle,
    color: LIST_EXERCISE_INK,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  footerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: EXECUTION_CTA_ROW_GAP,
  },
  createButton: {
    height: 56,
    paddingHorizontal: SPACING.xxl,
    /** Match Explore v2 Current card log CTA (`ctaPill`). */
    borderRadius: 14,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  createButtonText: {
    ...TYPOGRAPHY.body,
  },
  /** Same as Current card pagination Add (`addSetTertiaryButton` + `addSetTertiaryLinkText`). */
  footerAddExerciseButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    flexShrink: 0,
  },
  footerAddExerciseText: {
    ...TYPOGRAPHY.meta,
    fontWeight: '400',
  },
});