import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TodayScreen } from '../screens/TodayScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { WorkoutBuilderScreen } from '../screens/WorkoutBuilderScreen';
import { WorkoutTemplateDetailScreen } from '../screens/WorkoutTemplateDetailScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { BodyWeightHistoryScreen } from '../screens/BodyWeightHistoryScreen';
import { ProgressHomeScreen } from '../screens/ProgressHomeScreen';
import { ProgressGalleryScreen } from '../screens/ProgressGalleryScreen';
import { ProgressLogDetailScreen } from '../screens/ProgressLogDetailScreen';
import { CycleDetailScreen } from '../screens/CycleDetailScreen';
import { CycleConflictsScreen } from '../screens/CycleConflictsScreen';
import { WorkoutExecutionScreen } from '../screens/WorkoutExecutionScreen';
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
import { IconCalendar, IconHistory, IconSwap, IconAdd } from '../components/icons';
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
  ProgressGallery: undefined;
  ProgressLogDetail: { progressLogId: string };
  History: undefined;
  WorkoutBuilder: undefined;
  WorkoutTemplateDetail: { templateId: string };
  DesignSystem: undefined;
  CycleDetail: { cycleId: string };
  CycleConflicts: { plan: any; conflicts: any[]; planId?: string };
  WorkoutExecution: { workoutId?: string; templateId?: string; workoutTemplateId?: string; date: string; isLocked?: boolean };
  WorkoutEdit: { cycleId: string; workoutTemplateId: string; date: string };
  ExerciseDetail: { exerciseId: string; workoutKey: string };
  HIITTimerList: undefined;
  HIITTimerForm: { mode: 'create' } | { mode: 'edit'; timerId: string };
  HIITTimerExecution: { timerId: string };
  TemplateEditor: { templateId?: CycleTemplateId };
  CustomTemplateInput: undefined;
  ReviewCreateCycle: undefined;
  CreateCycleFlow: { selectedDate?: string };
  CreateCycleDayEditor: { weekday: Weekday };
  AIWorkoutCreation: { mode?: 'single' | 'plan' } | undefined;
  WorkoutCreationOptions: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_ICON_SIZE = 24;
const TAB_ICON_GAP = 4;
const LABEL_CENTER_OFFSET = (TAB_ICON_SIZE + TAB_ICON_GAP) / 2;

// Light theme colors for swap drawer
const LIGHT_COLORS = {
  secondary: '#1B1B1B',
  textMeta: '#817B77',
  border: '#D2D3CF',
};

