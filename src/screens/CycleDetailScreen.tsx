import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { formatWeightForLoad } from '../utils/weight';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconArrowLeft, IconMenu, IconShare, IconTrash, IconCheck, IconPlay } from '../components/icons';
import { ActionSheet } from '../components/common/ActionSheet';
import { BottomDrawer } from '../components/common/BottomDrawer';
import type { ScheduledWorkout, WorkoutTemplateExercise } from '../types/training';
import type { ExerciseProgress } from '../types';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { useTranslation } from '../i18n/useTranslation';

dayjs.extend(isoWeek);

interface CycleDetailScreenProps {
  route: {
    params: {
      cycleId: string;
    };
  };
  navigation: any;
}

export function CycleDetailScreen({ route, navigation }: CycleDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { cycleId } = route.params;
  const {
    cyclePlans,
    scheduledWorkouts,
    exercises,
    settings,
    detailedWorkoutProgress,
    getMainCompletion,
    reactivateCyclePlan,
  } = useStore();
  const { t } = useTranslation();
  const useKg = settings.useKg;
  const weightUnit = useKg ? 'kg' : 'lb';
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<ScheduledWorkout | null>(null);

  const cyclePlan = cyclePlans.find(p => p.id === cycleId);

  const cycleWorkouts = useMemo(() => {
    if (!cyclePlan) return [];
    return scheduledWorkouts
      .filter(sw => sw.programId === cycleId || sw.cyclePlanId === cycleId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [cyclePlan, scheduledWorkouts, cycleId]);

  const weekGroups = useMemo(() => {
    if (!cyclePlan || cycleWorkouts.length === 0) return [];
    const startDate = dayjs(cyclePlan.startDate);
    const groups: { weekNumber: number; weekStart: string; weekEnd: string; workouts: ScheduledWorkout[] }[] = [];

    for (let w = 0; w < cyclePlan.weeks; w++) {
      const weekStart = startDate.add(w, 'week');
      const weekEnd = weekStart.add(6, 'day');
      const weekWorkouts = cycleWorkouts.filter(sw => {
        return sw.date >= weekStart.format('YYYY-MM-DD') && sw.date <= weekEnd.format('YYYY-MM-DD');
      });
      if (weekWorkouts.length > 0) {
        groups.push({
          weekNumber: w + 1,
          weekStart: weekStart.format('MMM D'),
          weekEnd: weekEnd.format('MMM D'),
          workouts: weekWorkouts,
        });
      }
    }
    return groups;
  }, [cyclePlan, cycleWorkouts]);

  const endDate = useMemo(() => {
    if (!cyclePlan) return null;
    if (cyclePlan.endedAt) return dayjs(cyclePlan.endedAt);
    if (cycleWorkouts.length > 0) return dayjs(cycleWorkouts[cycleWorkouts.length - 1].date);
    return dayjs(cyclePlan.startDate).add(cyclePlan.weeks, 'week').subtract(1, 'day');
  }, [cyclePlan, cycleWorkouts]);

  const getWorkoutCompletion = (sw: ScheduledWorkout) => {
    const result = getMainCompletion(sw.id);
    return result.percentage;
  };

  const getExerciseProgressForWorkout = (sw: ScheduledWorkout, exerciseId: string): ExerciseProgress | null => {
    const workoutKey = `${sw.templateId}-${sw.date}`;
    const progress = detailedWorkoutProgress[workoutKey];
    if (!progress?.exercises?.[exerciseId]) return null;
    return progress.exercises[exerciseId];
  };

  const handleMakeActiveAgain = async () => {
    setMenuVisible(false);
    if (!cyclePlan || cyclePlan.active) return;
    await reactivateCyclePlan(cycleId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleExportData = async () => {
    if (!cyclePlan) return;
    let exportText = `${cyclePlan.name}\n`;
    exportText += `Period: ${dayjs(cyclePlan.startDate).format('MMM D, YYYY')} - ${endDate?.format('MMM D, YYYY') ?? 'In Progress'}\n\n`;

    for (const group of weekGroups) {
      exportText += `WEEK ${group.weekNumber} (${group.weekStart} - ${group.weekEnd})\n`;
      exportText += `${'-'.repeat(40)}\n`;
      for (const sw of group.workouts) {
        exportText += `\n  ${sw.titleSnapshot} — ${dayjs(sw.date).format('ddd, MMM D')}\n`;
        for (const ex of sw.exercisesSnapshot || []) {
          const exerciseData = exercises.find(e => e.id === ex.exerciseId);
          const progress = getExerciseProgressForWorkout(sw, ex.exerciseId);
          exportText += `    ${exerciseData?.name || 'Unknown'}\n`;
          if (progress?.sets && progress.sets.length > 0) {
            progress.sets.forEach((set, idx) => {
              exportText += `      Set ${idx + 1}: ${formatWeightForLoad(set.weight, useKg)} ${weightUnit} × ${set.reps} ${set.completed ? '✓' : ''}\n`;
            });
          } else {
            exportText += `      No logged data\n`;
          }
        }
      }
      exportText += '\n';
    }

    try {
      await Share.share({ message: exportText, title: cyclePlan.name });
    } catch (error) {
      Alert.alert(t('alertErrorTitle'), t('failedToExportData'));
    }
  };

  if (!cyclePlan) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <IconArrowLeft size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{t('cycleNotFound')}</Text>
        </View>
      </View>
    );
  }

  const isActive = cyclePlan.active && !cyclePlan.endedAt;
  const statusLabel = isActive ? 'Active' : 'Finished';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <IconArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuButton}>
            <IconMenu size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.pageTitleContainer}>
          <Text style={styles.pageTitle}>{cyclePlan.name}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {dayjs(cyclePlan.startDate).format('MMM D')} — {endDate?.format('MMM D, YYYY')}
            </Text>
            <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusFinished]}>
              <Text style={[styles.statusText, isActive ? styles.statusTextActive : styles.statusTextFinished]}>
                {statusLabel}
              </Text>
            </View>
          </View>
          <Text style={styles.summaryText}>
            {cyclePlan.weeks} {cyclePlan.weeks === 1 ? 'week' : 'weeks'} · {cycleWorkouts.length} workouts
          </Text>
        </View>
      </View>

      <ActionSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        items={[
          ...(cyclePlan && !cyclePlan.active
            ? [{
                icon: <IconPlay size={24} color={COLORS.accentPrimary} />,
                label: 'Make active again',
                onPress: handleMakeActiveAgain,
              }]
            : []),
          {
            icon: <IconShare size={24} color={COLORS.text} />,
            label: t('exportData'),
            onPress: handleExportData,
          },
        ]}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        {weekGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No workouts logged</Text>
          </View>
        ) : (
          weekGroups.map((group) => (
            <View key={`week-${group.weekNumber}`}>
              <View style={styles.weekHeader}>
                <Text style={styles.weekHeaderText}>
                  Week {group.weekNumber}
                </Text>
                <Text style={styles.weekHeaderDates}>
                  {group.weekStart} — {group.weekEnd}
                </Text>
              </View>

              {group.workouts.map((sw) => {
                const completion = getWorkoutCompletion(sw);
                const progress = completion / 100;
                return (
                  <TouchableOpacity
                    key={sw.id}
                    style={styles.workoutCardWrapper}
                    onPress={() => setSelectedWorkout(sw)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.workoutCard}>
                      <View style={styles.workoutCardInner}>
                        <View style={styles.workoutCardHeader}>
                          <View style={styles.workoutCardText}>
                            <Text style={styles.workoutName}>{sw.titleSnapshot}</Text>
                            <Text style={styles.workoutDate}>{dayjs(sw.date).format('ddd, MMM D')}</Text>
                          </View>
                          <View style={styles.progressIndicator}>
                            {progress >= 0.999 ? (
                              <IconCheck size={20} color={COLORS.successBright} />
                            ) : completion > 0 ? (
                              <>
                                <Text style={styles.progressText}>{completion}%</Text>
                                <Svg height="16" width="16" viewBox="0 0 16 16">
                                  <Circle cx="8" cy="8" r="8" fill={COLORS.container} />
                                  <Path
                                    d={`M 8 8 L 8 0 A 8 8 0 ${progress > 0.5 ? 1 : 0} 1 ${
                                      8 + 8 * Math.sin(2 * Math.PI * progress)
                                    } ${8 - 8 * Math.cos(2 * Math.PI * progress)} Z`}
                                    fill={COLORS.signalWarning}
                                  />
                                </Svg>
                              </>
                            ) : (
                              <Text style={styles.progressText}>—</Text>
                            )}
                          </View>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      {/* Workout Detail Drawer */}
      <BottomDrawer
        visible={!!selectedWorkout}
        onClose={() => setSelectedWorkout(null)}
        maxHeight="90%"
        expandable={false}
        scrollable={false}
        fixedHeight={true}
      >
        {selectedWorkout && (
          <View style={styles.sheetContent}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{selectedWorkout.titleSnapshot}</Text>
              <Text style={styles.sheetSubtitle}>
                {dayjs(selectedWorkout.date).format('dddd, MMMM D, YYYY')}
              </Text>
            </View>
            <ScrollView
              style={styles.sheetBody}
              contentContainerStyle={styles.sheetBodyContent}
              bounces={false}
            >
              {(selectedWorkout.exercisesSnapshot || []).map((ex: WorkoutTemplateExercise, idx: number) => {
                const exerciseData = exercises.find(e => e.id === ex.exerciseId);
                const progress = getExerciseProgressForWorkout(selectedWorkout, ex.exerciseId);
                const hasSets = progress?.sets && progress.sets.length > 0;

                return (
                  <View key={ex.id || idx}>
                    <View style={styles.exerciseRow}>
                      <View style={styles.exerciseNameColumn}>
                        <Text style={styles.exerciseName}>
                          {exerciseData?.name || 'Unknown Exercise'}
                        </Text>
                        <Text style={styles.exerciseTarget}>
                          {ex.sets}×{ex.reps}{ex.isTimeBased ? 's' : ''}
                        </Text>
                      </View>

                      <View style={styles.setsColumn}>
                        {hasSets ? (
                          progress!.sets.map((set, setIdx) => (
                            <View key={setIdx} style={styles.setRow}>
                              <View style={styles.setValue}>
                                <Text style={styles.setValueText}>
                                  {formatWeightForLoad(set.weight, useKg)}
                                </Text>
                                <Text style={styles.setUnitText}>{weightUnit}</Text>
                              </View>
                              <View style={styles.setValue}>
                                <Text style={styles.setValueText}>{set.reps}</Text>
                                <Text style={styles.setUnitText}>
                                  {ex.isTimeBased ? 'sec' : 'reps'}
                                </Text>
                              </View>
                              {set.completed && (
                                <IconCheck size={14} color={COLORS.successBright} />
                              )}
                            </View>
                          ))
                        ) : (
                          <Text style={styles.noDataText}>—</Text>
                        )}
                      </View>
                    </View>

                    {idx < (selectedWorkout.exercisesSnapshot || []).length - 1 && (
                      <View style={styles.divider} />
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}
      </BottomDrawer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  header: {
    paddingBottom: SPACING.md,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -4,
  },
  menuButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginRight: -4,
  },
  pageTitleContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.sm,
    gap: 6,
  },
  pageTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: COLORS.accentPrimaryDimmed,
  },
  statusFinished: {
    backgroundColor: COLORS.container,
  },
  statusText: {
    ...TYPOGRAPHY.note,
    fontWeight: '600',
  },
  statusTextActive: {
    color: COLORS.accentPrimary,
  },
  statusTextFinished: {
    color: COLORS.textMeta,
  },
  summaryText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.sm,
    paddingBottom: 100,
  },
  emptyState: {
    paddingVertical: SPACING.xxxl,
    alignItems: 'center',
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  weekHeader: {
    marginTop: 32,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  weekHeaderText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
  },
  weekHeaderDates: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  workoutCardWrapper: {
    marginBottom: SPACING.sm,
  },
  workoutCard: CARDS.cardDeepDimmed.outer as any,
  workoutCardInner: {
    ...(CARDS.cardDeepDimmed.inner as any),
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  workoutCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  workoutCardText: {
    flex: 1,
  },
  workoutName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    marginBottom: 2,
  },
  workoutDate: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },

  // Drawer
  sheetContent: {
    flex: 1,
    paddingHorizontal: SPACING.xxl,
  },
  sheetHeader: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  sheetTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: 4,
  },
  sheetSubtitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  sheetBody: {
    flex: 1,
  },
  sheetBodyContent: {
    paddingBottom: SPACING.xl,
  },
  exerciseRow: {
    flexDirection: 'row',
    paddingVertical: SPACING.lg,
    gap: 24,
  },
  exerciseNameColumn: {
    flex: 1,
    gap: 2,
  },
  exerciseName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  exerciseTarget: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  setsColumn: {
    flex: 1,
    gap: SPACING.sm,
    alignItems: 'flex-end',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  setValue: {
    width: 56,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 3,
  },
  setValueText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  setUnitText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  noDataText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderDimmed,
  },
});
