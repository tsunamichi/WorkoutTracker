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
import { IconArrowLeft, IconPlay, IconAdd } from '../components/icons';
import { DiagonalLinePattern } from '../components/common/DiagonalLinePattern';
import type { HIITTimer } from '../types';
import type { BonusLog } from '../types/training';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTranslation } from '../i18n/useTranslation';
import dayjs from 'dayjs';

type Props = NativeStackScreenProps<RootStackParamList, 'HIITTimerList'>;

const LIGHT_COLORS = {
  backgroundCanvas: '#0D0D0D',
  text: '#FFFFFF',
  secondary: '#FFFFFF',
  textSecondary: '#AEAEB2',
  textMeta: '#8E8E93',
};

export default function HIITTimerListScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { hiitTimers, deleteHIITTimer, addBonusLog } = useStore();
  const { t } = useTranslation();
  const bonusMode = route.params?.bonusMode === true;
  
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

  const handleSelectTemplate = async (timer: HIITTimer) => {
    if (bonusMode) {
      const today = dayjs().format('YYYY-MM-DD');
      const log: BonusLog = {
        id: `bonus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date: today,
        type: 'timer',
        presetId: timer.id,
        presetName: timer.name,
        createdAt: new Date().toISOString(),
        status: 'planned',
        completedAt: null,
        timerPayload: { timerTemplateId: timer.id },
      };
      await addBonusLog(log);
      navigation.goBack();
      return;
    }
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
    <View style={styles.container}>
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
            <Text style={styles.pageTitle}>{t('savedTimers')}</Text>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          bounces={false}
        >
          <View style={styles.grid}>
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
              activeOpacity={1}
                style={styles.timerCard}
            >
                <View style={CARDS.cardDeepDimmed.outer}>
                <View style={[CARDS.cardDeepDimmed.inner, styles.timerCardInner]}>
                  <Text style={styles.timerName}>{timer.name}</Text>
                    <Text style={styles.totalTime}>{calculateTotalTime(timer)}</Text>
                    <TouchableOpacity
                      onPress={() => handleSelectTemplate(timer)}
                      style={styles.startButton}
                      activeOpacity={1}
                    >
                      <Text style={styles.startButtonText}>{t('start')}</Text>
                      <IconPlay size={10} color={COLORS.accentPrimary} />
                    </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}
          </View>
          <TouchableOpacity
            style={styles.addTimerCardButton}
            onPress={handleCreateNew}
            activeOpacity={0.7}
          >
            <DiagonalLinePattern width="100%" height={56} borderRadius={16} />
            <IconAdd size={24} color={COLORS.text} />
            <Text style={styles.addTimerCardText}>Add timer</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: SPACING.md,
    rowGap: SPACING.md,
  },
  timerCard: {
    width: '48%',
  },
  timerCardInner: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: 24,
  },
  timerName: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: 4,
  },
  totalTime: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  startButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
  },
  addTimerCardButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 48,
    overflow: 'hidden',
  },
  addTimerCardText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
});

