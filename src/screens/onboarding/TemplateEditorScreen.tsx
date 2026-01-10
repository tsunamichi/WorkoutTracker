// Dependencies required (install if missing):
// npm install react-native-draggable-flatlist

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { ProgressHeader } from '../../components/common/ProgressHeader';
import { StickyFooter } from '../../components/common/StickyFooter';
import { ExerciseRow } from '../../components/exercises/ExerciseRow';
import { AddExerciseBottomSheet } from '../../components/exercises/AddExerciseBottomSheet';
import { EditExerciseBottomSheet } from '../../components/exercises/EditExerciseBottomSheet';
import { Exercise } from '../../types/workout';

type OnboardingStackParamList = {
  TemplateEditor: undefined;
  ReviewCreateCycle: undefined;
};

type TemplateEditorScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'TemplateEditor'>;
};

export function TemplateEditorScreen({ navigation }: TemplateEditorScreenProps) {
  const {
    draft,
    addExerciseToDay,
    removeExerciseFromDay,
    reorderExercisesInDay,
    updateExercise,
  } = useOnboardingStore();

  const [expandedDayIndex, setExpandedDayIndex] = useState<number | null>(1);
  const [addExerciseSheetVisible, setAddExerciseSheetVisible] = useState(false);
  const [editExerciseSheetVisible, setEditExerciseSheetVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [targetDayIndex, setTargetDayIndex] = useState<number>(1);

  const handleAddExercise = useCallback((dayIndex: number) => {
    setTargetDayIndex(dayIndex);
    setAddExerciseSheetVisible(true);
  }, []);

  const handleSelectExercise = useCallback((exercise: Exercise) => {
    addExerciseToDay(targetDayIndex, exercise);
    setAddExerciseSheetVisible(false);
  }, [targetDayIndex, addExerciseToDay]);

  const handleEditExercise = useCallback((exercise: Exercise, dayIndex: number) => {
    setSelectedExercise(exercise);
    setTargetDayIndex(dayIndex);
    setEditExerciseSheetVisible(true);
  }, []);

  const handleSaveExercise = useCallback((exerciseId: string, updates: Partial<Exercise>) => {
    updateExercise(targetDayIndex, exerciseId, updates);
    setEditExerciseSheetVisible(false);
  }, [targetDayIndex, updateExercise]);

  const handleDeleteExercise = useCallback((exerciseId: string) => {
    removeExerciseFromDay(targetDayIndex, exerciseId);
    setEditExerciseSheetVisible(false);
  }, [targetDayIndex, removeExerciseFromDay]);

  const handleReview = () => {
    navigation.navigate('ReviewCreateCycle');
  };

  if (!draft) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>No draft found</Text>
      </SafeAreaView>
    );
  }

  const canReview = draft.days.every((day) => day.exercises.length > 0);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <ProgressHeader
            stepLabel="Step 3 of 4"
            title="Customize your plan"
          />

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{draft.templateName}</Text>
            <Text style={styles.summaryText}>
              {draft.prefs.daysPerWeek} days/week • {draft.prefs.sessionMinutes} min sessions
            </Text>
          </View>

          {draft.days.map((day) => {
            const isExpanded = expandedDayIndex === day.dayIndex;
            const hasExercises = day.exercises.length > 0;

            return (
              <View key={day.dayIndex} style={styles.dayCard}>
                <TouchableOpacity
                  style={styles.dayHeader}
                  onPress={() => setExpandedDayIndex(isExpanded ? null : day.dayIndex)}
                  activeOpacity={1}
                >
                  <View>
                    <Text style={styles.dayTitle}>{day.title}</Text>
                    <Text style={styles.daySubtitle}>
                      {day.exercises.length} exercise{day.exercises.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={styles.expandIcon}>{isExpanded ? '−' : '+'}</Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.dayContent}>
                    {hasExercises ? (
                      <View>
                        {day.exercises.map((item) => (
                          <View key={item.id}>
                            <ExerciseRow
                              exercise={item}
                              onPress={() => handleEditExercise(item, day.dayIndex)}
                              onDelete={() => removeExerciseFromDay(day.dayIndex, item.id)}
                              isDragging={false}
                            />
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.emptyText}>No exercises yet. Add some below!</Text>
                    )}

                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => handleAddExercise(day.dayIndex)}
                    >
                      <Text style={styles.addButtonText}>+ Add exercise</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        <StickyFooter
          buttonText="Review"
          onPress={handleReview}
          disabled={!canReview}
        />

        <AddExerciseBottomSheet
          isVisible={addExerciseSheetVisible}
          onClose={() => setAddExerciseSheetVisible(false)}
          onSelectExercise={handleSelectExercise}
        />

        <EditExerciseBottomSheet
          isVisible={editExerciseSheetVisible}
          exercise={selectedExercise}
          onClose={() => setEditExerciseSheetVisible(false)}
          onSave={handleSaveExercise}
          onDelete={handleDeleteExercise}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 14,
    color: '#817B77',
  },
  dayCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 24,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  daySubtitle: {
    fontSize: 13,
    color: '#817B77',
    marginTop: 2,
  },
  expandIcon: {
    fontSize: 28,
    color: '#817B77',
    fontWeight: '300',
  },
  dayContent: {
    padding: 16,
    paddingTop: 0,
  },
  emptyText: {
    fontSize: 14,
    color: '#817B77',
    textAlign: 'center',
    fontStyle: 'italic',
    marginVertical: 16,
  },
  addButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FD6B00',
  },
});

