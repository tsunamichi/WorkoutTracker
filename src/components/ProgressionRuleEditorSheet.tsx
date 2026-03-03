import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { BottomDrawer } from './common/BottomDrawer';
import type { ProgressionMode, ProgressionRule } from '../types/progression';

const MODES: { value: ProgressionMode; label: string }[] = [
  { value: 'double', label: 'Double (reps then weight)' },
  { value: 'weight_only', label: 'Weight only' },
  { value: 'reps_only', label: 'Reps only' },
];

interface ProgressionRuleEditorSheetProps {
  visible: boolean;
  onClose: () => void;
  exerciseId: string;
  exerciseName: string;
  groupId: string | null;
}

export function ProgressionRuleEditorSheet({
  visible,
  onClose,
  exerciseId,
  exerciseName,
  groupId,
}: ProgressionRuleEditorSheetProps) {
  const {
    getProgressionRule,
    getEffectiveProgressionRule,
    setProgressionRule,
    removeProgressionRule,
  } = useStore();

  const existingRule = getProgressionRule(exerciseId);
  const effective = getEffectiveProgressionRule(exerciseId);

  const [repMin, setRepMin] = useState(String(effective?.repRangeMin ?? 8));
  const [repMax, setRepMax] = useState(String(effective?.repRangeMax ?? 12));
  const [weightInc, setWeightInc] = useState(String(effective?.weightIncrement ?? 2.5));
  const [mode, setMode] = useState<ProgressionMode>(effective?.progressionMode ?? 'double');

  useEffect(() => {
    if (!visible) return;
    const eff = getEffectiveProgressionRule(exerciseId);
    if (eff) {
      setRepMin(String(eff.repRangeMin));
      setRepMax(String(eff.repRangeMax));
      setWeightInc(String(eff.weightIncrement));
      setMode(eff.progressionMode);
    }
  }, [visible, exerciseId, getEffectiveProgressionRule]);

  const handleSave = async () => {
    const min = parseInt(repMin, 10);
    const max = parseInt(repMax, 10);
    const inc = parseFloat(weightInc);
    if (Number.isNaN(min) || min < 1 || min > 50) {
      Alert.alert('Invalid', 'Rep range min must be 1–50');
      return;
    }
    if (Number.isNaN(max) || max < 1 || max > 50 || max < min) {
      Alert.alert('Invalid', 'Rep range max must be 1–50 and ≥ min');
      return;
    }
    if (Number.isNaN(inc) || inc < 0) {
      Alert.alert('Invalid', 'Weight increment must be ≥ 0');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const rule: ProgressionRule = {
      id: existingRule?.id ?? `rule-${exerciseId}`,
      exerciseId,
      groupId,
      repRangeMin: min,
      repRangeMax: max,
      weightIncrement: inc,
      progressionMode: mode,
      updatedAt: new Date().toISOString(),
    };
    await setProgressionRule(rule);
    onClose();
  };

  const handleUseGroupDefaults = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await removeProgressionRule(exerciseId);
    onClose();
  };

  return (
    <BottomDrawer
      visible={visible}
      onClose={onClose}
      showHandle
      scrollable
      keyboardShouldPersistTaps="handled"
    >
      {({ requestClose }) => (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Override for {exerciseName}</Text>
          <Text style={styles.description}>
            Override rep range, increment, and mode for this exercise. Otherwise it uses group or global defaults.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Rep range (min–max)</Text>
            <View style={styles.row}>
              <TextInput
                style={styles.input}
                value={repMin}
                onChangeText={setRepMin}
                keyboardType="number-pad"
                placeholder="8"
                placeholderTextColor={COLORS.textMeta}
              />
              <Text style={styles.rangeDash}>–</Text>
              <TextInput
                style={styles.input}
                value={repMax}
                onChangeText={setRepMax}
                keyboardType="number-pad"
                placeholder="12"
                placeholderTextColor={COLORS.textMeta}
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Weight increment (lb or kg)</Text>
            <TextInput
              style={styles.inputFull}
              value={weightInc}
              onChangeText={setWeightInc}
              keyboardType="decimal-pad"
              placeholder="2.5"
              placeholderTextColor={COLORS.textMeta}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Progression mode</Text>
            {MODES.map((m) => (
              <TouchableOpacity
                key={m.value}
                style={[styles.modeRow, mode === m.value && styles.modeRowSelected]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setMode(m.value);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modeLabel, mode === m.value && styles.modeLabelSelected]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleSave} activeOpacity={0.7}>
            <Text style={styles.primaryButtonText}>Save override</Text>
          </TouchableOpacity>

          {existingRule ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleUseGroupDefaults}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>Use group defaults</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.cancelButton} onPress={requestClose} activeOpacity={0.7}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </BottomDrawer>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: SPACING.xxl, paddingBottom: SPACING.xxxl },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  description: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  label: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  inputFull: {
    backgroundColor: COLORS.backgroundCanvas,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  rangeDash: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  modeRow: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.xs,
  },
  modeRowSelected: {
    backgroundColor: COLORS.accentPrimaryDimmed,
  },
  modeLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  modeLabelSelected: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  primaryButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.backgroundCanvas,
  },
  secondaryButton: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  secondaryButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.primary,
  },
  cancelButton: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
});
