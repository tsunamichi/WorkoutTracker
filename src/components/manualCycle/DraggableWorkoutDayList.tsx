import React, { useRef, useCallback } from 'react';
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
import { IconGripVertical, IconCheck } from '../icons';
import { Weekday } from '../../types/manualCycle';

export type DraggableWorkoutDay = {
  weekday: Weekday;
  name: string;
  exerciseCount: number;
  order: number;
};

type Props = {
  days: DraggableWorkoutDay[];
  onReorder: (days: DraggableWorkoutDay[]) => void;
  onDayPress: (weekday: Weekday) => void;
  scrollEnabled?: boolean;
  onScrollEnabledChange?: (enabled: boolean) => void;
  t: (key: string) => string;
};

export function DraggableWorkoutDayList({
  days,
  onReorder,
  onDayPress,
  scrollEnabled = true,
  onScrollEnabledChange,
  t,
}: Props) {
  const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = React.useState<number | null>(null);
  
  const dragOffsetY = useRef(new Animated.Value(0)).current;
  const draggingIndexRef = useRef<number | null>(null);
  const dropTargetIndexRef = useRef<number | null>(null);
  const panRespondersRef = useRef<Record<string, PanResponderInstance>>({});
  const indexByIdRef = useRef<Record<string, number>>({});
  
  const handleDragStart = useCallback((index: number) => {
    draggingIndexRef.current = index;
    dropTargetIndexRef.current = index;
    setDraggingIndex(index);
    setDropTargetIndex(index);
    onScrollEnabledChange?.(false);
  }, [onScrollEnabledChange]);
  
  const handleDragMove = useCallback((dy: number) => {
    if (draggingIndexRef.current === null) return;
    
    const ITEM_HEIGHT = 100; // Approximate card height with margin
    
    let offset;
    if (dy > 0) {
      offset = Math.floor((dy + ITEM_HEIGHT) / ITEM_HEIGHT);
    } else {
      offset = Math.floor((dy + ITEM_HEIGHT / 2) / ITEM_HEIGHT);
    }
    
    let targetIndex = draggingIndexRef.current + offset;
    targetIndex = Math.max(0, Math.min(days.length, targetIndex));
    
    if (targetIndex !== dropTargetIndexRef.current) {
      dropTargetIndexRef.current = targetIndex;
      setDropTargetIndex(targetIndex);
    }
  }, [days.length]);
  
  const handleDragEnd = useCallback(() => {
    const origIndex = draggingIndexRef.current;
    const targetIndex = dropTargetIndexRef.current;
    
    if (origIndex !== null && targetIndex !== null && origIndex !== targetIndex) {
      const newDays = [...days];
      const [movedItem] = newDays.splice(origIndex, 1);
      
      let insertIndex = targetIndex;
      if (targetIndex > origIndex) {
        insertIndex = targetIndex - 1;
      }
      
      newDays.splice(insertIndex, 0, movedItem);
      
      // Update order property
      const reorderedDays = newDays.map((day, idx) => ({
        ...day,
        order: idx,
      }));
      
      onReorder(reorderedDays);
    }
    
    draggingIndexRef.current = null;
    dropTargetIndexRef.current = null;
    setDraggingIndex(null);
    setDropTargetIndex(null);
    dragOffsetY.setValue(0);
    onScrollEnabledChange?.(true);
  }, [days, onReorder, onScrollEnabledChange]);
  
  return (
    <>
      {days.map((day, index) => {
        const isDragging = draggingIndex === index;
        const isComplete = day.exerciseCount > 0;
        
        // Create pan responder for this day's grip handle
        indexByIdRef.current[day.weekday] = index;
        if (!panRespondersRef.current[day.weekday]) {
          panRespondersRef.current[day.weekday] = PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onStartShouldSetPanResponderCapture: () => true,
            onMoveShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponderCapture: () => true,
            onPanResponderGrant: () => {
              const currentIndex = indexByIdRef.current[day.weekday];
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
        const panResponder = panRespondersRef.current[day.weekday];
        
        // Show drop indicator at target position
        const showDropIndicatorBefore = draggingIndex !== null && 
          dropTargetIndex !== null &&
          dropTargetIndex === index && 
          draggingIndex !== index;
        
        return (
          <React.Fragment key={day.weekday}>
            {showDropIndicatorBefore && (
              <View style={styles.dropIndicator}>
                <View style={styles.dropIndicatorLine} />
              </View>
            )}
            <Animated.View 
              style={[
                styles.dayCardWrapper,
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
              <View style={styles.dayCard}>
                <TouchableOpacity
                  style={styles.dayCardInner}
                  onPress={() => onDayPress(day.weekday)}
                  activeOpacity={1}
                  disabled={isDragging}
                >
                  <View
                    style={[
                      styles.dayCardContent,
                      isComplete
                        ? styles.dayCardContentComplete
                        : styles.dayCardContentWithAction,
                    ]}
                  >
                    <View style={styles.dayCardHeader}>
                      <Text style={styles.dayLabel}>{day.name}</Text>
                      
                      {/* Grip Handle - Absolute positioned with drag functionality */}
                      <View 
                        style={styles.gripHandle}
                        {...panResponder.panHandlers}
                        onStartShouldSetResponder={() => true}
                      >
                        <IconGripVertical 
                          size={20} 
                          color={isDragging ? COLORS.text : COLORS.textMeta} 
                        />
                      </View>
                    </View>
                    <Text style={styles.exerciseCount}>
                      {day.exerciseCount} {day.exerciseCount === 1 ? t('exercise') : t('exercises')}
                      {` • ${t('dayNumber').replace('{number}', String(index + 1))}`}
                    </Text>
                  </View>
                  {isComplete && (
                    <View style={styles.dayCheckIcon}>
                      <IconCheck size={24} color={COLORS.signalPositive} />
                    </View>
                  )}
                  {!isComplete && (
                    <View style={styles.dayCardFooter} pointerEvents="none">
                      <View style={styles.dayActionBar}>
                        <Text style={styles.dayActionText}>{t('addExercises')}</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
          </React.Fragment>
        );
      })}
      
      {/* Drop indicator at the end if dragging to last position */}
      {draggingIndex !== null && dropTargetIndex === days.length && (
        <View style={styles.dropIndicator}>
          <View style={styles.dropIndicatorLine} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  dayCardWrapper: {
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
  dayCard: {
    backgroundColor: CARDS.cardDeep.outer.backgroundColor,
    borderRadius: CARDS.cardDeep.outer.borderRadius,
    borderCurve: CARDS.cardDeep.outer.borderCurve,
    overflow: CARDS.cardDeep.outer.overflow,
  },
  dayCardInner: {
    ...CARDS.cardDeep.inner,
    paddingHorizontal: 4,
    paddingTop: 16,
    paddingBottom: 4,
  },
  dayCardContent: {
    paddingHorizontal: 20,
  },
  dayCardContentWithAction: {
    paddingBottom: 16,
  },
  dayCardContentComplete: {
    paddingBottom: 16,
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
    position: 'relative',
  },
  dayCardFooter: {
    marginTop: 'auto',
  },
  dayLabel: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    flex: 1,
    paddingRight: 40, // Make room for grip handle
  },
  exerciseCount: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  dayActionText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
    textAlign: 'left',
  },
  dayActionBar: {
    width: '100%',
    height: 48,
    backgroundColor: COLORS.accentPrimaryDimmed,
    paddingHorizontal: 20,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  dayCheckIcon: {
    position: 'absolute',
    top: 20,
    right: 60, // Moved left to make room for grip handle
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gripHandle: {
    position: 'absolute',
    right: 0,
    top: -2,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
