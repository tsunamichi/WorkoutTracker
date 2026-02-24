import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Animated, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TodayScreen } from '../screens/TodayScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { PlanHistoryDetailScreen } from '../screens/PlanHistoryDetailScreen';
import { WorkoutBuilderScreen } from '../screens/WorkoutBuilderScreen';
import { WorkoutTemplateDetailScreen } from '../screens/WorkoutTemplateDetailScreen';
import { WarmupEditorScreen } from '../screens/WarmupEditorScreen';
import { WarmupExecutionScreen } from '../screens/WarmupExecutionScreen';
import { AccessoriesEditorScreen } from '../screens/AccessoriesEditorScreen';
import { AccessoriesExecutionScreen } from '../screens/AccessoriesExecutionScreen';
import { ExerciseExecutionScreen } from '../screens/ExerciseExecutionScreen';
import { WorkoutsScreen } from '../screens/WorkoutsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { BodyWeightHistoryScreen } from '../screens/BodyWeightHistoryScreen';
import { ProgressHomeScreen } from '../screens/ProgressHomeScreen';
import { LiftHistoryScreen } from '../screens/LiftHistoryScreen';
import { EditKeyLiftsScreen } from '../screens/EditKeyLiftsScreen';
import { PhotoViewerScreen } from '../screens/PhotoViewerScreen';
import { BonusPresetPickerScreen } from '../screens/BonusPresetPickerScreen';
import { BonusDetailScreen } from '../screens/BonusDetailScreen';
import { CycleDetailScreen } from '../screens/CycleDetailScreen';
import { CyclePlanDetailScreen } from '../screens/CyclePlanDetailScreen';
import { CycleConflictsScreen } from '../screens/CycleConflictsScreen';
// import { WorkoutExecutionScreen } from '../screens/WorkoutExecutionScreen'; // Removed - navigating directly to ExerciseExecution
import WorkoutEditScreen from '../screens/WorkoutEditScreen';
import { ExerciseDetailScreen } from '../screens/ExerciseDetailScreen';
import { DesignSystemScreen } from '../screens/DesignSystemScreen';
import HIITTimerListScreen from '../screens/HIITTimerListScreen';
import HIITTimerFormScreen from '../screens/HIITTimerFormScreen';
import HIITTimerExecutionScreen from '../screens/HIITTimerExecutionScreen';
import { TemplateEditorScreen } from '../screens/onboarding/TemplateEditorScreen';
import { CustomTemplateInputScreen } from '../screens/onboarding/CustomTemplateInputScreen';
import { ReviewCreateCycleScreen } from '../screens/onboarding/ReviewCreateCycleScreen';
import { CreateCycleFlow } from '../screens/manualCycle/CreateCycleFlow';
import { CreateCycleDayEditor } from '../screens/manualCycle/CreateCycleDayEditor';
import { AIWorkoutCreationScreen } from '../screens/AIWorkoutCreationScreen';
import { WorkoutCreationOptionsScreen } from '../screens/WorkoutCreationOptionsScreen';
import { IconCalendar, IconHistory, IconSwap, IconAdd, IconStopwatch, IconPlay, IconRestart } from '../components/icons';
import { COLORS, TYPOGRAPHY, SPACING, CARDS, BORDER_RADIUS } from '../constants';
import { useStore } from '../store';
import { CycleTemplateId } from '../types/workout';
import { Weekday } from '../types/manualCycle';
import { navigate } from './navigationService';
import { BottomDrawer } from '../components/common/BottomDrawer';
import { AddWorkoutSheet } from '../components/AddWorkoutSheet';
import { PlanSelectionSheet } from '../components/PlanSelectionSheet';
import { ExtractDayFromPlanSheet } from '../components/ExtractDayFromPlanSheet';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import { useTranslation } from '../i18n/useTranslation';

