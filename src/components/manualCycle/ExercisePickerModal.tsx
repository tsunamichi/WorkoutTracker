import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { useStore } from '../../store';
import { SPACING } from '../../constants';

interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectExercise: (exerciseId: string) => void;
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

export function ExercisePickerModal({
  visible,
  onClose,
  onSelectExercise,
}: ExercisePickerModalProps) {
  const { exercises } = useStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) {
      return exercises;
    }

    const query = searchQuery.toLowerCase();
    return exercises.filter((exercise) =>
      exercise.name.toLowerCase().includes(query)
    );
  }, [exercises, searchQuery]);

  const handleSelectExercise = (exerciseId: string) => {
    onSelectExercise(exerciseId);
    setSearchQuery('');
  };

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Add Exercise</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search exercises..."
            placeholderTextColor={LIGHT_COLORS.textMeta}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              activeOpacity={0.7}
            >
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Exercise List */}
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.exerciseItem}
              onPress={() => handleSelectExercise(item.id)}
              activeOpacity={0.7}
            >
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>{item.name}</Text>
                {item.muscleGroups && item.muscleGroups.length > 0 && (
                  <Text style={styles.exerciseMeta}>
                    {item.muscleGroups.join(', ')}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {searchQuery ? 'No exercises found' : 'No exercises available'}
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIGHT_COLORS.backgroundCanvas,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: LIGHT_COLORS.border,
    backgroundColor: LIGHT_COLORS.backgroundContainer,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: LIGHT_COLORS.textPrimary,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: LIGHT_COLORS.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LIGHT_COLORS.backgroundContainer,
    borderRadius: 12,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    margin: SPACING.xxl,
    borderWidth: 1,
    borderColor: LIGHT_COLORS.border,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: LIGHT_COLORS.textPrimary,
  },
  searchIcon: {
    fontSize: 18,
    color: LIGHT_COLORS.textMeta,
  },
  clearIcon: {
    fontSize: 16,
    color: LIGHT_COLORS.textMeta,
  },
  listContent: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xxl,
  },
  exerciseItem: {
    backgroundColor: LIGHT_COLORS.backgroundContainer,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  exerciseInfo: {
    gap: 4,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: LIGHT_COLORS.textPrimary,
  },
  exerciseMeta: {
    fontSize: 14,
    color: LIGHT_COLORS.textMeta,
  },
  emptyState: {
    paddingVertical: SPACING.xxxl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: LIGHT_COLORS.textMeta,
  },
});

