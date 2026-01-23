import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconAdd, IconWorkouts, IconCalendar, IconClose } from '../components/icons';
import { useStore } from '../store';
import { useTranslation } from '../i18n/useTranslation';

// Light theme colors
const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  secondary: '#1B1B1B',
  textMeta: '#817B77',
  border: '#C7C7CC',
  accentPrimary: '#FD6B00',
  buttonBg: '#F2F2F7',
};

export function WorkoutsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { settings, workoutTemplates } = useStore();
  const { t } = useTranslation();
  
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showCreateSheet) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 20,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [showCreateSheet]);

  const handleCreatePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCreateSheet(true);
  };

  const handleCloseSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCreateSheet(false);
  };

  const handleSingleWorkout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowCreateSheet(false);
    (navigation as any).navigate('WorkoutBuilder');
  };

  const handleWeeklyPlan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowCreateSheet(false);
    // TODO: Navigate to plan setup
    (navigation as any).navigate('CreateCycleBasics');
  };

  const handleCreateWithAI = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowCreateSheet(false);
    // TODO: Navigate to AI creation
    (navigation as any).navigate('AIWorkoutCreation');
  };

  const handleTemplatePress = (templateId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    (navigation as any).navigate('WorkoutTemplateDetail', { templateId });
  };

  return (
    <View style={styles.gradient}>
      <SafeAreaView style={[styles.container, { paddingBottom: 88 }]} edges={[]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.topBar}>
            <Text style={styles.headerTitle}>{t('workouts')}</Text>
            <View style={styles.headerRight}>
              <ProfileAvatar 
                onPress={() => (navigation as any).navigate('Profile')}
                size={40}
                backgroundColor="#9E9E9E"
                textColor="#FFFFFF"
                showInitial={true}
                imageUri={settings.profileAvatarUri || null}
              />
            </View>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Primary Create Button */}
          <TouchableOpacity
            style={styles.primaryCreateButton}
            onPress={handleCreatePress}
            activeOpacity={0.8}
          >
            <IconAdd size={24} color={COLORS.backgroundCanvas} />
            <Text style={styles.primaryCreateButtonText}>{t('create')}</Text>
          </TouchableOpacity>

          {/* Templates Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('templates')}</Text>
            
            {workoutTemplates.length === 0 ? (
              <View style={styles.emptyState}>
                <IconWorkouts size={48} color={LIGHT_COLORS.textMeta} />
                <Text style={styles.emptyStateTitle}>{t('noTemplatesYet')}</Text>
                <Text style={styles.emptyStateSubtitle}>{t('createYourFirstWorkout')}</Text>
              </View>
            ) : (
              workoutTemplates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={styles.templateCard}
                  onPress={() => handleTemplatePress(template.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.templateCardInner}>
                    <View style={styles.templateCardContent}>
                      <Text style={styles.templateCardTitle}>{template.name}</Text>
                      <Text style={styles.templateCardSubtitle}>
                        {template.items.length} {template.items.length === 1 ? t('exercise') : t('exercises')}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Create Sheet Modal */}
        <Modal
          visible={showCreateSheet}
          transparent
          animationType="fade"
          onRequestClose={handleCloseSheet}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity 
              style={styles.modalBackdrop} 
              activeOpacity={1} 
              onPress={handleCloseSheet}
            />
            <Animated.View 
              style={[
                styles.sheetContainer, 
                { 
                  paddingBottom: insets.bottom || 16,
                  transform: [{
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [400, 0],
                    })
                  }]
                }
              ]}
            >
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{t('selectCreationType')}</Text>
                <TouchableOpacity onPress={handleCloseSheet} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <IconClose size={24} color={LIGHT_COLORS.secondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.sheetOptions}>
                {/* Top Row: Single Workout & Weekly Plan */}
                <View style={styles.sheetRow}>
                  <TouchableOpacity
                    style={styles.sheetOption}
                    onPress={handleSingleWorkout}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sheetOptionInner}>
                      <IconWorkouts size={24} color={LIGHT_COLORS.accentPrimary} />
                      <Text style={styles.sheetOptionTitle}>{t('singleWorkout')}</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.sheetOption}
                    onPress={handleWeeklyPlan}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sheetOptionInner}>
                      <IconCalendar size={24} color={LIGHT_COLORS.accentPrimary} />
                      <Text style={styles.sheetOptionTitle}>{t('weeklyPlan')}</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Bottom Row: Create with AI */}
                <TouchableOpacity
                  style={styles.sheetOptionFull}
                  onPress={handleCreateWithAI}
                  activeOpacity={0.7}
                >
                  <View style={styles.sheetOptionInnerRow}>
                    <Text style={styles.aiIcon}>✨</Text>
                    <Text style={styles.sheetOptionTitle}>{t('createWithAI')}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>
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
    backgroundColor: 'transparent',
  },
  header: {
    marginBottom: SPACING.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
  },
  primaryCreateButton: {
    height: 56,
    backgroundColor: LIGHT_COLORS.secondary,
    borderRadius: BORDER_RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xxxl,
  },
  primaryCreateButtonText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.backgroundCanvas,
  },
  section: {
    marginBottom: SPACING.xxxl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyStateTitle: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.secondary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  emptyStateSubtitle: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
    textAlign: 'center',
  },
  templateCard: {
    backgroundColor: CARDS.cardDeepDimmed.outer.backgroundColor,
    borderRadius: CARDS.cardDeepDimmed.outer.borderRadius,
    borderCurve: CARDS.cardDeepDimmed.outer.borderCurve,
    borderWidth: CARDS.cardDeepDimmed.outer.borderWidth,
    borderColor: CARDS.cardDeepDimmed.outer.borderColor,
    overflow: CARDS.cardDeepDimmed.outer.overflow,
    marginBottom: SPACING.md,
  },
  templateCardInner: {
    ...CARDS.cardDeepDimmed.inner,
    padding: SPACING.lg,
  },
  templateCardContent: {
    flex: 1,
  },
  templateCardTitle: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.xs,
  },
  templateCardSubtitle: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.overlay,
  },
  sheetContainer: {
    marginBottom: 8,
    marginHorizontal: 8,
    backgroundColor: COLORS.backgroundCanvas,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.xxl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  sheetTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
  },
  sheetOptions: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  sheetRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  sheetOption: {
    flex: 1,
    backgroundColor: CARDS.cardDeepDimmed.outer.backgroundColor,
    borderRadius: CARDS.cardDeepDimmed.outer.borderRadius,
    borderCurve: CARDS.cardDeepDimmed.outer.borderCurve,
    borderWidth: CARDS.cardDeepDimmed.outer.borderWidth,
    borderColor: CARDS.cardDeepDimmed.outer.borderColor,
    overflow: CARDS.cardDeepDimmed.outer.overflow,
  },
  sheetOptionFull: {
    backgroundColor: CARDS.cardDeepDimmed.outer.backgroundColor,
    borderRadius: CARDS.cardDeepDimmed.outer.borderRadius,
    borderCurve: CARDS.cardDeepDimmed.outer.borderCurve,
    borderWidth: CARDS.cardDeepDimmed.outer.borderWidth,
    borderColor: CARDS.cardDeepDimmed.outer.borderColor,
    overflow: CARDS.cardDeepDimmed.outer.overflow,
  },
  sheetOptionInner: {
    ...CARDS.cardDeepDimmed.inner,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  sheetOptionInnerRow: {
    ...CARDS.cardDeepDimmed.inner,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  sheetOptionTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: LIGHT_COLORS.secondary,
    textAlign: 'center',
  },
  aiIcon: {
    fontSize: 24,
  },
});
