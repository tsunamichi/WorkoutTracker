import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { useCreateCycleDraftStore } from '../../store/useCreateCycleDraftStore';
import { useStore } from '../../store';
import {
  formatWeekdayFull,
  calculateEndDate,
  formatDateRange,
  generateId,
} from '../../utils/manualCycleUtils';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../constants';
import { IconArrowLeft } from '../../components/icons';
import { Weekday } from '../../types/manualCycle';
import { useTranslation } from '../../i18n/useTranslation';

interface CreateCycleReviewProps {
  navigation: any;
}

export function CreateCycleReview({ navigation }: CreateCycleReviewProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const {
    weeks,
    frequencyDays,
    workouts,
    startDate,
    setStartDate,
    selectedDaysSorted,
    resetDraft,
  } = useCreateCycleDraftStore();

  const mainStore = useStore();

  const [showDatePicker, setShowDatePicker] = useState(false);

  const sortedDays = selectedDaysSorted();
  const hasActiveCycle = mainStore.cycles.some((c) => c.status === 'active');

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setStartDate(dayjs(selectedDate).format('YYYY-MM-DD'));
    }
  };

  const handleEditDay = (weekday: Weekday) => {
    navigation.navigate('CreateCycleDayEditor', { weekday });
  };

  const handleCreateCycle = async () => {
    if (!startDate) {
      Alert.alert(t('startDateRequiredTitle'), t('startDateRequiredMessage'));
      return;
    }

    // Convert draft to main store format
    const endDate = calculateEndDate(startDate, weeks);
    const cycleId = generateId();
    const cycleNumber = mainStore.getNextCycleNumber();

    // Create the cycle
    const newCycle = {
      id: cycleId,
      name: t('cycleNumber').replace('{number}', String(cycleNumber)),
      startDate,
      endDate,
      status: hasActiveCycle ? 'scheduled' : 'active',
      workoutIds: [],
    };

    // Create workouts and exercises
    for (const workout of workouts) {
      const workoutId = generateId();
      newCycle.workoutIds.push(workoutId);

      const exerciseIds: string[] = [];

      for (const exerciseBlock of workout.exercises) {
        // Add exercise to library if not already there
        const existingExercise = mainStore.exercises.find(
          (e) => e.id === exerciseBlock.exerciseId
        );

        if (!existingExercise) {
          // This shouldn't happen, but handle it just in case
          console.warn(`Exercise ${exerciseBlock.exerciseId} not found in library`);
          continue;
        }

        exerciseIds.push(exerciseBlock.exerciseId);
      }

      // Add the workout
      mainStore.addWorkout({
        id: workoutId,
        name: workout.name || formatWeekdayFull(workout.weekday),
        cycleId,
        exerciseIds,
      });
    }

    mainStore.addCycle(newCycle as any);

    // Generate workout assignments for the cycle dates
    const assignments: any[] = [];
    let currentDate = dayjs(startDate);
    const endDateDayjs = dayjs(endDate);

    while (
      currentDate.isBefore(endDateDayjs) ||
      currentDate.isSame(endDateDayjs, 'day')
    ) {
      const weekdayIndex = currentDate.day(); // 0 = Sun, 1 = Mon, etc.
      const weekdayMap: Record<number, Weekday> = {
        0: 'sun',
        1: 'mon',
        2: 'tue',
        3: 'wed',
        4: 'thu',
        5: 'fri',
        6: 'sat',
      };
      const weekday = weekdayMap[weekdayIndex];

      if (frequencyDays.includes(weekday)) {
        const workout = workouts.find((w) => w.weekday === weekday);
        if (workout) {
          const workoutId = newCycle.workoutIds.find((id) => {
            const w = mainStore.workouts.find((wo) => wo.id === id);
            return w?.name === (workout.name || formatWeekdayFull(workout.weekday));
          });

          if (workoutId) {
            assignments.push({
              date: currentDate.format('YYYY-MM-DD'),
              cycleId,
              workoutId,
            });
          }
        }
      }

      currentDate = currentDate.add(1, 'day');
    }

    // Add assignments to store
    for (const assignment of assignments) {
      mainStore.assignWorkout(assignment.date, assignment.cycleId, assignment.workoutId);
    }

    // Reset draft and navigate
    resetDraft();
    navigation.navigate('AppTabs', { screen: 'Schedule' });
  };

  const endDate = startDate ? calculateEndDate(startDate, weeks) : null;
  const canCreate = !!startDate;

  return (
    <View style={styles.gradient}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                t('exitSetupTitle'),
                t('exitSetupMessage'),
                [
                  { text: t('cancel'), style: 'cancel' },
                  {
                    text: t('exit'),
                    style: 'destructive',
                    onPress: () => {
                      resetDraft();
                      navigation.navigate('Tabs');
                    },
                  },
                ]
              );
            }}
            style={styles.backButton}
            activeOpacity={1}
          >
            <IconArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>{t('reviewCycle')}</Text>
            {(() => {
              const progress = 4 / 4;
              return (
                <View style={styles.progressIndicator}>
                  <Text style={styles.progressText}>4/4</Text>
                  <Svg height="16" width="16" viewBox="0 0 16 16" style={styles.progressCircle}>
                    <Circle cx="8" cy="8" r="8" fill={COLORS.backgroundCanvas} />
                    {progress > 0 ? (
                      <Path
                        d={`M 8 8 L 8 0 A 8 8 0 ${progress > 0.5 ? 1 : 0} 1 ${
                          8 + 8 * Math.sin(2 * Math.PI * progress)
                        } ${
                          8 - 8 * Math.cos(2 * Math.PI * progress)
                        } Z`}
                        fill={COLORS.signalWarning}
                      />
                    ) : null}
                  </Svg>
                </View>
              );
            })()}
          </View>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} bounces={false}>
          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{t('cycleSummary')}</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('trainingDays')}</Text>
              <Text style={styles.summaryValue}>
                {sortedDays.map((d) => formatWeekdayFull(d).slice(0, 3)).join(', ')}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('cycleLength')}</Text>
              <Text style={styles.summaryValue}>
                {weeks} {t('weeks')}
              </Text>
            </View>
          </View>

          {/* Start Date Picker */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('startDate')}</Text>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={1}
            >
              <Text style={styles.datePickerText}>
                {startDate
                  ? dayjs(startDate).format('MMM D, YYYY')
                  : 'Select start date'}
              </Text>
            </TouchableOpacity>
            {startDate && endDate && (
              <Text style={styles.dateRangeText}>{formatDateRange(startDate, endDate)}</Text>
            )}
          </View>

          {/* Active Cycle Warning */}
          {hasActiveCycle && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                You already have an active cycle. This one will be created as Scheduled.
              </Text>
            </View>
          )}

          {/* Workouts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('workoutsLabel')}</Text>
            {sortedDays.map((day) => {
              const workout = workouts.find((w) => w.weekday === day);
              const exerciseCount = workout?.exercises.length || 0;

              return (
                <View key={day} style={styles.workoutCard}>
                  <View style={styles.workoutHeader}>
                    <View>
                      <Text style={styles.workoutDay}>{formatWeekdayFull(day)}</Text>
                      {workout?.name && (
                        <Text style={styles.workoutName}>{workout.name}</Text>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => handleEditDay(day)} activeOpacity={1}>
                      <Text style={styles.editLink}>{t('editLabel')}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.workoutExerciseCount}>
                    {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
                  </Text>
                  <View style={styles.exerciseList}>
                    {workout?.exercises.map((exercise, index) => {
                      const exerciseData = mainStore.exercises.find(
                        (e) => e.id === exercise.exerciseId
                      );
                      return (
                        <Text key={exercise.id} style={styles.exerciseListItem}>
                          {index + 1}. {exerciseData?.name || 'Unknown'}
                        </Text>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* Create Button */}
        <View style={[styles.stickyFooter, { paddingBottom: insets.bottom || 32 }]}>
          <View style={styles.footerButtonsRow}>
            <TouchableOpacity
              style={styles.backFooterButton}
              onPress={() => navigation.goBack()}
              activeOpacity={1}
            >
              <Text style={styles.backFooterButtonText}>{t('back')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createButton, !canCreate && styles.createButtonDisabled]}
              onPress={handleCreateCycle}
              disabled={!canCreate}
              activeOpacity={1}
            >
              <Text
                style={[
                  styles.createButtonText,
                  !canCreate && styles.createButtonTextDisabled,
                ]}
              >
                Create cycle
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={startDate ? dayjs(startDate).toDate() : new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}
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
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: SPACING.md,
    marginLeft: -4,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressCircle: {
    // No additional styling needed
  },
  progressText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xxl,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 48,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.xxxl,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 15,
    color: COLORS.textMeta,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  datePickerButton: {
    backgroundColor: COLORS.activeCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
  },
  datePickerText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  dateRangeText: {
    fontSize: 14,
    color: COLORS.textMeta,
    marginTop: 8,
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: `${COLORS.signalWarning}20`,
    borderWidth: 1,
    borderColor: COLORS.signalWarning,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: 48,
  },
  warningText: {
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'center',
  },
  workoutCard: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  workoutDay: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  workoutName: {
    fontSize: 14,
    color: COLORS.textMeta,
    marginTop: 2,
  },
  editLink: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.accentPrimary,
  },
  workoutExerciseCount: {
    fontSize: 14,
    color: COLORS.textMeta,
    marginBottom: 12,
  },
  exerciseList: {
    gap: 6,
  },
  exerciseListItem: {
    fontSize: 15,
    color: COLORS.text,
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  footerButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  backFooterButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  backFooterButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  createButton: {
    flex: 1,
    backgroundColor: COLORS.accentPrimary,
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: COLORS.backgroundCanvas,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  createButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    fontWeight: '600',
    color: COLORS.backgroundCanvas,
  },
  createButtonTextDisabled: {
    color: COLORS.textMeta,
  },
});

