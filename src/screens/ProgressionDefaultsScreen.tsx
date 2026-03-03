import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconArrowLeft } from '../components/icons';
import type { ProgressionDefaults as ProgressionDefaultsType, ProgressionMode } from '../types/progression';

const MODES: { value: ProgressionMode; label: string }[] = [
  { value: 'double', label: 'Double (reps then weight)' },
  { value: 'weight_only', label: 'Weight only' },
  { value: 'reps_only', label: 'Reps only' },
];

const DEFAULT_DEFAULTS: ProgressionDefaultsType = {
  repRangeMin: 8,
  repRangeMax: 12,
  weightIncrement: 2.5,
  progressionMode: 'double',
};

export function ProgressionDefaultsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { progressionDefaults, setProgressionDefaults } = useStore();
  const current = progressionDefaults ?? DEFAULT_DEFAULTS;

  const [repMin, setRepMin] = useState(String(current.repRangeMin));
  const [repMax, setRepMax] = useState(String(current.repRangeMax));
  const [weightInc, setWeightInc] = useState(String(current.weightIncrement));
  const [mode, setMode] = useState<ProgressionMode>(current.progressionMode);

  useEffect(() => {
    setRepMin(String(current.repRangeMin));
    setRepMax(String(current.repRangeMax));
    setWeightInc(String(current.weightIncrement));
    setMode(current.progressionMode);
  }, [current.repRangeMin, current.repRangeMax, current.weightIncrement, current.progressionMode]);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

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
    await setProgressionDefaults({
      repRangeMin: min,
      repRangeMax: max,
      weightIncrement: inc,
      progressionMode: mode,
    });
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <IconArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave} activeOpacity={0.7}>
          <Text style={styles.saveButton}>Save</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.pageTitleContainer}>
          <Text style={styles.pageTitle}>Defaults</Text>
          <Text style={styles.pageDescription}>
            Used when an exercise has no group and no override.
          </Text>
        </View>

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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundCanvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.md,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -12,
  },
  saveButton: { ...TYPOGRAPHY.bodyBold, color: COLORS.primary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.xxl, paddingBottom: SPACING.xxxl },
  pageTitleContainer: { paddingTop: SPACING.md, marginBottom: SPACING.xxxl },
  pageTitle: { ...TYPOGRAPHY.h2, color: COLORS.text, marginBottom: SPACING.xs },
  pageDescription: { ...TYPOGRAPHY.meta, color: COLORS.textMeta },
  card: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  label: { ...TYPOGRAPHY.bodyBold, color: COLORS.text, marginBottom: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
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
  rangeDash: { ...TYPOGRAPHY.body, color: COLORS.textMeta },
  modeRow: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.xs,
  },
  modeRowSelected: { backgroundColor: COLORS.accentPrimaryDimmed },
  modeLabel: { ...TYPOGRAPHY.body, color: COLORS.text },
  modeLabelSelected: { ...TYPOGRAPHY.bodyBold, color: COLORS.text },
});
