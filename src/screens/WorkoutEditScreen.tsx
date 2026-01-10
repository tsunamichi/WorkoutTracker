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
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { BottomDrawer } from '../components/common/BottomDrawer';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS } from '../constants';
import { IconArrowLeft, IconGripVertical, IconX, IconSwap, IconAdd } from '../components/icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { WorkoutTemplateExercise } from '../types';

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
  const { cycles, exercises, updateCycle } = useStore();
  
  const cycle = cycles.find(c => c.id === cycleId);
  const workout = cycle?.workoutTemplates.find(w => w.id === workoutTemplateId);
  
  if (!workout) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Workout not found</Text>
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
  const [selectedNewExerciseId, setSelectedNewExerciseId] = useState<string | null>(null);
  const [swapWeight, setSwapWeight] = useState('');
  const [pressedCardId, setPressedCardId] = useState<string | null>(null);
  const [swapReps, setSwapReps] = useState('');
  const [swapSets, setSwapSets] = useState('');
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const nameInputRef = useRef<TextInput>(null);
  const dragOffsetY = useRef(new Animated.Value(0)).current;
  const draggingIndexRef = useRef<number | null>(null);
  const dropTargetIndexRef = useRef<number | null>(null);
  
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
        'Unsaved Changes',
        'You have unsaved changes. Do you want to discard them?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };
  
  const handleSave = () => {
    setShowApplyModal(true);
  };
  
  const handleApplyChanges = async (applyToAll: boolean) => {
    if (!cycle) return;
    
    try {
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
        // For now, show an alert
        Alert.alert(
          'Feature Coming Soon',
          'Editing individual workout instances is not yet implemented. Changes will apply to all future workouts.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Apply to All',
              onPress: async () => {
                await handleApplyChanges(true);
              },
            },
          ]
        );
        setShowApplyModal(false);
        return;
      }
      
      setShowApplyModal(false);
      navigation.goBack();
    } catch (error) {
      console.error('Error saving workout changes:', error);
      Alert.alert('Error', 'Failed to save changes. Please try again.');
      setShowApplyModal(false);
    }
  };
  
  const handleDeleteExercise = (exerciseId: string) => {
    Alert.alert(
      'Delete Exercise',
      'Are you sure you want to remove this exercise?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
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
      setSwapWeight(exercise.targetWeight?.toString() || '');
      setSwapReps(exercise.targetRepsMin?.toString() || '');
      setSwapSets(exercise.targetSets?.toString() || '');
      setShowSwapDrawer(true);
    }
  };

  const handleConfirmSwap = () => {
    if (swappingExerciseId && selectedNewExerciseId) {
      setWorkoutExercises(prev => prev.map(ex => {
        if (ex.id === swappingExerciseId) {
          const reps = swapReps ? parseInt(swapReps, 10) : ex.targetRepsMin;
          return {
            ...ex,
            exerciseId: selectedNewExerciseId,
            targetWeight: swapWeight ? parseInt(swapWeight, 10) : ex.targetWeight,
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
    setSwapWeight('');
    setSwapReps('');
    setSwapSets('');
  };

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
    // TODO: Open exercise selection drawer
  };
  
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
          
          <View style={styles.pageTitleContainer}>
            <Text style={styles.pageTitle}>Edit Workout</Text>
          </View>
        </View>
        
        {/* Exercises List */}
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={scrollEnabled}
        >
          {/* Workout Name Editor */}
          <View style={styles.workoutNameSection}>
            <Text style={styles.sectionLabel}>Workout Name</Text>
            {isEditingName ? (
              <TextInput
                ref={nameInputRef}
                style={styles.workoutNameInput}
                value={workoutName}
                onChangeText={setWorkoutName}
                onBlur={() => setIsEditingName(false)}
                autoFocus
                placeholder="Workout name"
              />
            ) : (
              <TouchableOpacity
                onPress={() => setIsEditingName(true)}
                style={styles.workoutNameButton}
                activeOpacity={1}
              >
                <Text style={styles.workoutName}>{workoutName}</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Exercises Section */}
          <Text style={styles.sectionLabel}>Exercises</Text>
          {workoutExercises.map((exercise, index) => {
            const exerciseData = exercises.find(e => e.id === exercise.exerciseId);
            const isSelected = selectedExerciseId === exercise.id;
            const anims = animValuesRef.current[exercise.id];
            const isDragging = draggingIndex === index;
            
            if (!anims) return null;

            // Create a pan responder for this exercise's grip handle
            const panResponder = React.useMemo(() => PanResponder.create({
              onStartShouldSetPanResponder: () => true,
              onStartShouldSetPanResponderCapture: () => true,
              onMoveShouldSetPanResponder: () => true,
              onMoveShouldSetPanResponderCapture: () => true,
              onPanResponderGrant: () => {
                handleDragStart(index);
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
            }), [index, handleDragStart, handleDragMove, handleDragEnd]);
            
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
                    opacity: 0.9,
                    transform: [
                      { translateY: dragOffsetY },
                      { scale: 1.02 },
                    ],
                    zIndex: 1000,
                    elevation: 8,
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
                      CARDS.cardDeep.outer,
                      pressedCardId === exercise.id && styles.exerciseCardPressed
                    ]}>
                      <View style={[CARDS.cardDeep.inner, styles.exerciseCard]}>
                            <TouchableOpacity
                              style={styles.exerciseCardContent}
                              onPress={() => setSelectedExerciseId(isSelected ? null : exercise.id)}
                              onPressIn={() => setPressedCardId(exercise.id)}
                              onPressOut={() => setPressedCardId(null)}
                              activeOpacity={1}
                            >
                              {/* Exercise Name */}
                              <Text style={styles.exerciseName}>
                                {exerciseData?.name || 'Unknown Exercise'}
                              </Text>
                            </TouchableOpacity>
                            
                            {/* Grip Handle - Absolute positioned with drag functionality */}
                            <View 
                              style={styles.gripHandle}
                              {...panResponder.panHandlers}
                              onStartShouldSetResponder={() => true}
                            >
                              <IconGripVertical size={20} color={isDragging ? COLORS.text : COLORS.textMeta} />
                            </View>
                      </View>
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
                      <IconX size={20} color={COLORS.error} />
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
          
          {/* Add Exercise Button */}
          <TouchableOpacity
            style={styles.addExerciseButton}
            onPress={handleAddExercise}
            activeOpacity={1}
          >
            <IconAdd size={24} color={COLORS.text} />
            <Text style={styles.addExerciseButtonText}>Add Exercise</Text>
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
        showHandle={false}
      >
        <View style={styles.drawerContent}>
          {/* Drawer Header */}
          <View style={styles.drawerHeader}>
            <Text style={[TYPOGRAPHY.h3, { color: COLORS.text }]}>
              Swap Exercise
            </Text>
            <TouchableOpacity
              onPress={handleCloseSwapDrawer}
              style={styles.closeButton}
              activeOpacity={1}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

              {/* Search Input */}
              <View style={styles.swapSearchContainer}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.swapSearchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search exercises..."
                  placeholderTextColor={COLORS.textMeta}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setSearchQuery('')}
                    activeOpacity={1}
                  >
                    <Text style={styles.clearIcon}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Exercise List */}
              <ScrollView style={styles.swapExerciseList}>
                {filteredExercises.map(exercise => {
                  const isSelected = selectedNewExerciseId === exercise.id;
                  return (
                    <TouchableOpacity
                      key={exercise.id}
                      style={[
                        styles.swapExerciseItem,
                        isSelected && styles.swapExerciseItemSelected,
                      ]}
                      onPress={() => setSelectedNewExerciseId(exercise.id)}
                      activeOpacity={1}
                    >
                      <Text style={styles.swapExerciseName}>{exercise.name}</Text>
                      {exercise.category && (
                        <Text style={styles.swapExerciseMeta}>{exercise.category}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Weight, Reps, Sets Configuration */}
              {selectedNewExerciseId && (
                <View style={styles.swapConfigSection}>
                  <View style={styles.swapConfigRow}>
                    <View style={styles.swapConfigField}>
                      <Text style={styles.swapConfigLabel}>Weight</Text>
                      <TextInput
                        style={styles.swapConfigInput}
                        value={swapWeight}
                        onChangeText={setSwapWeight}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={COLORS.textMeta}
                      />
                    </View>
                    <View style={styles.swapConfigField}>
                      <Text style={styles.swapConfigLabel}>Reps</Text>
                      <TextInput
                        style={styles.swapConfigInput}
                        value={swapReps}
                        onChangeText={setSwapReps}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={COLORS.textMeta}
                      />
                    </View>
                    <View style={styles.swapConfigField}>
                      <Text style={styles.swapConfigLabel}>Sets</Text>
                      <TextInput
                        style={styles.swapConfigInput}
                        value={swapSets}
                        onChangeText={setSwapSets}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={COLORS.textMeta}
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* Confirm Button */}
              <View style={styles.swapButtonContainer}>
                <TouchableOpacity
                  style={[
                    styles.swapConfirmButton,
                    !selectedNewExerciseId && styles.swapConfirmButtonDisabled,
                  ]}
                  onPress={handleConfirmSwap}
                  disabled={!selectedNewExerciseId}
                  activeOpacity={1}
                >
                  <Text
                    style={[
                      styles.swapConfirmButtonText,
                      !selectedNewExerciseId && styles.swapConfirmButtonTextDisabled,
                    ]}
                  >
                    Confirm Swap
                  </Text>
                </TouchableOpacity>
              </View>
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
            <Text style={styles.modalTitle}>Apply Changes</Text>
            <Text style={styles.modalMessage}>
              Do you want to apply these changes to this workout only or all future workouts in this cycle?
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => handleApplyChanges(false)}
                activeOpacity={1}
              >
                <Text style={styles.modalButtonSecondaryText}>This Workout Only</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => handleApplyChanges(true)}
                activeOpacity={1}
              >
                <Text style={styles.modalButtonPrimaryText}>All Future Workouts</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowApplyModal(false)}
              activeOpacity={1}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
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
  pageTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
  },
  workoutNameSection: {
    marginBottom: SPACING.xl,
  },
  sectionLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: SPACING.md,
  },
  workoutNameButton: {
    padding: SPACING.md,
    backgroundColor: COLORS.backgroundCanvas,
    borderRadius: BORDER_RADIUS.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  workoutName: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.text,
  },
  workoutNameInput: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.text,
    padding: SPACING.md,
    backgroundColor: COLORS.backgroundCanvas,
    borderRadius: BORDER_RADIUS.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: COLORS.border,
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
    minHeight: 56, // Fixed height matching other cards
  },
  exerciseCardPressed: {
    borderColor: LIGHT_COLORS.textMeta,
  },
  exerciseCardContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    paddingRight: 48, // Make room for grip handle
  },
  gripHandle: {
    position: 'absolute',
    right: 16, // 24px from right side - adjusted for padding
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: '100%',
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
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    marginTop: SPACING.lg,
  },
  addExerciseButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
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
  errorText: {
    ...TYPOGRAPHY.body,
    color: COLORS.error,
    textAlign: 'center',
    padding: SPACING.xl,
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
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderCurve: 'continuous',
    alignItems: 'center',
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
  // Swap Drawer Content
  drawerContent: {
    flex: 1,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  closeButtonText: {
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
    margin: SPACING.xxl,
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
  swapExerciseList: {
    maxHeight: 300,
    paddingHorizontal: SPACING.xxl,
  },
  swapExerciseItem: {
    padding: SPACING.lg,
    backgroundColor: COLORS.backgroundCanvas,
    borderRadius: BORDER_RADIUS.md,
    borderCurve: 'continuous',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  swapExerciseItemSelected: {
    backgroundColor: COLORS.backgroundContainer,
    borderColor: COLORS.text,
    borderWidth: 2,
  },
  swapExerciseName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
  },
  swapExerciseMeta: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginTop: 4,
  },
  swapConfigSection: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
  swapButtonContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.xl,
    paddingBottom: 40,
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

