import React, { useState, useRef, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconClose } from '../components/icons';
import { useTranslation } from '../i18n/useTranslation';
import type { Exercise } from '../types';
import type { WorkoutTemplate } from '../types/training';
import { useAppTheme } from '../theme/useAppTheme';
import { EXECUTION_CTA_ROW_GAP } from '../components/execution/executionCtaTokens';

/** Bold exercise list on light builder canvas (matches product mock). */
const LIST_EXERCISE_INK = '#1B4332';

type DraftLine = { id: string; name: string };

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

export function WorkoutBuilderScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params as { selectedDate?: string; shouldScheduleAfterCreate?: boolean } | undefined);
  const insets = useSafeAreaInsets();
  const { addWorkoutTemplate, scheduleWorkout, addExercise } = useStore();
  const { t } = useTranslation();
  const { colors: themeColors, explore } = useAppTheme();

  const [workoutName, setWorkoutName] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [exerciseInput, setExerciseInput] = useState('');
  const [showExerciseField, setShowExerciseField] = useState(false);
  const exerciseInputRef = useRef<TextInput>(null);

  const hasDraft =
    workoutName.trim().length > 0 || lines.length > 0 || exerciseInput.trim().length > 0 || showExerciseField;

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

  const resetCreationForm = () => {
    setWorkoutName('');
    setLines([]);
    setExerciseInput('');
    setShowExerciseField(false);
    useStore.getState().setScheduleDeckFocusAfterCreate(null);
  };

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
    setShowExerciseField(true);
    requestAnimationFrame(() => exerciseInputRef.current?.focus());
  }, []);

  const handlePasteFromClipboard = useCallback(async () => {
    const content = await Clipboard.getStringAsync();
    if (!content?.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(t('alertErrorTitle'), t('clipboardEmpty'));
      return;
    }
    const { workoutName: parsedName, exercises: parsedExercises } = parseBuilderPaste(content);
    if (parsedExercises.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(t('alertErrorTitle'), t('pasteNoExercisesFound'));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (parsedName && !workoutName.trim()) {
      setWorkoutName(parsedName);
    }
    setLines(prev => {
      const existing = new Set(prev.map(l => l.name.trim().toLowerCase()));
      const toAdd = parsedExercises.filter(e => !existing.has(e.trim().toLowerCase()));
      const base = prev.length;
      return [
        ...prev,
        ...toAdd.map((name, j) => ({
          id: `line-paste-${Date.now()}-${base + j}`,
          name: name.trim(),
        })),
      ];
    });
    setShowExerciseField(true);
  }, [t, workoutName]);

  const commitExerciseLine = useCallback(() => {
    const name = exerciseInput.trim();
    if (!name) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLines(prev => [...prev, { id: `line-${Date.now()}-${prev.length}`, name }]);
    setExerciseInput('');
    requestAnimationFrame(() => exerciseInputRef.current?.focus());
  }, [exerciseInput]);

  const removeLine = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLines(prev => prev.filter(l => l.id !== id));
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
    if (!workoutName.trim()) {
      Alert.alert(t('enterWorkoutName'), t('pleaseEnterWorkoutName'));
      return;
    }
    if (lines.length === 0) {
      Alert.alert(t('noExercisesSelected'), t('pleaseAddExercises'));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const templateId = `wt-${Date.now()}`;
    const now = new Date().toISOString();

    const items = [];
    for (let i = 0; i < lines.length; i++) {
      const exerciseId = await resolveExerciseIdForName(lines[i].name, i);
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
      name: workoutName.trim(),
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

  const canvas = themeColors.canvasLight;
  const ink = themeColors.containerPrimary;
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
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity onPress={handleBack} style={styles.backRow} hitSlop={12}>
            <Text style={[styles.backText, { color: meta }]}>{`< ${t('back')}`}</Text>
          </TouchableOpacity>

          <TextInput
            style={[styles.titleInput, { color: COLORS.textPrimary }]}
            placeholder={t('workoutName')}
            placeholderTextColor={COLORS.textMeta}
            value={workoutName}
            onChangeText={setWorkoutName}
            autoCapitalize="sentences"
            returnKeyType="next"
            onSubmitEditing={focusAddExercise}
            accessibilityLabel={t('workoutName')}
          />

          <TouchableOpacity onPress={focusAddExercise} style={styles.addLink} activeOpacity={0.7}>
            <Text style={[styles.addLinkText, { color: ink }]}>{t('addExerciseCta')}</Text>
          </TouchableOpacity>

          {showExerciseField ? (
            <TextInput
              ref={exerciseInputRef}
              style={[styles.exerciseField, { color: ink, borderColor: meta }]}
              placeholder={t('exerciseName')}
              placeholderTextColor={meta}
              value={exerciseInput}
              onChangeText={setExerciseInput}
              onSubmitEditing={commitExerciseLine}
              returnKeyType="done"
              blurOnSubmit={false}
              autoCapitalize="words"
              accessibilityLabel={t('exerciseName')}
            />
          ) : null}

          <View style={styles.listBlock}>
            {lines.map(line => (
              <View key={line.id} style={styles.exerciseRow}>
                <Text style={[styles.exerciseRowText, { color: LIST_EXERCISE_INK }]}>
                  {line.name}
                </Text>
                <TouchableOpacity onPress={() => removeLine(line.id)} hitSlop={12} accessibilityRole="button">
                  <IconClose size={20} color={meta} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>

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
              onPress={handlePasteFromClipboard}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('pasteWorkout')}
            >
              <Text style={[styles.pasteButtonText, { color: themeColors.containerPrimary }]}>
                {t('pasteWorkout')}
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
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.sm,
  },
  backRow: {
    alignSelf: 'flex-start',
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  backText: {
    ...TYPOGRAPHY.body,
    fontWeight: '500',
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
  addLink: {
    alignSelf: 'flex-start',
    marginBottom: SPACING.lg,
  },
  addLinkText: {
    ...TYPOGRAPHY.body,
    fontWeight: '500',
  },
  exerciseField: {
    ...TYPOGRAPHY.body,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.xxl,
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
    ...TYPOGRAPHY.h2,
    fontWeight: '700',
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
