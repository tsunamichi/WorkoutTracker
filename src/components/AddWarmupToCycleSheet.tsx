import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { SPACING, COLORS, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconAddLine, IconMinusLine } from './icons';
import { BottomDrawer } from './common/BottomDrawer';
import { Toggle } from './Toggle';
import { formatWeightForLoad, toDisplayWeight, fromDisplayWeight } from '../utils/weight';
import { useTranslation } from '../i18n/useTranslation';
import { useStore } from '../store';
import type { WarmupItem_DEPRECATED as WarmupItem } from '../types/training';

interface AddWarmupToCycleSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (newItem: Omit<WarmupItem, 'id'>) => void;
  cycleSets: number; // Number of sets that all items in the cycle must have
}

export const AddWarmupToCycleSheet = ({
  visible,
  onClose,
  onAdd,
  cycleSets,
}: AddWarmupToCycleSheetProps) => {
  const { t } = useTranslation();
  const { settings } = useStore();
  const useKg = settings.useKg;
  const weightStep = useKg ? 0.5 : 5;
  const weightUnit = useKg ? 'kg' : 'lb';

  const [exerciseName, setExerciseName] = useState('');
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(0);
  const [isTimeBased, setIsTimeBased] = useState(false);

  useEffect(() => {
    if (visible) {
      // Reset state when opening
      setExerciseName('');
      setReps(10);
      setWeight(0);
      setIsTimeBased(false);
    }
  }, [visible]);

  const handleStepper = (field: 'reps' | 'weight', delta: number) => {
    if (field === 'reps') {
      const step = isTimeBased ? 5 : 1;
      const min = isTimeBased ? 5 : 1;
      setReps(Math.max(min, reps + delta * step));
    } else if (field === 'weight') {
      const currentDisplay = toDisplayWeight(weight, useKg);
      const nextDisplay = Math.max(0, currentDisplay + delta * weightStep);
      setWeight(fromDisplayWeight(nextDisplay, useKg));
    }
  };

  const handleAdd = () => {
    if (!exerciseName.trim()) return;

    const newItem: Omit<WarmupItem, 'id'> = {
      exerciseName: exerciseName.trim(),
      sets: cycleSets,
      reps,
      weight,
      isTimeBased,
    };

    onAdd(newItem);
    onClose();
  };

  const canAdd = exerciseName.trim().length > 0;

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
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} bounces={false}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('addWarmupItem')}</Text>
            <Text style={styles.subtitle}>
              {t('cycleSetsSyncedInfo')} ({cycleSets} {t('setsUnit')})
            </Text>
          </View>

          {/* Exercise Name */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('exerciseName')}</Text>
            <TextInput
              style={styles.input}
              value={exerciseName}
              onChangeText={setExerciseName}
              placeholder={t('warmupExercisePlaceholder')}
              placeholderTextColor={COLORS.textMeta}
              autoCapitalize="words"
              autoFocus
            />
          </View>

          <View style={styles.settingsContainer}>
            <View style={styles.toggleRow}>
              <Toggle
                label={t('timeBased')}
                value={isTimeBased}
                onValueChange={setIsTimeBased}
              />
            </View>

            <View style={styles.cycleInfoBanner}>
              <Text style={styles.cycleInfoText}>
                {cycleSets} {t('setsUnit')} • {t('cycleSetsSyncedInfo')}
              </Text>
            </View>

            <View style={styles.valuesCard}>
              {/* Weight Row */}
              <View style={styles.adjustRow}>
                <View style={styles.adjustValue}>
                  <Text style={styles.adjustValueText}>
                    {formatWeightForLoad(weight, useKg)}
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
                  <Text style={styles.adjustUnit}>{isTimeBased ? 'sec' : t('repsUnit')}</Text>
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
            </View>
          </View>
        </ScrollView>

        <View style={styles.addButtonContainer}>
          <TouchableOpacity
            style={[styles.addButton, !canAdd && styles.addButtonDisabled]}
            onPress={handleAdd}
            disabled={!canAdd}
            activeOpacity={1}
          >
            <Text style={styles.addButtonText}>{t('add')}</Text>
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
  content: {
    paddingBottom: SPACING.xl,
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
  field: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xl,
  },
  label: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: SPACING.sm,
    textTransform: 'capitalize',
  },
  input: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderDimmed,
    padding: SPACING.md,
    minHeight: 48,
  },
  settingsContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xl,
    gap: SPACING.xl,
  },
  toggleRow: {
    paddingVertical: 4,
  },
  cycleInfoBanner: {
    backgroundColor: COLORS.accentPrimaryDimmed,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  cycleInfoText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.accentPrimary,
    textAlign: 'center',
  },
  valuesCard: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.lg,
    borderCurve: 'continuous',
    padding: 24,
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
  addButtonContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.lg,
  },
  addButton: {
    backgroundColor: COLORS.accentPrimary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.backgroundCanvas,
  },
});