export type RootStackParamList = {
  Tabs: { initialTab?: 'Schedule' | 'Progress' } | undefined;
  Profile: { mode?: 'settings' } | undefined;
  BodyWeightHistory: undefined;
  History: undefined;
  PlanHistoryDetail: { programId: string; programName: string };
  WorkoutBuilder: undefined;
  Workouts: undefined;
  WorkoutTemplateDetail: { templateId: string };
  WarmupEditor: { templateId: string; workoutKey?: string };
  WarmupExecution: { workoutKey: string; workoutTemplateId: string };
  AccessoriesEditor: { templateId: string; workoutKey?: string };
  AccessoriesExecution: { workoutKey: string; workoutTemplateId: string };
  ExerciseExecution: { workoutKey: string; workoutTemplateId: string; type: 'warmup' | 'main' | 'core'; bonusLogId?: string };
  DesignSystem: undefined;
  CycleDetail: { cycleId: string };
  CyclePlanDetail: { planId: string };
  CycleConflicts: { plan: any; conflicts: any[]; planId?: string; fromPauseShift?: boolean; resumeDate?: string };
  WorkoutExecution: { workoutId?: string; cycleId?: string; templateId?: string; workoutTemplateId?: string; date: string; isLocked?: boolean };
  WorkoutEdit: { cycleId: string; workoutTemplateId: string; date: string };
  ExerciseDetail: { exerciseId: string; workoutKey: string };
  HIITTimerList: { bonusMode?: boolean } | undefined;
  HIITTimerForm: { mode: 'create' } | { mode: 'edit'; timerId: string };
  HIITTimerExecution: { timerId: string; bonusLogId?: string };
  TemplateEditor: { templateId?: CycleTemplateId };
  CustomTemplateInput: undefined;
  ReviewCreateCycle: undefined;
  CreateCycleFlow: { selectedDate?: string };
  CreateCycleDayEditor: { weekday: Weekday };
  AIWorkoutCreation: { mode?: 'single' | 'plan' } | undefined;
  WorkoutCreationOptions: undefined;
  LiftHistory: { exerciseId: string; exerciseName: string };
  PhotoViewer: { photoId: string };
  EditKeyLifts: undefined;
  BonusPresetPicker: { bonusType: 'timer' | 'warmup' | 'core' };
  BonusDetail: { bonusLogId: string };
  ProgressTab: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_ICON_SIZE = 24;
const TAB_ICON_GAP = 4;
const LABEL_CENTER_OFFSET = (TAB_ICON_SIZE + TAB_ICON_GAP) / 2;

// Dark theme colors for swap drawer
const LIGHT_COLORS = {
  secondary: '#FFFFFF',
  textMeta: '#8E8E93',
  border: '#38383A',
};

function TabNavigator() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { cycles, cyclePlans, getActiveCyclePlan, getCyclePlanEffectiveEndDate, swapWorkoutAssignments, workoutTemplates, scheduleWorkout, scheduledWorkouts, getMainCompletion, detectCycleConflicts, applyCyclePlan, updateCyclePlan, repeatCyclePlan } = useStore();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<'Schedule' | 'Progress'>('Schedule');
  const [isViewingToday, setIsViewingToday] = React.useState(true);
  const [swapDrawerVisible, setSwapDrawerVisible] = React.useState(false);
  const [swapDrawerData, setSwapDrawerData] = React.useState<{ selectedDate: string; weekDays: any[]; isRestDay?: boolean } | null>(null);
  const [pressedSwapItemDate, setPressedSwapItemDate] = React.useState<string | null>(null);
  
  // NEW: State for Add Workout flow
  const [addWorkoutSheetVisible, setAddWorkoutSheetVisible] = React.useState(false);
  const [addWorkoutDate, setAddWorkoutDate] = React.useState<string>('');
  const [planSelectionSheetVisible, setPlanSelectionSheetVisible] = React.useState(false);
  const [extractDaySheetVisible, setExtractDaySheetVisible] = React.useState(false);
  const [selectedPlanForExtract, setSelectedPlanForExtract] = React.useState<string | null>(null);
  const [bonusDrawerVisible, setBonusDrawerVisible] = React.useState(false);
  
  // Animated value for tab indicator position (0 = Schedule, 1 = Progress)
  const indicatorPosition = React.useRef(new Animated.Value(0)).current;
  const scheduleIconOpacity = React.useRef(new Animated.Value(1)).current;
  const progressIconOpacity = React.useRef(new Animated.Value(0)).current;
  const [tabBarWidth, setTabBarWidth] = React.useState(0);
  
  // Animate label colors: dark on active lime pill, muted when inactive
  const scheduleLabelColor = indicatorPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.backgroundCanvas, COLORS.accentPrimary],
  });
  const progressLabelColor = indicatorPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.accentPrimary, COLORS.backgroundCanvas],
  });
  
  const switchTab = React.useCallback((tab: 'Schedule' | 'Progress') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    
    // Animate indicator position with spring
    Animated.spring(indicatorPosition, {
      toValue: tab === 'Schedule' ? 0 : 1,
      useNativeDriver: false,
      tension: 80,
      friction: 12,
    }).start();
    
    // Animate icon opacity with spring
    Animated.parallel([
      Animated.spring(scheduleIconOpacity, {
        toValue: tab === 'Schedule' ? 1 : 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }),
      Animated.spring(progressIconOpacity, {
        toValue: tab === 'Progress' ? 1 : 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      })
    ]).start();
  }, [indicatorPosition, scheduleIconOpacity, progressIconOpacity]);

  React.useEffect(() => {
    const params = (route as { params?: { initialTab?: 'Schedule' | 'Progress' } }).params;
    if (params?.initialTab && params.initialTab !== activeTab) {
      switchTab(params.initialTab);
    }
  }, [route.params]);
  
  const handleTabBarLayout = (event: any) => {
    const { width } = event.nativeEvent.layout;
    setTabBarWidth(width);
  };
  
  const handleOpenSwapDrawer = (selectedDate: string, weekDays: any[], isRestDay?: boolean) => {
    setSwapDrawerData({ selectedDate, weekDays, isRestDay });
    setSwapDrawerVisible(true);
  };
  
  // NEW: Handler for opening Add Workout flow
  const handleOpenAddWorkout = (date: string) => {
    setAddWorkoutDate(date);
    setAddWorkoutSheetVisible(true);
  };
  
  // NEW: Handler for creating blank workout - now opens day/week selector
  const handleCreateBlank = () => {
    console.log('🎯 handleCreateBlank called');
    console.log('   - addWorkoutDate:', addWorkoutDate);
    setAddWorkoutSheetVisible(false);
    (navigation as any).navigate('CreateCycleFlow', { 
      selectedDate: addWorkoutDate,
    });
  };
  
  // NEW: Handler for selecting a template
  const handleSelectTemplate = async (templateId: string) => {
    setAddWorkoutSheetVisible(false);
    
    const result = await scheduleWorkout(addWorkoutDate, templateId, 'manual');
    
    if (!result.success && result.conflict) {
      // Handle conflict - ask user if they want to replace
      const dateStr = dayjs(addWorkoutDate).format('MMM D');
      const conflictWorkout = result.conflict;
      
      // Show native alert with options
      if (typeof window !== 'undefined' && window.confirm) {
        const shouldReplace = window.confirm(
          `${t('workoutExistsOn').replace('{date}', dateStr)}\n\n` +
          `Existing: ${conflictWorkout.titleSnapshot}\n\n` +
          `Replace with the new workout?`
        );
        
        if (shouldReplace) {
          // Try again with replace resolution
          await scheduleWorkout(addWorkoutDate, templateId, 'manual', undefined, 'replace');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        // Fallback for native (use Alert from react-native)
        const { Alert } = require('react-native');
        Alert.alert(
          t('conflictExists'),
          `${t('workoutExistsOn').replace('{date}', dateStr)}\n\nExisting: ${conflictWorkout.titleSnapshot}`,
          [
            { text: t('cancel'), style: 'cancel' },
            {
              text: t('replaceIt'),
              style: 'destructive',
              onPress: async () => {
                await scheduleWorkout(addWorkoutDate, templateId, 'manual', undefined, 'replace');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            }
          ]
        );
      }
    } else {
      // Success - show success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };
  
  // Removed: handleSelectFromPlan - no longer needed
  
  // NEW: Handler for AI creation (defaults to 'plan' mode to handle both single and multi-day)
  const handleCreateWithAI = () => {
    setAddWorkoutSheetVisible(false);
    (navigation as any).navigate('AIWorkoutCreation', { mode: 'plan' });
  };
  
  // Compute latest finished cycle plan info for "Repeat cycle" button
  const latestCycleInfo = React.useMemo(() => {
    const finishedPlans = cyclePlans
      .filter(p => !p.active && (p.archivedAt || p.endedAt))
      .sort((a, b) => {
        const dateA = a.endedAt || a.archivedAt || '';
        const dateB = b.endedAt || b.archivedAt || '';
        return dateB.localeCompare(dateA);
      });
    const latestPlan = finishedPlans[0];
    if (!latestPlan) return null;

    const daysPerWeek = Object.values(latestPlan.templateIdsByWeekday).filter(Boolean).length;
    const workoutCount = daysPerWeek * latestPlan.weeks;

    const uniqueTemplateIds = [...new Set(Object.values(latestPlan.templateIdsByWeekday).filter(Boolean))] as string[];
    const templateNames = uniqueTemplateIds
      .map(id => workoutTemplates.find(wt => wt.id === id)?.name)
      .filter(Boolean) as string[];

    const finishedDate = dayjs(latestPlan.endedAt || latestPlan.archivedAt);
    const now = dayjs();
    const daysAgo = now.diff(finishedDate, 'day');

    let finishedLabel: string;
    if (daysAgo === 0) finishedLabel = t('finishedToday');
    else if (daysAgo === 1) finishedLabel = t('finishedYesterday');
    else finishedLabel = t('finishedDaysAgo').replace('{n}', String(daysAgo));

    return {
      planId: latestPlan.id,
      planName: latestPlan.name,
      workoutCount,
      templateNames,
      finishedLabel,
    };
  }, [cyclePlans, workoutTemplates, t]);

  // Filter out templates that belong to cycle plans so the drawer only shows standalone workouts
  const standaloneTemplates = React.useMemo(() => {
    const cycleTemplateIds = new Set<string>();
    for (const plan of cyclePlans) {
      for (const templateId of Object.values(plan.templateIdsByWeekday)) {
        if (templateId) cycleTemplateIds.add(templateId);
      }
    }
    return workoutTemplates.filter(t => !cycleTemplateIds.has(t.id));
  }, [workoutTemplates, cyclePlans]);

  // Handler for repeating the latest archived cycle with latest exercise logs
  const handleRepeatCycle = async () => {
    setAddWorkoutSheetVisible(false);
    if (!latestCycleInfo) return;

    const newPlanId = await repeatCyclePlan(latestCycleInfo.planId, addWorkoutDate);
    if (!newPlanId) return;

    // Try to apply the new plan
    const result = await applyCyclePlan(newPlanId);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if ('conflicts' in result && result.conflicts.length > 0) {
      // Navigate to conflict resolution screen
      const newPlan = useStore.getState().cyclePlans.find(p => p.id === newPlanId);
      (navigation as any).navigate('CycleConflicts', {
        plan: newPlan,
        conflicts: result.conflicts,
        planId: newPlanId,
      });
    }
  };
  
  // NEW: Handler for extracting a specific day from a plan
  const handleExtractDay = async (templateId: string, templateName: string) => {
    setExtractDaySheetVisible(false);
    setSelectedPlanForExtract(null);
    
    // Schedule the extracted workout on the selected date
    const result = await scheduleWorkout(addWorkoutDate, templateId, 'manual');
    
    if (!result.success && result.conflict) {
      // Handle conflict - show alert with option to replace
      const dateStr = dayjs(addWorkoutDate).format('MMM D');
      const conflictWorkout = result.conflict;
      
      const { Alert } = require('react-native');
      Alert.alert(
        t('conflictExists'),
        `${t('workoutExistsOn').replace('{date}', dateStr)}\n\nExisting: ${conflictWorkout.titleSnapshot}\n\nReplace with "${templateName}"?`,
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('replaceIt'),
            style: 'destructive',
            onPress: async () => {
              await scheduleWorkout(addWorkoutDate, templateId, 'manual', undefined, 'replace');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }
        ]
      );
    } else {
      // Success - show success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };
  
  // NEW: Handler for plan selection
  const handleSelectPlan = async (planId: string, startDate: string) => {
    setPlanSelectionSheetVisible(false);
    
    // Find the plan
    const plan = cyclePlans.find(p => p.id === planId);
    if (!plan) return;
    
    // Update the plan's start date in the store
    await updateCyclePlan(planId, { startDate });
    
    // Get the updated plan (with new start date)
    const updatedPlan = { ...plan, startDate };
    
    // Detect conflicts
    const conflicts = detectCycleConflicts(updatedPlan);
    
    if (conflicts.length > 0) {
      // Navigate to conflict resolution screen
      (navigation as any).navigate('CycleConflicts', {
        plan: updatedPlan,
        conflicts,
        planId,
      });
    } else {
      // No conflicts, apply the plan directly
      const result = await applyCyclePlan(planId);
      
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Optionally show success message
      } else {
        // Show error
        const { Alert } = require('react-native');
        Alert.alert(t('error'), 'Failed to apply plan');
      }
    }
  };
  
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.backgroundCanvas }}>
      {/* Screen Content */}
      {activeTab === 'Schedule' ? (
        <TodayScreen 
          onDateChange={(isToday) => setIsViewingToday(isToday)}
          onOpenSwapDrawer={handleOpenSwapDrawer}
          onOpenAddWorkout={handleOpenAddWorkout}
          onOpenBonusDrawer={() => setBonusDrawerVisible(true)}
        />
      ) : (
        <ProgressHomeScreen navigation={navigation} />
      )}
      
      {/* Custom Bottom Navigation — hidden for v1 */}
      {false && <View style={[styles.bottomNavContainer, { paddingBottom: insets.bottom || 32 }]}>
        {/* Tab Bar - Full width */}
        <View style={styles.tabBar} onLayout={handleTabBarLayout}>
          {/* Animated Active Tab Indicator */}
          {tabBarWidth > 0 && (
            <Animated.View 
              pointerEvents="none"
              style={[
                styles.tabIndicator,
                {
                  transform: [
                    {
                      translateX: indicatorPosition.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, tabBarWidth / 2],
                      })
                    },
                    {
                      scaleX: indicatorPosition.interpolate({
                        inputRange: [0, 0.25, 0.5, 0.75, 1],
                        outputRange: [1, 1.3, 1.4, 1.3, 1],
                      })
                    }
                  ]
                }
              ]}
            />
          )}
          
          {/* Schedule Tab */}
          <Pressable
            testID="bottom-nav-schedule"
            accessibilityRole="button"
            accessibilityLabel="Schedule tab"
            style={styles.tab}
            onPress={() => switchTab('Schedule')}
          >
            <Animated.View 
              style={[
                styles.tabIcon,
                { 
                opacity: scheduleIconOpacity,
                  transform: [
                    {
                      scale: scheduleIconOpacity.interpolate({
                  inputRange: [0, 1],
                        outputRange: [0.85, 1],
                      }),
                    },
                  ],
                }
              ]}
            >
              <IconCalendar 
                size={24} 
                color={activeTab === 'Schedule' ? COLORS.backgroundCanvas : COLORS.accentPrimary} 
              />
            </Animated.View>
            <Animated.View
              style={{
                marginLeft: TAB_ICON_GAP,
                transform: [
                  {
                    translateX: scheduleIconOpacity.interpolate({
                  inputRange: [0, 1],
                      outputRange: [-LABEL_CENTER_OFFSET, 0],
                    }),
                  },
                ],
              }}
            >
              <Animated.Text 
                style={[
                  styles.tabLabel,
                  { color: scheduleLabelColor }
                ]} 
                numberOfLines={1}
              >
                {t('schedule')}
              </Animated.Text>
            </Animated.View>
          </Pressable>
          
          {/* Progress Tab */}
          <Pressable
            testID="bottom-nav-progress"
            accessibilityRole="button"
            accessibilityLabel="Progress tab"
            style={styles.tab}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              switchTab('Progress');
            }}
          >
            <Animated.View 
              style={[
                styles.tabIcon,
                { 
                opacity: progressIconOpacity,
                  transform: [
                    {
                      scale: progressIconOpacity.interpolate({
                  inputRange: [0, 1],
                        outputRange: [0.85, 1],
                      }),
                    },
                  ],
                }
              ]}
            >
              <IconHistory 
                size={24} 
                color={activeTab === 'Progress' ? COLORS.backgroundCanvas : COLORS.accentPrimary} 
              />
            </Animated.View>
            <Animated.View
              style={{
                marginLeft: TAB_ICON_GAP,
                transform: [
                  {
                    translateX: progressIconOpacity.interpolate({
                  inputRange: [0, 1],
                      outputRange: [-LABEL_CENTER_OFFSET, 0],
                    }),
                  },
                ],
              }}
            >
              <Animated.Text 
                style={[
                  styles.tabLabel,
                  { color: progressLabelColor }
                ]} 
                numberOfLines={1}
              >
                {t('progress')}
              </Animated.Text>
            </Animated.View>
          </Pressable>
            </View>
            </View>}
      
      {/* Swap Workout Drawer - Renders at TabNavigator level, above bottom nav */}
      <BottomDrawer
        visible={swapDrawerVisible}
        onClose={() => setSwapDrawerVisible(false)}
      >
        <View style={styles.swapSheetContent}>
          <Text style={styles.swapSheetTitle}>{swapDrawerData?.isRestDay ? t('selectWorkout') : t('swapWorkout')}</Text>
          <ScrollView 
            style={styles.swapSheetScrollView}
            contentContainerStyle={styles.swapSheetScrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
          {swapDrawerData && (() => {
            const { selectedDate } = swapDrawerData;
            const activeCyclePlan = getActiveCyclePlan();

            if (!activeCyclePlan) {
              return (
                <View style={styles.swapSheetEmpty}>
                  <Text style={styles.swapSheetEmptyText}>{t('noOtherDaysThisWeek')}</Text>
                </View>
              );
            }

            const planId = activeCyclePlan.id;
            const cycleStart = dayjs(activeCyclePlan.startDate);
            const effectiveEnd = dayjs(getCyclePlanEffectiveEndDate(activeCyclePlan));

            const cycleWorkouts = scheduledWorkouts.filter(sw => {
              if (sw.source !== 'cycle') return false;
              if (sw.programId !== planId && sw.cyclePlanId !== planId) return false;
              if (sw.date === selectedDate) return false;
              if (sw.date < selectedDate) return false;
              if (dayjs(sw.date).isAfter(effectiveEnd, 'day')) return false;
              const completion = getMainCompletion(sw.id);
              if (sw.isLocked || completion.percentage === 100 || completion.percentage > 0) return false;
              return true;
            }).sort((a, b) => a.date.localeCompare(b.date));

            // Group by week number relative to cycle start
            const weekGroups: { weekNum: number; workouts: typeof cycleWorkouts }[] = [];
            const weekMap = new Map<number, typeof cycleWorkouts>();
            cycleWorkouts.forEach(sw => {
              const weekNum = Math.floor(dayjs(sw.date).diff(cycleStart, 'day') / 7) + 1;
              if (!weekMap.has(weekNum)) weekMap.set(weekNum, []);
              weekMap.get(weekNum)!.push(sw);
            });
            Array.from(weekMap.entries())
              .sort(([a], [b]) => a - b)
              .forEach(([weekNum, workouts]) => weekGroups.push({ weekNum, workouts }));

            if (weekGroups.length === 0) {
              return (
                <View style={styles.swapSheetEmpty}>
                  <Text style={styles.swapSheetEmptyText}>{t('noOtherDaysThisWeek')}</Text>
                </View>
              );
            }

            const totalWeeks = activeCyclePlan.weeks;

            return (
              <>
                {weekGroups.map((group, gIdx) => (
                  <React.Fragment key={group.weekNum}>
                    {totalWeeks > 1 && (
                      <Text style={[styles.swapSheetSectionTitle, gIdx > 0 && { marginTop: SPACING.lg }]}>
                        {`Week ${group.weekNum}`}
                      </Text>
                    )}
                    {group.workouts.map((sw) => (
                      <View key={sw.id} style={styles.swapSheetItemWrapper}>
                        <View style={[
                          styles.swapSheetItem,
                          pressedSwapItemDate === sw.date && styles.swapSheetItemPressed
                        ]}>
                          <TouchableOpacity
                            style={styles.swapSheetItemInner}
                            onPress={async () => {
                              await swapWorkoutAssignments(selectedDate, sw.date);
                              setSwapDrawerVisible(false);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }}
                            onPressIn={() => setPressedSwapItemDate(sw.date)}
                            onPressOut={() => setPressedSwapItemDate(null)}
                            activeOpacity={1}
                          >
                            <View>
                              <Text style={styles.swapSheetItemTitle}>
                                {sw.titleSnapshot}
                              </Text>
                              <Text style={styles.swapSheetItemSubtitle}>
                                {dayjs(sw.date).format('dddd, MMM D')}
                              </Text>
                            </View>
                            {swapDrawerData?.isRestDay ? <IconAdd size={24} color="#817B77" /> : <IconSwap size={24} color="#817B77" />}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </React.Fragment>
                ))}
              </>
            );
          })()}
          </ScrollView>
        </View>
      </BottomDrawer>
      
      {/* Bonus type picker drawer - above bottom nav */}
      <BottomDrawer
        visible={bonusDrawerVisible}
        onClose={() => setBonusDrawerVisible(false)}
        maxHeight="35%"
        scrollable={false}
      >
        {({ requestClose }: { requestClose: () => void }) => (
          <View style={styles.bonusDrawerContent}>
            <Text style={styles.bonusDrawerTitle}>{t('selectBonusType')}</Text>
            <View style={styles.bonusDrawerRow}>
              {([
                { type: 'timer' as const, icon: <IconStopwatch size={22} color={COLORS.text} />, label: t('timer') },
                { type: 'warmup' as const, icon: <IconPlay size={22} color={COLORS.text} />, label: t('warmUp') },
                { type: 'core' as const, icon: <IconRestart size={22} color={COLORS.text} />, label: t('core') },
              ]).map(({ type, icon, label }) => (
                <Pressable
                  key={type}
                  style={styles.bonusDrawerItem}
                  onPress={() => {
                    requestClose();
                    setTimeout(() => {
                      if (type === 'timer') {
                        (navigation as any).navigate('HIITTimerList', { bonusMode: true });
                      } else {
                        (navigation as any).navigate('BonusPresetPicker', { bonusType: type });
                      }
                    }, 300);
                  }}
                >
                  <View style={styles.bonusDrawerIconContainer}>{icon}</View>
                  <Text style={styles.bonusDrawerLabel}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </BottomDrawer>
      
      {/* NEW: Add Workout Sheet - Shows templates + create options */}
      <AddWorkoutSheet
        visible={addWorkoutSheetVisible}
        onClose={() => setAddWorkoutSheetVisible(false)}
        selectedDate={addWorkoutDate}
        workoutTemplates={standaloneTemplates}
        onSelectTemplate={handleSelectTemplate}
        onCreateBlank={handleCreateBlank}
        onCreateWithAI={handleCreateWithAI}
        latestCycleInfo={latestCycleInfo}
        onRepeatCycle={handleRepeatCycle}
      />
      
      {/* NEW: Plan Selection Sheet - Choose cycle plan and start date */}
      <PlanSelectionSheet
        visible={planSelectionSheetVisible}
        onClose={() => setPlanSelectionSheetVisible(false)}
        cyclePlans={cyclePlans}
        onSelectPlan={handleSelectPlan}
      />
      
      {/* NEW: Extract Day from Plan Sheet - Choose specific day from a cycle plan */}
      <ExtractDayFromPlanSheet
        visible={extractDaySheetVisible}
        onClose={() => {
          setExtractDaySheetVisible(false);
          setSelectedPlanForExtract(null);
        }}
        plan={selectedPlanForExtract ? cyclePlans.find(p => p.id === selectedPlanForExtract) || null : null}
        workoutTemplates={workoutTemplates}
        onSelectDay={handleExtractDay}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
  },
  tabBar: {
    flex: 1,
    height: 56,
    backgroundColor: COLORS.accentPrimaryDimmed,
    borderRadius: 28,
    flexDirection: 'row',
    position: 'relative',
    borderWidth: 1,
    borderColor: COLORS.accentPrimary,
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    right: '50%',
    marginRight: 4,
    backgroundColor: COLORS.accentPrimary,
    borderRadius: 24,
    borderWidth: 0,
    borderColor: 'transparent',
    zIndex: 0,
  },
  tab: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabIcon: {
    width: TAB_ICON_SIZE,
    height: TAB_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    ...TYPOGRAPHY.metaBold,
  },
  
  // Swap Drawer Styles
  swapSheetContent: {
    paddingHorizontal: SPACING.xxl,
    flex: 1,
  },
  swapSheetTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.xl,
  },
  swapSheetScrollView: {
    flex: 1,
  },
  swapSheetScrollContent: {
    paddingBottom: SPACING.xl,
  },
  swapSheetSection: {
    marginBottom: SPACING.xl,
  },
  swapSheetSectionTitle: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  createNewWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.accentPrimary,
    borderStyle: 'dashed',
    backgroundColor: COLORS.backgroundCanvas,
    gap: SPACING.xs,
  },
  createNewWorkoutButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.accentPrimary,
  },
  swapCreateButton: {
    flexDirection: 'row',
    width: '100%',
    height: 56,
    backgroundColor: COLORS.accentPrimaryDimmed,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  swapCreateButtonText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.accentPrimary,
  },
  swapSheetItemWrapper: {
    marginBottom: SPACING.md,
  },
  swapSheetItem: {
    backgroundColor: CARDS.cardDeepDimmed.outer.backgroundColor,
    borderRadius: CARDS.cardDeepDimmed.outer.borderRadius,
    borderCurve: CARDS.cardDeepDimmed.outer.borderCurve,
    borderWidth: CARDS.cardDeepDimmed.outer.borderWidth,
    borderColor: CARDS.cardDeepDimmed.outer.borderColor,
    overflow: CARDS.cardDeepDimmed.outer.overflow,
  },
  swapSheetItemPressed: {
    borderColor: LIGHT_COLORS.textMeta,
  },
  swapSheetItemInner: {
    ...CARDS.cardDeepDimmed.inner,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
  },
  swapSheetItemTitle: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.xs,
  },
  swapSheetItemSubtitle: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
  },
  swapSheetEmpty: {
    paddingVertical: SPACING.xxxl,
    alignItems: 'center',
  },
  swapSheetEmptyText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
    textAlign: 'center',
  },
  bonusDrawerContent: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xl,
  },
  bonusDrawerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.xl,
  },
  bonusDrawerRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: 8,
  },
  bonusDrawerItem: {
    flex: 1,
    backgroundColor: COLORS.activeCard,
    borderRadius: 16,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bonusDrawerIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  bonusDrawerLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.text,
    textAlign: 'center',
  },
});

