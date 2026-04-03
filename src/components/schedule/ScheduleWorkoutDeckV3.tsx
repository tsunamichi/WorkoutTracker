import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { CARDS, COLORS, SPACING, TYPOGRAPHY } from '../../constants';
import { IconArrowDiagonal } from '../icons';

const FRONT_H = 330;
const STACK_HEIGHT = FRONT_H;
const CARD_GAP = -8;
const PARALLAX_MAX = 8;

export type ScheduleDeckV3Item = {
  id: string;
  title: string;
  subtitle?: string;
  exerciseCount: number;
  onPress?: (origin?: { x: number; y: number; width: number; height: number; borderRadius: number }) => void;
};

type Props = {
  items: ScheduleDeckV3Item[];
  mode: 'queue' | 'inProgress';
  inProgressItem?: ScheduleDeckV3Item;
};

function DeckCard({
  item,
  positionLabel,
  numberAnimatedStyle,
}: {
  item: ScheduleDeckV3Item;
  positionLabel: string;
  numberAnimatedStyle?: any;
}) {
  return (
    <View style={styles.cardOuter}>
      <View style={styles.cardInner}>
        <Animated.Text style={[styles.cardPositionLabel, numberAnimatedStyle]} numberOfLines={1}>
          {positionLabel}
        </Animated.Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.cardMeta}>
          {item.exerciseCount} {item.exerciseCount === 1 ? 'exercise' : 'exercises'}
        </Text>
        {item.subtitle ? <Text style={styles.cardSubmeta}>{item.subtitle}</Text> : null}
        <View style={styles.cardSpacer} />
        <View style={styles.cardFooter}>
          <IconArrowDiagonal size={16} color={COLORS.containerPrimary} />
        </View>
      </View>
    </View>
  );
}

function AnimatedCarouselItem({
  item,
  index,
  itemWidth,
  gap,
  scrollX,
  snapInterval,
  onPress,
  isLast,
  positionLabel,
}: {
  item: ScheduleDeckV3Item;
  index: number;
  itemWidth: number;
  gap: number;
  scrollX: Animated.SharedValue<number>;
  snapInterval: number;
  onPress: (item: ScheduleDeckV3Item, node?: TouchableOpacity | null) => void;
  isLast: boolean;
  positionLabel: string;
}) {
  const itemRef = useRef<TouchableOpacity | null>(null);
  const animatedStyle = useAnimatedStyle(() => {
    const centerX = index * snapInterval;
    const progress = (scrollX.value - centerX) / snapInterval;
    const absProgress = Math.min(1, Math.abs(progress));
    const scale = interpolate(absProgress, [0, 1], [1, 0.9], 'clamp');

    // Subtle spread: zero at snap points, wider near mid-swipe, then settles.
    const spread = interpolate(absProgress, [0, 0.5, 1], [0, PARALLAX_MAX, 0], 'clamp');
    const direction = progress === 0 ? 0 : progress > 0 ? -1 : 1;
    const translateX = direction * spread;

    return {
      transform: [{ translateX }, { scale }],
    };
  }, [index, snapInterval]);
  const numberParallaxStyle = useAnimatedStyle(() => {
    const centerX = index * snapInterval;
    const progress = (scrollX.value - centerX) / snapInterval;
    const clamped = Math.max(-1, Math.min(1, progress));
    return {
      transform: [{ translateX: interpolate(clamped, [-1, 0, 1], [30, 0, -30], 'clamp') }],
    };
  }, [index, snapInterval]);

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      style={[
        styles.itemWrap,
        {
          width: itemWidth,
          marginRight: isLast ? 0 : gap,
        },
      ]}
      onPress={() => onPress(item, itemRef.current)}
      ref={itemRef}
    >
      <Animated.View style={[styles.cardAnimShell, animatedStyle]}>
        <DeckCard item={item} positionLabel={positionLabel} numberAnimatedStyle={numberParallaxStyle} />
      </Animated.View>
    </TouchableOpacity>
  );
}

