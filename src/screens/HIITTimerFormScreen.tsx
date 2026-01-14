import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { TimerValueSheet } from '../components/timer/TimerValueSheet';
import type { HIITTimer } from '../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'HIITTimerForm'>;

const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  text: '#1B1B1B',
  secondary: '#1B1B1B',
  textSecondary: '#3C3C43',
  textMeta: '#817B77',
};

type SheetType = 'work' | 'workRest' | 'sets' | 'rounds' | 'roundRest' | null;

export default function HIITTimerFormScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { mode, timerId } = route.params;
  const { hiitTimers, addHIITTimer, updateHIITTimer, isHIITTimerActive, setActiveHIITTimer } = useStore();
  
  const existingTimer = timerId ? hiitTimers.find(t => t.id === timerId) : undefined;
  
  const [name, setName] = useState(existingTimer?.name || '');
  const [isEditingName, setIsEditingName] = useState(!existingTimer);
  const [work, setWork] = useState<number>(existingTimer?.work || 30);
  const [workRest, setWorkRest] = useState<number>(existingTimer?.workRest || 30);
  const [sets, setSets] = useState<number>(existingTimer?.sets || 3);
  const [rounds, setRounds] = useState<number>(existingTimer?.rounds || 1);
  const [roundRest, setRoundRest] = useState<number>(existingTimer?.roundRest || 30);
  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const [pressedCardId, setPressedCardId] = useState<string | null>(null);
  
  // Track if timer was already saved to prevent duplicates
  const hasSavedRef = useRef(false);

  // Reset saved flag when screen gets focus (for new edits)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      hasSavedRef.current = false;
    });
    return unsubscribe;
  }, [navigation]);

  // Check if there are unsaved changes
  const hasChanges = () => {
    if (mode === 'create') {
      // For new timers, check if anything differs from defaults
      return (
        name !== '' ||
        work !== 30 ||
        workRest !== 30 ||
        sets !== 3 ||
        rounds !== 1 ||
        roundRest !== 30
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

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  // Save timer without navigating
  const handleSave = useCallback(async () => {
    console.log('💾 handleSave called');
    
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name for the timer');
      return { success: false, timerId: null };
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

    // Check if there are changes
    if (mode === 'edit' && !hasChanges()) {
      console.log('✅ No changes to save');
      hasSavedRef.current = true;
      return { success: true, timerId: newTimerId }; // No changes, just return
    }
    
    // Check if timer is currently active in the store
    const isTimerActive = mode === 'edit' && timerId ? isHIITTimerActive(timerId) : false;
    
    console.log('💾 Attempting to save timer:', { mode, timerId, isTimerActive, hasChanges: hasChanges() });
    
    if (isTimerActive) {
      console.log('⚠️ Showing confirmation - timer is active');
      console.log('⚠️ Timer object to save:', timer);
      // Show confirmation that timer will be reset
      return new Promise((resolve) => {
        Alert.alert(
          'Reset Active Timer?',
          'This timer is currently in progress. Saving changes will reset the timer to the beginning.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                console.log('❌ User cancelled save');
                resolve({ success: false, timerId: null });
              },
            },
            {
              text: 'Save & Reset',
              style: 'destructive',
              onPress: async () => {
                console.log('✅ User confirmed save & reset');
                console.log('✅ About to call updateHIITTimer with:', { timerId: timerId!, timer });
                await updateHIITTimer(timerId!, timer);
                console.log('✅ updateHIITTimer completed');
                // Clear active timer after saving
                console.log('🧹 Clearing active timer status after save');
                setActiveHIITTimer(null);
                hasSavedRef.current = true;
                resolve({ success: true, timerId: newTimerId });
              },
            },
          ]
        );
      });
    }
    
    console.log('✅ Saving timer without confirmation');

    // Save timer
    if (mode === 'create') {
      await addHIITTimer(timer);
    } else {
      await updateHIITTimer(timerId!, timer);
    }
    
    hasSavedRef.current = true;
    return { success: true, timerId: newTimerId };
  }, [name, work, workRest, sets, rounds, roundRest, mode, timerId, existingTimer, addHIITTimer, updateHIITTimer, isHIITTimerActive, setActiveHIITTimer, hasChanges]);

  // Warn about unsaved changes when navigating back with back arrow
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', async (e) => {
      console.log('🚪 beforeRemove triggered', { 
        hasChanges: hasChanges(), 
        hasSaved: hasSavedRef.current,
        mode,
        timerId 
      });
      
      // Warn about unsaved changes if there are any AND we haven't already saved
      if (hasChanges() && !hasSavedRef.current) {
        // Prevent default navigation
        e.preventDefault();
        
        console.log('⚠️ Navigating back with unsaved changes, showing discard warning...');
        
        // Show warning that changes will be lost
        Alert.alert(
          'Discard Changes?',
          'Your changes will be lost if you go back without saving.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                console.log('❌ User cancelled navigation, staying on form');
              },
            },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => {
                console.log('✅ User confirmed discard, navigating back without saving');
                
                // Just navigate back without saving
                navigation.dispatch(e.data.action);
              },
            },
          ]
        );
      }
    });

    return unsubscribe;
  }, [navigation, hasChanges, mode, timerId]);

  const handleSaveButtonPress = async () => {
    console.log('💾 Save button pressed');
    
    // Call handleSave which includes the confirmation logic
    const result = await handleSave();
    
    if (result.success && result.timerId) {
      hasSavedRef.current = true;
      // Add small delay to ensure state propagates
      setTimeout(() => {
        if (mode === 'create') {
          // For new timers, navigate to execution screen
          navigation.replace('HIITTimerExecution', { timerId: result.timerId! });
        } else {
          // For edits, just go back
          navigation.goBack();
        }
      }, 50);
    }
  };

  return (
    <View style={styles.container}>
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
            activeOpacity={1}
          >
            {isEditingName ? (
              <TextInput
                style={styles.pageTitleInput}
                value={name}
                onChangeText={setName}
                onBlur={() => setIsEditingName(false)}
                autoFocus
                placeholder="Timer name"
                placeholderTextColor={LIGHT_COLORS.textMeta}
              />
            ) : (
              <View style={styles.pageTitleRow}>
                <Text style={[styles.pageTitle, !name && styles.pageTitlePlaceholder]}>
                  {name || 'Timer name'}
                </Text>
                <IconEdit size={20} color={LIGHT_COLORS.textSecondary} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          bounces={false}
        >
          {/* Exercise Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Exercise</Text>
            
            {/* Move for card */}
            <TouchableOpacity
              onPress={() => setActiveSheet('work')}
              onPressIn={() => setPressedCardId('work')}
              onPressOut={() => setPressedCardId(null)}
              activeOpacity={1}
            >
              <View style={[
                CARDS.cardDeepDimmed.outer,
                styles.card,
                pressedCardId === 'work' && styles.cardPressed
              ]}>
                <View style={[CARDS.cardDeepDimmed.inner, styles.cardInner]}>
                  <Text style={styles.cardLabel}>Move for</Text>
                  <Text style={styles.cardValue}>{formatTime(work)}</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Rest after each exercise card */}
            <TouchableOpacity
              onPress={() => setActiveSheet('workRest')}
              onPressIn={() => setPressedCardId('workRest')}
              onPressOut={() => setPressedCardId(null)}
              activeOpacity={1}
            >
              <View style={[
                CARDS.cardDeepDimmed.outer,
                styles.card,
                pressedCardId === 'workRest' && styles.cardPressed
              ]}>
                <View style={[CARDS.cardDeepDimmed.inner, styles.cardInner]}>
                  <Text style={styles.cardLabel}>Rest after each exercise</Text>
                  <Text style={styles.cardValue}>{formatTime(workRest)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Round Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Round</Text>
            
            {/* Exercises in a round card */}
            <TouchableOpacity
              onPress={() => setActiveSheet('sets')}
              onPressIn={() => setPressedCardId('sets')}
              onPressOut={() => setPressedCardId(null)}
              activeOpacity={1}
            >
              <View style={[
                CARDS.cardDeepDimmed.outer,
                styles.card,
                pressedCardId === 'sets' && styles.cardPressed
              ]}>
                <View style={[CARDS.cardDeepDimmed.inner, styles.cardInner]}>
                  <Text style={styles.cardLabel}>Exercises in a round</Text>
                  <Text style={styles.cardValue}>{sets}</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Rounds card */}
            <TouchableOpacity
              onPress={() => setActiveSheet('rounds')}
              onPressIn={() => setPressedCardId('rounds')}
              onPressOut={() => setPressedCardId(null)}
              activeOpacity={1}
            >
              <View style={[
                CARDS.cardDeepDimmed.outer,
                styles.card,
                pressedCardId === 'rounds' && styles.cardPressed
              ]}>
                <View style={[CARDS.cardDeepDimmed.inner, styles.cardInner]}>
                  <Text style={styles.cardLabel}>Rounds</Text>
                  <Text style={styles.cardValue}>{rounds}</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Rest between rounds card */}
            <TouchableOpacity
              onPress={() => setActiveSheet('roundRest')}
              onPressIn={() => setPressedCardId('roundRest')}
              onPressOut={() => setPressedCardId(null)}
              activeOpacity={1}
            >
              <View style={[
                CARDS.cardDeepDimmed.outer,
                styles.card,
                pressedCardId === 'roundRest' && styles.cardPressed
              ]}>
                <View style={[CARDS.cardDeepDimmed.inner, styles.cardInner]}>
                  <Text style={styles.cardLabel}>Rest between rounds</Text>
                  <Text style={styles.cardValue}>{formatTime(roundRest)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Create/Save Timer Button - Fixed Bottom */}
        <View style={styles.stickyButtonContainer}>
          <TouchableOpacity 
            style={styles.startButton} 
            onPress={handleSaveButtonPress}
            activeOpacity={1}
          >
            <Text style={styles.startButtonText}>{timerId ? 'Save' : 'Create Timer'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Sheets */}
      <TimerValueSheet
        visible={activeSheet === 'work'}
        onClose={() => setActiveSheet(null)}
        onSave={(val) => setWork(val)}
        title="Move for"
        label="Exercise"
        value={work}
        min={5}
        max={120}
        step={5}
        formatValue={formatTime}
      />

      <TimerValueSheet
        visible={activeSheet === 'workRest'}
        onClose={() => setActiveSheet(null)}
        onSave={(val) => setWorkRest(val)}
        title="Rest after each exercise"
        label="Exercise"
        value={workRest}
        min={5}
        max={120}
        step={5}
        formatValue={formatTime}
      />

      <TimerValueSheet
        visible={activeSheet === 'sets'}
        onClose={() => setActiveSheet(null)}
        onSave={(val) => setSets(val)}
        title="Exercises in a round"
        label="Round"
        value={sets}
        min={1}
        max={20}
        step={1}
        formatValue={(val) => `${val}`}
      />

      <TimerValueSheet
        visible={activeSheet === 'rounds'}
        onClose={() => setActiveSheet(null)}
        onSave={(val) => setRounds(val)}
        title="Rounds"
        label="Round"
        value={rounds}
        min={1}
        max={10}
        step={1}
        formatValue={(val) => `${val}`}
      />

      <TimerValueSheet
        visible={activeSheet === 'roundRest'}
        onClose={() => setActiveSheet(null)}
        onSave={(val) => setRoundRest(val)}
        title="Rest between rounds"
        label="Round"
        value={roundRest}
        min={5}
        max={180}
        step={5}
        formatValue={formatTime}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
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
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -4,
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
    color: LIGHT_COLORS.secondary,
  },
  pageTitlePlaceholder: {
    color: LIGHT_COLORS.textMeta,
  },
  pageTitleInput: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: 48,
    paddingBottom: 140, // Space for fixed button + 40px
  },
  section: {
    marginBottom: 56,
  },
  sectionTitle: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
    marginBottom: 16,
  },
  card: {
    marginBottom: 8,
  },
  cardPressed: {
    borderWidth: 1,
    borderColor: LIGHT_COLORS.textMeta,
  },
  cardInner: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLabel: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.secondary,
  },
  cardValue: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.secondary,
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
    backgroundColor: '#000000',
    paddingVertical: SPACING.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

