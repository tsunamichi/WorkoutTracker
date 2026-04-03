import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Platform } from 'react-native';
import Animated, { useAnimatedStyle, interpolateColor, type SharedValue } from 'react-native-reanimated';
import { EXPLORE_V2 } from './exploreV2Tokens';
import { EXPLORE_V2_PALETTES } from './exploreV2ColorSystem';
import { COLORS, TYPOGRAPHY } from '../../constants';
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
  contentOnly?: boolean;
};

const palette = EXPLORE_V2_PALETTES.complete;
const upNextPalette = EXPLORE_V2_PALETTES.upNext;
/** Match Current card surface — used for row title + numerals on Completed list */
const CURRENT_CARD_SURFACE = EXPLORE_V2_PALETTES.current.main;
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
  contentOnly = false,
}: Props) {
  const { explore: ex, colors: themeColors } = useAppTheme();
  const pageBgChrome = EXPLORE_V2.colors.pageBg;
  const restCompletedUnitInk = ex.restTimerCompletedUnitInk;
  const textMetaTimer = themeColors.textMetaTimer;
  const textMeta = themeColors.textMeta;
  const accentPrimaryDark = themeColors.accentPrimaryDark;
  const accentPrimary = themeColors.accentPrimary;
  const accentSecondarySoft = themeColors.accentSecondarySoft;
  const containerPrimary = themeColors.containerPrimary;
  const workUpNextBg = ex.workTimerUpNextCardBg;
  const amberBand = ex.amberBand;

  const headerChromeAnimatedStyle = useAnimatedStyle(() => {
    const b = restThemeProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const pRest = b * (1 - w);
    const pWork = b * w;
    const restCol = interpolateColor(pRest, [0, 1], [containerPrimary, accentPrimaryDark]);
    return {
      color: interpolateColor(pWork, [0, 1], [restCol, textMetaTimer]),
    };
  }, [containerPrimary, accentPrimaryDark, textMetaTimer]);
  const completedUnitAnimatedStyle = useAnimatedStyle(() => {
    const w = exploreV2WorkBlueProgress.value;
    const unitRest = interpolateColor(
      restThemeProgress.value,
      [0, 1],
      [IDLE_UNIT_INK, restCompletedUnitInk],
    );
    return {
      color: interpolateColor(w, [0, 1], [unitRest, pageBgChrome]),
    };
  }, [restCompletedUnitInk, pageBgChrome]);
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
    return {
      backgroundColor: interpolateColor(b, [0, 1], [upNextPalette.main, whenUpBg]),
      borderColor: interpolateColor(pRest, [0, 1], [accentSecondarySoft, accentPrimary]),
    };
  }, [amberBand, workUpNextBg, upNextPalette.main, accentSecondarySoft, accentPrimary]);
  const scrollContentAnimatedStyle = useAnimatedStyle(() => {
    const b = restThemeProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const whenUpBg = interpolateColor(w, [0, 1], [amberBand, workUpNextBg]);
    return {
      backgroundColor: interpolateColor(b, [0, 1], [upNextPalette.main, whenUpBg]),
    };
  }, [amberBand, workUpNextBg, upNextPalette.main]);
  const rowTitleInkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(exploreV2WorkBlueProgress.value, [0, 1], [CURRENT_CARD_SURFACE, pageBgChrome]),
  }), [pageBgChrome]);
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
            style={[styles.row, index < rows.length - 1 && styles.rowWithDivider]}
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
          <Text style={[styles.empty, { color: palette.muted }]}>Nothing completed yet.</Text>
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
            <IconChevronDown size={18} color={textMeta} />
          </Animated.View>
          <Animated.View style={[styles.chevronLayer, chevronTimerOpacityStyle]} pointerEvents="none">
            <IconChevronDown size={18} color={accentPrimaryDark} />
          </Animated.View>
          <Animated.View style={[styles.chevronLayer, chevronWorkOpacityStyle]} pointerEvents="none">
            <IconChevronDown size={18} color={textMetaTimer} />
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
    paddingTop: 10,
    borderWidth: 2,
    borderColor: COLORS.accentSecondarySoft,
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
    height: 32,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
    paddingLeft: 24,
    paddingRight: 12,
    paddingBottom: 0,
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
    borderBottomColor: COLORS.border,
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
