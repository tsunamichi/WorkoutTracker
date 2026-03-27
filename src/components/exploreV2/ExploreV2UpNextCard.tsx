import React, { useEffect, useLayoutEffect, useRef, useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Animated, Easing } from 'react-native';
import { Platform } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  interpolateColor,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { Swipeable, TouchableOpacity as GestureTouchableOpacity } from 'react-native-gesture-handler';
import { EXPLORE_V2 } from './exploreV2Tokens';
import { EXPLORE_V2_PALETTES } from './exploreV2ColorSystem';
import { COLORS, TYPOGRAPHY } from '../../constants';
import { IconChevronDown, IconTrash } from '../icons';
import type { ExploreV2Group } from './exploreV2Types';

type Props = {
  upNextGroupIndexes: number[];
  exerciseGroups: ExploreV2Group[];
  completedSets: Set<string>;
  onSelectGroup: (groupIndex: number) => void;
  onHeaderPress: () => void;
  onOpenAddExercise: () => void;
  onRemoveGroupFromUpNext: (groupIndex: number) => void | Promise<void>;
  allowAddExercise: boolean;
  hasCurrentExercise: boolean;
  hasCompletePresent: boolean;
  /** Card is expanded (primary) — show plus instead of queue count */
  isExpanded: boolean;
  frontBottomRadius: number;
  coveredBottomRadius: number;
  timerThemeActive: boolean;
  restThemeProgress: SharedValue<number>;
  exploreV2WorkBlueProgress: SharedValue<number>;
};

function groupHasAnyLoggedSet(group: ExploreV2Group, completedSets: Set<string>): boolean {
  for (let r = 0; r < group.totalRounds; r++) {
    for (const ex of group.exercises) {
      if (completedSets.has(`${ex.id}-set-${r}`)) return true;
    }
  }
  return false;
}

function groupTitle(g: ExploreV2Group) {
  return g.exercises.map(e => e.exerciseName).join(' + ');
}

const SWIPE_DELETE_WIDTH = 72;
const UP_NEXT_ROW_PADDING_V = 12;
/** Area revealed when row slides left (4% black). */
const SWIPE_REVEAL_BACKGROUND = 'rgba(0, 0, 0, 0.04)';
const SWIPE_DELETE_ICON_COLOR = '#FF3B30';
const ROW_OPEN_BORDER = 'rgba(0, 0, 0, 0.18)';
const ROW_BORDER_HAIRLINE = StyleSheet.hairlineWidth;
/** Right inset for scroll/list (header uses HEADER_PADDING_RIGHT). */
const LIST_PADDING_RIGHT = 24;
const HEADER_PADDING_RIGHT = 12;

const SUPER_SCRIPT_FONT_SIZE = TYPOGRAPHY.legal.fontSize;
const SUPER_SCRIPT_LINE_HEIGHT = TYPOGRAPHY.legal.fontSize;
/** Extra right inset so the title text wraps before the overlay column (overlay is outside text flow). */
const TITLE_SUPER_RESERVE_RIGHT = Math.ceil(SUPER_SCRIPT_FONT_SIZE * 1.6);
/** Nudge right from line end; large values can hit swipe row `overflow: hidden` (clamped below) */
const SUPER_SCRIPT_OFFSET_RIGHT = 16;
const SUPER_SCRIPT_OFFSET_DOWN = 4;

function estimateSuperscriptWidthPx(digitCount: number, fontSize: number): number {
  return Math.ceil(fontSize * 0.55 * Math.max(1, digitCount));
}

type TextLineMetrics = { x: number; y: number; width: number; height: number; text: string };

