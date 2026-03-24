import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { EXPLORE_V2 } from './exploreV2Tokens';
import { EXPLORE_V2_PALETTES } from './exploreV2ColorSystem';
import { TYPOGRAPHY } from '../../constants';
import { formatWeightForLoad } from '../../utils/weight';
import type { ExploreV2Group, PrimaryRevealedCard } from './exploreV2Types';

const palette = EXPLORE_V2_PALETTES.current;
const CANVAS_INK = '#F5F4F4';
const VALUE_INK = '#FFA424';
const UNIT_INK = '#464646';

type Props = {
  group: ExploreV2Group;
  primaryRevealed: PrimaryRevealedCard;
  currentRounds: Record<string, number>;
  completedSets: Set<string>;
  getSetDisplayValues: (exerciseId: string, round: number, w: number, r: number) => { weight: number; reps: number };
  localValues: Record<string, { weight: number; reps: number }>;
  useKg: boolean;
  weightUnit: string;
  getBarbellMode: (id: string) => boolean;
  onLogNextSet: () => Promise<void>;
  onOpenOverflow: () => void;
  preStart: boolean;
  onCollapsedPress: () => void;
  showPrimaryCta: boolean;
  inlineRestActive: boolean;
  showCollapsedWhenSecondary: boolean;
  frontBottomRadius: number;
  coveredBottomRadius: number;
  timerThemeActive: boolean;
};

function findNextIncompleteSet(group: ExploreV2Group, completedSets: Set<string>) {
  for (let r = 0; r < group.totalRounds; r++) {
    for (let ei = 0; ei < group.exercises.length; ei++) {
      const ex = group.exercises[ei];
      if (!completedSets.has(`${ex.id}-set-${r}`)) {
        return { round: r, exerciseIndex: ei };
      }
    }
  }
  return null;
}

