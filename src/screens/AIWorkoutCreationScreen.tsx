import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, LayoutAnimation, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { useStore } from '../store';
import { IconClose, IconMenu, IconChevronDown } from '../components/icons';
import { BottomDrawer } from '../components/common/BottomDrawer';
import { CalendarDayButton } from '../components/calendar/CalendarDayButton';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { useTranslation } from '../i18n/useTranslation';
import { parseWarmupText, convertToWarmupItems } from '../utils/warmupParser';

dayjs.extend(isoWeek);

const TEMPLATE_FORMAT = `WEEK [number]
DAY [number] — [Workout name]
[Exercise] — [Sets]×[Reps] @ [weight] lb
[Exercise] — [Sets]×[Time] sec @ [weight] lb (optional)`;

/** Heuristic: clipboard looks like a workout plan */
function clipboardLooksLikeWorkout(text: string): boolean {
  if (!text || text.length < 20) return false;
  const t = text.trim();
  if (/\bDAY\s*\d+/i.test(t) || /\bWEEK\s*\d+/i.test(t)) return true;
  if (/\d+\s*[x×]\s*\d+/i.test(t)) return true;
  if (/@\s*\d+/.test(t) && /\b(lb|kg)\b/i.test(t)) return true;
  return false;
}

/** Lightweight parse for preview only: returns day count, exercise count, day names. No DB writes. */
function parsePlanPreview(text: string): { success: true; dayCount: number; exerciseCount: number; dayNames: string[] } | { success: false } {
  const lines = text.split('\n');
  const dayNames: string[] = [];
  let exerciseCount = 0;
  let currentWorkout: { name: string; dayNumber: number; exercises: number } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '⸻' || /warm\s*up\s*:?/i.test(trimmed)) continue;

    const dayMatch = trimmed.match(/^(?:WEEK\s+\d+\s+)?DAY\s+(\d+)/i);
    if (dayMatch) {
      if (currentWorkout) {
        dayNames.push(currentWorkout.name || `Day ${currentWorkout.dayNumber}`);
      }
      const dayNumber = parseInt(dayMatch[1], 10);
      const parts = trimmed.split(/[—\-:]/).map(p => p.trim());
      const name = parts.length > 1 ? parts[parts.length - 1] : parts[0] || `Day ${dayNumber}`;
      currentWorkout = { name, dayNumber, exercises: 0 };
      continue;
    }

    if (currentWorkout) {
      const looksLikeExercise = trimmed.startsWith('- ') || /\b\d+\s*[x×]\s*\d+\b/i.test(trimmed) || /\bsets?\b/i.test(trimmed) || /@\s*\d+/.test(trimmed);
      if (looksLikeExercise) {
        currentWorkout.exercises += 1;
        exerciseCount += 1;
      }
    }
  }

  if (currentWorkout) {
    dayNames.push(currentWorkout.name || `Day ${currentWorkout.dayNumber}`);
  }

  if (dayNames.length === 0) return { success: false };
  return { success: true, dayCount: dayNames.length, exerciseCount, dayNames };
}


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

