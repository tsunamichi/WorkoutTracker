import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconArrowLeft, IconCheck } from '../components/icons';
import { useTranslation } from '../i18n/useTranslation';

const MAX_PINNED = 4;

export function EditKeyLiftsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { sessions, exercises, pinnedKeyLifts, setPinnedKeyLifts } = useStore();
  const { t } = useTranslation();

  const [selected, setSelected] = useState<Set<string>>(new Set(pinnedKeyLifts));

  const exercisesWithHistory = useMemo(() => {
    const exerciseIds = new Set<string>();
    for (const session of sessions) {
      if (!session.sets) continue;
      for (const set of session.sets) {
        if (set.isCompleted && set.weight > 0) {
          exerciseIds.add(set.exerciseId);
        }
      }
    }

    return Array.from(exerciseIds).map(id => {
      const ex = exercises.find((e: any) => e.id === id);
      return { id, name: ex?.name || 'Unknown' };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions, exercises]);

  const toggleExercise = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_PINNED) {
          Alert.alert('Limit reached', `You can pin up to ${MAX_PINNED} lifts.`);
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    await setPinnedKeyLifts(Array.from(selected));
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={1}>
          <IconArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Key Lifts</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn} activeOpacity={0.7}>
          <Text style={styles.saveBtnText}>{t('save')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        Select up to {MAX_PINNED} exercises to track on your Progress tab.
      </Text>

      <FlatList
        data={exercisesWithHistory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() => toggleExercise(item.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.exerciseName}>{item.name}</Text>
              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && <IconCheck size={16} color={COLORS.backgroundCanvas} />}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              Complete workouts with weighted exercises to see them here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  header: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -4,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
  },
  saveBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  saveBtnText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.accentPrimary,
  },
  hint: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    paddingHorizontal: SPACING.xxl,
    marginBottom: SPACING.lg,
  },
  listContent: {
    paddingHorizontal: SPACING.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDimmed,
  },
  exerciseName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.accentPrimary,
    borderColor: COLORS.accentPrimary,
  },
  emptyState: {
    paddingTop: 80,
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    textAlign: 'center',
  },
});
