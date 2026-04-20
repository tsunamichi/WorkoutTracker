import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import dayjs from 'dayjs';
import { BottomDrawer } from '../common/BottomDrawer';
import { COLORS, SPACING, TYPOGRAPHY } from '../../constants';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppTheme } from '../../theme/useAppTheme';
import type { RecentWorkoutPickerOption } from '../../utils/recentWorkoutPickerOptions';

type Props = {
  visible: boolean;
  onClose: () => void;
  options: RecentWorkoutPickerOption[];
  onSelect: (option: RecentWorkoutPickerOption) => void;
};

export function RecentWorkoutPickerSheet({ visible, onClose, options, onSelect }: Props) {
  const { t } = useTranslation();
  const appTheme = useAppTheme();
  const { colors: themeColors } = appTheme;
  const isV2Theme = appTheme.id === 'v2';
  /** Same as timer grid cards on TodayScreen (`savedTimersCardBackground` / `savedTimersInk` / `savedTimersMetaInk`). */
  const timerCardBackground = isV2Theme ? themeColors.canvasContainer : COLORS.containerTertiary;
  const timerTitleInk = themeColors.containerPrimary;

  return (
    <BottomDrawer
      visible={visible}
      onClose={onClose}
      maxHeight="90%"
      showHandle
      backgroundColor={themeColors.canvasLight}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        <Text style={styles.title}>{t('useRecentWorkoutPickerTitle')}</Text>
        {options.length === 0 ? (
          <Text style={styles.empty}>{t('noWorkoutHistoryYet')}</Text>
        ) : (
          <View style={styles.list}>
            {options.map(item => (
              <TouchableOpacity
                key={item.sourceScheduledWorkoutId}
                style={[styles.row, { backgroundColor: timerCardBackground }]}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.rowTitle, { color: timerTitleInk }]} numberOfLines={2}>
                  {item.workoutName}
                </Text>
                <Text style={[styles.rowMeta, { color: themeColors.textMeta }]}>
                  {t('lastPerformedPrefix')} {dayjs(item.lastPerformedAt).format('MMM D, YYYY')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </BottomDrawer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingBottom: SPACING.xl,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textMeta,
    paddingBottom: 40,
  },
  empty: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    marginTop: SPACING.lg,
  },
  list: {
    gap: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  /** Shell aligned with `footerEntryCard` on timer grid (TodayScreen). */
  row: {
    borderRadius: 10,
    padding: 16,
  },
  rowTitle: {
    ...TYPOGRAPHY.h3,
    fontWeight: '500',
  },
  rowMeta: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
    marginTop: 4,
  },
});
