import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

type CardId = 'A' | 'B' | 'C';

type LabCard = {
  id: CardId;
  title: string;
  color: string;
};

const CARDS: Record<CardId, LabCard> = {
  A: { id: 'A', title: 'Card A', color: '#2E7D32' },
  B: { id: 'B', title: 'Card B', color: '#C62828' },
  C: { id: 'C', title: 'Card C', color: '#1565C0' },
};

const LEFT_INSET = 24;
const RIGHT_RESERVE = 72;
const NEXT_PEEK = 44;
const PARKED_PEEK = 22;
const CARD_HEIGHT = 330;
const COMMIT_FRAC = 0.24;
const COMMIT_VELOCITY = 700;
const RETURN_SPRING = { damping: 18, stiffness: 240, mass: 0.95 };

function LabCardView({ card, role }: { card: LabCard; role: string }) {
  return (
    <View style={[styles.card, { backgroundColor: card.color }]}>
      <Text style={styles.role}>{role}</Text>
      <Text style={styles.title}>{card.title}</Text>
      <Text style={styles.meta}>{card.id}</Text>
    </View>
  );
}

export function DeckMotionLab() {
  const { width } = useWindowDimensions();
  const deckWidth = Math.max(280, width - 48);
  const cardWidth = deckWidth - LEFT_INSET - RIGHT_RESERVE;
  const commitThreshold = cardWidth * COMMIT_FRAC;

  const [activeId, setActiveId] = useState<CardId>('A');
  const [remainingIds, setRemainingIds] = useState<CardId[]>(['B', 'C']);
  const [parkedId, setParkedId] = useState<CardId | null>(null);
  const [outgoingId, setOutgoingId] = useState<CardId | null>(null);
  const [restoringId, setRestoringId] = useState<CardId | null>(null);

  const dragX = useSharedValue(0);
  const outgoingX = useSharedValue(0);
  const restoreX = useSharedValue(0);

  const activeCard = CARDS[activeId];
  const nextId = remainingIds[0] ?? null;
  const nextCard = nextId ? CARDS[nextId] : null;
  const parkedCard = parkedId ? CARDS[parkedId] : null;
  const outgoingCard = outgoingId ? CARDS[outgoingId] : null;
  const restoringCard = restoringId ? CARDS[restoringId] : null;

  const logState = useCallback((event: string, extra?: Record<string, unknown>) => {
    console.log('[DeckMotionLab]', event, {
      active: activeId,
      next: nextId,
      parked: parkedId,
      remaining: remainingIds,
      ...extra,
    });
  }, [activeId, nextId, parkedId, remainingIds]);

  const finalizeLeft = useCallback((outgoing: CardId) => {
    logState('left complete', { outgoing });
    setParkedId(outgoing);
    setOutgoingId(null);
    dragX.value = 0;
    outgoingX.value = 0;
  }, [dragX, outgoingX, logState]);

  const startLeft = useCallback((releaseX: number) => {
    if (!nextId) return;
    const outgoing = activeId;
    const incoming = nextId;
    const rest = remainingIds.slice(1);
    logState('left start', { outgoing, incoming, releaseX, targetParkedX: PARKED_PEEK });

    setOutgoingId(outgoing);
    setActiveId(incoming);
    setRemainingIds(rest);

    outgoingX.value = releaseX;
    outgoingX.value = withTiming(PARKED_PEEK, { duration: 220 }, done => {
      if (done) runOnJS(finalizeLeft)(outgoing);
    });
  }, [activeId, nextId, remainingIds, outgoingX, finalizeLeft, logState]);

  const finalizeRight = useCallback((restored: CardId) => {
    logState('right complete', { restored });
    setActiveId(restored);
    setRestoringId(null);
    dragX.value = 0;
    restoreX.value = 0;
  }, [dragX, restoreX, logState]);

  const startRight = useCallback(() => {
    if (!parkedId) return;
    const restored = parkedId;
    const oldActive = activeId;
    logState('right start', { movingCard: restored, oldActive });

    setRestoringId(restored);
    setParkedId(oldActive);

    restoreX.value = 0;
    restoreX.value = withTiming(commitThreshold, { duration: 220 }, done => {
      if (done) runOnJS(finalizeRight)(restored);
    });
  }, [parkedId, activeId, restoreX, commitThreshold, finalizeRight, logState]);

  const reset = useCallback(() => {
    setActiveId('A');
    setRemainingIds(['B', 'C']);
    setParkedId(null);
    setOutgoingId(null);
    setRestoringId(null);
    dragX.value = 0;
    outgoingX.value = 0;
    restoreX.value = 0;
    logState('reset');
  }, [dragX, outgoingX, restoreX, logState]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-12, 12])
        .onUpdate(e => {
          if (outgoingId || restoringId) return;
          const x = e.translationX;
          if (x < 0 && nextId) {
            dragX.value = x;
            return;
          }
          dragX.value = x > 0 ? x * 0.05 : 0;
        })
        .onEnd(e => {
          if (outgoingId || restoringId) return;
          const commitLeft = (e.translationX <= -commitThreshold || e.velocityX <= -COMMIT_VELOCITY) && !!nextId;
          const commitRight = (e.translationX >= commitThreshold || e.velocityX >= COMMIT_VELOCITY) && !!parkedId;
          if (commitLeft) {
            runOnJS(startLeft)(e.translationX);
            return;
          }
          if (commitRight) {
            runOnJS(startRight)();
            return;
          }
          dragX.value = withSpring(0, RETURN_SPRING);
        }),
    [commitThreshold, dragX, nextId, parkedId, outgoingId, restoringId, startLeft, startRight],
  );

  const activeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value < 0 ? dragX.value : dragX.value * 0.05 }],
  }));
  const nextStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, -dragX.value / commitThreshold));
    return {
      left: LEFT_INSET + interpolate(p, [0, 1], [NEXT_PEEK, 0], 'clamp'),
      right: RIGHT_RESERVE - interpolate(p, [0, 1], [NEXT_PEEK, 0], 'clamp'),
    };
  });
  const parkedStyle = useAnimatedStyle(() => ({
    left: LEFT_INSET + PARKED_PEEK,
    right: RIGHT_RESERVE - PARKED_PEEK,
  }));
  const outgoingStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: outgoingX.value }],
  }));
  const restoringStyle = useAnimatedStyle(() => ({
    left: LEFT_INSET + PARKED_PEEK,
    right: RIGHT_RESERVE - PARKED_PEEK,
    transform: [{ translateX: interpolate(restoreX.value, [0, commitThreshold], [0, -PARKED_PEEK], 'clamp') }],
  }));

  return (
    <View style={styles.root}>
      <View style={[styles.deck, { width: deckWidth, height: CARD_HEIGHT + 40 }]}>
        <Animated.View pointerEvents="none" style={[styles.layer, { zIndex: 1, top: 0, height: CARD_HEIGHT }, nextStyle]}>
          {nextCard ? <LabCardView card={nextCard} role="next" /> : null}
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.layer, { zIndex: 2, top: 0, height: CARD_HEIGHT }, parkedStyle]}>
          {parkedCard ? <LabCardView card={parkedCard} role="parked" /> : null}
        </Animated.View>

        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.activeLayer,
              { left: LEFT_INSET, right: RIGHT_RESERVE, zIndex: 4, height: CARD_HEIGHT },
              activeStyle,
            ]}
          >
            <LabCardView card={activeCard} role="active" />
          </Animated.View>
        </GestureDetector>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeLayer,
            { left: LEFT_INSET, right: RIGHT_RESERVE, zIndex: 5, height: CARD_HEIGHT },
            outgoingStyle,
          ]}
        >
          {outgoingCard ? <LabCardView card={outgoingCard} role="outgoing-left" /> : null}
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.layer, { zIndex: 6, top: 0, height: CARD_HEIGHT }, restoringStyle]}>
          {restoringCard ? <LabCardView card={restoringCard} role="restoring-right" /> : null}
        </Animated.View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.button} onPress={() => startLeft(0)}>
          <Text style={styles.buttonText}>Swipe Left</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={startRight}>
          <Text style={styles.buttonText}>Swipe Right</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={reset}>
          <Text style={styles.buttonText}>Reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F5F6',
    paddingHorizontal: 24,
    gap: 16,
  },
  deck: {
    position: 'relative',
    overflow: 'visible',
  },
  layer: {
    position: 'absolute',
  },
  activeLayer: {
    position: 'absolute',
    bottom: 0,
  },
  card: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    padding: 16,
  },
  role: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 8,
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '600',
  },
  meta: {
    marginTop: 8,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
