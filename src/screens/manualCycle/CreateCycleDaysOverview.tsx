import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCreateCycleDraftStore } from '../../store/useCreateCycleDraftStore';
import { formatWeekdayFull } from '../../utils/manualCycleUtils';
import { COLORS, SPACING, TYPOGRAPHY, CARDS } from '../../constants';
import { IconArrowLeft } from '../../components/icons';

interface CreateCycleDaysOverviewProps {
  navigation: any;
}

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
            <IconArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.stepIndicator}>2/4</Text>
            <Text style={styles.headerTitle}>Build your week</Text>
          </View>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} bounces={false}>
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
  dayCard: {
    ...CARDS.cardDeep.outer,
    marginBottom: SPACING.md,
  },
  dayCardContent: {
    ...CARDS.cardDeep.inner,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  dayInfo: {
    marginBottom: 8,
  },
  dayLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  dayName: {
    fontSize: 14,
    color: COLORS.textMeta,
  },
  dayMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exerciseCount: {
    fontSize: 14,
    color: COLORS.textMeta,
  },
  statusPill: {
    backgroundColor: COLORS.backgroundCanvas,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillComplete: {
    backgroundColor: `${COLORS.signalPositive}20`,
    borderColor: COLORS.signalPositive,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMeta,
  },
  statusPillTextComplete: {
    color: COLORS.signalPositive,
  },
  chevron: {
    fontSize: 24,
    color: COLORS.textMeta,
  },
  warningBox: {
    backgroundColor: `${COLORS.signalWarning}20`,
    borderWidth: 1,
    borderColor: COLORS.signalWarning,
    borderRadius: 12,
    padding: SPACING.lg,
    marginTop: SPACING.md,
  },
  warningText: {
    fontSize: 14,
    color: COLORS.text,
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
    backgroundColor: COLORS.activeCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  backFooterButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    fontWeight: '600',
    color: COLORS.text,
  },
  continueButton: {
    flex: 2,
    backgroundColor: COLORS.accentPrimary,
    paddingVertical: 16,
    borderRadius: 12,
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

