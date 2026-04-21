import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { useAppTheme } from '../../theme/useAppTheme';
import { useTranslation } from '../../i18n/useTranslation';

const FRONT_H = 330;
const STACK_HEIGHT = FRONT_H;
const CARD_GAP = -8;
const PARALLAX_MAX = 8;
const EXIT_SPREAD_X = 180;

export type ScheduleDeckV3Item = {
  id: string;
  title: string;
  subtitle?: string;
  exerciseCount: number;
  variant?: 'default' | 'completed' | 'create' | 'createStack';
  cardBackgroundColor?: string;
  cardTextColor?: string;
  footerLabel?: string;
  onPress?: (origin?: { x: number; y: number; width: number; height: number; borderRadius: number }) => void;
  /** `createStack` only — three independent actions inside one carousel slide */
  onCreateBlank?: () => void;
  onPasteWorkout?: () => void;
  onUseRecentWorkout?: () => void;
};

type Props = {
  items: ScheduleDeckV3Item[];
  mode: 'queue' | 'inProgress';
  inProgressItem?: ScheduleDeckV3Item;
  initialIndex?: number;
  /** When `token` changes, scrolls the queue to `index` (e.g. after creating a workout). */
  imperativeScrollTo?: { index: number; token: number } | null;
  onImperativeScrollDone?: () => void;
  chromeExitProgress?: Animated.SharedValue<number>;
};
type TouchNode = React.ElementRef<typeof TouchableOpacity>;

/** First word uses `TYPOGRAPHY.h1`; remainder stays 24px (`h2` + 400). */
function CreateStackOptionLabel({ text, color }: { text: string; color: string }) {
  const trimmed = text.trim();
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) {
    return (
      <Text>
        <Text style={[styles.createStackRowFirstWord, { color }]}>{trimmed}</Text>
      </Text>
    );
  }
  return (
    <Text>
      <Text style={[styles.createStackRowFirstWord, { color }]}>{trimmed.slice(0, spaceIdx)}</Text>
      <Text style={[styles.createStackRowRest, { color }]}>{trimmed.slice(spaceIdx)}</Text>
    </Text>
  );
}

