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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
import { COLORS, SPACING, TYPOGRAPHY } from '../../constants';
import { Weekday } from '../../types/manualCycle';

interface CreateCycleReviewProps {
  navigation: any;
}

const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  backgroundContainer: '#FFFFFF',
  secondary: '#1B1B1B',
  textSecondary: '#3C3C43',
  textMeta: '#817B77',
  accent: '#FD6B00',
  border: '#C7C7CC',
  warning: '#FFD60A',
};

export function CreateCycleReview({ navigation }: CreateCycleReviewProps) {
  const insets = useSafeAreaInsets();
  const {
    weeks,
    frequencyDays,
    workoutLength,
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
      Alert.alert('Start Date Required', 'Please select a start date for your cycle.');
      return;
    }

    // Convert draft to main store format
    const endDate = calculateEndDate(startDate, weeks);
    const cycleId = generateId();
    const cycleNumber = mainStore.getNextCycleNumber();

    // Create the cycle
    const newCycle = {
      id: cycleId,
      name: `Cycle ${cycleNumber}`,
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
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={1}
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.stepIndicator}>4/4</Text>
            <Text style={styles.headerTitle}>Review cycle</Text>
          </View>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} bounces={false}>
          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Cycle Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Training days</Text>
              <Text style={styles.summaryValue}>
                {sortedDays.map((d) => formatWeekdayFull(d).slice(0, 3)).join(', ')}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Workout length</Text>
              <Text style={styles.summaryValue}>{workoutLength} min</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Cycle length</Text>
              <Text style={styles.summaryValue}>{weeks} weeks</Text>
            </View>
          </View>

          {/* Start Date Picker */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Start date</Text>
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
            <Text style={styles.sectionTitle}>Workouts</Text>
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
                      <Text style={styles.editLink}>Edit</Text>
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
        <View style={styles.stickyFooter}>
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
  backText: {
    fontSize: 28,
    color: LIGHT_COLORS.secondary,
  },
  headerTitleContainer: {
    gap: 4,
  },
  stepIndicator: {
    fontSize: 14,
    color: LIGHT_COLORS.textMeta,
    fontWeight: '500',
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 120,
  },
  section: {
    marginBottom: SPACING.xxxl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.lg,
  },
  summaryCard: {
    backgroundColor: LIGHT_COLORS.backgroundContainer,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.xxxl,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: LIGHT_COLORS.secondary,
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
    color: LIGHT_COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: LIGHT_COLORS.secondary,
  },
  datePickerButton: {
    backgroundColor: LIGHT_COLORS.backgroundContainer,
    borderWidth: 1,
    borderColor: LIGHT_COLORS.border,
    borderRadius: 12,
    padding: SPACING.lg,
  },
  datePickerText: {
    fontSize: 16,
    color: LIGHT_COLORS.secondary,
    fontWeight: '500',
  },
  dateRangeText: {
    fontSize: 14,
    color: LIGHT_COLORS.textMeta,
    marginTop: 8,
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: '#FFF9E6',
    borderWidth: 1,
    borderColor: LIGHT_COLORS.warning,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.xxxl,
  },
  warningText: {
    fontSize: 14,
    color: LIGHT_COLORS.textSecondary,
    textAlign: 'center',
  },
  workoutCard: {
    backgroundColor: LIGHT_COLORS.backgroundContainer,
    borderRadius: 12,
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
    color: LIGHT_COLORS.secondary,
  },
  workoutName: {
    fontSize: 14,
    color: LIGHT_COLORS.textMeta,
    marginTop: 2,
  },
  editLink: {
    fontSize: 16,
    fontWeight: '600',
    color: LIGHT_COLORS.accent,
  },
  workoutExerciseCount: {
    fontSize: 14,
    color: LIGHT_COLORS.textSecondary,
    marginBottom: 12,
  },
  exerciseList: {
    gap: 6,
  },
  exerciseListItem: {
    fontSize: 15,
    color: LIGHT_COLORS.textSecondary,
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.md,
  },
  createButton: {
    backgroundColor: LIGHT_COLORS.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: LIGHT_COLORS.backgroundContainer,
    borderWidth: 1,
    borderColor: LIGHT_COLORS.border,
  },
  createButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  createButtonTextDisabled: {
    color: LIGHT_COLORS.textMeta,
  },
});

