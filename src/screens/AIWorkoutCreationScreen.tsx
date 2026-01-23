import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { useStore } from '../store';
import { IconArrowLeft, IconChevronDown, IconMenu } from '../components/icons';
import { BottomDrawer } from '../components/common/BottomDrawer';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { useTranslation } from '../i18n/useTranslation';

dayjs.extend(isoWeek);

const TEMPLATE_FORMAT = `WEEK [number]
DAY [number] — [Workout name]
[Exercise] — [Sets]×[Reps] @ [weight] lb
[Exercise] — [Sets]×[Time] sec @ [weight] lb (optional)`;

export function AIWorkoutCreationScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { exercises, addExercise, updateExercise, addWorkoutTemplate, addCyclePlan } = useStore();
  const { t } = useTranslation();
  const [workoutDetails, setWorkoutDetails] = useState('');
  const [showInstructionsSheet, setShowInstructionsSheet] = useState(false);

  const mode: 'single' | 'plan' = route?.params?.mode === 'single' ? 'single' : 'plan';

  const handleCopyTemplate = async () => {
    await Clipboard.setStringAsync(TEMPLATE_FORMAT);
    Alert.alert(t('copiedTitle'), t('templateCopied'));
    setShowInstructionsSheet(false);
  };

  const handleCreateFromAiText = async () => {
    try {
      if (!workoutDetails.trim()) {
        Alert.alert(t('alertErrorTitle'), t('enterWorkoutDetails'));
        return;
      }
      const today = dayjs();
      const weekStart = today.startOf('isoWeek'); // Monday
      
      // Parse workout details from user input
      // Expected format:
      // ⭐️ WEEK 1
      // ⸻
      // DAY 1 — Pull
      // • Rear Delt Row — 3×10 @ 100 lb
      // • Spanish Squat ISO — 4×30 sec @ 25 lb (time-based with weight)
      // • Wall Sit — 4×45 sec (time-based without weight)
      // • Barbell Row — 3×10 @ 100 lb
      
      const lines = workoutDetails.split('\n');
      let weeklyWorkouts: { [week: number]: any[] } = {};
      let currentWeek = 1;
      let currentWorkout: any = null;
      
      for (let line of lines) {
        // Clean up the line
        const trimmedLine = line.trim();
        
        // Skip empty lines and separator lines
        if (!trimmedLine || trimmedLine === '⸻' || trimmedLine.startsWith('⸻')) {
          continue;
        }
        
        // Check if this is a week header (e.g., "⭐️ WEEK 1")
        if (trimmedLine.startsWith('⭐️') && trimmedLine.toUpperCase().includes('WEEK')) {
          // Save previous workout if exists
          if (currentWorkout && currentWorkout.exercises.length > 0) {
            if (!weeklyWorkouts[currentWeek]) {
              weeklyWorkouts[currentWeek] = [];
            }
            weeklyWorkouts[currentWeek].push(currentWorkout);
            currentWorkout = null;
          }
          
          // Extract week number
          const weekMatch = trimmedLine.match(/WEEK\s+(\d+)/i);
          if (weekMatch) {
            currentWeek = parseInt(weekMatch[1]);
          }
          continue;
        }
        
        // Check if this is a day header (e.g., "DAY 1 — Pull")
        if (trimmedLine.toUpperCase().startsWith('DAY')) {
          // Save previous workout if exists
          if (currentWorkout && currentWorkout.exercises.length > 0) {
            if (!weeklyWorkouts[currentWeek]) {
              weeklyWorkouts[currentWeek] = [];
            }
            weeklyWorkouts[currentWeek].push(currentWorkout);
          }
          
          // Extract day number and workout name from "DAY X — WorkoutName"
          const dayMatch = trimmedLine.match(/DAY\s+(\d+)/i);
          const dayNumber = dayMatch ? parseInt(dayMatch[1]) : 1;
          
          const parts = trimmedLine.split(/—|-/).map(p => p.trim());
          const workoutName = parts.length > 1 ? parts[parts.length - 1] : parts[0];
          
          currentWorkout = {
            name: workoutName,
            dayNumber: dayNumber,
            week: currentWeek,
            exercises: [],
          };
        } 
        // Check if this is an exercise line (starts with bullet or tab)
        else if (currentWorkout && (trimmedLine.startsWith('•') || trimmedLine.startsWith('\t') || trimmedLine.startsWith('-'))) {
          // Remove bullet point, tabs, and clean
          let exerciseLine = trimmedLine.replace(/^[•\t\s\-]+/, '').trim();
          
          // Parse format: "Exercise Name — Sets×Reps @ Weight lb" or "Exercise Name — Sets×Time sec"
          // Try to split by em dash first, then regular dash
          let exerciseName = '';
          let detailsPart = '';
          
          if (exerciseLine.includes('—')) {
            const dashParts = exerciseLine.split('—').map(p => p.trim());
            exerciseName = dashParts[0];
            detailsPart = dashParts.slice(1).join(' ');
          } else if (exerciseLine.match(/\s+-\s+\d+/)) {
            // Match " - " followed by a number (for sets)
            const dashMatch = exerciseLine.match(/^(.+?)\s+-\s+(.+)$/);
            if (dashMatch) {
              exerciseName = dashMatch[1].trim();
              detailsPart = dashMatch[2].trim();
            }
          }
          
          if (exerciseName && detailsPart) {
            // Parse sets×reps/time (e.g., "3×10 @ 60 lb", "4×8-12 @ 100 lb", or "4×30 sec" for time-based)
            const setsRepsMatch = detailsPart.match(/(\d+)\s*[×x]\s*(\d+)(?:[-–](\d+))?\s*(sec|lb)?/i);
            
            // Parse weight (e.g., "@ 100 lb" or "@ 25 lb")
            const weightMatch = detailsPart.match(/@\s*(\d+(?:\.\d+)?)/);
            
            if (setsRepsMatch) {
              const sets = parseInt(setsRepsMatch[1]);
              const repsMin = parseInt(setsRepsMatch[2]);
              const repsMax = setsRepsMatch[3] ? parseInt(setsRepsMatch[3]) : repsMin;
              const unit = setsRepsMatch[4]?.toLowerCase();
              const isTimeBased = unit === 'sec'; // Check if unit is 'sec'
              const weight = weightMatch ? parseFloat(weightMatch[1]) : 0;
              
              // Find or create exercise in database
              let exerciseData = exercises.find(e => 
                e.name.toLowerCase() === exerciseName.toLowerCase()
              );
              
              // If exercise doesn't exist, create it
              let exerciseId = exerciseData?.id;
              if (!exerciseData) {
                const timestamp = Date.now();
                const random = Math.floor(Math.random() * 10000);
                exerciseId = `exercise-${timestamp}-${random}`;
                const newExercise = {
                  id: exerciseId,
                  name: exerciseName,
                  category: 'Other' as any,
                  equipment: 'Dumbbell',
                  isCustom: true,
                  measurementType: isTimeBased ? 'time' as any : 'reps' as any,
                };
                await addExercise(newExercise);
                // Small delay to prevent ID collisions
                await new Promise(resolve => setTimeout(resolve, 10));
              } else if (exerciseData && isTimeBased && exerciseData.measurementType !== 'time') {
                // Update existing exercise to be time-based if it's detected as time-based
                await updateExercise(exerciseData.id, { measurementType: 'time' as any });
              }
              
              const exTimestamp = Date.now();
              const exRandom = Math.floor(Math.random() * 10000);
              currentWorkout.exercises.push({
                id: `ex-${exTimestamp}-${exRandom}`,
                exerciseId: exerciseId || `fallback-${exTimestamp}-${exRandom}`,
                orderIndex: currentWorkout.exercises.length,
                targetSets: sets,
                targetRepsMin: repsMin,
                targetRepsMax: repsMax,
                targetWeight: weight,
                progressionType: 'double' as any,
                progressionValue: 2.5,
              });
            }
          }
        }
      }
      
      // Add the last workout
      if (currentWorkout && currentWorkout.exercises.length > 0) {
        if (!weeklyWorkouts[currentWeek]) {
          weeklyWorkouts[currentWeek] = [];
        }
        weeklyWorkouts[currentWeek].push(currentWorkout);
      }
      
      if (Object.keys(weeklyWorkouts).length === 0) {
        Alert.alert(t('alertErrorTitle'), t('errorNoWorkoutsFound'));
        return;
      }
      
      const weekNumbers = Object.keys(weeklyWorkouts).map(k => parseInt(k, 10));
      const minWeekNumber = Math.min(...weekNumbers);
      if (minWeekNumber !== 1) {
        const normalizedWorkouts: { [week: number]: any[] } = {};
        weekNumbers.forEach(oldWeek => {
          const newWeek = oldWeek - minWeekNumber + 1;
          normalizedWorkouts[newWeek] = (weeklyWorkouts[oldWeek] || []).map(workout => ({
            ...workout,
            week: newWeek,
          }));
        });
        weeklyWorkouts = normalizedWorkouts;
      }
      
      const numberOfWeeks = Math.max(...Object.keys(weeklyWorkouts).map(k => parseInt(k, 10)));

      const nowIso = new Date().toISOString();

      if (mode === 'single') {
        const firstWorkout = (weeklyWorkouts[1] || [])[0] || Object.values(weeklyWorkouts)[0]?.[0];
        if (!firstWorkout) {
          Alert.alert(t('alertErrorTitle'), t('errorNoWorkoutsFound'));
          return;
        }

        const templateId = `wt-${Date.now()}`;
        await addWorkoutTemplate({
          id: templateId,
          name: firstWorkout.name || 'Workout',
          createdAt: nowIso,
          updatedAt: nowIso,
          items: (firstWorkout.exercises || []).map((ex: any, idx: number) => ({
            exerciseId: ex.exerciseId,
            order: idx,
            sets: ex.targetSets ?? 3,
            reps: ex.targetRepsMin ?? 8,
            weight: ex.targetWeight,
          })),
        });

        Alert.alert(t('workoutSavedToLibrary'), t('workoutSavedToLibrary'));
        navigation.navigate('Tabs' as never, { initialTab: 'Training' } as never);
        return;
      }

      // mode === 'plan': create templates from Week 1 and create a CyclePlan that repeats weekly
      const week1 = weeklyWorkouts[1] || [];
      if (week1.length === 0) {
        Alert.alert(t('alertErrorTitle'), t('errorNoWorkoutsFound'));
        return;
      }

      const templateIdsByWeekday: Partial<Record<number, string>> = {};
      const weekdays: number[] = [];

      for (const workout of week1) {
        // Map DAY 1..7 to dayjs weekday 1..6,0 (Sun)
        const weekday = workout.dayNumber === 7 ? 0 : workout.dayNumber;
        weekdays.push(weekday);

        const templateId = `wt-${Date.now()}-${weekday}-${Math.floor(Math.random() * 10000)}`;
        await addWorkoutTemplate({
          id: templateId,
          name: workout.name || `Day ${workout.dayNumber}`,
          createdAt: nowIso,
          updatedAt: nowIso,
          items: (workout.exercises || []).map((ex: any, idx: number) => ({
            exerciseId: ex.exerciseId,
            order: idx,
            sets: ex.targetSets ?? 3,
            reps: ex.targetRepsMin ?? 8,
            weight: ex.targetWeight,
          })),
        });

        templateIdsByWeekday[weekday] = templateId;
      }

      const planId = `cp-${Date.now()}`;
      const newPlan = {
        id: planId,
        name: `${numberOfWeeks}-Week Plan`,
        startDate: weekStart.format('YYYY-MM-DD'),
        weeks: numberOfWeeks,
        mapping: { kind: 'weekdays' as const, weekdays: Array.from(new Set(weekdays)) },
        templateIdsByWeekday,
        active: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const result = await addCyclePlan(newPlan);
      if (!result.success && result.conflicts && result.conflicts.length > 0) {
        navigation.navigate('CycleConflicts' as never, { plan: newPlan, conflicts: result.conflicts, planId: newPlan.id } as never);
        return;
      }

      navigation.navigate('Tabs' as never, { initialTab: 'Schedule' } as never);
    } catch (error) {
      console.error('Error creating cycle:', error);
      Alert.alert(t('alertErrorTitle'), t('failedToCreateCycle'));
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          {/* Back Button and Menu Button */}
          <View style={styles.topBar}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <IconArrowLeft size={24} color={COLORS.text} />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.menuButton} activeOpacity={1}>
                <IconMenu size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            {/* Page Title */}
            <View style={styles.pageTitleContainer}>
              <Text style={styles.pageTitle}>
                {mode === 'single' ? t('createWorkoutWithAi') : t('createPlanWithAi')}
              </Text>
            </View>
          </View>

          <ScrollView 
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >

            {/* Instructions Button */}
            <TouchableOpacity
              style={styles.instructionsButton}
              onPress={() => setShowInstructionsSheet(true)}
              activeOpacity={1}
            >
              <Text style={styles.instructionsText}>{t('instructions')}</Text>
              <IconChevronDown size={16} color={COLORS.text} />
            </TouchableOpacity>

            {/* Text Input */}
            <TextInput
              style={styles.textInput}
              placeholder={t('pasteAiWorkoutPlaceholder')}
              placeholderTextColor={COLORS.textMeta}
              value={workoutDetails}
              onChangeText={setWorkoutDetails}
              multiline
              textAlignVertical="top"
            />
          </ScrollView>

          {/* Bottom Button */}
          <View style={styles.bottomContainer}>
            <TouchableOpacity
              style={[styles.createButton, !workoutDetails.trim() && styles.createButtonDisabled]}
              onPress={handleCreateFromAiText}
              activeOpacity={1}
              disabled={!workoutDetails.trim()}
            >
              <Text style={[styles.createButtonText, !workoutDetails.trim() && styles.createButtonTextDisabled]}>
                {mode === 'single' ? t('createWorkout') : t('createPlan')}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Instructions Bottom Drawer */}
        <BottomDrawer
          visible={showInstructionsSheet}
          onClose={() => setShowInstructionsSheet(false)}
          maxHeight="80%"
          scrollable={false}
          showHandle={false}
        >
                <View style={styles.sheetContent}>
            <Text style={styles.sheetTitle}>{t('instructions')}</Text>
            <Text style={styles.sheetSubtitle}>{t('instructionsSubtitle')}</Text>
                      <View style={styles.templateBox}>
                        <Text style={styles.templateText}>{TEMPLATE_FORMAT}</Text>
                      </View>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={handleCopyTemplate}
                    activeOpacity={1}
                  >
              <Text style={styles.copyButtonText}>{t('copy')}</Text>
                  </TouchableOpacity>
          </View>
        </BottomDrawer>
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
  menuButton: {
    // No additional styles needed
  },
  pageTitleContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  pageTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },
  instructionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.lg,
  },
  instructionsText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.text,
  },
  textInput: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    fontSize: 16,
    color: COLORS.text,
    minHeight: 400,
    borderWidth: 0,
  },
  bottomContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  createButton: {
    backgroundColor: COLORS.text,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonDisabled: {
    backgroundColor: COLORS.backgroundCanvas,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  createButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    color: COLORS.backgroundCanvas,
  },
  createButtonTextDisabled: {
    color: COLORS.textMeta,
  },
  sheetContent: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xl,
  },
  sheetTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: 4,
  },
  sheetSubtitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: SPACING.lg,
  },
  templateBox: {
    ...CARDS.cardDeep.outer,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  templateText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    lineHeight: 24,
  },
  copyButton: {
    backgroundColor: COLORS.accentPrimary,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    color: COLORS.backgroundCanvas,
  },
});

