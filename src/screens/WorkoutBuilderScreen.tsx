import React, { useState, useRef, useCallback, useMemo } from 'react';
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
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants';
import { exploreV2UpNextQueueExerciseNameStyle } from '../components/exploreV2/exploreV2Tokens';
import { IconTrash } from '../components/icons';
import { useTranslation } from '../i18n/useTranslation';
import type { Exercise } from '../types';
import type { WorkoutTemplate } from '../types/training';
import type { WorkoutDraft } from '../types/workoutDraft';
import { useAppTheme } from '../theme/useAppTheme';
import { EXECUTION_CTA_ROW_GAP } from '../components/execution/executionCtaTokens';
import { BackTextButton } from '../components/common/BackTextButton';
import { newDraftId, parseBuilderPasteAll } from '../utils/workoutBuilderPaste';
import { findActiveTemplateByName } from '../utils/workoutNameCollision';

/** Bold exercise list on light builder canvas (matches product mock). */
const LIST_EXERCISE_INK = '#1B4332';

type WorkoutBuilderRouteParams = {
  selectedDate?: string;
  shouldScheduleAfterCreate?: boolean;
  initialDraftPayload?: import('../types/workoutDraft').WorkoutBuilderInitialDraftPayload;
};

export function WorkoutBuilderScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as WorkoutBuilderRouteParams | undefined;
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { addWorkoutTemplate, updateWorkoutTemplate, scheduleWorkout, addExercise, workoutTemplates } = useStore();
  const { t } = useTranslation();
  const { colors: themeColors, explore } = useAppTheme();

  const [draftWorkouts, setDraftWorkouts] = useState<WorkoutDraft[]>(() => {
    const initial = params?.initialDraftPayload?.drafts;
    if (initial && initial.length > 0) return initial;
    return [{ id: newDraftId('wd'), name: '', lines: [] }];
  });
  const [activeWorkoutIndex, setActiveWorkoutIndex] = useState(
    () => params?.initialDraftPayload?.activeIndex ?? 0,
  );
  const [exerciseInput, setExerciseInput] = useState('');
  const exerciseInputRef = useRef<TextInput>(null);
  const pagerRef = useRef<FlatList<WorkoutDraft>>(null);

  /** Full screen width so `pagingEnabled` aligns with each workout page. */
  const pageWidth = Math.max(0, windowWidth);
  const footerReserve = 100;

  const activeDraft = draftWorkouts[activeWorkoutIndex] ?? draftWorkouts[0];
  const showMultiWorkoutChrome = draftWorkouts.length > 1;

  const hasAnyExercise = useMemo(
    () => draftWorkouts.some(w => w.lines.length > 0),
    [draftWorkouts],
  );

  const hasDraft = useMemo(
    () =>
      draftWorkouts.some(w => w.name.trim().length > 0 || w.lines.length > 0) ||
      exerciseInput.trim().length > 0,
    [draftWorkouts, exerciseInput],
  );

  const defaultWorkoutLabel = useCallback(
    (index: number) => `${t('builderDefaultWorkoutName')} ${index + 1}`,
    [t],
  );

  const handleBack = () => {
    if (hasDraft) {
      Alert.alert(t('discardWorkout'), t('discardWorkoutMessage'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('discard'),
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            navigation.goBack();
          },
        },
      ]);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.goBack();
    }
  };

  const resetCreationForm = useCallback(() => {
    setDraftWorkouts([{ id: newDraftId('wd'), name: '', lines: [] }]);
    setActiveWorkoutIndex(0);
    setExerciseInput('');
    useStore.getState().setScheduleDeckFocusAfterCreate(null);
  }, []);

  const promptPostSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(t('workoutCreatedTitle'), t('workoutCreatedBody'), [
      {
        text: t('createAnotherWorkout'),
        style: 'default',
        onPress: () => resetCreationForm(),
      },
      {
        text: t('done'),
        style: 'default',
        onPress: () => navigation.goBack(),
      },
    ]);
  };

  const focusAddExercise = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    requestAnimationFrame(() => exerciseInputRef.current?.focus());
  }, []);

  const setActiveWorkoutName = useCallback((name: string) => {
    setDraftWorkouts(prev =>
      prev.map((w, i) => (i === activeWorkoutIndex ? { ...w, name } : w)),
    );
  }, [activeWorkoutIndex]);

  const handlePasteFromClipboard = useCallback(async () => {
    const content = await Clipboard.getStringAsync();
    if (!content?.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(t('alertErrorTitle'), t('clipboardEmpty'));
      return;
    }
    const parsedWorkouts = parseBuilderPasteAll(content);
    if (parsedWorkouts.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(t('alertErrorTitle'), t('pasteNoExercisesFound'));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (parsedWorkouts.length >= 2) {
      const batch = Date.now();
      setDraftWorkouts(
        parsedWorkouts.map((pw, i) => ({
          id: `wd-${batch}-${i}`,
          name: pw.workoutName.trim() ? pw.workoutName.trim() : defaultWorkoutLabel(i),
          lines: pw.exercises.map((name, j) => ({
            id: `line-paste-${batch}-${i}-${j}`,
            name: name.trim(),
          })),
        })),
      );
      setActiveWorkoutIndex(0);
      requestAnimationFrame(() => {
        pagerRef.current?.scrollToOffset({ offset: 0, animated: false });
        exerciseInputRef.current?.focus();
      });
      return;
    }

    const p = parsedWorkouts[0];
    setDraftWorkouts(prev => {
      const idx = Math.min(activeWorkoutIndex, Math.max(0, prev.length - 1));
      return prev.map((w, i) => {
        if (i !== idx) return w;
        const existing = new Set(w.lines.map(l => l.name.trim().toLowerCase()));
        const toAdd = p.exercises.filter(e => !existing.has(e.trim().toLowerCase()));
        const base = w.lines.length;
        const mergedName =
          p.workoutName.trim() && !w.name.trim() ? p.workoutName.trim() : w.name;
        return {
          ...w,
          name: mergedName,
          lines: [
            ...w.lines,
            ...toAdd.map((name, j) => ({
              id: `line-paste-${Date.now()}-${base + j}`,
              name: name.trim(),
            })),
          ],
        };
      });
    });
    requestAnimationFrame(() => exerciseInputRef.current?.focus());
  }, [t, activeWorkoutIndex, defaultWorkoutLabel]);

  const handleClearAllEntries = useCallback(() => {
    Alert.alert(t('clearBuilderEntriesTitle'), t('clearBuilderEntriesMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('clear'),
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          resetCreationForm();
        },
      },
    ]);
  }, [t, resetCreationForm]);

  const commitExerciseLine = useCallback(() => {
    const name = exerciseInput.trim();
    if (!name) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraftWorkouts(prev =>
      prev.map((w, i) => {
        if (i !== activeWorkoutIndex) return w;
        return {
          ...w,
          lines: [...w.lines, { id: `line-${Date.now()}-${w.lines.length}`, name }],
        };
      }),
    );
    setExerciseInput('');
    requestAnimationFrame(() => exerciseInputRef.current?.focus());
  }, [exerciseInput, activeWorkoutIndex]);

  const removeLine = (workoutId: string, lineId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraftWorkouts(prev =>
      prev.map(w => (w.id !== workoutId ? w : { ...w, lines: w.lines.filter(l => l.id !== lineId) })),
    );
  };

  const resolveExerciseIdForName = async (name: string, index: number): Promise<string> => {
    const trimmed = name.trim();
    const lib = useStore.getState().exercises.find(ex => ex.name.toLowerCase() === trimmed.toLowerCase());
    if (lib) return lib.id;
    const id = `ex-user-${Date.now()}-${index}`;
    const newEx: Exercise = {
      id,
      name: trimmed,
      category: 'Other',
      isCustom: true,
    };
    await addExercise(newEx);
    return id;
  };

  const persistWorkoutTemplate = async (w: WorkoutDraft, templateId: string, isNew: boolean) => {
    const now = new Date().toISOString();
    const items: WorkoutTemplate['items'] = [];
    for (let i = 0; i < w.lines.length; i++) {
      const exerciseId = await resolveExerciseIdForName(w.lines[i].name, i);
      items.push({
        id: `tex-${templateId}-${i}`,
        exerciseId,
        order: i,
        sets: 1,
        reps: '',
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

    if (isNew && params?.shouldScheduleAfterCreate && params?.selectedDate) {
      await scheduleWorkout(params.selectedDate, templateId, 'manual');
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

    promptPostSave();
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
        { text: t('chooseDifferentName'), onPress: () => focusAddExercise() },
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

  const renderExercisePage = useCallback(
    ({ item }: { item: WorkoutDraft }) => (
      <View style={[styles.page, { width: pageWidth }]}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.pageScrollContent, { paddingBottom: insets.bottom + footerReserve }]}
        >
          <View style={styles.listBlock}>
            {item.lines.map(line => (
              <View key={line.id} style={styles.exerciseRow}>
                <Text style={styles.exerciseRowText}>{line.name}</Text>
                <TouchableOpacity
                  onPress={() => removeLine(item.id, line.id)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('remove')}: ${line.name}`}
                >
                  <IconTrash size={20} color={COLORS.signalNegative} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    ),
    [pageWidth, insets.bottom, footerReserve, t],
  );

  const canvas = themeColors.canvasLight;
  const meta = themeColors.textMeta;
  /** Same token as Explore / HIIT work-timer card surfaces (`containerTertiaryTimer`). */
  const pasteTimerCardBackground = explore.workTimerCompleteCardBg;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: canvas }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <View style={styles.column}>
          <View style={[styles.headerBlock, { paddingHorizontal: SPACING.xxl, paddingTop: SPACING.sm }]}>
            <BackTextButton
              label="Home"
              onPress={handleBack}
              chevronPointsLeft
              style={{ paddingHorizontal: 0, marginBottom: SPACING.md }}
              textStyle={{ color: meta }}
            />

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
              style={[styles.titleInput, { color: COLORS.textPrimary }]}
              placeholder={t('workoutName')}
              placeholderTextColor={COLORS.textMeta}
              value={activeDraft?.name ?? ''}
              onChangeText={setActiveWorkoutName}
              autoCapitalize="sentences"
              returnKeyType="next"
              onSubmitEditing={focusAddExercise}
              accessibilityLabel={t('workoutName')}
            />

            <TextInput
              ref={exerciseInputRef}
              style={[styles.titleInput, { color: COLORS.textPrimary }]}
              placeholder={t('addExerciseCta')}
              placeholderTextColor={meta}
              value={exerciseInput}
              onChangeText={setExerciseInput}
              onSubmitEditing={commitExerciseLine}
              returnKeyType="done"
              blurOnSubmit={false}
              autoCapitalize="words"
              accessibilityLabel={t('addExerciseCta')}
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
            <TouchableOpacity
              style={[styles.pasteButton, { backgroundColor: pasteTimerCardBackground }]}
              onPress={hasAnyExercise ? handleClearAllEntries : handlePasteFromClipboard}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={hasAnyExercise ? t('clear') : t('pasteWorkout')}
            >
              <Text style={[styles.pasteButtonText, { color: themeColors.containerPrimary }]}>
                {hasAnyExercise ? t('clear') : t('pasteWorkout')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
    paddingTop: SPACING.xs,
  },
  /**
   * Match Today schedule title size/spacing (`displayLarge`).
   * `TextInput` draws large system text heavier than `Text` at weight 500; use regular so it reads like the home header.
   */
  titleInput: {
    fontSize: TYPOGRAPHY.displayLarge.fontSize,
    lineHeight: TYPOGRAPHY.displayLarge.lineHeight,
    letterSpacing: TYPOGRAPHY.displayLarge.letterSpacing,
    fontWeight: '400',
    paddingVertical: SPACING.sm,
    paddingHorizontal: 0,
    marginBottom: SPACING.lg,
    minHeight: 48,
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.lg,
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
    justifyContent: 'flex-start',
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
    flexShrink: 0,
  },
  createButtonText: {
    ...TYPOGRAPHY.body,
  },
  pasteButton: {
    height: 56,
    paddingHorizontal: SPACING.xxl,
    borderRadius: 14,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasteButtonText: {
    ...TYPOGRAPHY.body,
  },
});
