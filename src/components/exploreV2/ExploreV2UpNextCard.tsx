import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { Platform } from 'react-native';
import { EXPLORE_V2 } from './exploreV2Tokens';
import { EXPLORE_V2_PALETTES } from './exploreV2ColorSystem';
import { TYPOGRAPHY } from '../../constants';
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
  /** Current has logged sets — cannot replace Current by tapping another row. */
  currentSelectionsLocked: boolean;
  hasCurrentExercise: boolean;
  hasCompletePresent: boolean;
  /** Card is expanded (primary) — show plus instead of queue count */
  isExpanded: boolean;
  frontBottomRadius: number;
  coveredBottomRadius: number;
  timerThemeActive: boolean;
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

const palette = EXPLORE_V2_PALETTES.upNext;
const HEADER_INK = '#464646';
const ROW_NAME_INK = '#1F1F1F';
const ROW_SUPER_INK = '#464646';

export function ExploreV2UpNextCard({
  upNextGroupIndexes,
  exerciseGroups,
  completedSets,
  onSelectGroup,
  onHeaderPress,
  onOpenAddExercise,
  onRemoveGroupFromUpNext,
  allowAddExercise,
  currentSelectionsLocked,
  hasCurrentExercise,
  hasCompletePresent,
  isExpanded,
  frontBottomRadius,
  coveredBottomRadius,
  timerThemeActive,
}: Props) {
  const bottomCornerRadius = isExpanded ? frontBottomRadius : coveredBottomRadius;
  const backgroundColor = timerThemeActive ? '#E78B0B' : palette.main;
  const borderColor = timerThemeActive ? '#FFA424' : EXPLORE_V2.colors.pageBg;

  const showFullEmpty =
    upNextGroupIndexes.length === 0 && !hasCurrentExercise && !hasCompletePresent;

  const showQueueEmptyOnly =
    upNextGroupIndexes.length === 0 && (hasCurrentExercise || hasCompletePresent);

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
        <Text style={[styles.headerLabel, { color: HEADER_INK }]}>Up Next</Text>
        <View style={styles.countOrPlusSlot}>
          {isExpanded && allowAddExercise ? (
            <TouchableOpacity
              onPress={onOpenAddExercise}
              hitSlop={10}
              style={styles.addExerciseBtn}
              accessibilityLabel="Add exercise"
              activeOpacity={0.75}
            >
              <Text style={styles.addExerciseText}>Add exercise</Text>
            </TouchableOpacity>
          ) : (
            <IconChevronDown size={18} color={HEADER_INK} />
          )}
        </View>
      </Pressable>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollInner, { backgroundColor }]}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
          const rowSelectable = !started && !currentSelectionsLocked;
          const isLast = index === upNextGroupIndexes.length - 1;
          return (
            <View
              key={g.id}
              style={[styles.row, !isLast && styles.rowGapAfter]}
            >
              <TouchableOpacity
                style={styles.rowMain}
                disabled={!rowSelectable}
                onPress={() => rowSelectable && onSelectGroup(gi)}
                activeOpacity={0.75}
              >
                <View style={styles.nameWithSuper}>
                  <Text style={[styles.name, { color: ROW_NAME_INK }]} numberOfLines={2}>
                    {groupTitle(g)}
                  </Text>
                  <Text style={[styles.superScript, { color: ROW_SUPER_INK }]}>{g.totalRounds}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.trashBtn}
                onPress={() => onRemoveGroupFromUpNext(gi)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <IconTrash size={22} color={HEADER_INK} />
              </TouchableOpacity>
            </View>
          );
        })}
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
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 5,
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
    minWidth: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addExerciseBtn: {
    minHeight: 30,
    alignSelf: 'flex-end',
    justifyContent: 'center',
    paddingRight: 12,
  },
  addExerciseText: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
    color: HEADER_INK,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: HEADER_INK,
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
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollInner: {
    paddingLeft: pad.horizontal,
    paddingRight: 12,
    paddingTop: EXPLORE_V2.headerToContentGap,
    paddingBottom: pad.bottom,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
    paddingRight: 0,
  },
  rowGapAfter: {
    marginBottom: EXPLORE_V2.exerciseListRowGap,
  },
  rowMain: {
    flex: 1,
    paddingRight: 8,
  },
  nameWithSuper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  name: {
    ...TYPOGRAPHY.displayLarge,
    fontWeight: '400',
    flexShrink: 1,
  },
  superScript: {
    ...TYPOGRAPHY.legal,
    fontWeight: '700',
    lineHeight: 14,
    marginLeft: 4,
    marginTop: 2,
  },
  trashBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
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
