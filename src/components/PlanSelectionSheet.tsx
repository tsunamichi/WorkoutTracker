import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconCalendar } from './icons';
import { BottomDrawer } from './common/BottomDrawer';
import { useTranslation } from '../i18n/useTranslation';
import { CyclePlan } from '../types/training';
import dayjs from 'dayjs';
import * as Haptics from 'expo-haptics';

// Light theme colors
const LIGHT_COLORS = {
  secondary: '#1B1B1B',
  textMeta: '#817B77',
};

interface PlanSelectionSheetProps {
  visible: boolean;
  onClose: () => void;
  cyclePlans: CyclePlan[];
  onSelectPlan: (planId: string, startDate: string) => void;
}

/**
 * PlanSelectionSheet
 * 
 * Allows user to:
 * 1. Select a cycle plan
 * 2. Choose a start date
 * 3. Preview plan details
 * 4. Apply the plan (which may trigger conflict resolution)
 */
export function PlanSelectionSheet({
  visible,
  onClose,
  cyclePlans,
  onSelectPlan,
}: PlanSelectionSheetProps) {
  const { t } = useTranslation();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Filter to only show active, non-archived plans
  const availablePlans = cyclePlans.filter(p => p.active && !p.archivedAt);

  const selectedPlan = availablePlans.find(p => p.id === selectedPlanId);

  const handleSelectPlan = (planId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPlanId(planId);
  };

  const handleDateChange = (_event: any, date?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowDatePicker(false);
    }
    if (date) {
      setStartDate(date);
    }
  };

  const handleApply = () => {
    if (!selectedPlanId) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const dateStr = dayjs(startDate).format('YYYY-MM-DD');
    onSelectPlan(selectedPlanId, dateStr);
  };

  const handleClose = () => {
    setSelectedPlanId(null);
    setStartDate(new Date());
    onClose();
  };

  return (
    <BottomDrawer visible={visible} onClose={handleClose} maxHeight="80%">
      <View style={styles.container}>
        <Text style={styles.title}>{t('selectPlan')}</Text>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Plan Selection */}
          {availablePlans.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('noPlansAvailable')}</Text>
            </View>
          ) : (
            <>
              {availablePlans.map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                const workoutsPerWeek = Object.keys(plan.templateIdsByWeekday).length;
                
                return (
                  <TouchableOpacity
                    key={plan.id}
                    style={[
                      styles.planCard,
                      isSelected && styles.planCardSelected
                    ]}
                    onPress={() => handleSelectPlan(plan.id)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.planCardInner}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planTitle}>{plan.name}</Text>
                        <Text style={styles.planSubtitle}>
                          {plan.weeks} {plan.weeks === 1 ? t('week') : t('weeks')} • {workoutsPerWeek} {t('perWeek')}
                        </Text>
                      </View>
                      {isSelected && (
                        <View style={styles.selectedBadge}>
                          <View style={styles.selectedBadgeInner} />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* Start Date Selector (only show if plan selected) */}
          {selectedPlan && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('startDate')}</Text>
              </View>

              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowDatePicker(true);
                }}
                activeOpacity={0.85}
              >
                <View style={styles.dateButtonInner}>
                  <IconCalendar size={20} color={COLORS.text} />
                  <Text style={styles.dateButtonText}>
                    {dayjs(startDate).format('dddd, MMMM D, YYYY')}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Plan Summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>{t('planSummary')}</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('duration')}:</Text>
                  <Text style={styles.summaryValue}>
                    {selectedPlan.weeks} {selectedPlan.weeks === 1 ? t('week') : t('weeks')}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('workoutsPerWeek')}:</Text>
                  <Text style={styles.summaryValue}>
                    {Object.keys(selectedPlan.templateIdsByWeekday).length}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('startDate')}:</Text>
                  <Text style={styles.summaryValue}>
                    {dayjs(startDate).format('MMM D, YYYY')}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('endDate')}:</Text>
                  <Text style={styles.summaryValue}>
                    {dayjs(startDate).add(selectedPlan.weeks, 'week').subtract(1, 'day').format('MMM D, YYYY')}
                  </Text>
                </View>
              </View>

              {/* Apply Button */}
              <TouchableOpacity
                style={styles.applyButton}
                onPress={handleApply}
                activeOpacity={0.85}
              >
                <Text style={styles.applyButtonText}>{t('applyPlan')}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        {/* Date Picker Modal */}
        {showDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}
      </View>
    </BottomDrawer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.xxl,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xl,
  },
  emptyState: {
    paddingVertical: SPACING.xxxl,
    alignItems: 'center',
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
    textAlign: 'center',
  },
  planCard: {
    backgroundColor: CARDS.cardDeepDimmed.outer.backgroundColor,
    borderRadius: CARDS.cardDeepDimmed.outer.borderRadius,
    borderCurve: CARDS.cardDeepDimmed.outer.borderCurve,
    borderWidth: CARDS.cardDeepDimmed.outer.borderWidth,
    borderColor: CARDS.cardDeepDimmed.outer.borderColor,
    overflow: CARDS.cardDeepDimmed.outer.overflow,
    marginBottom: SPACING.md,
  },
  planCardSelected: {
    borderColor: COLORS.accentPrimary,
    borderWidth: 2,
  },
  planCardInner: {
    ...CARDS.cardDeepDimmed.inner,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  planTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  planSubtitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  selectedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.backgroundCanvas,
  },
  sectionHeader: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateButton: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.xl,
  },
  dateButtonInner: {
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  dateButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: COLORS.accentPrimaryDimmed,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.accentPrimary,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  summaryTitle: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  summaryLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  summaryValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
  },
  applyButton: {
    height: 56,
    backgroundColor: COLORS.accentPrimary,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    color: COLORS.backgroundCanvas,
  },
});