function DeckCard({
  item,
  positionLabel,
  numberAnimatedStyle,
}: {
  item: ScheduleDeckV3Item;
  positionLabel: string;
  numberAnimatedStyle?: any;
}) {
  const { t } = useTranslation();
  const { colors: themeColors } = useAppTheme();
  const cardBackgroundColor = item.cardBackgroundColor ?? themeColors.containerSecondary;
  const cardTextColor = item.cardTextColor ?? themeColors.containerPrimary;
  const cardBorderColor = themeColors.canvasLight;
  // At fontSize 300, intrinsic layout can wrap multi-digit labels if the box is card-width.
  // Fixed width from digit count + textAlign right keeps the same right anchor as shrink-wrap.
  // "+" uses the same declared size as digits but its glyph is shorter/narrower; bump size for "+" only.
  const isPlusIndex = positionLabel === '+';
  const indexLabelBoxWidth = useMemo(() => {
    if (isPlusIndex) return 320;
    const len = Math.max(1, positionLabel.length);
    return Math.min(960, Math.max(200, len * 240));
  }, [positionLabel, isPlusIndex]);

  if (item.variant === 'createStack') {
    return (
      <View style={styles.createStackRoot}>
        <View style={styles.createStackInner}>
          <Text style={[styles.createStackSectionTitle, { color: themeColors.textMeta }]}>{item.title}</Text>
          <TouchableOpacity
            style={styles.createStackRow}
            onPress={() => item.onCreateBlank?.()}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={t('miniCardCreateWorkout')}
          >
            <CreateStackOptionLabel
              text={t('miniCardCreateWorkoutSubtitle')}
              color={themeColors.containerPrimary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.createStackRow}
            onPress={() => item.onPasteWorkout?.()}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={t('miniCardPasteWorkout')}
          >
            <CreateStackOptionLabel
              text={t('miniCardPasteWorkoutSubtitle')}
              color={themeColors.containerPrimary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.createStackRow, styles.createStackRowLast]}
            onPress={() => item.onUseRecentWorkout?.()}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={t('miniCardUseRecentWorkout')}
          >
            <CreateStackOptionLabel
              text={t('miniCardUseRecentWorkoutSubtitle')}
              color={themeColors.containerPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.cardOuter, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
      <View style={styles.cardInner}>
        <View style={[styles.cardPositionLabelWrap, { width: indexLabelBoxWidth }]}>
          <Animated.Text
            style={[
              styles.cardPositionLabelText,
              isPlusIndex && styles.cardPositionLabelPlus,
              { color: cardTextColor },
              numberAnimatedStyle,
            ]}
            numberOfLines={1}
            ellipsizeMode="clip"
          >
            {positionLabel}
          </Animated.Text>
        </View>
        <Text style={[styles.cardTitle, { color: cardTextColor }]} numberOfLines={1}>
          {item.title}
        </Text>
        {item.variant === 'create' ? (
          item.subtitle ? (
            <Text style={[styles.cardSubmeta, { color: themeColors.textMeta }]}>{item.subtitle}</Text>
          ) : null
        ) : (
          <>
            <Text style={[styles.cardMeta, { color: cardTextColor }]}>
              {item.exerciseCount} {item.exerciseCount === 1 ? 'exercise' : 'exercises'}
            </Text>
            {item.subtitle ? (
              <Text style={[styles.cardSubmeta, { color: themeColors.textMeta }]}>{item.subtitle}</Text>
            ) : null}
          </>
        )}
        <View style={styles.cardSpacer} />
        <View style={styles.cardFooter}>
          {item.variant === 'create' ? (
            <IconArrowDiagonal size={16} color={cardTextColor} />
          ) : item.footerLabel ? (
            <Text style={[styles.cardFooterLabel, { color: cardTextColor }]}>{item.footerLabel}</Text>
          ) : (
            <IconArrowDiagonal size={16} color={cardTextColor} />
          )}
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
  activeIndex,
  chromeExitProgress,
}: {
  item: ScheduleDeckV3Item;
  index: number;
  itemWidth: number;
  gap: number;
  scrollX: Animated.SharedValue<number>;
  snapInterval: number;
  onPress: (item: ScheduleDeckV3Item, node?: TouchNode | null) => void;
  isLast: boolean;
  positionLabel: string;
  activeIndex: number;
  chromeExitProgress?: Animated.SharedValue<number>;
}) {
  const itemRef = useRef<TouchNode | null>(null);
  const animatedStyle = useAnimatedStyle(() => {
    const centerX = index * snapInterval;
    const progress = (scrollX.value - centerX) / snapInterval;
    const absProgress = Math.min(1, Math.abs(progress));
    const scale = interpolate(absProgress, [0, 1], [1, 0.9], 'clamp');

    // Subtle spread: zero at snap points, wider near mid-swipe, then settles.
    const spread = interpolate(absProgress, [0, 0.5, 1], [0, PARALLAX_MAX, 0], 'clamp');
    const direction = progress === 0 ? 0 : progress > 0 ? -1 : 1;
    const baseTranslateX = direction * spread;
    const exitP = chromeExitProgress?.value ?? 0;
    const isActive = index === activeIndex;
    const exitDirection = index < activeIndex ? -1 : 1;
    const exitTranslateX = isActive ? 0 : exitDirection * EXIT_SPREAD_X * exitP;
    const opacity = isActive ? 1 : 1 - exitP;

    return {
      opacity,
      transform: [{ translateX: baseTranslateX + exitTranslateX }, { scale }],
    };
  }, [activeIndex, chromeExitProgress, index, snapInterval]);
  const numberParallaxStyle = useAnimatedStyle(() => {
    const centerX = index * snapInterval;
    const progress = (scrollX.value - centerX) / snapInterval;
    const clamped = Math.max(-1, Math.min(1, progress));
    return {
      transform: [{ translateX: interpolate(clamped, [-1, 0, 1], [30, 0, -30], 'clamp') }],
    };
  }, [index, snapInterval]);

  const shell = (
    <Animated.View style={[styles.cardAnimShell, animatedStyle]}>
      <DeckCard item={item} positionLabel={positionLabel} numberAnimatedStyle={numberParallaxStyle} />
    </Animated.View>
  );

  if (item.variant === 'createStack') {
    return (
      <View
        style={[
          styles.itemWrap,
          {
            width: itemWidth,
            marginRight: isLast ? 0 : gap,
          },
        ]}
      >
        {shell}
      </View>
    );
  }

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
      {shell}
    </TouchableOpacity>
  );
}

