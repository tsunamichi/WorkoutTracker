import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import { SPACING, COLORS, TYPOGRAPHY, BORDER_RADIUS } from '../../constants';
import { IconCheck } from '../icons';
import { BottomDrawer } from '../common/BottomDrawer';
import { useTranslation } from '../../i18n/useTranslation';
import type { WorkoutTemplateExercise } from '../../types/training';

interface CycleExercisePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  allExercises: Array<WorkoutTemplateExercise & { name: string }>;
  currentExerciseId: string;
  selectedExerciseIds: string[];
  onSave: (selectedIds: string[]) => void;
}

export const CycleExercisePickerSheet = ({
  visible,
  onClose,
  allExercises,
  currentExerciseId,
  selectedExerciseIds,
  onSave,
}: CycleExercisePickerSheetProps) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>(selectedExerciseIds);

  const toggleExercise = (exerciseId: string) => {
    if (selected.includes(exerciseId)) {
      setSelected(selected.filter(id => id !== exerciseId));
    } else {
      setSelected([...selected, exerciseId]);
    }
  };

  const handleSave = () => {
    onSave(selected);
    onClose();
  };

  // Filter out the current exercise from the list
  const availableExercises = allExercises.filter(ex => ex.exerciseId !== currentExerciseId);

  return (
    <BottomDrawer
      visible={visible}
      onClose={onClose}
      maxHeight="80%"
      fixedHeight={true}
      bottomOffset={8}
      showHandle={false}
      scrollable={false}
      contentStyle={styles.drawerContent}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('selectCycleExercises')}</Text>
          <Text style={styles.subtitle}>{t('cycleExercisesHint')}</Text>
        </View>

        <ScrollView style={styles.scrollView} bounces={false}>
          <View style={styles.exerciseList}>
            {availableExercises.map((exercise) => {
              const isSelected = selected.includes(exercise.exerciseId);
              return (
                <TouchableOpacity
                  key={exercise.exerciseId}
                  style={[
                    styles.exerciseItem,
                    isSelected && styles.exerciseItemSelected,
                  ]}
                  onPress={() => toggleExercise(exercise.exerciseId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exerciseMeta}>
                      {exercise.sets} {t('setsUnit')} × {exercise.reps} {exercise.isTimeBased ? 'sec' : t('repsUnit')}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.checkmark}>
                      <IconCheck size={20} color={COLORS.accentPrimary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              {selected.length > 0
                ? t('addToCycle').replace('{count}', selected.length.toString())
                : t('save')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomDrawer>
  );
};

const styles = StyleSheet.create({
  drawerContent: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDimmed,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  scrollView: {
    flex: 1,
  },
  exerciseList: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  exerciseItemSelected: {
    borderColor: COLORS.accentPrimary,
    backgroundColor: COLORS.accentPrimaryDimmed,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  exerciseMeta: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  checkmark: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.md,
  },
  footer: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDimmed,
  },
  saveButton: {
    backgroundColor: COLORS.accentPrimary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  saveButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.backgroundCanvas,
  },
});
