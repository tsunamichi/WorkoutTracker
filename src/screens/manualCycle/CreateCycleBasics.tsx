import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCreateCycleDraftStore } from '../../store/useCreateCycleDraftStore';
import { DAY_ORDER, Weekday } from '../../types/manualCycle';
import { formatWeekdayFull } from '../../utils/manualCycleUtils';
import { IconAddLine, IconMinusLine, IconClose } from '../../components/icons';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../constants';
import { useTranslation } from '../../i18n/useTranslation';
import dayjs from 'dayjs';

interface CreateCycleBasicsProps {
  navigation: any;
  route?: {
    params?: {
      selectedDate?: string; // YYYY-MM-DD
    };
  };
}

export function CreateCycleBasics({ navigation, route }: CreateCycleBasicsProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const {
    weeks,
    frequencyDays,
    setWeeks,
    toggleFrequencyDay,
    setDaysPerWeek,
    ensureWorkoutsForSelectedDays,
    isBasicsValid,
    resetDraft,
    initializeWithSelectedDate,
  } = useCreateCycleDraftStore();

  // Initialize draft store on mount
  useEffect(() => {
    const selectedDate = route?.params?.selectedDate;
    
    if (selectedDate) {
      // Initialize with selected date (this resets everything and sets the weekday)
      initializeWithSelectedDate(selectedDate);
    } else {
      // No selected date - reset to defaults
      resetDraft();
    }
    
    // Cleanup on unmount
    return () => {
      resetDraft();
    };
  }, []);

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
            onPress={() => {
              resetDraft();
              navigation.goBack();
            }}
            style={styles.backButton}
            activeOpacity={1}
          >
            <IconClose size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>{t('createCycle')}</Text>
            {(() => {
              const progress = 1 / 4;
              return (
                <View style={styles.progressIndicator}>
                  <Text style={styles.progressText}>1/4</Text>
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
          {/* Days Per Week */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('daysPerWeek')}</Text>
            <Text style={styles.sectionSubtitle}>Workouts will be scheduled consecutively from your start date</Text>
            <View style={styles.stepper}>
              <View style={styles.stepperValue}>
                <View style={styles.stepperValueRow}>
                  <Text style={styles.stepperNumber}>{frequencyDays.length}</Text>
                  <Text style={styles.stepperLabel}>{frequencyDays.length === 1 ? 'day' : 'days'}</Text>
                </View>
              </View>
              <View style={styles.stepperControls}>
                <TouchableOpacity
                  style={[styles.adjustButtonTapTarget, frequencyDays.length <= 1 && styles.adjustButtonDisabled]}
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
                  style={[styles.adjustButtonTapTarget, frequencyDays.length >= 7 && styles.adjustButtonDisabled]}
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
                  style={[styles.adjustButtonTapTarget, weeks <= 1 && styles.adjustButtonDisabled]}
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
                  style={[styles.adjustButtonTapTarget, weeks >= 12 && styles.adjustButtonDisabled]}
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
        </ScrollView>

        {/* Continue Button */}
        <View style={[styles.stickyFooter, { paddingBottom: insets.bottom || 32 }]}>
          <View style={styles.footerButtonsRow}>
            <TouchableOpacity
              style={styles.backFooterButton}
              onPress={() => navigation.goBack()}
              disabled={true}
              activeOpacity={1}
            >
              <Text style={[styles.backFooterButtonText, styles.backFooterButtonTextDisabled]}>
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
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayChip: {
    backgroundColor: COLORS.activeCard,
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 60,
    flexBasis: '47%',
    maxWidth: '47%',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
  },
  dayChipLeft: {
    marginRight: 20,
  },
  dayChipSelected: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  dayChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'left',
    width: '100%',
  },
  dayChipTextSelected: {
    color: COLORS.backgroundCanvas,
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
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
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
    fontWeight: '600',
    color: COLORS.backgroundCanvas,
  },
  continueButtonTextDisabled: {
    color: COLORS.textMeta,
  },
});

