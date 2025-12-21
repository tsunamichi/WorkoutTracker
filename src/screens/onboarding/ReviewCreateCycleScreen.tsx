import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { useStore } from '../../store';
import { ProgressHeader } from '../../components/common/ProgressHeader';
import { StickyFooter } from '../../components/common/StickyFooter';
import { convertOnboardingCycleToAppCycle } from '../../utils/convertOnboardingCycle';
import { generateRandomWorkoutAssignments } from '../../utils/assignCycleWorkouts';

type OnboardingStackParamList = {
  ReviewCreateCycle: undefined;
  TemplateEditor: undefined;
};

type RootStackParamList = {
  OnboardingStack: undefined;
  AppTabs: undefined;
};

type ReviewCreateCycleScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList & RootStackParamList, 'ReviewCreateCycle'>;
};

const CYCLE_LENGTH_OPTIONS = [4, 6, 8];

export function ReviewCreateCycleScreen({ navigation }: ReviewCreateCycleScreenProps) {
  const { draft, finalizeCycle } = useOnboardingStore();
  const { addCycle, addExercise, getNextCycleNumber, assignWorkout, exercises: existingExercises } = useStore();
  const [cycleLengthWeeks, setCycleLengthWeeks] = useState(6);

  const handleEditDay = () => {
    if (!draft) return;

    if (draft.source === 'template' || draft.source === 'custom_text') {
      navigation.navigate('TemplateEditor');
    }
  };

  const handleCreateCycle = async () => {
    const success = await finalizeCycle(cycleLengthWeeks);
    
    if (success && draft) {
      try {
        // Get the saved cycle from onboarding store
        const onboardingStore = useOnboardingStore.getState();
        const savedCycle = onboardingStore.savedCycles.find(c => c.id === onboardingStore.activeCycleId);
        
        if (savedCycle) {
          // Convert to app's Cycle format (pass existing exercises to reuse them)
          const cycleNumber = getNextCycleNumber();
          const { cycle: appCycle, exercises } = convertOnboardingCycleToAppCycle(
            savedCycle, 
            cycleNumber, 
            existingExercises
          );
          
          // Save all NEW exercises (existing ones are already in the store)
          for (const exercise of exercises) {
            await addExercise(exercise);
          }
          
          // Then save the cycle
          await addCycle(appCycle);
          
          console.log('✅ Cycle created successfully:', appCycle.id);
          console.log('✅ Added', exercises.length, 'exercises');
          
          // Generate and assign workouts to specific days
          const workoutAssignments = generateRandomWorkoutAssignments(appCycle);
          console.log('📅 Assigning', workoutAssignments.length, 'workouts to calendar...');
          
          for (const assignment of workoutAssignments) {
            await assignWorkout(assignment.date, assignment.workoutTemplateId, assignment.cycleId);
          }
          
          console.log('✅ Workout schedule created successfully!');
        }
        
        // Navigate to main app
        // @ts-ignore - navigation will be properly typed when integrated
        navigation.reset({
          index: 0,
          routes: [{ name: 'AppTabs' }],
        });
      } catch (error) {
        console.error('Failed to save cycle to main store:', error);
        Alert.alert(
          'Error',
          'Failed to save your workout cycle. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } else {
      Alert.alert(
        'Cannot create cycle',
        'Please make sure all days have at least one exercise.',
        [{ text: 'OK' }]
      );
    }
  };

  if (!draft) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>No draft found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ProgressHeader
          stepLabel="Step 4 of 4"
          title="Review your cycle"
        />

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{draft.templateName}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Training days:</Text>
            <Text style={styles.summaryValue}>{draft.prefs.daysPerWeek}/week</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Session length:</Text>
            <Text style={styles.summaryValue}>{draft.prefs.sessionMinutes} min</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total exercises:</Text>
            <Text style={styles.summaryValue}>
              {draft.days.reduce((sum, day) => sum + day.exercises.length, 0)}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Cycle Length</Text>
        </View>
        <View style={styles.chipContainer}>
          {CYCLE_LENGTH_OPTIONS.map((weeks) => (
            <TouchableOpacity
              key={weeks}
              style={[
                styles.chip,
                cycleLengthWeeks === weeks && styles.chipSelected,
              ]}
              onPress={() => setCycleLengthWeeks(weeks)}
            >
              <Text
                style={[
                  styles.chipText,
                  cycleLengthWeeks === weeks && styles.chipTextSelected,
                ]}
              >
                {weeks} weeks
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Weekly Schedule</Text>
        </View>

        {draft.days.map((day) => (
          <View key={day.dayIndex} style={styles.dayCard}>
            <View style={styles.dayCardHeader}>
              <Text style={styles.dayCardTitle}>{day.title}</Text>
              <TouchableOpacity onPress={handleEditDay}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.exerciseList}>
              {day.exercises.map((exercise, index) => (
                <View key={exercise.id} style={styles.exerciseItem}>
                  <Text style={styles.exerciseNumber}>{index + 1}.</Text>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    {exercise.sets && exercise.reps && (
                      <Text style={styles.exerciseDetails}>
                        {exercise.sets} × {exercise.reps}
                        {exercise.restSec ? ` • ${exercise.restSec}s rest` : ''}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <StickyFooter
        buttonText="Create cycle"
        onPress={handleCreateCycle}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  summaryCard: {
    backgroundColor: '#FFF5F0',
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FD6B00',
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#817B77',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  sectionHeader: {
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  chipContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 24,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#E3E6E0',
  },
  chipSelected: {
    backgroundColor: '#FD6B00',
  },
  chipText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3C3C43',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  dayCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 24,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  editLink: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FD6B00',
  },
  exerciseList: {
    gap: 8,
  },
  exerciseItem: {
    flexDirection: 'row',
    gap: 8,
  },
  exerciseNumber: {
    fontSize: 14,
    color: '#817B77',
    fontWeight: '500',
    minWidth: 20,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 2,
  },
  exerciseDetails: {
    fontSize: 13,
    color: '#817B77',
  },
});

