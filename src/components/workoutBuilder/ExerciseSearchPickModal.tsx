import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Exercise } from '../../types';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../constants';
import {
  rankExercisesForQuery,
  normalizeExerciseLabel,
  labelsForExercise,
} from '../../utils/exerciseIdentity';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppTheme } from '../../theme/useAppTheme';
import { useStore } from '../../store';
import {
  getLastExerciseRecordForLibraryId,
  formatLastExerciseRecordLine,
  buildMaxLastLogSortTsByExerciseIds,
} from '../../utils/lastExerciseRecord';
import { IconAdd } from '../icons';

const LIST_MAX = 20;

function hasExactExerciseNameMatch(raw: string, catalog: Exercise[]): boolean {
  const q = normalizeExerciseLabel(raw);
  if (!q) return false;
  return catalog.some(ex => labelsForExercise(ex).some(label => label === q));
}

export type ExerciseSearchPickModalProps = {
  visible: boolean;
  exercises: Exercise[];
  /** Seed when opening for a resolving line */
  initialQuery?: string;
  onClose: () => void;
  onSelectExercise: (exercise: Exercise) => void;
  /** Persist custom exercise in the store, then caller applies to draft */
  onCreateCustom: (trimmedName: string) => Promise<void>;
};

export function ExerciseSearchPickModal({
  visible,
  exercises,
  initialQuery = '',
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

  useEffect(() => {
    if (visible) setQuery(initialQuery);
  }, [visible, initialQuery]);

  const trimmed = query.trim();
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
    const m = new Map<string, string>();
    const ids = new Set(ranked.map(x => x.id));
    for (const id of ids) {
      const rec = getLastExerciseRecordForLibraryId(
        id,
        sessions,
        detailedWorkoutProgress,
        scheduledWorkouts,
      );
      if (rec) m.set(id, formatLastExerciseRecordLine(rec, useKg));
    }
    return m;
  }, [ranked, sessions, detailedWorkoutProgress, scheduledWorkouts, useKg]);

  const showCreateRow =
    trimmed.length >= 2 && !hasExactExerciseNameMatch(trimmed, exercises) && !creating;

  const createLabel = useMemo(() => {
    return t('createExerciseNamedTemplate').replace('{name}', trimmed);
  }, [t, trimmed]);

  const maxListHeight = Math.min(360, Dimensions.get('window').height * 0.38);

  const close = useCallback(() => {
    setQuery('');
    setCreating(false);
    onClose();
  }, [onClose]);

  const handleSelect = useCallback(
    (ex: Exercise) => {
      onSelectExercise(ex);
      setQuery('');
      onClose();
    },
    [onSelectExercise, onClose],
  );

  const handleCreate = useCallback(async () => {
    if (trimmed.length < 2 || creating) return;
    setCreating(true);
    try {
      await onCreateCustom(trimmed);
      setQuery('');
      onClose();
    } finally {
      setCreating(false);
    }
  }, [trimmed, creating, onCreateCustom, onClose]);

  const panelBg = themeColors.canvasLight;
  const inputBg = '#FFFFFF';

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
          <View style={[styles.listPanel, { backgroundColor: panelBg, maxHeight: maxListHeight }]}>
            {trimmed.length === 0 ? (
              <Text style={[styles.emptyHint, { color: COLORS.textMeta }]}>{t('builderExerciseSearchEmptyHint')}</Text>
            ) : (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={ranked.length > 6}
                contentContainerStyle={styles.listScrollContent}
              >
                {ranked.length === 0 ? (
                  <Text style={[styles.noResults, { color: COLORS.textSecondary }]}>{t('noExercisesFound')}</Text>
                ) : (
                  ranked.map((ex, index) => {
                    const lastLine = lastRecordSubtitleByExerciseId.get(ex.id);
                    return (
                      <TouchableOpacity
                        key={ex.id}
                        style={[
                          styles.row,
                          index === ranked.length - 1 && !showCreateRow ? styles.rowLast : null,
                        ]}
                        onPress={() => handleSelect(ex)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.rowTitle, { color: COLORS.textPrimary }]} numberOfLines={2}>
                          {ex.name}
                        </Text>
                        {lastLine ? (
                          <Text style={[styles.rowMeta, { color: COLORS.textMeta }]} numberOfLines={1}>
                            {lastLine}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })
                )}
                {showCreateRow ? (
                  <TouchableOpacity
                    style={styles.createRow}
                    onPress={handleCreate}
                    activeOpacity={0.7}
                    disabled={creating}
                  >
                    {creating ? (
                      <ActivityIndicator color={COLORS.accentPrimary} />
                    ) : (
                      <>
                        <IconAdd size={20} color={COLORS.accentPrimary} />
                        <Text style={styles.createRowText}>{createLabel}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
              </ScrollView>
            )}
          </View>
          <View style={[styles.inputRow, { backgroundColor: panelBg, paddingBottom: Math.max(insets.bottom, SPACING.md) }]}>
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: inputBg,
                  borderColor: COLORS.border,
                  color: COLORS.textPrimary,
                },
              ]}
              placeholder={t('exerciseSearchPlaceholder')}
              placeholderTextColor={COLORS.textMeta}
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
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
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
    borderBottomColor: COLORS.border,
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
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    marginTop: SPACING.xs,
  },
  createRowText: {
    ...TYPOGRAPHY.body,
    color: COLORS.accentPrimary,
    fontWeight: '600',
    flex: 1,
  },
  inputRow: {
    paddingHorizontal: SPACING.xl,
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
