import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { ScheduleSetupScreen } from '../screens/onboarding/ScheduleSetupScreen';
import { TemplatePickerScreen } from '../screens/onboarding/TemplatePickerScreen';
import { TemplateEditorScreen } from '../screens/onboarding/TemplateEditorScreen';
import { CustomTemplateInputScreen } from '../screens/onboarding/CustomTemplateInputScreen';
import { ReviewCreateCycleScreen } from '../screens/onboarding/ReviewCreateCycleScreen';

export type OnboardingStackParamList = {
  Welcome: undefined;
  ScheduleSetup: undefined;
  TemplatePicker: undefined;
  TemplateEditor: undefined;
  CustomTemplateInput: undefined;
  ReviewCreateCycle: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerBackTitleVisible: false,
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        headerTintColor: '#FFFFFF',
      }}
    >
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ScheduleSetup"
        component={ScheduleSetupScreen}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="TemplatePicker"
        component={TemplatePickerScreen}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="TemplateEditor"
        component={TemplateEditorScreen}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="CustomTemplateInput"
        component={CustomTemplateInputScreen}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="ReviewCreateCycle"
        component={ReviewCreateCycleScreen}
        options={{ title: '' }}
      />
    </Stack.Navigator>
  );
}

