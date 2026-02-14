import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, BUTTONS } from '../constants';
import { BottomDrawer } from './common/BottomDrawer';
import { Toggle } from './Toggle';
import { IconAddLine, IconMinusLine } from './icons';
import { useTranslation } from '../i18n/useTranslation';
import { formatWeightForLoad, toDisplayWeight, fromDisplayWeight } from '../utils/weight';
import { useStore } from '../store';
import type { AccessoryItem } from '../types/training';
import { getDisplayValuesFromItem } from '../utils/exerciseMigration';

interface AccessoryItemEditorSheetProps {
  item: AccessoryItem;
  visible: boolean;
  onClose: () => void;
  onSave: (updates: Partial<AccessoryItem>) => void;
  onDelete: () => void;
}

export function AccessoryItemEditorSheet({
  item,
  visible,
  onClose,
  onSave,
  onDelete,
}: AccessoryItemEditorSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { settings } = useStore();
  const useKg = settings.useKg;
  const weightUnit = useKg ? 'kg' : 'lb';
  const weightStep = useKg ? 0.5 : 5;
  
  // Extract display values from new structure
  const displayValues = getDisplayValuesFromItem(item);
  
  const [exerciseName, setExerciseName] = useState(displayValues.exerciseName);
  const [sets, setSets] = useState(displayValues.sets || 1);
  const [reps, setReps] = useState(displayValues.reps || 10);
  const [weight, setWeight] = useState(displayValues.weight || 0);
  const [isTimeBased, setIsTimeBased] = useState(displayValues.isTimeBased || false);
  const [isPerSide, setIsPerSide] = useState(displayValues.isPerSide || false);
  
  // Check if item is part of a cycle (to disable sets control)
  const isPartOfCycle = !!item.cycleId;
  const isFirstInCycle = isPartOfCycle && item.cycleOrder === 0;

  // Reset form when item changes
  useEffect(() => {
    const newDisplayValues = getDisplayValuesFromItem(item);
    setExerciseName(newDisplayValues.exerciseName);
    setSets(newDisplayValues.sets || 1);
    setReps(newDisplayValues.reps || 10);
    setWeight(newDisplayValues.weight || 0);
    setIsTimeBased(newDisplayValues.isTimeBased || false);
    setIsPerSide(newDisplayValues.isPerSide || false);
  }, [item]);

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    onSave({
      exerciseName: exerciseName.trim(),
      sets,
      reps,
      weight,
      isTimeBased,
      isPerSide,
    });
  };

  const handleToggleTimeBased = (value: boolean) => {
    setIsTimeBased(value);
    // When toggling to time-based, round reps to nearest multiple of 5
    if (value) {
      const roundedReps = Math.ceil(reps / 5) * 5;
      setReps(Math.max(5, roundedReps));
    }
  };

  const handleStepper = (field: 'sets' | 'reps' | 'weight', delta: number) => {
    if (field === 'weight') {
      const currentDisplay = toDisplayWeight(weight, useKg);
      const nextDisplay = Math.max(0, currentDisplay + delta * weightStep);
      setWeight(fromDisplayWeight(nextDisplay, useKg));
    } else if (field === 'reps') {
      const step = isTimeBased ? 5 : 1;
      const min = isTimeBased ? 5 : 1;
      setReps(Math.max(min, reps + delta * step));
    } else if (field === 'sets') {
      setSets(Math.max(1, sets + delta));
    }
  };

  const canSave = exerciseName.trim().length > 0;

  return (
    <BottomDrawer
      visible={visible}
      onClose={onClose}
      maxHeight="90%"
      fixedHeight={true}
      showHandle={false}
      scrollable={false}
      contentStyle={styles.drawerContent}
    >
      <View style={styles.sheetContainer}>
        <ScrollView contentContainerStyle={styles.content} bounces={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {item.exerciseName || 'Add Core Exercise'}
            </Text>
          </View>

          {/* Exercise Name */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('exerciseName')}</Text>
            <TextInput
              style={styles.input}
              value={exerciseName}
              onChangeText={setExerciseName}
              placeholder="Enter exercise name"
              placeholderTextColor={COLORS.textMeta}
              autoCapitalize="words"
            />
          </View>

          {/* Settings Container */}
          <View style={styles.settingsContainer}>
            {/* Time-based Toggle */}
            <View style={styles.toggleRow}>
              <Toggle
                label={t('timeBased')}
                value={isTimeBased}
                onValueChange={handleToggleTimeBased}
              />
            </View>

            {/* Per Side Toggle */}
            <View style={styles.toggleRow}>
              <Toggle
                label="Per side"
                value={isPerSide}
                onValueChange={setIsPerSide}
              />
            </View>

            {isPartOfCycle && !isFirstInCycle && (
              <View style={styles.cycleInfoBanner}>
                <Text style={styles.cycleInfoText}>
                  {t('cycleSetsSyncedInfo')}
                </Text>
              </View>
            )}

            {/* Values Card */}
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
                  <Text style={[styles.adjustValueText, isPartOfCycle && !isFirstInCycle && styles.disabledText]}>
                    {sets}
                  </Text>
                  <Text style={[styles.adjustUnit, isPartOfCycle && !isFirstInCycle && styles.disabledText]}>
                    {t('setsUnit')}
                  </Text>
                </View>
                <View style={styles.adjustButtons}>
                  <TouchableOpacity
                    style={styles.adjustButtonTapTarget}
                    onPress={() => handleStepper('sets', -1)}
                    activeOpacity={1}
                    disabled={isPartOfCycle && !isFirstInCycle}
                  >
                    <View style={[styles.adjustButton, isPartOfCycle && !isFirstInCycle && styles.disabledButton]}>
                      <View style={[styles.adjustButtonInner, isPartOfCycle && !isFirstInCycle && styles.disabledButtonInner]}>
                        <IconMinusLine 
                          size={24} 
                          color={isPartOfCycle && !isFirstInCycle ? COLORS.textMeta : COLORS.accentPrimary} 
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.adjustButtonTapTarget}
                    onPress={() => handleStepper('sets', 1)}
                    activeOpacity={1}
                    disabled={isPartOfCycle && !isFirstInCycle}
                  >
                    <View style={[styles.adjustButton, isPartOfCycle && !isFirstInCycle && styles.disabledButton]}>
                      <View style={[styles.adjustButtonInner, isPartOfCycle && !isFirstInCycle && styles.disabledButtonInner]}>
                        <IconAddLine 
                          size={24} 
                          color={isPartOfCycle && !isFirstInCycle ? COLORS.textMeta : COLORS.accentPrimary} 
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              !canSave && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={1}
          >
            <Text style={styles.saveButtonText}>{t('save')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomDrawer>
  );
}

const styles = StyleSheet.create({
  drawerContent: {
    flex: 1,
  },
  sheetContainer: {
    flex: 1,
    paddingHorizontal: SPACING.xxl,
  },
  content: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
  },
  field: {
    marginBottom: SPACING.xl,
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
  disabledText: {
    opacity: 0.5,
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledButtonInner: {
    backgroundColor: COLORS.borderDimmed,
  },
  valuesCard: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  adjustValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.sm,
  },
  adjustValueText: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
  },
  adjustUnit: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  adjustButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
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
    borderRadius: 12,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  adjustButtonInner: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentPrimaryDimmed,
  },
  adjustDivider: {
    height: 1,
    backgroundColor: COLORS.borderDimmed,
    marginHorizontal: SPACING.xl,
  },
  saveButtonContainer: {
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.md,
  },
  saveButton: {
    ...BUTTONS.primaryButtonLabeled,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.backgroundCanvas,
  },
});
