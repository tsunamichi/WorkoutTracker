import React, { useEffect, useLayoutEffect, useRef, useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Animated, Easing } from 'react-native';
import { Platform } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  interpolateColor,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { EXPLORE_V2 } from './exploreV2Tokens';
import { TYPOGRAPHY } from '../../constants';
import { useAppTheme } from '../../theme/useAppTheme';
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
  menuThemeActive: boolean;
  menuToneProgress: SharedValue<number>;
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

const UP_NEXT_ROW_PADDING_V = 12;
const SWIPE_DELETE_ICON_COLOR = '#FF3B30';
const ROW_BORDER_HAIRLINE = StyleSheet.hairlineWidth;
/** Right inset for scroll/list (header uses HEADER_PADDING_RIGHT). */
const LIST_PADDING_RIGHT = 24;
const HEADER_PADDING_RIGHT = 12;

type UpNextQueueRowProps = {
  group: ExploreV2Group;
  groupIndex: number;
  /** Group already has logged sets — row is disabled; taps do not fire. */
  groupHasProgress: boolean;
  isLast: boolean;
  restThemeProgress: SharedValue<number>;
  restChromeGateSV: SharedValue<number>;
  exploreV2WorkBlueProgress: SharedValue<number>;
  menuThemeActive: boolean;
  menuToneProgress: SharedValue<number>;
  removeMode: boolean;
  onSelectGroup: (groupIndex: number) => void;
  onRemoveGroupFromUpNext: (groupIndex: number) => void | Promise<void>;
};

const HEADER_INK = '#464646';

