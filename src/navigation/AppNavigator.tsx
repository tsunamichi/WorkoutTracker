import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TodayScreen } from '../screens/TodayScreen';
import { WorkoutsScreen } from '../screens/WorkoutsScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { WorkoutBuilderScreen } from '../screens/WorkoutBuilderScreen';
import { WorkoutTemplateDetailScreen } from '../screens/WorkoutTemplateDetailScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { BodyWeightHistoryScreen } from '../screens/BodyWeightHistoryScreen';
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
import { CreateCycleBasics } from '../screens/manualCycle/CreateCycleBasics';
import { CreateCycleDaysOverview } from '../screens/manualCycle/CreateCycleDaysOverview';
import { CreateCycleDayEditor } from '../screens/manualCycle/CreateCycleDayEditor';
import { CreateCycleReview } from '../screens/manualCycle/CreateCycleReview';
import { AIWorkoutCreationScreen } from '../screens/AIWorkoutCreationScreen';
import { WorkoutCreationOptionsScreen } from '../screens/WorkoutCreationOptionsScreen';
import { IconCalendar, IconWorkouts, IconSwap } from '../components/icons';
import { COLORS, TYPOGRAPHY, SPACING, CARDS, BORDER_RADIUS } from '../constants';
import { useStore } from '../store';
import { CycleTemplateId } from '../types/workout';
import { Weekday } from '../types/manualCycle';
import { navigate } from './navigationService';
import { BottomDrawer } from '../components/common/BottomDrawer';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import { useTranslation } from '../i18n/useTranslation';

