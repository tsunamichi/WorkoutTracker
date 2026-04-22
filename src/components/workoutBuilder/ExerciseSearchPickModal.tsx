import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Exercise } from '../../types';
import { SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../constants';
import {
  rankExercisesForQuery,
  normalizeExerciseLabel,
  labelsForExercise,
} from '../../utils/exerciseIdentity';
import { getTopExercisesByCompletedSetCount } from '../../utils/exerciseUsageRank';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppTheme } from '../../theme/useAppTheme';
import { useStore } from '../../store';
import {
  getLastExerciseRecordForLibraryId,
  formatLastExerciseRecordLine,
  buildMaxLastLogSortTsByExerciseIds,
} from '../../utils/lastExerciseRecord';
import { getAppThemeFromStore } from '../../theme/getAppThemeFromStore';

const LIST_MAX = 20;
const HORIZONTAL_INSET = SPACING.xxl; // 24px — match home / builder spacing

function hasExactExerciseNameMatch(raw: string, catalog: Exercise[]): boolean {
  const q = normalizeExerciseLabel(raw);
  if (!q) return false;
  return catalog.some(ex => labelsForExercise(ex).some(label => label === q));
}

const ADDED_FEEDBACK_MS = 2500;

const BACKDROP_CLOSE_SUPPRESSION_MS = 500;

export type ExerciseSearchPickModalProps = {
  visible: boolean;
  exercises: Exercise[];
  /** Seed when opening for a resolving line */
  initialQuery?: string;
  /**
   * When `true` (default), the sheet closes after the user picks or creates an exercise.
   * Set to `false` in workout execution so the user can add many exercises; dismiss with the dimmed area only.
   */
  dismissOnSuccessfulAdd?: boolean;
  onClose: () => void;
  onSelectExercise: (exercise: Exercise) => void | Promise<void>;
  /** Persist custom exercise in the store, then caller applies to draft */
  onCreateCustom: (trimmedName: string) => Promise<void>;
};

