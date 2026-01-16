import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconArrowLeft } from '../components/icons';

export function WorkoutCreationOptionsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
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
        bounces={false}
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
    backgroundColor: COLORS.text,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manuallyButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    color: COLORS.backgroundCanvas,
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
    color: COLORS.backgroundCanvas,
  },
  
  // Templates section removed
});

