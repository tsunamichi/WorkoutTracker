import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Animated,
  PanResponder,
  PanResponderInstance,
  SafeAreaView,
  Dimensions,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { BottomDrawer } from '../components/common/BottomDrawer';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconArrowLeft, IconGripVertical, IconTrash, IconSwap, IconAdd, IconEdit, IconChevronDown, IconMinusLine, IconAddLine } from '../components/icons';
import { generateId } from '../utils/manualCycleUtils';
import { Toggle } from '../components/Toggle';
import { formatWeightForLoad, fromDisplayWeight } from '../utils/weight';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { WorkoutTemplateExercise } from '../types';
import { useTranslation } from '../i18n/useTranslation';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<RootStackParamList, 'WorkoutEdit'>;

const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  text: '#1B1B1B',
  secondary: '#1B1B1B',
  textMeta: '#817B77',
  border: '#C7C7CC',
};

export default function WorkoutEditScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { cycleId, workoutTemplateId, date } = route.params;
  const { cycles, exercises, updateCycle, updateExercise, settings, getWorkoutTemplate, updateWorkoutTemplate } = useStore();
  const { t } = useTranslation();
  const useKg = settings.useKg;
  const weightUnit = useKg ? 'kg' : 'lb';
  const weightStep = useKg ? 0.5 : 5;
  
  // Try to find workout in cycle first (old structure), then fall back to standalone template (new structure)
  const cycle = cycles.find(c => c.id === cycleId);
  let workout = cycle?.workoutTemplates.find(w => w.id === workoutTemplateId);
  
  // If not found in cycle, try to get standalone template
  const isStandaloneTemplate = !workout && workoutTemplateId;
  if (isStandaloneTemplate) {
    const template = getWorkoutTemplate(workoutTemplateId);
    if (template) {
      // Convert WorkoutTemplate to old workout format for backward compatibility
      workout = {
        id: template.id,
        name: template.name,
        exercises: template.items.map(item => ({
          id: item.exerciseId,
          exerciseId: item.exerciseId,
          orderIndex: item.order,
          targetSets: item.sets,
          targetRepsMin: item.reps,
          targetRepsMax: item.reps,
          targetWeight: item.weight,
          progressionType: 'double' as const,
          repRangeMin: item.reps,
          repRangeMax: item.reps,
        })),
      };
    }
  }
  
  if (!workout) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{t('workoutNotFound')}</Text>
      </View>
    );
  }
  
  const [workoutName, setWorkoutName] = useState(workout.name);
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutTemplateExercise[]>([...workout.exercises]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showSwapDrawer, setShowSwapDrawer] = useState(false);
  const [swappingExerciseId, setSwappingExerciseId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedNewExerciseId, setSelectedNewExerciseId] = useState<string | null>(null);
  const [swapWeight, setSwapWeight] = useState('');
  const [swapReps, setSwapReps] = useState('');
  const [swapSets, setSwapSets] = useState('');
  const [isTimeBasedSwap, setIsTimeBasedSwap] = useState(false);
  const [swapStep, setSwapStep] = useState<'list' | 'settings'>('list');
  const swapStepAnim = useRef(new Animated.Value(0)).current;
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const nameInputRef = useRef<TextInput>(null);
  const dragOffsetY = useRef(new Animated.Value(0)).current;
  const draggingIndexRef = useRef<number | null>(null);
  const dropTargetIndexRef = useRef<number | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  const panRespondersRef = useRef<Record<string, PanResponderInstance>>({});
  const indexByIdRef = useRef<Record<string, number>>({});
  
  // Animation values for card width and icon reveal per exercise
  const animValuesRef = useRef<Record<string, {
    cardWidth: Animated.Value;
    iconsOpacity: Animated.Value;
    iconsTranslateX: Animated.Value;
  }>>({});
  
  // Initialize animation values for each exercise
  workoutExercises.forEach(exercise => {
    if (!animValuesRef.current[exercise.id]) {
      animValuesRef.current[exercise.id] = {
        cardWidth: new Animated.Value(100),
        iconsOpacity: new Animated.Value(0),
        iconsTranslateX: new Animated.Value(20),
      };
    }
  });

  // Filtered exercises for swap drawer
  const filteredExercises = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return exercises;
    }
    const query = searchQuery.toLowerCase();
    return exercises.filter((exercise) =>
      exercise.name.toLowerCase().includes(query)
    );
  }, [exercises, searchQuery]);

  const groupedExercises = React.useMemo(() => {
    const groups: Record<string, typeof filteredExercises> = {};
    filteredExercises.forEach(exercise => {
      const muscle = exercise.category || 'Other';
      if (!groups[muscle]) {
        groups[muscle] = [];
      }
      groups[muscle].push(exercise);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredExercises]);

  const [expandedMuscles, setExpandedMuscles] = useState<Record<string, boolean>>({});
  
  // Check for changes
  useEffect(() => {
    const nameChanged = workoutName !== workout.name;
    const exercisesChanged = JSON.stringify(workoutExercises) !== JSON.stringify(workout.exercises);
    setHasChanges(nameChanged || exercisesChanged);
  }, [workoutName, workoutExercises, workout]);
  
  // Animate card selection
  useEffect(() => {
    // Animate all cards - expand non-selected, shrink selected
    workoutExercises.forEach(exercise => {
      const anims = animValuesRef.current[exercise.id];
      if (!anims) return;
      
      const isSelected = exercise.id === selectedExerciseId;
      
      if (isSelected) {
        // Shrink card and reveal icons
        Animated.parallel([
          Animated.spring(anims.cardWidth, {
            toValue: 75, // 75%
            useNativeDriver: false,
            tension: 80,
            friction: 10,
          }),
          Animated.timing(anims.iconsOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(anims.iconsTranslateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }),
        ]).start();
      } else {
        // Expand card and hide icons
        Animated.parallel([
          Animated.spring(anims.cardWidth, {
            toValue: 100, // 100%
            useNativeDriver: false,
            tension: 80,
            friction: 10,
          }),
          Animated.timing(anims.iconsOpacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(anims.iconsTranslateX, {
            toValue: 20,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      }
    });
  }, [selectedExerciseId, workoutExercises]);
  
  const handleBack = () => {
    if (hasChanges) {
      Alert.alert(
        t('unsavedChangesTitle'),
        t('unsavedChangesMessage'),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('discard'), style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };
  
  const handleSave = () => {
    // For standalone templates, save directly without showing the modal
    if (isStandaloneTemplate) {
      handleApplyChanges(true);
    } else {
      // For cycle-based workouts, show the modal to choose apply scope
      setShowApplyModal(true);
    }
  };
  
  const handleApplyChanges = async (applyToAll: boolean) => {
    try {
      if (isStandaloneTemplate && updateWorkoutTemplate) {
        // Update standalone template
        await updateWorkoutTemplate(workoutTemplateId, {
          name: workoutName,
          items: workoutExercises.map((ex, idx) => ({
            exerciseId: ex.exerciseId,
            order: idx,
            sets: ex.targetSets || 3,
            reps: ex.targetRepsMin || 8,
            weight: ex.targetWeight,
            restSeconds: ex.restSeconds,
          })),
        });
      } else if (cycle) {
        // Update workout within cycle (old structure)
        if (applyToAll) {
          // Update the workout template for all future workouts
          const updatedTemplates = cycle.workoutTemplates.map(template => 
            template.id === workoutTemplateId
              ? {
                  ...template,
                  name: workoutName,
                  exercises: workoutExercises.map((ex, idx) => ({
                    ...ex,
                    orderIndex: idx,
                  })),
                }
              : template
          );
          
          await updateCycle(cycleId, {
            workoutTemplates: updatedTemplates,
          });
        } else {
          // For "This Workout Only", we would need to implement workout-specific overrides
          // This requires a different data structure to store per-date workout modifications
          // For now, just apply to the template
          const updatedTemplates = cycle.workoutTemplates.map(template => 
            template.id === workoutTemplateId
              ? {
                  ...template,
                  name: workoutName,
                  exercises: workoutExercises.map((ex, idx) => ({
                    ...ex,
                    orderIndex: idx,
                  })),
                }
              : template
          );
          
          await updateCycle(cycleId, {
            workoutTemplates: updatedTemplates,
          });
        }
      }
      
      setShowApplyModal(false);
      navigation.goBack();
    } catch (error) {
      console.error('Error saving workout changes:', error);
      Alert.alert(t('alertErrorTitle'), t('failedToSaveChanges'));
      setShowApplyModal(false);
    }
  };
  
  const handleDeleteExercise = (exerciseId: string) => {
    Alert.alert(
      t('deleteExerciseTitle'),
      t('deleteExerciseMessage'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => {
            setWorkoutExercises(prev => prev.filter(ex => ex.id !== exerciseId));
            setSelectedExerciseId(null);
          },
        },
      ]
    );
  };
  
  const handleSwapExercise = (exerciseId: string) => {
    const exercise = workoutExercises.find(e => e.id === exerciseId);
    if (exercise) {
      setSwappingExerciseId(exerciseId);
      setSwapWeight(
        exercise.targetWeight !== undefined
          ? formatWeightForLoad(exercise.targetWeight, useKg)
          : ''
      );
      setSwapReps(exercise.targetRepsMin?.toString() || '');
      setSwapSets(exercise.targetSets?.toString() || '');
      const exerciseData = exercises.find(e => e.id === exercise.exerciseId);
      const muscle = exerciseData?.category || 'Other';
      setExpandedMuscles({ [muscle]: true });
      setSwapStep('list');
      setShowSwapDrawer(true);
    }
  };

  const handleConfirmSwap = () => {
    if (selectedNewExerciseId && !swappingExerciseId) {
      const reps = swapReps ? parseInt(swapReps, 10) : 8;
      const sets = swapSets ? parseInt(swapSets, 10) : 3;
      const displayWeight = swapWeight ? parseFloat(swapWeight) : 0;
      const weight = fromDisplayWeight(displayWeight, useKg);
      updateExercise(selectedNewExerciseId, { measurementType: isTimeBasedSwap ? 'time' as any : 'reps' as any });
      const newExercise: WorkoutTemplateExercise = {
        id: generateId(),
        exerciseId: selectedNewExerciseId,
        orderIndex: workoutExercises.length,
        targetSets: sets,
        targetRepsMin: reps,
        targetRepsMax: reps,
        targetWeight: weight,
        progressionType: 'double',
        repRangeMin: reps,
        repRangeMax: reps,
      };
      setWorkoutExercises(prev => [...prev, newExercise]);
      handleCloseSwapDrawer();
      return;
    }

    if (swappingExerciseId && selectedNewExerciseId) {
      updateExercise(selectedNewExerciseId, { measurementType: isTimeBasedSwap ? 'time' as any : 'reps' as any });
      setWorkoutExercises(prev => prev.map(ex => {
        if (ex.id === swappingExerciseId) {
          const reps = swapReps ? parseInt(swapReps, 10) : ex.targetRepsMin;
          const displayWeight = swapWeight ? parseFloat(swapWeight) : 0;
          const weight = fromDisplayWeight(displayWeight, useKg);
          return {
            ...ex,
            exerciseId: selectedNewExerciseId,
            targetWeight: swapWeight ? weight : ex.targetWeight,
            targetRepsMin: reps,
            targetRepsMax: reps, // Set max to same value as min
            targetSets: swapSets ? parseInt(swapSets, 10) : ex.targetSets,
          };
        }
        return ex;
      }));
      handleCloseSwapDrawer();
    }
  };

  const handleCloseSwapDrawer = () => {
    setShowSwapDrawer(false);
    setSwappingExerciseId(null);
    setSelectedNewExerciseId(null);
    setSearchQuery('');
    setShowSearch(false);
    setSwapWeight('');
    setSwapReps('');
    setSwapSets('');
    setIsTimeBasedSwap(false);
    setSwapStep('list');
  };

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(swapStepAnim, {
      toValue: swapStep === 'settings' ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [swapStep, swapStepAnim]);

  const handleDragStart = React.useCallback((index: number) => {
    draggingIndexRef.current = index;
    dropTargetIndexRef.current = index;
    setDraggingIndex(index);
    setDropTargetIndex(index);
    setSelectedExerciseId(null); // Close any open action icons
    setScrollEnabled(false); // Disable scroll while dragging
  }, []);

  const handleDragMove = React.useCallback((dy: number) => {
    if (draggingIndexRef.current === null) return;
    
    const ITEM_HEIGHT = 76; // Card height with margin
    
    // Calculate how many card positions we've moved
    // When dragging down, we need to account for the card's own space
    // When dragging up, we use the standard calculation
    let offset;
    if (dy > 0) {
      // Dragging down: add full card height to account for the card's own space
      offset = Math.floor((dy + ITEM_HEIGHT) / ITEM_HEIGHT);
    } else {
      // Dragging up: standard calculation with half-height threshold
      offset = Math.floor((dy + ITEM_HEIGHT / 2) / ITEM_HEIGHT);
    }
    
    // Calculate target index
    let targetIndex = draggingIndexRef.current + offset;
    
    // Clamp to valid range [0, length] - we allow length to support dropping at the end
    targetIndex = Math.max(0, Math.min(workoutExercises.length, targetIndex));
    
    // Update the drop target indicator without reordering
    if (targetIndex !== dropTargetIndexRef.current) {
      dropTargetIndexRef.current = targetIndex;
      setDropTargetIndex(targetIndex);
    }
  }, [workoutExercises.length]);

  const handleDragEnd = React.useCallback(() => {
    // Perform the actual reorder on release
    const origIndex = draggingIndexRef.current;
    const targetIndex = dropTargetIndexRef.current;
    
    if (origIndex !== null && targetIndex !== null && origIndex !== targetIndex) {
      setWorkoutExercises(currentExercises => {
        const newExercises = [...currentExercises];
        const [movedItem] = newExercises.splice(origIndex, 1);
        
        // Adjust insert index: after removing the item, indices shift
        let insertIndex = targetIndex;
        if (targetIndex > origIndex) {
          // Moving down: indices after removal have shifted, so subtract 1
          insertIndex = targetIndex - 1;
        }
        
        newExercises.splice(insertIndex, 0, movedItem);
        return newExercises;
      });
    }
    
    draggingIndexRef.current = null;
    dropTargetIndexRef.current = null;
    setDraggingIndex(null);
    setDropTargetIndex(null);
    dragOffsetY.setValue(0);
    setScrollEnabled(true); // Re-enable scroll after dragging
  }, []);
  
  const handleAddExercise = () => {
    setSwappingExerciseId(null);
    setSelectedNewExerciseId(null);
    setSearchQuery('');
    setSwapWeight('0');
    setSwapReps('8');
    setSwapSets('3');
    setIsTimeBasedSwap(false);
    setShowSwapDrawer(true);
  };
  
  const isAddMode = showSwapDrawer && !swappingExerciseId;

  const swapDrawerMaxHeight = Math.round(Dimensions.get('window').height * 0.9);
  
  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              activeOpacity={1}
            >
              <IconArrowLeft size={24} color="#000000" />
            </TouchableOpacity>
            <View style={{ width: 48 }} />
          </View>
          
          <TouchableOpacity 
            style={styles.pageTitleContainer}
            onPress={() => setIsEditingName(true)}
            activeOpacity={1}
          >
            {isEditingName ? (
              <TextInput
                ref={nameInputRef}
                style={styles.pageTitleInput}
                value={workoutName}
                onChangeText={setWorkoutName}
                onBlur={() => setIsEditingName(false)}
                autoFocus
                placeholder={t('workoutNamePlaceholder')}
                placeholderTextColor={COLORS.textMeta}
              />
            ) : (
              <View style={styles.pageTitleRow}>
                <Text style={[styles.pageTitle, !workoutName && styles.pageTitlePlaceholder]}>
                  {workoutName || 'Workout name'}
                </Text>
                <IconEdit size={20} color={COLORS.textMeta} />
              </View>
            )}
          </TouchableOpacity>
          </View>
          
        {/* Exercises List */}
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={scrollEnabled}
          bounces={false}
        >
          {/* Exercises Section */}
          <View style={styles.exercisesSectionHeader}>
            <Text style={styles.sectionLabel}>{t('listOfExercises')}</Text>
          </View>
          {workoutExercises.map((exercise, index) => {
            const exerciseData = exercises.find(e => e.id === exercise.exerciseId);
            const isSelected = selectedExerciseId === exercise.id;
            const anims = animValuesRef.current[exercise.id];
            const isDragging = draggingIndex === index;
            
            if (!anims) return null;

            // Create a pan responder for this exercise's grip handle
            indexByIdRef.current[exercise.id] = index;
            if (!panRespondersRef.current[exercise.id]) {
              panRespondersRef.current[exercise.id] = PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onStartShouldSetPanResponderCapture: () => true,
                onMoveShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponderCapture: () => true,
                onPanResponderGrant: () => {
                  const currentIndex = indexByIdRef.current[exercise.id];
                  if (currentIndex !== undefined) {
                    handleDragStart(currentIndex);
                  }
                },
                onPanResponderMove: (evt, gestureState) => {
                  dragOffsetY.setValue(gestureState.dy);
                  handleDragMove(gestureState.dy);
                },
                onPanResponderRelease: () => {
                  handleDragEnd();
                },
                onPanResponderTerminate: () => {
                  handleDragEnd();
                },
              });
            }
            const panResponder = panRespondersRef.current[exercise.id];
            
            // Show drop indicator at the target position
            // The dropTargetIndex represents where we'll insert after removing the dragged item
            // For display, we need to show the indicator accounting for the visual positions
            const showDropIndicatorBefore = draggingIndex !== null && 
              dropTargetIndex !== null &&
              dropTargetIndex === index && 
              draggingIndex !== index;
            
            return (
              <React.Fragment key={exercise.id}>
                {showDropIndicatorBefore && (
                  <View style={styles.dropIndicator}>
                    <View style={styles.dropIndicatorLine} />
                  </View>
                )}
                <Animated.View 
                style={[
                  styles.exerciseItemWrapper,
                  isDragging && {
                    opacity: 0.95,
                    transform: [
                      { translateY: dragOffsetY },
                      { scale: 1.02 },
                    ],
                    zIndex: 1000,
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.12,
                    shadowRadius: 8,
                    elevation: 4,
                  },
                ]}
              >
                <View style={styles.exerciseRow}>
                  {/* Exercise Card - Shrinks when selected */}
                  <Animated.View 
                    style={[
                      styles.exerciseCardContainer,
                      {
                        width: anims.cardWidth.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  >
                    <View style={[
                      (isSelected || isDragging) ? CARDS.cardDeep.outer : CARDS.cardDeepDimmed.outer
                      ]}>
                            <TouchableOpacity
                        style={[
                          (isSelected || isDragging) ? CARDS.cardDeep.inner : CARDS.cardDeepDimmed.inner,
                          styles.exerciseCard,
                        ]}
                              onPress={() => setSelectedExerciseId(isSelected ? null : exercise.id)}
                              activeOpacity={1}
                            >
                        <View style={styles.exerciseCardContent}>
                              {/* Exercise Name */}
                          <Text
                            style={styles.exerciseName}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                                {exerciseData?.name || 'Unknown Exercise'}
                              </Text>
                        </View>
                            
                            {/* Grip Handle - Absolute positioned with drag functionality */}
                            <View 
                              style={styles.gripHandle}
                              {...panResponder.panHandlers}
                              onStartShouldSetResponder={() => true}
                            >
                              <IconGripVertical size={20} color={isDragging ? COLORS.text : COLORS.textMeta} />
                            </View>
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                  
                  {/* Action Icons - Outside card, revealed when selected */}
                  <Animated.View 
                    style={[
                      styles.exerciseActions,
                      {
                        opacity: anims.iconsOpacity,
                        transform: [{ translateX: anims.iconsTranslateX }],
                      },
                    ]}
                    pointerEvents={isSelected ? 'auto' : 'none'}
                  >
                    <TouchableOpacity
                      onPress={() => handleSwapExercise(exercise.id)}
                      style={styles.actionButton}
                      activeOpacity={1}
                    >
                      <IconSwap size={20} color={COLORS.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteExercise(exercise.id)}
                      style={styles.actionButton}
                      activeOpacity={1}
                    >
                      <IconTrash size={20} color={COLORS.error} />
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              </Animated.View>
              </React.Fragment>
            );
          })}
          
          {/* Drop indicator at the end if dragging to last position */}
          {draggingIndex !== null && dropTargetIndex === workoutExercises.length && (
            <View style={styles.dropIndicator}>
              <View style={styles.dropIndicatorLine} />
            </View>
          )}

          <TouchableOpacity
            style={styles.addExerciseCardButton}
            onPress={handleAddExercise}
            activeOpacity={1}
          >
            <IconAdd size={20} color={COLORS.text} />
            <Text style={styles.addExerciseCardText}>{t('addExercise')}</Text>
          </TouchableOpacity>
        </ScrollView>
        
        {/* Save Button */}
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!hasChanges}
            activeOpacity={1}
          >
            <Text style={[styles.saveButtonText, !hasChanges && styles.saveButtonTextDisabled]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Swap Exercise Drawer */}
      <BottomDrawer
        visible={showSwapDrawer}
        onClose={handleCloseSwapDrawer}
        maxHeight="90%"
        scrollable={false}
        fixedHeight={true}
        showHandle={false}
        contentStyle={styles.swapDrawerContent}
      >
        <View style={styles.drawerContent}>
          {/* Drawer Header */}
          {swapStep === 'settings' ? (
            <View style={[styles.drawerHeader, styles.drawerHeaderSettings]}>
              <TouchableOpacity
                onPress={() => setSwapStep('list')}
                style={[styles.drawerBackButton, styles.drawerBackButtonSettings]}
                activeOpacity={1}
              >
                <IconArrowLeft size={24} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.drawerHeaderSettingsTitle}>
                Exercise Settings
              </Text>
              <View style={styles.drawerHeaderSettingsSpacer} />
            </View>
          ) : (
            <View style={[styles.drawerHeader, styles.drawerHeaderList]}>
            <Text style={[TYPOGRAPHY.h3, { color: COLORS.text }]}>
                {isAddMode ? 'Add Exercise' : 'Swap Exercise'}
            </Text>
            <TouchableOpacity
                onPress={() => {
                  setShowSearch(true);
                  setTimeout(() => searchInputRef.current?.focus(), 0);
                }}
                style={styles.searchButton}
              activeOpacity={1}
            >
                <Text style={styles.searchButtonText}>🔍</Text>
            </TouchableOpacity>
          </View>
          )}

              {/* Search Input */}
          {showSearch && swapStep === 'list' && (
              <View style={styles.swapSearchContainer}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                ref={searchInputRef}
                  style={styles.swapSearchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t('searchExercisesPlaceholder')}
                  placeholderTextColor={COLORS.textMeta}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    setShowSearch(false);
                    searchInputRef.current?.blur();
                  }}
                    activeOpacity={1}
                  >
                    <Text style={styles.clearIcon}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
          )}

          <ScrollView
            style={styles.swapScroll}
            contentContainerStyle={styles.swapScrollContent}
            bounces={true}
            showsVerticalScrollIndicator={true}
          >
              {/* Exercise List */}
            {swapStep === 'list' && (
              <Animated.View
                      style={[
                  styles.swapExerciseListContent,
                  {
                    opacity: swapStepAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0],
                    }),
                  },
                ]}
              >
                {groupedExercises.map(([muscle, muscleExercises]) => {
                  const isExpanded = !!expandedMuscles[muscle];
                  return (
                    <View key={muscle} style={styles.muscleSection}>
                      <View style={styles.muscleCard}>
                      <TouchableOpacity
                        style={styles.muscleHeader}
                        onPress={() =>
                          setExpandedMuscles(prev => ({ ...prev, [muscle]: !isExpanded }))
                        }
                        activeOpacity={1}
                      >
                        <Text style={styles.muscleTitle}>{muscle}</Text>
                        <IconChevronDown
                          size={20}
                          color={COLORS.textMeta}
                          style={{
                            transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
                          }}
                        />
                      </TouchableOpacity>
                      {isExpanded && (
                        <View style={styles.muscleContent}>
                          {muscleExercises.map((exercise, exerciseIndex) => (
                            <View key={exercise.id}>
                              <TouchableOpacity
                                style={styles.swapExerciseItem}
                                onPress={() => {
                                  setSelectedNewExerciseId(exercise.id);
                                  setIsTimeBasedSwap(exercise.measurementType === 'time');
                                  setSwapStep('settings');
                                }}
                      activeOpacity={1}
                    >
                      <Text style={styles.swapExerciseName}>{exercise.name}</Text>
                    </TouchableOpacity>
                              {exerciseIndex < muscleExercises.length - 1 && (
                                <View style={styles.muscleExerciseDivider} />
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                      </View>
                    </View>
                  );
                })}
              </Animated.View>
            )}

              {/* Weight, Reps, Sets Configuration */}
            {swapStep === 'settings' && selectedNewExerciseId && (
              <Animated.View
                style={[
                  styles.swapConfigSection,
                  {
                    opacity: swapStepAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1],
                    }),
                  },
                ]}
              >
                <View style={styles.timeBasedRow}>
                  <Toggle
                    label="Time-based"
                    value={isTimeBasedSwap}
                    onValueChange={setIsTimeBasedSwap}
                      />
                    </View>

                <View style={styles.swapAdjustRow}>
                  <View style={styles.swapAdjustControls}>
                    <View style={styles.swapAdjustValue}>
                      <Text style={styles.swapAdjustValueText}>{swapWeight || '0'}</Text>
                      <Text style={styles.swapAdjustUnit}>{weightUnit}</Text>
                    </View>
                    <View style={styles.swapAdjustButtons}>
                      <TouchableOpacity
                        onPress={() => {
                          const current = parseFloat(swapWeight || '0') || 0;
                          const next = Math.max(0, current - weightStep);
                          setSwapWeight(next.toString());
                        }}
                        activeOpacity={1}
                        style={styles.adjustButtonTapTarget}
                      >
                        <View style={styles.adjustButton}>
                          <View style={styles.adjustButtonInner}>
                            <IconMinusLine size={24} color={COLORS.accentPrimary} />
                    </View>
                  </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          const current = parseFloat(swapWeight || '0') || 0;
                          const next = current + weightStep;
                          setSwapWeight(next.toString());
                        }}
                        activeOpacity={1}
                        style={styles.adjustButtonTapTarget}
                      >
                        <View style={styles.adjustButton}>
                          <View style={styles.adjustButtonInner}>
                            <IconAddLine size={24} color={COLORS.accentPrimary} />
                </View>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View style={styles.swapControlDivider} />

                <View style={styles.swapAdjustRow}>
                  <View style={styles.swapAdjustControls}>
                    <View style={styles.swapAdjustValue}>
                      <Text style={styles.swapAdjustValueText}>{swapReps || (isTimeBasedSwap ? '5' : '8')}</Text>
                      <Text style={styles.swapAdjustUnit}>{isTimeBasedSwap ? 'sec' : 'reps'}</Text>
                    </View>
                    <View style={styles.swapAdjustButtons}>
                      <TouchableOpacity
                        onPress={() => {
                          const current = parseInt(swapReps || (isTimeBasedSwap ? '5' : '8'), 10) || (isTimeBasedSwap ? 5 : 8);
                          const step = isTimeBasedSwap ? 5 : 1;
                          const min = isTimeBasedSwap ? 5 : 1;
                          const next = Math.max(min, current - step);
                          setSwapReps(next.toString());
                        }}
                        activeOpacity={1}
                        style={styles.adjustButtonTapTarget}
                      >
                        <View style={styles.adjustButton}>
                          <View style={styles.adjustButtonInner}>
                            <IconMinusLine size={24} color={COLORS.accentPrimary} />
                          </View>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          const current = parseInt(swapReps || (isTimeBasedSwap ? '5' : '8'), 10) || (isTimeBasedSwap ? 5 : 8);
                          const step = isTimeBasedSwap ? 5 : 1;
                          const next = current + step;
                          setSwapReps(next.toString());
                        }}
                        activeOpacity={1}
                        style={styles.adjustButtonTapTarget}
                      >
                        <View style={styles.adjustButton}>
                          <View style={styles.adjustButtonInner}>
                            <IconAddLine size={24} color={COLORS.accentPrimary} />
                          </View>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View style={styles.swapControlDivider} />

                <View style={styles.swapAdjustRow}>
                  <View style={styles.swapAdjustControls}>
                    <View style={styles.swapAdjustValue}>
                      <Text style={styles.swapAdjustValueText}>{swapSets || '3'}</Text>
                      <Text style={styles.swapAdjustUnit}>{t('setsUnit')}</Text>
                    </View>
                    <View style={styles.swapAdjustButtons}>
                      <TouchableOpacity
                        onPress={() => {
                          const current = parseInt(swapSets || '3', 10) || 3;
                          const next = Math.max(1, current - 1);
                          setSwapSets(next.toString());
                        }}
                        activeOpacity={1}
                        style={styles.adjustButtonTapTarget}
                      >
                        <View style={styles.adjustButton}>
                          <View style={styles.adjustButtonInner}>
                            <IconMinusLine size={24} color={COLORS.accentPrimary} />
                          </View>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          const current = parseInt(swapSets || '3', 10) || 3;
                          const next = current + 1;
                          setSwapSets(next.toString());
                        }}
                        activeOpacity={1}
                        style={styles.adjustButtonTapTarget}
                      >
                        <View style={styles.adjustButton}>
                          <View style={styles.adjustButtonInner}>
                            <IconAddLine size={24} color={COLORS.accentPrimary} />
                          </View>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Animated.View>
            )}
          </ScrollView>

              {/* Confirm Button */}
          {swapStep === 'settings' && selectedNewExerciseId && (
            <View style={styles.swapButtonContainerPinned}>
              <TouchableOpacity
                style={styles.swapConfirmButton}
                onPress={handleConfirmSwap}
                activeOpacity={1}
              >
                <Text style={styles.swapConfirmButtonText}>
                  {isAddMode ? 'Add Exercise' : 'Confirm Swap'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </BottomDrawer>
      
      {/* Apply Changes Modal */}
      <Modal
        visible={showApplyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowApplyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('applyChangesTitle')}</Text>
            <Text style={styles.modalMessage}>
              Do you want to apply these changes to this workout only or all future workouts in this cycle?
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => handleApplyChanges(false)}
                activeOpacity={1}
              >
                <Text style={styles.modalButtonSecondaryText}>{t('thisWorkoutOnly')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => handleApplyChanges(true)}
                activeOpacity={1}
              >
                <Text style={styles.modalButtonPrimaryText}>{t('allFutureWorkouts')}</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowApplyModal(false)}
              activeOpacity={1}
            >
              <Text style={styles.modalCancelText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  pageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
  },
  pageTitlePlaceholder: {
    color: COLORS.textMeta,
  },
  pageTitleInput: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
  },
  exercisesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  sectionLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: SPACING.md,
  },
  addExerciseCardButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.textMeta,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.sm,
  },
  addExerciseCardText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.xxl,
    paddingBottom: 140, // Space for fixed button + 40px
  },
  exerciseItemWrapper: {
    marginBottom: SPACING.md,
  },
  dropIndicator: {
    height: 4, // Height of the indicator line
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md / 2 - 2, // Position in center of gap: half gap minus half line height
    marginBottom: SPACING.md / 2 - 2, // Same bottom spacing to maintain total gap
  },
  dropIndicatorLine: {
    width: '100%',
    height: 4,
    backgroundColor: '#FD6B00', // Accent color for visibility
    borderRadius: 2,
    shadowColor: '#FD6B00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  exerciseCardContainer: {
    // Width is controlled by animation
  },
  exerciseCard: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingLeft: 16,
    paddingRight: 48, // Make room for grip handle
  },
  exerciseCardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  gripHandle: {
    position: 'absolute',
    right: 16, // 24px from right side - adjusted for padding
    top: SPACING.lg,
    bottom: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
  },
  exerciseName: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.text,
    flex: 1,
  },
  exerciseActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingRight: SPACING.xs,
  },
  actionButton: {
    padding: SPACING.xs,
  },
  saveButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 40, // 40px spacing below button
    paddingTop: SPACING.md,
    backgroundColor: 'transparent',
  },
  saveButton: {
    backgroundColor: '#000000',
    paddingVertical: SPACING.lg,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.disabledBorder,
  },
  saveButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: '#FFFFFF',
  },
  saveButtonTextDisabled: {
    color: COLORS.textMeta,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    borderCurve: 'continuous',
    padding: SPACING.xxl,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  modalMessage: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
    textAlign: 'center',
    marginBottom: SPACING.xxl,
  },
  modalButtons: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  modalButton: {
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#000000',
  },
  modalButtonPrimaryText: {
    ...TYPOGRAPHY.metaBold,
    color: '#FFFFFF',
  },
  modalButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalButtonSecondaryText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  modalCancelButton: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  modalCancelText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  errorText: {
    ...TYPOGRAPHY.body,
    color: COLORS.error,
    textAlign: 'center',
    padding: SPACING.xl,
  },
  // Swap Drawer Content
  drawerContent: {
    flex: 1,
    minHeight: 0,
  },
  swapDrawerContent: {
    flex: 1,
  },
  drawerHeader: {
    paddingRight: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  drawerHeaderList: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: SPACING.xxl,
  },
  drawerHeaderSettings: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: SPACING.xxl,
    paddingTop: 24,
    gap: 0,
  },
  drawerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  drawerBackButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerBackButtonSettings: {
    marginLeft: -4,
  },
  drawerHeaderSettingsTitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    flex: 1,
    textAlign: 'center',
  },
  drawerHeaderSettingsSpacer: {
    width: 24,
    height: 24,
  },
  searchButton: {
    padding: SPACING.xs,
  },
  searchButtonText: {
    fontSize: 20,
    color: COLORS.text,
  },
  swapSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundCanvas,
    borderRadius: BORDER_RADIUS.md,
    borderCurve: 'continuous',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginHorizontal: SPACING.xxl,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  searchIcon: {
    fontSize: 18,
    color: COLORS.textMeta,
  },
  swapSearchInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  clearIcon: {
    fontSize: 16,
    color: COLORS.textMeta,
  },
  swapExerciseListContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: 48,
    paddingBottom: SPACING.xl,
  },
  swapScroll: {
    flex: 1,
    minHeight: 0,
  },
  swapScrollContent: {
    paddingBottom: 120,
  },
  swapAdjustRow: {
    marginTop: 0,
  },
  swapAdjustControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  swapAdjustValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  swapAdjustValueText: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
  },
  swapAdjustUnit: {
    ...TYPOGRAPHY.h1,
    color: COLORS.textMeta,
  },
  swapAdjustButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  adjustButtonTapTarget: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  adjustButtonInner: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentPrimaryDimmed,
  },
  muscleSection: {
    marginBottom: 12,
  },
  muscleCard: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  muscleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  muscleTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
  },
  muscleContent: {
  },
  swapExerciseItem: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  swapExerciseName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  muscleExerciseDivider: {
    height: 1,
    backgroundColor: COLORS.borderDimmed,
    marginHorizontal: SPACING.lg,
    marginVertical: 4,
  },
  swapConfigSection: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: 32,
    paddingBottom: SPACING.md,
  },
  timeBasedRow: {
    marginBottom: 32,
  },
  swapControlDivider: {
    height: 1,
    backgroundColor: COLORS.borderDimmed,
    marginVertical: 16,
  },
  swapConfigRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  swapConfigField: {
    flex: 1,
  },
  swapConfigLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: SPACING.xs,
  },
  swapConfigInput: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    backgroundColor: COLORS.backgroundCanvas,
    borderRadius: BORDER_RADIUS.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    textAlign: 'center',
  },
  swapButtonContainerPinned: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 40,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.backgroundCanvas,
  },
  swapConfirmButton: {
    backgroundColor: '#000000',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderCurve: 'continuous',
    alignItems: 'center',
  },
  swapConfirmButtonDisabled: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.disabledBorder,
  },
  swapConfirmButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: '#FFFFFF',
  },
  swapConfirmButtonTextDisabled: {
    color: COLORS.textMeta,
  },
});

