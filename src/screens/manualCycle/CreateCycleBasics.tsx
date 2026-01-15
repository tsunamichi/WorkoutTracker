import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCreateCycleDraftStore } from '../../store/useCreateCycleDraftStore';
import { DAY_ORDER, WORKOUT_LENGTHS, Weekday, WorkoutLength } from '../../types/manualCycle';
import { formatWeekday } from '../../utils/manualCycleUtils';
import { IconAdd, IconMinus, IconArrowLeft } from '../../components/icons';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../constants';

interface CreateCycleBasicsProps {
  navigation: any;
}

export function CreateCycleBasics({ navigation }: CreateCycleBasicsProps) {
  const insets = useSafeAreaInsets();
  const {
    weeks,
    frequencyDays,
    workoutLength,
    setWeeks,
    toggleFrequencyDay,
    setWorkoutLength,
    ensureWorkoutsForSelectedDays,
    isBasicsValid,
  } = useCreateCycleDraftStore();

  const handleContinue = () => {
    ensureWorkoutsForSelectedDays();
    navigation.navigate('CreateCycleDaysOverview');
  };

  const handleWeeksChange = (delta: number) => {
    const newWeeks = Math.max(1, Math.min(12, weeks + delta));
    setWeeks(newWeeks);
  };

  const canContinue = isBasicsValid();

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
            <IconArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.stepIndicator}>1/4</Text>
            <Text style={styles.headerTitle}>Create cycle</Text>
          </View>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} bounces={false}>
          {/* Frequency Days */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Training days</Text>
            <Text style={styles.sectionSubtitle}>Select which days you'll train</Text>
            <View style={styles.chipGrid}>
              {DAY_ORDER.map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayChip,
                    frequencyDays.includes(day) && styles.dayChipSelected,
                  ]}
                  onPress={() => toggleFrequencyDay(day)}
                  activeOpacity={1}
                >
                  <Text
                    style={[
                      styles.dayChipText,
                      frequencyDays.includes(day) && styles.dayChipTextSelected,
                    ]}
                  >
                    {formatWeekday(day)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Workout Length */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Workout length</Text>
            <Text style={styles.sectionSubtitle}>Estimated time per session</Text>
            <View style={styles.chipGrid}>
              {WORKOUT_LENGTHS.map((length) => (
                <TouchableOpacity
                  key={length}
                  style={[
                    styles.lengthChip,
                    workoutLength === length && styles.lengthChipSelected,
                  ]}
                  onPress={() => setWorkoutLength(length)}
                  activeOpacity={1}
                >
                  <Text
                    style={[
                      styles.lengthChipText,
                      workoutLength === length && styles.lengthChipTextSelected,
                    ]}
                  >
                    {length} min
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Cycle Weeks */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cycle length</Text>
            <Text style={styles.sectionSubtitle}>How many weeks is this cycle?</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={[styles.stepperButton, weeks <= 1 && styles.stepperButtonDisabled]}
                onPress={() => handleWeeksChange(-1)}
                disabled={weeks <= 1}
                activeOpacity={1}
              >
                <IconMinus size={20} color={weeks <= 1 ? COLORS.textDisabled : COLORS.text} />
              </TouchableOpacity>
              <View style={styles.stepperValue}>
                <Text style={styles.stepperNumber}>{weeks}</Text>
                <Text style={styles.stepperLabel}>weeks</Text>
              </View>
              <TouchableOpacity
                style={[styles.stepperButton, weeks >= 12 && styles.stepperButtonDisabled]}
                onPress={() => handleWeeksChange(1)}
                disabled={weeks >= 12}
                activeOpacity={1}
              >
                <IconAdd size={20} color={weeks >= 12 ? COLORS.textDisabled : COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Continue Button */}
        <View style={styles.stickyFooter}>
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
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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
  headerTitleContainer: {
    gap: 4,
  },
  stepIndicator: {
    fontSize: 14,
    color: COLORS.textMeta,
    fontWeight: '500',
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
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
    color: COLORS.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textMeta,
    marginBottom: SPACING.lg,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dayChip: {
    backgroundColor: COLORS.activeCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  dayChipSelected: {
    backgroundColor: COLORS.accentPrimary,
    borderColor: COLORS.accentPrimary,
  },
  dayChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  dayChipTextSelected: {
    color: COLORS.backgroundCanvas,
  },
  lengthChip: {
    backgroundColor: COLORS.activeCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  lengthChipSelected: {
    backgroundColor: COLORS.accentPrimary,
    borderColor: COLORS.accentPrimary,
  },
  lengthChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  lengthChipTextSelected: {
    color: COLORS.backgroundCanvas,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.activeCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepperButtonDisabled: {
    opacity: 0.3,
  },
  stepperValue: {
    flex: 1,
    alignItems: 'center',
  },
  stepperNumber: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.text,
  },
  stepperLabel: {
    fontSize: 14,
    color: COLORS.textMeta,
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
  continueButton: {
    backgroundColor: COLORS.accentPrimary,
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: COLORS.backgroundCanvas,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  continueButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    fontWeight: '600',
    color: COLORS.backgroundCanvas,
  },
  continueButtonTextDisabled: {
    color: COLORS.textMeta,
  },
});

