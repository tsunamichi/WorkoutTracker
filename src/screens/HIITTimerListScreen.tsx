import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store';
import { COLORS, SPACING, CARDS, TYPOGRAPHY, BORDER_RADIUS, GRADIENTS } from '../constants';
import { IconArrowLeft } from '../components/icons';
import type { HIITTimer } from '../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'HIITTimerList'>;

const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  text: '#1B1B1B',
  secondary: '#1B1B1B',
  textSecondary: '#3C3C43',
  textMeta: '#817B77',
};

export default function HIITTimerListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { hiitTimers, deleteHIITTimer } = useStore();
  
  const templates = hiitTimers.filter(t => t.isTemplate);
  
  // If no timers exist, navigate directly to create screen
  useEffect(() => {
    if (templates.length === 0) {
      navigation.replace('HIITTimerForm', { mode: 'create' });
    }
  }, [templates.length, navigation]);

  const handleCreateNew = () => {
    navigation.navigate('HIITTimerForm', { mode: 'create' });
  };

  const handleSelectTemplate = (timer: HIITTimer) => {
    navigation.navigate('HIITTimerExecution', { timerId: timer.id });
  };

  const handleEditTemplate = (timer: HIITTimer) => {
    navigation.navigate('HIITTimerForm', { mode: 'edit', timerId: timer.id });
  };

  const handleDeleteTemplate = (timer: HIITTimer) => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${timer.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteHIITTimer(timer.id),
        },
      ]
    );
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const calculateTotalTime = (timer: HIITTimer) => {
    // Calculate total time (excluding countdown, matching execution screen logic)
    const totalWorkTime = timer.work * timer.sets * timer.rounds;
    const totalWorkRestTime = timer.workRest * (timer.sets - 1) * timer.rounds; // Rest BETWEEN sets only
    const totalRoundRestTime = timer.roundRest * (timer.rounds - 1); // Rest BETWEEN rounds only
    const totalTime = totalWorkTime + totalWorkRestTime + totalRoundRestTime;
    
    const mins = Math.floor(totalTime / 60);
    const secs = totalTime % 60;
    return secs > 0 ? `${mins}:${secs.toString().padStart(2, '0')}min` : `${mins}:00min`;
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
            <View style={{ width: 48 }} />
          </View>
          
          <View style={styles.pageTitleContainer}>
            <Text style={styles.pageTitle}>Saved timers</Text>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
        >
          {templates.map(timer => (
            <TouchableOpacity
              key={timer.id}
              onPress={() => handleSelectTemplate(timer)}
              onLongPress={() => {
                Alert.alert(
                  timer.name,
                  'What would you like to do?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Edit',
                      onPress: () => handleEditTemplate(timer),
                    },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => handleDeleteTemplate(timer),
                    },
                  ]
                );
              }}
              activeOpacity={0.95}
            >
              <View style={[CARDS.cardDeep.blackShadow, styles.timerCardBlackShadow]}>
                <View style={CARDS.cardDeep.whiteShadow}>
                  <View style={CARDS.cardDeep.outer}>
                    <View style={[CARDS.cardDeep.inner, styles.timerCardInner]}>
                      <Text style={styles.timerName}>{timer.name}</Text>
                      
                      {/* Bottom row with time and start button */}
                      <View style={styles.timerBottom}>
                        <Text style={styles.totalTime}>{calculateTotalTime(timer)}</Text>
                        <TouchableOpacity
                          onPress={() => handleSelectTemplate(timer)}
                          style={styles.startButton}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.startButtonText}>Start</Text>
                          <View style={styles.playIcon} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Create Button - Fixed Bottom */}
        <View style={styles.stickyButtonContainer}>
          <TouchableOpacity 
            style={styles.createButton} 
            onPress={handleCreateNew}
            activeOpacity={1}
          >
            <Text style={styles.createButtonText}>Create New Timer</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
  pageTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.xxl,
    paddingBottom: 140, // Space for fixed button + 40px
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
  createButton: {
    backgroundColor: '#FD6B00',
    paddingVertical: SPACING.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  timerCardBlackShadow: {
    marginBottom: SPACING.lg,
  },
  timerCardInner: {
    paddingHorizontal: 23,
    paddingTop: 15,
    paddingBottom: 19,
  },
  timerName: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.md,
  },
  timerBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalTime: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  startButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: LIGHT_COLORS.secondary,
  },
  playIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: '#FD6B00',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
});

