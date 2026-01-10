import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TodayScreen } from '../screens/TodayScreen';
import { WorkoutsScreen } from '../screens/WorkoutsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { CycleDetailScreen } from '../screens/CycleDetailScreen';
import { WorkoutExecutionScreen } from '../screens/WorkoutExecutionScreen';
import WorkoutEditScreen from '../screens/WorkoutEditScreen';
import { ExerciseDetailScreen } from '../screens/ExerciseDetailScreen';
import { DesignSystemScreen } from '../screens/DesignSystemScreen';
import HIITTimerListScreen from '../screens/HIITTimerListScreen';
import HIITTimerFormScreen from '../screens/HIITTimerFormScreen';
import HIITTimerExecutionScreen from '../screens/HIITTimerExecutionScreen';
import { TemplateEditorScreen } from '../screens/onboarding/TemplateEditorScreen';
import { CustomTemplateInputScreen } from '../screens/onboarding/CustomTemplateInputScreen';
import { ReviewCreateCycleScreen } from '../screens/onboarding/ReviewCreateCycleScreen';
import { CreateCycleBasics } from '../screens/manualCycle/CreateCycleBasics';
import { CreateCycleDaysOverview } from '../screens/manualCycle/CreateCycleDaysOverview';
import { CreateCycleDayEditor } from '../screens/manualCycle/CreateCycleDayEditor';
import { CreateCycleReview } from '../screens/manualCycle/CreateCycleReview';
import { AIWorkoutCreationScreen } from '../screens/AIWorkoutCreationScreen';
import { WorkoutCreationOptionsScreen } from '../screens/WorkoutCreationOptionsScreen';
import { IconCalendar, IconWorkouts, IconStopwatch } from '../components/icons';
import { COLORS, TYPOGRAPHY } from '../constants';
import { useStore } from '../store';
import { CycleTemplateId } from '../types/workout';
import { Weekday } from '../types/manualCycle';

