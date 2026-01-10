import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCreateCycleDraftStore } from '../../store/useCreateCycleDraftStore';
import { formatWeekdayFull } from '../../utils/manualCycleUtils';
import { COLORS, SPACING, TYPOGRAPHY } from '../../constants';
import { WorkoutDay } from '../../types/manualCycle';

interface CreateCycleDaysOverviewProps {
  navigation: any;
}

const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  backgroundContainer: '#FFFFFF',
  secondary: '#1B1B1B',
  textSecondary: '#3C3C43',
  textMeta: '#817B77',
  accent: '#FD6B00',
  success: '#34C759',
  chipBg: '#FFFFFF',
  chipBorder: '#C7C7CC',
};

export function CreateCycleDaysOverview({ navigation }: CreateCycleDaysOverviewProps) {
  const insets = useSafeAreaInsets();
  const {
    selectedDaysSorted,
    workouts,
    ensureWorkoutsForSelectedDays,
    areAllDaysComplete,
  } = useCreateCycleDraftStore();

  useEffect(() => {
    ensureWorkoutsForSelectedDays();
  }, []);

  const handleContinue = () => {
    navigation.navigate('CreateCycleReview');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleDayPress = (weekday: string) => {
    navigation.navigate('CreateCycleDayEditor', { weekday });
  };

  const sortedDays = selectedDaysSorted();
  const canContinue = areAllDaysComplete();

  return (
    <View style={styles.gradient}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            activeOpacity={1}
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.stepIndicator}>2/4</Text>
            <Text style={styles.headerTitle}>Build your week</Text>
          </View>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {sortedDays.map((day) => {
            const workout = workouts.find((w) => w.weekday === day);
            const exerciseCount = workout?.exercises.length || 0;
            const isComplete = exerciseCount > 0;

            return (
              <TouchableOpacity
                key={day}
                style={styles.dayCard}
                onPress={() => handleDayPress(day)}
                activeOpacity={1}
              >
                <View style={styles.dayCardContent}>
                  <View style={styles.dayInfo}>
                    <Text style={styles.dayLabel}>{formatWeekdayFull(day)}</Text>
                    {workout?.name && (
                      <Text style={styles.dayName}>{workout.name}</Text>
                    )}
                  </View>
                  <View style={styles.dayMeta}>
                    <Text style={styles.exerciseCount}>
                      {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
                    </Text>
                    <View style={[styles.statusPill, isComplete && styles.statusPillComplete]}>
                      <Text
                        style={[
                          styles.statusPillText,
                          isComplete && styles.statusPillTextComplete,
                        ]}
                      >
                        {isComplete ? 'Ready' : 'Incomplete'}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            );
          })}

          {!canContinue && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                Add at least one exercise to each day to continue
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer Buttons */}
        <View style={styles.stickyFooter}>
          <TouchableOpacity
            style={styles.backFooterButton}
            onPress={handleBack}
            activeOpacity={1}
          >
            <Text style={styles.backFooterButtonText}>Back</Text>
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
  dayCard: {
    backgroundColor: LIGHT_COLORS.backgroundContainer,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  dayCardContent: {
    flex: 1,
  },
  dayInfo: {
    marginBottom: 8,
  },
  dayLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: LIGHT_COLORS.secondary,
    marginBottom: 2,
  },
  dayName: {
    fontSize: 14,
    color: LIGHT_COLORS.textMeta,
  },
  dayMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exerciseCount: {
    fontSize: 14,
    color: LIGHT_COLORS.textSecondary,
  },
  statusPill: {
    backgroundColor: LIGHT_COLORS.chipBg,
    borderWidth: 1,
    borderColor: LIGHT_COLORS.chipBorder,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillComplete: {
    backgroundColor: LIGHT_COLORS.success + '20',
    borderColor: LIGHT_COLORS.success,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: LIGHT_COLORS.textMeta,
  },
  statusPillTextComplete: {
    color: LIGHT_COLORS.success,
  },
  chevron: {
    fontSize: 24,
    color: LIGHT_COLORS.textMeta,
  },
  warningBox: {
    backgroundColor: '#FFF9E6',
    borderWidth: 1,
    borderColor: '#FFD60A',
    borderRadius: 12,
    padding: SPACING.lg,
    marginTop: SPACING.md,
  },
  warningText: {
    fontSize: 14,
    color: LIGHT_COLORS.textSecondary,
    textAlign: 'center',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.md,
    flexDirection: 'row',
    gap: 12,
  },
  backFooterButton: {
    flex: 1,
    backgroundColor: LIGHT_COLORS.backgroundContainer,
    borderWidth: 1,
    borderColor: LIGHT_COLORS.chipBorder,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  backFooterButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    fontWeight: '600',
    color: LIGHT_COLORS.secondary,
  },
  continueButton: {
    flex: 2,
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
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  continueButtonTextDisabled: {
    color: LIGHT_COLORS.textMeta,
  },
});

