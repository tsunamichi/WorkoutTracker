import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconArrowLeft, IconMenu, IconTrash, IconClose, IconPause, IconPlay } from '../components/icons';
import { ActionSheet } from '../components/common/ActionSheet';
import { useStore } from '../store';
import { useTranslation } from '../i18n/useTranslation';
import type { CyclePlanStatus } from '../types/training';
import dayjs from 'dayjs';

type RouteParams = {
  CyclePlanDetail: { planId: string };
};

const STATUS_LABEL: Record<CyclePlanStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  ended_early: 'Ended Early',
  completed: 'Completed',
};

export function CyclePlanDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'CyclePlanDetail'>>();
  const { planId } = route.params;
  const { t } = useTranslation();

  const {
    cyclePlans,
    endCyclePlan,
    reactivateCyclePlan,
    deleteCyclePlan,
    pauseShiftCyclePlan,
    duplicateCyclePlan,
    updateCyclePlan,
    getCyclePlanEffectiveEndDate,
    getCyclePlanStatus,
    getCyclePlanWeekProgress,
  } = useStore();

  const [menuVisible, setMenuVisible] = useState(false);
  const [showResumeDatePicker, setShowResumeDatePicker] = useState(false);
  const [resumeDate, setResumeDate] = useState(() => {
    const tomorrow = dayjs().add(1, 'day').toDate();
    return tomorrow;
  });

  const plan = cyclePlans.find(p => p.id === planId);
  const status = getCyclePlanStatus(planId);
  const effectiveEndDate = plan ? getCyclePlanEffectiveEndDate(plan) : '';
  const weekProgress = getCyclePlanWeekProgress(planId, dayjs().format('YYYY-MM-DD'));

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleEndCycle = () => {
    setMenuVisible(false);
    Alert.alert(
      'End cycle?',
      'This will remove future workouts from this cycle. Completed workouts remain.',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: 'End cycle',
          style: 'destructive',
          onPress: async () => {
            await endCyclePlan(planId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleDeleteCycle = () => {
    setMenuVisible(false);
    Alert.alert(
      'Delete this plan?',
      'Future scheduled workouts from this plan will be removed. Past workouts stay in your history. This cannot be undone.',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteCyclePlan(planId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handlePauseShift = () => {
    setMenuVisible(false);
    setShowResumeDatePicker(true);
  };

  const onResumeDatePick = async (_event: any, date?: Date) => {
    if (Platform.OS !== 'ios') setShowResumeDatePicker(false);
    if (!date) return;
    setResumeDate(date);
    if (Platform.OS !== 'ios') {
      await applyPauseShift(dayjs(date).format('YYYY-MM-DD'));
    }
  };

  const onResumeDateConfirm = async () => {
    setShowResumeDatePicker(false);
    await applyPauseShift(dayjs(resumeDate).format('YYYY-MM-DD'));
  };

  const applyPauseShift = async (resumeDateStr: string) => {
    const result = await pauseShiftCyclePlan(planId, resumeDateStr);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (result.conflicts && result.conflicts.length > 0) {
      (navigation as any).navigate('CycleConflicts', {
        planId,
        plan: cyclePlans.find(p => p.id === planId),
        conflicts: result.conflicts,
        fromPauseShift: true,
        resumeDate: resumeDateStr,
      });
    }
  };

  const handleDuplicate = async () => {
    setMenuVisible(false);
    const newId = await duplicateCyclePlan(planId);
    if (newId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    navigation.goBack();
  };

  const handleResumeCycle = async () => {
    setMenuVisible(false);
    await updateCyclePlan(planId, { pausedUntil: undefined });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleReactivateCycle = async () => {
    setMenuVisible(false);
    await reactivateCyclePlan(planId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const isActiveOrPaused = status === 'active' || status === 'paused';
  const isEnded = status === 'ended_early';
  const actionSheetItems = [
    ...(isActiveOrPaused
      ? [
          { icon: <IconClose size={20} color={COLORS.text} />, label: 'End', onPress: handleEndCycle },
          ...(status === 'active'
            ? [{ icon: <IconPause size={20} color={COLORS.text} />, label: 'Pause / Shift', onPress: handlePauseShift }]
            : [{ icon: <IconPlay size={20} color={COLORS.text} />, label: 'Resume', onPress: handleResumeCycle }]),
        ]
      : []),
    ...(isEnded
      ? [{ icon: <IconPlay size={20} color={COLORS.accentPrimary} />, label: 'Make active again', onPress: handleReactivateCycle }]
      : []),
    { icon: <IconTrash size={20} color={COLORS.error} />, label: t('delete'), onPress: handleDeleteCycle, destructive: true as const },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; onPress: () => void; destructive?: boolean }[];

  if (!plan) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Plan not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.gradient, { paddingTop: insets.top }]}>
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={12}>
            <IconArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{plan.name}</Text>
          <TouchableOpacity onPress={() => { setMenuVisible(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} style={styles.menuButton} hitSlop={12}>
            <IconMenu size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.statusRow}>
              <Text style={styles.label}>Status</Text>
              <View style={[
                styles.statusBadge,
                status === 'active' && styles.statusBadgeActive,
                status === 'paused' && styles.statusBadgePaused,
              ]}>
                <Text style={[
                  styles.statusText,
                  status === 'active' && styles.statusTextActive,
                  status === 'paused' && styles.statusTextPaused,
                ]}>{STATUS_LABEL[status]}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Start date</Text>
              <Text style={styles.value}>{dayjs(plan.startDate).format('MMM D, YYYY')}</Text>
            </View>
            {status === 'paused' && plan.pausedUntil && (
              <View style={styles.row}>
                <Text style={styles.label}>Paused until</Text>
                <Text style={styles.value}>{dayjs(plan.pausedUntil).format('MMM D, YYYY')}</Text>
              </View>
            )}
            <View style={styles.row}>
              <Text style={styles.label}>End date</Text>
              <Text style={styles.value}>{dayjs(effectiveEndDate).format('MMM D, YYYY')}</Text>
            </View>
            {weekProgress && (
              <View style={styles.row}>
                <Text style={styles.label}>Week progress</Text>
                <Text style={styles.value}>Week {weekProgress.currentWeek} of {weekProgress.totalWeeks}</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {showResumeDatePicker && (
          <View style={styles.datePickerContainer}>
            <DateTimePicker
              value={resumeDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={dayjs().add(1, 'day').toDate()}
              onChange={onResumeDatePick}
            />
            {Platform.OS === 'ios' && (
              <TouchableOpacity style={styles.datePickerDone} onPress={onResumeDateConfirm}>
                <Text style={styles.datePickerDoneText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <ActionSheet
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          items={actionSheetItems}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: SPACING.sm,
  },
  menuButton: {
    padding: SPACING.xs,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.xl,
  },
  card: {
    backgroundColor: COLORS.backgroundContainer,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  label: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textSecondary,
  },
  value: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.container,
  },
  statusBadgeActive: {
    backgroundColor: COLORS.accentPrimaryDimmed,
  },
  statusBadgePaused: {
    backgroundColor: 'rgba(255, 159, 10, 0.15)',
  },
  statusText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.textSecondary,
  },
  statusTextActive: {
    color: COLORS.accentPrimary,
  },
  statusTextPaused: {
    color: '#FF9F0A',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  actionIcon: {
    fontSize: 18,
    color: COLORS.text,
  },
  datePickerContainer: {
    backgroundColor: COLORS.backgroundContainer,
    paddingBottom: SPACING.lg,
  },
  datePickerDone: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  datePickerDoneText: {
    ...TYPOGRAPHY.button,
    color: COLORS.accentPrimary,
  },
  errorText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    textAlign: 'center',
    marginTop: SPACING.xxl,
  },
  backText: {
    ...TYPOGRAPHY.body,
    color: COLORS.accentPrimary,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});
