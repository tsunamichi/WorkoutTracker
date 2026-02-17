import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconArrowLeft } from '../components/icons';
import { useTranslation } from '../i18n/useTranslation';
import { useStore } from '../store';
import type { ConflictItem, CyclePlan, CycleConflictResolution, ConflictResolutionMap } from '../types/training';
import dayjs from 'dayjs';

interface CycleConflictsScreenProps {
  navigation: any;
  route: {
    params: {
      plan: CyclePlan;
      conflicts: ConflictItem[];
      planId?: string;
    };
  };
}

export function CycleConflictsScreen({ navigation, route }: CycleConflictsScreenProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { addCyclePlan, applyCyclePlan, cyclePlans } = useStore();
  const { plan, conflicts, planId } = route.params;
  
  const [selectedResolution, setSelectedResolution] = useState<CycleConflictResolution>('replace');
  const [isApplying, setIsApplying] = useState(false);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleApply = async () => {
    if (isApplying) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Cancel: just go back without doing anything
    if (selectedResolution === 'cancel') {
      navigation.goBack();
      return;
    }

    setIsApplying(true);

    try {
      let result;

      if (planId) {
        // applyCyclePlan expects a per-date ConflictResolutionMap
        const resolutionMap: ConflictResolutionMap = {};
        for (const conflict of conflicts) {
          resolutionMap[conflict.date] = selectedResolution === 'replace' ? 'replace' : 'keep';
        }
        result = await applyCyclePlan(planId, resolutionMap);
      } else {
        // addCyclePlan accepts the simple resolution string
        result = await addCyclePlan(plan, selectedResolution);
      }
      
      if (result.success) {
        navigation.navigate('Tabs', { 
          initialTab: 'Schedule',
          params: { 
            showToast: true,
            toastMessage: t('planAppliedSuccessfully')
          }
        });
      } else {
        Alert.alert(t('error'), t('failedToApplyPlan'));
        setIsApplying(false);
      }
    } catch (error) {
      console.error('Error applying plan:', error);
      Alert.alert(t('error'), t('failedToApplyPlan'));
      setIsApplying(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return dayjs(dateStr).format('ddd, MMM D');
  };

  return (
    <View style={styles.gradient}>
      <SafeAreaView style={styles.container} edges={[]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              activeOpacity={1}
            >
              <IconArrowLeft size={24} color={COLORS.text} />
            </TouchableOpacity>
            <View style={{ width: 48 }} />
          </View>
          <View style={styles.pageTitleContainer}>
            <Text style={styles.pageTitle}>{t('conflictsFound')}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
        >
          {/* Description */}
          <Text style={styles.description}>
            {t('conflictsDescription').replace('{n}', conflicts.length.toString())}
          </Text>

          {/* Conflicts List */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('conflictingWorkouts')}</Text>
            {conflicts.map((conflict, index) => (
              <View key={conflict.date} style={[styles.conflictCard, index !== 0 && styles.conflictCardMargin]}>
                <View style={styles.conflictCardInner}>
                  <View>
                    <Text style={styles.conflictDate}>{formatDate(conflict.date)}</Text>
                    <Text style={styles.conflictWorkoutName}>{conflict.existing.titleSnapshot}</Text>
                  </View>
                  <View style={styles.sourceBadge}>
                    <Text style={styles.sourceBadgeText}>
                      {conflict.existing.source === 'manual' ? t('manual') : t('cycle')}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Resolution Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('howToResolve')}</Text>
            
            {/* Replace */}
            <TouchableOpacity
              style={[
                styles.resolutionOption,
                selectedResolution === 'replace' && styles.resolutionOptionSelected
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedResolution('replace');
              }}
              activeOpacity={0.7}
            >
              <View style={styles.resolutionOptionInner}>
                <View style={styles.radio}>
                  {selectedResolution === 'replace' && <View style={styles.radioSelected} />}
                </View>
                <View style={styles.resolutionContent}>
                  <Text style={styles.resolutionTitle}>{t('replaceConflicting')}</Text>
                  <Text style={styles.resolutionDescription}>{t('replaceConflictingDesc')}</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Keep */}
            <TouchableOpacity
              style={[
                styles.resolutionOption,
                selectedResolution === 'keep' && styles.resolutionOptionSelected
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedResolution('keep');
              }}
              activeOpacity={0.7}
            >
              <View style={styles.resolutionOptionInner}>
                <View style={styles.radio}>
                  {selectedResolution === 'keep' && <View style={styles.radioSelected} />}
                </View>
                <View style={styles.resolutionContent}>
                  <Text style={styles.resolutionTitle}>{t('keepExisting')}</Text>
                  <Text style={styles.resolutionDescription}>{t('keepExistingDesc')}</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
              style={[
                styles.resolutionOption,
                selectedResolution === 'cancel' && styles.resolutionOptionSelected
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedResolution('cancel');
              }}
              activeOpacity={0.7}
            >
              <View style={styles.resolutionOptionInner}>
                <View style={styles.radio}>
                  {selectedResolution === 'cancel' && <View style={styles.radioSelected} />}
                </View>
                <View style={styles.resolutionContent}>
                  <Text style={styles.resolutionTitle}>{t('cancelPlan')}</Text>
                  <Text style={styles.resolutionDescription}>{t('cancelPlanDesc')}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Footer Note */}
          <Text style={styles.footerNote}>{t('conflictFooterNote')}</Text>
        </ScrollView>

        {/* Apply Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom || SPACING.lg }]}>
          <TouchableOpacity
            style={[styles.applyButton, isApplying && styles.applyButtonDisabled]}
            onPress={handleApply}
            disabled={isApplying}
            activeOpacity={0.8}
          >
            <Text style={styles.applyButtonText}>
              {selectedResolution === 'cancel' ? t('goBack') : t('applyPlan')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
    paddingBottom: SPACING.lg,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  backButton: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -4,
  },
  pageTitleContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  pageTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.xxl,
    paddingBottom: 140,
  },
  description: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    marginBottom: SPACING.xxxl,
  },
  section: {
    marginBottom: SPACING.xxxl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: SPACING.lg,
  },
  conflictCard: {
    ...CARDS.cardDeep.outer,
  },
  conflictCardMargin: {
    marginTop: SPACING.md,
  },
  conflictCardInner: {
    ...CARDS.cardDeep.inner,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  conflictDate: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.textMeta,
    marginBottom: SPACING.xs,
  },
  conflictWorkoutName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  sourceBadge: {
    backgroundColor: COLORS.backgroundCanvas,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  sourceBadgeText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  resolutionOption: {
    ...CARDS.cardDeep.outer,
    marginBottom: SPACING.md,
  },
  resolutionOptionSelected: {
    borderColor: COLORS.accentPrimary,
    borderWidth: 2,
  },
  resolutionOptionInner: {
    ...CARDS.cardDeep.inner,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.accentPrimary,
  },
  resolutionContent: {
    flex: 1,
  },
  resolutionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  resolutionDescription: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  footerNote: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.backgroundCanvas,
  },
  applyButton: {
    backgroundColor: COLORS.accentPrimary,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  applyButtonDisabled: {
    opacity: 0.5,
  },
  applyButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.backgroundCanvas,
  },
});
