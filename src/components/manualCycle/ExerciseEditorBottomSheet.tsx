import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useCreateCycleDraftStore } from '../../store/useCreateCycleDraftStore';
import { useStore } from '../../store';
import { ExerciseBlock, Weekday, ExerciseWeekPlan } from '../../types/manualCycle';
import { SPACING, COLORS, TYPOGRAPHY, BORDER_RADIUS } from '../../constants';
import { IconAddLine, IconMinusLine } from '../icons';
import { BottomDrawer } from '../common/BottomDrawer';
import { Toggle } from '../Toggle';
import { formatWeight, toDisplayWeight, fromDisplayWeight } from '../../utils/weight';
import { useTranslation } from '../../i18n/useTranslation';

interface ExerciseEditorBottomSheetProps {
  weekday: Weekday;
  exerciseBlock: ExerciseBlock;
  visible: boolean;
  onClose: () => void;
}

export const ExerciseEditorBottomSheet = ({
  weekday,
  exerciseBlock,
  visible,
  onClose,
}: ExerciseEditorBottomSheetProps) => {
  const { exercises: exerciseLibrary, settings } = useStore();
  const { updateExerciseWeekPlan, applyExercisePlanToAllWeeks } =
    useCreateCycleDraftStore();
  const { t } = useTranslation();

  const exerciseData = exerciseLibrary.find((e) => e.id === exerciseBlock.exerciseId);

  const activeWeekIndex = 0;
  const currentWeek = exerciseBlock.weeks[activeWeekIndex] || {};
  const isTimeBased = currentWeek.isTimeBased || false;
  const useKg = settings.useKg;
  const weightStep = useKg ? 2.5 : 5;

  const handleUpdateField = useCallback(
    (field: keyof ExerciseWeekPlan, value: any) => {
      updateExerciseWeekPlan(weekday, exerciseBlock.id, activeWeekIndex, {
        [field]: value,
      });
      applyExercisePlanToAllWeeks(weekday, exerciseBlock.id, activeWeekIndex);
    },
    [
      weekday,
      exerciseBlock.id,
      activeWeekIndex,
      updateExerciseWeekPlan,
      applyExercisePlanToAllWeeks,
    ]
  );

  const handleStepper = (field: 'sets' | 'reps' | 'weight', delta: number) => {
    if (field === 'reps') {
      const currentValue =
        parseInt(currentWeek.reps || (isTimeBased ? '30' : '8'), 10) || 0;
      const step = isTimeBased ? 5 : 1;
      const min = isTimeBased ? 5 : 1;
      const nextValue = Math.max(min, currentValue + delta * step);
      handleUpdateField('reps', `${nextValue}`);
      return;
    }

    if (field === 'sets') {
      const currentValue = (currentWeek.sets as number) || 3;
      const nextValue = Math.max(1, currentValue + delta);
      handleUpdateField('sets', nextValue);
      return;
    }

    const currentValue = (currentWeek.weight as number) || 0;
    const nextDisplay = Math.max(
      0,
      toDisplayWeight(currentValue, useKg) + delta * weightStep
    );
    handleUpdateField('weight', fromDisplayWeight(nextDisplay, useKg));
  };

  return (
    <BottomDrawer
      visible={visible}
      onClose={onClose}
      maxHeight="90%"
      fixedHeight={true}
      bottomOffset={8}
      showHandle={false}
      scrollable={true}
      contentStyle={styles.drawerContent}
    >
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{exerciseData?.name || 'Unknown Exercise'}</Text>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={onClose}
            activeOpacity={1}
          >
            <Text style={styles.doneButtonText}>{t('done')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingsContainer}>
          <View style={styles.toggleRow}>
            <Toggle
              label="Time-based exercise"
              value={isTimeBased}
              onValueChange={(value) => handleUpdateField('isTimeBased', value)}
            />
          </View>

          <View style={styles.adjustRow}>
            <View style={styles.adjustValue}>
              <Text style={styles.adjustValueText}>
                {formatWeight(currentWeek.weight || 0, useKg)}
              </Text>
              <Text style={styles.adjustUnit}>{useKg ? 'kg' : 'lb'}</Text>
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

          <View style={styles.adjustRow}>
            <View style={styles.adjustValue}>
              <Text style={styles.adjustValueText}>
                {currentWeek.reps || (isTimeBased ? '30' : '8')}
              </Text>
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

          <View style={styles.adjustRow}>
            <View style={styles.adjustValue}>
              <Text style={styles.adjustValueText}>{currentWeek.sets || 3}</Text>
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
      </ScrollView>
    </BottomDrawer>
  );
};

const styles = StyleSheet.create({
  drawerContent: {
    flex: 1,
  },
  content: {
    paddingBottom: SPACING.xxxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDimmed,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    flex: 1,
  },
  doneButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  doneButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
  },
  settingsContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xl,
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
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.accentPrimaryDimmed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustDivider: {
    height: 1,
    backgroundColor: COLORS.borderDimmed,
    marginVertical: 16,
  },
});

