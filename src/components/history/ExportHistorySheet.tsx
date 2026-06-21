import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { SPACING, TYPOGRAPHY, BUTTONS, BORDER_RADIUS } from '../../constants';
import { BottomDrawer } from '../common/BottomDrawer';
import { useAppTheme } from '../../theme/useAppTheme';
import { useTranslation } from '../../i18n/useTranslation';
import { useStore } from '../../store';
import {
  buildWorkoutHistoryExportPayload,
  defaultExportEndDate,
  defaultExportStartDate,
  isValidHistoryDateRange,
} from '../../utils/exportWorkoutHistory';
import {
  copyWorkoutHistoryJson,
  isShareExportCancelled,
  shareWorkoutHistoryJson,
} from '../../utils/shareWorkoutHistoryJson';
import * as Haptics from 'expo-haptics';

type DateField = 'from' | 'to';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ExportHistorySheet({ visible, onClose }: Props) {
  const { colors: themeColors } = useAppTheme();
  const { t } = useTranslation();
  const scheduledWorkouts = useStore(s => s.scheduledWorkouts);
  const getMainCompletion = useStore(s => s.getMainCompletion);
  const detailedWorkoutProgress = useStore(s => s.detailedWorkoutProgress);
  const exercises = useStore(s => s.exercises);
  const settings = useStore(s => s.settings);

  const [startDate, setStartDate] = useState(defaultExportStartDate);
  const [endDate, setEndDate] = useState(defaultExportEndDate);
  const [activePicker, setActivePicker] = useState<DateField | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const rangeValid = useMemo(() => isValidHistoryDateRange(startDate, endDate), [startDate, endDate]);

  const resetWhenOpened = useCallback(() => {
    if (!visible) return;
    setStartDate(defaultExportStartDate());
    setEndDate(defaultExportEndDate());
    setExportMessage(null);
    setActivePicker(null);
  }, [visible]);

  React.useEffect(() => {
    resetWhenOpened();
  }, [resetWhenOpened]);

  const handlePickerChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS === 'android') setActivePicker(null);
      if (event.type === 'dismissed' || !date) return;
      const iso = dayjs(date).format('YYYY-MM-DD');
      if (activePicker === 'from') setStartDate(iso);
      if (activePicker === 'to') setEndDate(iso);
      setExportMessage(null);
    },
    [activePicker],
  );

  const buildPayload = useCallback(
    () =>
      buildWorkoutHistoryExportPayload(
        startDate,
        endDate,
        scheduledWorkouts,
        getMainCompletion,
        detailedWorkoutProgress,
        exercises,
        settings.useKg ?? false,
      ),
    [
      startDate,
      endDate,
      scheduledWorkouts,
      getMainCompletion,
      detailedWorkoutProgress,
      exercises,
      settings.useKg,
    ],
  );

  const handleExport = useCallback(async () => {
    if (!rangeValid || isBusy) return;

    const payload = buildPayload();
    if (payload.isEmpty) {
      setExportMessage(t('historyExportEmptyRange'));
      return;
    }

    setExportMessage(null);
    setIsBusy(true);
    try {
      await shareWorkoutHistoryJson(payload);
      setExportMessage(
        t('historyExportPrepared').replace('{count}', String(payload.workouts.length)),
      );
    } catch (err) {
      if (!isShareExportCancelled(err)) {
        Alert.alert(t('alertErrorTitle'), t('failedToExportData'));
      }
    } finally {
      setIsBusy(false);
    }
  }, [rangeValid, isBusy, buildPayload, t]);

  const handleCopy = useCallback(async () => {
    if (!rangeValid || isBusy) return;

    const payload = buildPayload();
    if (payload.isEmpty) {
      setExportMessage(t('historyExportEmptyRange'));
      return;
    }

    setExportMessage(null);
    setIsBusy(true);
    try {
      await copyWorkoutHistoryJson(payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setExportMessage(
        t('historyExportCopied').replace('{count}', String(payload.workouts.length)),
      );
    } catch {
      Alert.alert(t('alertErrorTitle'), t('failedToExportData'));
    } finally {
      setIsBusy(false);
    }
  }, [rangeValid, isBusy, buildPayload, t]);

  const pickerValue = activePicker === 'from' ? dayjs(startDate).toDate() : dayjs(endDate).toDate();

  return (
    <BottomDrawer visible={visible} onClose={onClose} maxHeight="62%" scrollable={false}>
      {({ requestClose }: { requestClose: () => void }) => (
        <View style={styles.container}>
          <Text style={[styles.title, { color: themeColors.text }]}>{t('historyExportTitle')}</Text>

          <TouchableOpacity
            style={styles.dateRow}
            onPress={() => setActivePicker('from')}
            activeOpacity={0.85}
          >
            <Text style={[styles.dateLabel, { color: themeColors.textMeta }]}>{t('historyExportFrom')}</Text>
            <Text style={[styles.dateValue, { color: themeColors.text }]}>
              {dayjs(startDate).format('MMM D, YYYY')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateRow}
            onPress={() => setActivePicker('to')}
            activeOpacity={0.85}
          >
            <Text style={[styles.dateLabel, { color: themeColors.textMeta }]}>{t('historyExportTo')}</Text>
            <Text style={[styles.dateValue, { color: themeColors.text }]}>
              {dayjs(endDate).format('MMM D, YYYY')}
            </Text>
          </TouchableOpacity>

          {!rangeValid ? (
            <Text style={[styles.error, { color: themeColors.signalWarning }]}>
              {t('historyExportInvalidRange')}
            </Text>
          ) : null}

          {exportMessage ? (
            <Text style={[styles.message, { color: themeColors.textMeta }]}>{exportMessage}</Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              BUTTONS.primaryButtonLabeled,
              !rangeValid && styles.primaryButtonDisabled,
            ]}
            disabled={!rangeValid || isBusy}
            onPress={() => {
              void handleExport();
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryButtonText, { color: themeColors.backgroundCanvas }]}>
              {t('historyExportCta')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              { backgroundColor: themeColors.activeCard, borderColor: themeColors.border },
              (!rangeValid || isBusy) && styles.primaryButtonDisabled,
            ]}
            disabled={!rangeValid || isBusy}
            onPress={() => {
              void handleCopy();
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.secondaryButtonText, { color: themeColors.text }]}>
              {t('historyExportCopyCta')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelRow} onPress={requestClose} activeOpacity={0.85}>
            <Text style={[styles.cancelText, { color: themeColors.textMeta }]}>{t('cancel')}</Text>
          </TouchableOpacity>

          {activePicker ? (
            <DateTimePicker
              value={pickerValue}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handlePickerChange}
            />
          ) : null}
        </View>
      )}
    </BottomDrawer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  title: {
    ...TYPOGRAPHY.h3,
    marginBottom: SPACING.xl,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  dateLabel: {
    ...TYPOGRAPHY.body,
  },
  dateValue: {
    ...TYPOGRAPHY.body,
    fontWeight: '500',
  },
  error: {
    ...TYPOGRAPHY.meta,
    marginTop: SPACING.sm,
  },
  message: {
    ...TYPOGRAPHY.meta,
    marginTop: SPACING.md,
  },
  primaryButton: {
    marginTop: SPACING.xl,
    alignSelf: 'stretch',
  },
  secondaryButton: {
    marginTop: SPACING.md,
    alignSelf: 'stretch',
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...TYPOGRAPHY.button,
    fontWeight: '600',
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    ...TYPOGRAPHY.button,
    fontWeight: '600',
  },
  cancelRow: {
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  cancelText: {
    ...TYPOGRAPHY.body,
  },
});
