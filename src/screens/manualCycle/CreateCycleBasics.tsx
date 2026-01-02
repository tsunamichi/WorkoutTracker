import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useCreateCycleDraftStore } from '../../store/useCreateCycleDraftStore';
import { DAY_ORDER, WORKOUT_LENGTHS, Weekday, WorkoutLength } from '../../types/manualCycle';
import { formatWeekday } from '../../utils/manualCycleUtils';
import { IconAdd, IconMinus } from '../../components/icons';
import { COLORS, SPACING, TYPOGRAPHY } from '../../constants';

interface CreateCycleBasicsProps {
  navigation: any;
}

const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  secondary: '#1B1B1B',
  textSecondary: '#3C3C43',
  textMeta: '#817B77',
  accent: '#FD6B00',
  chipBg: '#FFFFFF',
  chipSelectedBg: '#FD6B00',
  chipBorder: '#C7C7CC',
};

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
    <LinearGradient colors={['#E3E6E0', '#D4D6D1']} style={styles.gradient}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.6}
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.stepIndicator}>1/4</Text>
            <Text style={styles.headerTitle}>Create cycle</Text>
          </View>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
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
                  activeOpacity={0.7}
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
                  activeOpacity={0.7}
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
                activeOpacity={0.7}
              >
                <IconMinus size={20} color={weeks <= 1 ? LIGHT_COLORS.textMeta : LIGHT_COLORS.secondary} />
              </TouchableOpacity>
              <View style={styles.stepperValue}>
                <Text style={styles.stepperNumber}>{weeks}</Text>
                <Text style={styles.stepperLabel}>weeks</Text>
              </View>
              <TouchableOpacity
                style={[styles.stepperButton, weeks >= 12 && styles.stepperButtonDisabled]}
                onPress={() => handleWeeksChange(1)}
                disabled={weeks >= 12}
                activeOpacity={0.7}
              >
                <IconAdd size={20} color={weeks >= 12 ? LIGHT_COLORS.textMeta : LIGHT_COLORS.secondary} />
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
            activeOpacity={0.8}
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
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
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: LIGHT_COLORS.textMeta,
    marginBottom: SPACING.lg,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dayChip: {
    backgroundColor: LIGHT_COLORS.chipBg,
    borderWidth: 1,
    borderColor: LIGHT_COLORS.chipBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  dayChipSelected: {
    backgroundColor: LIGHT_COLORS.chipSelectedBg,
    borderColor: LIGHT_COLORS.chipSelectedBg,
  },
  dayChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: LIGHT_COLORS.secondary,
  },
  dayChipTextSelected: {
    color: '#FFFFFF',
  },
  lengthChip: {
    backgroundColor: LIGHT_COLORS.chipBg,
    borderWidth: 1,
    borderColor: LIGHT_COLORS.chipBorder,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  lengthChipSelected: {
    backgroundColor: LIGHT_COLORS.chipSelectedBg,
    borderColor: LIGHT_COLORS.chipSelectedBg,
  },
  lengthChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: LIGHT_COLORS.secondary,
  },
  lengthChipTextSelected: {
    color: '#FFFFFF',
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
    backgroundColor: LIGHT_COLORS.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: LIGHT_COLORS.chipBorder,
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
    color: LIGHT_COLORS.secondary,
  },
  stepperLabel: {
    fontSize: 14,
    color: LIGHT_COLORS.textMeta,
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
    backgroundColor: LIGHT_COLORS.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: LIGHT_COLORS.chipBg,
    borderWidth: 1,
    borderColor: LIGHT_COLORS.chipBorder,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  continueButtonTextDisabled: {
    color: LIGHT_COLORS.textMeta,
  },
});

