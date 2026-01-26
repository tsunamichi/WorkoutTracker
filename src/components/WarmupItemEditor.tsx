import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconClose, IconAdd } from './icons';
import { useTranslation } from '../i18n/useTranslation';
import { WarmupItem } from '../types/training';
import * as Haptics from 'expo-haptics';

// Light theme colors
const LIGHT_COLORS = {
  secondary: '#1B1B1B',
  textMeta: '#817B77',
};

interface WarmupItemEditorProps {
  warmupItems: WarmupItem[];
  onUpdate: (items: WarmupItem[]) => void;
}

export function WarmupItemEditor({ warmupItems, onUpdate }: WarmupItemEditorProps) {
  const { t } = useTranslation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDuration, setNewItemDuration] = useState('');
  const [newItemReps, setNewItemReps] = useState('');
  const [newItemNotes, setNewItemNotes] = useState('');

  const handleAddItem = () => {
    if (!newItemName.trim()) return;

    const newItem: WarmupItem = {
      id: `wu-${Date.now()}`,
      exerciseName: newItemName.trim(),
      duration: newItemDuration ? parseInt(newItemDuration) : undefined,
      reps: newItemReps ? parseInt(newItemReps) : undefined,
      notes: newItemNotes.trim() || undefined,
    };

    onUpdate([...warmupItems, newItem]);
    
    // Reset form
    setNewItemName('');
    setNewItemDuration('');
    setNewItemReps('');
    setNewItemNotes('');
    setShowAddModal(false);
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRemoveItem = (id: string) => {
    onUpdate(warmupItems.filter(item => item.id !== id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('warmup')}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowAddModal(true);
          }}
          activeOpacity={0.7}
        >
          <IconAdd size={18} color={COLORS.accentPrimary} />
          <Text style={styles.addButtonText}>{t('addWarmupItem')}</Text>
        </TouchableOpacity>
      </View>

      {warmupItems.length === 0 ? (
        <Text style={styles.emptyText}>{t('noWarmupItems')}</Text>
      ) : (
        warmupItems.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemContent}>
              <Text style={styles.itemName}>{item.exerciseName}</Text>
              {(item.duration || item.reps) && (
                <Text style={styles.itemDetails}>
                  {item.duration && `${item.duration}s`}
                  {item.duration && item.reps && ' • '}
                  {item.reps && `${item.reps} reps`}
                </Text>
              )}
              {item.notes && (
                <Text style={styles.itemNotes}>{item.notes}</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => handleRemoveItem(item.id)}
              style={styles.removeButton}
              activeOpacity={0.7}
            >
              <IconClose size={20} color={COLORS.textMeta} />
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Add Warmup Item Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('addWarmupItem')}</Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={styles.modalCloseButton}
              >
                <IconClose size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.label}>{t('exerciseName')}</Text>
              <TextInput
                style={styles.input}
                value={newItemName}
                onChangeText={setNewItemName}
                placeholder={t('warmupExercisePlaceholder')}
                placeholderTextColor={COLORS.textMeta}
                autoFocus
              />

              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <Text style={styles.label}>{t('duration')} ({t('seconds')})</Text>
                  <TextInput
                    style={styles.input}
                    value={newItemDuration}
                    onChangeText={setNewItemDuration}
                    placeholder="30"
                    placeholderTextColor={COLORS.textMeta}
                    keyboardType="number-pad"
                  />
                </View>

                <View style={styles.halfWidth}>
                  <Text style={styles.label}>{t('reps')}</Text>
                  <TextInput
                    style={styles.input}
                    value={newItemReps}
                    onChangeText={setNewItemReps}
                    placeholder="10"
                    placeholderTextColor={COLORS.textMeta}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <Text style={styles.label}>{t('notes')} ({t('optional')})</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={newItemNotes}
                onChangeText={setNewItemNotes}
                placeholder={t('warmupNotesPlaceholder')}
                placeholderTextColor={COLORS.textMeta}
                multiline
                numberOfLines={2}
              />

              <TouchableOpacity
                style={[styles.modalButton, !newItemName.trim() && styles.modalButtonDisabled]}
                onPress={handleAddItem}
                disabled={!newItemName.trim()}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonText}>{t('add')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.accentPrimary,
    fontWeight: '600',
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  itemCard: {
    backgroundColor: CARDS.cardDeepDimmed.outer.backgroundColor,
    borderRadius: CARDS.cardDeepDimmed.outer.borderRadius,
    borderWidth: CARDS.cardDeepDimmed.outer.borderWidth,
    borderColor: CARDS.cardDeepDimmed.outer.borderColor,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
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
  itemDetails: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: 2,
  },
  itemNotes: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    fontStyle: 'italic',
  },
  removeButton: {
    padding: SPACING.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    backgroundColor: COLORS.backgroundCanvas,
    borderRadius: BORDER_RADIUS.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  modalCloseButton: {
    padding: SPACING.xs,
  },
  modalBody: {
    padding: SPACING.lg,
  },
  label: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  input: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  halfWidth: {
    flex: 1,
  },
  modalButton: {
    backgroundColor: COLORS.accentPrimary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.backgroundCanvas,
  },
});
