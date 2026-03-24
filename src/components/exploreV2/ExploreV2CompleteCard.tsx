import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { Platform } from 'react-native';
import { EXPLORE_V2 } from './exploreV2Tokens';
import { EXPLORE_V2_PALETTES } from './exploreV2ColorSystem';
import { TYPOGRAPHY } from '../../constants';
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
};

const palette = EXPLORE_V2_PALETTES.complete;

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
  timerThemeActive,
}: Props) {
  const bottomCornerRadius = isExpanded ? frontBottomRadius : coveredBottomRadius;
  const rows = completedGroupIndexes.flatMap(gi => {
    const g = exerciseGroups[gi];
    if (!g) return [];
    return g.exercises.map(ex => ({ gi, g, ex }));
  });

  const backgroundColor = timerThemeActive ? '#F3940F' : palette.main;
  const borderColor = timerThemeActive ? '#FFA424' : EXPLORE_V2.colors.pageBg;
  const headerInk = '#464646';

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor,
          borderColor,
          borderBottomLeftRadius: bottomCornerRadius,
          borderBottomRightRadius: bottomCornerRadius,
        },
      ]}
    >
      {!isExpanded ? (
        <Pressable style={styles.peekTapOverlay} onPress={onHeaderPress} />
      ) : null}
      <Pressable style={styles.headerRow} onPress={onHeaderPress}>
        <Text style={[styles.headerLabel, { color: headerInk }]}>Completed</Text>
        <View style={styles.countOrPlusSlot}>
          <IconChevronDown size={18} color={headerInk} />
        </View>
      </Pressable>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollInner, { backgroundColor }]}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {rows.map(({ gi, g, ex }, index) => (
          <TouchableOpacity
            key={`${g.id}-${ex.id}`}
            style={[styles.row, index < rows.length - 1 && styles.rowGapAfter]}
            onPress={() => {
              const exIdx = g.exercises.findIndex(e => e.id === ex.id);
              onOpenExercise(gi, exIdx);
            }}
            activeOpacity={0.75}
          >
            <View style={styles.nameCol}>
              <Text style={[styles.name, { color: palette.dark }]} numberOfLines={2}>
                {ex.exerciseName}
              </Text>
            </View>
            <View style={styles.valCol}>
              {Array.from({ length: g.totalRounds }).map((_, roundIdx) => {
                const vals = getSetDisplayValues(ex.id, roundIdx, ex.weight ?? 0, ex.reps ?? 0);
                return (
                  <View key={roundIdx} style={styles.valRow}>
                    {vals.weight > 0 && (
                      <View style={styles.valWithUnit}>
                        <Text style={[styles.val, { color: palette.dark }]}>
                          {formatWeightForLoad(vals.weight, useKg)}
                        </Text>
                        <Text style={[styles.valUnit, { color: palette.soft }]}>
                          {weightUnit}
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.val, { color: palette.dark }]}>
                      {vals.reps}
                    </Text>
                    {ex.isTimeBased ? <Text style={[styles.valUnit, { color: palette.soft }]}>s</Text> : null}
                  </View>
                );
              })}
            </View>
          </TouchableOpacity>
        ))}
        {rows.length === 0 && (
          <Text style={[styles.empty, { color: palette.muted }]}>Nothing completed yet.</Text>
        )}
      </ScrollView>
    </View>
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
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 6,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
  },
  headerRow: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
    paddingLeft: 24,
    paddingRight: 12,
    paddingBottom: 0,
  },
  peekTapOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  countOrPlusSlot: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
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
    textTransform: 'none',
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
  row: {
    flexDirection: 'row',
    paddingVertical: 0,
  },
  rowGapAfter: {
    marginBottom: EXPLORE_V2.exerciseListRowGap,
  },
  nameCol: { flex: 1, paddingRight: 10 },
  name: { fontSize: 15, fontWeight: '500', lineHeight: 20 },
  valCol: { alignItems: 'flex-end' },
  valRow: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  valWithUnit: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  val: { fontSize: 13, fontWeight: '500' },
  valUnit: { fontSize: 13, fontWeight: '400' },
  empty: {
    fontSize: 14,
    paddingVertical: 12,
  },
});
