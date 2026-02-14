import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconAdd, IconWorkouts, IconCalendar } from './icons';
import { BottomDrawer } from './common/BottomDrawer';
import { useTranslation } from '../i18n/useTranslation';
import { WorkoutTemplate, CyclePlan } from '../types/training';
import dayjs from 'dayjs';
import * as Haptics from 'expo-haptics';

// Dark theme colors
const LIGHT_COLORS = {
  secondary: '#FFFFFF',
  textMeta: '#8E8E93',
};

interface WorkoutSourceSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: string; // YYYY-MM-DD
  workoutTemplates: WorkoutTemplate[]; // Already sorted by lastUsedAt
  cyclePlans: CyclePlan[]; // For extracting single day
  onCreateBlank: () => void;
  onSelectTemplate: (templateId: string) => void;
  onSelectFromPlan: (planId: string) => void;
  onCreateWithAI: () => void;
  onCreateTemplate: () => void; // NEW: Create template without scheduling
}

/**
 * WorkoutSourceSheet
 * 
 * Per Product Spec - Create → Workout starting points:
 * - Blank workout
 * - From existing workout template
 * - From existing plan/cycle template (extracts a single day)
 * - Create with AI
 */
export function WorkoutSourceSheet({
  visible,
  onClose,
  selectedDate,
  workoutTemplates,
  cyclePlans,
  onCreateBlank,
  onSelectTemplate,
  onSelectFromPlan,
  onCreateWithAI,
  onCreateTemplate,
}: WorkoutSourceSheetProps) {
  const { t } = useTranslation();
  const dateLabel = dayjs(selectedDate).format('MMM D');

  return (
    <BottomDrawer visible={visible} onClose={onClose} maxHeight="80%">
      <View style={styles.container}>
        <Text style={styles.title}>{t('createWorkoutFor')} {dateLabel}</Text>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Row: Blank Workout and Create with AI */}
          <View style={styles.optionsContainer}>
            {/* Blank Workout */}
            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onCreateBlank();
              }}
              activeOpacity={0.85}
            >
              <View style={styles.optionCardInner}>
                <IconAdd size={24} color={COLORS.text} />
                <Text style={styles.optionTitle}>{t('blankWorkout')}</Text>
                <Text style={styles.optionSubtitle}>{t('startFromScratch')}</Text>
              </View>
            </TouchableOpacity>

            {/* Create with AI */}
            <TouchableOpacity
              style={styles.aiCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onCreateWithAI();
              }}
              activeOpacity={0.85}
            >
              <View style={styles.optionCardInner}>
                <IconAdd size={24} color={COLORS.accentPrimary} />
                <Text style={[styles.optionTitle, { color: COLORS.accentPrimary }]}>{t('generateWorkout')}</Text>
                <Text style={styles.optionSubtitle}>{t('aiWillCreateWorkout')}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* From Existing Template */}
          {workoutTemplates.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('fromTemplate')}</Text>
              </View>
              
              {workoutTemplates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={styles.templateCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelectTemplate(template.id);
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.templateCardInner}>
                    <View style={styles.templateTextContainer}>
                      <Text style={styles.templateTitle}>{template.name}</Text>
                      <Text style={styles.templateSubtitle}>
                        {template.items.length} {template.items.length === 1 ? t('exercise') : t('exercises')}
                        {template.usageCount > 0 && ` • ${template.usageCount}x`}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* From Plan (extract single day) - Simplified for now */}
          {cyclePlans.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('fromPlan')}</Text>
              </View>
              
              {cyclePlans.slice(0, 3).map((plan) => (
                <TouchableOpacity
                  key={plan.id}
                  style={styles.templateCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelectFromPlan(plan.id);
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.templateCardInner}>
                    <View style={styles.templateTextContainer}>
                      <Text style={styles.templateTitle}>{plan.name}</Text>
                      <Text style={styles.templateSubtitle}>
                        {plan.weeks} {t('week')}s • {Object.keys(plan.templateIdsByWeekday).length} workouts/week
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Section: Create Template (for library only) */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('createTemplate')}</Text>
          </View>
          
          <TouchableOpacity
            style={styles.templateCreationCard}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onCreateTemplate();
            }}
            activeOpacity={0.85}
          >
            <View style={styles.optionCardInner}>
              <IconAdd size={24} color={COLORS.text} />
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>{t('newTemplate')}</Text>
                <Text style={styles.optionSubtitle}>{t('saveToLibraryOnly')}</Text>
              </View>
            </View>
          </TouchableOpacity>
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
    marginBottom: SPACING.xxl,
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
  optionsContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  optionCard: {
    flex: 1,
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.lg,
  },
  aiCard: {
    flex: 1,
    backgroundColor: COLORS.accentPrimaryDimmed,
    borderRadius: BORDER_RADIUS.lg,
  },
  optionCardInner: {
    padding: SPACING.lg,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  optionTitle: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    marginBottom: 4,
  },
  optionSubtitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
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
  templateCard: {
    backgroundColor: CARDS.cardDeepDimmed.outer.backgroundColor,
    borderRadius: CARDS.cardDeepDimmed.outer.borderRadius,
    borderCurve: CARDS.cardDeepDimmed.outer.borderCurve,
    borderWidth: CARDS.cardDeepDimmed.outer.borderWidth,
    borderColor: CARDS.cardDeepDimmed.outer.borderColor,
    overflow: CARDS.cardDeepDimmed.outer.overflow,
    marginBottom: SPACING.sm,
  },
  templateCardInner: {
    ...CARDS.cardDeepDimmed.inner,
    padding: SPACING.lg,
  },
  templateTextContainer: {
    flex: 1,
  },
  templateTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  templateSubtitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  templateCreationCard: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  optionTextContainer: {
    flex: 1,
  },
});
