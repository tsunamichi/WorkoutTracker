import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import BottomSheet from '@gorhom/bottom-sheet';
import { useCreateCycleDraftStore } from '../../store/useCreateCycleDraftStore';
import { formatWeekdayFull, getExerciseSummary } from '../../utils/manualCycleUtils';
import { Weekday, ExerciseBlock } from '../../types/manualCycle';
import { SPACING, TYPOGRAPHY } from '../../constants';
import { IconAdd, IconTrash } from '../../components/icons';
import { ExercisePickerModal } from '../../components/manualCycle/ExercisePickerModal';
import { ExerciseEditorBottomSheet } from '../../components/manualCycle/ExerciseEditorBottomSheet';
import { useStore } from '../../store';

interface CreateCycleDayEditorProps {
  navigation: any;
  route: {
    params: {
      weekday: Weekday;
    };
  };
}

const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  backgroundContainer: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#3C3C43',
  textMeta: '#817B77',
  accent: '#FD6B00',
  border: '#C7C7CC',
};

export function CreateCycleDayEditor({ navigation, route }: CreateCycleDayEditorProps) {
  const insets = useSafeAreaInsets();
  const { weekday } = route.params;

  const { workouts, setWorkoutDayName, addExerciseToDay, removeExerciseFromDay } =
    useCreateCycleDraftStore();

  const { exercises: exerciseLibrary } = useStore();

  const workout = workouts.find((w) => w.weekday === weekday);

  const [workoutName, setWorkoutName] = useState(workout?.name || '');
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseBlock | null>(null);

  const bottomSheetRef = useRef<BottomSheet>(null);

  const handleSaveDay = () => {
    if (workoutName.trim()) {
      setWorkoutDayName(weekday, workoutName.trim());
    }
    navigation.goBack();
  };

  const handleAddExercise = (exerciseId: string) => {
    addExerciseToDay(weekday, exerciseId);
    setShowExercisePicker(false);
  };

  const handleEditExercise = (exercise: ExerciseBlock) => {
    setSelectedExercise(exercise);
    bottomSheetRef.current?.expand();
  };

  const handleDeleteExercise = (exerciseBlockId: string) => {
    Alert.alert('Delete Exercise', 'Are you sure you want to remove this exercise?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => removeExerciseFromDay(weekday, exerciseBlockId),
      },
    ]);
  };

  const handleCloseEditor = () => {
    setSelectedExercise(null);
    bottomSheetRef.current?.close();
  };

  return (
    <LinearGradient colors={['#E3E6E0', '#D4D6D1']} style={styles.gradient}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.6}
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.stepIndicator}>3/4</Text>
            <Text style={styles.headerTitle}>{formatWeekdayFull(weekday)}</Text>
          </View>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {/* Workout Name */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Workout name (optional)</Text>
            <TextInput
              style={styles.input}
              value={workoutName}
              onChangeText={setWorkoutName}
              placeholder="e.g., Upper Body, Push Day"
              placeholderTextColor={LIGHT_COLORS.textMeta}
            />
          </View>

          {/* Exercises */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Exercises</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowExercisePicker(true)}
                activeOpacity={0.7}
              >
                <IconAdd size={20} color={LIGHT_COLORS.accent} />
                <Text style={styles.addButtonText}>Add exercise</Text>
              </TouchableOpacity>
            </View>

            {workout?.exercises.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No exercises added yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  Tap "Add exercise" to get started
                </Text>
              </View>
            )}

            {workout?.exercises.map((exercise) => {
              const exerciseData = exerciseLibrary.find((e) => e.id === exercise.exerciseId);
              const summary = getExerciseSummary(exercise.weeks);

              return (
                <TouchableOpacity
                  key={exercise.id}
                  style={styles.exerciseCard}
                  onPress={() => handleEditExercise(exercise)}
                  activeOpacity={0.7}
                >
                  <View style={styles.exerciseCardContent}>
                    <Text style={styles.exerciseName}>
                      {exerciseData?.name || 'Unknown Exercise'}
                    </Text>
                    <Text style={styles.exerciseSummary}>{summary}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteExercise(exercise.id)}
                    activeOpacity={0.7}
                  >
                    <IconTrash size={18} color={LIGHT_COLORS.textMeta} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={styles.stickyFooter}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveDay}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>Save day</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Exercise Picker Modal */}
      {showExercisePicker && (
        <ExercisePickerModal
          visible={showExercisePicker}
          onClose={() => setShowExercisePicker(false)}
          onSelectExercise={handleAddExercise}
        />
      )}

      {/* Exercise Editor Bottom Sheet */}
      {selectedExercise && (
        <ExerciseEditorBottomSheet
          ref={bottomSheetRef}
          weekday={weekday}
          exerciseBlock={selectedExercise}
          onClose={handleCloseEditor}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  backText: {
    fontSize: 28,
    color: LIGHT_COLORS.textPrimary,
  },
  headerTitleContainer: {
    gap: 4,
  },
  stepIndicator: {
    fontSize: 14,
    color: LIGHT_COLORS.textMeta,
    fontWeight: '500',
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.textPrimary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 120,
  },
  section: {
    marginBottom: SPACING.xxxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: LIGHT_COLORS.textPrimary,
  },
  input: {
    backgroundColor: LIGHT_COLORS.backgroundContainer,
    borderWidth: 1,
    borderColor: LIGHT_COLORS.border,
    borderRadius: 12,
    padding: SPACING.lg,
    fontSize: 16,
    color: LIGHT_COLORS.textPrimary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: LIGHT_COLORS.accent,
  },
  emptyState: {
    backgroundColor: LIGHT_COLORS.backgroundContainer,
    borderRadius: 12,
    padding: SPACING.xxxl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: LIGHT_COLORS.textSecondary,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: LIGHT_COLORS.textMeta,
    textAlign: 'center',
  },
  exerciseCard: {
    backgroundColor: LIGHT_COLORS.backgroundContainer,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  exerciseCardContent: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: LIGHT_COLORS.textPrimary,
    marginBottom: 4,
  },
  exerciseSummary: {
    fontSize: 13,
    color: LIGHT_COLORS.textMeta,
  },
  deleteButton: {
    padding: 8,
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.md,
  },
  saveButton: {
    backgroundColor: LIGHT_COLORS.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

