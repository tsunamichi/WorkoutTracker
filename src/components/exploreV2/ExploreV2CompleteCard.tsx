import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Keyboard } from 'react-native';
import { Platform } from 'react-native';
import Animated, { useAnimatedStyle, interpolateColor, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { EXPLORE_V2, COMPLETED_EXERCISE_LIST_LAYOUT } from './exploreV2Tokens';
import { exploreV2CardBorderColor } from './exploreV2TimerBorderColor';
import { TYPOGRAPHY } from '../../constants';
import { useAppTheme } from '../../theme/useAppTheme';
import { formatWeightForLoad } from '../../utils/weight';
import type { ExploreV2Group } from './exploreV2Types';
import {
  ExploreV2CompletedExerciseEditor,
  type ExploreV2CompletedExerciseEditorRef,
} from './ExploreV2CompletedExerciseEditor';

type Props = {
  completedGroupIndexes: number[];
  exerciseGroups: ExploreV2Group[];
  getSetDisplayValues: (exerciseId: string, round: number, w: number, r: number) => { weight: number; reps: number };
  useKg: boolean;
  weightUnit: string;
  onOpenExercise: (groupIndex: number, exerciseIndex: number) => void;
  onSelectIncompleteGroup?: (groupIndex: number) => void;
  /** Space occupied by a card peeking above this card's lower edge. */
  scrollBottomInset?: number;
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
  completedExerciseEdit: { groupIndex: number; exerciseIndex: number } | null;
  onCloseCompletedExerciseEdit: () => void;
  completedSets: Set<string>;
  localValues: Record<string, { weight: number; reps: number }>;
  setLocalValues: React.Dispatch<React.SetStateAction<Record<string, { weight: number; reps: number }>>>;
  getBarbellMode: (id: string) => boolean;
  progressionValuesByItemId: Record<
    string,
    { weight: number; reps: number; weightDelta: number; repsDelta: number }
  >;
  /** Main only: add/remove rounds while editing inline (template + snapshot). */
  onAdjustCompletedGroupSets?: (groupIndex: number, delta: 1 | -1) => void | Promise<void>;
};

const IDLE_HEADER_INK = '#464646';
const {
  setLogGap: COMPLETE_SET_LOG_GAP,
  weightNumeralMaxWidth: COMPLETE_WEIGHT_NUMERAL_MAX_WIDTH,
  repsValueWidth: COMPLETE_REPS_VALUE_WIDTH,
} = COMPLETED_EXERCISE_LIST_LAYOUT;

export function ExploreV2CompleteCard({
  completedGroupIndexes,
  exerciseGroups,
  getSetDisplayValues,
  useKg,
  weightUnit,
  onOpenExercise,
  onSelectIncompleteGroup,
  scrollBottomInset = 0,
  onHeaderPress,
  isExpanded,
  frontBottomRadius,
  coveredBottomRadius,
  timerThemeActive,
  restThemeProgress,
  exploreV2WorkBlueProgress,
  menuThemeActive,
  menuToneProgress,
  contentOnly = false,
  completedExerciseEdit,
  onCloseCompletedExerciseEdit,
  completedSets,
  localValues,
  setLocalValues,
  getBarbellMode,
  progressionValuesByItemId,
  onAdjustCompletedGroupSets,
}: Props) {
  const { explore: ex, colors: themeColors } = useAppTheme();
  const containerTertiary = themeColors.containerTertiary;
  const completedEditRef = useRef<ExploreV2CompletedExerciseEditorRef>(null);

  const editGroup =
    completedExerciseEdit != null ? exerciseGroups[completedExerciseEdit.groupIndex] ?? null : null;
  const editExercise =
    completedExerciseEdit != null && editGroup
      ? editGroup.exercises[completedExerciseEdit.exerciseIndex]
      : null;
  const editValid = Boolean(
    completedExerciseEdit &&
      editGroup &&
      editExercise &&
      completedGroupIndexes.includes(completedExerciseEdit.groupIndex),
  );

  const handleCloseCompletedEdit = useCallback(() => {
    completedEditRef.current?.commitPendingDrafts();
    Keyboard.dismiss();
    onCloseCompletedExerciseEdit();
  }, [onCloseCompletedExerciseEdit]);

  useEffect(() => {
    if (completedExerciseEdit && !editValid) {
      onCloseCompletedExerciseEdit();
    }
  }, [completedExerciseEdit, editValid, onCloseCompletedExerciseEdit]);
  const pageBgChrome = themeColors.canvasLight;
  const textMeta = themeColors.textMeta;
  const accentPrimaryDark = themeColors.accentPrimaryDark;
  const accentPrimary = themeColors.accentPrimary;
  const containerPrimary = themeColors.containerPrimary;
  const upNextBaseBg = themeColors.containerSecondary;
  const workUpNextBg = ex.workTimerUpNextCardBg;
  const amberBand = ex.amberBand;
  const menuMutedBg = '#CFC9CC';
  const menuMutedInk = themeColors.textMeta;
  const currentCardSurface = ex.surfaceCurrentCard;

  const headerChromeAnimatedStyle = useAnimatedStyle(() => {
    const b = restThemeProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const pRest = b * (1 - w);
    const pWork = b * w;
    const restCol = interpolateColor(pRest, [0, 1], [containerPrimary, accentPrimaryDark]);
    const baseColor = interpolateColor(pWork, [0, 1], [restCol, currentCardSurface]);
    return {
      color: interpolateColor(menuToneProgress.value, [0, 1], [baseColor, menuMutedInk]),
    };
  }, [containerPrimary, accentPrimaryDark, currentCardSurface, menuMutedInk, menuToneProgress]);
  const completedExerciseCount = completedGroupIndexes.reduce(
    (count, groupIndex) => count + (exerciseGroups[groupIndex]?.exercises.length ?? 0),
    0,
  );
  const totalExerciseCount = exerciseGroups.reduce((count, group) => count + group.exercises.length, 0);
  const completionProgress = totalExerciseCount > 0
    ? Math.min(1, completedExerciseCount / totalExerciseCount)
    : 0;

  const bottomCornerRadius = isExpanded ? frontBottomRadius : coveredBottomRadius;
  const shellAnimatedStyle = useAnimatedStyle(() => {
    const b = restThemeProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const whenUpBg = interpolateColor(w, [0, 1], [amberBand, workUpNextBg]);
    const baseBg = interpolateColor(b, [0, 1], [upNextBaseBg, whenUpBg]);
    const resolvedBg = editValid ? currentCardSurface : baseBg;
    return {
      backgroundColor: interpolateColor(menuToneProgress.value, [0, 1], [resolvedBg, menuMutedBg]),
      borderColor: exploreV2CardBorderColor(b, w, {
        pageIdle: themeColors.canvasLight,
        pageRest: accentPrimary,
        pageWork: themeColors.backgroundTimer,
      }),
    };
  }, [editValid, currentCardSurface, upNextBaseBg, amberBand, workUpNextBg, themeColors.canvasLight, themeColors.backgroundTimer, accentPrimary, menuMutedBg, menuToneProgress]);
  const scrollContentAnimatedStyle = useAnimatedStyle(() => {
    const b = restThemeProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const whenUpBg = interpolateColor(w, [0, 1], [amberBand, workUpNextBg]);
    const baseBg = interpolateColor(b, [0, 1], [upNextBaseBg, whenUpBg]);
    const resolvedBg = editValid ? currentCardSurface : baseBg;
    return {
      backgroundColor: interpolateColor(menuToneProgress.value, [0, 1], [resolvedBg, menuMutedBg]),
    };
  }, [editValid, currentCardSurface, upNextBaseBg, amberBand, workUpNextBg, menuMutedBg, menuToneProgress]);
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
  const rows = exerciseGroups
    .flatMap((g, gi) => g.exercises.map(ex => ({
      gi,
      g,
      ex,
      hasLogs: Array.from({ length: g.totalRounds }).some((_, roundIdx) =>
        completedSets.has(`${ex.id}-set-${roundIdx}`)),
    })))
    .sort((a, b) => Number(a.hasLogs) - Number(b.hasLogs));
  const hasCompletedRows = rows.some(row => row.hasLogs);
  const firstCompletedRowIndex = rows.findIndex(row => row.hasLogs);

  const rowsContent = (
    <>
        {rows.map(({ gi, g, ex, hasLogs }, index) => (
          <React.Fragment key={`${g.id}-${ex.id}`}>
          {hasCompletedRows && hasLogs && index === firstCompletedRowIndex ? (
            <View style={styles.sectionHeadingRow}>
              <Animated.Text style={[styles.sectionLabel, { color: themeColors.textMeta }]}>Completed</Animated.Text>
              <View style={[styles.sectionDivider, { backgroundColor: themeColors.textMeta }]} />
            </View>
          ) : null}
          <TouchableOpacity
            style={[styles.row, index < rows.length - 1 && styles.rowSpacing]}
            onPress={() => {
              const exIdx = g.exercises.findIndex(e => e.id === ex.id);
              if (completedGroupIndexes.includes(gi)) {
                onOpenExercise(gi, exIdx);
              } else {
                onSelectIncompleteGroup?.(gi);
              }
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
                if (!completedSets.has(`${ex.id}-set-${roundIdx}`)) return null;
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
                        <View style={styles.valueWeightSlot}>
                          <Animated.Text style={[styles.val, styles.valueTextRight, rowTitleInkStyle]}>
                            {formatWeightForLoad(vals.weight, useKg)}
                          </Animated.Text>
                        </View>
                        <Animated.Text style={[styles.valUnit, { color: textMeta }]}>{weightUnit}</Animated.Text>
                      </View>
                    )}
                    <View style={styles.valWithUnit}>
                      <View style={styles.valueRepsSlot}>
                        <Animated.Text style={[styles.val, styles.valueTextRight, rowTitleInkStyle]}>
                          {vals.reps}
                        </Animated.Text>
                      </View>
                      <Animated.Text style={[styles.valUnit, { color: textMeta }]}>
                        {ex.isTimeBased ? 's' : 'reps'}
                      </Animated.Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </TouchableOpacity>
          </React.Fragment>
        ))}
    </>
  );

  const editPanel =
    editValid && editGroup && completedExerciseEdit ? (
      <ExploreV2CompletedExerciseEditor
        ref={completedEditRef}
        group={editGroup}
        exerciseIndex={completedExerciseEdit.exerciseIndex}
        completedSets={completedSets}
        getSetDisplayValues={getSetDisplayValues}
        localValues={localValues}
        setLocalValues={setLocalValues}
        useKg={useKg}
        weightUnit={weightUnit}
        getBarbellMode={getBarbellMode}
        progressionValuesByItemId={progressionValuesByItemId}
        showExerciseTitle={!contentOnly}
        currentCardMode
        restThemeProgress={restThemeProgress}
        exploreV2WorkBlueProgress={exploreV2WorkBlueProgress}
        menuToneProgress={menuToneProgress}
        onSave={handleCloseCompletedEdit}
        menuThemeActive={menuThemeActive}
        timerThemeActive={timerThemeActive}
        onAdjustGroupSets={
          onAdjustCompletedGroupSets && completedExerciseEdit
            ? d => onAdjustCompletedGroupSets(completedExerciseEdit.groupIndex, d)
            : undefined
        }
      />
    ) : null;

  const scrollInnerMain = editValid && editPanel ? editPanel : rowsContent;

  if (contentOnly) {
    return (
      <Animated.ScrollView
        style={[styles.scroll, scrollBottomInset > 0 && { marginBottom: scrollBottomInset }]}
        contentContainerStyle={[
          styles.scrollInner,
          styles.scrollInnerContentOnly,
          editValid && styles.scrollInnerFlexGrow,
        ]}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {editValid ? (
          <View style={styles.contentOnlyEditColumn}>
            <View style={styles.contentOnlyEditBar}>
              <Text
                style={[styles.contentOnlyEditTitle, { color: menuThemeActive ? menuMutedInk : containerTertiary }]}
                numberOfLines={1}
              >
                {editExercise?.exerciseName ?? ''}
              </Text>
            </View>
            <View style={styles.contentOnlyEditFill}>{editPanel}</View>
          </View>
        ) : (
          scrollInnerMain
        )}
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
      <View style={styles.headerRow}>
        <Pressable style={styles.headerTitlePress} onPress={onHeaderPress}>
          <Animated.Text
            style={[
              styles.headerLabel,
              headerChromeAnimatedStyle,
              editValid && { color: containerTertiary },
            ]}
          >
            {editValid ? 'Current (Editing)' : 'Exercises'}
          </Animated.Text>
        </Pressable>
        {!editValid ? <Pressable onPress={onHeaderPress} style={styles.completionSummary}>
          <Animated.Text style={[styles.headerCount, headerChromeAnimatedStyle]}>
            {completedExerciseCount}/{totalExerciseCount}
          </Animated.Text>
          <Svg height="14" width="14" viewBox="0 0 16 16" pointerEvents="none">
            <Circle cx="8" cy="8" r="8" fill={themeColors.containerPrimaryDark} />
            {completionProgress >= 0.999 ? (
              <Circle cx="8" cy="8" r="8" fill={themeColors.containerTertiary} />
            ) : completionProgress > 0 ? (
              <Path
                d={`M 8 8 L 8 0 A 8 8 0 ${completionProgress > 0.5 ? 1 : 0} 1 ${
                  8 + 8 * Math.sin(2 * Math.PI * completionProgress)
                } ${8 - 8 * Math.cos(2 * Math.PI * completionProgress)} Z`}
                fill={themeColors.containerTertiary}
              />
            ) : null}
          </Svg>
        </Pressable> : null}
      </View>
      <Animated.ScrollView
        style={[styles.scroll, scrollBottomInset > 0 && { marginBottom: scrollBottomInset }]}
        contentContainerStyle={[
          styles.scrollInner,
          scrollContentAnimatedStyle,
          editValid && styles.scrollInnerFlexGrow,
        ]}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {scrollInnerMain}
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
  headerTitlePress: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  contentOnlyEditBar: {
    marginBottom: 8,
    width: '100%',
  },
  contentOnlyEditTitle: {
    ...TYPOGRAPHY.h2,
    flex: 1,
    minWidth: 0,
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
  sectionLabel: {
    ...TYPOGRAPHY.legal,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 48,
    marginBottom: 16,
  },
  sectionDivider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  headerCount: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
    letterSpacing: 0,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  completionSummary: {
    minWidth: 54,
    height: 32,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollInner: {
    paddingHorizontal: pad.horizontal,
    paddingTop: EXPLORE_V2.headerToContentGap - 32,
    paddingBottom: pad.bottom,
  },
  /** Lets inline completed editor fill card height so metrics + Save pin to the bottom (matches Current card). */
  scrollInnerFlexGrow: {
    flexGrow: 1,
  },
  scrollInnerContentOnly: {
    paddingTop: 12,
  },
  contentOnlyEditColumn: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  contentOnlyEditFill: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 8,
  },
  rowWithDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    paddingBottom: COMPLETED_EXERCISE_LIST_LAYOUT.rowDividerPadBottom,
    marginBottom: COMPLETED_EXERCISE_LIST_LAYOUT.rowDividerMarginBottom,
  },
  rowSpacing: {
    marginBottom: 4,
  },
  nameCol: { flex: 1, paddingRight: COMPLETED_EXERCISE_LIST_LAYOUT.nameColPaddingRight },
  name: {
    ...TYPOGRAPHY.meta,
    lineHeight: 20,
    ...(Platform.OS === 'android' ? { includeFontPadding: false as const } : {}),
  },
  valCol: { alignItems: 'flex-end', justifyContent: 'flex-start' },
  valRow: {
    flexDirection: 'row',
    gap: COMPLETED_EXERCISE_LIST_LAYOUT.valRowGap,
    justifyContent: 'flex-end',
  },
  valRowGapAfter: {
    marginBottom: COMPLETE_SET_LOG_GAP,
  },
  valWithUnit: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: COMPLETED_EXERCISE_LIST_LAYOUT.valWithUnitGap,
  },
  valueWeightSlot: {
    maxWidth: COMPLETE_WEIGHT_NUMERAL_MAX_WIDTH,
    minWidth: 0,
  },
  valueRepsSlot: {
    width: COMPLETE_REPS_VALUE_WIDTH,
  },
  valueTextRight: {
    textAlign: 'right',
    width: '100%',
  },
  val: {
    ...TYPOGRAPHY.meta,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
    ...(Platform.OS === 'android' ? { includeFontPadding: false as const } : {}),
  },
  valUnit: {
    ...TYPOGRAPHY.meta,
    lineHeight: 20,
    ...(Platform.OS === 'android' ? { includeFontPadding: false as const } : {}),
  },
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
