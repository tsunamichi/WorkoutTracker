import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  Modal,
  Animated,
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
import { IconClose } from '../../components/icons';
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
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const sortedDays = selectedDaysSorted();
  const hasActiveCycle = mainStore.cycles.some((c) => c.status === 'active');

  useEffect(() => {
    if (showDatePicker) {
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 90,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 400,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showDatePicker]);

  const handleOpenDatePicker = () => {
    setTempDate(startDate ? dayjs(startDate).toDate() : new Date());
    setShowDatePicker(true);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'set' && selectedDate) {
        setStartDate(dayjs(selectedDate).format('YYYY-MM-DD'));
      }
    } else {
      // iOS: update temp date while user is scrolling
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  };

  const handleConfirmDate = () => {
    setStartDate(dayjs(tempDate).format('YYYY-MM-DD'));
    setShowDatePicker(false);
  };

  const handleCancelDate = () => {
    setShowDatePicker(false);
  };

  const handleEditDay = (weekday: Weekday) => {
    navigation.navigate('CreateCycleDayEditor', { weekday });
  };

  const handleCreateCycle = async () => {
    if (!startDate) {
      Alert.alert(t('startDateRequiredTitle'), t('startDateRequiredMessage'));
      return;
    }

    console.log('🎯 Creating cycle with startDate:', startDate);
    console.log('   - weeks:', weeks);
    console.log('   - frequencyDays:', sortedDays);

    // NEW: Create WorkoutTemplates and CyclePlan
    const templateIdsByWeekday: Partial<Record<number, string>> = {};
    const weekdayMap: Record<Weekday, number> = {
      sun: 0,
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
    };

    // First, create all workout templates
    for (const workout of workouts) {
      const templateId = `wt-${Date.now()}-${workout.weekday}`;
      const weekdayNum = weekdayMap[workout.weekday];
      
      console.log(`   - Creating template for ${workout.weekday} (weekday ${weekdayNum}):`, templateId);
      
      // Convert draft exercise blocks to WorkoutTemplateExercise format
      const items = workout.exercises.map((exerciseBlock, index) => {
        // Get the settings for week 0 (first week)
        const week0Settings = exerciseBlock.weeks[0] || {};
        
        return {
          id: `wte-${Date.now()}-${index}`,
          exerciseId: exerciseBlock.exerciseId,
          order: index,
          sets: week0Settings.sets ?? 3,
          reps: parseInt(week0Settings.reps || '8', 10),
          weight: week0Settings.weight,
          isTimeBased: week0Settings.isTimeBased ?? false,
          isPerSide: exerciseBlock.isPerSide ?? false,
          restSeconds: undefined,
        };
      });

      await mainStore.addWorkoutTemplate({
        id: templateId,
        kind: 'workout',
        name: workout.name || formatWeekdayFull(workout.weekday),
        warmupItems: [],
        items,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastUsedAt: null,
        usageCount: 0,
        source: 'user',
      });

      templateIdsByWeekday[weekdayNum] = templateId;
    }

    // Create the CyclePlan using consecutive day scheduling
    const planId = `cp-${Date.now()}`;
    const daysPerWeek = sortedDays.length;
    const newPlan = {
      id: planId,
      name: `${weeks}-Week Plan`,
      startDate,
      weeks,
      mapping: {
        kind: 'daysPerWeek' as const,
        daysPerWeek,
      },
      templateIdsByWeekday,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('📋 Created plan:', {
      id: planId,
      name: newPlan.name,
      startDate: newPlan.startDate,
      weeks: newPlan.weeks,
      daysPerWeek: newPlan.mapping.daysPerWeek,
      templateIdsByWeekday: newPlan.templateIdsByWeekday,
    });

    // Add the cycle plan (this also generates scheduled workouts if active)
    const result = await mainStore.addCyclePlan(newPlan);
    
    console.log('✅ addCyclePlan result:', result);
    
    if (!result.success && result.conflicts && result.conflicts.length > 0) {
      // Navigate to conflicts screen
      console.log('⚠️ Conflicts detected, navigating to conflicts screen');
      navigation.navigate('CycleConflicts', {
        plan: newPlan,
        conflicts: result.conflicts,
        planId: newPlan.id,
      });
    } else {
      // Success!
      console.log('✅ Cycle created and scheduled successfully!');
      
      resetDraft();
      navigation.navigate('Tabs', { initialTab: 'Schedule' } as any);
    }
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
                      // Pop all screens to return to Tabs with back animation
                      navigation.popToTop();
                    },
                  },
                ]
              );
            }}
            style={styles.backButton}
            activeOpacity={1}
          >
            <IconClose size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>{t('reviewCycle')}</Text>
            {(() => {
              const progress = 4 / 4;
              return (
                <View style={styles.progressIndicator}>
                  <Text style={styles.progressText}>4/4</Text>
                  <Svg height="16" width="16" viewBox="0 0 16 16" style={styles.progressCircle}>
                    <Circle cx="8" cy="8" r="8" fill={COLORS.activeCard} />
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
              onPress={handleOpenDatePicker}
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

      {/* Date Picker Modal - iOS Native Style */}
      {Platform.OS === 'ios' && showDatePicker && (
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="none"
          onRequestClose={handleCancelDate}
        >
          <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
            <TouchableOpacity 
              style={styles.modalBackdrop} 
              activeOpacity={1} 
              onPress={handleCancelDate}
            />
          </Animated.View>
          <Animated.View style={[
            styles.datePickerModalContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}>
            <View style={styles.datePickerModal}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={handleCancelDate} activeOpacity={1}>
                  <Text style={styles.datePickerCancelButton}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleConfirmDate} activeOpacity={1}>
                  <Text style={styles.datePickerDoneButton}>{t('done')}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                minimumDate={new Date()}
                textColor={COLORS.text}
                themeVariant="light"
              />
            </View>
          </Animated.View>
        </Modal>
      )}

      {/* Android Date Picker */}
      {Platform.OS === 'android' && showDatePicker && (
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
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalBackdrop: {
    flex: 1,
  },
  datePickerModalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  datePickerModal: {
    backgroundColor: COLORS.backgroundCanvas,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    paddingBottom: 34,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  datePickerCancelButton: {
    fontSize: 17,
    color: COLORS.text,
  },
  datePickerDoneButton: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.accentPrimary,
  },
});

