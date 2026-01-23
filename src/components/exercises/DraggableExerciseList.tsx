import React, { useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  PanResponderInstance,
} from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, CARDS } from '../../constants';
import { IconGripVertical, IconSwap, IconTrash, IconEdit } from '../icons';

export type DraggableExerciseItem = {
  id: string;
  exerciseId: string;
  name: string;
  order: number;
};

type ActionButton = 'swap' | 'edit' | 'delete';

type Props = {
  exercises: DraggableExerciseItem[];
  onReorder: (exercises: DraggableExerciseItem[]) => void;
  onSwap?: (exerciseId: string) => void;
  onEdit?: (exerciseId: string) => void;
  onDelete: (exerciseId: string) => void;
  selectedExerciseId?: string | null;
  onSelectExercise?: (exerciseId: string | null) => void;
  actionButtons?: ActionButton[];
  scrollEnabled?: boolean;
  onScrollEnabledChange?: (enabled: boolean) => void;
};

export function DraggableExerciseList({
  exercises,
  onReorder,
  onSwap,
  onEdit,
  onDelete,
  selectedExerciseId,
  onSelectExercise,
  actionButtons = ['edit', 'delete'],
  scrollEnabled = true,
  onScrollEnabledChange,
}: Props) {
  const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = React.useState<number | null>(null);
  
  const dragOffsetY = useRef(new Animated.Value(0)).current;
  const draggingIndexRef = useRef<number | null>(null);
  const dropTargetIndexRef = useRef<number | null>(null);
  const panRespondersRef = useRef<Record<string, PanResponderInstance>>({});
  const indexByIdRef = useRef<Record<string, number>>({});
  
  // Animation values for card width and icon reveal per exercise
  const animValuesRef = useRef<Record<string, {
    cardWidth: Animated.Value;
    iconsOpacity: Animated.Value;
    iconsTranslateX: Animated.Value;
  }>>({});
  
  // Initialize animation values for each exercise
  exercises.forEach(exercise => {
    if (!animValuesRef.current[exercise.id]) {
      animValuesRef.current[exercise.id] = {
        cardWidth: new Animated.Value(100),
        iconsOpacity: new Animated.Value(0),
        iconsTranslateX: new Animated.Value(20),
      };
    }
  });
  
  // Animate card selection
  useEffect(() => {
    exercises.forEach(exercise => {
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
  }, [selectedExerciseId, exercises]);
  
  const handleDragStart = useCallback((index: number) => {
    draggingIndexRef.current = index;
    dropTargetIndexRef.current = index;
    setDraggingIndex(index);
    setDropTargetIndex(index);
    onSelectExercise?.(null); // Close any open action icons
    onScrollEnabledChange?.(false); // Disable scroll while dragging
  }, [onSelectExercise, onScrollEnabledChange]);
  
  const handleDragMove = useCallback((dy: number) => {
    if (draggingIndexRef.current === null) return;
    
    const ITEM_HEIGHT = 76; // Card height with margin
    
    let offset;
    if (dy > 0) {
      offset = Math.floor((dy + ITEM_HEIGHT) / ITEM_HEIGHT);
    } else {
      offset = Math.floor((dy + ITEM_HEIGHT / 2) / ITEM_HEIGHT);
    }
    
    let targetIndex = draggingIndexRef.current + offset;
    targetIndex = Math.max(0, Math.min(exercises.length, targetIndex));
    
    if (targetIndex !== dropTargetIndexRef.current) {
      dropTargetIndexRef.current = targetIndex;
      setDropTargetIndex(targetIndex);
    }
  }, [exercises.length]);
  
  const handleDragEnd = useCallback(() => {
    const origIndex = draggingIndexRef.current;
    const targetIndex = dropTargetIndexRef.current;
    
    if (origIndex !== null && targetIndex !== null && origIndex !== targetIndex) {
      const newExercises = [...exercises];
      const [movedItem] = newExercises.splice(origIndex, 1);
      
      let insertIndex = targetIndex;
      if (targetIndex > origIndex) {
        insertIndex = targetIndex - 1;
      }
      
      newExercises.splice(insertIndex, 0, movedItem);
      
      // Update order property
      const reorderedExercises = newExercises.map((ex, idx) => ({
        ...ex,
        order: idx,
      }));
      
      onReorder(reorderedExercises);
    }
    
    draggingIndexRef.current = null;
    dropTargetIndexRef.current = null;
    setDraggingIndex(null);
    setDropTargetIndex(null);
    dragOffsetY.setValue(0);
    onScrollEnabledChange?.(true); // Re-enable scroll after dragging
  }, [exercises, onReorder, onScrollEnabledChange]);
  
  const handleToggleSelection = (exerciseId: string) => {
    onSelectExercise?.(selectedExerciseId === exerciseId ? null : exerciseId);
  };
  
  return (
    <>
      {exercises.map((exercise, index) => {
        const isSelected = selectedExerciseId === exercise.id;
        const anims = animValuesRef.current[exercise.id];
        const isDragging = draggingIndex === index;
        
        if (!anims) return null;
        
        // Create pan responder for this exercise's grip handle
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
        
        // Show drop indicator at target position
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
                      onPress={() => handleToggleSelection(exercise.id)}
                      activeOpacity={1}
                    >
                      <View style={styles.exerciseCardContent}>
                        <Text
                          style={styles.exerciseName}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {exercise.name}
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
                  {actionButtons.includes('swap') && onSwap && (
                    <TouchableOpacity
                      onPress={() => onSwap(exercise.id)}
                      style={styles.actionButton}
                      activeOpacity={1}
                    >
                      <IconSwap size={20} color={COLORS.text} />
                    </TouchableOpacity>
                  )}
                  {actionButtons.includes('edit') && onEdit && (
                    <TouchableOpacity
                      onPress={() => onEdit(exercise.id)}
                      style={styles.actionButton}
                      activeOpacity={1}
                    >
                      <IconEdit size={20} color={COLORS.textMeta} />
                    </TouchableOpacity>
                  )}
                  {actionButtons.includes('delete') && (
                    <TouchableOpacity
                      onPress={() => onDelete(exercise.id)}
                      style={styles.actionButton}
                      activeOpacity={1}
                    >
                      <IconTrash size={20} color={COLORS.error} />
                    </TouchableOpacity>
                  )}
                </Animated.View>
              </View>
            </Animated.View>
          </React.Fragment>
        );
      })}
      
      {/* Drop indicator at the end if dragging to last position */}
      {draggingIndex !== null && dropTargetIndex === exercises.length && (
        <View style={styles.dropIndicator}>
          <View style={styles.dropIndicatorLine} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  exerciseItemWrapper: {
    marginBottom: SPACING.md,
  },
  dropIndicator: {
    height: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md / 2 - 2,
    marginBottom: SPACING.md / 2 - 2,
  },
  dropIndicatorLine: {
    width: '100%',
    height: 4,
    backgroundColor: '#FD6B00',
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
    right: 16,
    top: SPACING.lg,
    bottom: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
  },
  exerciseName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
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
});
