import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { useStore } from '../store';
import { IconClose, IconChevronDown, IconMenu } from '../components/icons';
import { BottomDrawer } from '../components/common/BottomDrawer';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { useTranslation } from '../i18n/useTranslation';
import { parseWarmupText, convertToWarmupItems } from '../utils/warmupParser';

dayjs.extend(isoWeek);

const TEMPLATE_FORMAT = `WEEK [number]
DAY [number] — [Workout name]
[Exercise] — [Sets]×[Reps] @ [weight] lb
[Exercise] — [Sets]×[Time] sec @ [weight] lb (optional)`;

const WARMUP_TEMPLATE_FORMAT = `- [Exercise] x [Number] reps
- [Exercise] x [Number] sec
- [Exercise] [Number] sec
repeat this superset [Number] times

Example:
- 90/90 Hip Rotations x 6 reps
- Half-Kneeling Hip Flexor 30 sec
repeat this superset 2 times`;

type ParsedExercise = {
  name: string;
  sets: number | null;
  reps: number | null;
  seconds: number | null;
  weight: number | null;
  weightMin: number | null;
  weightMax: number | null;
  unit: "lb" | "kg" | null;
  raw: string;
};

const normalize = (input: string) => {
  return input
    .replace(/[—–⸻]/g, "-")
    .replace(/×/g, "x")
    .replace(/\t/g, " ")
    .replace(/[•●]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
};

const parseExerciseLine = (lineRaw: string, inheritedUnit: "lb" | "kg" | null): { ex: ParsedExercise | null; unitOut: "lb" | "kg" | null } => {
  const line = normalize(lineRaw);

  // Quick filter: likely not an exercise line
  const looksLikeExercise =
    line.startsWith("- ") || /\b\d+\s*x\s*\d+\b/i.test(line) || /\bsets?\b/i.test(line);
  if (!looksLikeExercise) return { ex: null, unitOut: inheritedUnit };

  // Remove bullet prefix
  const body = line.replace(/^-+\s*/, "");

  // Split name from the rest using a dash, but don't require it
  // e.g. "Rear Delt Row - 3x10 @ 120 lb"
  // or "Rear Delt Row 3x10 @ 120 lb"
  let name = body;
  let details = "";
  const mSplit = body.match(/^(.*?)(?:\s+-\s+|\s+)(\d+\s*x\s*\d+.*)$/i);
  if (mSplit) {
    name = mSplit[1].trim();
    details = mSplit[2].trim();
  } else {
    // fallback: try to locate first "sets x reps" occurrence
    const idx = body.search(/\b\d+\s*x\s*\d+\b/i);
    if (idx !== -1) {
      name = body.slice(0, idx).trim().replace(/[-–—]\s*$/, "").trim();
      details = body.slice(idx).trim();
    } else {
      // If no sets/reps found, still keep name; details might include weight only
      const atIdx = body.indexOf("@");
      if (atIdx !== -1) {
        name = body.slice(0, atIdx).trim();
        details = body.slice(atIdx).trim();
      }
    }
  }

  // Parse sets & reps
  let sets: number | null = null;
  let reps: number | null = null;
  let seconds: number | null = null;

  // 3x10
  const mSR = details.match(/\b(\d+)\s*x\s*(\d+)\b/i);
  if (mSR) {
    sets = parseInt(mSR[1], 10);
    reps = parseInt(mSR[2], 10);
  }

  // time like 3x45s or 3x45 sec
  const mTime = details.match(/\b(\d+)\s*x\s*(\d+)\s*(s|sec|secs|second|seconds)\b/i);
  if (mTime) {
    sets = parseInt(mTime[1], 10);
    seconds = parseInt(mTime[2], 10);
    reps = null;
  }

  // Parse unit (explicit)
  let unit: "lb" | "kg" | null = null;
  if (/\bkg\b/i.test(details)) unit = "kg";
  if (/\blb\b/i.test(details)) unit = "lb";
  if (!unit) unit = inheritedUnit;

  // Parse weight
  let weight: number | null = null;
  let weightMin: number | null = null;
  let weightMax: number | null = null;

  // Bodyweight
  if (/\b(bw|bodyweight)\b/i.test(details)) {
    weight = null;
    weightMin = null;
    weightMax = null;
  } else {
    // Range: 15-20 or 15 to 20 (allow decimals)
    const mRange = details.match(/@\s*([\d.]+)\s*(?:-|to)\s*([\d.]+)/i) || details.match(/\b([\d.]+)\s*(?:-|to)\s*([\d.]+)\s*(?:lb|kg)?\b/i);
    if (mRange) {
      weightMin = parseFloat(mRange[1]);
      weightMax = parseFloat(mRange[2]);
    } else {
      // Single number after @, or any trailing number
      const mAt = details.match(/@\s*([\d.]+)/i);
      const mAny = details.match(/\b([\d.]+)\s*(?:lb|kg)?\b(?!.*\b[\d.]+\b)/i); // last number in string
      const pick = mAt?.[1] ?? mAny?.[1];
      if (pick) weight = parseFloat(pick);
    }
  }

  // IMPORTANT: never coerce missing weight to 0
  const ex: ParsedExercise = {
    name,
    sets,
    reps,
    seconds,
    weight,
    weightMin,
    weightMax,
    unit,
    raw: lineRaw,
  };

  return { ex, unitOut: unit };
};

export function AIWorkoutCreationScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { exercises, addExercise, updateExercise, addWorkoutTemplate, addCyclePlan } = useStore();
  const { t } = useTranslation();
  const [workoutDetails, setWorkoutDetails] = useState('');
  const [showInstructionsSheet, setShowInstructionsSheet] = useState(false);
  const [warmupDetails, setWarmupDetails] = useState('');
  const [showWarmupSheet, setShowWarmupSheet] = useState(false);

  const mode: 'single' | 'plan' = route?.params?.mode === 'single' ? 'single' : 'plan';

  const handleCopyTemplate = async () => {
    await Clipboard.setStringAsync(TEMPLATE_FORMAT);
    Alert.alert(t('copiedTitle'), t('templateCopied'));
    setShowInstructionsSheet(false);
  };

  const handleCopyWarmupTemplate = async () => {
    await Clipboard.setStringAsync(WARMUP_TEMPLATE_FORMAT);
    Alert.alert(t('copiedTitle'), 'Warmup template copied');
    setShowWarmupSheet(false);
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
      // Warm up: (optional, will be extracted)
      // - exercise x reps
      // repeat this superset N times
      // DAY 1 — Pull
      // • Rear Delt Row — 3×10 @ 100 lb
      // • Spanish Squat ISO — 4×30 sec @ 25 lb (time-based with weight)
      // • Wall Sit — 4×45 sec (time-based without weight)
      // • Barbell Row — 3×10 @ 100 lb
      
      // First, extract warmup section if it exists in the workout text
      let workoutText = workoutDetails;
      let extractedWarmup = warmupDetails; // Start with any manually entered warmup
      
      // Look for "Warm up:" section - it should end when we see "DAY" marker
      const warmupMatch = workoutDetails.match(/warm\s*up\s*:?\s*([\s\S]*?)(?=DAY\s+\d+)/i);
      if (warmupMatch) {
        let rawWarmup = warmupMatch[1].trim();
        
        // The warmup text can have bullets (•) and multiple exercises on same line separated by tabs/spaces
        // Example: "• Exercise1 x 6  • Exercise2 x 8 superset - 2 rounds"
        
        // Strategy:
        // 1. Replace bullet points (•) with newlines and dashes
        // 2. Handle tabs and multiple spaces
        
        rawWarmup = rawWarmup
          // Replace bullet points with newline + dash
          .replace(/[•●]/g, '\n- ')
          // Replace tabs with spaces
          .replace(/\t+/g, ' ')
          // Replace multiple spaces with single space (except at line start)
          .replace(/([^\n]) {2,}/g, '$1 ')
          // Clean up: remove empty lines and trim
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .join('\n');
        
        // Add dash to first line if it doesn't have one
        if (!rawWarmup.startsWith('-')) {
          rawWarmup = '- ' + rawWarmup;
        }
        
        extractedWarmup = rawWarmup;
        
        // Remove the warmup section from workout text
        workoutText = workoutDetails.replace(/warm\s*up\s*:?\s*[\s\S]*?(?=DAY\s+\d+)/i, '');
      }
      
      const lines = workoutText.split('\n');
      let weeklyWorkouts: { [week: number]: any[] } = {};
      let currentWeek = 1;
      let currentWorkout: any = null;
      let inheritedUnit: "lb" | "kg" | null = null;
      
      for (let line of lines) {
        // Clean up the line
        const trimmedLine = line.trim();
        
        // Skip empty lines, separator lines, and warmup-related lines
        if (!trimmedLine || trimmedLine === '⸻' || trimmedLine.startsWith('⸻') || 
            /warm\s*up\s*:?/i.test(trimmedLine) || 
            /repeat\s+this\s+superset/i.test(trimmedLine) ||
            (trimmedLine.startsWith('-') && !currentWorkout)) {
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
        // Check if this is an exercise line
        else if (currentWorkout) {
          const { ex, unitOut } = parseExerciseLine(trimmedLine, inheritedUnit);
          inheritedUnit = unitOut;
          
          if (ex && ex.name) {
            const isTimeBased = ex.seconds !== null;
            const sets = ex.sets ?? 3;
            const reps = ex.reps ?? (isTimeBased ? ex.seconds : 8);
            
            // Calculate final weight: use parsed weight, or average of range, or null for bodyweight
            let weight: number | null = null;
            if (ex.weight !== null) {
              weight = ex.weight;
            } else if (ex.weightMin !== null && ex.weightMax !== null) {
              weight = (ex.weightMin + ex.weightMax) / 2;
            } else if (ex.weightMin !== null) {
              weight = ex.weightMin;
            }
            // If weight is still null, it's intentionally bodyweight (don't default to 0 here)
            
            // Find or create exercise in database
            let exerciseData = exercises.find(e => 
              e.name.toLowerCase() === ex.name.toLowerCase()
            );
            
            // If exercise doesn't exist, create it
            let exerciseId = exerciseData?.id;
            if (!exerciseData) {
              const timestamp = Date.now();
              const random = Math.floor(Math.random() * 10000);
              exerciseId = `exercise-${timestamp}-${random}`;
              const newExercise = {
                id: exerciseId,
                name: ex.name,
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
            const targetRepsValue = typeof reps === 'number' ? reps : parseInt(String(reps), 10);
            
            currentWorkout.exercises.push({
              id: `ex-${exTimestamp}-${exRandom}`,
              exerciseId: exerciseId || `fallback-${exTimestamp}-${exRandom}`,
              orderIndex: currentWorkout.exercises.length,
              targetSets: sets,
              targetRepsMin: targetRepsValue,
              targetRepsMax: targetRepsValue,
              targetWeight: weight,
              isTimeBased: isTimeBased,
              progressionType: 'double' as any,
              progressionValue: 2.5,
            });
            
            // Small delay between exercises to prevent collisions
            await new Promise(resolve => setTimeout(resolve, 5));
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

      // Parse warmup if provided (either extracted from workout text or manually entered)
      let parsedWarmupItems: any[] = [];
      if (extractedWarmup.trim()) {
        try {
          const parsedGroups = parseWarmupText(extractedWarmup);
          parsedWarmupItems = convertToWarmupItems(parsedGroups);
        } catch (error) {
          console.error('Error parsing warmup:', error);
          // Continue without warmup if parsing fails
        }
      }

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
          kind: 'workout',
          warmupItems: parsedWarmupItems,
          lastUsedAt: null,
          usageCount: 0,
          source: 'ai',
          items: (firstWorkout.exercises || []).map((ex: any, idx: number) => ({
            id: `item-${Date.now()}-${idx}`,
            exerciseId: ex.exerciseId,
            order: idx,
            sets: ex.targetSets ?? 3,
            reps: ex.isTimeBased ? String(ex.targetRepsMin ?? 30) : String(ex.targetRepsMin ?? 8),
            weight: ex.targetWeight ?? 0,
            isTimeBased: ex.isTimeBased ?? false,
          })),
        });

        Alert.alert(t('workoutSavedToLibrary'), t('workoutSavedToLibrary'));
        navigation.goBack();
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
          kind: 'workout',
          warmupItems: parsedWarmupItems,
          lastUsedAt: null,
          usageCount: 0,
          source: 'ai',
          items: (workout.exercises || []).map((ex: any, idx: number) => ({
            id: `item-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
            exerciseId: ex.exerciseId,
            order: idx,
            sets: ex.targetSets ?? 3,
            reps: ex.isTimeBased ? String(ex.targetRepsMin ?? 30) : String(ex.targetRepsMin ?? 8),
            weight: ex.targetWeight ?? 0,
            isTimeBased: ex.isTimeBased ?? false,
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

      // Plan was added successfully without conflicts - now apply it to the schedule
      const { applyCyclePlan } = useStore.getState();
      const applyResult = await applyCyclePlan(planId);
      
      if (applyResult.success) {
        Alert.alert(t('planAppliedSuccessfully'));
      } else {
        Alert.alert(t('error'), t('failedToApplyPlan'));
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
                <IconClose size={24} color={COLORS.text} />
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

            {/* Workout Text Input */}
            <Text style={styles.sectionLabel}>Workout</Text>
            <TextInput
              style={styles.textInput}
              placeholder={t('pasteAiWorkoutPlaceholder')}
              placeholderTextColor={COLORS.textMeta}
              value={workoutDetails}
              onChangeText={setWorkoutDetails}
              multiline
              textAlignVertical="top"
            />

            {/* Warmup Section */}
            <View style={styles.warmupSection}>
              <TouchableOpacity
                style={styles.instructionsButton}
                onPress={() => setShowWarmupSheet(true)}
                activeOpacity={1}
              >
                <Text style={styles.instructionsText}>Warmup (Optional)</Text>
                <IconChevronDown size={16} color={COLORS.text} />
              </TouchableOpacity>

              <Text style={styles.sectionLabel}>Warmup</Text>
              <TextInput
                style={styles.warmupInput}
                placeholder="Paste warmup routine (optional)..."
                placeholderTextColor={COLORS.textMeta}
                value={warmupDetails}
                onChangeText={setWarmupDetails}
                multiline
                textAlignVertical="top"
              />
            </View>
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

        {/* Warmup Instructions Bottom Drawer */}
        <BottomDrawer
          visible={showWarmupSheet}
          onClose={() => setShowWarmupSheet(false)}
          maxHeight="80%"
          scrollable={false}
          showHandle={false}
        >
          <View style={styles.sheetContent}>
            <Text style={styles.sheetTitle}>Warmup Format</Text>
            <Text style={styles.sheetSubtitle}>Follow this format for warmup exercises</Text>
            <View style={styles.templateBox}>
              <Text style={styles.templateText}>{WARMUP_TEMPLATE_FORMAT}</Text>
            </View>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={handleCopyWarmupTemplate}
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
  sectionLabel: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  warmupSection: {
    marginTop: SPACING.lg,
  },
  warmupInput: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    fontSize: 16,
    color: COLORS.text,
    minHeight: 200,
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