export type RootStackParamList = {
  Tabs: { initialTab?: 'Schedule' | 'Workouts' } | undefined;
  Profile: { mode?: 'settings' } | undefined;
  BodyWeightHistory: undefined;
  ProgressGallery: undefined;
  ProgressLogDetail: { progressLogId: string };
  History: undefined;
  WorkoutBuilder: undefined;
  WorkoutTemplateDetail: { templateId: string };
  DesignSystem: undefined;
  CycleDetail: { cycleId: string };
  CycleConflicts: { plan: any; conflicts: any[] };
  WorkoutExecution: { workoutTemplateId: string; date: string };
  WorkoutEdit: { cycleId: string; workoutTemplateId: string; date: string };
  ExerciseDetail: { exerciseId: string; workoutKey: string };
  HIITTimerList: undefined;
  HIITTimerForm: { mode: 'create' } | { mode: 'edit'; timerId: string };
  HIITTimerExecution: { timerId: string };
  TemplateEditor: { templateId?: CycleTemplateId };
  CustomTemplateInput: undefined;
  ReviewCreateCycle: undefined;
  CreateCycleBasics: undefined;
  CreateCycleDaysOverview: undefined;
  CreateCycleDayEditor: { weekday: Weekday };
  CreateCycleReview: undefined;
  AIWorkoutCreation: undefined;
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
  const { cycles, cyclePlans, getActiveCyclePlan, swapWorkoutAssignments, workoutTemplates, scheduleWorkout } = useStore();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<'Schedule' | 'Workouts'>('Schedule');
  const [isViewingToday, setIsViewingToday] = React.useState(true);
  const [swapDrawerVisible, setSwapDrawerVisible] = React.useState(false);
  const [swapDrawerData, setSwapDrawerData] = React.useState<{ selectedDate: string; weekDays: any[] } | null>(null);
  const [pressedSwapItemDate, setPressedSwapItemDate] = React.useState<string | null>(null);
  
  // Animated value for tab indicator position (0 = Schedule, 1 = Workouts)
  const indicatorPosition = React.useRef(new Animated.Value(0)).current;
  const scheduleIconOpacity = React.useRef(new Animated.Value(1)).current;
  const workoutsIconOpacity = React.useRef(new Animated.Value(0)).current;
  const [tabBarWidth, setTabBarWidth] = React.useState(0);
  
  // Animate label colors to avoid flicker while the pill transitions
  const scheduleLabelColor = indicatorPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.backgroundCanvas, COLORS.text],
  });
  const workoutsLabelColor = indicatorPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.text, COLORS.backgroundCanvas],
  });
  
  const switchTab = React.useCallback((tab: 'Schedule' | 'Workouts') => {
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
      Animated.spring(workoutsIconOpacity, {
        toValue: tab === 'Workouts' ? 1 : 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      })
    ]).start();
  }, [indicatorPosition, scheduleIconOpacity, workoutsIconOpacity]);

  React.useEffect(() => {
    const params = (route as { params?: { initialTab?: 'Schedule' | 'Workouts' } }).params;
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
  
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.backgroundCanvas }}>
      {/* Screen Content */}
      {activeTab === 'Schedule' ? (
        <TodayScreen 
          onNavigateToWorkouts={() => switchTab('Workouts')} 
          onDateChange={(isToday) => setIsViewingToday(isToday)}
          onOpenSwapDrawer={handleOpenSwapDrawer}
        />
      ) : (
        <WorkoutsScreen />
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
          
          {/* Library Tab */}
          <TouchableOpacity
            style={styles.tab}
            activeOpacity={1}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              switchTab('Workouts');
            }}
          >
            <Animated.View 
              style={[
                styles.tabIcon,
                { 
                opacity: workoutsIconOpacity,
                  transform: [
                    {
                      scale: workoutsIconOpacity.interpolate({
                  inputRange: [0, 1],
                        outputRange: [0.85, 1],
                      }),
                    },
                  ],
                }
              ]}
            >
              <IconWorkouts 
                size={24} 
                color={activeTab === 'Workouts' ? COLORS.backgroundCanvas : COLORS.text} 
              />
            </Animated.View>
            <Animated.View
              style={{
                marginLeft: TAB_ICON_GAP,
                transform: [
                  {
                    translateX: workoutsIconOpacity.interpolate({
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
                  { color: workoutsLabelColor }
                ]} 
                numberOfLines={1}
              >
                {t('workouts')}
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
            const isSelectedDayRestDay = !selectedDay?.workout;
            
            // Filter eligible days (not completed and not the selected date)
            const eligibleDays = weekDays.filter((day: any) => 
              !day.isCompleted && 
              day.date !== selectedDate
            );
            
            // Filter cycle workouts (exclude manually scheduled single workouts)
            const cycleWorkoutDays = eligibleDays.filter((day: any) => {
              if (!day.workout) return false;
              
              // Check if workout has been started
              const hasStarted = day.completionPercentage > 0;
              if (hasStarted) return false;
              
              // Only include cycle workouts
              const isFromCycle = day.assignment && (
                day.assignment.cycleId === activeCycleOld?.id ||
                day.assignment.cycleId === activeCyclePlan?.id
              );
              
              return isFromCycle;
            });
            
            // Filter manually scheduled single workouts (separate section)
            const scheduledSingleWorkouts = eligibleDays.filter((day: any) => {
              if (!day.workout) return false;
              
              // Check if workout has been started
              const hasStarted = day.completionPercentage > 0;
              if (hasStarted) return false;
              
              // Include if it's a manually scheduled single workout
              // (has assignment but cycleId is empty or doesn't match active cycle)
              const hasAssignment = !!day.assignment;
              const hasEmptyCycleId = !day.assignment?.cycleId || day.assignment.cycleId === '';
              const isManualSingleWorkout = hasAssignment && hasEmptyCycleId;
              
              return isManualSingleWorkout;
            });
            
            const workoutDays = cycleWorkoutDays;
            
            const restDays = eligibleDays.filter((day: any) => !day.workout);
            
            // If selected day is a rest day, don't show any rest days (only workouts)
            // Otherwise, show up to 1 rest day
            const limitedRestDays = isSelectedDayRestDay ? [] : restDays.slice(0, 1);
            
            // Combine: workouts first, then rest day (if any and if allowed)
            const allDays = [...workoutDays, ...limitedRestDays];
            
            // Get all single workout templates, but filter out ones already scheduled this week
            const scheduledTemplateIds = new Set(
              weekDays
                .filter((d: any) => d.workout && d.assignment?.workoutTemplateId)
                .map((d: any) => d.assignment.workoutTemplateId)
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
                          {day.workout?.name || 'Rest Day'}
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
                                  {day.workout?.name}
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
              </>
            );
          })()}
          </ScrollView>
        </View>
      </BottomDrawer>
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
        <Stack.Screen name="CreateCycleBasics" component={CreateCycleBasics} />
        <Stack.Screen name="CreateCycleDaysOverview" component={CreateCycleDaysOverview} />
        <Stack.Screen name="CreateCycleDayEditor" component={CreateCycleDayEditor} />
        <Stack.Screen name="CreateCycleReview" component={CreateCycleReview} />
        <Stack.Screen name="AIWorkoutCreation" component={AIWorkoutCreationScreen} />
        <Stack.Screen name="WorkoutCreationOptions" component={WorkoutCreationOptionsScreen} />
      </Stack.Navigator>
    </View>
  );
}


