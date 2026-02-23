import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, CARDS, BORDER_RADIUS } from '../constants';
import { IconArrowLeft, IconTrash, IconPlay, IconCheckmark } from '../components/icons';
import { useTranslation } from '../i18n/useTranslation';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { formatWeightForLoad } from '../utils/weight';

type RouteParams = RouteProp<RootStackParamList, 'BonusDetail'>;

export function BonusDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteParams>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { bonusLogId } = route.params;
  const {
    bonusLogs,
    deleteBonusLog,
    updateBonusLog,
    hiitTimers,
    exercises,
    settings,
  } = useStore();

  const log = bonusLogs.find(l => l.id === bonusLogId);
  if (!log) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <IconArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isCompleted = log.status === 'completed';

  const typeLabel = log.type === 'timer' ? t('timer')
    : log.type === 'warmup' ? t('warmUp')
    : t('core');

  const handleDelete = () => {
    Alert.alert(
      'Delete',
      `Remove this ${typeLabel.toLowerCase()} bonus?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteBonusLog(bonusLogId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleStart = () => {
    if (log.type === 'timer') {
      const timer = hiitTimers.find(t => t.id === log.presetId);
      if (timer) {
        updateBonusLog(log.id, { status: 'in_progress' });
        navigation.navigate('HIITTimerExecution', {
          timerId: timer.id,
          bonusLogId: log.id,
        });
      }
    } else {
      updateBonusLog(log.id, { status: 'in_progress' });
      navigation.navigate('ExerciseExecution', {
        workoutKey: `bonus-${log.id}`,
        workoutTemplateId: log.presetId,
        type: log.type === 'warmup' ? 'warmup' : 'core',
        bonusLogId: log.id,
      });
    }
  };

  const getExerciseName = (movementId: string) => {
    return exercises.find(e => e.id === movementId)?.name ?? movementId;
  };

  const renderTimerDetail = () => {
    const timer = hiitTimers.find(t => t.id === log.presetId);
    if (!timer) return <Text style={styles.metaText}>Timer not found</Text>;
    
    const formatTime = (seconds: number) => {
      if (seconds < 60) return `${seconds}s`;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    };

    return (
      <View style={styles.detailSection}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Work</Text>
          <Text style={styles.detailValue}>{formatTime(timer.work)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Rest</Text>
          <Text style={styles.detailValue}>{formatTime(timer.workRest)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Sets</Text>
          <Text style={styles.detailValue}>{timer.sets}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Rounds</Text>
          <Text style={styles.detailValue}>{timer.rounds}</Text>
        </View>
        {timer.roundRest > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Round rest</Text>
            <Text style={styles.detailValue}>{formatTime(timer.roundRest)}</Text>
          </View>
        )}
        {isCompleted && log.timerPayload?.totalDuration != null && (
          <View style={[styles.detailRow, styles.resultRow]}>
            <Text style={styles.detailLabel}>Duration</Text>
            <Text style={styles.resultValue}>{formatTime(log.timerPayload.totalDuration)}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderExerciseDetail = () => {
    const items = log.exercisePayload?.items ?? [];
    if (items.length === 0) return <Text style={styles.metaText}>No exercises</Text>;

    return (
      <View style={styles.detailSection}>
        {items.map((item, i) => {
          const name = getExerciseName(item.movementId);
          const setsCount = item.sets?.length ?? 0;
          const firstSet = item.sets?.[0];
          const descriptor = item.mode === 'time'
            ? `${setsCount} × ${firstSet?.durationSec ?? 0}s`
            : `${setsCount} × ${firstSet?.reps ?? 0}`;
          const weight = firstSet?.weight;
          const weightStr = weight ? ` @ ${formatWeightForLoad(weight, settings.weightUnit)}` : '';

          return (
            <View key={item.id || i} style={styles.exerciseRow}>
              <Text style={styles.exerciseName} numberOfLines={1}>{name}</Text>
              <Text style={styles.exerciseMeta}>{descriptor}{weightStr}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <IconArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{log.presetName}</Text>
        <TouchableOpacity onPress={handleDelete} style={styles.backButton}>
          <IconTrash size={20} color={COLORS.textMeta} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.statusBadge}>
          <Text style={styles.typeLabel}>{typeLabel}</Text>
          {isCompleted && (
            <View style={styles.completedBadge}>
              <IconCheckmark size={14} color={COLORS.successBright} />
              <Text style={styles.completedText}>{t('completed')}</Text>
            </View>
          )}
        </View>

        {log.type === 'timer' ? renderTimerDetail() : renderExerciseDetail()}
      </ScrollView>

      {!isCompleted && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
          <TouchableOpacity style={styles.startButton} onPress={handleStart} activeOpacity={0.8}>
            <IconPlay size={18} color={COLORS.backgroundCanvas} />
            <Text style={styles.startButtonText}>{t('start')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    height: 56,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.xxl,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  typeLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    textTransform: 'uppercase',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.successBright,
  },
  detailSection: {
    gap: SPACING.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.backgroundContainer,
  },
  resultRow: {
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.backgroundContainer,
  },
  detailLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  detailValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  resultValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.successBright,
    fontWeight: '600',
  },
  metaText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.backgroundContainer,
  },
  exerciseName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.md,
  },
  exerciseMeta: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  footer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    backgroundColor: COLORS.accentPrimary,
    borderRadius: BORDER_RADIUS.md,
  },
  startButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.backgroundCanvas,
  },
});