function UpNextQueueRow({
  group,
  groupIndex,
  groupHasProgress,
  isLast,
  restThemeProgress,
  restChromeGateSV,
  exploreV2WorkBlueProgress,
  menuThemeActive,
  menuToneProgress,
  removeMode,
  onSelectGroup,
  onRemoveGroupFromUpNext,
}: UpNextQueueRowProps) {
  const { colors: themeColors } = useAppTheme();
  const pageBg = themeColors.canvasLight;
  const menuMutedInk = themeColors.textMeta;
  const textMeta = themeColors.textMeta;
  const accentPrimaryDark = themeColors.accentPrimaryDark;
  const textMetaTimer = themeColors.textMetaTimer;
  const [roundAnchor, setRoundAnchor] = useState({ top: 0, left: 0 });
  const roundsColorStyle = useAnimatedStyle(() => {
    const b = restThemeProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const g = restChromeGateSV.value;
    const pRest = b * g * (1 - w);
    const pWork = b * w;
    const restCol = interpolateColor(pRest, [0, 1], [textMeta, accentPrimaryDark]);
    const base = interpolateColor(pWork, [0, 1], [restCol, textMetaTimer]);
    return {
      color: interpolateColor(menuToneProgress.value, [0, 1], [base, menuMutedInk]),
    };
  }, [textMeta, accentPrimaryDark, textMetaTimer, menuToneProgress, menuMutedInk, pageBg]);
  const rowNameInkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      menuToneProgress.value,
      [0, 1],
      [
        interpolateColor(exploreV2WorkBlueProgress.value, [0, 1], [themeColors.containerPrimary, pageBg]),
        menuMutedInk,
      ],
    ),
  }), [pageBg, themeColors.containerPrimary, menuMutedInk, exploreV2WorkBlueProgress, menuToneProgress]);
  const title = groupTitle(group);
  const roundsStr = String(group.totalRounds);
  const onNameTextLayout = useCallback((e: any) => {
    const lines = e?.nativeEvent?.lines;
    if (!Array.isArray(lines) || lines.length === 0) return;
    const last = lines[lines.length - 1];
    const fallbackLineHeight = TYPOGRAPHY.h2.lineHeight ?? 32;
    const nextTop =
      typeof last?.y === 'number'
        ? last.y
        : Math.max(0, (lines.length - 1) * fallbackLineHeight);
    const nextLeft =
      typeof last?.width === 'number'
        ? last.width + 6
        : 6;
    setRoundAnchor(prev =>
      prev.top === nextTop && prev.left === nextLeft
        ? prev
        : { top: nextTop, left: nextLeft });
  }, []);

  return (
    <View style={isLast ? undefined : styles.rowSeamOverlap}>
      <Reanimated.View style={styles.rowSwipeFront}>
        <TouchableOpacity
          style={styles.rowMain}
          disabled={removeMode}
          onPress={() => onSelectGroup(groupIndex)}
          activeOpacity={0.75}
          accessibilityLabel={`${title}, ${roundsStr} rounds`}
        >
          <View style={styles.nameBlock}>
            <Reanimated.Text
              style={[styles.name, rowNameInkStyle]}
              numberOfLines={2}
              onTextLayout={onNameTextLayout}
            >
              {title}
            </Reanimated.Text>
            <Reanimated.Text
              style={[
                styles.roundsInline,
                roundsColorStyle,
                { top: roundAnchor.top, left: roundAnchor.left },
              ]}
            >
              {roundsStr}
            </Reanimated.Text>
          </View>
        </TouchableOpacity>
        {removeMode ? (
          <TouchableOpacity
            style={styles.inlineRemoveBtn}
            onPress={() => void onRemoveGroupFromUpNext(groupIndex)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Remove from queue"
          >
            <IconTrash size={20} color={SWIPE_DELETE_ICON_COLOR} />
          </TouchableOpacity>
        ) : null}
      </Reanimated.View>
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
  menuThemeActive,
  menuToneProgress,
}: Props) {
  const { explore: ex, colors: themeColors } = useAppTheme();
  const workUpNextBg = ex.workTimerUpNextCardBg;
  const amberBand = ex.amberBand;
  const accentPrimary = themeColors.accentPrimary;
  const accentSecondarySoft = themeColors.accentSecondarySoft;
  const textMetaTimer = themeColors.textMetaTimer;
  const accentPrimaryDark = themeColors.accentPrimaryDark;
  const textPrimary = themeColors.textPrimary;
  const textMeta = themeColors.textMeta;
  const containerPrimary = themeColors.containerPrimary;
  const upNextBaseBg = themeColors.containerSecondary;
  const menuMutedBg = '#CFC9CC';
  const menuMutedInk = themeColors.textMeta;
  /** Mirrors `timerThemeActive` on UI thread — multiplies theme progress so chrome snaps idle when rest ends. */
  const restChromeGateSV = useSharedValue(timerThemeActive ? 1 : 0);
  useLayoutEffect(() => {
    restChromeGateSV.value = timerThemeActive ? 1 : 0;
  }, [timerThemeActive]);

  const [removeMode, setRemoveMode] = useState(false);

  /** Rest band (b, w=0): “Up Next” header → textMeta; work (w=1) → text-meta-timer. */
  const headerChromeAnimatedStyle = useAnimatedStyle(() => {
    const b = restThemeProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const pRest = b * (1 - w);
    const pWork = b * w;
    const restCol = interpolateColor(pRest, [0, 1], [containerPrimary, accentPrimaryDark]);
    const baseColor = interpolateColor(pWork, [0, 1], [restCol, textMetaTimer]);
    return {
      color: interpolateColor(menuToneProgress.value, [0, 1], [baseColor, menuMutedInk]),
    };
  }, [containerPrimary, accentPrimaryDark, textMetaTimer, menuMutedInk, menuToneProgress]);
  /** Keep action links on meta color for visual consistency. */
  const addExerciseLinkAnimatedStyle = useAnimatedStyle(() => {
    const b = restThemeProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const pRest = b * (1 - w);
    const pWork = b * w;
    const restCol = interpolateColor(pRest, [0, 1], [textMeta, accentPrimaryDark]);
    const baseColor = interpolateColor(pWork, [0, 1], [restCol, textMetaTimer]);
    const color = interpolateColor(menuToneProgress.value, [0, 1], [baseColor, menuMutedInk]);
    return {
      color,
      borderBottomColor: color,
    };
  }, [textMeta, accentPrimaryDark, textMetaTimer, menuMutedInk, menuToneProgress]);
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
    const pRest = b * (1 - w);
    const whenUpBg = interpolateColor(w, [0, 1], [amberBand, workUpNextBg]);
    const baseBg = interpolateColor(b, [0, 1], [upNextBaseBg, whenUpBg]);
    const baseBorder = interpolateColor(pRest, [0, 1], [themeColors.canvasLight, accentPrimary]);
    return {
      backgroundColor: interpolateColor(menuToneProgress.value, [0, 1], [baseBg, menuMutedBg]),
      borderColor: baseBorder,
    };
  }, [upNextBaseBg, amberBand, workUpNextBg, themeColors.canvasLight, accentPrimary, menuMutedBg, menuToneProgress]);
  const scrollBgAnimatedStyle = useAnimatedStyle(() => {
    const b = restThemeProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const whenUpBg = interpolateColor(w, [0, 1], [amberBand, workUpNextBg]);
    const baseBg = interpolateColor(b, [0, 1], [upNextBaseBg, whenUpBg]);
    return {
      backgroundColor: interpolateColor(menuToneProgress.value, [0, 1], [baseBg, menuMutedBg]),
    };
  }, [upNextBaseBg, amberBand, workUpNextBg, menuMutedBg, menuToneProgress]);
  useEffect(() => {
    if (!isExpanded && removeMode) setRemoveMode(false);
  }, [isExpanded, removeMode]);

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
      <Pressable style={[styles.headerRow, !hasCompletePresent && styles.headerRowNoComplete]} onPress={onHeaderPress}>
        <Reanimated.Text style={[styles.headerLabel, headerChromeAnimatedStyle]}>Up Next</Reanimated.Text>
        <View style={styles.countOrPlusSlot}>
          <Reanimated.View style={[styles.chevronLayer, chevronIdleOpacityStyle]} pointerEvents="none">
            <IconChevronDown size={18} color={menuThemeActive ? menuMutedInk : themeColors.containerPrimary} />
          </Reanimated.View>
          <Reanimated.View style={[styles.chevronLayer, chevronTimerOpacityStyle]} pointerEvents="none">
            <IconChevronDown size={18} color={menuThemeActive ? menuMutedInk : themeColors.containerPrimary} />
          </Reanimated.View>
          <Reanimated.View style={[styles.chevronLayer, chevronWorkOpacityStyle]} pointerEvents="none">
            <IconChevronDown size={18} color={menuThemeActive ? menuMutedInk : themeColors.containerPrimary} />
          </Reanimated.View>
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
          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={onOpenAddExercise}
              hitSlop={8}
              style={styles.actionBtn}
              accessibilityLabel="Add exercise"
              activeOpacity={0.75}
              disabled={!allowAddExercise}
            >
              <Reanimated.Text style={[styles.actionText, addExerciseLinkAnimatedStyle, !allowAddExercise && styles.actionDisabled]}>
                + add
              </Reanimated.Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setRemoveMode(v => !v)}
              hitSlop={8}
              style={styles.actionBtn}
              accessibilityLabel="Toggle remove mode"
              activeOpacity={0.75}
            >
              <Reanimated.Text style={[styles.removeText, addExerciseLinkAnimatedStyle]}>- remove</Reanimated.Text>
            </TouchableOpacity>
          </View>
          {showFullEmpty && (
            <View style={styles.emptyBlock}>
              <Text style={[styles.emptyTitle, { color: menuThemeActive ? menuMutedInk : themeColors.containerPrimary }]}>No exercises yet</Text>
              <Text style={[styles.emptySub, { color: menuThemeActive ? menuMutedInk : themeColors.textMeta }]}>
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
            <Text style={[styles.queueEmpty, { color: menuThemeActive ? menuMutedInk : themeColors.textMeta }]}>
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
              menuThemeActive={menuThemeActive}
              menuToneProgress={menuToneProgress}
              removeMode={removeMode}
              onSelectGroup={onSelectGroup}
              onRemoveGroupFromUpNext={onRemoveGroupFromUpNext}
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
    paddingTop: EXPLORE_V2.cardHeader.topInset,
    borderWidth: 2,
    borderColor: 'transparent',
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
    height: EXPLORE_V2.cardHeader.rowHeight,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: EXPLORE_V2.cardHeader.rowVerticalPadding,
    paddingLeft: 24,
    paddingRight: HEADER_PADDING_RIGHT,
    overflow: 'hidden',
  },
  headerRowNoComplete: {
    paddingVertical: EXPLORE_V2.cardHeader.rowVerticalPadding,
  },
  peekTapOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  countOrPlusSlot: {
    width: 38,
    height: EXPLORE_V2.cardHeader.rowHeight,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  chevronLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    paddingRight: 24,
    marginBottom: 32,
    flexDirection: 'row',
    columnGap: 24,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  actionBtn: {
    paddingVertical: 2,
  },
  actionText: {
    ...TYPOGRAPHY.h1,
    color: '#5A5A5A',
  },
  actionDisabled: {
    opacity: 0.4,
  },
  removeText: {
    ...TYPOGRAPHY.h1,
  },
  headerLabel: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
    letterSpacing: 0,
    textTransform: 'uppercase',
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
    paddingTop: 32,
    paddingBottom: pad.bottom,
  },
  rowSeamOverlap: {
    marginBottom: -ROW_BORDER_HAIRLINE,
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
  inlineRemoveBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameBlock: {
    flexShrink: 1,
    minWidth: 0,
    position: 'relative',
  },
  name: {
    ...TYPOGRAPHY.h2,
    fontWeight: '400',
    flexShrink: 1,
    minWidth: 0,
  },
  /** Inline rounds count, rendered as regular text (not superscript). */
  roundsInline: {
    ...TYPOGRAPHY.body,
    fontWeight: '400',
    includeFontPadding: false,
    position: 'absolute',
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
