import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Exercise } from '../../types/workout';

interface ExerciseRowProps {
  exercise: Exercise;
  onPress?: () => void;
  onDelete?: () => void;
  isDragging?: boolean;
}

export function ExerciseRow({ exercise, onPress, onDelete, isDragging }: ExerciseRowProps) {
  return (
    <View style={[styles.container, isDragging && styles.containerDragging]}>
      <TouchableOpacity
        style={styles.content}
        onPress={onPress}
        activeOpacity={0.7}
        disabled={!onPress}
      >
        <View style={styles.leftContent}>
          <Text style={styles.name} numberOfLines={1}>
            {exercise.name}
          </Text>
          <View style={styles.details}>
            {exercise.sets && exercise.reps && (
              <Text style={styles.detailText}>
                {exercise.sets} × {exercise.reps}
              </Text>
            )}
            {exercise.restSec && (
              <Text style={styles.detailText}>
                {exercise.restSec}s rest
              </Text>
            )}
          </View>
        </View>

        {onDelete && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.deleteText}>×</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  containerDragging: {
    opacity: 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  leftContent: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 4,
  },
  details: {
    flexDirection: 'row',
    gap: 12,
  },
  detailText: {
    fontSize: 13,
    color: '#817B77',
  },
  deleteButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  deleteText: {
    fontSize: 28,
    color: '#817B77',
    fontWeight: '300',
  },
});

