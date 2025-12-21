// Dependencies required (install if missing):
// npm install @gorhom/bottom-sheet react-native-reanimated react-native-gesture-handler

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Keyboard } from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { MovementPattern, Equipment, Exercise } from '../../types/workout';
import { searchExercises, ExerciseLibraryEntry } from '../../utils/exerciseLibrary';

interface AddExerciseBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  onSelectExercise: (exercise: Exercise) => void;
}

const MOVEMENT_PATTERNS: MovementPattern[] = ['squat', 'hinge', 'push', 'pull', 'carry', 'core', 'cardio', 'other'];
const EQUIPMENT_TYPES: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'other'];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function AddExerciseBottomSheet({ isVisible, onClose, onSelectExercise }: AddExerciseBottomSheetProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPattern, setSelectedPattern] = useState<MovementPattern | undefined>();
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | undefined>();

  const snapPoints = useMemo(() => ['75%', '90%'], []);

  const filteredExercises = useMemo(() => {
    return searchExercises(searchQuery, {
      pattern: selectedPattern,
      equipment: selectedEquipment,
    });
  }, [searchQuery, selectedPattern, selectedEquipment]);

  const handleSelectExercise = useCallback((libraryExercise: ExerciseLibraryEntry) => {
    const exercise: Exercise = {
      id: generateId(),
      name: libraryExercise.name,
      pattern: libraryExercise.pattern,
      equipment: libraryExercise.equipment,
      sets: 3,
      reps: '8-12',
      restSec: 90,
    };
    onSelectExercise(exercise);
    onClose();
    setSearchQuery('');
    setSelectedPattern(undefined);
    setSelectedEquipment(undefined);
    Keyboard.dismiss();
  }, [onSelectExercise, onClose]);

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
      <View style={styles.contentContainer}>
        <Text style={styles.title}>Add Exercise</Text>

        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Movement:</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={MOVEMENT_PATTERNS}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  selectedPattern === item && styles.filterChipSelected,
                ]}
                onPress={() => setSelectedPattern(selectedPattern === item ? undefined : item)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedPattern === item && styles.filterChipTextSelected,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.filterList}
          />
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Equipment:</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={EQUIPMENT_TYPES}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  selectedEquipment === item && styles.filterChipSelected,
                ]}
                onPress={() => setSelectedEquipment(selectedEquipment === item ? undefined : item)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedEquipment === item && styles.filterChipTextSelected,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.filterList}
          />
        </View>

        <FlatList
          data={filteredExercises}
          keyExtractor={(item, index) => `${item.name}-${index}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.exerciseItem}
              onPress={() => handleSelectExercise(item)}
            >
              <Text style={styles.exerciseName}>{item.name}</Text>
              <View style={styles.exerciseTags}>
                {item.pattern && (
                  <Text style={styles.exerciseTag}>{item.pattern}</Text>
                )}
                {item.equipment && (
                  <Text style={styles.exerciseTag}>{item.equipment}</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
          style={styles.exerciseList}
          keyboardShouldPersistTaps="handled"
        />
      </View>
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
    color: '#000000',
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  filterSection: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#817B77',
    marginBottom: 8,
  },
  filterList: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#E3E6E0',
    marginRight: 8,
  },
  filterChipSelected: {
    backgroundColor: '#FD6B00',
  },
  filterChipText: {
    fontSize: 13,
    color: '#3C3C43',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
  },
  exerciseList: {
    flex: 1,
    marginTop: 8,
  },
  exerciseItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 4,
  },
  exerciseTags: {
    flexDirection: 'row',
    gap: 8,
  },
  exerciseTag: {
    fontSize: 12,
    color: '#817B77',
    textTransform: 'capitalize',
  },
});

