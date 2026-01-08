import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Circle, Path } from 'react-native-svg';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { useStore } from '../store';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { TEMPLATES } from '../data/templates';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

// Light theme colors matching Today screen
const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  backgroundContainer: '#CDCABB',
  secondary: '#1B1B1B',
  textSecondary: '#3C3C43',
  textMeta: '#817B77',
  border: '#C7C7CC',
  accentPrimary: '#FD6B00',
  buttonBg: '#F2F2F7',
  buttonText: '#000000',
  meta: '#817B77',
};

export function WorkoutsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { cycles, addCycle, getNextCycleNumber, assignWorkout, exercises, addExercise, updateCycle, clearWorkoutAssignmentsForDateRange, workoutAssignments, detailedWorkoutProgress } = useStore();
  const { startDraftFromTemplate, startDraftFromCustomText, setPrefs } = useOnboardingStore();
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [workoutDetails, setWorkoutDetails] = useState('');
  
  // Calculate cycle completion percentage
  const getCycleCompletion = (cycleId: string) => {
    const cycle = cycles.find(c => c.id === cycleId);
    if (!cycle) return 0;
    
    // Get all workout assignments for this cycle
    const cycleAssignments = Object.entries(workoutAssignments).filter(
      ([_, assignment]) => assignment.cycleId === cycleId
    );
    
    if (cycleAssignments.length === 0) return 0;
    
    let totalSets = 0;
    let completedSets = 0;
    
    cycleAssignments.forEach(([date, assignment]) => {
      const template = cycle.workoutTemplates.find(t => t.id === assignment.workoutTemplateId);
      if (!template) return;
      
      const workoutKey = `${cycleId}-${date}`;
      const progress = detailedWorkoutProgress[workoutKey];
      
      // Count total sets from template
      template.exercises.forEach(ex => {
        totalSets += ex.targetSets;
      });
      
      // Count completed sets from progress
      if (progress) {
        Object.values(progress.exercises).forEach(exerciseProgress => {
          if (!exerciseProgress.skipped) {
            completedSets += exerciseProgress.sets.filter(set => set.completed).length;
          }
        });
      }
    });
    
    if (totalSets === 0) return 0;
    return Math.round((completedSets / totalSets) * 100);
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
          
          // Parse format: "Exercise Name — Sets×Reps @ Weight lb"
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
            // Parse sets×reps (e.g., "3×10" or "4×8-12")
            const setsRepsMatch = detailsPart.match(/(\d+)\s*[×x]\s*(\d+)(?:[-–](\d+))?/i);
            
            // Parse weight (e.g., "@ 100 lb" or "@ 25 lb")
            const weightMatch = detailsPart.match(/@\s*(\d+(?:\.\d+)?)/);
            
            if (setsRepsMatch) {
              const sets = parseInt(setsRepsMatch[1]);
              const repsMin = parseInt(setsRepsMatch[2]);
              const repsMax = setsRepsMatch[3] ? parseInt(setsRepsMatch[3]) : repsMin;
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
                };
                await addExercise(newExercise);
                // Small delay to prevent ID collisions
                await new Promise(resolve => setTimeout(resolve, 10));
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
      console.log('📊 Templates created:');
      allWorkoutTemplates.forEach(t => {
        console.log(`  Week ${t.week}, Day ${t.dayOfWeek}: ${t.name} (${t.exercises.length} exercises)`);
        t.exercises.forEach(ex => {
          const exerciseName = exercises.find(e => e.id === ex.exerciseId)?.name || 'Unknown';
          console.log(`    - ${exerciseName}: ${ex.targetSets}×${ex.targetRepsMin} @ ${ex.targetWeight}lbs`);
        });
      });
      console.log('✅ Assigned workouts for cycle');
      
      setWorkoutDetails('');
      setShowBottomSheet(false);
    } catch (error) {
      console.error('Error creating cycle:', error);
      Alert.alert('Error', 'Failed to create cycle. Please try again.');
    }
  };
  
  return (
    <View style={styles.gradient}>
      <SafeAreaView style={[styles.container, { paddingBottom: 88 }]} edges={[]}>
        {/* Header - Fixed */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.topBar}>
            <Text style={styles.headerTitle}>Workouts</Text>
            <ProfileAvatar 
              onPress={() => navigation.navigate('Profile')}
              size={40}
              backgroundColor="#9E9E9E"
              textColor="#FFFFFF"
              showInitial={true}
            />
          </View>
        </View>
        
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {cycles.length === 0 ? (
            <>
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
                    navigation.navigate('CreateCycleBasics');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.manuallyButtonText}>Manually</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.aiButton}
                  onPress={() => {
                    navigation.navigate('AIWorkoutCreation' as never);
                  }}
                  activeOpacity={0.8}
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
                        <TouchableOpacity
                          style={styles.templateCard}
                          onPress={() => {
                            setPrefs({ daysPerWeek: template.idealDays[0] || 3, sessionMinutes: 60 });
                            startDraftFromTemplate(template.id);
                            navigation.navigate('TemplateEditor', { templateId: template.id });
                          }}
                          activeOpacity={0.8}
                        >
                        <View style={styles.templateCardContent}>
                            <Text style={styles.templateName}>{template.name}</Text>
                            <Text style={styles.templateDescription}>{template.description}</Text>
                          </View>
                        <View style={styles.triangle} />
                        </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <>
              {/* Active Cycle */}
              {cycles.filter(c => c.isActive).length > 0 && (
                <>
                  <Text style={styles.inProgressTitle}>In progress</Text>
                  {cycles.filter(c => c.isActive).map((cycle) => {
                    const completion = getCycleCompletion(cycle.id);
                    return (
                      <View key={cycle.id} style={styles.activeCycleSection}>
                        <View style={styles.cycleCardBlackShadow}>
                          <View style={styles.cycleCardWhiteShadow}>
                            <View style={styles.cycleCard}>
                              <TouchableOpacity
                                style={styles.cycleCardContent}
                                onPress={() => navigation.navigate('CycleDetail' as never, { cycleId: cycle.id } as never)}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.cycleName}>Cycle {cycle.cycleNumber}</Text>
                                <Text style={styles.cycleDate}>
                                  {dayjs(cycle.startDate).format('MM.DD.YY')} — {dayjs(cycle.endDate).format('MM.DD.YY')}
                                </Text>
                            <View style={styles.cycleFooter}>
                              <View style={styles.progressIndicator}>
                                <Svg height="16" width="16" viewBox="0 0 16 16" style={styles.progressCircle}>
                                  <Circle cx="8" cy="8" r="8" fill={LIGHT_COLORS.border} />
                                  {completion >= 99.9 ? (
                                    <Circle cx="8" cy="8" r="8" fill={LIGHT_COLORS.text} />
                                  ) : completion > 0 ? (
                                    <Path
                                      d={`M 8 8 L 8 0 A 8 8 0 ${completion / 100 > 0.5 ? 1 : 0} 1 ${
                                        8 + 8 * Math.sin(2 * Math.PI * (completion / 100))
                                      } ${
                                        8 - 8 * Math.cos(2 * Math.PI * (completion / 100))
                                      } Z`}
                                      fill={LIGHT_COLORS.text}
                                    />
                                  ) : null}
                                </Svg>
                                <Text style={styles.progressText}>{completion}%</Text>
                                </View>
                              <View style={styles.seeDetailsButton}>
                                <Text style={styles.seeDetailsText}>See details</Text>
                                <Text style={styles.seeDetailsArrow}>▶</Text>
                              </View>
                            </View>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </>
              )}
              
              {/* Past Cycles */}
              {cycles.filter(c => !c.isActive).length > 0 && (
                <>
                  <Text style={styles.pastCyclesTitle}>Past Cycles</Text>
                  {cycles.filter(c => !c.isActive).sort((a, b) => b.cycleNumber - a.cycleNumber).map((cycle) => (
                    <View key={cycle.id} style={styles.pastCycleCardBlackShadow}>
                      <View style={styles.pastCycleCardWhiteShadow}>
                        <View style={styles.pastCycleCard}>
                          <TouchableOpacity
                            style={styles.pastCycleCardContent}
                            onPress={() => navigation.navigate('CycleDetail' as never, { cycleId: cycle.id } as never)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.pastCycleName}>{cycle.goal || `Cycle ${cycle.cycleNumber}`}</Text>
                            <View style={styles.triangle} />
                          </TouchableOpacity>
                        </View>
                      </View>
            </View>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
        
        {/* Bottom Sheet */}
        <Modal
          visible={showBottomSheet}
          transparent
          animationType="slide"
          onRequestClose={() => setShowBottomSheet(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={styles.bottomSheetOverlay}>
              <TouchableOpacity 
                style={styles.overlayTouchable} 
                activeOpacity={1} 
                onPress={() => setShowBottomSheet(false)}
              />
              <View style={styles.bottomSheet}>
                <View style={styles.handle} />
                
                <View style={styles.sheetContent}>
                  <Text style={styles.sheetTitle}>New Cycle</Text>
                  
                  <TextInput
                    style={styles.textInput}
                    placeholder={`⭐️ WEEK 1\n⸻\nDAY 1 — Push\n\t• Bench Press — 4×8-12 @ 135 lb\n\t• Overhead Press — 3×10 @ 95 lb\n\nDAY 2 — Pull\n\t• Deadlift — 4×5 @ 225 lb\n\t• Barbell Row — 4×10 @ 135 lb`}
                    placeholderTextColor={LIGHT_COLORS.meta}
                    value={workoutDetails}
                    onChangeText={setWorkoutDetails}
                    multiline
                    textAlignVertical="top"
                  />
                  
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleCreateCycle}
                    activeOpacity={1}
                  >
                    <Text style={styles.saveButtonText}>Save and Create</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
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
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 120,
  },
  
  // Header
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
    // Black shadow: -1, -1, 8% opacity, 1px blur
    shadowColor: '#000000',
    shadowOffset: { width: -1, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 2,
    marginBottom: SPACING.xs,
  },
  templateCardWhiteShadow: {
    // Bottom-right shadow: 1, 1, 100% opacity, 1px blur
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 1,
    elevation: 1,
  },
  templateCard: {
    backgroundColor: COLORS.backgroundCanvas,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  templateCardContent: {
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
  
  // Cycles List
  inProgressTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    marginBottom: SPACING.lg,
  },
  activeCycleSection: {
    marginBottom: SPACING.xl,
  },
  cycleCardBlackShadow: CARDS.cardDeep.blackShadow,
  cycleCardWhiteShadow: CARDS.cardDeep.whiteShadow,
  cycleCard: CARDS.cardDeep.outer,
  cycleCardContent: {
    ...CARDS.cardDeep.inner,
    padding: SPACING.xl,
  },
  cycleName: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: 4,
  },
  cycleDate: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: 20,
  },
  cycleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressCircle: {
    // No additional styling needed
  },
  progressText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  seeDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeDetailsText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  seeDetailsArrow: {
    fontSize: 12,
    color: COLORS.accentPrimary,
  },
  
  // Past Cycles
  pastCyclesTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    marginBottom: SPACING.lg,
  },
  pastCycleCardBlackShadow: {
    ...CARDS.cardDeep.blackShadow,
    marginBottom: SPACING.sm,
  },
  pastCycleCardWhiteShadow: CARDS.cardDeep.whiteShadow,
  pastCycleCard: CARDS.cardDeep.outer,
  pastCycleCardContent: {
    ...CARDS.cardDeep.inner,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pastCycleName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  
  // Bottom Sheet
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: SPACING.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: LIGHT_COLORS.textMeta,
    borderRadius: 2,
    borderCurve: 'continuous',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  sheetContent: {
    paddingHorizontal: SPACING.xxl,
  },
  sheetTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.xl,
  },
  textInput: {
    backgroundColor: LIGHT_COLORS.buttonBg,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    fontSize: 16,
    color: LIGHT_COLORS.secondary,
    height: 200,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: LIGHT_COLORS.border,
  },
  saveButton: {
    backgroundColor: LIGHT_COLORS.accentPrimary,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  saveButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});


