import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { TEMPLATES } from '../data/templates';
import { IconArrowLeft } from '../components/icons';

export function WorkoutCreationOptionsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { startDraftFromTemplate, setPrefs } = useOnboardingStore();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        {/* Back Button */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <IconArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={styles.pageTitle}>New Workout</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Question Text */}
        <View style={styles.questionSection}>
          <Text style={styles.questionText}>
            <Text style={styles.questionTextGray}>How do you want to{'\n'}</Text>
            <Text style={styles.questionTextBlack}>create a new workout?</Text>
          </Text>
        </View>
        
        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.manuallyButton}
            onPress={() => {
              navigation.navigate('CreateCycleBasics' as never);
            }}
            activeOpacity={1}
          >
            <Text style={styles.manuallyButtonText}>Manually</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.aiButton}
            onPress={() => {
              navigation.navigate('AIWorkoutCreation' as never);
            }}
            activeOpacity={1}
          >
            <Text style={styles.aiButtonText}>With AI help</Text>
          </TouchableOpacity>
        </View>
        
        {/* Templates Section */}
        <View style={styles.templatesSection}>
          <Text style={styles.sectionTitle}>Start with a template</Text>
          
          {TEMPLATES.filter(t => t.id !== 'custom').map((template) => (
            <View key={template.id} style={styles.templateCardBlackShadow}>
              <View style={styles.templateCardWhiteShadow}>
                <View style={styles.templateCard}>
                  <TouchableOpacity
                    style={styles.templateCardContent}
                    onPress={() => {
                      setPrefs({ daysPerWeek: template.idealDays[0] || 3, sessionMinutes: 60 });
                      startDraftFromTemplate(template.id);
                      navigation.navigate('TemplateEditor' as never, { templateId: template.id } as never);
                    }}
                    activeOpacity={1}
                  >
                    <View style={styles.templateCardInner}>
                      <Text style={styles.templateName}>{template.name}</Text>
                      <Text style={styles.templateDescription}>{template.description}</Text>
                    </View>
                    <View style={styles.triangle} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  header: {
    paddingBottom: SPACING.md,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  backButton: {
    // No additional styles needed
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
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },
  
  // Question Section
  questionSection: {
    marginBottom: SPACING.xl,
  },
  questionText: {
    ...TYPOGRAPHY.h3,
    lineHeight: 28,
  },
  questionTextGray: {
    color: COLORS.textMeta,
  },
  questionTextBlack: {
    color: COLORS.text,
  },
  
  // Actions Section
  actionsSection: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: 40,
  },
  manuallyButton: {
    flex: 1,
    height: 56,
    backgroundColor: '#1B1B1B',
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manuallyButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  aiButton: {
    flex: 1,
    height: 56,
    backgroundColor: COLORS.accentPrimary,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  
  // Templates Section
  templatesSection: {
    gap: SPACING.sm,
  },
  sectionTitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: SPACING.sm,
  },
  templateCardBlackShadow: {
    ...CARDS.cardDeep.blackShadow,
    marginBottom: SPACING.xs,
  },
  templateCardWhiteShadow: CARDS.cardDeep.whiteShadow,
  templateCard: CARDS.cardDeep.outer,
  templateCardContent: {
    ...CARDS.cardDeep.inner,
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  templateCardInner: {
    flex: 1,
  },
  templateName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    marginBottom: 4,
  },
  templateDescription: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 0,
    borderTopWidth: 4.5,
    borderBottomWidth: 4.5,
    borderLeftColor: '#000000',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: SPACING.md,
  },
});

