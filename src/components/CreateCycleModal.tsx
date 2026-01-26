import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconCheck } from './icons';
import dayjs from 'dayjs';
import { useTranslation } from '../i18n/useTranslation';

interface CreateCycleModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { lengthInWeeks: number; workoutsPerWeek: number; goal: string; startDate: string }) => void;
  cycleNumber: number;
}

const LENGTH_OPTIONS = [4, 6, 8, 12, 16];
const FREQUENCY_OPTIONS = [3, 4, 5, 6];

export function CreateCycleModal({ visible, onClose, onSubmit, cycleNumber }: CreateCycleModalProps) {
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState('');
  const [lengthInWeeks, setLengthInWeeks] = useState(8);
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState(4);
  const { t } = useTranslation();
  
  const handleCreate = () => {
    onSubmit({
      lengthInWeeks,
      workoutsPerWeek,
      goal,
      startDate: dayjs().format('YYYY-MM-DD'),
    });
    // Reset form
    setStep(1);
    setGoal('');
    setLengthInWeeks(8);
    setWorkoutsPerWeek(4);
  };
  
  const handleCancel = () => {
    setStep(1);
    setGoal('');
    onClose();
  };
  
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('createCycleTitle').replace('{number}', String(cycleNumber))}</Text>
            <Text style={styles.subtitle}>
              {t('stepOf').replace('{step}', String(step)).replace('{total}', '3')}
            </Text>
          </View>
          
          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            {[1, 2, 3].map((s) => (
              <View
                key={s}
                style={[
                  styles.progressDot,
                  s <= step && styles.progressDotActive,
                ]}
              />
            ))}
          </View>
          
          <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
            {/* Step 1: Goal */}
            {step === 1 && (
              <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>{t('goalQuestion')}</Text>
                <Text style={styles.stepDescription}>{t('goalDescription')}</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder={t('goalPlaceholder')}
                  placeholderTextColor={COLORS.meta}
                  value={goal}
                  onChangeText={setGoal}
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}
            
            {/* Step 2: Length */}
            {step === 2 && (
              <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>{t('durationQuestion')}</Text>
                <Text style={styles.stepDescription}>{t('durationDescription')}</Text>
                <View style={styles.optionsGrid}>
                  {LENGTH_OPTIONS.map((weeks) => (
                    <TouchableOpacity
                      key={weeks}
                      style={[
                        styles.optionCard,
                        lengthInWeeks === weeks && styles.optionCardActive,
                      ]}
                      onPress={() => setLengthInWeeks(weeks)}
                      activeOpacity={1}
                    >
                      {lengthInWeeks === weeks && (
                        <View style={styles.checkmark}>
                          <IconCheck size={16} color={COLORS.text} />
                        </View>
                      )}
                      <Text style={styles.optionValue}>{weeks}</Text>
                      <Text style={styles.optionLabel}>{t('weeks')}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.endDateText}>
                  {t('endDateLabel').replace('{date}', dayjs().add(lengthInWeeks, 'week').format('MMM D, YYYY'))}
                </Text>
              </View>
            )}
            
            {/* Step 3: Frequency */}
            {step === 3 && (
              <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>{t('trainingFrequencyTitle')}</Text>
                <Text style={styles.stepDescription}>{t('daysPerWeekLabel')}</Text>
                <View style={styles.optionsGrid}>
                  {FREQUENCY_OPTIONS.map((days) => (
                    <TouchableOpacity
                      key={days}
                      style={[
                        styles.optionCard,
                        workoutsPerWeek === days && styles.optionCardActive,
                      ]}
                      onPress={() => setWorkoutsPerWeek(days)}
                      activeOpacity={1}
                    >
                      {workoutsPerWeek === days && (
                        <View style={styles.checkmark}>
                          <IconCheck size={16} color={COLORS.text} />
                        </View>
                      )}
                      <Text style={styles.optionValue}>{days}</Text>
                      <Text style={styles.optionLabel}>{t('daysPerWeekLabel')}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
          
          {/* Actions */}
          <View style={styles.actions}>
            {step > 1 && (
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => setStep(step - 1)}
                activeOpacity={1}
              >
                <Text style={styles.buttonSecondaryText}>{t('back')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary, { flex: 1 }]}
              onPress={step === 3 ? handleCreate : () => setStep(step + 1)}
              activeOpacity={1}
            >
              <Text style={styles.buttonPrimaryText}>
                {step === 3 ? t('createCycle') : t('next')}
              </Text>
            </TouchableOpacity>
            {step === 1 && (
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={handleCancel}
                activeOpacity={1}
              >
                <Text style={styles.buttonSecondaryText}>{t('cancel')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modal: {
    backgroundColor: COLORS.canvas,
    borderRadius: BORDER_RADIUS.lg,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  header: {
    padding: SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.container,
  },
  progressDotActive: {
    backgroundColor: COLORS.primary,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: SPACING.xl,
  },
  stepContainer: {
    gap: SPACING.md,
  },
  stepTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  stepDescription: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  optionCard: {
    flex: 1,
    minWidth: 100,
    aspectRatio: 1,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  optionCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },
  checkmark: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionValue: {
    ...TYPOGRAPHY.h1,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  optionLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  endDateText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDimmed,
  },
  button: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: COLORS.accentPrimaryLight,
    borderLeftColor: COLORS.accentPrimaryLight,
    borderBottomColor: COLORS.accentPrimaryDark,
    borderRightColor: COLORS.accentPrimaryDark,
  },
  buttonPrimaryText: {
    ...TYPOGRAPHY.button,
    color: COLORS.textPrimary,
  },
  buttonSecondary: {
    backgroundColor: COLORS.background,
  },
  buttonSecondaryText: {
    ...TYPOGRAPHY.button,
    color: COLORS.textSecondary,
  },
});


