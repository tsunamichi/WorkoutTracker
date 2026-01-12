import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { useStore } from '../store';
import { IconArrowLeft } from '../components/icons';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

const TEMPLATE_FORMAT = `WEEK [number]
DAY [number] — [Workout name]
[Exercise] — [Sets]×[Reps] @ [weight] lb
[Exercise] — [Sets]×[Time] sec @ [weight] lb (optional)`;

export function AIWorkoutCreationScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { cycles, addCycle, getNextCycleNumber, assignWorkout, exercises, addExercise, updateExercise, updateCycle, clearWorkoutAssignmentsForDateRange } = useStore();
  const [workoutDetails, setWorkoutDetails] = useState('');
  const [showInstructionsSheet, setShowInstructionsSheet] = useState(false);
  
  // Match device corner radius (iPhone rounded corners)
  const deviceCornerRadius = insets.bottom > 0 ? 40 : 24;

  const handleCopyTemplate = async () => {
    await Clipboard.setStringAsync(TEMPLATE_FORMAT);
    Alert.alert('Copied', 'Template copied to clipboard');
    setShowInstructionsSheet(false);
  };

  const handleCreateCycle = async () => {
    try {
      if (!workoutDetails.trim()) {
        Alert.alert('Error', 'Please enter workout details');
        return;
      }
      
      const cycleNumber = getNextCycleNumber();
      const today = dayjs();
      const weekStart = today.startOf('isoWeek'); // Monday
      
      // Create the cycle
      const cycleId = `cycle-${Date.now()}`;
      
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
      const weeklyWorkouts: { [week: number]: any[] } = {};
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
        Alert.alert('Error', 'No workouts found in the input. Please check the format.');
        return;
      }
      
      const numberOfWeeks = Math.max(...Object.keys(weeklyWorkouts).map(k => parseInt(k)));
      
      // Create workout templates for each week
      const allWorkoutTemplates: any[] = [];
      let templateIndex = 0;
      
      for (let week = 1; week <= numberOfWeeks; week++) {
        const workoutsForWeek = weeklyWorkouts[week] || [];
        
        for (const workout of workoutsForWeek) {
          // Infer workout type from name
          let workoutType = 'Other';
          const nameLower = workout.name.toLowerCase();
          if (nameLower.includes('push')) workoutType = 'Push';
          else if (nameLower.includes('pull')) workoutType = 'Pull';
          else if (nameLower.includes('legs') || nameLower.includes('leg')) workoutType = 'Legs';
          else if (nameLower.includes('full')) workoutType = 'Full Body';
          
          allWorkoutTemplates.push({
            id: `workout-${cycleId}-w${week}-d${workout.dayNumber}`,
            cycleId,
            name: workout.name,
            workoutType: workoutType as any,
            dayOfWeek: workout.dayNumber,
            orderIndex: templateIndex++,
            week: week,
            exercises: workout.exercises,
          });
        }
      }
      
      // Deactivate all existing cycles first
      const existingCycles = cycles.map(c => ({ ...c, isActive: false }));
      for (const oldCycle of existingCycles) {
        await updateCycle(oldCycle.id, { isActive: false });
      }
      
      // Get workouts per week from first week
      const workoutsPerWeek = weeklyWorkouts[1]?.length || 0;
      
      const cycle = {
        id: cycleId,
        cycleNumber,
        startDate: weekStart.format('YYYY-MM-DD'),
        lengthInWeeks: numberOfWeeks,
        endDate: weekStart.add(numberOfWeeks, 'week').format('YYYY-MM-DD'),
        workoutsPerWeek,
        goal: 'Custom workout cycle',
        isActive: true,
        workoutTemplates: allWorkoutTemplates,
        createdAt: new Date().toISOString(),
      };
      
      await addCycle(cycle);
      
      // Clear any existing assignments in this date range to avoid conflicts
      await clearWorkoutAssignmentsForDateRange(
        cycle.startDate,
        cycle.endDate
      );
      
      // Assign workouts for each specific week
      for (let week = 1; week <= numberOfWeeks; week++) {
        const templatesForWeek = allWorkoutTemplates.filter(t => t.week === week);
        
        for (const template of templatesForWeek) {
          const dayIndex = template.dayOfWeek - 1; // Convert to 0-based (0 = Monday)
          if (dayIndex >= 0 && dayIndex < 7) {
            const workoutDate = weekStart.add((week - 1) * 7 + dayIndex, 'day').format('YYYY-MM-DD');
            await assignWorkout(workoutDate, template.id, cycleId);
          }
        }
      }
      
      console.log('✅ Cycle created with', allWorkoutTemplates.length, 'workout templates across', numberOfWeeks, 'weeks');
      
      // Navigate back to Workouts screen
      navigation.goBack();
    } catch (error) {
      console.error('Error creating cycle:', error);
      Alert.alert('Error', 'Failed to create cycle. Please try again.');
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
              
              <TouchableOpacity style={styles.menuButton}>
                <Text style={styles.menuButtonText}>⋯</Text>
              </TouchableOpacity>
            </View>
            
            {/* Page Title */}
            <View style={styles.pageTitleContainer}>
              <Text style={styles.pageTitle}>Create Workout with AI</Text>
            </View>
          </View>

          <ScrollView 
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >

            {/* Instructions Button */}
            <TouchableOpacity
              style={styles.instructionsButton}
              onPress={() => setShowInstructionsSheet(true)}
              activeOpacity={1}
            >
              <Text style={styles.instructionsText}>Instructions</Text>
              <Text style={styles.dropdownIcon}>▼</Text>
            </TouchableOpacity>

            {/* Text Input */}
            <TextInput
              style={styles.textInput}
              placeholder="Paste the AI-generated workout here"
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
              onPress={handleCreateCycle}
              activeOpacity={1}
              disabled={!workoutDetails.trim()}
            >
              <Text style={[styles.createButtonText, !workoutDetails.trim() && styles.createButtonTextDisabled]}>Create Cycle</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Instructions Bottom Sheet */}
        {showInstructionsSheet && (
          <View style={styles.drawerOverlay} pointerEvents="box-none">
            {/* Backdrop overlay */}
            <TouchableOpacity 
              style={styles.drawerBackdrop} 
              activeOpacity={1}
              onPress={() => setShowInstructionsSheet(false)}
            />
            
            <View style={styles.drawerContainer}>
              <SafeAreaView style={[styles.drawerSheet, {
                borderBottomLeftRadius: deviceCornerRadius,
                borderBottomRightRadius: deviceCornerRadius,
              }]} edges={['bottom']}>
                <View style={styles.sheetHandle} />
                
                <View style={styles.sheetContent}>
                  <Text style={styles.sheetTitle}>Instructions</Text>
                  <Text style={styles.sheetSubtitle}>Ask your agent to use the following template:</Text>
                  
                  <View style={styles.templateBoxBlackShadow}>
                    <View style={styles.templateBoxWhiteShadow}>
                      <View style={styles.templateBox}>
                        <Text style={styles.templateText}>{TEMPLATE_FORMAT}</Text>
                      </View>
                    </View>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={handleCopyTemplate}
                    activeOpacity={1}
                  >
                    <Text style={styles.copyButtonText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              </SafeAreaView>
            </View>
          </View>
        )}
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
  menuButtonText: {
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '600',
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
    gap: 4,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.lg,
  },
  instructionsText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.text,
  },
  dropdownIcon: {
    fontSize: 12,
    color: COLORS.text,
  },
  textInput: {
    backgroundColor: COLORS.backgroundContainer,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    fontSize: 16,
    color: COLORS.text,
    minHeight: 400,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bottomContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  createButton: {
    backgroundColor: '#1B1B1B',
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonDisabled: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.disabledBorder,
  },
  createButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  createButtonTextDisabled: {
    color: COLORS.textMeta,
  },
  // Drawer & Overlay (matching rest timer)
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    pointerEvents: 'box-none',
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  drawerContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    elevation: 10,
  },
  drawerSheet: {
    backgroundColor: '#E3E6E0', // backgroundCanvas
    paddingTop: 4,
    paddingHorizontal: 4,
    paddingBottom: 0, // SafeAreaView handles bottom padding
    borderRadius: 24,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.textMeta,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  sheetContent: {
    paddingHorizontal: 20,
  },
  sheetTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: 4,
  },
  sheetSubtitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: 32,
  },
  templateBoxBlackShadow: {
    // Black shadow: -1, -1, 8% opacity, 1px blur
    shadowColor: '#000000',
    shadowOffset: { width: -1, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 2,
    marginBottom: 32,
  },
  templateBoxWhiteShadow: {
    // Bottom-right shadow: 1, 1, 100% opacity, 1px blur
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 1,
    elevation: 1,
  },
  templateBox: {
    backgroundColor: COLORS.backgroundCanvas,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
  },
  templateText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    lineHeight: 24,
  },
  copyButton: {
    backgroundColor: '#1B1B1B',
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

