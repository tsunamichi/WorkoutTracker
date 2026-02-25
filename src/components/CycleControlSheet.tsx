import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import { BottomDrawer } from './common/BottomDrawer';
import { IconPause, IconPlay, IconClose, IconTrash, IconShare } from './icons';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { useTranslation } from '../i18n/useTranslation';
import type { CyclePlan } from '../types/training';

type CycleState = 'active' | 'paused' | 'none';

interface CycleControlSheetProps {
  visible: boolean;
  onClose: () => void;
  cycleState: CycleState;
  plan: CyclePlan | undefined;
  weekProgress: { currentWeek: number; totalWeeks: number } | null;
  effectiveEndDate: string | undefined;
  onPause: (resumeDate: string) => void;
  onResume: () => void;
  onEnd: () => void;
  onDelete: () => void;
  onShare: (plan: CyclePlan) => void;
  onStartCycle: () => void;
}

export function CycleControlSheet({
  visible,
  onClose,
  cycleState,
  plan,
  weekProgress,
  effectiveEndDate,
  onPause,
  onResume,
  onEnd,
  onDelete,
  onShare,
  onStartCycle,
}: CycleControlSheetProps) {
  const { t } = useTranslation();
  const [pickingDate, setPickingDate] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => dayjs().add(1, 'week').toDate());

  useEffect(() => {
    if (!visible) setPickingDate(false);
  }, [visible]);

  const handleEnd = () => {
    onClose();
    setTimeout(() => {
      Alert.alert(
        t('endCycleConfirmTitle'),
        t('endCycleConfirmMessage'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('end'),
            style: 'destructive',
            onPress: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              onEnd();
            },
          },
        ],
      );
    }, 350);
  };

  const handleDelete = () => {
    onClose();
    setTimeout(() => {
      Alert.alert(
        t('deleteCycleConfirmTitle'),
        t('deleteCycleConfirmMessage'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              onDelete();
            },
          },
        ],
      );
    }, 350);
  };

  const handleDateChange = (_event: any, date?: Date) => {
    if (Platform.OS !== 'ios') setPickingDate(false);
    if (date) {
      setPickerDate(date);
      if (Platform.OS !== 'ios') {
        onClose();
        onPause(dayjs(date).format('YYYY-MM-DD'));
      }
    }
  };

  const handleDateConfirm = () => {
    setPickingDate(false);
    onClose();
    onPause(dayjs(pickerDate).format('YYYY-MM-DD'));
  };

  if (cycleState === 'none') {
    return (
      <BottomDrawer visible={visible} onClose={onClose} maxHeight="40%">
        <View style={styles.container}>
          <Text style={styles.title}>{t('noActiveCycle')}</Text>
          <Text style={styles.subtitle}>{t('noCyclesYetSubtext')}</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onClose();
              onStartCycle();
            }}
          >
            <Text style={styles.primaryButtonText}>{t('startACycle')}</Text>
          </TouchableOpacity>
        </View>
      </BottomDrawer>
    );
  }

  const startStr = plan ? dayjs(plan.startDate).format('MMM D') : '';
  const endStr = effectiveEndDate ? dayjs(effectiveEndDate).format('MMM D') : '';
  const resumeStr = plan?.pausedUntil ? dayjs(plan.pausedUntil).format('MMM D') : '';

  return (
    <BottomDrawer visible={visible} onClose={onClose} maxHeight={pickingDate ? '70%' : '45%'}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{plan?.name ?? ''}</Text>
          <View style={[styles.statusBadge, cycleState === 'paused' && styles.statusBadgePaused]}>
            <Text style={[styles.statusText, cycleState === 'paused' && styles.statusTextPaused]}>
              {cycleState === 'active' ? t('cycleActive') : t('cyclePaused')}
            </Text>
            {cycleState === 'paused' && resumeStr && (
              <Text style={styles.resumeDateText}> · {resumeStr}</Text>
            )}
          </View>
        </View>

        <View style={styles.metaRow}>
          {weekProgress && (
            <Text style={styles.metaText}>
              Week {weekProgress.currentWeek} of {weekProgress.totalWeeks}
            </Text>
          )}
          {startStr && endStr && (
            <Text style={styles.metaText}>
              {startStr} – {endStr}
            </Text>
          )}
        </View>

        {pickingDate ? (
          <View>
            <Text style={styles.datePickerLabel}>Resume on</Text>
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={dayjs().add(1, 'day').toDate()}
              onChange={handleDateChange}
            />
            {Platform.OS === 'ios' && (
              <TouchableOpacity style={styles.primaryButton} onPress={handleDateConfirm}>
                <Text style={styles.primaryButtonText}>{t('pauseCycle')}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            <View style={styles.shareRow}>
              <TouchableOpacity
                style={styles.actionItemFullWidth}
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onClose();
                  if (plan) onShare(plan);
                }}
              >
                <View style={styles.iconContainer}>
                  <IconShare size={20} color={COLORS.text} />
                </View>
                <Text style={styles.actionLabel}>{t('shareCycle')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actionsRow}>
              {cycleState === 'active' && (
                <TouchableOpacity
                  style={styles.actionItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPickingDate(true);
                  }}
                >
                  <View style={styles.iconContainer}>
                    <IconPause size={20} color={COLORS.text} />
                  </View>
                  <Text style={styles.actionLabel}>{t('pauseCycle')}</Text>
                </TouchableOpacity>
              )}

              {cycleState === 'paused' && (
                <TouchableOpacity
                  style={styles.actionItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onClose();
                    onResume();
                  }}
                >
                  <View style={styles.iconContainer}>
                    <IconPlay size={20} color={COLORS.text} />
                  </View>
                  <Text style={styles.actionLabel}>{t('resumeCycle')}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.actionItem}
                activeOpacity={0.7}
                onPress={handleEnd}
              >
                <View style={styles.iconContainer}>
                  <IconClose size={20} color={COLORS.signalNegative} />
                </View>
                <Text style={[styles.actionLabel, styles.actionLabelDestructive]}>{t('endCycle')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionItem, styles.actionItemDestructive]}
                activeOpacity={0.7}
                onPress={handleDelete}
              >
                <View style={styles.iconContainer}>
                  <IconTrash size={20} color={COLORS.signalNegative} />
                </View>
                <Text style={[styles.actionLabel, styles.actionLabelDestructive]}>{t('deleteCycle')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </BottomDrawer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    flexShrink: 1,
  },
  subtitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: SPACING.xl,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: 32,
  },
  metaText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successDimmed,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: SPACING.md,
  },
  statusBadgePaused: {
    backgroundColor: COLORS.accentPrimaryDimmed,
  },
  statusText: {
    ...TYPOGRAPHY.meta,
    fontWeight: '600',
    color: COLORS.successBright,
  },
  statusTextPaused: {
    color: COLORS.accentPrimary,
  },
  resumeDateText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.accentPrimary,
  },
  shareRow: {
    marginBottom: SPACING.md,
  },
  actionItemFullWidth: {
    width: '100%',
    backgroundColor: COLORS.activeCard,
    borderRadius: 16,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: 8,
  },
  actionItem: {
    flex: 1,
    backgroundColor: COLORS.activeCard,
    borderRadius: 16,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionItemDestructive: {
    backgroundColor: COLORS.signalNegativeDimmed,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  actionLabel: {
    ...TYPOGRAPHY.meta,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  actionLabelDestructive: {
    color: COLORS.signalNegative,
  },
  datePickerLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  primaryButton: {
    backgroundColor: COLORS.accentPrimary,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  primaryButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.backgroundCanvas,
  },
});