/** Top-left of overlay: last line top + right-align superscript to line end (title ends with last word). */
function superscriptOverlayPosition(
  lines: TextLineMetrics[] | undefined,
  supWidthPx: number,
  titleBlockWidthPx: number | undefined,
): { top: number; left: number } | null {
  if (!lines?.length) return null;
  const last = lines[lines.length - 1];
  let left = last.x + last.width - supWidthPx + SUPER_SCRIPT_OFFSET_RIGHT;
  const top = last.y + SUPER_SCRIPT_OFFSET_DOWN;
  /** Keep inside the title box so swipe row clip doesn’t hide the count (common on single full-width lines). */
  if (titleBlockWidthPx != null && titleBlockWidthPx > 0) {
    const maxLeft = titleBlockWidthPx - TITLE_SUPER_RESERVE_RIGHT - supWidthPx;
    const minLeft = 0;
    left = Math.max(minLeft, Math.min(left, maxLeft));
  }
  return { top, left };
}

/** When `onTextLayout` hasn’t run yet (or lines are empty), pin count to the top-right of the title block. */
function superscriptFallbackPosition(
  titleBlockWidthPx: number | undefined,
  supWidthPx: number,
): { top: number; left: number } | null {
  if (titleBlockWidthPx == null || titleBlockWidthPx <= 0) return null;
  return {
    top: SUPER_SCRIPT_OFFSET_DOWN,
    left: Math.max(
      0,
      titleBlockWidthPx - TITLE_SUPER_RESERVE_RIGHT - supWidthPx + SUPER_SCRIPT_OFFSET_RIGHT,
    ),
  };
}

type UpNextQueueRowProps = {
  group: ExploreV2Group;
  groupIndex: number;
  /** Group already has logged sets — row is disabled; taps do not fire. */
  groupHasProgress: boolean;
  isLast: boolean;
  restThemeProgress: SharedValue<number>;
  restChromeGateSV: SharedValue<number>;
  exploreV2WorkBlueProgress: SharedValue<number>;
  onSelectGroup: (groupIndex: number) => void;
  onRemoveGroupFromUpNext: (groupIndex: number) => void | Promise<void>;
  onSwipeableOpen: (direction: 'left' | 'right', swipeable: Swipeable) => void;
  onSwipeableClose: (direction: 'left' | 'right', swipeable: Swipeable) => void;
};

const palette = EXPLORE_V2_PALETTES.upNext;
const HEADER_INK = '#464646';
const ROW_NAME_INK = COLORS.inkCharcoal;
/** Idle superscript — animated to `EXPLORE_V2.colors.restTimerHeaderInk` when rest timer is on */
const ROW_SUPER_INK = '#787878';

