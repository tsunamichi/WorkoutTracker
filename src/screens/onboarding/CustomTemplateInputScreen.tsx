import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { ProgressHeader } from '../../components/common/ProgressHeader';
import { StickyFooter } from '../../components/common/StickyFooter';
import { COLORS } from '../../constants';

type OnboardingStackParamList = {
  CustomTemplateInput: undefined;
  ReviewCreateCycle: undefined;
};

type CustomTemplateInputScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'CustomTemplateInput'>;
};

const EXAMPLE_PLAN = `Day 1: Push
Bench Press - 4x5
Incline Dumbbell Press - 3x8-10
Overhead Press - 3x8
Lateral Raise - 3x12-15
Triceps Pushdown - 3x12

Day 2: Pull
Pull-ups - 4x6-8
Barbell Row - 4x8
Lat Pulldown - 3x10-12
Face Pull - 3x15-20
Dumbbell Curl - 3x10

Day 3: Legs
Squat - 4x6-8
Romanian Deadlift - 3x8-10
Leg Curl - 3x10-12
Leg Extension - 3x12
Calf Raise - 4x15-20`;

export function CustomTemplateInputScreen({ navigation }: CustomTemplateInputScreenProps) {
  const { draft, setRawText, parseRawTextIntoDraft } = useOnboardingStore();
  const [text, setText] = useState(draft?.rawText || '');

  const handleInsertExample = () => {
    setText(EXAMPLE_PLAN);
  };

  const handleClear = () => {
    Alert.alert(
      'Clear text?',
      'Are you sure you want to clear all text?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => setText('') },
      ]
    );
  };

  const handleParseAndReview = () => {
    setRawText(text);
    parseRawTextIntoDraft();
    navigation.navigate('ReviewCreateCycle');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} bounces={false}>
        <ProgressHeader
          stepLabel="Step 3 of 4"
          title="Paste your workout plan"
        />

        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsText}>
            Paste your workout plan below. We'll do our best to parse it into a structured format.
          </Text>
          <Text style={styles.instructionsHint}>
            Tip: Include day names (Day 1, Push, etc.) and exercise details like "3x8" or "4 sets of 10 reps".
          </Text>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            multiline
            placeholder="Day 1: Push&#10;Bench Press - 4x5&#10;Incline Press - 3x8&#10;..."
            value={text}
            onChangeText={setText}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionButton} onPress={handleInsertExample}>
            <Text style={styles.quickActionText}>Insert example</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionButton} onPress={handleClear}>
            <Text style={styles.quickActionText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <StickyFooter
        buttonText="Parse & review"
        onPress={handleParseAndReview}
        disabled={!text.trim()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  instructionsCard: {
    backgroundColor: '#FFF5F0',
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FD6B00',
  },
  instructionsText: {
    fontSize: 14,
    color: '#3C3C43',
    lineHeight: 20,
    marginBottom: 8,
  },
  instructionsHint: {
    fontSize: 13,
    color: '#817B77',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  inputContainer: {
    marginHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 300,
  },
  textInput: {
    flex: 1,
    padding: 16,
    fontSize: 15,
    color: '#000000',
    minHeight: 300,
  },
  quickActions: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 12,
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#E3E6E0',
    borderRadius: 8,
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#3C3C43',
  },
});