type PlanCardState = 'empty' | 'imported' | 'edit_mode' | 'parse_error';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function AIWorkoutCreationScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { exercises, addExercise, updateExercise, addWorkoutTemplate, addCyclePlan } = useStore();
  const { t } = useTranslation();
  const mode: 'single' | 'plan' = route?.params?.mode === 'single' ? 'single' : 'plan';

  // Start date (Section A)
  const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [startDateExpanded, setStartDateExpanded] = useState(false);
  const [calendarMonthKey, setCalendarMonthKey] = useState(() => dayjs().format('YYYY-MM'));

  // Workout plan (Section B)
  const [workoutDetails, setWorkoutDetails] = useState('');
  const [planCardState, setPlanCardState] = useState<PlanCardState>('empty');
  const [parseResult, setParseResult] = useState<ReturnType<typeof parsePlanPreview> | null>(null);
  const [showInstructionsSheet, setShowInstructionsSheet] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handlePasteFromClipboard = useCallback(async () => {
    const content = await Clipboard.getStringAsync();
    if (!content?.trim()) return;
    setWorkoutDetails(content);
    const result = parsePlanPreview(content);
    setParseResult(result);
    setPlanCardState(result.success ? 'imported' : 'parse_error');
  }, []);

  const handleSaveEdit = useCallback(() => {
    const text = workoutDetails.trim();
    if (!text) {
      setPlanCardState('empty');
      setParseResult(null);
      return;
    }
    const result = parsePlanPreview(text);
    setParseResult(result);
    setPlanCardState(result.success ? 'imported' : 'parse_error');
  }, [workoutDetails]);

  const handleClearPlan = useCallback(() => {
    setWorkoutDetails('');
    setParseResult(null);
    setPlanCardState('empty');
  }, []);

  const canImport = !!startDate && parseResult?.success === true;

  const handleCopyTemplate = async () => {
    await Clipboard.setStringAsync(TEMPLATE_FORMAT);
    Alert.alert(t('copiedTitle'), t('templateCopied'));
    setShowInstructionsSheet(false);
  };


  const handleCreateFromAiText = async () => {
    if (isImporting) return;
    try {
      if (!workoutDetails.trim()) {
        Alert.alert(t('alertErrorTitle'), t('enterWorkoutDetails'));
        return;
      }
      setIsImporting(true);
      const weekStart = dayjs(startDate);
      
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
      let extractedWarmup = ''; // Will be populated if warmup section found in workout text
      
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

      // Shift DAY numbers so DAY 1 lands on the start date's weekday.
      // Original: DAY 1 → Mon(1), DAY 2 → Tue(2), etc.
      // Shifted:  DAY 1 → startDate's weekday, preserving relative gaps.
      const startWeekday = weekStart.day(); // 0=Sun..6=Sat
      const sortedDayNumbers = week1.map(w => w.dayNumber).sort((a: number, b: number) => a - b);
      const firstDayNumber = sortedDayNumbers[0] || 1;
      // Original weekday for DAY 1: dayNumber === 7 ? 0 : dayNumber  →  1 for DAY 1
      const firstOriginalWeekday = firstDayNumber === 7 ? 0 : firstDayNumber;
      const shift = (startWeekday - firstOriginalWeekday + 7) % 7;

      for (const workout of week1) {
        const originalWeekday = workout.dayNumber === 7 ? 0 : workout.dayNumber;
        const weekday = (originalWeekday + shift) % 7;
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
    } finally {
      setIsImporting(false);
    }
  };

  const toggleStartDateExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (!startDateExpanded) setCalendarMonthKey(dayjs(startDate).format('YYYY-MM'));
    setStartDateExpanded(prev => !prev);
  };

  // Full 5 weeks (35 days) starting from Monday of the week that contains the 1st — no blank cells
  const calendarWeeks = (() => {
    const firstOfMonth = dayjs(calendarMonthKey + '-01');
    const daysToMonday = (firstOfMonth.day() + 6) % 7;
    const firstDisplayed = firstOfMonth.subtract(daysToMonday, 'day');
    const days: string[] = [];
    for (let i = 0; i < 35; i++) {
      days.push(firstDisplayed.add(i, 'day').format('YYYY-MM-DD'));
    }
    const weeks: string[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  })();

  if (mode === 'single') {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <IconClose size={24} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuButton} activeOpacity={1}>
              <IconMenu size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.pageTitleContainer}>
            <Text style={styles.pageTitle}>{t('createWorkoutWithAi')}</Text>
            <TouchableOpacity onPress={() => setShowInstructionsSheet(true)} activeOpacity={0.7}>
              <Text style={styles.instructionsLink}>{t('instructions')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.legacySinglePlaceholder}>
          <Text style={styles.legacySingleText}>Single workout import: use cycle mode for full flow.</Text>
        </View>
        <BottomDrawer visible={showInstructionsSheet} onClose={() => setShowInstructionsSheet(false)} maxHeight="80%" scrollable={false} showHandle={false}>
          <View style={styles.sheetContent}>
            <Text style={styles.sheetTitle}>{t('instructions')}</Text>
            <Text style={styles.sheetSubtitle}>{t('instructionsSubtitle')}</Text>
            <View style={styles.templateBox}><Text style={styles.templateText}>{TEMPLATE_FORMAT}</Text></View>
            <TouchableOpacity style={styles.copyButton} onPress={handleCopyTemplate} activeOpacity={1}>
              <Text style={styles.copyButtonText}>{t('copy')}</Text>
            </TouchableOpacity>
          </View>
        </BottomDrawer>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <IconClose size={24} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuButton} activeOpacity={1}>
              <IconMenu size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.pageTitleContainer}>
            <Text style={styles.screenTitle}>Import Cycle</Text>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.sectionsContent} keyboardShouldPersistTaps="handled">
          {/* Section A — Start date */}
          <View style={styles.section}>
            <TouchableOpacity style={styles.startDateRow} onPress={toggleStartDateExpanded} activeOpacity={0.7}>
              <Text style={styles.startDateLabel}>Start date</Text>
              <View style={styles.startDateValueRow}>
                <Text style={styles.startDateValue}>{dayjs(startDate).format('ddd, MMM D')}</Text>
                <View style={[styles.chevronWrap, startDateExpanded && styles.chevronWrapRotated]}>
                  <IconChevronDown size={20} color={COLORS.text} />
                </View>
              </View>
            </TouchableOpacity>
            {startDateExpanded && (
              <View style={styles.inlineCalendar}>
                <View style={styles.calendarMonthHeader}>
                  <TouchableOpacity onPress={() => setCalendarMonthKey(dayjs(calendarMonthKey + '-01').subtract(1, 'month').format('YYYY-MM'))} style={styles.calendarNavArrow} hitSlop={12}>
                    <Text style={styles.calendarNavArrowText}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.calendarMonthLabel}>{dayjs(calendarMonthKey + '-01').format('MMMM YYYY')}</Text>
                  <TouchableOpacity onPress={() => setCalendarMonthKey(dayjs(calendarMonthKey + '-01').add(1, 'month').format('YYYY-MM'))} style={styles.calendarNavArrow} hitSlop={12}>
                    <Text style={styles.calendarNavArrowText}>›</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.calendarDayOfWeekRow}>
                  {WEEKDAYS.map((d, i) => (
                    <View key={i} style={styles.calendarDayOfWeekCell}>
                      <Text style={styles.calendarDayOfWeekText}>{d}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.calendarWeeksContainer}>
                  {calendarWeeks.map((weekDays, weekIdx) => (
                    <View key={weekIdx} style={styles.calendarWeekRow}>
                      {weekDays.map((dateStr) => {
                        const isSelected = dateStr === startDate;
                        const isToday = dayjs(dateStr).isSame(dayjs(), 'day');
                        const isCurrentMonth = dayjs(dateStr).format('YYYY-MM') === calendarMonthKey;
                        return (
                          <View key={dateStr} style={styles.calendarDayCell}>
                            <CalendarDayButton
                              dayNumber={dayjs(dateStr).date()}
                              isSelected={isSelected}
                              isToday={isToday}
                              isCompleted={false}
                              hasWorkout={false}
                              isCurrentMonth={isCurrentMonth}
                              onPress={() => setStartDate(dateStr)}
                            />
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Section B — Workout plan */}
          <View style={styles.section}>
            <View style={styles.importCard}>
              {planCardState === 'empty' && (
                <View style={styles.importCardBody}>
                  <View style={styles.importCardTitleLinkBlock}>
                    <Text style={styles.importCardTitle}>Workout cycle</Text>
                    <TouchableOpacity onPress={() => setShowInstructionsSheet(true)} style={styles.tertiaryLink}>
                      <Text style={styles.tertiaryLinkText}>See supported formats</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.secondaryButton} onPress={handlePasteFromClipboard} activeOpacity={0.7}>
                    <Text style={styles.secondaryButtonText}>Paste from clipboard</Text>
                  </TouchableOpacity>
                </View>
              )}

              {planCardState === 'imported' && parseResult?.success === true && (
                <View style={styles.importCardBody}>
                  <View style={styles.importCardTitleLinkBlock}>
                    <Text style={styles.importCardTitle}>Workout cycle</Text>
                    <TouchableOpacity onPress={() => setShowInstructionsSheet(true)} style={styles.tertiaryLink}>
                      <Text style={styles.tertiaryLinkText}>See supported formats</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.detectedBlock}>
                    <Text style={styles.detectedLabel}>Detected</Text>
                    <Text style={styles.detectedDaysCount}>{Math.ceil(parseResult.dayCount / 7)}-week cycle</Text>
                  </View>
                  <View style={styles.previewList}>
                    {parseResult.dayNames.slice(0, 7).map((name, i) => (
                      <Text key={i} style={styles.previewDayText}>Day {i + 1} {name}</Text>
                    ))}
                    {parseResult.dayNames.length > 7 && (
                      <Text style={styles.previewMoreDays}>+ {parseResult.dayNames.length - 7} other {parseResult.dayNames.length - 7 === 1 ? 'day' : 'days'}</Text>
                    )}
                  </View>
                  <View style={styles.importCardActionsColumn}>
                    <TouchableOpacity style={[styles.secondaryButton, styles.actionColumnButton]} onPress={() => setPlanCardState('edit_mode')} activeOpacity={0.7}>
                      <Text style={styles.actionButtonLabelSecondary}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.ghostButton]} onPress={handleClearPlan} activeOpacity={0.7}>
                      <Text style={styles.actionButtonLabelSecondary}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {planCardState === 'edit_mode' && (
                <View style={styles.importCardBody}>
                  <View style={styles.importCardTitleLinkBlock}>
                    <Text style={styles.importCardTitle}>Workout cycle</Text>
                    <TouchableOpacity onPress={() => setShowInstructionsSheet(true)} style={styles.tertiaryLink}>
                      <Text style={styles.tertiaryLinkText}>See supported formats</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.editTextArea}
                    placeholder={t('pasteAiWorkoutPlaceholder')}
                    placeholderTextColor={COLORS.textMeta}
                    value={workoutDetails}
                    onChangeText={setWorkoutDetails}
                    multiline
                    textAlignVertical="top"
                  />
                  <View style={styles.importCardActionsColumn}>
                    <TouchableOpacity style={[styles.secondaryButton, styles.actionColumnButton]} onPress={handleSaveEdit} activeOpacity={0.7}>
                      <Text style={styles.actionButtonLabelSecondary}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.ghostButton]} onPress={() => { if (parseResult?.success) setPlanCardState('imported'); else setPlanCardState('parse_error'); }} activeOpacity={0.7}>
                      <Text style={styles.actionButtonLabelSecondary}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {planCardState === 'parse_error' && (
                <View style={styles.importCardBody}>
                  <View style={styles.importCardTitleLinkBlock}>
                    <Text style={styles.importCardTitle}>Workout cycle</Text>
                    <TouchableOpacity onPress={() => setShowInstructionsSheet(true)} style={styles.tertiaryLink}>
                      <Text style={styles.tertiaryLinkText}>See supported formats</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.parseErrorRow}>
                    <Text style={styles.errorTitle} numberOfLines={1}>Couldn't parse this cycle</Text>
                    <TouchableOpacity style={styles.failureButton} onPress={handleClearPlan} activeOpacity={0.7}>
                      <Text style={styles.failureButtonText}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Pinned CTA */}
        <View style={[styles.ctaPinned, { paddingBottom: insets.bottom + SPACING.lg }]}>
          <TouchableOpacity
            style={[styles.ctaButton, (!canImport || isImporting) && styles.ctaButtonDisabled]}
            onPress={handleCreateFromAiText}
            activeOpacity={0.85}
            disabled={!canImport || isImporting}
          >
            {isImporting ? (
              <View style={styles.ctaButtonContent}>
                <ActivityIndicator size="small" color={COLORS.text} style={styles.ctaSpinner} />
                <Text style={[styles.ctaButtonText, styles.ctaButtonTextDisabled]}>Importing…</Text>
              </View>
            ) : (
              <Text style={[styles.ctaButtonText, !canImport && styles.ctaButtonTextDisabled]}>Import cycle</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <BottomDrawer visible={showInstructionsSheet} onClose={() => setShowInstructionsSheet(false)} maxHeight="80%" scrollable={false} showHandle={false}>
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>{t('instructions')}</Text>
          <Text style={styles.sheetSubtitle}>{t('instructionsSubtitle')}</Text>
          <View style={styles.templateBox}><Text style={styles.templateText}>{TEMPLATE_FORMAT}</Text></View>
          <TouchableOpacity style={styles.copyButton} onPress={handleCopyTemplate} activeOpacity={1}>
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
    paddingBottom: SPACING.sm,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  backButton: {},
  menuButton: {},
  pageTitleContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  pageTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: 4,
  },
  screenTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: 4,
  },
  instructionsInline: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.accentPrimary,
  },
  instructionsLink: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.accentPrimary,
  },
  scroll: {
    flex: 1,
  },
  sectionsContent: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 120,
  },
  section: {
    marginTop: SPACING.xxl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 20,
    color: COLORS.text,
    marginBottom: 4,
  },
  sectionSupport: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: SPACING.md,
  },
  startDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
  },
  startDateLabel: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
  },
  startDateValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  startDateValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  chevronWrap: {
    transform: [{ rotate: '0deg' }],
  },
  chevronWrapRotated: {
    transform: [{ rotate: '180deg' }],
  },
  inlineCalendar: {
    marginTop: 0,
    padding: SPACING.lg,
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
  },
  calendarMonthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
    marginBottom: 4,
    gap: 12,
  },
  calendarNavArrow: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarNavArrowText: {
    fontSize: 22,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  calendarMonthLabel: {
    ...TYPOGRAPHY.metaBold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  calendarDayOfWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 24,
    alignItems: 'center',
  },
  calendarDayOfWeekCell: {
    flex: 1,
    alignItems: 'center',
  },
  calendarDayOfWeekText: {
    ...TYPOGRAPHY.note,
    color: COLORS.textMeta,
    textAlign: 'center',
  },
  calendarWeeksContainer: {
    overflow: 'hidden',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 50,
    alignItems: 'center',
  },
  calendarDayCell: {
    flex: 1,
    alignItems: 'center',
  },
  importCard: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
  },
  importCardTitle: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    marginBottom: 4,
  },
  importCardTitleLinkBlock: {
    marginBottom: 8,
  },
  importCardBody: {
    gap: SPACING.md,
  },
  primaryButton: {
    backgroundColor: COLORS.accentPrimary,
    height: 52,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.backgroundCanvas,
  },
  actionButtonLabelPrimary: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.backgroundCanvas,
  },
  actionButtonLabelSecondary: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
  },
  secondaryButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentPrimaryDimmed,
  },
  secondaryButtonFullWidth: {
    width: '100%',
  },
  secondaryButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.accentPrimary,
  },
  tertiaryLink: {
    alignSelf: 'flex-start',
  },
  tertiaryLinkText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.accentPrimary,
  },
  detectedBlock: {
    marginBottom: SPACING.md,
  },
  detectedLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.text,
    marginBottom: 4,
  },
  detectedDaysCount: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  previewList: {
    marginBottom: SPACING.md,
  },
  previewDayText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    marginBottom: 2,
  },
  previewMoreDays: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    marginTop: 2,
  },
  importCardActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  importCardActionsColumn: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  buttonFullWidth: {
    flex: 1,
  },
  actionColumnButton: {
    minWidth: 100,
    paddingHorizontal: 24,
  },
  ghostButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
  },
  editTextArea: {
    minHeight: 160,
    backgroundColor: 'transparent',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...TYPOGRAPHY.meta,
    color: COLORS.text,
    textAlignVertical: 'top',
  },
  parseErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  errorTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    flex: 1,
  },
  failureButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.signalNegativeDimmed,
  },
  failureButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.signalNegative,
  },
  ctaPinned: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    backgroundColor: COLORS.backgroundCanvas,
  },
  ctaButton: {
    backgroundColor: COLORS.accentPrimary,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  ctaSpinner: {
    marginRight: SPACING.xs,
  },
  ctaButtonDisabled: {
    backgroundColor: COLORS.backgroundCanvas,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ctaButtonText: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 16,
    color: COLORS.backgroundCanvas,
  },
  ctaButtonTextDisabled: {
    color: COLORS.textMeta,
  },
  legacySinglePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  legacySingleText: {
    ...TYPOGRAPHY.body,
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

