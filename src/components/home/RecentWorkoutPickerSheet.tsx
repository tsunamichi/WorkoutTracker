import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import dayjs from 'dayjs';
import { BottomDrawer } from '../common/BottomDrawer';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../constants';
import { useTranslation } from '../../i18n/useTranslation';
import type { RecentWorkoutPickerOption } from '../../utils/recentWorkoutPickerOptions';

type Props = {
  visible: boolean;
  onClose: () => void;
  options: RecentWorkoutPickerOption[];
  onSelect: (option: RecentWorkoutPickerOption) => void;
};

export function RecentWorkoutPickerSheet({ visible, onClose, options, onSelect }: Props) {
  const { t } = useTranslation();

  return (
    <BottomDrawer visible={visible} onClose={onClose} maxHeight="72%" showHandle>
      <View style={styles.container}>
        <Text style={styles.title}>{t('useRecentWorkoutPickerTitle')}</Text>
        <Text style={styles.subtitle}>{t('useRecentWorkoutPickerSubtitle')}</Text>
        {options.length === 0 ? (
          <Text style={styles.empty}>{t('noWorkoutHistoryYet')}</Text>
        ) : (
          <FlatList
            data={options}
            keyExtractor={o => o.sourceScheduledWorkoutId}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {item.workoutName}
                </Text>
                <Text style={styles.rowMeta}>
                  {t('lastPerformedPrefix')} {dayjs(item.lastPerformedAt).format('MMM D, YYYY')}
                </Text>
                <Text style={styles.rowMeta}>
                  {t('exerciseCountLabel').replace('{count}', String(item.exerciseCount))}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </BottomDrawer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    flex: 1,
    minHeight: 200,
  },
  title: {
    ...TYPOGRAPHY.h2,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: SPACING.md,
  },
  empty: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    marginTop: SPACING.lg,
  },
  list: {
    flexGrow: 1,
  },
  listContent: {
    paddingBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  row: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    backgroundColor: COLORS.backgroundCanvas,
  },
  rowTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.text,
  },
  rowMeta: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginTop: 4,
  },
});
