import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store';
import { COLORS, SPACING, CARDS, TYPOGRAPHY, GRADIENTS } from '../constants';
import { IconArrowLeft, IconEdit } from '../components/icons';
import { CustomSlider } from '../components/CustomSlider';
import type { HIITTimer } from '../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'HIITTimerForm'>;

const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  text: '#1B1B1B',
  textPrimary: '#000000',
  textSecondary: '#3C3C43',
  textMeta: '#817B77',
};

export default function HIITTimerFormScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { mode, timerId } = route.params;
  const { hiitTimers, addHIITTimer, updateHIITTimer } = useStore();
  
  const existingTimer = timerId ? hiitTimers.find(t => t.id === timerId) : undefined;
  
  const [name, setName] = useState(existingTimer?.name || 'Timer Name');
  const [isEditingName, setIsEditingName] = useState(false);
  const [work, setWork] = useState<number>(existingTimer?.work || 30);
  const [workRest, setWorkRest] = useState<number>(existingTimer?.workRest || 10);
  const [sets, setSets] = useState<number>(existingTimer?.sets || 8);
  const [rounds, setRounds] = useState<number>(existingTimer?.rounds || 1);
  const [roundRest, setRoundRest] = useState<number>(existingTimer?.roundRest || 60);

  // Check if there are unsaved changes
  const hasChanges = () => {
    if (mode === 'create') {
      // For new timers, check if anything differs from defaults
      return (
        name !== 'Timer Name' ||
        work !== 30 ||
        workRest !== 10 ||
        sets !== 8 ||
        rounds !== 1 ||
        roundRest !== 60
      );
    } else if (existingTimer) {
      // For editing, check if anything changed
      return (
        name !== existingTimer.name ||
        work !== existingTimer.work ||
        workRest !== existingTimer.workRest ||
        sets !== existingTimer.sets ||
        rounds !== existingTimer.rounds ||
        roundRest !== existingTimer.roundRest
      );
    }
    return false;
  };

  // Save timer without navigating
  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name for the timer');
      return false;
    }

    const newTimerId = mode === 'create' ? `hiit-${Date.now()}` : timerId!;
    
    const timer: HIITTimer = {
      id: newTimerId,
      name: name.trim(),
      work,
      workRest,
      sets,
      rounds,
      roundRest,
      createdAt: mode === 'create' ? new Date().toISOString() : existingTimer!.createdAt,
      isTemplate: true,
    };

    // Save timer
    if (mode === 'create') {
      await addHIITTimer(timer);
    } else {
      await updateHIITTimer(timerId!, timer);
    }
    
    return true;
  }, [name, work, workRest, sets, rounds, roundRest, mode, timerId, existingTimer, addHIITTimer, updateHIITTimer]);

  // Intercept back navigation to show warning if there are changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasChanges()) {
        // No changes, allow navigation
        return;
      }

      // Prevent default behavior
      e.preventDefault();

      // Show alert
      Alert.alert(
        'Save changes?',
        'You have unsaved changes. What would you like to do?',
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
          {
            text: 'Save',
            onPress: async () => {
              const saved = await handleSave();
              if (saved) {
                navigation.dispatch(e.data.action);
              }
            },
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, name, work, workRest, sets, rounds, roundRest, mode, existingTimer, handleSave]);

  const handleStartNow = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name for the timer');
      return;
    }

    const newTimerId = mode === 'create' ? `hiit-${Date.now()}` : timerId!;
    
    const timer: HIITTimer = {
      id: newTimerId,
      name: name.trim(),
      work,
      workRest,
      sets,
      rounds,
      roundRest,
      createdAt: mode === 'create' ? new Date().toISOString() : existingTimer!.createdAt,
      isTemplate: true,
    };

    // Save timer
    if (mode === 'create') {
      await addHIITTimer(timer);
    } else {
      await updateHIITTimer(timerId!, timer);
    }
    
    // Navigate to execution
    navigation.replace('HIITTimerExecution', { timerId: newTimerId });
  };

  return (
    <LinearGradient
      colors={GRADIENTS.backgroundLight.colors}
      start={GRADIENTS.backgroundLight.start}
      end={GRADIENTS.backgroundLight.end}
      style={styles.container}
    >
      <View style={styles.innerContainer}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <IconArrowLeft size={24} color={LIGHT_COLORS.text} />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={styles.pageTitleContainer}
            onPress={() => setIsEditingName(true)}
            activeOpacity={0.7}
          >
            {isEditingName ? (
              <TextInput
                style={styles.pageTitleInput}
                value={name}
                onChangeText={setName}
                onBlur={() => setIsEditingName(false)}
                autoFocus
                placeholder="Timer Name"
                placeholderTextColor={LIGHT_COLORS.textMeta}
              />
            ) : (
              <View style={styles.pageTitleRow}>
                <Text style={styles.pageTitle}>{name}</Text>
                <IconEdit size={20} color={LIGHT_COLORS.textSecondary} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={false}
          bounces={false}
        >
          <View style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Work</Text>
              <View style={styles.sliderWrapper}>
                <CustomSlider
                  value={work}
                  onValueChange={(val) => setWork(val)}
                  min={5}
                  max={90}
                  step={5}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Work Rest</Text>
              <View style={styles.sliderWrapper}>
                <CustomSlider
                  value={workRest}
                  onValueChange={(val) => setWorkRest(val)}
                  min={5}
                  max={90}
                  step={5}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Sets</Text>
              <View style={styles.sliderWrapper}>
                <CustomSlider
                  value={sets}
                  onValueChange={(val) => setSets(val)}
                  min={1}
                  max={20}
                  step={1}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Rounds</Text>
              <View style={styles.sliderWrapper}>
                <CustomSlider
                  value={rounds}
                  onValueChange={(val) => setRounds(val)}
                  min={1}
                  max={10}
                  step={1}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Round Rest</Text>
              <View style={styles.sliderWrapper}>
                <CustomSlider
                  value={roundRest}
                  onValueChange={(val) => setRoundRest(val)}
                  min={5}
                  max={90}
                  step={5}
                />
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Start Now Button - Fixed Bottom */}
        <View style={styles.stickyButtonContainer}>
          <TouchableOpacity 
            style={styles.startButton} 
            onPress={handleStartNow}
            activeOpacity={1}
          >
            <Text style={styles.startButtonText}>Start Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
  },
  header: {
    paddingBottom: SPACING.md,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  pageTitleContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  pageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  pageTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.textPrimary,
  },
  pageTitleInput: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.xxl,
    paddingBottom: 140, // Space for fixed button + 40px
  },
  form: {
    ...CARDS.cardDeep,
    paddingVertical: SPACING.lg,
    paddingHorizontal: 0,
  },
  formGroup: {
    marginBottom: SPACING.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    flex: 0,
    minWidth: 100,
  },
  sliderWrapper: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  stickyButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 40, // 40px spacing below button
    paddingTop: SPACING.md,
    backgroundColor: 'transparent',
  },
  startButton: {
    backgroundColor: '#FD6B00',
    paddingVertical: SPACING.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