export function ScheduleWorkoutDeckV3({ items, mode, inProgressItem }: Props) {
  const { width } = useWindowDimensions();
  const sideInset = 24;
  const viewportWidth = Math.max(0, width);
  const itemWidth = Math.max(240, viewportWidth - sideInset * 2);
  const snapInterval = itemWidth + CARD_GAP;

  const queueItems = useMemo(() => items, [items]);
  const inProgressCard = inProgressItem ?? queueItems[0];

  const [currentIndex, setCurrentIndex] = useState(0);
  const isSwipingRef = useRef(false);
  const swipeUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollX = useSharedValue(0);
  const inProgressRef = useRef<TouchableOpacity | null>(null);

  useEffect(() => {
    setCurrentIndex(prev => {
      if (queueItems.length === 0) return 0;
      return Math.min(prev, queueItems.length - 1);
    });
  }, [queueItems.length]);

  useEffect(() => {
    return () => {
      if (swipeUnlockTimerRef.current) clearTimeout(swipeUnlockTimerRef.current);
    };
  }, []);

  const lockSwipe = useCallback(() => {
    if (swipeUnlockTimerRef.current) {
      clearTimeout(swipeUnlockTimerRef.current);
      swipeUnlockTimerRef.current = null;
    }
    isSwipingRef.current = true;
  }, []);

  const unlockSwipeSoon = useCallback(() => {
    if (swipeUnlockTimerRef.current) clearTimeout(swipeUnlockTimerRef.current);
    swipeUnlockTimerRef.current = setTimeout(() => {
      isSwipingRef.current = false;
    }, 80);
  }, []);

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = event.nativeEvent.contentOffset.x;
      const idx = Math.max(0, Math.min(queueItems.length - 1, Math.round(x / snapInterval)));
      setCurrentIndex(idx);
      unlockSwipeSoon();
    },
    [queueItems.length, snapInterval, unlockSwipeSoon],
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: event => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const onCardPress = useCallback((item: ScheduleDeckV3Item, node?: TouchableOpacity | null) => {
    if (isSwipingRef.current) return;
    if (!node || typeof (node as any).measureInWindow !== 'function') {
      item.onPress?.();
      return;
    }
    (node as any).measureInWindow((x: number, y: number, width: number, height: number) => {
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        item.onPress?.();
        return;
      }
      item.onPress?.({
        x,
        y,
        width,
        height,
        borderRadius: CARDS.cardDeep.outer.borderRadius,
      });
    });
  }, []);

  if (mode === 'inProgress' && inProgressCard) {
    return (
      <View style={[styles.stackRoot, { height: STACK_HEIGHT }]}>
        <TouchableOpacity
          style={[styles.singleCardWrap, { marginHorizontal: (viewportWidth - itemWidth) / 2 }]}
          onPress={() => onCardPress(inProgressCard, inProgressRef.current)}
          activeOpacity={0.95}
          ref={inProgressRef}
        >
          <DeckCard item={inProgressCard} positionLabel="1" />
        </TouchableOpacity>
      </View>
    );
  }

  if (queueItems.length === 0) return null;

  return (
    <View style={[styles.stackRoot, { height: STACK_HEIGHT }]}>
      <Animated.FlatList
        horizontal
        data={queueItems}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <AnimatedCarouselItem
            item={item}
            index={index}
            itemWidth={itemWidth}
            gap={CARD_GAP}
            scrollX={scrollX}
            snapInterval={snapInterval}
            onPress={onCardPress}
            isLast={index === queueItems.length - 1}
            positionLabel={String(index + 1)}
          />
        )}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        decelerationRate="fast"
        disableIntervalMomentum
        snapToInterval={snapInterval}
        snapToAlignment="start"
        contentContainerStyle={{
          paddingHorizontal: (viewportWidth - itemWidth) / 2,
          alignItems: 'flex-end',
        }}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollBeginDrag={lockSwipe}
        onScrollEndDrag={unlockSwipeSoon}
        onMomentumScrollEnd={onMomentumEnd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stackRoot: {
    position: 'relative',
    width: '100%',
    overflow: 'visible',
  },
  itemWrap: {
    height: FRONT_H,
  },
  singleCardWrap: {
    height: FRONT_H,
  },
  cardOuter: {
    backgroundColor: COLORS.accentSecondarySoft,
    borderRadius: CARDS.cardDeep.outer.borderRadius,
    borderCurve: CARDS.cardDeep.outer.borderCurve,
    borderWidth: 2,
    borderColor: COLORS.canvasLight,
    overflow: CARDS.cardDeep.outer.overflow,
    width: '100%',
    height: '100%',
  },
  cardAnimShell: {
    width: '100%',
    height: '100%',
  },
  cardInner: {
    flex: 1,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderRadius: CARDS.cardDeep.inner.borderRadius,
    borderCurve: CARDS.cardDeep.inner.borderCurve,
    backgroundColor: 'transparent',
  },
  cardPositionLabel: {
    position: 'absolute',
    right: -34,
    bottom: -94,
    fontSize: 300,
    lineHeight: 300,
    fontWeight: '500',
    color: COLORS.containerPrimary,
    includeFontPadding: false,
  },
  cardTitle: {
    ...TYPOGRAPHY.displayLarge,
    color: COLORS.containerPrimary,
  },
  cardSpacer: {
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  cardMeta: {
    ...TYPOGRAPHY.body,
    color: COLORS.containerPrimary,
    fontWeight: '500',
    marginTop: 10,
  },
  cardSubmeta: {
    ...TYPOGRAPHY.meta,
    marginTop: 4,
    color: COLORS.accentSecondary,
  },
});
