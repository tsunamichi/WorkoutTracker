import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconAdd, IconImport } from './icons';
import { BottomDrawer } from './common/BottomDrawer';
import { useTranslation } from '../i18n/useTranslation';
import { WorkoutTemplate } from '../types/training';
import dayjs from 'dayjs';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../theme/useAppTheme';

// Dark theme colors
const LIGHT_COLORS = {
  secondary: '#FFFFFF',
  textMeta: '#8E8E93',
};

interface LatestCycleInfo {
  planId: string;
  planName: string;
  workoutCount: number;
  weeks: number;
  templateNames: string[];
  finishedLabel: string;
}

interface AddWorkoutSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: string; // YYYY-MM-DD
  workoutTemplates: WorkoutTemplate[]; // Existing templates to schedule
  onSelectTemplate: (templateId: string) => void;
  onCreateBlank: () => void;
  onCreateWithAI: () => void;
  latestCycleInfo?: LatestCycleInfo | null;
  onRepeatCycle?: () => void;
}

/**
 * AddWorkoutSheet
 * 
 * Shows existing workout templates + create options
 * Part 1: Existing templates to schedule
 * Part 2: Create new workout options (Blank, AI, Template)
 */
export function AddWorkoutSheet({
  visible,
  onClose,
  selectedDate,
  workoutTemplates,
  onSelectTemplate,
  onCreateBlank,
  onCreateWithAI,
  latestCycleInfo,
  onRepeatCycle,
}: AddWorkoutSheetProps) {
  const { t } = useTranslation();
  const { colors: themeColors } = useAppTheme();
  const dateLabel = dayjs(selectedDate).format('MMM D');

  const styles = useMemo(
    () =>
      StyleSheet.create({
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
        scrollView: {
          flex: 1,
        },
        scrollContent: {
          paddingBottom: 24,
        },
        createOptionsSection: {
          gap: SPACING.md,
          marginBottom: SPACING.md,
        },
        optionsRow: {
          flexDirection: 'row',
          gap: SPACING.md,
        },
        optionCard: {
          flex: 1,
          backgroundColor: themeColors.activeCard,
          borderRadius: BORDER_RADIUS.lg,
        },
        optionCardInner: {
          padding: SPACING.lg,
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: SPACING.sm,
        },
        repeatCycleButton: {
          backgroundColor: themeColors.accentPrimaryDimmed,
          borderRadius: BORDER_RADIUS.md,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          paddingVertical: SPACING.lg,
          paddingHorizontal: 24,
        },
        repeatCycleTitle: {
          ...TYPOGRAPHY.bodyBold,
          color: themeColors.accentPrimary,
        },
        repeatCycleName: {
          ...TYPOGRAPHY.meta,
          color: themeColors.text,
          marginTop: 4,
          textAlign: 'center',
        },
        repeatCycleSubtitle: {
          ...TYPOGRAPHY.meta,
          color: themeColors.accentPrimary,
          opacity: 0.7,
          marginTop: 4,
        },
        optionTitle: {
          ...TYPOGRAPHY.bodyBold,
          color: themeColors.text,
        },
        optionSubtitle: {
          ...TYPOGRAPHY.meta,
          color: themeColors.textMeta,
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
          color: themeColors.text,
          fontWeight: '600',
          marginBottom: 4,
        },
        templateSubtitle: {
          ...TYPOGRAPHY.meta,
          color: themeColors.textMeta,
        },
        templateCreationCard: {
          backgroundColor: themeColors.activeCard,
          borderRadius: BORDER_RADIUS.lg,
          borderWidth: 1,
          borderColor: themeColors.border,
          marginBottom: SPACING.md,
        },
        templateCreationCardInner: {
          padding: SPACING.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: SPACING.lg,
        },
        templateCreationTitle: {
          ...TYPOGRAPHY.bodyBold,
          color: themeColors.text,
          marginBottom: 4,
        },
      }),
    [themeColors]
  );

  return (
    <BottomDrawer visible={visible} onClose={onClose} maxHeight="80%">
      <View style={styles.container}>
        <Text style={styles.title}>{t('addWorkoutFor')} {dateLabel}</Text>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Part 1: Create Options */}
          <View style={styles.createOptionsSection}>
            <View style={styles.optionsRow}>
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
                  <IconAdd size={24} color={themeColors.text} />
                  <Text style={styles.optionTitle}>{t('blankWorkout')}</Text>
                </View>
              </TouchableOpacity>

              {/* AI Generation */}
              <TouchableOpacity
                style={styles.optionCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onCreateWithAI();
                }}
                activeOpacity={0.85}
              >
                <View style={styles.optionCardInner}>
                  <IconImport size={24} color={themeColors.text} />
                  <Text style={styles.optionTitle}>{t('generateWithAI')}</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Repeat Latest Cycle */}
            {latestCycleInfo && onRepeatCycle && (
              <TouchableOpacity
                style={styles.repeatCycleButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onRepeatCycle();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.repeatCycleTitle}>{t('repeatCycle')}</Text>
                <Text style={styles.repeatCycleSubtitle}>
                  {latestCycleInfo.weeks} {latestCycleInfo.weeks === 1 ? 'Week' : 'Weeks'} · {latestCycleInfo.workoutCount} {t('workoutsCountLabel')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

        </ScrollView>
      </View>
    </BottomDrawer>
  );
}