export function ExploreV2CurrentCard({
  group,
  primaryRevealed,
  currentRounds,
  completedSets,
  getSetDisplayValues,
  localValues,
  useKg,
  weightUnit,
  getBarbellMode,
  onLogNextSet,
  onOpenOverflow,
  preStart: _preStart,
  onCollapsedPress,
  showPrimaryCta,
  inlineRestActive,
  showCollapsedWhenSecondary,
  frontBottomRadius,
  coveredBottomRadius,
  timerThemeActive,
}: Props) {
  const isPrimary = primaryRevealed === 'current';
  const bottomCornerRadius = isPrimary ? frontBottomRadius : coveredBottomRadius;

  const completedRounds = currentRounds[group.id] || 0;
  const nextIncomplete = useMemo(() => findNextIncompleteSet(group, completedSets), [group, completedSets]);
  const groupHasStarted = useMemo(
    () => group.exercises.some(ex => completedSets.has(`${ex.id}-set-0`)),
    [group, completedSets],
  );

  const displayExerciseName = useMemo(() => {
    if (nextIncomplete != null) {
      const ex = group.exercises[nextIncomplete.exerciseIndex];
      if (ex?.exerciseName) return ex.exerciseName;
    }
    return group.exercises.map(e => e.exerciseName).join(' + ');
  }, [nextIncomplete, group.exercises]);

  const heroExIdx = nextIncomplete?.exerciseIndex ?? 0;
  const heroRound = nextIncomplete?.round ?? 0;
  const heroEx = group.exercises[heroExIdx] ?? group.exercises[0];
  const heroVals = getSetDisplayValues(
    heroEx.id,
    heroRound,
    heroEx.weight ?? 0,
    Number(heroEx.reps) ?? 0,
  );
  const lvHero = localValues[`${heroEx.id}-set-${heroRound}`];
  const heroW = lvHero?.weight ?? heroVals.weight;
  const heroR = lvHero?.reps ?? heroVals.reps;

  const _barbellMode = getBarbellMode(heroEx.id);
  const weightPerSideLbs = heroW > 45 ? (heroW - 45) / 2 : null;
  const showPerSideRow = weightPerSideLbs != null && weightPerSideLbs > 0;

  const progressFraction = `${Math.min(completedRounds + 1, group.totalRounds)}/${group.totalRounds}`;
  const ctaLabel = !groupHasStarted ? 'Log first set' : 'Log next set';
  const collapsedSecondary = !isPrimary && showCollapsedWhenSecondary;

  const valuesSlideX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!timerThemeActive) return;
    valuesSlideX.setValue(24);
    Animated.timing(valuesSlideX, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [timerThemeActive, heroRound, heroExIdx, valuesSlideX]);

  const surfaceColor = '#1F1F1F';
  const borderColor = timerThemeActive ? '#FFA424' : EXPLORE_V2.colors.pageBg;
  const heroInk = timerThemeActive ? '#464646' : VALUE_INK;
  const ctaBg = timerThemeActive ? '#464646' : VALUE_INK;
  const ctaText = timerThemeActive ? CANVAS_INK : '#1F1F1F';

  return (
    <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.shell,
          {
            backgroundColor: surfaceColor,
            borderColor,
            borderBottomLeftRadius: bottomCornerRadius,
            borderBottomRightRadius: bottomCornerRadius,
          },
          collapsedSecondary && styles.collapsedSecondarySurface,
        ]}
      >
        <View style={styles.headerBar}>
          <Text style={[styles.eyebrow, { color: CANVAS_INK }]}>Current</Text>
          <TouchableOpacity onPress={onOpenOverflow} hitSlop={14} style={styles.settingsBtn} activeOpacity={0.7}>
            <Text style={[styles.settingsLabel, { color: CANVAS_INK }]}>Settings</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.exerciseName, { color: CANVAS_INK }]} numberOfLines={2}>
          {displayExerciseName}
        </Text>

        <View style={styles.heroCtaContainer}>
          <Animated.View style={[styles.valuesBlock, { transform: [{ translateX: valuesSlideX }] }]}>
            {showPerSideRow && weightPerSideLbs != null ? (
              <View style={styles.perSideRow}>
                <Text style={[styles.perSideValue, { color: heroInk }]}>
                  {formatWeightForLoad(weightPerSideLbs, useKg)}
                  {weightUnit}
                </Text>
                <Text style={styles.perSideLabel}>weight per side</Text>
              </View>
            ) : null}

            <>
              <View style={styles.valueRow}>
                <Text style={[styles.valueMetric, { color: heroInk }]} numberOfLines={1}>
                  {formatWeightForLoad(Math.max(0, heroW), useKg)}
                </Text>
                <Text style={[styles.valueMetric, { color: UNIT_INK }]}>{weightUnit}</Text>
              </View>
              <View style={styles.valueRow}>
                <Text style={[styles.valueMetric, { color: heroInk }]} numberOfLines={1}>
                  {heroR}
                </Text>
                <Text style={[styles.valueMetric, { color: UNIT_INK }]}>
                  {heroEx.isTimeBased ? 'sec' : 'reps'}
                </Text>
              </View>
            </>
          </Animated.View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.ctaPill, { backgroundColor: ctaBg }, (!showPrimaryCta || inlineRestActive) && styles.ctaPillDisabled]}
              onPress={onLogNextSet}
              disabled={!showPrimaryCta || inlineRestActive}
              activeOpacity={0.88}
            >
              <Text style={[styles.ctaPillText, { color: ctaText }]}>{ctaLabel}</Text>
            </TouchableOpacity>
            <Text style={[styles.progressFraction, { color: CANVAS_INK }]}>{progressFraction}</Text>
          </View>
        </View>
        {collapsedSecondary ? (
          <TouchableOpacity
            style={styles.collapsedTapOverlay}
            onPress={onCollapsedPress}
            activeOpacity={1}
          />
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const pad = EXPLORE_V2.cardPadding;

const styles = StyleSheet.create({
  kav: { flex: 1, minHeight: 0 },
  shell: {
    flex: 1,
    flexDirection: 'column',
    paddingTop: 10,
    paddingLeft: pad.horizontal,
    paddingRight: 24,
    paddingBottom: pad.bottom,
    borderWidth: 2,
    borderColor: EXPLORE_V2.colors.pageBg,
    borderTopLeftRadius: EXPLORE_V2.cardTopRadius,
    borderTopRightRadius: EXPLORE_V2.cardTopRadius,
    borderBottomLeftRadius: EXPLORE_V2.cardRadius,
    borderBottomRightRadius: EXPLORE_V2.cardRadius,
    overflow: 'hidden',
    shadowColor: '#0A060C',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
  },
  collapsedSecondarySurface: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  collapsed: {
    flex: 1,
    width: '100%',
    paddingTop: 10,
    paddingLeft: pad.horizontal,
    paddingRight: 24,
    paddingBottom: 12,
    borderWidth: 2,
    borderColor: EXPLORE_V2.colors.pageBg,
    borderTopLeftRadius: EXPLORE_V2.cardTopRadius,
    borderTopRightRadius: EXPLORE_V2.cardTopRadius,
    borderBottomLeftRadius: EXPLORE_V2.cardRadius,
    borderBottomRightRadius: EXPLORE_V2.cardRadius,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
  },
  collapsedEyebrow: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
    letterSpacing: 0,
    textTransform: 'none',
  },
  collapsedTapOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
  },
  headerBar: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
    width: '100%',
  },
  eyebrow: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
    letterSpacing: 0,
    textTransform: 'none',
  },
  exerciseName: {
    ...TYPOGRAPHY.displayLarge,
    fontWeight: '400',
    flexShrink: 1,
  },
  settingsBtn: {
    minWidth: 78,
    height: 38,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  settingsLabel: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: CANVAS_INK,
  },
  heroCtaContainer: {
    width: '100%',
    flexGrow: 1,
    flexShrink: 0,
    justifyContent: 'flex-end',
    minHeight: 0,
  },
  valuesBlock: {
    width: '100%',
  },
  perSideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#464646',
    paddingBottom: 8,
    marginBottom: 16,
  },
  perSideValue: {
    ...TYPOGRAPHY.legal,
    fontWeight: '400',
    color: VALUE_INK,
  },
  perSideLabel: {
    ...TYPOGRAPHY.legal,
    fontWeight: '400',
    color: UNIT_INK,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'nowrap',
    gap: 2,
    marginBottom: 0,
  },
  valueMetric: {
    fontSize: 80,
    fontWeight: '400',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    marginTop: 40,
    paddingBottom: 0,
  },
  ctaPill: {
    paddingVertical: 17,
    paddingHorizontal: 32,
    borderRadius: 14,
    backgroundColor: VALUE_INK,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
  },
  ctaPillDisabled: {
    opacity: 0.45,
  },
  ctaPillText: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
    color: '#1F1F1F',
    letterSpacing: 0.2,
  },
  progressFraction: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    paddingRight: 0,
  },
});
