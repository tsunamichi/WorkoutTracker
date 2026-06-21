import React, { useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  FlatList,
  type PanResponderInstance,
} from 'react-native';
import { IconGripVertical } from '../icons';
import { SPACING } from '../../constants';
import { useAppTheme } from '../../theme/useAppTheme';
import { ExerciseWeightProgressRowView } from './ExerciseWeightProgressRow';
import type { ExerciseWeightProgressRow } from '../../types/exerciseWeightProgress';

const ITEM_HEIGHT = 112;

type Props = {
  rows: ExerciseWeightProgressRow[];
  useKg: boolean;
  onReorder: (rows: ExerciseWeightProgressRow[]) => void;
  mainLiftBadgeLabel: string;
  weightUnitLabel: string;
  onScrollEnabledChange?: (enabled: boolean) => void;
  contentContainerStyle?: object;
  scrollEnabled?: boolean;
};

export function DraggableWeightProgressList({
  rows,
  useKg,
  onReorder,
  mainLiftBadgeLabel,
  weightUnitLabel,
  onScrollEnabledChange,
  contentContainerStyle,
  scrollEnabled = true,
}: Props) {
  const { colors: themeColors } = useAppTheme();
  const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = React.useState<number | null>(null);

  const dragOffsetY = useRef(new Animated.Value(0)).current;
  const draggingIndexRef = useRef<number | null>(null);
  const dropTargetIndexRef = useRef<number | null>(null);
  const panRespondersRef = useRef<Record<string, PanResponderInstance>>({});
  const indexByIdRef = useRef<Record<string, number>>({});

  const handleDragStart = useCallback(
    (index: number) => {
      draggingIndexRef.current = index;
      dropTargetIndexRef.current = index;
      setDraggingIndex(index);
      setDropTargetIndex(index);
      onScrollEnabledChange?.(false);
    },
    [onScrollEnabledChange],
  );

  const handleDragMove = useCallback(
    (dy: number) => {
      if (draggingIndexRef.current === null) return;
      const offset =
        dy > 0
          ? Math.floor((dy + ITEM_HEIGHT) / ITEM_HEIGHT)
          : Math.floor((dy + ITEM_HEIGHT / 2) / ITEM_HEIGHT);
      let targetIndex = draggingIndexRef.current + offset;
      targetIndex = Math.max(0, Math.min(rows.length, targetIndex));
      if (targetIndex !== dropTargetIndexRef.current) {
        dropTargetIndexRef.current = targetIndex;
        setDropTargetIndex(targetIndex);
      }
    },
    [rows.length],
  );

  const handleDragEnd = useCallback(() => {
    const origIndex = draggingIndexRef.current;
    const targetIndex = dropTargetIndexRef.current;

    if (origIndex !== null && targetIndex !== null && origIndex !== targetIndex) {
      const next = [...rows];
      const [moved] = next.splice(origIndex, 1);
      let insertIndex = targetIndex;
      if (targetIndex > origIndex) insertIndex = targetIndex - 1;
      next.splice(insertIndex, 0, moved);
      onReorder(next);
    }

    draggingIndexRef.current = null;
    dropTargetIndexRef.current = null;
    setDraggingIndex(null);
    setDropTargetIndex(null);
    dragOffsetY.setValue(0);
    onScrollEnabledChange?.(true);
  }, [rows, onReorder, onScrollEnabledChange]);

  const renderItem = useCallback(
    ({ item: row, index }: { item: ExerciseWeightProgressRow; index: number }) => {
      const isDragging = draggingIndex === index;
      indexByIdRef.current[row.exerciseId] = index;

      if (!panRespondersRef.current[row.exerciseId]) {
        panRespondersRef.current[row.exerciseId] = PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderGrant: () => {
            const currentIndex = indexByIdRef.current[row.exerciseId];
            if (currentIndex !== undefined) handleDragStart(currentIndex);
          },
          onPanResponderMove: (_evt, gestureState) => {
            dragOffsetY.setValue(gestureState.dy);
            handleDragMove(gestureState.dy);
          },
          onPanResponderRelease: handleDragEnd,
          onPanResponderTerminate: handleDragEnd,
        });
      }

      const panResponder = panRespondersRef.current[row.exerciseId];
      const showDropIndicatorBefore =
        draggingIndex !== null && dropTargetIndex === index && draggingIndex !== index;

      return (
        <View>
          {showDropIndicatorBefore ? (
            <View style={[styles.dropIndicator, { backgroundColor: themeColors.accentPrimary }]} />
          ) : null}
          <Animated.View
            style={[
              styles.rowWrap,
              isDragging && {
                opacity: 0.95,
                transform: [{ translateY: dragOffsetY }, { scale: 1.01 }],
                zIndex: 10,
              },
            ]}
          >
            <View style={styles.rowContent}>
              <ExerciseWeightProgressRowView
                row={row}
                useKg={useKg}
                mainLiftBadgeLabel={mainLiftBadgeLabel}
                weightUnitLabel={weightUnitLabel}
              />
            </View>
            <View style={styles.handle} {...panResponder.panHandlers}>
              <IconGripVertical size={20} color={themeColors.textMeta} />
            </View>
          </Animated.View>
        </View>
      );
    },
    [
      draggingIndex,
      dropTargetIndex,
      dragOffsetY,
      handleDragStart,
      handleDragMove,
      handleDragEnd,
      useKg,
      mainLiftBadgeLabel,
      weightUnitLabel,
      themeColors.accentPrimary,
      themeColors.textMeta,
    ],
  );

  return (
    <FlatList
      style={styles.list}
      data={rows}
      keyExtractor={item => item.exerciseId}
      renderItem={renderItem}
      contentContainerStyle={contentContainerStyle}
      scrollEnabled={scrollEnabled}
      showsVerticalScrollIndicator={false}
      extraData={{ draggingIndex, dropTargetIndex }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: SPACING.xs,
  },
  rowContent: {
    flex: 1,
  },
  handle: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropIndicator: {
    height: 2,
    borderRadius: 1,
    marginBottom: SPACING.xs,
  },
});
