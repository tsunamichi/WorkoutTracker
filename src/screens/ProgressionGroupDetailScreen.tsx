import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconArrowLeft, IconAdd, IconTrash } from '../components/icons';
import type { ProgressionMode } from '../types/progression';

type RouteParams = { ProgressionGroupDetail: { groupId: string } };

const MODES: { value: ProgressionMode; label: string }[] = [
  { value: 'double', label: 'Double (reps → weight)' },
  { value: 'weight_only', label: 'Weight only' },
  { value: 'reps_only', label: 'Reps only' },
];

export function ProgressionGroupDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'ProgressionGroupDetail'>>();
  const { groupId } = route.params;

  const {
    progressionGroups,
    updateProgressionGroup,
    deleteProgressionGroup,
    exercises: exercisesLibrary,
    progressionRules,
    getProgressionRule,
    setProgressionRule,
    removeProgressionRule,
  } = useStore();

  const group = progressionGroups.find(g => g.id === groupId);

  const [name, setName] = useState(group?.name ?? '');
  const [repMin, setRepMin] = useState(String(group?.repRangeMin ?? 8));
  const [repMax, setRepMax] = useState(String(group?.repRangeMax ?? 12));
  const [weightInc, setWeightInc] = useState(String(group?.weightIncrement ?? 2.5));
  const [mode, setMode] = useState<ProgressionMode>(group?.progressionMode ?? 'double');
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const exerciseNames = useMemo(() => {
    const map: Record<string, string> = {};
    exercisesLibrary.forEach(ex => { map[ex.id] = ex.name; });
    return map;
  }, [exercisesLibrary]);

  const filteredExercises = useMemo(() => {
    const existingIds = new Set(group?.exerciseIds ?? []);
    const q = searchQuery.toLowerCase();
    return exercisesLibrary
      .filter(ex => !existingIds.has(ex.id))
      .filter(ex => !q || ex.name.toLowerCase().includes(q));
  }, [exercisesLibrary, group?.exerciseIds, searchQuery]);

  if (!group) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>Group not found</Text>
      </View>
    );
  }

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleSave = async () => {
    const min = parseInt(repMin, 10);
    const max = parseInt(repMax, 10);
    const inc = parseFloat(weightInc);
    if (!name.trim()) { Alert.alert('Invalid', 'Group name is required'); return; }
    if (Number.isNaN(min) || min < 1 || min > 50) { Alert.alert('Invalid', 'Rep range min must be 1–50'); return; }
    if (Number.isNaN(max) || max < min || max > 50) { Alert.alert('Invalid', 'Rep range max must be ≥ min and ≤ 50'); return; }
    if (Number.isNaN(inc) || inc < 0) { Alert.alert('Invalid', 'Weight increment must be ≥ 0'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateProgressionGroup(groupId, {
      name: name.trim(),
      repRangeMin: min,
      repRangeMax: max,
      weightIncrement: inc,
      progressionMode: mode,
    });
    navigation.goBack();
  };

  const handleDelete = () => {
    Alert.alert('Delete group', `Delete "${group.name}" and all its exercise overrides?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await deleteProgressionGroup(groupId);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleAddExercise = async (exerciseId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updatedIds = [...group.exerciseIds, exerciseId];
    await updateProgressionGroup(groupId, { exerciseIds: updatedIds });
    setShowExercisePicker(false);
    setSearchQuery('');
  };

  const handleRemoveExercise = (exerciseId: string) => {
    const exName = exerciseNames[exerciseId] || 'this exercise';
    Alert.alert('Remove exercise', `Remove "${exName}" from this group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const updatedIds = group.exerciseIds.filter(id => id !== exerciseId);
          await updateProgressionGroup(groupId, { exerciseIds: updatedIds });
          await removeProgressionRule(exerciseId);
        },
      },
    ]);
  };

  const openRuleEditor = (exerciseId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingExerciseId(exerciseId);
    setShowRuleEditor(true);
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
        {/* Group name */}
        <View style={styles.card}>
          <Text style={styles.label}>Group name</Text>
          <TextInput
            style={styles.inputFull}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Main Lifts"
            placeholderTextColor={COLORS.textMeta}
          />
        </View>

        {/* Group defaults */}
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
          <Text style={styles.label}>Weight increment</Text>
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
          {MODES.map(m => (
            <TouchableOpacity
              key={m.value}
              style={[styles.modeRow, mode === m.value && styles.modeRowSelected]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMode(m.value); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.modeLabel, mode === m.value && styles.modeLabelSelected]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Exercises in group */}
        <Text style={styles.sectionLabel}>Exercises</Text>
        {group.exerciseIds.length === 0 && (
          <Text style={styles.emptyText}>No exercises assigned yet.</Text>
        )}
        {[...group.exerciseIds]
          .sort((a, b) => (exerciseNames[a] || a).localeCompare(exerciseNames[b] || b))
          .map(exId => {
          const rule = getProgressionRule(exId);
          const hasOverride = !!rule;
          return (
            <View key={exId} style={styles.exerciseRow}>
              <TouchableOpacity
                style={styles.exerciseInfo}
                onPress={() => openRuleEditor(exId)}
                activeOpacity={0.7}
              >
                <Text style={styles.exerciseName} numberOfLines={1}>
                  {exerciseNames[exId] || exId}
                </Text>
                {hasOverride && (
                  <Text style={styles.exerciseMeta}>Custom override</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRemoveExercise(exId)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <IconTrash size={18} color={COLORS.textMeta} />
              </TouchableOpacity>
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.addExerciseButton}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowExercisePicker(true); }}
          activeOpacity={0.7}
        >
          <IconAdd size={20} color={COLORS.primary} />
          <Text style={styles.addExerciseLabel}>Add exercise</Text>
        </TouchableOpacity>

        {/* Delete group */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.7}>
          <IconTrash size={18} color={COLORS.error} />
          <Text style={styles.deleteLabel}>Delete group</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Exercise picker modal */}
      <Modal visible={showExercisePicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowExercisePicker(false)}>
        <SafeAreaView style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Add exercise</Text>
            <TouchableOpacity onPress={() => { setShowExercisePicker(false); setSearchQuery(''); }} style={styles.pickerClose}>
              <Text style={styles.pickerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search exercises…"
              placeholderTextColor={COLORS.textMeta}
              autoFocus
            />
          </View>
          <FlatList
            data={filteredExercises}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pickerItem} onPress={() => handleAddExercise(item.id)} activeOpacity={0.7}>
                <Text style={styles.pickerItemName}>{item.name}</Text>
                {item.category && (
                  <Text style={styles.pickerItemMeta}>{item.category}</Text>
                )}
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.pickerList}
            ListEmptyComponent={<Text style={styles.pickerEmpty}>{searchQuery ? 'No exercises found' : 'No exercises available'}</Text>}
          />
        </SafeAreaView>
      </Modal>

      {/* Rule editor modal */}
      {showRuleEditor && editingExerciseId && (
        <RuleEditorModal
          exerciseId={editingExerciseId}
          exerciseName={exerciseNames[editingExerciseId] || editingExerciseId}
          groupId={groupId}
          groupRepMin={parseInt(repMin, 10) || 8}
          groupRepMax={parseInt(repMax, 10) || 12}
          groupWeightInc={parseFloat(weightInc) || 2.5}
          groupMode={mode}
          onClose={() => { setShowRuleEditor(false); setEditingExerciseId(null); }}
        />
      )}
    </View>
  );
}

/* ---- Inline rule editor modal (Task 1.4) ---- */

interface RuleEditorModalProps {
  exerciseId: string;
  exerciseName: string;
  groupId: string;
  groupRepMin: number;
  groupRepMax: number;
  groupWeightInc: number;
  groupMode: ProgressionMode;
  onClose: () => void;
}

function RuleEditorModal({
  exerciseId,
  exerciseName,
  groupId,
  groupRepMin,
  groupRepMax,
  groupWeightInc,
  groupMode,
  onClose,
}: RuleEditorModalProps) {
  const { getProgressionRule, setProgressionRule, removeProgressionRule } = useStore();
  const existing = getProgressionRule(exerciseId);
  const hasExisting = !!existing;

  const [useOverride, setUseOverride] = useState(hasExisting);
  const [repMin, setRepMin] = useState(String(existing?.repRangeMin ?? groupRepMin));
  const [repMax, setRepMax] = useState(String(existing?.repRangeMax ?? groupRepMax));
  const [weightInc, setWeightInc] = useState(String(existing?.weightIncrement ?? groupWeightInc));
  const [mode, setMode] = useState<ProgressionMode>(existing?.progressionMode ?? groupMode);

  const handleSave = async () => {
    if (!useOverride) {
      await removeProgressionRule(exerciseId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onClose();
      return;
    }
    const min = parseInt(repMin, 10);
    const max = parseInt(repMax, 10);
    const inc = parseFloat(weightInc);
    if (Number.isNaN(min) || min < 1) { Alert.alert('Invalid', 'Rep min must be ≥ 1'); return; }
    if (Number.isNaN(max) || max < min) { Alert.alert('Invalid', 'Rep max must be ≥ min'); return; }
    if (Number.isNaN(inc) || inc < 0) { Alert.alert('Invalid', 'Weight increment must be ≥ 0'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setProgressionRule({
      id: existing?.id ?? `pr-${Date.now()}`,
      exerciseId,
      groupId,
      repRangeMin: min,
      repRangeMax: max,
      weightIncrement: inc,
      progressionMode: mode,
    });
    onClose();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={ruleStyles.container}>
        <View style={ruleStyles.header}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={ruleStyles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={ruleStyles.title} numberOfLines={1}>{exerciseName}</Text>
          <TouchableOpacity onPress={handleSave} activeOpacity={0.7}>
            <Text style={ruleStyles.save}>Save</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={ruleStyles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            style={[ruleStyles.toggleRow, !useOverride && ruleStyles.toggleRowSelected]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setUseOverride(false); }}
            activeOpacity={0.7}
          >
            <Text style={[ruleStyles.toggleLabel, !useOverride && ruleStyles.toggleLabelSelected]}>
              Use group defaults ({groupRepMin}–{groupRepMax} reps, +{groupWeightInc})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[ruleStyles.toggleRow, useOverride && ruleStyles.toggleRowSelected]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setUseOverride(true); }}
            activeOpacity={0.7}
          >
            <Text style={[ruleStyles.toggleLabel, useOverride && ruleStyles.toggleLabelSelected]}>
              Custom override
            </Text>
          </TouchableOpacity>

          {useOverride && (
            <View style={ruleStyles.fields}>
              <Text style={ruleStyles.fieldLabel}>Rep range</Text>
              <View style={ruleStyles.row}>
                <TextInput style={ruleStyles.input} value={repMin} onChangeText={setRepMin} keyboardType="number-pad" placeholderTextColor={COLORS.textMeta} />
                <Text style={ruleStyles.dash}>–</Text>
                <TextInput style={ruleStyles.input} value={repMax} onChangeText={setRepMax} keyboardType="number-pad" placeholderTextColor={COLORS.textMeta} />
              </View>
              <Text style={ruleStyles.fieldLabel}>Weight increment</Text>
              <TextInput style={ruleStyles.inputFull} value={weightInc} onChangeText={setWeightInc} keyboardType="decimal-pad" placeholderTextColor={COLORS.textMeta} />
              <Text style={ruleStyles.fieldLabel}>Progression mode</Text>
              {MODES.map(m => (
                <TouchableOpacity
                  key={m.value}
                  style={[ruleStyles.modeRow, mode === m.value && ruleStyles.modeRowSelected]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMode(m.value); }}
                  activeOpacity={0.7}
                >
                  <Text style={[ruleStyles.modeLabel, mode === m.value && ruleStyles.modeLabelSelected]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* ---- Styles ---- */

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
  backButton: { width: 48, height: 48, justifyContent: 'center', alignItems: 'flex-start', marginLeft: -12 },
  saveButton: { ...TYPOGRAPHY.bodyBold, color: COLORS.primary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.xxl, paddingBottom: SPACING.xxxl },
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
  sectionLabel: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
    marginTop: SPACING.md,
  },
  emptyText: { ...TYPOGRAPHY.meta, color: COLORS.textMeta, marginBottom: SPACING.lg },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  exerciseInfo: { flex: 1, marginRight: SPACING.md },
  exerciseName: { ...TYPOGRAPHY.bodyBold, color: COLORS.text, marginBottom: 2 },
  exerciseMeta: { ...TYPOGRAPHY.meta, color: COLORS.textMeta },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xxxl,
  },
  addExerciseLabel: { ...TYPOGRAPHY.bodyBold, color: COLORS.primary, marginLeft: SPACING.sm },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    marginBottom: SPACING.xxxl,
  },
  deleteLabel: { ...TYPOGRAPHY.bodyBold, color: COLORS.error, marginLeft: SPACING.sm },
  // Picker modal
  pickerContainer: { flex: 1, backgroundColor: COLORS.backgroundCanvas },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerTitle: { ...TYPOGRAPHY.h3, color: COLORS.text },
  pickerClose: { padding: 8 },
  pickerCloseText: { fontSize: 20, color: COLORS.text },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    margin: SPACING.xxl,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  searchIcon: { fontSize: 18 },
  searchInput: { flex: 1, fontSize: 16, color: COLORS.text },
  pickerList: { paddingHorizontal: SPACING.xxl, paddingBottom: SPACING.xxl },
  pickerItem: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  pickerItemName: { ...TYPOGRAPHY.bodyBold, color: COLORS.text },
  pickerItemMeta: { ...TYPOGRAPHY.meta, color: COLORS.textMeta, marginTop: 2 },
  pickerEmpty: { ...TYPOGRAPHY.meta, color: COLORS.textMeta, textAlign: 'center', paddingVertical: SPACING.xxxl },
});

const ruleStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundCanvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cancel: { ...TYPOGRAPHY.body, color: COLORS.textMeta },
  title: { ...TYPOGRAPHY.bodyBold, color: COLORS.text, flex: 1, textAlign: 'center', marginHorizontal: SPACING.md },
  save: { ...TYPOGRAPHY.bodyBold, color: COLORS.primary },
  content: { padding: SPACING.xxl },
  toggleRow: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.activeCard,
    marginBottom: SPACING.sm,
  },
  toggleRowSelected: { backgroundColor: COLORS.accentPrimaryDimmed },
  toggleLabel: { ...TYPOGRAPHY.body, color: COLORS.text },
  toggleLabelSelected: { ...TYPOGRAPHY.bodyBold, color: COLORS.text },
  fields: { marginTop: SPACING.lg },
  fieldLabel: { ...TYPOGRAPHY.bodyBold, color: COLORS.text, marginBottom: SPACING.sm, marginTop: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  dash: { ...TYPOGRAPHY.body, color: COLORS.textMeta },
  input: {
    flex: 1,
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  inputFull: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
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