// Note: NavigationContainer moved to RootNavigator.tsx for onboarding flow integration
export default function AppNavigator() {
  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen name="Tabs" component={TabNavigator} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="BodyWeightHistory" component={BodyWeightHistoryScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="PlanHistoryDetail" component={PlanHistoryDetailScreen} />
        <Stack.Screen name="WorkoutBuilder" component={WorkoutBuilderScreen} />
        <Stack.Screen name="Workouts" component={WorkoutsScreen} />
        <Stack.Screen name="WorkoutTemplateDetail" component={WorkoutTemplateDetailScreen} />
        <Stack.Screen name="WarmupEditor" component={WarmupEditorScreen} />
        <Stack.Screen name="WarmupExecution" component={WarmupExecutionScreen} />
        <Stack.Screen name="AccessoriesEditor" component={AccessoriesEditorScreen} />
        <Stack.Screen name="AccessoriesExecution" component={AccessoriesExecutionScreen} />
        <Stack.Screen name="ExerciseExecution" component={ExerciseExecutionScreen} />
        <Stack.Screen name="DesignSystem" component={DesignSystemScreen} />
        <Stack.Screen name="CycleDetail" component={CycleDetailScreen} />
        <Stack.Screen name="CyclePlanDetail" component={CyclePlanDetailScreen} />
        <Stack.Screen name="CycleConflicts" component={CycleConflictsScreen} />
        {/* <Stack.Screen name="WorkoutExecution" component={WorkoutExecutionScreen} /> */}
        {/* Removed - navigating directly to ExerciseExecution with type='main' */}
        <Stack.Screen name="WorkoutEdit" component={WorkoutEditScreen} />
        <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} />
        <Stack.Screen name="HIITTimerList" component={HIITTimerListScreen} />
        <Stack.Screen name="HIITTimerForm" component={HIITTimerFormScreen} />
        <Stack.Screen name="HIITTimerExecution" component={HIITTimerExecutionScreen} />
        <Stack.Screen name="TemplateEditor" component={TemplateEditorScreen} />
        <Stack.Screen name="CustomTemplateInput" component={CustomTemplateInputScreen} />
        <Stack.Screen name="ReviewCreateCycle" component={ReviewCreateCycleScreen} />
        <Stack.Screen name="CreateCycleFlow" component={CreateCycleFlow} />
        <Stack.Screen name="CreateCycleDayEditor" component={CreateCycleDayEditor} />
        <Stack.Screen name="AIWorkoutCreation" component={AIWorkoutCreationScreen} />
        <Stack.Screen name="WorkoutCreationOptions" component={WorkoutCreationOptionsScreen} />
        <Stack.Screen name="LiftHistory" component={LiftHistoryScreen} />
        <Stack.Screen name="EditKeyLifts" component={EditKeyLiftsScreen} />
        <Stack.Screen name="PhotoViewer" component={PhotoViewerScreen} />
        <Stack.Screen name="BonusPresetPicker" component={BonusPresetPickerScreen} />
        <Stack.Screen name="BonusDetail" component={BonusDetailScreen} />
        <Stack.Screen name="ProgressTab" component={ProgressHomeScreen} />
      </Stack.Navigator>
    </View>
  );
}


