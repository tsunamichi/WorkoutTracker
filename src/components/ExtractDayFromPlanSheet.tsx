import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconCheck } from './icons';
import { BottomDrawer } from './common/BottomDrawer';
import { useTranslation } from '../i18n/useTranslation';
import { CyclePlan, WorkoutTemplate } from '../types/training';
import * as Haptics from 'expo-haptics';

// Dark theme colors
const LIGHT_COLORS = {
  secondary: '#FFFFFF',
  textMeta: '#8E8E93',
};

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface ExtractDayFromPlanSheetProps {
  visible: boolean;
  onClose: () => void;
  plan: CyclePlan | null;
  workoutTemplates: WorkoutTemplate[];
  onSelectDay: (templateId: string, templateName: string) => void;
}

/**
 * ExtractDayFromPlanSheet
 * 
 * Allows user to:
 * 1. See which days of the week have workouts in the selected plan
 * 2. Select one day
 * 3. Extract that workout to schedule it individually
 */
export function ExtractDayFromPlanSheet({
  visible,
  onClose,
  plan,
  workoutTemplates,
  onSelectDay,
}: ExtractDayFromPlanSheetProps) {
  const { t } = useTranslation();
  const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null);

  if (!plan) return null;

  // Get list of days that have workouts in this plan
  const workoutDays = Object.entries(plan.templateIdsByWeekday)
    .map(([weekdayStr, templateId]) => ({
      weekday: parseInt(weekdayStr),
      templateId: templateId!,
      template: workoutTemplates.find(t => t.id === templateId),
    }))
    .filter(day => day.template) // Only include days where we found the template
    .sort((a, b) => a.weekday - b.weekday); // Sort Monday to Sunday

  const handleSelectDay = (weekday: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedWeekday(weekday);
  };

  const handleExtract = () => {
    if (selectedWeekday === null) return;
    
    const selectedDay = workoutDays.find(d => d.weekday === selectedWeekday);
    if (!selectedDay || !selectedDay.template) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelectDay(selectedDay.templateId, selectedDay.template.name);
  };

  const handleClose = () => {
    setSelectedWeekday(null);
    onClose();
  };

  return (
    <BottomDrawer visible={visible} onClose={handleClose} maxHeight="70%">
      <View style={styles.container}>
        <Text style={styles.title}>{t('selectDayFromPlan')}</Text>
        <Text style={styles.subtitle}>{plan.name}</Text>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {workoutDays.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('noDaysInPlan')}</Text>
            </View>
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('workoutDays')}</Text>
              </View>

              {workoutDays.map((day) => {
                const isSelected = selectedWeekday === day.weekday;
                const weekdayName = WEEKDAY_NAMES[day.weekday] || 'Unknown';
                
                return (
                  <TouchableOpacity
                    key={day.weekday}
                    style={[
                      styles.dayCard,
                      isSelected && styles.dayCardSelected
                    ]}
                    onPress={() => handleSelectDay(day.weekday)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.dayCardInner}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dayName}>{weekdayName}</Text>
                        <Text style={styles.workoutName}>{day.template!.name}</Text>
                        <Text style={styles.exerciseCount}>
                          {day.template!.items.length} {day.template!.items.length === 1 ? t('exercise') : t('exercises')}
                        </Text>
                      </View>
                      {isSelected && (
                        <View style={styles.selectedBadge}>
                          <IconCheck size={16} color={COLORS.backgroundCanvas} />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {selectedWeekday !== null && (
                <TouchableOpacity
                  style={styles.extractButton}
                  onPress={handleExtract}
                  activeOpacity={0.85}
                >
                  <Text style={styles.extractButtonText}>{t('scheduleThisWorkout')}</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </BottomDrawer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
    marginBottom: SPACING.xl,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    // paddingBottom handled by BottomDrawer
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
  sectionHeader: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayCard: {
    backgroundColor: CARDS.cardDeepDimmed.outer.backgroundColor,
    borderRadius: CARDS.cardDeepDimmed.outer.borderRadius,
    borderCurve: CARDS.cardDeepDimmed.outer.borderCurve,
    borderWidth: CARDS.cardDeepDimmed.outer.borderWidth,
    borderColor: CARDS.cardDeepDimmed.outer.borderColor,
    overflow: CARDS.cardDeepDimmed.outer.overflow,
    marginBottom: SPACING.md,
  },
  dayCardSelected: {
    borderColor: COLORS.accentPrimary,
    borderWidth: 2,
  },
  dayCardInner: {
    ...CARDS.cardDeepDimmed.inner,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayName: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    marginBottom: 4,
  },
  workoutName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    marginBottom: 2,
  },
  exerciseCount: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  selectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extractButton: {
    height: 56,
    backgroundColor: COLORS.accentPrimary,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xl,
  },
  extractButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    color: COLORS.backgroundCanvas,
  },
});