function UpNextQueueRow({
  group,
  groupIndex,
  groupHasProgress,
  isLast,
  restThemeProgress,
  restChromeGateSV,
  exploreV2WorkBlueProgress,
  onSelectGroup,
  onRemoveGroupFromUpNext,
  onSwipeableOpen,
  onSwipeableClose,
}: UpNextQueueRowProps) {
  const workUpNextBg = EXPLORE_V2.colors.workTimerUpNextCardBg;
  const rowFrontBgStyle = useAnimatedStyle(() => {
    const b = restThemeProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const g = restChromeGateSV.value;
    const rowFillAtBand = interpolateColor(w, [0, 1], [
      interpolateColor(b * g, [0, 1], [EXPLORE_V2_PALETTES.upNext.main, '#E78B0B']),
      workUpNextBg,
    ]);
    return {
      backgroundColor: interpolateColor(b, [0, 1], [EXPLORE_V2_PALETTES.upNext.main, rowFillAtBand]),
    };
  });
  const superscriptColorStyle = useAnimatedStyle(() => {
    const b = restThemeProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const g = restChromeGateSV.value;
    const p = b * g * (1 - w);
    const restCol = interpolateColor(p, [0, 1], [ROW_SUPER_INK, EXPLORE_V2.colors.restTimerHeaderInk]);
    return {
      color: interpolateColor(b * w, [0, 1], [restCol, EXPLORE_V2.colors.pageBg]),
    };
  });
  const rowNameInkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(exploreV2WorkBlueProgress.value, [0, 1], [ROW_NAME_INK, EXPLORE_V2.colors.pageBg]),
  }));
  const swipeProgressRef = useRef<Animated.AnimatedInterpolation<number> | null>(null);
  const borderPrimedRef = useRef(false);
  const [rowBorderLayer, setRowBorderLayer] = useState(false);
  const [titleLines, setTitleLines] = useState<TextLineMetrics[] | null>(null);
  const [titleBlockWidth, setTitleBlockWidth] = useState<number | undefined>(undefined);

  const title = groupTitle(group);
  const roundsStr = String(group.totalRounds);
  const supWidthPx = estimateSuperscriptWidthPx(roundsStr.length, SUPER_SCRIPT_FONT_SIZE);
  const overlayPos =
    superscriptOverlayPosition(titleLines ?? undefined, supWidthPx, titleBlockWidth) ??
    superscriptFallbackPosition(titleBlockWidth, supWidthPx);

  useEffect(() => {
    setTitleLines(null);
  }, [title]);

  return (
    <View style={isLast ? undefined : styles.rowSeamOverlap}>
      <View style={styles.swipeRowFrame}>
        <Swipeable
          onSwipeableOpen={onSwipeableOpen}
          onSwipeableClose={onSwipeableClose}
          renderRightActions={(progress, _drag, swipeable) => {
            swipeProgressRef.current = progress;
            if (!borderPrimedRef.current) {
              borderPrimedRef.current = true;
              queueMicrotask(() => setRowBorderLayer(true));
            }
            return (
              <View style={styles.swipeDeleteStrip}>
                <GestureTouchableOpacity
                  style={styles.swipeDeleteBtn}
                  onPress={() => {
                    swipeable.close();
                    void onRemoveGroupFromUpNext(groupIndex);
                  }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Remove from queue"
                >
                  <IconTrash size={22} color={SWIPE_DELETE_ICON_COLOR} />
                </GestureTouchableOpacity>
              </View>
            );
          }}
          overshootRight={false}
          friction={2}
        >
          <Reanimated.View style={[styles.rowSwipeFront, rowFrontBgStyle]}>
            <GestureTouchableOpacity
              style={styles.rowMain}
              disabled={groupHasProgress}
              onPress={() => onSelectGroup(groupIndex)}
              activeOpacity={0.75}
              accessibilityLabel={`${title}, ${roundsStr} rounds`}
            >
              <View style={styles.nameBlock}>
                <View
                  style={styles.nameTitleWrap}
                  onLayout={e => {
                    const w = e.nativeEvent.layout.width;
                    if (w > 0) setTitleBlockWidth(w);
                  }}
                >
                  <Reanimated.Text
                    style={[styles.name, rowNameInkStyle]}
                    numberOfLines={2}
                    onTextLayout={e => {
                      const lines = e.nativeEvent.lines.map(l => ({
                        x: l.x,
                        y: l.y,
                        width: l.width,
                        height: l.height,
                        text: l.text,
                      }));
                      setTitleLines(lines.length > 0 ? lines : null);
                    }}
                  >
                    {title}
                  </Reanimated.Text>
                  {overlayPos ? (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.superScriptOverlayWrap,
                        { top: overlayPos.top, left: overlayPos.left },
                      ]}
                    >
                      <Reanimated.Text style={[styles.superScriptOverlayText, superscriptColorStyle]}>
                        {roundsStr}
                      </Reanimated.Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </GestureTouchableOpacity>
          </Reanimated.View>
        </Swipeable>
        {rowBorderLayer && swipeProgressRef.current != null ? (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              styles.rowOpenBorderOverlay,
              { opacity: swipeProgressRef.current },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}

export function ExploreV2UpNextCard({
  upNextGroupIndexes,
  exerciseGroups,
  completedSets,
  onSelectGroup,
  onHeaderPress,
  onOpenAddExercise,
  onRemoveGroupFromUpNext,
  allowAddExercise,
  hasCurrentExercise,
  hasCompletePresent,
  isExpanded,
  frontBottomRadius,
  coveredBottomRadius,
  timerThemeActive,
  restThemeProgress,
  exploreV2WorkBlueProgress,
}: Props) {
  /** Mirrors `timerThemeActive` on UI thread — multiplies theme progress so chrome snaps idle when rest ends. */
  const restChromeGateSV = useSharedValue(timerThemeActive ? 1 : 0);
  useLayoutEffect(() => {
    restChromeGateSV.value = timerThemeActive ? 1 : 0;
  }, [timerThemeActive]);

  const activeSwipeRowRef = useRef<Swipeable | null>(null);

  const onQueueRowSwipeOpen = useCallback((_direction: 'left' | 'right', swipeable: Swipeable) => {
    const prev = activeSwipeRowRef.current;
    if (prev && prev !== swipeable) {
      prev.close();
    }
    activeSwipeRowRef.current = swipeable;
  }, []);

  const onQueueRowSwipeClose = useCallback((_direction: 'left' | 'right', swipeable: Swipeable) => {
    if (activeSwipeRowRef.current === swipeable) {
      activeSwipeRowRef.current = null;
    }
  }, []);

  const workUpNextBg = EXPLORE_V2.colors.workTimerUpNextCardBg;
  const headerChromeAnimatedStyle = useAnimatedStyle(() => {
    const b = restThemeProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const g = restChromeGateSV.value;
    const pRest = b * g * (1 - w);
    const pWork = b * w;
    const restCol = interpolateColor(pRest, [0, 1], [HEADER_INK, EXPLORE_V2.colors.restTimerHeaderInk]);
    return {
      color: interpolateColor(pWork, [0, 1], [restCol, EXPLORE_V2.colors.pageBg]),
    };
  });
  const addExerciseLinkAnimatedStyle = useAnimatedStyle(() => {
    const b = restThemeProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const g = restChromeGateSV.value;
    const pRest = b * g * (1 - w);
    const pWork = b * w;
    const restCol = interpolateColor(pRest, [0, 1], [HEADER_INK, EXPLORE_V2.colors.restTimerHeaderInk]);
    const c = interpolateColor(pWork, [0, 1], [restCol, EXPLORE_V2.colors.pageBg]);
    return {
      color: c,
      borderBottomColor: c,
    };
  });
  const chevronIdleOpacityStyle = useAnimatedStyle(() => ({
    opacity: 1 - restThemeProgress.value * (1 - exploreV2WorkBlueProgress.value),
  }));
  const chevronTimerOpacityStyle = useAnimatedStyle(() => ({
    opacity: restThemeProgress.value * (1 - exploreV2WorkBlueProgress.value),
  }));
  const chevronWorkOpacityStyle = useAnimatedStyle(() => ({
    opacity: restThemeProgress.value * exploreV2WorkBlueProgress.value,
  }));

  const bottomCornerRadius = isExpanded ? frontBottomRadius : coveredBottomRadius;
  const shellAnimatedStyle = useAnimatedStyle(() => {
    const b = restThemeProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const whenUpBg = interpolateColor(w, [0, 1], ['#E78B0B', workUpNextBg]);
    const whenUpBorder = interpolateColor(w, [0, 1], ['#FFA424', COLORS.info]);
    return {
      backgroundColor: interpolateColor(b, [0, 1], [palette.main, whenUpBg]),
      borderColor: interpolateColor(b, [0, 1], [EXPLORE_V2.colors.pageBg, whenUpBorder]),
    };
  });
  const scrollBgAnimatedStyle = useAnimatedStyle(() => {
    const b = restThemeProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const whenUpBg = interpolateColor(w, [0, 1], ['#E78B0B', workUpNextBg]);
    return {
      backgroundColor: interpolateColor(b, [0, 1], [palette.main, whenUpBg]),
    };
  });
  const showAddExercise = isExpanded && allowAddExercise;
  const swapProgress = useRef(new Animated.Value(showAddExercise ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(swapProgress, {
      toValue: showAddExercise ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [showAddExercise, swapProgress]);

  const addLayerStyle = {
    opacity: swapProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
    transform: [{ translateY: swapProgress.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
  };
  const chevronLayerStyle = {
    opacity: swapProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [{ translateY: swapProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }) }],
  };

  const showFullEmpty =
    upNextGroupIndexes.length === 0 && !hasCurrentExercise && !hasCompletePresent;

  const showQueueEmptyOnly =
    upNextGroupIndexes.length === 0 && (hasCurrentExercise || hasCompletePresent);

  return (
    <Reanimated.View
      style={[
        styles.shell,
        shellAnimatedStyle,
        {
          borderBottomLeftRadius: bottomCornerRadius,
          borderBottomRightRadius: bottomCornerRadius,
        },
      ]}
    >
      {!isExpanded ? (
        <Pressable style={styles.peekTapOverlay} onPress={onHeaderPress} />
      ) : null}
      <Pressable style={styles.headerRow} onPress={onHeaderPress}>
        <Reanimated.Text style={[styles.headerLabel, headerChromeAnimatedStyle]}>Up Next</Reanimated.Text>
        <View style={styles.countOrPlusSlot}>
          <Animated.View
            style={[styles.addExerciseLayer, addLayerStyle]}
            pointerEvents={showAddExercise ? 'box-none' : 'none'}
          >
            <TouchableOpacity
              onPress={onOpenAddExercise}
              hitSlop={10}
              style={styles.addExerciseBtn}
              accessibilityLabel="Add exercise"
              activeOpacity={0.75}
              disabled={!showAddExercise}
            >
              <Reanimated.Text style={[styles.addExerciseText, addExerciseLinkAnimatedStyle]} numberOfLines={1}>
                Add exercise
              </Reanimated.Text>
            </TouchableOpacity>
          </Animated.View>
          <Animated.View style={[styles.chevronLayer, chevronLayerStyle]} pointerEvents="none">
            <Reanimated.View style={[styles.chevronLayer, chevronIdleOpacityStyle]} pointerEvents="none">
              <IconChevronDown size={18} color={HEADER_INK} />
            </Reanimated.View>
            <Reanimated.View style={[styles.chevronLayer, chevronTimerOpacityStyle]} pointerEvents="none">
              <IconChevronDown size={18} color={EXPLORE_V2.colors.restTimerHeaderInk} />
            </Reanimated.View>
            <Reanimated.View style={[styles.chevronLayer, chevronWorkOpacityStyle]} pointerEvents="none">
              <IconChevronDown size={18} color={EXPLORE_V2.colors.pageBg} />
            </Reanimated.View>
          </Animated.View>
        </View>
      </Pressable>
      <View style={styles.scrollOuter}>
        <Reanimated.ScrollView
          style={[styles.scroll, scrollBgAnimatedStyle]}
          contentContainerStyle={styles.scrollContentGrow}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
        >
          <View style={styles.scrollPad}>
          {showFullEmpty && (
            <View style={styles.emptyBlock}>
              <Text style={[styles.emptyTitle, { color: palette.dark }]}>No exercises yet</Text>
              <Text style={[styles.emptySub, { color: palette.muted }]}>
                Add an exercise to start building this workout.
              </Text>
              {allowAddExercise ? (
                <TouchableOpacity style={styles.emptyCta} onPress={onOpenAddExercise} activeOpacity={0.85}>
                  <Text style={styles.emptyCtaText}>Add exercise</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {showQueueEmptyOnly && (
            <Text style={[styles.queueEmpty, { color: palette.muted }]}>
              Nothing in the queue. Add an exercise or finish your current set.
            </Text>
          )}

          {upNextGroupIndexes.map((gi, index) => {
            const g = exerciseGroups[gi];
            if (!g) return null;
            const started = groupHasAnyLoggedSet(g, completedSets);
            const isLast = index === upNextGroupIndexes.length - 1;
            return (
            <UpNextQueueRow
              key={g.id}
              group={g}
              groupIndex={gi}
              groupHasProgress={started}
              isLast={isLast}
              restThemeProgress={restThemeProgress}
              restChromeGateSV={restChromeGateSV}
              exploreV2WorkBlueProgress={exploreV2WorkBlueProgress}
              onSelectGroup={onSelectGroup}
              onRemoveGroupFromUpNext={onRemoveGroupFromUpNext}
              onSwipeableOpen={onQueueRowSwipeOpen}
              onSwipeableClose={onQueueRowSwipeClose}
            />
            );
          })}
          </View>
        </Reanimated.ScrollView>
      </View>
    </Reanimated.View>
  );
}

const pad = EXPLORE_V2.cardPadding;

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'column',
    paddingTop: 10,
    borderWidth: 2,
    borderColor: EXPLORE_V2.colors.pageBg,
    borderTopLeftRadius: EXPLORE_V2.cardTopRadius,
    borderTopRightRadius: EXPLORE_V2.cardTopRadius,
    borderBottomLeftRadius: EXPLORE_V2.cardRadius,
    borderBottomRightRadius: EXPLORE_V2.cardRadius,
    overflow: 'hidden',
    shadowColor: '#0A060C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 5,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
  },
  headerRow: {
    height: 32,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
    paddingLeft: 24,
    paddingRight: HEADER_PADDING_RIGHT,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  peekTapOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  countOrPlusSlot: {
    width: 38,
    height: 32,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  /** Wide hit area for layout only — use `pointerEvents="box-none"` so empty space does not steal taps on the queue below. */
  addExerciseLayer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 200,
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1,
  },
  chevronLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addExerciseBtn: {
    minHeight: 30,
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 12,
  },
  addExerciseText: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
    flexShrink: 0,
    paddingBottom: 2,
    borderBottomWidth: 1,
  },
  headerLabel: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
    letterSpacing: 0,
    textTransform: 'none',
  },
  headerCount: {
    ...TYPOGRAPHY.legal,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  scrollOuter: {
    flex: 1,
    minHeight: 0,
    paddingRight: LIST_PADDING_RIGHT,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContentGrow: {
    flexGrow: 1,
  },
  scrollPad: {
    paddingLeft: pad.horizontal,
    paddingRight: 0,
    paddingTop: EXPLORE_V2.headerToContentGap,
    paddingBottom: pad.bottom,
  },
  rowSeamOverlap: {
    marginBottom: -ROW_BORDER_HAIRLINE,
  },
  swipeRowFrame: {
    position: 'relative',
    overflow: 'hidden',
  },
  rowOpenBorderOverlay: {
    zIndex: 20,
    borderWidth: ROW_BORDER_HAIRLINE,
    borderColor: ROW_OPEN_BORDER,
  },
  rowSwipeFront: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: UP_NEXT_ROW_PADDING_V,
    paddingRight: 0,
  },
  rowMain: {
    flex: 1,
    paddingRight: 0,
  },
  swipeDeleteStrip: {
    width: SWIPE_DELETE_WIDTH,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SWIPE_REVEAL_BACKGROUND,
    zIndex: 2,
  },
  swipeDeleteBtn: {
    flex: 1,
    width: SWIPE_DELETE_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  nameBlock: {
    flexShrink: 1,
    minWidth: 0,
  },
  nameTitleWrap: {
    position: 'relative',
    flexShrink: 1,
    minWidth: 0,
    paddingRight: TITLE_SUPER_RESERVE_RIGHT,
  },
  name: {
    ...TYPOGRAPHY.displayLarge,
    fontWeight: '400',
    flexShrink: 1,
  },
  /** Non-interactive wrapper so set-count never steals taps (e.g. on last word of title like “… Press”). */
  superScriptOverlayWrap: {
    position: 'absolute',
    zIndex: 2,
  },
  superScriptOverlayText: {
    ...TYPOGRAPHY.legal,
    fontWeight: '700',
    lineHeight: SUPER_SCRIPT_LINE_HEIGHT,
    includeFontPadding: false,
    textAlign: 'right',
  },
  emptyBlock: {
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  emptySub: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  emptyCta: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(18,16,24,0.85)',
  },
  emptyCtaText: {
    color: '#F5F2F8',
    fontSize: 14,
    fontWeight: '600',
  },
  queueEmpty: {
    fontSize: 14,
    paddingVertical: 0,
    lineHeight: 20,
  },
});
