import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Platform } from 'react-native';
import Animated, { useAnimatedStyle, interpolateColor, type SharedValue } from 'react-native-reanimated';
import { EXPLORE_V2 } from './exploreV2Tokens';
import { TYPOGRAPHY } from '../../constants';
import { useAppTheme } from '../../theme/useAppTheme';
import { IconChevronDown } from '../icons';
import { formatWeightForLoad } from '../../utils/weight';
import type { ExploreV2Group } from './exploreV2Types';

type Props = {
  completedGroupIndexes: number[];
  exerciseGroups: ExploreV2Group[];
  getSetDisplayValues: (exerciseId: string, round: number, w: number, r: number) => { weight: number; reps: number };
  useKg: boolean;
  weightUnit: string;
  onOpenExercise: (groupIndex: number, exerciseIndex: number) => void;
  onHeaderPress: () => void;
  /** Card is expanded (primary) — show plus instead of row count */
  isExpanded: boolean;
  frontBottomRadius: number;
  coveredBottomRadius: number;
  timerThemeActive: boolean;
  restThemeProgress: SharedValue<number>;
  exploreV2WorkBlueProgress: SharedValue<number>;
  menuThemeActive: boolean;
  menuToneProgress: SharedValue<number>;
  contentOnly?: boolean;
};

const IDLE_HEADER_INK = '#464646';
const IDLE_UNIT_INK = '#787878';
/** Vertical gap between set rows (logs) in the Completed list */
const COMPLETE_SET_LOG_GAP = 2;
/** Fixed width for load / reps numerals in the Completed list */
const COMPLETE_VALUE_WIDTH = 28;

