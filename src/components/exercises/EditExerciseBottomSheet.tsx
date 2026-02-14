import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
// import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Exercise } from '../../types/workout';
import { COLORS } from '../../constants';
import { useTranslation } from '../../i18n/useTranslation';

interface EditExerciseBottomSheetProps {
  isVisible: boolean;
  exercise: Exercise | null;
  onClose: () => void;
  onSave: (exerciseId: string, updates: Partial<Exercise>) => void;
  onDelete: (exerciseId: string) => void;
}

const REPS_PRESETS = ['3', '5', '6-8', '8-10', '8-12', '10-12', '12-15', '15-20', 'AMRAP'];

export function EditExerciseBottomSheet({
  isVisible,
  exercise,
  onClose,
  onSave,
  onDelete,
}: EditExerciseBottomSheetProps) {
  const { t } = useTranslation();
  const bottomSheetRef = useRef<BottomSheet>(null);
  
  const [name, setName] = useState('');
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState('8-12');
  const [restSec, setRestSec] = useState(90);
  const [notes, setNotes] = useState('');

  const snapPoints = useMemo(() => ['60%', '85%'], []);

  useEffect(() => {
    if (exercise) {
      setName(exercise.name || '');
      setSets(exercise.sets || 3);
      setReps(exercise.reps || '8-12');
      setRestSec(exercise.restSec || 90);
      setNotes(exercise.notes || '');
    }
  }, [exercise]);

  const handleSave = useCallback(() => {
    if (!exercise) return;

    onSave(exercise.id, {
      name,
      sets,
      reps,
      restSec,
      notes,
    });
    onClose();
  }, [exercise, name, sets, reps, restSec, notes, onSave, onClose]);

  const handleDelete = useCallback(() => {
    if (!exercise) return;
    onDelete(exercise.id);
    onClose();
  }, [exercise, onDelete, onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  React.useEffect(() => {
    if (isVisible) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isVisible]);

  if (!exercise) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <ScrollView style={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('editExerciseTitle')}</Text>

        <View style={styles.field}>
          <Text style={styles.label}>{t('exerciseNameLabel')}</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder={t('exerciseNameLabel')}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('setsLabel')}</Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={styles.stepperButton}
              onPress={() => setSets(Math.max(1, sets - 1))}
            >
              <Text style={styles.stepperButtonText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{sets}</Text>
            <TouchableOpacity
              style={styles.stepperButton}
              onPress={() => setSets(Math.min(10, sets + 1))}
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('repsLabel')}</Text>
          <View style={styles.presetContainer}>
            {REPS_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset}
                style={[
                  styles.presetButton,
                  reps === preset && styles.presetButtonSelected,
                ]}
                onPress={() => setReps(preset)}
              >
                <Text
                  style={[
                    styles.presetButtonText,
                    reps === preset && styles.presetButtonTextSelected,
                  ]}
                >
                  {preset}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.textInput, styles.customRepsInput]}
            value={reps}
            onChangeText={setReps}
            placeholder={t('repsLabel')}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('restSecondsLabel')}</Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={styles.stepperButton}
              onPress={() => setRestSec(Math.max(0, restSec - 15))}
            >
              <Text style={styles.stepperButtonText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{restSec}s</Text>
            <TouchableOpacity
              style={styles.stepperButton}
              onPress={() => setRestSec(Math.min(300, restSec + 15))}
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('notesOptional')}</Text>
          <TextInput
            style={[styles.textInput, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('notesOptional')}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>{t('delete')}</Text>
          </TouchableOpacity>

          <View style={styles.rightActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>{t('save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#817B77',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonText: {
    fontSize: 24,
    color: '#3C3C43',
    fontWeight: '400',
  },
  stepperValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    minWidth: 60,
    textAlign: 'center',
  },
  presetContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2C2C2E',
  },
  presetButtonSelected: {
    backgroundColor: '#FD6B00',
  },
  presetButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3C3C43',
  },
  presetButtonTextSelected: {
    color: '#FFFFFF',
  },
  customRepsInput: {
    marginTop: 8,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 40,
  },
  deleteButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.signalNegative,
  },
  rightActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#817B77',
  },
  saveButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#FD6B00',
    borderRadius: 10,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

