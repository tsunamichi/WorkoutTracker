import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { WorkoutTemplate, WorkoutType } from '../types';
import { COLORS, SPACING } from '../constants';

interface WorkoutTemplateEditSheetProps {
  visible: boolean;
  template: WorkoutTemplate | null;
  onClose: () => void;
  onSave: (updates: Partial<WorkoutTemplate>) => void;
  onDelete: () => void;
  onEditFull: () => void;
}

export function WorkoutTemplateEditSheet({ 
  visible, 
  template, 
  onClose, 
  onSave, 
  onDelete,
  onEditFull 
}: WorkoutTemplateEditSheetProps) {
  const [name, setName] = useState('');
  const [workoutType, setWorkoutType] = useState<WorkoutType>('Other');
  const [dayOfWeek, setDayOfWeek] = useState<number | undefined>();
  
  useEffect(() => {
    if (template && visible) {
      setName(template.name);
      setWorkoutType(template.workoutType);
      setDayOfWeek(template.dayOfWeek);
    }
  }, [template, visible]);
  
  const workoutTypes: WorkoutType[] = ['Push', 'Pull', 'Legs', 'Full Body', 'Mobility', 'Other'];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a workout name');
      return;
    }
    
    onSave({
      name,
      workoutType,
      dayOfWeek,
    });
    onClose();
  };
  
  const handleDelete = () => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete();
            onClose();
          },
        },
      ]
    );
  };
  
  if (!template) {
    return null;
  }
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} activeOpacity={1}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Workout</Text>
          <TouchableOpacity onPress={handleSave} activeOpacity={1}>
            <Text style={styles.saveButton}>Save</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Name */}
          <View style={styles.section}>
            <Text style={styles.label}>Workout Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Push A"
              value={name}
              onChangeText={setName}
              autoFocus={false}
            />
          </View>
          
          {/* Type */}
          <View style={styles.section}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.typeGrid}>
              {workoutTypes.map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeChip,
                    workoutType === type && styles.typeChipSelected
                  ]}
                  onPress={() => setWorkoutType(type)}
                  activeOpacity={1}
                >
                  <Text style={[
                    styles.typeChipText,
                    workoutType === type && styles.typeChipTextSelected
                  ]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {/* Day of Week */}
          <View style={styles.section}>
            <Text style={styles.label}>Assign to Day (optional)</Text>
            <View style={styles.dayGrid}>
              {dayNames.map((day, idx) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayChip,
                    dayOfWeek === idx + 1 && styles.dayChipSelected
                  ]}
                  onPress={() => setDayOfWeek(dayOfWeek === idx + 1 ? undefined : idx + 1)}
                  activeOpacity={1}
                >
                  <Text style={[
                    styles.dayChipText,
                    dayOfWeek === idx + 1 && styles.dayChipTextSelected
                  ]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {/* Exercise Info */}
          <View style={styles.section}>
            <Text style={styles.label}>Exercises</Text>
            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseCount}>
                {template.exercises.length} exercise{template.exercises.length !== 1 ? 's' : ''}
              </Text>
              <TouchableOpacity onPress={onEditFull} activeOpacity={1}>
                <Text style={styles.editExercisesButton}>Edit Exercises →</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Delete Button */}
          <View style={styles.dangerZone}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              activeOpacity={1}
            >
              <Text style={styles.deleteButtonText}>Delete Workout</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cancelButton: {
    fontSize: 17,
    color: COLORS.accentPrimary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  saveButton: {
    fontSize: 17,
    color: COLORS.accentPrimary,
    fontWeight: '600',
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: 15,
    marginBottom: SPACING.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SPACING.xs / 2,
  },
  typeChip: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    margin: SPACING.xs / 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeChipSelected: {
    backgroundColor: COLORS.accentLight,
    borderColor: COLORS.accentPrimary,
  },
  typeChipText: {
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  typeChipTextSelected: {
    color: COLORS.accentPrimary,
    fontWeight: '600',
  },
  dayGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayChip: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    marginHorizontal: 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayChipSelected: {
    backgroundColor: COLORS.accentPrimary,
    borderColor: COLORS.accentPrimary,
  },
  dayChipText: {
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  dayChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  exerciseInfo: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exerciseCount: {
    fontSize: 17,
    color: COLORS.textPrimary,
  },
  editExercisesButton: {
    fontSize: 15,
    color: COLORS.accentPrimary,
    fontWeight: '500',
  },
  dangerZone: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  deleteButton: {
    backgroundColor: COLORS.error,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

