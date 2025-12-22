import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TodayScreen } from '../screens/TodayScreen';
import { WorkoutsScreen } from '../screens/WorkoutsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { CycleDetailScreen } from '../screens/CycleDetailScreen';
import { WorkoutExecutionScreen } from '../screens/WorkoutExecutionScreen';
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
import { IconCalendar, IconWorkouts } from '../components/icons';
import { COLORS } from '../constants';
import { CycleTemplateId } from '../types/workout';
import { Weekday } from '../types/manualCycle';

export type RootStackParamList = {
  Tabs: undefined;
  Profile: undefined;
  DesignSystem: undefined;
  CycleDetail: { cycleId: string };
  WorkoutExecution: { workoutTemplateId: string; date: string };
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
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_BAR_PRIMARY = '#FD6B00';

function CustomTabBarBackground() {
  return (
    <View style={styles.tabBarBackground}>
      <View style={styles.tabBarBorderTop} />
      <View style={styles.tabBarBorderBottom} />
    </View>
  );
}

function TabNavigator() {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.backgroundCanvas }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: COLORS.backgroundContainer,
            borderTopWidth: 0,
            height: 80,
            position: 'absolute',
            bottom: 8,
            left: 8,
            right: 8,
            borderRadius: 16,
            borderWidth: 3,
            borderColor: 'red',
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            paddingRight: 0,
          },
          tabBarItemStyle: {
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            paddingVertical: 0,
            paddingHorizontal: 0,
            margin: 0,
            borderWidth: 2,
            borderColor: 'yellow',
          },
          tabBarBackground: () => null,
          tabBarActiveTintColor: '#000000',
          tabBarInactiveTintColor: COLORS.textMeta,
        }}
      >
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{
          tabBarIcon: ({ color, focused }) =>
            focused ? (
              <View style={styles.tabWrapper} pointerEvents="box-none">
                <View style={styles.activeTab} pointerEvents="box-none">
                  <IconCalendar size={24} color={color} />
                  <Text style={[styles.activeLabel, { color }]}>Today</Text>
                </View>
              </View>
            ) : (
              <View style={styles.tabWrapper} pointerEvents="box-none">
                <IconCalendar size={24} color={color} />
              </View>
            ),
          tabBarLabel: () => null,
        }}
      />
      <Tab.Screen
        name="Workouts"
        component={WorkoutsScreen}
        options={{
          tabBarIcon: ({ color, focused }) =>
            focused ? (
              <View style={styles.tabWrapper} pointerEvents="box-none">
                <View style={styles.activeTab} pointerEvents="box-none">
                  <IconWorkouts size={24} color={color} />
                  <Text style={[styles.activeLabel, { color }]}>Workouts</Text>
                </View>
              </View>
            ) : (
              <View style={styles.tabWrapper} pointerEvents="box-none">
                <IconWorkouts size={24} color={color} />
              </View>
            ),
          tabBarLabel: () => null,
        }}
      />
    </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarBackground: {
    flex: 1,
    backgroundColor: COLORS.backgroundContainer,
    borderRadius: 16,
    overflow: 'hidden',
  },
  tabBarBorderTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  tabBarBorderBottom: {
    position: 'absolute',
    top: 1,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#FFFFFF',
  },
  tabWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'blue',
  },
  activeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: 'green',
  },
  activeLabel: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 24,
    paddingTop: 1,
    minWidth: 60,
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
    </Stack.Navigator>
  );
}


