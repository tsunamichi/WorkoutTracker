import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCreateCycleDraftStore } from '../../store/useCreateCycleDraftStore';
import { COLORS, SPACING, TYPOGRAPHY, CARDS } from '../../constants';
import { IconClose, IconCheck } from '../../components/icons';
import { useTranslation } from '../../i18n/useTranslation';

interface CreateCycleDaysOverviewProps {
  navigation: any;
}

export function CreateCycleDaysOverview({ navigation }: CreateCycleDaysOverviewProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const {
    selectedDaysSorted,
    workouts,
    ensureWorkoutsForSelectedDays,
    areAllDaysComplete,
    resetDraft,
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
            <Text style={styles.headerTitle}>{t('buildYourWeek')}</Text>
            {(() => {
              const progress = 2 / 4;
              return (
                <View style={styles.progressIndicator}>
                  <Text style={styles.progressText}>2/4</Text>
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
          {sortedDays.map((day, index) => {
            const workout = workouts.find((w) => w.weekday === day);
            const exerciseCount = workout?.exercises.length || 0;
            const isComplete = exerciseCount > 0;

            return (
              <View key={day} style={styles.dayCard}>
                <TouchableOpacity
                  style={styles.dayCardInner}
                  onPress={() => handleDayPress(day)}
                  activeOpacity={1}
                >
                <View style={[
                  styles.dayCardContent,
                  isComplete ? styles.dayCardContentComplete : styles.dayCardContentWithAction,
                ]}>
                    <View style={styles.dayCardHeader}>
                      <Text style={styles.dayLabel}>
                        {workout?.name || t('dayNumber').replace('{number}', String(index + 1))}
                      </Text>
                    </View>
                    <Text style={styles.exerciseCount}>
                      {exerciseCount} {exerciseCount === 1 ? t('exercise') : t('exercises')}
                      {` \u2022 ${t('dayNumber').replace('{number}', String(index + 1))}`}
                    </Text>
                  </View>
                  {isComplete && (
                    <View style={styles.dayCheckIcon}>
                      <IconCheck size={24} color={COLORS.successBright} />
                    </View>
                  )}
                  {!isComplete && (
                    <View style={styles.dayCardFooter} pointerEvents="none">
                      <View style={styles.dayActionBar}>
                        <Text style={styles.dayActionText}>{t('addExercises')}</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>

        {/* Footer Buttons */}
        <View style={[styles.stickyFooter, { paddingBottom: insets.bottom || 32 }]}>
          <View style={styles.footerButtonsRow}>
            <TouchableOpacity
              style={styles.backFooterButton}
              onPress={handleBack}
              activeOpacity={1}
            >
              <Text style={styles.backFooterButtonText}>{t('back')}</Text>
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
                {t('continue')}
              </Text>
            </TouchableOpacity>
          </View>
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
  dayCard: {
    backgroundColor: CARDS.cardDeep.outer.backgroundColor,
    borderRadius: CARDS.cardDeep.outer.borderRadius,
    borderCurve: CARDS.cardDeep.outer.borderCurve,
    overflow: CARDS.cardDeep.outer.overflow,
    marginBottom: SPACING.md,
  },
  dayCardInner: {
    ...CARDS.cardDeep.inner,
    paddingHorizontal: 4,
    paddingTop: 16,
    paddingBottom: 4,
  },
  dayCardContent: {
    paddingHorizontal: 20,
  },
  dayCardContentWithAction: {
    paddingBottom: 16,
  },
  dayCardContentComplete: {
    paddingBottom: 16,
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  dayCardFooter: {
    marginTop: 'auto',
  },
  dayLabel: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    flex: 1,
  },
  dayName: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: 8,
  },
  exerciseCount: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  dayActionText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
    textAlign: 'left',
  },
  dayActionBar: {
    width: '100%',
    height: 48,
    backgroundColor: COLORS.accentPrimaryDimmed,
    paddingHorizontal: 20,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  dayCheckIcon: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
    flex: 1,
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

