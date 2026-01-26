import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconAdd, IconWorkouts, IconCalendar, IconMenu, IconSwap } from '../components/icons';
import { useStore } from '../store';
import { useTranslation } from '../i18n/useTranslation';
import dayjs from 'dayjs';
import { BottomDrawer } from '../components/common/BottomDrawer';

// Light theme colors
const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  secondary: '#1B1B1B',
  textMeta: '#817B77',
  border: '#C7C7CC',
  accentPrimary: '#FD6B00',
  buttonBg: '#F2F2F7',
};

export function WorkoutsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    settings,
    workoutTemplates,
    cyclePlans,
    scheduleWorkout,
    duplicateWorkoutTemplate,
    duplicateCyclePlan,
    applyCyclePlan,
    archiveCyclePlan,
    detectCycleConflicts,
    updateCyclePlan,
  } = useStore();
  const { t } = useTranslation();

  const handleTemplatePress = (templateId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    (navigation as any).navigate('WorkoutTemplateDetail', { templateId });
  };

  const [templateActionsId, setTemplateActionsId] = useState<string | null>(null);
  const [planActionsId, setPlanActionsId] = useState<string | null>(null);
  const [createSheet, setCreateSheet] = useState<null | 'single' | 'plan'>(null);
  const [scheduleTemplateId, setScheduleTemplateId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // SCHEDULE-FIRST: Sort templates by lastUsedAt (recently used first)
  const sortedTemplates = useMemo(() => {
    return [...workoutTemplates].sort((a, b) => {
      // Recently used first (lastUsedAt DESC)
      if (a.lastUsedAt && b.lastUsedAt) {
        return dayjs(b.lastUsedAt).valueOf() - dayjs(a.lastUsedAt).valueOf();
      }
      if (a.lastUsedAt && !b.lastUsedAt) return -1;
      if (!a.lastUsedAt && b.lastUsedAt) return 1;
      // If both never used, sort by created date (newest first)
      return dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf();
    });
  }, [workoutTemplates]);

  const sortedPlans = useMemo(() => {
    const active = cyclePlans.filter(p => p.active && !p.archivedAt);
    const inactive = cyclePlans.filter(p => !p.active && !p.archivedAt);
    const archived = cyclePlans.filter(p => !!p.archivedAt);
    
    // Within each group, sort by lastUsedAt (recently used first)
    const sortByRecency = (plans: typeof cyclePlans) => {
      return [...plans].sort((a, b) => {
        if (a.lastUsedAt && b.lastUsedAt) {
          return dayjs(b.lastUsedAt).valueOf() - dayjs(a.lastUsedAt).valueOf();
        }
        if (a.lastUsedAt && !b.lastUsedAt) return -1;
        if (!a.lastUsedAt && b.lastUsedAt) return 1;
        return dayjs(b.updatedAt).valueOf() - dayjs(a.updatedAt).valueOf();
      });
    };
    
    return [
      ...sortByRecency(active),
      ...sortByRecency(inactive),
      ...sortByRecency(archived)
    ];
  }, [cyclePlans]);

  const openSchedulePicker = (templateId: string) => {
    setScheduleTemplateId(templateId);
    setScheduleDate(new Date());
    setShowDatePicker(true);
  };

  const onPickScheduleDate = async (_event: any, date?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowDatePicker(false);
    }
    if (!date || !scheduleTemplateId) return;
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    await scheduleWorkout(dateStr, scheduleTemplateId, 'manual', undefined, 'replace');
    setScheduleTemplateId(null);
    setShowDatePicker(false);
    Alert.alert(t('scheduled'), t('scheduleForToday').replace('today', dayjs(date).format('MMM D')));
  };

  return (
    <View style={styles.gradient}>
      <SafeAreaView style={[styles.container, { paddingBottom: 88 }]} edges={[]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.topBar}>
            <Text style={styles.headerTitle}>{t('training')}</Text>
            <View style={styles.headerRight}>
              <ProfileAvatar 
                onPress={() => (navigation as any).navigate('Profile')}
                size={40}
                backgroundColor="#9E9E9E"
                textColor="#FFFFFF"
                showInitial={true}
                imageUri={settings.profileAvatarUri || null}
              />
            </View>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Section A — Single Workouts */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{t('singleWorkouts')}</Text>
                <Text style={styles.sectionSubtitle}>{t('singleWorkoutsSubtitle')}</Text>
              </View>
            </View>

            {/* Dashed create card */}
            <TouchableOpacity
              style={styles.dashedCreateCard}
              onPress={() => setCreateSheet('single')}
              activeOpacity={0.9}
            >
              <View style={styles.dashedCreateInner}>
                <IconAdd size={20} color={COLORS.text} />
                <Text style={styles.dashedCreateText}>{t('createWorkout')}</Text>
              </View>
            </TouchableOpacity>

            {sortedTemplates.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={styles.rowCard}
                onPress={() => handleTemplatePress(template.id)}
                activeOpacity={0.8}
              >
                <View style={styles.rowCardInner}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{template.name}</Text>
                    <Text style={styles.rowSubtitle}>
                      {template.items.length} {template.items.length === 1 ? t('exercise') : t('exercises')}
                      {template.usageCount > 0 && ` • ${template.usageCount}x`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setTemplateActionsId(template.id);
                    }}
                    activeOpacity={0.8}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <IconMenu size={22} color={COLORS.textMeta} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Section B — Workout Plans */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{t('workoutPlans')}</Text>
                <Text style={styles.sectionSubtitle}>{t('workoutPlansSubtitle')}</Text>
              </View>
            </View>

            {/* Dashed create card */}
            <TouchableOpacity
              style={styles.dashedCreateCard}
              onPress={() => setCreateSheet('plan')}
              activeOpacity={0.9}
            >
              <View style={styles.dashedCreateInner}>
                <IconAdd size={20} color={COLORS.text} />
                <Text style={styles.dashedCreateText}>{t('createPlan')}</Text>
              </View>
            </TouchableOpacity>

            {sortedPlans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                style={styles.rowCard}
                onPress={() => setPlanActionsId(plan.id)}
                activeOpacity={0.85}
              >
                <View style={styles.rowCardInner}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.planTitleRow}>
                      <Text style={styles.rowTitle}>{plan.name}</Text>
                      {plan.active && <View style={styles.activePill}><Text style={styles.activePillText}>{t('active')}</Text></View>}
                      {!!plan.archivedAt && <View style={styles.archivedPill}><Text style={styles.archivedPillText}>{t('archived')}</Text></View>}
                    </View>
                    <Text style={styles.rowSubtitle}>
                      {t('week')}s: {plan.weeks} • {t('start')}: {dayjs(plan.startDate).format('MMM D')}
                    </Text>
                  </View>
                  <IconSwap size={22} color={COLORS.textMeta} />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Template actions drawer */}
        <BottomDrawer visible={!!templateActionsId} onClose={() => setTemplateActionsId(null)}>
          <View style={styles.actionSheet}>
            <Text style={styles.actionSheetTitle}>{t('singleWorkouts')}</Text>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                if (!templateActionsId) return;
                setTemplateActionsId(null);
                openSchedulePicker(templateActionsId);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.actionText}>{t('schedule')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={async () => {
                if (!templateActionsId) return;
                await duplicateWorkoutTemplate(templateActionsId);
                setTemplateActionsId(null);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.actionText}>{t('duplicate')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionRow} onPress={() => setTemplateActionsId(null)} activeOpacity={0.85}>
              <Text style={[styles.actionText, { color: COLORS.textMeta }]}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </BottomDrawer>

        {/* Create sheet (single vs plan) */}
        <BottomDrawer visible={!!createSheet} onClose={() => setCreateSheet(null)}>
          <View style={styles.actionSheet}>
            <Text style={styles.actionSheetTitle}>
              {createSheet === 'single' ? t('singleWorkouts') : t('workoutPlans')}
            </Text>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                setCreateSheet(null);
                if (createSheet === 'single') {
                  (navigation as any).navigate('WorkoutBuilder');
                } else {
                  (navigation as any).navigate('CreateCycleBasics');
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.actionText}>
                {createSheet === 'single' ? t('createWorkout') : t('createPlan')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                const mode = createSheet === 'single' ? 'single' : 'plan';
                setCreateSheet(null);
                (navigation as any).navigate('AIWorkoutCreation', { mode });
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.actionText}>{t('createWithAI')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionRow} onPress={() => setCreateSheet(null)} activeOpacity={0.85}>
              <Text style={[styles.actionText, { color: COLORS.textMeta }]}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </BottomDrawer>

        {/* Plan actions drawer */}
        <BottomDrawer visible={!!planActionsId} onClose={() => setPlanActionsId(null)}>
          <View style={styles.actionSheet}>
            <Text style={styles.actionSheetTitle}>{t('workoutPlans')}</Text>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={async () => {
                if (!planActionsId) return;
                const result = await applyCyclePlan(planActionsId);
                if (!result.success && result.conflicts && result.conflicts.length > 0) {
                  const plan = cyclePlans.find(p => p.id === planActionsId);
                  if (plan) {
                    setPlanActionsId(null);
                    (navigation as any).navigate('CycleConflicts', { planId: plan.id, plan, conflicts: result.conflicts });
                    return;
                  }
                }
                setPlanActionsId(null);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.actionText}>{t('applyPlan')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={async () => {
                if (!planActionsId) return;
                await duplicateCyclePlan(planActionsId);
                setPlanActionsId(null);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.actionText}>{t('duplicate')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={async () => {
                if (!planActionsId) return;
                await archiveCyclePlan(planActionsId);
                setPlanActionsId(null);
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.actionText, { color: COLORS.signalWarning }]}>{t('archive')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionRow} onPress={() => setPlanActionsId(null)} activeOpacity={0.85}>
              <Text style={[styles.actionText, { color: COLORS.textMeta }]}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </BottomDrawer>

        {/* Date picker for scheduling */}
        {showDatePicker && (
          <DateTimePicker
            value={scheduleDate}
            mode="date"
            display="default"
            onChange={onPickScheduleDate}
            minimumDate={new Date()}
          />
        )}
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
    backgroundColor: 'transparent',
  },
  header: {
    marginBottom: SPACING.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xxxl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
  },
  sectionSubtitle: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
    marginTop: 6,
  },
  dashedCreateCard: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.text,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  dashedCreateInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dashedCreateText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.text,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyStateTitle: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.secondary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  emptyStateSubtitle: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
    textAlign: 'center',
  },
  rowCard: {
    backgroundColor: CARDS.cardDeepDimmed.outer.backgroundColor,
    borderRadius: CARDS.cardDeepDimmed.outer.borderRadius,
    borderCurve: CARDS.cardDeepDimmed.outer.borderCurve,
    borderWidth: CARDS.cardDeepDimmed.outer.borderWidth,
    borderColor: CARDS.cardDeepDimmed.outer.borderColor,
    overflow: CARDS.cardDeepDimmed.outer.overflow,
    marginBottom: SPACING.md,
  },
  rowCardInner: {
    ...CARDS.cardDeepDimmed.inner,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  rowTitle: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.xs,
  },
  rowSubtitle: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.35)',
  },
  activePillText: {
    ...TYPOGRAPHY.meta,
    color: 'rgba(52, 199, 89, 0.95)',
    fontWeight: '700',
  },
  archivedPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.28)',
  },
  archivedPillText: {
    ...TYPOGRAPHY.meta,
    color: 'rgba(255, 149, 0, 0.9)',
    fontWeight: '700',
  },
  actionSheet: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.sm,
  },
  actionSheetTitle: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.sm,
  },
  actionRow: {
    height: 52,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.activeCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '700',
  },
});