export function ExploreV2CompleteCard({
  completedGroupIndexes,
  exerciseGroups,
  getSetDisplayValues,
  useKg,
  weightUnit,
  onOpenExercise,
  onHeaderPress,
  isExpanded,
  frontBottomRadius,
  coveredBottomRadius,
  timerThemeActive: _timerThemeActive,
  restThemeProgress,
  exploreV2WorkBlueProgress,
  menuThemeActive,
  menuToneProgress,
  contentOnly = false,
}: Props) {
  const { explore: ex, colors: themeColors } = useAppTheme();
  const pageBgChrome = themeColors.canvasLight;
  const restCompletedUnitInk = ex.restTimerCompletedUnitInk;
  const textMetaTimer = themeColors.textMetaTimer;
  const textMeta = themeColors.textMeta;
  const accentPrimaryDark = themeColors.accentPrimaryDark;
  const accentPrimary = themeColors.accentPrimary;
  const accentSecondarySoft = themeColors.accentSecondarySoft;
  const containerPrimary = themeColors.containerPrimary;
  const upNextBaseBg = themeColors.containerSecondary;
  const workUpNextBg = ex.workTimerUpNextCardBg;
  const amberBand = ex.amberBand;
  const menuMutedBg = '#CFC9CC';
  const menuMutedInk = themeColors.textMeta;

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
  const completedUnitAnimatedStyle = useAnimatedStyle(() => {
    const w = exploreV2WorkBlueProgress.value;
    const unitRest = interpolateColor(
      restThemeProgress.value,
      [0, 1],
      [IDLE_UNIT_INK, restCompletedUnitInk],
    );
    const baseColor = interpolateColor(w, [0, 1], [unitRest, pageBgChrome]);
    return {
      color: interpolateColor(menuToneProgress.value, [0, 1], [baseColor, menuMutedInk]),
    };
  }, [restCompletedUnitInk, pageBgChrome, menuMutedInk, menuToneProgress]);
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
  const scrollContentAnimatedStyle = useAnimatedStyle(() => {
    const b = restThemeProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const whenUpBg = interpolateColor(w, [0, 1], [amberBand, workUpNextBg]);
    const baseBg = interpolateColor(b, [0, 1], [upNextBaseBg, whenUpBg]);
    return {
      backgroundColor: interpolateColor(menuToneProgress.value, [0, 1], [baseBg, menuMutedBg]),
    };
  }, [upNextBaseBg, amberBand, workUpNextBg, menuMutedBg, menuToneProgress]);
  const rowTitleInkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      menuToneProgress.value,
      [0, 1],
      [
        interpolateColor(exploreV2WorkBlueProgress.value, [0, 1], [containerPrimary, pageBgChrome]),
        menuMutedInk,
      ],
    ),
  }), [containerPrimary, pageBgChrome, menuMutedInk, exploreV2WorkBlueProgress, menuToneProgress]);
  const rows = completedGroupIndexes.flatMap(gi => {
    const g = exerciseGroups[gi];
    if (!g) return [];
    return g.exercises.map(ex => ({ gi, g, ex }));
  });

  const rowsContent = (
    <>
        {rows.map(({ gi, g, ex }, index) => (
          <TouchableOpacity
            key={`${g.id}-${ex.id}`}
            style={[
              styles.row,
              index < rows.length - 1 && styles.rowWithDivider,
              index < rows.length - 1 && { borderBottomColor: themeColors.border },
            ]}
            onPress={() => {
              const exIdx = g.exercises.findIndex(e => e.id === ex.id);
              onOpenExercise(gi, exIdx);
            }}
            activeOpacity={0.75}
          >
            <View style={styles.nameCol}>
              <Animated.Text style={[styles.name, rowTitleInkStyle]} numberOfLines={2}>
                {ex.exerciseName}
              </Animated.Text>
            </View>
            <View style={styles.valCol}>
              {Array.from({ length: g.totalRounds }).map((_, roundIdx) => {
                const vals = getSetDisplayValues(ex.id, roundIdx, ex.weight ?? 0, ex.reps ?? 0);
                return (
                  <View
                    key={roundIdx}
                    style={[
                      styles.valRow,
                      roundIdx < g.totalRounds - 1 && styles.valRowGapAfter,
                    ]}
                  >
                    {vals.weight > 0 && (
                      <View style={styles.valWithUnit}>
                        <View style={styles.valueFixedSlot}>
                          <Animated.Text style={[styles.val, styles.valueTextRight, rowTitleInkStyle]}>
                            {formatWeightForLoad(vals.weight, useKg)}
                          </Animated.Text>
                        </View>
                        <Animated.Text style={[styles.valUnit, completedUnitAnimatedStyle]}>{weightUnit}</Animated.Text>
                      </View>
                    )}
                    <View style={styles.valWithUnit}>
                      <View style={styles.valueFixedSlot}>
                        <Animated.Text style={[styles.val, styles.valueTextRight, rowTitleInkStyle]}>
                          {vals.reps}
                        </Animated.Text>
                      </View>
                      <Animated.Text style={[styles.valUnit, completedUnitAnimatedStyle]}>
                        {ex.isTimeBased ? 's' : 'reps'}
                      </Animated.Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </TouchableOpacity>
        ))}
        {rows.length === 0 && (
          <Text style={[styles.empty, { color: menuThemeActive ? menuMutedInk : textMeta }]}>Nothing completed yet.</Text>
        )}
    </>
  );

  if (contentOnly) {
    return (
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollInner, styles.scrollInnerContentOnly]}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {rowsContent}
      </Animated.ScrollView>
    );
  }

  return (
    <Animated.View
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
        <Animated.Text style={[styles.headerLabel, headerChromeAnimatedStyle]}>Completed</Animated.Text>
        <View style={styles.countOrPlusSlot}>
          <Animated.View style={[styles.chevronLayer, chevronIdleOpacityStyle]} pointerEvents="none">
            <IconChevronDown size={18} color={menuThemeActive ? menuMutedInk : themeColors.containerPrimary} />
          </Animated.View>
          <Animated.View style={[styles.chevronLayer, chevronTimerOpacityStyle]} pointerEvents="none">
            <IconChevronDown size={18} color={menuThemeActive ? menuMutedInk : themeColors.containerPrimary} />
          </Animated.View>
          <Animated.View style={[styles.chevronLayer, chevronWorkOpacityStyle]} pointerEvents="none">
            <IconChevronDown size={18} color={menuThemeActive ? menuMutedInk : themeColors.containerPrimary} />
          </Animated.View>
        </View>
      </Pressable>
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollInner, scrollContentAnimatedStyle]}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {rowsContent}
      </Animated.ScrollView>
    </Animated.View>
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
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 6,
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
    paddingRight: 12,
    overflow: 'hidden',
  },
  peekTapOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  countOrPlusSlot: {
    position: 'relative',
    width: 38,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  countOrPlusButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  headerCount: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollInner: {
    paddingHorizontal: pad.horizontal,
    paddingTop: EXPLORE_V2.headerToContentGap,
    paddingBottom: pad.bottom,
  },
  scrollInnerContentOnly: {
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 0,
  },
  rowWithDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    paddingBottom: 20,
    marginBottom: 20,
  },
  nameCol: { flex: 1, paddingRight: 10 },
  name: { ...TYPOGRAPHY.meta, lineHeight: 20 },
  valCol: { alignItems: 'flex-end' },
  valRow: { flexDirection: 'row', gap: 20, justifyContent: 'flex-end' },
  valRowGapAfter: {
    marginBottom: COMPLETE_SET_LOG_GAP,
  },
  valWithUnit: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  valueFixedSlot: {
    width: COMPLETE_VALUE_WIDTH,
  },
  valueTextRight: {
    textAlign: 'right',
    width: '100%',
  },
  val: { ...TYPOGRAPHY.meta },
  valUnit: { ...TYPOGRAPHY.meta },
  chevronLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    ...TYPOGRAPHY.body,
    paddingVertical: 12,
  },
});