export function ExerciseSearchPickModal({
  visible,
  exercises,
  initialQuery = '',
  dismissOnSuccessfulAdd = true,
  onClose,
  onSelectExercise,
  onCreateCustom,
}: ExerciseSearchPickModalProps) {
  const { t } = useTranslation();
  const { colors: themeColors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const sessions = useStore(s => s.sessions);
  const detailedWorkoutProgress = useStore(s => s.detailedWorkoutProgress);
  const scheduledWorkouts = useStore(s => s.scheduledWorkouts);
  const useKg = useStore(s => s.settings.useKg);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);
  const addedMessageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressBackdropCloseUntilRef = useRef(0);

  const clearAddedMessageTimer = useCallback(() => {
    if (addedMessageTimer.current) {
      clearTimeout(addedMessageTimer.current);
      addedMessageTimer.current = null;
    }
  }, []);

  const showAddedMessage = useCallback(
    (name: string) => {
      clearAddedMessageTimer();
      setAddedMessage(t('exerciseAddedMessage').replace('{name}', name));
      addedMessageTimer.current = setTimeout(() => {
        setAddedMessage(null);
        addedMessageTimer.current = null;
      }, ADDED_FEEDBACK_MS);
    },
    [t, clearAddedMessageTimer],
  );

  useEffect(() => {
    if (visible) {
      setQuery(initialQuery);
      setAddedMessage(null);
      clearAddedMessageTimer();
      suppressBackdropCloseUntilRef.current = 0;
    } else {
      setAddedMessage(null);
      clearAddedMessageTimer();
      suppressBackdropCloseUntilRef.current = 0;
    }
  }, [visible, initialQuery, clearAddedMessageTimer]);

  useEffect(() => {
    return () => clearAddedMessageTimer();
  }, [clearAddedMessageTimer]);

  const trimmed = query.trim();

  const topExercisesWhenEmpty = useMemo(
    () => getTopExercisesByCompletedSetCount(exercises, sessions, 5),
    [exercises, sessions],
  );

  const lastLineForExercises = useCallback(
    (exList: Exercise[]) => {
      const m = new Map<string, string>();
      for (const ex of exList) {
        const rec = getLastExerciseRecordForLibraryId(
          ex.id,
          sessions,
          detailedWorkoutProgress,
          scheduledWorkouts,
        );
        if (rec) m.set(ex.id, formatLastExerciseRecordLine(rec, useKg));
      }
      return m;
    },
    [sessions, detailedWorkoutProgress, scheduledWorkouts, useKg],
  );

  const topFiveLastLineById = useMemo(
    () => lastLineForExercises(topExercisesWhenEmpty),
    [topExercisesWhenEmpty, lastLineForExercises],
  );

  const ranked = useMemo(() => {
    if (!trimmed) return [];
    const scored = rankExercisesForQuery(exercises, trimmed, LIST_MAX);
    if (scored.length === 0) return [];
    const idSet = new Set(scored.map(r => r.exercise.id));
    const tsById = buildMaxLastLogSortTsByExerciseIds(
      idSet,
      sessions,
      detailedWorkoutProgress,
      scheduledWorkouts,
    );
    return [...scored]
      .sort((a, b) => {
        const na = tsById.get(a.exercise.id) ?? Number.NEGATIVE_INFINITY;
        const nb = tsById.get(b.exercise.id) ?? Number.NEGATIVE_INFINITY;
        if (nb !== na) return nb - na;
        return b.score - a.score;
      })
      .map(r => r.exercise);
  }, [trimmed, exercises, sessions, detailedWorkoutProgress, scheduledWorkouts]);

  const lastRecordSubtitleByExerciseId = useMemo(() => {
    return lastLineForExercises(ranked);
  }, [ranked, lastLineForExercises]);

  const showCreateRow =
    trimmed.length >= 2 && !hasExactExerciseNameMatch(trimmed, exercises) && !creating;

  const createLabel = useMemo(() => {
    return t('createExerciseNamedTemplate').replace('{name}', trimmed);
  }, [t, trimmed]);

  const maxListHeight = Math.min(360, Dimensions.get('window').height * 0.38);

  const close = useCallback(() => {
    if (Date.now() < suppressBackdropCloseUntilRef.current) {
      return;
    }
    setQuery('');
    setCreating(false);
    setAddedMessage(null);
    clearAddedMessageTimer();
    onClose();
  }, [onClose, clearAddedMessageTimer]);

  const scheduleClearQuery = useCallback(() => {
    InteractionManager.runAfterInteractions(() => {
      setQuery('');
    });
  }, []);

  const handleSelect = useCallback(
    async (ex: Exercise) => {
      if (!dismissOnSuccessfulAdd) {
        try {
          await Promise.resolve(onSelectExercise(ex));
          // Caller (e.g. `handleAddExercise`) plays success haptic.
          showAddedMessage(ex.name);
          suppressBackdropCloseUntilRef.current = Date.now() + BACKDROP_CLOSE_SUPPRESSION_MS;
          scheduleClearQuery();
        } catch (e) {
          console.error('[ExerciseSearchPickModal] onSelectExercise failed', e);
        }
        return;
      }
      try {
        await Promise.resolve(onSelectExercise(ex));
        setQuery('');
        onClose();
      } catch (e) {
        console.error('[ExerciseSearchPickModal] onSelectExercise failed', e);
      }
    },
    [dismissOnSuccessfulAdd, onSelectExercise, onClose, showAddedMessage, scheduleClearQuery],
  );

  const handleCreate = useCallback(async () => {
    if (trimmed.length < 2 || creating) return;
    const name = trimmed;
    setCreating(true);
    try {
      if (!dismissOnSuccessfulAdd) {
        await onCreateCustom(name);
        showAddedMessage(name);
        suppressBackdropCloseUntilRef.current = Date.now() + BACKDROP_CLOSE_SUPPRESSION_MS;
        scheduleClearQuery();
        return;
      }
      await onCreateCustom(name);
      setQuery('');
      onClose();
    } catch (e) {
      console.error('[ExerciseSearchPickModal] onCreateCustom failed', e);
    } finally {
      setCreating(false);
    }
  }, [trimmed, creating, onCreateCustom, onClose, dismissOnSuccessfulAdd, showAddedMessage, scheduleClearQuery]);

  /** Homepage schedule background (Today uses `canvasLight` for the main layer). */
  const panelBg = themeColors.canvasLight;
  const inputBg = '#FFFFFF';
  const suggestionInk = themeColors.textMeta;

  const renderCreateCta = () => (
    <TouchableOpacity
      style={[styles.createCta, { backgroundColor: themeColors.containerPrimary }]}
      onPress={handleCreate}
      activeOpacity={0.9}
      disabled={creating}
    >
      {creating ? (
        <ActivityIndicator color={themeColors.containerSecondary} />
      ) : (
        <Text style={[styles.createCtaText, { color: themeColors.containerSecondary }]} numberOfLines={2}>
          {createLabel}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderExerciseRow = (
    ex: Exercise,
    index: number,
    list: Exercise[],
    lastMap: Map<string, string>,
  ) => {
    const line = lastMap.get(ex.id);
    const isLastRow = index === list.length - 1;
    return (
      <TouchableOpacity
        key={ex.id}
        style={[styles.row, isLastRow && styles.rowLast]}
        onPress={() => handleSelect(ex)}
        activeOpacity={0.7}
      >
        <Text style={[styles.rowTitle, { color: suggestionInk }]} numberOfLines={2}>
          {ex.name}
        </Text>
        {line ? (
          <Text style={[styles.rowMeta, { color: themeColors.textMeta }]} numberOfLines={1}>
            {line}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={close} accessibilityRole="button">
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView
          style={styles.sheetWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View
            style={[
              styles.listPanel,
              { backgroundColor: panelBg, maxHeight: maxListHeight, paddingHorizontal: HORIZONTAL_INSET },
            ]}
          >
            {addedMessage ? (
              <Text style={[styles.addedFeedback, { color: themeColors.textMeta }]} numberOfLines={2}>
                {addedMessage}
              </Text>
            ) : null}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                (trimmed ? ranked.length : topExercisesWhenEmpty.length) > 6
              }
              contentContainerStyle={styles.listScrollContent}
            >
              {trimmed.length === 0 ? (
                topExercisesWhenEmpty.length === 0 ? (
                  <Text style={[styles.emptyHint, { color: themeColors.textMeta }]}>{t('builderExerciseSearchEmptyHint')}</Text>
                ) : (
                  topExercisesWhenEmpty.map((ex, index) =>
                    renderExerciseRow(ex, index, topExercisesWhenEmpty, topFiveLastLineById),
                  )
                )
              ) : ranked.length === 0 ? (
                <>
                  <Text style={[styles.noResults, { color: themeColors.textMeta }]}>{t('noExercisesFound')}</Text>
                  {showCreateRow ? renderCreateCta() : null}
                </>
              ) : (
                <>
                  {ranked.map((ex, index) =>
                    renderExerciseRow(ex, index, ranked, lastRecordSubtitleByExerciseId),
                  )}
                  {showCreateRow ? renderCreateCta() : null}
                </>
              )}
            </ScrollView>
          </View>
          <View
            style={[
              styles.inputRow,
              { backgroundColor: panelBg, paddingBottom: Math.max(insets.bottom, SPACING.md), paddingHorizontal: HORIZONTAL_INSET },
            ]}
          >
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: inputBg,
                  borderColor: themeColors.border,
                  color: themeColors.textPrimary,
                },
              ]}
              placeholder={t('exerciseSearchPlaceholder')}
              placeholderTextColor={themeColors.textMeta}
              value={query}
              onChangeText={setQuery}
              autoFocus={visible}
              autoCapitalize="none"
              autoCorrect
              returnKeyType="done"
              editable={!creating}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const themeColorsStatic = getAppThemeFromStore().colors;
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backdrop: {
    flex: 1,
  },
  /** Sits below the flex-1 dimmed area so the sheet stays at the bottom (same idea as swap exercise). */
  sheetWrap: {
    width: '100%',
  },
  listPanel: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  addedFeedback: {
    ...TYPOGRAPHY.meta,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  listScrollContent: {
    paddingBottom: SPACING.xs,
  },
  emptyHint: {
    ...TYPOGRAPHY.meta,
    textAlign: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },
  noResults: {
    ...TYPOGRAPHY.body,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  row: {
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: themeColorsStatic.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: '500',
  },
  rowMeta: {
    ...TYPOGRAPHY.meta,
    marginTop: 4,
  },
  createCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xxl,
    borderRadius: 14,
    alignSelf: 'stretch',
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
  },
  createCtaText: {
    ...TYPOGRAPHY.body,
    fontWeight: '500',
  },
  inputRow: {
    paddingTop: SPACING.md,
  },
  searchInput: {
    ...TYPOGRAPHY.body,
    fontSize: 18,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: Platform.OS === 'ios' ? 16 : 12,
    minHeight: 56,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
