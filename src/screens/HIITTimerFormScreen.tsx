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
  const { hiitTimers, addHIITTimer, updateHIITTimer } = useStore();
  
  const existingTimer = timerId ? hiitTimers.find(t => t.id === timerId) : undefined;
  
  const [name, setName] = useState(existingTimer?.name || 'Timer name');
  const [isEditingName, setIsEditingName] = useState(false);
  const [work, setWork] = useState<number>(existingTimer?.work || 30);
  const [workRest, setWorkRest] = useState<number>(existingTimer?.workRest || 30);
  const [sets, setSets] = useState<number>(existingTimer?.sets || 3);
  const [rounds, setRounds] = useState<number>(existingTimer?.rounds || 1);
  const [roundRest, setRoundRest] = useState<number>(existingTimer?.roundRest || 30);
  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  
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
        name !== 'Timer name' ||
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
    
    hasSavedRef.current = true;
    return true;
  }, [name, work, workRest, sets, rounds, roundRest, mode, timerId, existingTimer, addHIITTimer, updateHIITTimer]);

  // Auto-save when navigating back if there are changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', async (e) => {
      // Only auto-save if there are changes AND we haven't already saved
      if (hasChanges() && !hasSavedRef.current) {
        // Prevent default navigation
        e.preventDefault();
        
        // Save the timer
        const saved = await handleSave();
        if (saved) {
          hasSavedRef.current = true;
          // Allow navigation after saving
          navigation.dispatch(e.data.action);
        }
      }
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
    
    // Mark as saved to prevent duplicate save on back navigation
    hasSavedRef.current = true;
    
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
            <View style={styles.menuButton}>
              <View style={styles.menuDot} />
              <View style={styles.menuDot} />
              <View style={styles.menuDot} />
            </View>
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
        >
          {/* Exercise Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Exercise</Text>
            
            {/* Move for card */}
            <TouchableOpacity
              onPress={() => setActiveSheet('work')}
              activeOpacity={0.7}
            >
              <View style={[CARDS.cardDeep.blackShadow, styles.cardBlackShadow]}>
                <View style={CARDS.cardDeep.whiteShadow}>
                  <View style={CARDS.cardDeep.outer}>
                    <View style={[CARDS.cardDeep.inner, styles.cardInner]}>
                      <Text style={styles.cardLabel}>Move for</Text>
                      <Text style={styles.cardValue}>{formatTime(work)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* Rest after each exercise card */}
            <TouchableOpacity
              onPress={() => setActiveSheet('workRest')}
              activeOpacity={0.7}
            >
              <View style={[CARDS.cardDeep.blackShadow, styles.cardBlackShadow]}>
                <View style={CARDS.cardDeep.whiteShadow}>
                  <View style={CARDS.cardDeep.outer}>
                    <View style={[CARDS.cardDeep.inner, styles.cardInner]}>
                      <Text style={styles.cardLabel}>Rest after each exercise</Text>
                      <Text style={styles.cardValue}>{formatTime(workRest)}</Text>
                    </View>
                  </View>
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
              activeOpacity={0.7}
            >
              <View style={[CARDS.cardDeep.blackShadow, styles.cardBlackShadow]}>
                <View style={CARDS.cardDeep.whiteShadow}>
                  <View style={CARDS.cardDeep.outer}>
                    <View style={[CARDS.cardDeep.inner, styles.cardInner]}>
                      <Text style={styles.cardLabel}>Exercises in a round</Text>
                      <Text style={styles.cardValue}>{sets}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* Rounds card */}
            <TouchableOpacity
              onPress={() => setActiveSheet('rounds')}
              activeOpacity={0.7}
            >
              <View style={[CARDS.cardDeep.blackShadow, styles.cardBlackShadow]}>
                <View style={CARDS.cardDeep.whiteShadow}>
                  <View style={CARDS.cardDeep.outer}>
                    <View style={[CARDS.cardDeep.inner, styles.cardInner]}>
                      <Text style={styles.cardLabel}>Rounds</Text>
                      <Text style={styles.cardValue}>{rounds}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* Rest between rounds card */}
            <TouchableOpacity
              onPress={() => setActiveSheet('roundRest')}
              activeOpacity={0.7}
            >
              <View style={[CARDS.cardDeep.blackShadow, styles.cardBlackShadow]}>
                <View style={CARDS.cardDeep.whiteShadow}>
                  <View style={CARDS.cardDeep.outer}>
                    <View style={[CARDS.cardDeep.inner, styles.cardInner]}>
                      <Text style={styles.cardLabel}>Rest between rounds</Text>
                      <Text style={styles.cardValue}>{formatTime(roundRest)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Create/Save Timer Button - Fixed Bottom */}
        <View style={styles.stickyButtonContainer}>
          <TouchableOpacity 
            style={styles.startButton} 
            onPress={handleStartNow}
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
  menuButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginRight: -4,
  },
  menuDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: LIGHT_COLORS.secondary,
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
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.textMeta,
    marginBottom: SPACING.lg,
  },
  cardBlackShadow: {
    marginBottom: 8,
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
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

