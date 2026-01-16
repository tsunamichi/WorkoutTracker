import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import type { ExerciseCategory } from '../types';
import { useTranslation } from '../i18n/useTranslation';

const CATEGORIES: ExerciseCategory[] = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Full Body'];

export function ExercisesView() {
  const { exercises } = useStore();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | 'All'>('All');
  
  // Filter exercises
  const filteredExercises = exercises.filter(exercise => {
    const matchesSearch = exercise.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || exercise.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  
  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('searchExercisesPlaceholder')}
          placeholderTextColor={COLORS.meta}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      
      {/* Category Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContent}
      >
        <TouchableOpacity
          style={[styles.categoryChip, selectedCategory === 'All' && styles.categoryChipActive]}
          onPress={() => setSelectedCategory('All')}
          activeOpacity={1}
        >
          <Text style={[styles.categoryText, selectedCategory === 'All' && styles.categoryTextActive]}>
            {t('all')}
          </Text>
        </TouchableOpacity>
        {CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category}
            style={[styles.categoryChip, selectedCategory === category && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(category)}
            activeOpacity={1}
          >
            <Text style={[styles.categoryText, selectedCategory === category && styles.categoryTextActive]}>
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      {/* Exercise List */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {filteredExercises.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('noExercisesFound')}</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search term' : 'No exercises in this category'}
            </Text>
          </View>
        ) : (
          filteredExercises.map((exercise) => (
            <View key={exercise.id} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                {exercise.isCustom && (
                  <View style={styles.customBadge}>
                    <Text style={styles.customBadgeText}>{t('customBadge')}</Text>
                  </View>
                )}
              </View>
              <View style={styles.exerciseMeta}>
                <Text style={styles.metaText}>{exercise.category}</Text>
                {exercise.equipment && (
                  <>
                    <Text style={styles.metaDivider}>•</Text>
                    <Text style={styles.metaText}>{exercise.equipment}</Text>
                  </>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchContainer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  searchInput: {
    backgroundColor: COLORS.canvas,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },
  categoryScroll: {
    flexGrow: 0,
  },
  categoryContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  categoryChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: COLORS.canvas,
    marginRight: SPACING.sm,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
  },
  categoryText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.textSecondary,
  },
  categoryTextActive: {
    color: COLORS.textPrimary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: SPACING.lg,
    paddingTop: 0,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl * 2,
  },
  emptyText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    textAlign: 'center',
  },
  exerciseCard: {
    backgroundColor: COLORS.canvas,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  exerciseName: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.textPrimary,
    flex: 1,
  },
  customBadge: {
    backgroundColor: COLORS.secondarySoft,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    marginLeft: SPACING.sm,
  },
  customBadgeText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.secondary,
    fontSize: 10,
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  metaDivider: {
    ...TYPOGRAPHY.meta,
    color: COLORS.borderDimmed,
    marginHorizontal: SPACING.sm,
  },
});


