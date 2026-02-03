import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SPACING, COLORS, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconCheck } from './icons';
import { BottomDrawer } from './common/BottomDrawer';
import { useTranslation } from '../i18n/useTranslation';
import type { WarmupItem_DEPRECATED as WarmupItem } from '../types/training';

interface CycleWarmupPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  allWarmupItems: WarmupItem[];
  currentItemId: string;
  selectedItemIds: string[];
  onSave: (selectedIds: string[]) => void;
}

export const CycleWarmupPickerSheet = ({
  visible,
  onClose,
  allWarmupItems,
  currentItemId,
  selectedItemIds,
  onSave,
}: CycleWarmupPickerSheetProps) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>(selectedItemIds);

  const toggleItem = (itemId: string) => {
    if (selected.includes(itemId)) {
      setSelected(selected.filter(id => id !== itemId));
    } else {
      setSelected([...selected, itemId]);
    }
  };

  const handleSave = () => {
    onSave(selected);
    onClose();
  };

  // Filter out the current item from the list
  const availableItems = allWarmupItems.filter(item => item.id !== currentItemId);

  return (
    <BottomDrawer
      visible={visible}
      onClose={onClose}
      maxHeight="80%"
      fixedHeight={true}
      showHandle={false}
      scrollable={false}
      contentStyle={styles.drawerContent}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('selectCycleExercises')}</Text>
          <Text style={styles.subtitle}>{t('cycleExercisesHint')}</Text>
        </View>

        <ScrollView style={styles.scrollView} bounces={false}>
          <View style={styles.itemList}>
            {availableItems.map((item) => {
              const isSelected = selected.includes(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.itemRow,
                    isSelected && styles.itemRowSelected,
                  ]}
                  onPress={() => toggleItem(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.exerciseName || t('unnamed')}</Text>
                    <Text style={styles.itemMeta}>
                      {item.sets} {t('setsUnit')} × {item.reps} {item.isTimeBased ? t('seconds') : t('repsUnit')}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.checkmark}>
                      <IconCheck size={20} color={COLORS.accentPrimary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              {selected.length > 0
                ? t('addToCycle').replace('{count}', selected.length.toString())
                : t('save')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomDrawer>
  );
};

const styles = StyleSheet.create({
  drawerContent: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDimmed,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  scrollView: {
    flex: 1,
  },
  itemList: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemRowSelected: {
    borderColor: COLORS.accentPrimary,
    backgroundColor: COLORS.accentPrimaryDimmed,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  itemMeta: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  checkmark: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.md,
  },
  footer: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDimmed,
  },
  saveButton: {
    backgroundColor: COLORS.accentPrimary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  saveButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.backgroundCanvas,
  },
});
