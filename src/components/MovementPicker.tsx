import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
} from 'react-native';
import { SPACING, COLORS, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconSearch, IconClose } from './icons';
import { BottomDrawer } from './common/BottomDrawer';
import { useTranslation } from '../i18n/useTranslation';
import { useStore } from '../store';
import type { Exercise } from '../types/training';
import * as Haptics from 'expo-haptics';

interface MovementPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (movement: Exercise) => void;
  title?: string;
}

/**
 * Movement Picker - Search and select exercises from the library
 * 
 * Used for both warmup and workout exercise selection.
 * Provides search and categorized browsing.
 */
export function MovementPicker({
  visible,
  onClose,
  onSelect,
  title,
}: MovementPickerProps) {
  const { t } = useTranslation();
  const { exercises } = useStore();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter exercises based on search
  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) {
      return exercises;
    }

    const query = searchQuery.toLowerCase().trim();
    return exercises.filter(exercise => 
      exercise.name.toLowerCase().includes(query) ||
      exercise.primaryMuscle.toLowerCase().includes(query) ||
      exercise.equipment.some(eq => eq.toLowerCase().includes(query))
    );
  }, [exercises, searchQuery]);

  const handleSelect = (movement: Exercise) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchQuery(''); // Reset search
    onSelect(movement);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  return (
    <BottomDrawer
      visible={visible}
      onClose={() => {
        setSearchQuery('');
        onClose();
      }}
      maxHeight="90%"
      fixedHeight={true}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{title || t('selectExercise')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <IconClose size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <IconSearch size={20} color={COLORS.textMeta} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('searchExercises')}
              placeholderTextColor={COLORS.textMeta}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch}>
                <IconClose size={20} color={COLORS.textMeta} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Exercise List */}
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.exerciseCard}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>{item.name}</Text>
                <View style={styles.exerciseMeta}>
                  <Text style={styles.exerciseMetaText}>{item.primaryMuscle}</Text>
                  {item.equipment.length > 0 && (
                    <>
                      <Text style={styles.exerciseMetaSeparator}>•</Text>
                      <Text style={styles.exerciseMetaText}>
                        {item.equipment.join(', ')}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {searchQuery ? t('noExercisesFound') : t('noExercisesAvailable')}
              </Text>
            </View>
          }
        />
      </View>
    </BottomDrawer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDimmed,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    flex: 1,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  searchContainer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  listContent: {
    padding: SPACING.lg,
    paddingTop: 0,
  },
  exerciseCard: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    marginBottom: 4,
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  exerciseMetaText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  exerciseMetaSeparator: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginHorizontal: SPACING.xs,
  },
  emptyState: {
    padding: SPACING.xxl,
    alignItems: 'center',
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    textAlign: 'center',
  },
});
