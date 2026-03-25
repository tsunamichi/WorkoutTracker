import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  interpolateColor,
  type SharedValue,
} from 'react-native-reanimated';
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
  /** Ends inline rest when timer theme is active */
  onSkipRest: () => void;
  onOpenOverflow: () => void;
  preStart: boolean;
  onCollapsedPress: () => void;
  showPrimaryCta: boolean;
  inlineRestActive: boolean;
  showCollapsedWhenSecondary: boolean;
  frontBottomRadius: number;
  coveredBottomRadius: number;
  timerThemeActive: boolean;
  restThemeProgress: SharedValue<number>;
};

const AnimatedTouchableOpacity = Reanimated.createAnimatedComponent(TouchableOpacity);

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
  onSkipRest,
  onOpenOverflow,
  preStart: _preStart,
  onCollapsedPress,
  showPrimaryCta,
  inlineRestActive,
  showCollapsedWhenSecondary,
  frontBottomRadius,
  coveredBottomRadius,
  timerThemeActive,
  restThemeProgress,
}: Props) {
  const isPrimary = primaryRevealed === 'current';
  const settingsOpacity = useRef(new Animated.Value(isPrimary ? 1 : 0)).current;
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
  const ctaLabel = inlineRestActive
    ? 'Skip rest time'
    : !groupHasStarted
      ? 'Log first set'
      : 'Log next set';
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

  useEffect(() => {
    Animated.timing(settingsOpacity, {
      toValue: isPrimary ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [isPrimary, settingsOpacity]);

  const surfaceColor = '#1F1F1F';
  const shellAnimatedStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(restThemeProgress.value, [0, 1], [EXPLORE_V2.colors.pageBg, '#FFA424']),
  }));
  const heroInkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(restThemeProgress.value, [0, 1], [VALUE_INK, '#464646']),
  }));
  const ctaBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(restThemeProgress.value, [0, 1], [VALUE_INK, '#464646']),
  }));
  const ctaLabelStyle = useAnimatedStyle(() => {
    if (inlineRestActive && isPrimary) {
      return { color: VALUE_INK };
    }
    return {
      color: interpolateColor(restThemeProgress.value, [0, 1], ['#1F1F1F', CANVAS_INK]),
    };
  }, [inlineRestActive, isPrimary]);

  return (
    <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <Reanimated.View
        style={[
          styles.shell,
          shellAnimatedStyle,
          {
            backgroundColor: surfaceColor,
            borderBottomLeftRadius: bottomCornerRadius,
            borderBottomRightRadius: bottomCornerRadius,
          },
          collapsedSecondary && styles.collapsedSecondarySurface,
        ]}
      >
        <View style={styles.headerBar}>
          <Text style={[styles.eyebrow, { color: CANVAS_INK }]}>Current</Text>
          <Animated.View style={{ opacity: settingsOpacity }}>
            <TouchableOpacity
              onPress={onOpenOverflow}
              hitSlop={14}
              style={styles.settingsBtn}
              activeOpacity={0.7}
              disabled={!isPrimary}
            >
              <Text style={[styles.settingsLabel, { color: CANVAS_INK }]}>Settings</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
        <Text style={[styles.exerciseName, { color: CANVAS_INK }]} numberOfLines={2}>
          {displayExerciseName}
        </Text>

        <View style={styles.heroCtaContainer}>
          <Animated.View style={[styles.valuesBlock, { transform: [{ translateX: valuesSlideX }] }]}>
            {showPerSideRow && weightPerSideLbs != null ? (
              <View style={styles.perSideRow}>
                <Reanimated.Text style={[styles.perSideValue, heroInkStyle]}>
                  {formatWeightForLoad(weightPerSideLbs, useKg)}
                  {weightUnit}
                </Reanimated.Text>
                <Text style={styles.perSideLabel}>weight per side</Text>
              </View>
            ) : null}

            <>
              <View style={styles.valueRow}>
                <Reanimated.Text style={[styles.valueMetric, heroInkStyle]} numberOfLines={1}>
                  {formatWeightForLoad(Math.max(0, heroW), useKg)}
                </Reanimated.Text>
                <Text style={[styles.valueMetric, { color: UNIT_INK }]}>{weightUnit}</Text>
              </View>
              <View style={styles.valueRow}>
                <Reanimated.Text style={[styles.valueMetric, heroInkStyle]} numberOfLines={1}>
                  {heroR}
                </Reanimated.Text>
                <Text style={[styles.valueMetric, { color: UNIT_INK }]}>
                  {heroEx.isTimeBased ? 'sec' : 'reps'}
                </Text>
              </View>
            </>
          </Animated.View>

          <View style={styles.footer}>
            <AnimatedTouchableOpacity
              style={[
                styles.ctaPill,
                ctaBgStyle,
                !inlineRestActive && !showPrimaryCta && styles.ctaPillDisabled,
              ]}
              onPress={() => {
                if (inlineRestActive) onSkipRest();
                else void onLogNextSet();
              }}
              disabled={inlineRestActive ? false : !showPrimaryCta}
              activeOpacity={0.88}
            >
              <Reanimated.Text style={[styles.ctaPillText, ctaLabelStyle]}>{ctaLabel}</Reanimated.Text>
            </AnimatedTouchableOpacity>
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
      </Reanimated.View>
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
