import React, { forwardRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
} from 'react-native';
// import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useCreateCycleDraftStore } from '../../store/useCreateCycleDraftStore';
import { useStore } from '../../store';
import { ExerciseBlock, Weekday, ExerciseWeekPlan } from '../../types/manualCycle';
import { SPACING } from '../../constants';
import { IconAdd, IconMinus } from '../icons';

interface ExerciseEditorBottomSheetProps {
  weekday: Weekday;
  exerciseBlock: ExerciseBlock;
  onClose: () => void;
}

const LIGHT_COLORS = {
  backgroundContainer: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#3C3C43',
  textMeta: '#817B77',
  accent: '#FD6B00',
  border: '#C7C7CC',
};

const SNAP_POINTS = ['90%'];

export const ExerciseEditorBottomSheet = forwardRef<
  BottomSheet,
  ExerciseEditorBottomSheetProps
>(({ weekday, exerciseBlock, onClose }, ref) => {
  const { exercises: exerciseLibrary } = useStore();
  const { updateExerciseWeekPlan, applyExercisePlanToAllWeeks } =
    useCreateCycleDraftStore();

  const exerciseData = exerciseLibrary.find((e) => e.id === exerciseBlock.exerciseId);

  const [activeWeekIndex, setActiveWeekIndex] = useState(0);
  const [sameEveryWeek, setSameEveryWeek] = useState(false);

  const currentWeek = exerciseBlock.weeks[activeWeekIndex] || {};

  const handleUpdateField = useCallback(
    (field: keyof ExerciseWeekPlan, value: any) => {
      updateExerciseWeekPlan(weekday, exerciseBlock.id, activeWeekIndex, {
        [field]: value,
      });
    },
    [weekday, exerciseBlock.id, activeWeekIndex, updateExerciseWeekPlan]
  );

  const handleCopyToAllWeeks = () => {
    applyExercisePlanToAllWeeks(weekday, exerciseBlock.id, activeWeekIndex);
  };

  const handleStepper = (field: 'sets' | 'restSec', delta: number) => {
    const currentValue = (currentWeek[field] as number) || 0;
    const newValue = Math.max(0, currentValue + delta);
    handleUpdateField(field, newValue);
  };

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{exerciseData?.name || 'Unknown Exercise'}</Text>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Fill Toggle */}
        <View style={styles.quickFillContainer}>
          <View>
            <Text style={styles.quickFillLabel}>Same every week</Text>
            <Text style={styles.quickFillSubtext}>Apply settings to all weeks</Text>
          </View>
          <Switch
            value={sameEveryWeek}
            onValueChange={setSameEveryWeek}
            trackColor={{ false: LIGHT_COLORS.border, true: LIGHT_COLORS.accent }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Copy Button */}
        {!sameEveryWeek && (
          <TouchableOpacity
            style={styles.copyButton}
            onPress={handleCopyToAllWeeks}
            activeOpacity={0.7}
          >
            <Text style={styles.copyButtonText}>Copy current week to all weeks</Text>
          </TouchableOpacity>
        )}

        {/* Week Tabs */}
        {!sameEveryWeek && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.weekTabsContainer}
            contentContainerStyle={styles.weekTabsContent}
          >
            {exerciseBlock.weeks.map((week, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.weekTab,
                  index === activeWeekIndex && styles.weekTabActive,
                ]}
                onPress={() => setActiveWeekIndex(index)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.weekTabText,
                    index === activeWeekIndex && styles.weekTabTextActive,
                  ]}
                >
                  W{index + 1}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Exercise Fields */}
        <View style={styles.fieldsContainer}>
          {/* Sets */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Sets</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => handleStepper('sets', -1)}
                activeOpacity={0.7}
              >
                <IconMinus size={18} color={LIGHT_COLORS.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{currentWeek.sets || 0}</Text>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => handleStepper('sets', 1)}
                activeOpacity={0.7}
              >
                <IconAdd size={18} color={LIGHT_COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Reps */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Reps</Text>
            <TextInput
              style={styles.input}
              value={currentWeek.reps || ''}
              onChangeText={(text) => handleUpdateField('reps', text)}
              placeholder="e.g., 8-12"
              placeholderTextColor={LIGHT_COLORS.textMeta}
            />
          </View>

          {/* Weight & Unit */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Weight</Text>
            <View style={styles.weightContainer}>
              <TextInput
                style={[styles.input, styles.weightInput]}
                value={currentWeek.weight?.toString() || ''}
                onChangeText={(text) => {
                  const num = parseFloat(text);
                  handleUpdateField('weight', isNaN(num) ? undefined : num);
                }}
                placeholder="0"
                placeholderTextColor={LIGHT_COLORS.textMeta}
                keyboardType="numeric"
              />
              <View style={styles.unitToggle}>
                <TouchableOpacity
                  style={[
                    styles.unitButton,
                    currentWeek.unit === 'lb' && styles.unitButtonActive,
                  ]}
                  onPress={() => handleUpdateField('unit', 'lb')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.unitButtonText,
                      currentWeek.unit === 'lb' && styles.unitButtonTextActive,
                    ]}
                  >
                    lb
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.unitButton,
                    currentWeek.unit === 'kg' && styles.unitButtonActive,
                  ]}
                  onPress={() => handleUpdateField('unit', 'kg')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.unitButtonText,
                      currentWeek.unit === 'kg' && styles.unitButtonTextActive,
                    ]}
                  >
                    kg
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Rest Seconds */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Rest (seconds)</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => handleStepper('restSec', -15)}
                activeOpacity={0.7}
              >
                <IconMinus size={18} color={LIGHT_COLORS.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{currentWeek.restSec || 0}</Text>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => handleStepper('restSec', 15)}
                activeOpacity={0.7}
              >
                <IconAdd size={18} color={LIGHT_COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tempo */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Tempo (optional)</Text>
            <TextInput
              style={styles.input}
              value={currentWeek.tempo || ''}
              onChangeText={(text) => handleUpdateField('tempo', text)}
              placeholder="e.g., 3-1-1"
              placeholderTextColor={LIGHT_COLORS.textMeta}
            />
          </View>

          {/* Notes */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={currentWeek.notes || ''}
              onChangeText={(text) => handleUpdateField('notes', text)}
              placeholder="Add notes..."
              placeholderTextColor={LIGHT_COLORS.textMeta}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  bottomSheetBackground: {
    backgroundColor: LIGHT_COLORS.backgroundContainer,
  },
  handleIndicator: {
    backgroundColor: LIGHT_COLORS.border,
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
    borderBottomColor: LIGHT_COLORS.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: LIGHT_COLORS.textPrimary,
    flex: 1,
  },
  doneButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: LIGHT_COLORS.accent,
  },
  quickFillContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: LIGHT_COLORS.border,
  },
  quickFillLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: LIGHT_COLORS.textPrimary,
  },
  quickFillSubtext: {
    fontSize: 13,
    color: LIGHT_COLORS.textMeta,
    marginTop: 2,
  },
  copyButton: {
    backgroundColor: LIGHT_COLORS.accent + '15',
    paddingVertical: 12,
    paddingHorizontal: SPACING.xxl,
    marginHorizontal: SPACING.xxl,
    marginTop: SPACING.lg,
    borderRadius: 8,
    alignItems: 'center',
  },
  copyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: LIGHT_COLORS.accent,
  },
  weekTabsContainer: {
    marginTop: SPACING.lg,
  },
  weekTabsContent: {
    paddingHorizontal: SPACING.xxl,
    gap: 8,
  },
  weekTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LIGHT_COLORS.border,
    backgroundColor: LIGHT_COLORS.backgroundContainer,
  },
  weekTabActive: {
    backgroundColor: LIGHT_COLORS.accent,
    borderColor: LIGHT_COLORS.accent,
  },
  weekTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: LIGHT_COLORS.textSecondary,
  },
  weekTabTextActive: {
    color: '#FFFFFF',
  },
  fieldsContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xl,
    gap: SPACING.xl,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: LIGHT_COLORS.textPrimary,
  },
  input: {
    backgroundColor: LIGHT_COLORS.backgroundContainer,
    borderWidth: 1,
    borderColor: LIGHT_COLORS.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    fontSize: 16,
    color: LIGHT_COLORS.textPrimary,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LIGHT_COLORS.backgroundContainer,
    borderWidth: 1,
    borderColor: LIGHT_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: LIGHT_COLORS.textPrimary,
  },
  weightContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  weightInput: {
    flex: 1,
  },
  unitToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LIGHT_COLORS.border,
    overflow: 'hidden',
  },
  unitButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: LIGHT_COLORS.backgroundContainer,
  },
  unitButtonActive: {
    backgroundColor: LIGHT_COLORS.accent,
  },
  unitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: LIGHT_COLORS.textSecondary,
  },
  unitButtonTextActive: {
    color: '#FFFFFF',
  },
});

