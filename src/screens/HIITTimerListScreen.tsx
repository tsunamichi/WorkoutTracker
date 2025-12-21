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
  textPrimary: '#000000',
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
            <Text style={styles.pageTitle}>Timer</Text>
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
              activeOpacity={0.7}
            >
              <View style={[CARDS.cardDeep.blackShadow, styles.timerCardBlackShadow]}>
                <View style={[CARDS.cardDeep.whiteShadow, styles.timerCardWhiteShadow]}>
                  <View style={[CARDS.cardDeep.outer, styles.timerCard]}>
                    <View style={[CARDS.cardDeep.inner, styles.timerCardInner]}>
                      <Text style={styles.timerName}>{timer.name}</Text>
                      <View style={styles.timerDetails}>
                        <Text style={styles.timerDetailText}>
                          Work: {formatTime(timer.work)}
                        </Text>
                        <Text style={styles.timerDetailText}>
                          Rest: {formatTime(timer.workRest)}
                        </Text>
                        <Text style={styles.timerDetailText}>
                          {timer.sets} sets × {timer.rounds} rounds
                        </Text>
                      </View>
                      <View style={styles.timerActions}>
                        <TouchableOpacity
                          onPress={() => handleEditTemplate(timer)}
                          style={styles.timerActionButton}
                        >
                          <Text style={styles.timerActionText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteTemplate(timer)}
                          style={styles.timerActionButton}
                        >
                          <Text style={[styles.timerActionText, styles.deleteText]}>Delete</Text>
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
  },
  pageTitleContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  pageTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.textPrimary,
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
    marginBottom: SPACING.md,
  },
  timerCardWhiteShadow: {
    // Shadow layer
  },
  timerCard: {
    // Outer card
  },
  timerCardInner: {
    padding: SPACING.lg,
  },
  timerName: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  timerDetails: {
    marginBottom: SPACING.md,
  },
  timerDetailText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  timerActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  timerActionButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  timerActionText: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textSecondary,
  },
  deleteText: {
    color: '#FF3B30',
  },
});