function TabNavigator() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { cycles, cyclePlans, getActiveCyclePlan, swapWorkoutAssignments, workoutTemplates, scheduleWorkout, detectCycleConflicts, applyCyclePlan, updateCyclePlan } = useStore();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<'Schedule' | 'Progress'>('Schedule');
  const [isViewingToday, setIsViewingToday] = React.useState(true);
  const [swapDrawerVisible, setSwapDrawerVisible] = React.useState(false);
  const [swapDrawerData, setSwapDrawerData] = React.useState<{ selectedDate: string; weekDays: any[] } | null>(null);
  const [pressedSwapItemDate, setPressedSwapItemDate] = React.useState<string | null>(null);
  
  // NEW: State for Add Workout flow
  const [addWorkoutSheetVisible, setAddWorkoutSheetVisible] = React.useState(false);
  const [addWorkoutDate, setAddWorkoutDate] = React.useState<string>('');
  const [planSelectionSheetVisible, setPlanSelectionSheetVisible] = React.useState(false);
  const [extractDaySheetVisible, setExtractDaySheetVisible] = React.useState(false);
  const [selectedPlanForExtract, setSelectedPlanForExtract] = React.useState<string | null>(null);
  
  // Animated value for tab indicator position (0 = Schedule, 1 = Progress)
  const indicatorPosition = React.useRef(new Animated.Value(0)).current;
  const scheduleIconOpacity = React.useRef(new Animated.Value(1)).current;
  const progressIconOpacity = React.useRef(new Animated.Value(0)).current;
  const [tabBarWidth, setTabBarWidth] = React.useState(0);
  
  // Animate label colors to avoid flicker while the pill transitions
  const scheduleLabelColor = indicatorPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.backgroundCanvas, COLORS.text],
  });
  const progressLabelColor = indicatorPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.text, COLORS.backgroundCanvas],
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
  
  const handleOpenSwapDrawer = (selectedDate: string, weekDays: any[]) => {
    setSwapDrawerData({ selectedDate, weekDays });
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
        />
      ) : (
        <ProgressHomeScreen navigation={navigation} />
      )}
      
      {/* Custom Bottom Navigation */}
      <View style={[styles.bottomNavContainer, { paddingBottom: insets.bottom || 32 }]}>
        {/* Tab Bar - Full width */}
        <View style={styles.tabBar} onLayout={handleTabBarLayout}>
          {/* Animated Active Tab Indicator */}
          {tabBarWidth > 0 && (
            <Animated.View 
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
          <TouchableOpacity
            style={styles.tab}
            activeOpacity={1}
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
                color={activeTab === 'Schedule' ? COLORS.backgroundCanvas : COLORS.text} 
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
          </TouchableOpacity>
          
          {/* Progress Tab */}
          <TouchableOpacity
            style={styles.tab}
            activeOpacity={1}
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
                color={activeTab === 'Progress' ? COLORS.backgroundCanvas : COLORS.text} 
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
          </TouchableOpacity>
            </View>
            </View>
      
      {/* Swap Workout Drawer - Renders at TabNavigator level, above bottom nav */}
      <BottomDrawer
        visible={swapDrawerVisible}
        onClose={() => setSwapDrawerVisible(false)}
      >
        <View style={styles.swapSheetContent}>
          <Text style={styles.swapSheetTitle}>{t('swapWorkout')}</Text>
          <ScrollView 
            style={styles.swapSheetScrollView}
            contentContainerStyle={styles.swapSheetScrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
          {swapDrawerData && (() => {
            const { selectedDate, weekDays } = swapDrawerData;
            
            const activeCycleOld = cycles.find(c => c.isActive);
            const activeCyclePlan = getActiveCyclePlan();
            
            // Check if the selected day is a rest day
            const selectedDay = weekDays.find((day: any) => day.date === selectedDate);
            const isSelectedDayRestDay = !selectedDay?.scheduledWorkout;
            const currentTemplateId = selectedDay?.scheduledWorkout?.templateId;
            
            // Filter eligible days (not completed and not the selected date)
            const eligibleDays = weekDays.filter((day: any) => 
              !day.isCompleted && 
              day.date !== selectedDate
            );
            
            // Filter cycle workouts (from active plan)
            const cycleWorkoutDays = eligibleDays.filter((day: any) => {
              if (!day.scheduledWorkout) return false;
              
              // Check if workout has been started (in-progress)
              const hasStarted = day.completionPercentage > 0;
              if (hasStarted) return false;
              
              // Only include cycle workouts (source is 'cycle')
              const isFromCycle = day.scheduledWorkout.source === 'cycle';
              
              return isFromCycle;
            });
            
            // Filter manually scheduled single workouts (separate section)
            const scheduledSingleWorkouts = eligibleDays.filter((day: any) => {
              if (!day.scheduledWorkout) return false;
              
              // Check if workout has been started (in-progress)
              const hasStarted = day.completionPercentage > 0;
              if (hasStarted) return false;
              
              // Include if it's a manually scheduled single workout (source is 'manual')
              const isManualSingleWorkout = day.scheduledWorkout.source === 'manual';
              
              return isManualSingleWorkout;
            });
            
            const workoutDays = cycleWorkoutDays;
            
            const restDays = eligibleDays.filter((day: any) => !day.scheduledWorkout);
            
            // If selected day is a rest day, don't show any rest days (only workouts)
            // Otherwise, show up to 1 rest day
            const limitedRestDays = isSelectedDayRestDay ? [] : restDays.slice(0, 1);
            
            // Combine: workouts first, then rest day (if any and if allowed)
            const allDays = [...workoutDays, ...limitedRestDays];
            
            // Get all single workout templates, but filter out:
            // 1. Ones already scheduled this week
            // 2. The currently scheduled workout on the selected date (if any)
            const scheduledTemplateIds = new Set(
              weekDays
                .filter((d: any) => d.scheduledWorkout?.templateId)
                .map((d: any) => d.scheduledWorkout.templateId)
            );
            
            const singleWorkouts = workoutTemplates.filter(template => 
              !scheduledTemplateIds.has(template.id)
            );
            
            if (allDays.length === 0 && singleWorkouts.length === 0) {
              return (
                <View style={styles.swapSheetEmpty}>
                  <Text style={styles.swapSheetEmptyText}>
                    {t('noOtherDaysThisWeek')}
                  </Text>
                </View>
              );
            }
            
            return (
              <>
                {/* Section 1: Cycle Workouts (no title) */}
                {allDays.length > 0 && (
                  <>
                    {allDays.map((day: any, index: number) => {
              return (
                <View 
                  key={day.date}
                  style={styles.swapSheetItemWrapper}
                >
                  <View style={[
                    styles.swapSheetItem,
                    pressedSwapItemDate === day.date && styles.swapSheetItemPressed
                  ]}>
                    <TouchableOpacity
                      style={styles.swapSheetItemInner}
                      onPress={async () => {
                        await swapWorkoutAssignments(selectedDate, day.date);
                        setSwapDrawerVisible(false);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }}
                      onPressIn={() => setPressedSwapItemDate(day.date)}
                      onPressOut={() => setPressedSwapItemDate(null)}
                      activeOpacity={1}
                    >
                      <View>
                        <Text style={styles.swapSheetItemTitle}>
                          {day.scheduledWorkout?.titleSnapshot || 'Rest Day'}
                        </Text>
                        <Text style={styles.swapSheetItemSubtitle}>
                          {day.dateObj.format('dddd, MMM D')}
                        </Text>
                      </View>
                      <IconSwap size={24} color="#817B77" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
                  </>
                )}
                
                {/* Spacing between sections */}
                {allDays.length > 0 && (scheduledSingleWorkouts.length > 0 || singleWorkouts.length > 0) && (
                  <View style={{ height: SPACING.xl }} />
                )}
                
                {/* Section 2: Scheduled Single Workouts (already on schedule) */}
                {scheduledSingleWorkouts.length > 0 && (
                  <>
                    <View style={styles.swapSheetSection}>
                      <Text style={styles.swapSheetSectionTitle}>{t('scheduledSingleWorkouts')}</Text>
                      {scheduledSingleWorkouts.map((day: any) => (
                        <View 
                          key={day.date}
                          style={styles.swapSheetItemWrapper}
                        >
                          <View style={[
                            styles.swapSheetItem,
                            pressedSwapItemDate === day.date && styles.swapSheetItemPressed
                          ]}>
                            <TouchableOpacity
                              style={styles.swapSheetItemInner}
                              onPress={async () => {
                                await swapWorkoutAssignments(selectedDate, day.date);
                                setSwapDrawerVisible(false);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              }}
                              onPressIn={() => setPressedSwapItemDate(day.date)}
                              onPressOut={() => setPressedSwapItemDate(null)}
                              activeOpacity={1}
                            >
                              <View>
                                <Text style={styles.swapSheetItemTitle}>
                                  {day.scheduledWorkout?.titleSnapshot}
                                </Text>
                                <Text style={styles.swapSheetItemSubtitle}>
                                  {day.dateObj.format('dddd, MMM D')}
                                </Text>
                              </View>
                              <IconSwap size={24} color="#817B77" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                    
                    {/* Spacing before unscheduled templates */}
                    {singleWorkouts.length > 0 && (
                      <View style={{ height: SPACING.xl }} />
                    )}
                  </>
                )}
                
                {/* Section 3: Unscheduled Single Workout Templates */}
                {singleWorkouts.length > 0 && (
                  <View style={styles.swapSheetSection}>
                    <Text style={styles.swapSheetSectionTitle}>{t('singleWorkouts')}</Text>
                    {singleWorkouts.map((template, index) => (
                      <View 
                        key={template.id}
                        style={styles.swapSheetItemWrapper}
                      >
                        <View style={[
                          styles.swapSheetItem,
                          pressedSwapItemDate === template.id && styles.swapSheetItemPressed
                        ]}>
                          <TouchableOpacity
                            style={styles.swapSheetItemInner}
                            onPress={async () => {
                              const selectedDayData = weekDays.find((d: any) => d.date === selectedDate);
                              
                              // Schedule the single workout to the selected date (replaces whatever is there)
                              const result = await scheduleWorkout(selectedDate, template.id, 'manual', undefined, 'replace');
                              void result;
                              setSwapDrawerVisible(false);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }}
                            onPressIn={() => setPressedSwapItemDate(template.id)}
                            onPressOut={() => setPressedSwapItemDate(null)}
                            activeOpacity={1}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.swapSheetItemTitle}>
                                {template.name}
                              </Text>
                              <Text style={styles.swapSheetItemSubtitle}>
                                {template.items.length} {template.items.length === 1 ? t('exercise') : t('exercises')}
                              </Text>
                            </View>
                            <IconSwap size={24} color="#817B77" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
                
                {/* Create New Workout Button */}
                <View style={{ height: SPACING.xl }} />
                <TouchableOpacity
                  style={styles.createNewWorkoutButton}
                  onPress={() => {
                    if (swapDrawerData) {
                      setSwapDrawerVisible(false);
                      // Open add workout flow for the selected date
                      handleOpenAddWorkout(swapDrawerData.selectedDate);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <IconAdd size={20} color={COLORS.accentPrimary} />
                  <Text style={styles.createNewWorkoutButtonText}>{t('createNewWorkout')}</Text>
                </TouchableOpacity>
              </>
            );
          })()}
          </ScrollView>
        </View>
      </BottomDrawer>
      
      {/* NEW: Add Workout Sheet - Shows templates + create options */}
      <AddWorkoutSheet
        visible={addWorkoutSheetVisible}
        onClose={() => setAddWorkoutSheetVisible(false)}
        selectedDate={addWorkoutDate}
        workoutTemplates={workoutTemplates}
        onSelectTemplate={handleSelectTemplate}
        onCreateBlank={handleCreateBlank}
        onCreateWithAI={handleCreateWithAI}
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
    backgroundColor: COLORS.activeCard,
    borderRadius: 28,
    flexDirection: 'row',
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    right: '50%',
    marginRight: 4,
    backgroundColor: COLORS.text,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.text,
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
        <Stack.Screen name="ProgressGallery" component={ProgressGalleryScreen} />
        <Stack.Screen
          name="ProgressLogDetail"
          component={ProgressLogDetailScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="WorkoutBuilder" component={WorkoutBuilderScreen} />
        <Stack.Screen name="WorkoutTemplateDetail" component={WorkoutTemplateDetailScreen} />
        <Stack.Screen name="DesignSystem" component={DesignSystemScreen} />
        <Stack.Screen name="CycleDetail" component={CycleDetailScreen} />
        <Stack.Screen name="CycleConflicts" component={CycleConflictsScreen} />
        <Stack.Screen name="WorkoutExecution" component={WorkoutExecutionScreen} />
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
      </Stack.Navigator>
    </View>
  );
}


