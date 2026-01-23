import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SPACING, COLORS, TYPOGRAPHY, BORDER_RADIUS } from '../../constants';
import { IconAddLine, IconMinusLine } from '../icons';
import { BottomDrawer } from '../common/BottomDrawer';
import { Toggle } from '../Toggle';
import { formatWeightForLoad, toDisplayWeight, fromDisplayWeight } from '../../utils/weight';
import { useTranslation } from '../../i18n/useTranslation';
import { useStore } from '../../store';
import type { WorkoutTemplateExercise } from '../../types/training';

interface ExerciseSettingsSheetProps {
  exercise: WorkoutTemplateExercise & { name: string };
  visible: boolean;
  onClose: () => void;
  onSave: (updates: Partial<WorkoutTemplateExercise>) => void;
}

export const ExerciseSettingsSheet = ({ exercise, visible, onClose, onSave }: ExerciseSettingsSheetProps) => {
  const { settings } = useStore();
  const { t } = useTranslation();
  const useKg = settings.useKg;
  const weightStep = useKg ? 0.5 : 5;

  const [sets, setSets] = useState(exercise.sets);
  const [reps, setReps] = useState(exercise.reps.toString());
  const [isTimeBased, setIsTimeBased] = useState(false);
  const [weight, setWeight] = useState(exercise.weight ? toDisplayWeight(exercise.weight, useKg) : 0);

  useEffect(() => {
    if (visible) {
      setSets(exercise.sets || 3);
      setReps((exercise.reps || 8).toString());
      setIsTimeBased(false);
      setWeight(exercise.weight ? toDisplayWeight(exercise.weight, useKg) : 0);
    }
  }, [exercise, visible, useKg]);

  const handleSave = () => {
    const updates: Partial<WorkoutTemplateExercise> = {
      sets,
      reps: parseInt(reps, 10),
      weight: fromDisplayWeight(weight, useKg),
    };
    onSave(updates);
    onClose();
  };

  const handleStepper = (field: 'sets' | 'reps' | 'weight', delta: number) => {
    if (field === 'reps') {
      const currentValue = parseInt(reps, 10) || 0;
      const step = isTimeBased ? 5 : 1;
      const min = isTimeBased ? 5 : 1;
      const nextValue = Math.max(min, currentValue + delta * step);
      setReps(`${nextValue}`);
      return;
    }

    if (field === 'sets') {
      const nextValue = Math.max(1, sets + delta);
      setSets(nextValue);
      return;
    }

    if (field === 'weight') {
      const nextValue = Math.max(0, weight + delta * weightStep);
      setWeight(nextValue);
      return;
    }
  };

  const weightUnit = useKg ? 'kg' : 'lb';

  return (
    <BottomDrawer
      visible={visible}
      onClose={onClose}
      maxHeight="90%"
      fixedHeight={true}
      bottomOffset={8}
      showHandle={false}
      scrollable={false}
      contentStyle={styles.drawerContent}
    >
      <View style={styles.sheetContainer}>
        <ScrollView contentContainerStyle={styles.content} bounces={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{exercise.name}</Text>
          </View>

          <View style={styles.settingsContainer}>
            <View style={styles.toggleRow}>
              <Toggle
                label={t('timeBased')}
                value={isTimeBased}
                onValueChange={setIsTimeBased}
              />
            </View>

            <View style={styles.valuesCard}>
              {/* Weight Row */}
              <View style={styles.adjustRow}>
                <View style={styles.adjustValue}>
                  <Text style={styles.adjustValueText}>
                    {formatWeightForLoad(fromDisplayWeight(weight, useKg), useKg)}
                  </Text>
                  <Text style={styles.adjustUnit}>{weightUnit}</Text>
                </View>
                <View style={styles.adjustButtons}>
                  <TouchableOpacity
                    style={styles.adjustButtonTapTarget}
                    onPress={() => handleStepper('weight', -1)}
                    activeOpacity={1}
                  >
                    <View style={styles.adjustButton}>
                      <View style={styles.adjustButtonInner}>
                        <IconMinusLine size={24} color={COLORS.accentPrimary} />
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.adjustButtonTapTarget}
                    onPress={() => handleStepper('weight', 1)}
                    activeOpacity={1}
                  >
                    <View style={styles.adjustButton}>
                      <View style={styles.adjustButtonInner}>
                        <IconAddLine size={24} color={COLORS.accentPrimary} />
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.adjustDivider} />

              {/* Reps/Duration Row */}
              <View style={styles.adjustRow}>
                <View style={styles.adjustValue}>
                  <Text style={styles.adjustValueText}>{reps}</Text>
                  <Text style={styles.adjustUnit}>{isTimeBased ? 'sec' : 'reps'}</Text>
                </View>
                <View style={styles.adjustButtons}>
                  <TouchableOpacity
                    style={styles.adjustButtonTapTarget}
                    onPress={() => handleStepper('reps', -1)}
                    activeOpacity={1}
                  >
                    <View style={styles.adjustButton}>
                      <View style={styles.adjustButtonInner}>
                        <IconMinusLine size={24} color={COLORS.accentPrimary} />
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.adjustButtonTapTarget}
                    onPress={() => handleStepper('reps', 1)}
                    activeOpacity={1}
                  >
                    <View style={styles.adjustButton}>
                      <View style={styles.adjustButtonInner}>
                        <IconAddLine size={24} color={COLORS.accentPrimary} />
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.adjustDivider} />

              {/* Sets Row */}
              <View style={styles.adjustRow}>
                <View style={styles.adjustValue}>
                  <Text style={styles.adjustValueText}>{sets}</Text>
                  <Text style={styles.adjustUnit}>{t('setsUnit')}</Text>
                </View>
                <View style={styles.adjustButtons}>
                  <TouchableOpacity
                    style={styles.adjustButtonTapTarget}
                    onPress={() => handleStepper('sets', -1)}
                    activeOpacity={1}
                  >
                    <View style={styles.adjustButton}>
                      <View style={styles.adjustButtonInner}>
                        <IconMinusLine size={24} color={COLORS.accentPrimary} />
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.adjustButtonTapTarget}
                    onPress={() => handleStepper('sets', 1)}
                    activeOpacity={1}
                  >
                    <View style={styles.adjustButton}>
                      <View style={styles.adjustButtonInner}>
                        <IconAddLine size={24} color={COLORS.accentPrimary} />
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            activeOpacity={1}
          >
            <Text style={styles.saveButtonText}>{t('save')}</Text>
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
  sheetContainer: {
    flex: 1,
  },
  content: {
    paddingBottom: SPACING.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    flex: 1,
  },
  settingsContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xl,
  },
  valuesCard: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.lg,
    borderCurve: 'continuous',
    padding: 24,
  },
  toggleRow: {
    marginBottom: SPACING.xl,
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adjustValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  adjustValueText: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
  },
  adjustUnit: {
    ...TYPOGRAPHY.h1,
    color: COLORS.textMeta,
  },
  adjustButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  adjustButtonTapTarget: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustButton: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustButtonInner: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    borderCurve: 'continuous',
    backgroundColor: COLORS.accentPrimaryDimmed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustDivider: {
    height: 1,
    backgroundColor: COLORS.borderDimmed,
    marginVertical: 16,
  },
  saveButtonContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.lg,
  },
  saveButton: {
    backgroundColor: COLORS.accentPrimaryDimmed,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  saveButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
  },
});
