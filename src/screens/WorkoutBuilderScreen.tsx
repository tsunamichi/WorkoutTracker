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
import type { WorkoutDraft, WorkoutDraftLine } from '../types/workoutDraft';
import { useAppTheme } from '../theme/useAppTheme';
import { EXECUTION_CTA_ROW_GAP } from '../components/execution/executionCtaTokens';
import { BackTextButton } from '../components/common/BackTextButton';
import { newDraftId, parseBuilderPasteAll } from '../utils/workoutBuilderPaste';
import { findActiveTemplateByName } from '../utils/workoutNameCollision';
import { draftLineFromImportedName, buildCustomExerciseDefinition } from '../utils/exerciseIdentity';
import { ExerciseSearchPickModal } from '../components/workoutBuilder/ExerciseSearchPickModal';

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
  const exercises = useStore(s => s.exercises);
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

  const hasAnyExercise = useMemo(
    () => draftWorkouts.some(w => w.lines.length > 0),
    [draftWorkouts],
  );

  const hasDraft = useMemo(
    () => draftWorkouts.some(w => w.name.trim().length > 0 || w.lines.length > 0),
    [draftWorkouts],
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
          lines: pw.exercises.map((name, j) =>
            draftLineFromImportedName(name, `line-paste-${batch}-${i}-${j}`, exercises),
          ),
        })),
      );
      setActiveWorkoutIndex(0);
      requestAnimationFrame(() => {
        pagerRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
      return;
    }

    const p = parsedWorkouts[0];
    setDraftWorkouts(prev => {
      const idx = Math.min(activeWorkoutIndex, Math.max(0, prev.length - 1));
      return prev.map((w, i) => {
        if (i !== idx) return w;
        const existing = new Set(
          w.lines.map(l => (l.exerciseId ?? l.name).trim().toLowerCase()),
        );
        const toAdd = p.exercises.filter(e => !existing.has(e.trim().toLowerCase()));
        const base = w.lines.length;
        const mergedName =
          p.workoutName.trim() && !w.name.trim() ? p.workoutName.trim() : w.name;
        return {
          ...w,
          name: mergedName,
          lines: [
            ...w.lines,
            ...toAdd.map((name, j) =>
              draftLineFromImportedName(name, `line-paste-${Date.now()}-${base + j}`, exercises),
            ),
          ],
        };
      });
    });
  }, [t, activeWorkoutIndex, defaultWorkoutLabel, exercises]);

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
      items.push({
        id: `tex-${templateId}-${i}`,
        exerciseId: line.exerciseId!,
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
                        needsPick && { color: COLORS.signalNegative },
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
                    <IconTrash size={20} color={COLORS.signalNegative} />
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
              onSubmitEditing={openLibraryPickerForNewLine}
              accessibilityLabel={t('workoutName')}
            />

            <View style={styles.addExerciseActions}>
              <TouchableOpacity
                style={styles.addExerciseLinkTouch}
                onPress={openLibraryPickerForNewLine}
                hitSlop={8}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={t('addExercise')}
              >
                <Text style={[styles.addExerciseLinkText, { color: meta, borderBottomColor: meta }]}>
                  {t('addExerciseCta')}
                </Text>
              </TouchableOpacity>
            </View>
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
            const def = buildCustomExerciseDefinition(name, Date.now());
            await addExercise(def);
            applyExerciseToTargetLine(def, resolvingLineId);
          }}
        />
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
  addExerciseActions: {
    marginBottom: SPACING.lg,
  },
  /** Matches Explore v2 Up Next “+ add” link (`ExploreV2UpNextCard` action row). */
  addExerciseLinkTouch: {
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  addExerciseLinkText: {
    ...TYPOGRAPHY.h1,
    borderBottomWidth: 1,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
