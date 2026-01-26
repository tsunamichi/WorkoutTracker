import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconCheck } from './icons';
import { useTranslation } from '../i18n/useTranslation';
import { WarmupItem } from '../types/training';
import * as Haptics from 'expo-haptics';

// Light theme colors
const LIGHT_COLORS = {
  secondary: '#1B1B1B',
  textMeta: '#817B77',
};

interface WarmupTrackerProps {
  warmupItems: WarmupItem[];
  completedItemIds: string[];
  onToggleItem: (itemId: string) => void;
}

export function WarmupTracker({ warmupItems, completedItemIds, onToggleItem }: WarmupTrackerProps) {
  const { t } = useTranslation();

  if (warmupItems.length === 0) {
    return null;
  }

  const completedCount = completedItemIds.length;
  const totalCount = warmupItems.length;
  const allComplete = completedCount === totalCount;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('warmup')}</Text>
        <Text style={[styles.progress, allComplete && styles.progressComplete]}>
          {completedCount}/{totalCount}
        </Text>
      </View>

      {warmupItems.map((item) => {
        const isCompleted = completedItemIds.includes(item.id);

        return (
          <TouchableOpacity
            key={item.id}
            style={[styles.itemCard, isCompleted && styles.itemCardCompleted]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onToggleItem(item.id);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.checkbox}>
              {isCompleted && (
                <View style={styles.checkboxFilled}>
                  <IconCheck size={14} color={COLORS.backgroundCanvas} />
                </View>
              )}
            </View>

            <View style={styles.itemContent}>
              <Text style={[styles.itemName, isCompleted && styles.itemNameCompleted]}>
                {item.exerciseName}
              </Text>
              {(item.duration || item.reps) && (
                <Text style={[styles.itemDetails, isCompleted && styles.itemDetailsCompleted]}>
                  {item.duration && `${item.duration}s`}
                  {item.duration && item.reps && ' • '}
                  {item.reps && `${item.reps} reps`}
                </Text>
              )}
              {item.notes && (
                <Text style={[styles.itemNotes, isCompleted && styles.itemNotesCompleted]}>
                  {item.notes}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  progress: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.textMeta,
  },
  progressComplete: {
    color: COLORS.signalPositive,
  },
  itemCard: {
    backgroundColor: CARDS.cardDeepDimmed.outer.backgroundColor,
    borderRadius: CARDS.cardDeepDimmed.outer.borderRadius,
    borderWidth: CARDS.cardDeepDimmed.outer.borderWidth,
    borderColor: CARDS.cardDeepDimmed.outer.borderColor,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
  },
  itemCardCompleted: {
    opacity: 0.6,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginRight: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxFilled: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.signalPositive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemNameCompleted: {
    textDecorationLine: 'line-through',
    color: COLORS.textMeta,
  },
  itemDetails: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: 2,
  },
  itemDetailsCompleted: {
    opacity: 0.7,
  },
  itemNotes: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    fontStyle: 'italic',
  },
  itemNotesCompleted: {
    opacity: 0.7,
  },
});
