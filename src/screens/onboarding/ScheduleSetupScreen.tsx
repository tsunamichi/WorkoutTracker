import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { ProgressHeader } from '../../components/common/ProgressHeader';
import { StickyFooter } from '../../components/common/StickyFooter';

type OnboardingStackParamList = {
  ScheduleSetup: undefined;
  TemplatePicker: undefined;
};

type ScheduleSetupScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'ScheduleSetup'>;
};

const DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const SESSION_MINUTES_OPTIONS = [30, 45, 60, 75, 90];

export function ScheduleSetupScreen({ navigation }: ScheduleSetupScreenProps) {
  const { prefs, setPrefs } = useOnboardingStore();
  const [daysPerWeek, setDaysPerWeek] = useState(prefs.daysPerWeek);
  const [sessionMinutes, setSessionMinutes] = useState(prefs.sessionMinutes);

  const handleNext = () => {
    setPrefs({ daysPerWeek, sessionMinutes });
    navigation.navigate('TemplatePicker');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} bounces={false}>
        <ProgressHeader
          stepLabel="Step 1 of 4"
          title="Set your schedule"
        />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>How many days per week can you train?</Text>
          <View style={styles.chipContainer}>
            {DAYS_OPTIONS.map((days) => (
              <TouchableOpacity
                key={days}
                style={[
                  styles.chip,
                  daysPerWeek === days && styles.chipSelected,
                ]}
                onPress={() => setDaysPerWeek(days)}
              >
                <Text
                  style={[
                    styles.chipText,
                    daysPerWeek === days && styles.chipTextSelected,
                  ]}
                >
                  {days}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>How long is each session?</Text>
          <View style={styles.chipContainer}>
            {SESSION_MINUTES_OPTIONS.map((minutes) => (
              <TouchableOpacity
                key={minutes}
                style={[
                  styles.chip,
                  styles.chipWide,
                  sessionMinutes === minutes && styles.chipSelected,
                ]}
                onPress={() => setSessionMinutes(minutes)}
              >
                <Text
                  style={[
                    styles.chipText,
                    sessionMinutes === minutes && styles.chipTextSelected,
                  ]}
                >
                  {minutes} min
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <StickyFooter
        buttonText="Next"
        onPress={handleNext}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#E3E6E0',
    minWidth: 50,
    alignItems: 'center',
  },
  chipWide: {
    minWidth: 80,
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
});

