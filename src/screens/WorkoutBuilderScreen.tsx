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
import { useAppTheme } from '../theme/useAppTheme';
import { EXECUTION_CTA_ROW_GAP } from '../components/execution/executionCtaTokens';
import { BackTextButton } from '../components/common/BackTextButton';

/** Bold exercise list on light builder canvas (matches product mock). */
const LIST_EXERCISE_INK = '#1B4332';

type DraftLine = { id: string; name: string };

type WorkoutDraft = { id: string; name: string; lines: DraftLine[] };

function normalizePasteLine(s: string) {
  return s.replace(/\t/g, ' ').trim();
}

function stripLeadingBullet(s: string) {
  return s.replace(/^[•\u2022\-*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
}

/** Keep exercise name only; strip trailing sets/reps/weight from pasted plan lines. */
function stripExerciseMetadata(namePart: string): string {
  const s = namePart.replace(/[—–]/g, '-').replace(/×/g, 'x').trim();
  const mSplit = s.match(/^(.*?)(?:\s+-\s+|\s+)(\d+\s*x\s*\d+.*)$/i);
  if (mSplit) return mSplit[1].trim().replace(/[-–—]\s*$/, '').trim();
  const idx = s.search(/\b\d+\s*x\s*\d+/i);
  if (idx > 0) return s.slice(0, idx).trim().replace(/[-–—]\s*$/, '').trim();
  const atIdx = s.indexOf('@');
  if (atIdx > 0) return s.slice(0, atIdx).trim();
  return s.trim();
}

function lineLooksLikeExercise(line: string): boolean {
  const trimmed = line.trim();
  const t = stripLeadingBullet(line);
  if (!t) return false;
  if (/^warm\s*up/i.test(t)) return false;
  if (/^(?:WEEK\s+\d+\s+)?DAY\s+\d+/i.test(trimmed)) return false;
  if (/^day\s+\d+\s*[—\-:]/i.test(trimmed)) return false;
  if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) return true;
  if (/^\d+\.\s/.test(trimmed)) return true;
  if (/\b\d+\s*x\s*\d+/i.test(t)) return true;
  if (/@\s*[\d.]/i.test(t)) return true;
  return false;
}

/** Parse clipboard text into an optional workout title and exercise names (builder-friendly). */
function parseBuilderPaste(text: string): { workoutName?: string; exercises: string[] } {
  const lines = text.split(/\r?\n/).map(normalizePasteLine).filter(l => l.length > 0);
  const exercises: string[] = [];
  let workoutName: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dayMatch = line.match(/^(?:WEEK\s+\d+\s+)?DAY\s+\d+\s*[—\-:]\s*(.+)$/i);
    if (dayMatch) {
      workoutName = dayMatch[1].trim();
      continue;
    }
    if (/^warm\s*up/i.test(line)) continue;

    if (lineLooksLikeExercise(line)) {
      exercises.push(stripExerciseMetadata(stripLeadingBullet(line)));
      continue;
    }

    const secondIsExercise = lines.length > 1 && lineLooksLikeExercise(lines[1]);
    if (i === 0 && !workoutName && lines.length > 1 && secondIsExercise) {
      workoutName = line;
      continue;
    }

    const stripped = stripExerciseMetadata(stripLeadingBullet(line));
    if (stripped.length > 0) exercises.push(stripped);
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const e of exercises) {
    const key = e.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(e);
  }
  return { workoutName, exercises: deduped };
}

function splitByDayHeaders(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const chunks: string[] = [];
  let buf: string[] = [];
  const dayRe = /^(?:WEEK\s+\d+\s+)?DAY\s+\d+\s*[—\-:]/i;
  for (const line of lines) {
    const trimmedStart = line.trimStart();
    if (dayRe.test(trimmedStart) && buf.length > 0) {
      chunks.push(buf.join('\n'));
      buf = [line];
    } else {
      buf.push(line);
    }
  }
  if (buf.length > 0) chunks.push(buf.join('\n'));
  return chunks;
}

/** Split pasted blob into sections (multiple DAY blocks, or paragraphs separated by blank lines). */
function splitRawIntoSections(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const dayChunks = splitByDayHeaders(normalized);
  if (dayChunks.length >= 2) return dayChunks;
  const byBlank = normalized
    .split(/\n(?:\s*\n)+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  if (byBlank.length >= 2) return byBlank;
  return [normalized];
}

type ParsedSection = { workoutName: string; exercises: string[] };

/** One or more workouts from clipboard (blank line or DAY headers separate workouts). */
function parseBuilderPasteAll(text: string): ParsedSection[] {
  const sections = splitRawIntoSections(text);
  const parsed: ParsedSection[] = [];
  for (const section of sections) {
    const p = parseBuilderPaste(section);
    if (p.exercises.length === 0) continue;
    parsed.push({
      workoutName: (p.workoutName || '').trim(),
      exercises: p.exercises,
    });
  }
  if (parsed.length === 0) {
    const single = parseBuilderPaste(text);
    if (single.exercises.length === 0) return [];
    return [
      {
        workoutName: (single.workoutName || '').trim(),
        exercises: single.exercises,
      },
    ];
  }
  return parsed;
}

function newDraftId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function WorkoutBuilderScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params as { selectedDate?: string; shouldScheduleAfterCreate?: boolean } | undefined);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { addWorkoutTemplate, scheduleWorkout, addExercise } = useStore();
  const { t } = useTranslation();
  const { colors: themeColors, explore } = useAppTheme();

  const [draftWorkouts, setDraftWorkouts] = useState<WorkoutDraft[]>([
    { id: newDraftId('wd'), name: '', lines: [] },
  ]);
  const [activeWorkoutIndex, setActiveWorkoutIndex] = useState(0);
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

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const templateId = `wt-${Date.now()}`;
    const now = new Date().toISOString();

    const items = [];
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

    if (params?.shouldScheduleAfterCreate && params?.selectedDate) {
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