export function ScheduleWorkoutDeckV3({
  items,
  mode,
  inProgressItem,
  initialIndex = 0,
  imperativeScrollTo,
  onImperativeScrollDone,
  chromeExitProgress,
}: Props) {
  const { width } = useWindowDimensions();
  const sideInset = 24;
  const viewportWidth = Math.max(0, width);
  const itemWidth = Math.max(240, viewportWidth - sideInset * 2);
  const snapInterval = itemWidth + CARD_GAP;

  const queueItems = useMemo(() => items, [items]);
  const inProgressCard = inProgressItem ?? queueItems[0];
  const clampedInitialIndex = useMemo(
    () => Math.max(0, Math.min(initialIndex, Math.max(0, queueItems.length - 1))),
    [initialIndex, queueItems.length],
  );

  const [currentIndex, setCurrentIndex] = useState(clampedInitialIndex);
  const isSwipingRef = useRef(false);
  const swipeUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollX = useSharedValue(0);
  const inProgressRef = useRef<TouchNode | null>(null);
  const listRef = useRef<FlatList<ScheduleDeckV3Item> | null>(null);
  /** Tracks deck order between updates so a single removal can move focus to the previous card (not the next). */
  const prevQueueItemIdsRef = useRef<string[] | null>(null);

  useLayoutEffect(() => {
    const newIds = queueItems.map(i => i.id);
    const oldIds = prevQueueItemIdsRef.current;

    if (mode !== 'queue' || queueItems.length === 0) {
      prevQueueItemIdsRef.current = newIds;
      return;
    }

    if (oldIds !== null && oldIds.length > 0) {
      if (newIds.length === oldIds.length - 1) {
        const newSet = new Set(newIds);
        const removed = oldIds.filter(id => !newSet.has(id));
        if (removed.length === 1) {
          const removedIndex = oldIds.indexOf(removed[0]);
          setCurrentIndex(prev => {
            const nextIdx = Math.max(
              0,
              Math.min(prev - (removedIndex <= prev ? 1 : 0), newIds.length - 1),
            );
            const tx = nextIdx * snapInterval;
            listRef.current?.scrollToOffset({ offset: tx, animated: false });
            scrollX.value = tx;
            return nextIdx;
          });
          prevQueueItemIdsRef.current = newIds;
          return;
        }
      }
      if (newIds.length !== oldIds.length) {
        setCurrentIndex(prev => {
          const ni = Math.min(prev, Math.max(0, newIds.length - 1));
          const tx = ni * snapInterval;
          listRef.current?.scrollToOffset({ offset: tx, animated: false });
          scrollX.value = tx;
          return ni;
        });
        prevQueueItemIdsRef.current = newIds;
        return;
      }
    }

    prevQueueItemIdsRef.current = newIds;
  }, [queueItems, mode, snapInterval, scrollX]);

  useEffect(() => {
    if (mode !== 'queue' || queueItems.length === 0) return;
    setCurrentIndex(clampedInitialIndex);
    const targetX = clampedInitialIndex * snapInterval;
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: targetX, animated: false });
      scrollX.value = targetX;
    });
  }, [mode, clampedInitialIndex, snapInterval, scrollX]);

  const lastImperativeTokenRef = useRef<number | null>(null);
  useEffect(() => {
    if (mode !== 'queue' || queueItems.length === 0) return;
    if (!imperativeScrollTo) return;
    if (lastImperativeTokenRef.current === imperativeScrollTo.token) return;
    lastImperativeTokenRef.current = imperativeScrollTo.token;
    const idx = Math.max(0, Math.min(imperativeScrollTo.index, queueItems.length - 1));
    setCurrentIndex(idx);
    const targetX = idx * snapInterval;
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: targetX, animated: true });
      scrollX.value = targetX;
      onImperativeScrollDone?.();
    });
  }, [imperativeScrollTo, mode, queueItems.length, snapInterval, scrollX, onImperativeScrollDone]);

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

  const onCardPress = useCallback((item: ScheduleDeckV3Item, node?: TouchNode | null) => {
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
          <DeckCard
            item={inProgressCard}
            positionLabel={inProgressCard.variant === 'create' ? '+' : '1'}
          />
        </TouchableOpacity>
      </View>
    );
  }

  if (queueItems.length === 0) return null;

  return (
    <View style={[styles.stackRoot, { height: STACK_HEIGHT }]}>
      <Animated.FlatList
        ref={listRef}
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
            positionLabel={
              item.variant === 'create' ? '+' : item.variant === 'createStack' ? '' : String(index + 1)
            }
            activeIndex={currentIndex}
            chromeExitProgress={chromeExitProgress}
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
  // Wrapper shrink-wraps so the index is not forced to parent width (which + numberOfLines caused "1…").
  cardPositionLabelWrap: {
    position: 'absolute',
    right: -34,
    bottom: -94,
  },
  cardPositionLabelText: {
    fontSize: 300,
    lineHeight: 300,
    fontWeight: '500',
    includeFontPadding: false,
    textAlign: 'right',
    width: '100%',
  },
  /** "+" at 300pt reads smaller than digits; scale up so cap height matches digit numerals. */
  cardPositionLabelPlus: {
    fontSize: 352,
    lineHeight: 352,
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
    ...TYPOGRAPHY.body,
    fontWeight: '500',
    marginTop: 12,
    color: COLORS.containerPrimary,
  },
  cardFooterLabel: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
  },
  createStackRoot: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  createStackInner: {
    flex: 1,
    paddingTop: SPACING.lg + SPACING.xl,
    paddingBottom: 24,
    paddingHorizontal: 24,
    justifyContent: 'flex-start',
  },
  createStackSectionTitle: {
    ...TYPOGRAPHY.meta,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: SPACING.xxxl,
  },
  createStackRow: {
    paddingVertical: SPACING.md,
    marginBottom: SPACING.xs,
  },
  createStackRowLast: {
    marginBottom: 0,
  },
  createStackRowFirstWord: {
    ...TYPOGRAPHY.h1,
  },
  /** 24px — same as current-card exercise name (`ExploreV2CurrentCard` `exerciseName`). */
  createStackRowRest: {
    ...TYPOGRAPHY.h2,
    fontWeight: '400',
  },
});