export type RootStackParamList = {
  Tabs: undefined;
  Profile: undefined;
  DesignSystem: undefined;
  CycleDetail: { cycleId: string };
  WorkoutExecution: { workoutTemplateId: string; date: string };
  WorkoutEdit: { cycleId: string; workoutTemplateId: string; date: string };
  ExerciseDetail: { exerciseId: string; workoutKey: string };
  HIITTimerList: undefined;
  HIITTimerForm: { mode: 'create' } | { mode: 'edit'; timerId: string };
  HIITTimerExecution: { timerId: string };
  TemplateEditor: { templateId?: CycleTemplateId };
  CustomTemplateInput: undefined;
  ReviewCreateCycle: undefined;
  CreateCycleBasics: undefined;
  CreateCycleDaysOverview: undefined;
  CreateCycleDayEditor: { weekday: Weekday };
  CreateCycleReview: undefined;
  AIWorkoutCreation: undefined;
  WorkoutCreationOptions: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function TabNavigator() {
  const navigation = useNavigation();
  const { cycles } = useStore();
  const [activeTab, setActiveTab] = React.useState<'Schedule' | 'Workouts'>('Schedule');
  const [isViewingToday, setIsViewingToday] = React.useState(true);
  
  // Animated values for tab widths
  const scheduleWidth = React.useRef(new Animated.Value(140)).current;
  const workoutsWidth = React.useRef(new Animated.Value(100)).current;
  
  // Animated values for label widths (collapse to 0 when inactive)
  const scheduleLabelWidth = React.useRef(new Animated.Value(100)).current;
  const workoutsLabelWidth = React.useRef(new Animated.Value(0)).current;
  
  const switchTab = (tab: 'Schedule' | 'Workouts') => {
    setActiveTab(tab);
    
    if (tab === 'Schedule') {
      // Animate Schedule to active, Workouts to inactive
      Animated.parallel([
        Animated.spring(scheduleWidth, {
          toValue: 140,
          useNativeDriver: false,
          tension: 80,
          friction: 10,
        }),
        Animated.spring(workoutsWidth, {
          toValue: 100,
          useNativeDriver: false,
          tension: 80,
          friction: 10,
        }),
        Animated.spring(scheduleLabelWidth, {
          toValue: 100,
          useNativeDriver: false,
          tension: 80,
          friction: 10,
        }),
        Animated.spring(workoutsLabelWidth, {
          toValue: 0,
          useNativeDriver: false,
          tension: 80,
          friction: 10,
        }),
      ]).start();
    } else {
      // Animate Workouts to active, Schedule to inactive
      Animated.parallel([
        Animated.spring(scheduleWidth, {
          toValue: 100,
          useNativeDriver: false,
          tension: 80,
          friction: 10,
        }),
        Animated.spring(workoutsWidth, {
          toValue: 140,
          useNativeDriver: false,
          tension: 80,
          friction: 10,
        }),
        Animated.spring(scheduleLabelWidth, {
          toValue: 0,
          useNativeDriver: false,
          tension: 80,
          friction: 10,
        }),
        Animated.spring(workoutsLabelWidth, {
          toValue: 100,
          useNativeDriver: false,
          tension: 80,
          friction: 10,
        }),
      ]).start();
    }
  };
  
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.backgroundCanvas }}>
      {/* Screen Content */}
      {activeTab === 'Schedule' ? (
        <TodayScreen 
          onNavigateToWorkouts={() => switchTab('Workouts')} 
          onDateChange={(isToday) => setIsViewingToday(isToday)}
        />
      ) : (
        <WorkoutsScreen />
      )}
      
      {/* Custom Bottom Navigation */}
      <View style={styles.bottomNavContainer}>
        {/* Tab Bar - 240px wide */}
        <View style={styles.tabBar}>
          {/* Schedule Tab */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => switchTab('Schedule')}
          >
            <Animated.View style={[styles.tab, { width: scheduleWidth }]}>
              <IconCalendar 
                size={24} 
                color={activeTab === 'Schedule' ? '#000000' : COLORS.textMeta} 
              />
              <Animated.View style={styles.labelContainer}>
                <Animated.View style={{ maxWidth: scheduleLabelWidth, overflow: 'hidden' }}>
                  <Text style={styles.tabLabel} numberOfLines={1}>Schedule</Text>
                </Animated.View>
              </Animated.View>
            </Animated.View>
          </TouchableOpacity>
          
          {/* Workouts Tab */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => switchTab('Workouts')}
          >
            <Animated.View style={[styles.tab, { width: workoutsWidth }]}>
              <IconWorkouts 
                size={24} 
                color={activeTab === 'Workouts' ? '#000000' : COLORS.textMeta} 
              />
              <Animated.View style={styles.labelContainer}>
                <Animated.View style={{ maxWidth: workoutsLabelWidth, overflow: 'hidden' }}>
                  <Text style={styles.tabLabel} numberOfLines={1}>Workouts</Text>
                </Animated.View>
              </Animated.View>
            </Animated.View>
          </TouchableOpacity>
            </View>
        
        {/* Action Button - Changes based on active tab */}
        {activeTab === 'Schedule' && isViewingToday ? (
          <TouchableOpacity 
            style={styles.actionButton}
            activeOpacity={1}
            onPress={() => navigation.navigate('HIITTimerList' as never)}
          >
            <IconStopwatch size={24} color={COLORS.text} />
            <Text style={styles.actionButtonLabel}>Timer</Text>
          </TouchableOpacity>
        ) : activeTab === 'Workouts' && cycles.length > 0 ? (
          <TouchableOpacity 
            style={styles.actionButton}
            activeOpacity={1}
            onPress={() => navigation.navigate('WorkoutCreationOptions' as never)}
          >
            <IconCalendar size={24} color={COLORS.text} />
            <Text style={styles.actionButtonLabel}>New</Text>
          </TouchableOpacity>
        ) : null}
            </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNavContainer: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabBar: {
    width: 240,
    height: 56,
    backgroundColor: COLORS.backgroundContainer,
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  tab: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  labelContainer: {
    overflow: 'hidden',
  },
  tabLabel: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  actionButton: {
    height: 56,
    minWidth: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionButtonLabel: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
});

// Note: NavigationContainer moved to RootNavigator.tsx for onboarding flow integration
export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="DesignSystem" component={DesignSystemScreen} />
      <Stack.Screen name="CycleDetail" component={CycleDetailScreen} />
      <Stack.Screen name="WorkoutExecution" component={WorkoutExecutionScreen} />
      <Stack.Screen name="WorkoutEdit" component={WorkoutEditScreen} />
      <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} />
      <Stack.Screen name="HIITTimerList" component={HIITTimerListScreen} />
      <Stack.Screen name="HIITTimerForm" component={HIITTimerFormScreen} />
      <Stack.Screen name="HIITTimerExecution" component={HIITTimerExecutionScreen} />
      <Stack.Screen name="TemplateEditor" component={TemplateEditorScreen} />
      <Stack.Screen name="CustomTemplateInput" component={CustomTemplateInputScreen} />
      <Stack.Screen name="ReviewCreateCycle" component={ReviewCreateCycleScreen} />
      <Stack.Screen name="CreateCycleBasics" component={CreateCycleBasics} />
      <Stack.Screen name="CreateCycleDaysOverview" component={CreateCycleDaysOverview} />
      <Stack.Screen name="CreateCycleDayEditor" component={CreateCycleDayEditor} />
      <Stack.Screen name="CreateCycleReview" component={CreateCycleReview} />
      <Stack.Screen name="AIWorkoutCreation" component={AIWorkoutCreationScreen} />
      <Stack.Screen name="WorkoutCreationOptions" component={WorkoutCreationOptionsScreen} />
    </Stack.Navigator>
  );
}


