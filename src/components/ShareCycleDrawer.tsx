import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomDrawer } from './common/BottomDrawer';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { useStore } from '../store';
import { useTranslation } from '../i18n/useTranslation';
import type { CyclePlan, WorkoutTemplate, WorkoutTemplateExercise } from '../types/training';

interface ShareCycleDrawerProps {
  visible: boolean;
  onClose: () => void;
  plan: CyclePlan | undefined;
}

/** Unique template IDs from plan in weekday order (Mon=1 first, then Tue..Sun=0). */
function getOrderedTemplateIds(plan: CyclePlan): string[] {
  const byWeekday = plan.templateIdsByWeekday || {};
  const seen = new Set<string>();
  const ordered: string[] = [];
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  for (const weekday of dayOrder) {
    const id = byWeekday[weekday as keyof typeof byWeekday];
    if (id && !seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  return ordered;
}

function formatExerciseLine(
  exerciseName: string,
  ex: WorkoutTemplateExercise,
  weightUnit: string
): string {
  const weight = ex.weight != null ? ` @ ${ex.weight} ${weightUnit}` : '';
  if (ex.isTimeBased) {
    const reps = typeof ex.reps === 'number' ? ex.reps : parseInt(String(ex.reps), 10) || 30;
    return `- ${exerciseName} — ${ex.sets}×${reps} sec${weight}`;
  }
  const reps = typeof ex.reps === 'string' ? ex.reps : String(ex.reps);
  return `- ${exerciseName} — ${ex.sets}×${reps}${weight}`;
}

function buildPasteableCycleText(
  templates: { template: WorkoutTemplate; order: number }[],
  exercises: { id: string; name: string }[],
  weightUnit: string
): string {
  const lines: string[] = ['WEEK 1', '⸻'];
  let dayNumber = 1;
  for (const { template } of templates) {
    lines.push(`DAY ${dayNumber} — ${template.name}`);
    for (const ex of template.items || []) {
      const exercise = exercises.find(e => e.id === ex.exerciseId);
      const name = exercise?.name ?? 'Unknown';
      lines.push(formatExerciseLine(name, ex, weightUnit));
    }
    lines.push('');
    dayNumber += 1;
  }
  return lines.join('\n').trim();
}

export function ShareCycleDrawer({ visible, onClose, plan }: ShareCycleDrawerProps) {
  const { t } = useTranslation();
  const { workoutTemplates, exercises, settings } = useStore();
  const useKg = settings?.useKg ?? false;
  const weightUnit = useKg ? 'kg' : 'lb';

  const workoutList = useMemo(() => {
    if (!plan) return [];
    const ids = getOrderedTemplateIds(plan);
    return ids
      .map(id => workoutTemplates.find(t => t.id === id))
      .filter((t): t is WorkoutTemplate => t != null)
      .map((template, index) => ({ template, order: index }));
  }, [plan, workoutTemplates]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (visible && plan) {
      const ids = getOrderedTemplateIds(plan);
      setSelectedIds(new Set(ids));
    }
  }, [visible, plan]);

  const toggle = (templateId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(templateId)) next.delete(templateId);
      else next.add(templateId);
      return next;
    });
  };

  const selectedCount = workoutList.filter(w => selectedIds.has(w.template.id)).length;
  const selectedTemplates = workoutList.filter(w => selectedIds.has(w.template.id));

  const handleShare = async () => {
    if (selectedCount === 0 || !plan) return;
    const text = buildPasteableCycleText(
      selectedTemplates,
      exercises.map(e => ({ id: e.id, name: e.name })),
      weightUnit
    );
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Share.share({ message: text, title: plan.name });
      onClose();
    } catch (err) {
      if ((err as Error).message?.includes('cancel') === false) {
        Alert.alert(t('alertErrorTitle'), t('failedToExportData'));
      }
    }
  };

  if (!plan) return null;

  return (
    <BottomDrawer visible={visible} onClose={onClose} maxHeight="60%" showHandle={true}>
      <View style={styles.container}>
        <Text style={styles.title}>{t('shareCycle')}</Text>
        <Text style={styles.subtitle}>{t('shareCycleSubtitle')}</Text>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {workoutList.map(({ template }) => {
            const isSelected = selectedIds.has(template.id);
            return (
              <TouchableOpacity
                key={template.id}
                style={styles.row}
                onPress={() => toggle(template.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.workoutName}>{template.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={[styles.shareButton, selectedCount === 0 && styles.shareButtonDisabled]}
          onPress={handleShare}
          activeOpacity={0.85}
          disabled={selectedCount === 0}
        >
          <Text style={[styles.shareButtonText, selectedCount === 0 && styles.shareButtonTextDisabled]}>
            {t('shareWorkoutsCount').replace('{count}', String(selectedCount))}
          </Text>
        </TouchableOpacity>
      </View>
    </BottomDrawer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.lg,
    paddingTop: SPACING.sm,
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: 4,
  },
  subtitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: SPACING.lg,
  },
  list: {
    flex: 1,
    marginBottom: SPACING.lg,
  },
  listContent: {
    paddingBottom: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  checkboxSelected: {
    backgroundColor: COLORS.accentPrimary,
    borderColor: COLORS.accentPrimary,
  },
  checkmark: {
    color: COLORS.backgroundCanvas,
    fontSize: 14,
    fontWeight: '700',
  },
  workoutName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    flex: 1,
  },
  shareButton: {
    backgroundColor: COLORS.accentPrimary,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonDisabled: {
    backgroundColor: COLORS.backgroundCanvas,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  shareButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.backgroundCanvas,
  },
  shareButtonTextDisabled: {
    color: COLORS.textMeta,
  },
});
