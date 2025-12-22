import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform, FlatList, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { useStore } from '../store';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { TEMPLATES } from '../data/templates';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

interface WorkoutsScreenProps {
  navigation: any;
}

// Light theme colors matching Today screen
const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  backgroundContainer: '#CDCABB',
  textPrimary: '#000000',
  textSecondary: '#3C3C43',
  textMeta: '#817B77',
  border: '#C7C7CC',
  accentPrimary: '#FD6B00',
  buttonBg: '#F2F2F7',
  buttonText: '#000000',
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_SPACING = 12;
const HORIZONTAL_PADDING = 24;
const CARD_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - CARD_SPACING * 2) / 2.15; // ~2.15 cards in view, 3rd card barely peeks

export function WorkoutsScreen({ navigation }: WorkoutsScreenProps) {
  const insets = useSafeAreaInsets();
  const { cycles, addCycle, getNextCycleNumber, assignWorkout, exercises, addExercise, updateCycle, clearWorkoutAssignmentsForDateRange } = useStore();
  const { startDraftFromTemplate, startDraftFromCustomText, setPrefs } = useOnboardingStore();
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [workoutDetails, setWorkoutDetails] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  
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
    <LinearGradient
      colors={['#E3E6E0', '#D4D6D1']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container} edges={['bottom']}>
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
          {/* Templates or Cycles List */}
          {cycles.length === 0 ? (
            <View style={styles.templatesSection}>
              <Text style={styles.sectionTitle}>Choose a Workout Template</Text>
              
              <FlatList
                ref={flatListRef}
                data={TEMPLATES.filter(t => t.id !== 'custom')}
                horizontal
                pagingEnabled={false}
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + CARD_SPACING}
                decelerationRate="fast"
                contentContainerStyle={styles.carouselContent}
                onScroll={(event) => {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  const page = Math.round(offsetX / (CARD_WIDTH + CARD_SPACING));
                  setCurrentPage(page);
                }}
                scrollEventThrottle={16}
                renderItem={({ item: template }) => (
                  <View style={styles.carouselCard}>
                    <View style={styles.templateCardBlackShadow}>
                      <View style={styles.templateCardWhiteShadow}>
                        <TouchableOpacity
                          style={styles.templateCard}
                          onPress={() => {
                            // Set default preferences
                            setPrefs({ daysPerWeek: template.idealDays[0] || 3, sessionMinutes: 60 });
                            // Start draft from selected template
                            startDraftFromTemplate(template.id);
                            // Navigate to template editor
                            navigation.navigate('TemplateEditor', { templateId: template.id });
                          }}
                          activeOpacity={0.8}
                        >
                          <View style={styles.templateInfo}>
                            <Text style={styles.templateName}>{template.name}</Text>
                            <Text style={styles.templateDescription}>{template.description}</Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
                keyExtractor={(item) => item.id}
              />
              
              {/* Pagination Dots */}
              <View style={styles.pagination}>
                {TEMPLATES.filter(t => t.id !== 'custom').map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.paginationDot,
                      index === currentPage && styles.paginationDotActive,
                    ]}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.cyclesSection}>
              {cycles
                .sort((a, b) => b.cycleNumber - a.cycleNumber)
                .map((cycle, index) => {
                  const isLast = index === cycles.length - 1;
                  return (
                    <View key={cycle.id} style={[styles.cycleCardWrapper, !isLast && styles.cycleCardWrapperMargin]}>
                      <View style={styles.cycleCardBlackShadow}>
                        <View style={styles.cycleCardWhiteShadow}>
                          <View style={styles.cycleCard}>
                            <TouchableOpacity
                              style={styles.cycleCardInner}
                              onPress={() => navigation.navigate('CycleDetail', { cycleId: cycle.id })}
                              activeOpacity={1}
                            >
                              <View style={styles.cycleInfo}>
                                <View>
                                  <Text style={styles.cycleName}>Cycle {cycle.cycleNumber}</Text>
                                  <Text style={styles.cycleDate}>
                                    {dayjs(cycle.startDate).format('MM.DD.YY')}—{cycle.isActive ? 'in progress' : dayjs(cycle.endDate).format('MM.DD.YY')}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.cycleTriangle} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
            </View>
          )}
        </ScrollView>
        
        {/* Create Cycle Button - Sticky Bottom */}
        <View style={styles.stickyButtonContainer}>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => {
              // Navigate to manual cycle creation flow
              navigation.navigate('CreateCycleBasics');
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.createButtonText}>
              {cycles.length === 0 ? 'Create My Own Cycle' : 'Create New Cycle'}
            </Text>
          </TouchableOpacity>
        </View>
        
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: SPACING.xxl,
    paddingBottom: 100,
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
    color: LIGHT_COLORS.textPrimary,
  },
  
  // Sticky Button Container
  stickyButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.md,
    backgroundColor: 'transparent',
  },
  
  // Create Button
  createButton: {
    backgroundColor: LIGHT_COLORS.accentPrimary,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginBottom: 12,
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: LIGHT_COLORS.buttonBg,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: LIGHT_COLORS.buttonText,
  },
  
  // Templates Section
  templatesSection: {
    overflow: 'visible',
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.textPrimary,
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  carouselContent: {
    paddingLeft: 24,
    paddingRight: CARD_SPACING,
    paddingVertical: 4,
  },
  carouselCard: {
    width: CARD_WIDTH,
    marginRight: CARD_SPACING,
    overflow: 'visible',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: LIGHT_COLORS.textMeta,
    opacity: 0.3,
  },
  paginationDotActive: {
    backgroundColor: LIGHT_COLORS.textPrimary,
    opacity: 1,
  },
  templateCardBlackShadow: {
    // Black shadow: -1, -1, 8% opacity, 1px blur
    shadowColor: '#000000',
    shadowOffset: { width: -1, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 2,
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
    backgroundColor: '#E3E3DE',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    minHeight: 120,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textPrimary,
    marginBottom: 4,
  },
  templateDescription: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
    lineHeight: 18,
  },
  
  // Cycles Section
  cyclesSection: {
    gap: 12,
    paddingHorizontal: SPACING.xxl,
  },
  cycleCardWrapper: {
    width: '100%',
  },
  cycleCardWrapperMargin: {
    marginBottom: 12,
  },
  cycleCardBlackShadow: {
    // Black shadow: -1, -1, 8% opacity, 1px blur
    shadowColor: '#000000',
    shadowOffset: { width: -1, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 2,
  },
  cycleCardWhiteShadow: {
    // Bottom-right shadow: 1, 1, 100% opacity, 1px blur
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 1,
    elevation: 1,
  },
  cycleCard: {
    backgroundColor: '#E3E3DE',
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  cycleCardInner: {
    backgroundColor: '#E2E3DF',
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 18,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.75)',
    borderLeftColor: 'rgba(255, 255, 255, 0.75)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cycleInfo: {
    flex: 1,
  },
  cycleTriangle: {
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
  },
  cycleName: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.textPrimary,
  },
  cycleDate: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
    marginTop: 4,
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
    color: LIGHT_COLORS.textPrimary,
    marginBottom: SPACING.xl,
  },
  textInput: {
    backgroundColor: LIGHT_COLORS.buttonBg,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    fontSize: 16,
    color: LIGHT_COLORS.textPrimary,
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
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});


