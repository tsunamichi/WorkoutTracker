import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Modal,
  Animated,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { useCreateCycleDraftStore } from '../../store/useCreateCycleDraftStore';
import { useStore } from '../../store';
import { Weekday } from '../../types/manualCycle';
import { formatWeekdayFull, generateId } from '../../utils/manualCycleUtils';
import { IconAddLine, IconMinusLine, IconClose } from '../../components/icons';
import { COLORS, SPACING, TYPOGRAPHY, CARDS, BORDER_RADIUS } from '../../constants';
import { useTranslation } from '../../i18n/useTranslation';
import { DraggableWorkoutDayList, type DraggableWorkoutDay } from '../../components/manualCycle/DraggableWorkoutDayList';

interface CreateCycleFlowProps {
  navigation: any;
  route?: {
    params?: {
      selectedDate?: string; // YYYY-MM-DD
    };
  };
}

export function CreateCycleFlow({ navigation, route }: CreateCycleFlowProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { addWorkoutTemplate, addCyclePlan } = useStore();
  
  const {
    weeks,
    frequencyDays,
    setWeeks,
    setDaysPerWeek,
    ensureWorkoutsForSelectedDays,
    selectedDaysSorted,
    workouts,
    areAllDaysComplete,
    resetDraft,
    initializeWithSelectedDate,
    setWorkoutDayName,
    reorderWorkoutDays,
  } = useCreateCycleDraftStore();

  const [currentStep, setCurrentStep] = useState(1); // 1 = basics, 2 = build week
  const [startDate, setStartDate] = useState<string>(
    route?.params?.selectedDate || dayjs().format('YYYY-MM-DD')
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [scrollEnabled, setScrollEnabled] = useState(true);
  
  // Date picker animations
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Initialize draft store on mount
  useEffect(() => {
    const selectedDate = route?.params?.selectedDate;
    
    if (selectedDate) {
      initializeWithSelectedDate(selectedDate);
      setStartDate(selectedDate);
    } else {
      resetDraft();
    }
    
    // Cleanup on unmount
    return () => {
      resetDraft();
    };
  }, []);

  // Animate date picker
  useEffect(() => {
    if (showDatePicker) {
      setTempDate(new Date(startDate));
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showDatePicker]);

  const handleOpenDatePicker = () => {
    setTempDate(new Date(startDate));
    setShowDatePicker(true);
  };

  const handleConfirmDate = () => {
    setStartDate(dayjs(tempDate).format('YYYY-MM-DD'));
    setShowDatePicker(false);
  };

  const handleCancelDate = () => {
    setShowDatePicker(false);
  };

  const handleExit = () => {
    if (currentStep === 1) {
      // First step - no confirmation needed
      resetDraft();
      navigation.goBack();
      return;
    }
    
    // Later steps - confirm exit
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
            navigation.popToTop();
          },
        },
      ]
    );
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleContinue = () => {
    if (currentStep === 1) {
      // Move to step 2
      ensureWorkoutsForSelectedDays();
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Final step - create the cycle
      handleCreateCycle();
    }
  };

  const handleWeeksChange = (delta: number) => {
    const newWeeks = Math.max(1, Math.min(12, weeks + delta));
    setWeeks(newWeeks);
  };

  const handleDayPress = (weekday: Weekday) => {
    navigation.navigate('CreateCycleDayEditor', { weekday });
  };

  const handleReorderDays = (reorderedDays: DraggableWorkoutDay[]) => {
    const newOrder = reorderedDays.map(day => day.weekday);
    reorderWorkoutDays(newOrder);
  };

  const handleCreateCycle = async () => {
    if (!startDate) {
      Alert.alert(t('startDateRequiredTitle'), t('startDateRequiredMessage'));
      return;
    }

    console.log('🎯 Creating cycle with startDate:', startDate);
    console.log('   - weeks:', weeks);
    console.log('   - frequencyDays:', sortedDays);

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

    const sortedDays = selectedDaysSorted();

    // Create WorkoutTemplates for each day
    for (const weekday of sortedDays) {
      const workout = workouts.find((w) => w.weekday === weekday);
      if (!workout) continue;

      const templateId = `wt-${Date.now()}-${weekday}`;
      console.log(`   - Creating template for ${weekday} (weekday ${weekdayMap[weekday]}): ${templateId}`);

      await addWorkoutTemplate({
        id: templateId,
        name: workout.name || formatWeekdayFull(weekday),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        kind: 'workout',
        warmupItems: [],
        items: workout.exercises.map((ex, idx) => ({
          id: generateId(),
          exerciseId: ex.exerciseId,
          order: idx,
          sets: ex.weeks[0]?.sets || 3,
          reps: ex.weeks[0]?.reps || '8',
          weight: ex.weeks[0]?.weight || 0,
          isTimeBased: ex.weeks[0]?.isTimeBased || false,
          isPerSide: ex.isPerSide ?? false,
        })),
        lastUsedAt: null,
        usageCount: 0,
        source: 'user',
      });

      templateIdsByWeekday[weekdayMap[weekday]] = templateId;
    }

    // Create CyclePlan
    const planName = weeks === 1 ? '1-Week Plan' : `${weeks}-Week Plan`;
    const newPlan = {
      id: `cp-${Date.now()}`,
      name: planName,
      templateIdsByWeekday,
      weeks,
      startDate,
      mapping: {
        kind: 'daysPerWeek' as const,
        daysPerWeek: sortedDays.length,
      },
    };

    console.log('📋 Created plan:', newPlan);

    const result = await addCyclePlan({ ...newPlan, active: true });

    if (result.success) {
      resetDraft();
      console.log('✅ Cycle created and scheduled successfully!');
      navigation.popToTop();
    } else {
      console.error('❌ Failed to create cycle');
      Alert.alert(t('error'), t('failedToCreateCycle'));
    }
  };

  const sortedDays = selectedDaysSorted();
  const canContinue = currentStep === 1 
    ? frequencyDays.length > 0 && weeks >= 1 && weeks <= 12
    : areAllDaysComplete();

  const progress = currentStep / 2;

  return (
    <View style={styles.gradient}>
      <View style={styles.container}>
        {/* Fixed Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity
            onPress={handleExit}
            style={styles.backButton}
            activeOpacity={1}
          >
            <IconClose size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>
              {currentStep === 1 ? t('createCycle') : t('buildYourWeek')}
            </Text>
            <View style={styles.progressIndicator}>
              <Text style={styles.progressText}>{currentStep}/2</Text>
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
          </View>
        </View>

        {/* Content Area - Changes based on step */}
        <ScrollView 
          style={styles.content} 
          contentContainerStyle={styles.scrollContent} 
          bounces={false}
          scrollEnabled={scrollEnabled}
        >
          {currentStep === 1 && (
            <>
              {/* Days Per Week */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('daysPerWeek')}</Text>
                <Text style={styles.sectionSubtitle}>
                  Workouts will be scheduled consecutively from your start date
                </Text>
                <View style={styles.stepper}>
                  <View style={styles.stepperValue}>
                    <View style={styles.stepperValueRow}>
                      <Text style={styles.stepperNumber}>{frequencyDays.length}</Text>
                      <Text style={styles.stepperLabel}>
                        {frequencyDays.length === 1 ? 'day' : 'days'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.stepperControls}>
                    <TouchableOpacity
                      style={[
                        styles.adjustButtonTapTarget,
                        frequencyDays.length <= 1 && styles.adjustButtonDisabled,
                      ]}
                      onPress={() => setDaysPerWeek(frequencyDays.length - 1)}
                      disabled={frequencyDays.length <= 1}
                      activeOpacity={1}
                    >
                      <View style={styles.adjustButton}>
                        <View style={styles.adjustButtonInner}>
                          <IconMinusLine size={24} color={COLORS.accentPrimary} />
                        </View>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.adjustButtonTapTarget,
                        frequencyDays.length >= 7 && styles.adjustButtonDisabled,
                      ]}
                      onPress={() => setDaysPerWeek(frequencyDays.length + 1)}
                      disabled={frequencyDays.length >= 7}
                      activeOpacity={1}
                    >
                      <View style={styles.adjustButton}>
                        <View style={styles.adjustButtonInner}>
                          <IconAddLine size={24} color={COLORS.accentPrimary} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Cycle Weeks */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('cycleLength')}</Text>
                <View style={styles.stepper}>
                  <View style={styles.stepperValue}>
                    <View style={styles.stepperValueRow}>
                      <Text style={styles.stepperNumber}>{weeks}</Text>
                      <Text style={styles.stepperLabel}>{t('weeks')}</Text>
                    </View>
                  </View>
                  <View style={styles.stepperControls}>
                    <TouchableOpacity
                      style={[
                        styles.adjustButtonTapTarget,
                        weeks <= 1 && styles.adjustButtonDisabled,
                      ]}
                      onPress={() => handleWeeksChange(-1)}
                      disabled={weeks <= 1}
                      activeOpacity={1}
                    >
                      <View style={styles.adjustButton}>
                        <View style={styles.adjustButtonInner}>
                          <IconMinusLine size={24} color={COLORS.accentPrimary} />
                        </View>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.adjustButtonTapTarget,
                        weeks >= 12 && styles.adjustButtonDisabled,
                      ]}
                      onPress={() => handleWeeksChange(1)}
                      disabled={weeks >= 12}
                      activeOpacity={1}
                    >
                      <View style={styles.adjustButton}>
                        <View style={styles.adjustButtonInner}>
                          <IconAddLine size={24} color={COLORS.accentPrimary} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </>
          )}

          {currentStep === 2 && (
            <>
              {/* Start Date Picker */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('startDate')}</Text>
                <TouchableOpacity
                  style={styles.datePickerTrigger}
                  onPress={handleOpenDatePicker}
                  activeOpacity={1}
                >
                  <Text style={styles.datePickerText}>
                    {dayjs(startDate).format('MMMM D, YYYY')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Workout Days */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('workouts')}</Text>
                <DraggableWorkoutDayList
                  days={sortedDays.map((day, index) => {
                    const workout = workouts.find((w) => w.weekday === day);
                    return {
                      weekday: day,
                      name: workout?.name || t('dayNumber').replace('{number}', String(index + 1)),
                      exerciseCount: workout?.exercises.length || 0,
                      order: index,
                    };
                  })}
                  onReorder={handleReorderDays}
                  onDayPress={handleDayPress}
                  scrollEnabled={scrollEnabled}
                  onScrollEnabledChange={setScrollEnabled}
                  t={t}
                />
              </View>
            </>
          )}
        </ScrollView>

        {/* Fixed Footer */}
        <View style={[styles.stickyFooter, { paddingBottom: insets.bottom || 32 }]}>
          <View style={styles.footerButtonsRow}>
            <TouchableOpacity
              style={styles.backFooterButton}
              onPress={handleBack}
              disabled={currentStep === 1}
              activeOpacity={1}
            >
              <Text
                style={[
                  styles.backFooterButtonText,
                  currentStep === 1 && styles.backFooterButtonTextDisabled,
                ]}
              >
                {t('back')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
              onPress={handleContinue}
              disabled={!canContinue}
              activeOpacity={1}
            >
              <Text
                style={[
                  styles.continueButtonText,
                  !canContinue && styles.continueButtonTextDisabled,
                ]}
              >
                {currentStep === 2 ? t('create') : t('continue')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* iOS Date Picker Modal */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="none"
          onRequestClose={handleCancelDate}
        >
          <View style={styles.modalContainer}>
            <Animated.View
              style={[
                styles.modalBackdrop,
                {
                  opacity: fadeAnim,
                },
              ]}
            >
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                onPress={handleCancelDate}
                activeOpacity={1}
              />
            </Animated.View>

            <Animated.View
              style={[
                styles.pickerContainer,
                {
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={handleCancelDate}>
                  <Text style={styles.pickerHeaderButton}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleConfirmDate}>
                  <Text style={[styles.pickerHeaderButton, styles.pickerHeaderButtonDone]}>
                    {t('done')}
                  </Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    setTempDate(selectedDate);
                  }
                }}
              />
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* Android Date Picker */}
      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker
          value={new Date(startDate)}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (event.type === 'set' && selectedDate) {
              setStartDate(dayjs(selectedDate).format('YYYY-MM-DD'));
            }
          }}
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
    backgroundColor: COLORS.backgroundCanvas,
    zIndex: 10,
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
  progressCircle: {},
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
    marginBottom: 12,
  },
  sectionSubtitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: 24,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  stepperValue: {
    flex: 1,
    alignItems: 'flex-start',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  stepperNumber: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
  },
  stepperLabel: {
    ...TYPOGRAPHY.h1,
    color: COLORS.textMeta,
  },
  adjustButtonTapTarget: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  adjustButtonInner: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentPrimaryDimmed,
  },
  adjustButtonDisabled: {
    opacity: 0.3,
  },
  datePickerTrigger: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    borderCurve: 'continuous',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  datePickerText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.backgroundCanvas,
    zIndex: 10,
  },
  footerButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  backFooterButton: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backFooterButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  backFooterButtonTextDisabled: {
    color: COLORS.textMeta,
  },
  continueButton: {
    flex: 1,
    backgroundColor: COLORS.accentPrimary,
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: COLORS.backgroundCanvas,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  continueButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    color: COLORS.backgroundCanvas,
  },
  continueButtonTextDisabled: {
    color: COLORS.textMeta,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerContainer: {
    backgroundColor: COLORS.backgroundCanvas,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerHeaderButton: {
    ...TYPOGRAPHY.body,
    color: COLORS.accentPrimary,
  },
  pickerHeaderButtonDone: {
    fontWeight: '600',
  },
});
