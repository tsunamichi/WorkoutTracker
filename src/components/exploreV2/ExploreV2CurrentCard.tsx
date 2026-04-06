import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ScrollView,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  interpolate,
  interpolateColor,
  type SharedValue,
} from 'react-native-reanimated';
import { EXPLORE_V2 } from './exploreV2Tokens';
import { COLORS, TYPOGRAPHY, hexToRgba } from '../../constants';
import { useAppTheme } from '../../theme/useAppTheme';
import { formatWeightForLoad, fromDisplayWeight } from '../../utils/weight';
import { applyForwardPropagationForExerciseRounds } from '../../utils/exerciseLocalValues';
import type { ExploreV2Group, PrimaryRevealedCard } from './exploreV2Types';
import {
  ExploreV2CurrentOverflowPanel,
  EXPLORE_V2_CURRENT_SETTINGS_COLLAPSED_STACK_H,
  EXPLORE_V2_CURRENT_SETTINGS_HERO_GAP,
  type ExploreV2CurrentSettingsOverflowProps,
} from './ExploreV2CurrentOverflowSheet';
import { UnderlinedActionButton } from '../common/UnderlinedActionButton';

type Props = {
  group: ExploreV2Group;
  primaryRevealed: PrimaryRevealedCard;
  currentRounds: Record<string, number>;
  completedSets: Set<string>;
  getSetDisplayValues: (exerciseId: string, round: number, w: number, r: number) => { weight: number; reps: number };
  localValues: Record<string, { weight: number; reps: number }>;
  setLocalValues: React.Dispatch<React.SetStateAction<Record<string, { weight: number; reps: number }>>>;
  useKg: boolean;
  weightUnit: string;
  getBarbellMode: (id: string) => boolean;
  onLogNextSet: (payload?: { setId: string; values: { weight: number; reps: number } }) => Promise<void>;
  /** Skip rest / work / switch-sides (explore v2 hero timers) */
  onSkipRest: () => void;
  exploreV2TimerPhase: 'none' | 'work' | 'switchSides' | 'rest';
  exploreV2WorkBlueProgress: SharedValue<number>;
  preStart: boolean;
  onCollapsedPress: () => void;
  showPrimaryCta: boolean;
  showCollapsedWhenSecondary: boolean;
  frontBottomRadius: number;
  coveredBottomRadius: number;
  /** Rest timer band active — dims hero numerals */
  timerThemeActive: boolean;
  restThemeProgress: SharedValue<number>;
  /** In-card settings overlay (slides up over hero + footer) */
  settingsOverflow?: ExploreV2CurrentSettingsOverflowProps;
  progressionValuesByItemId: Record<
    string,
    { weight: number; reps: number; weightDelta: number; repsDelta: number }
  >;
  celebrationProgress?: SharedValue<number>;
  celebrationActive?: boolean;
};

type SetSlot = { round: number; exerciseIndex: number };

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

function buildOrderedSetSlots(group: ExploreV2Group): SetSlot[] {
  const slots: SetSlot[] = [];
  for (let r = 0; r < group.totalRounds; r++) {
    for (let ei = 0; ei < group.exercises.length; ei++) {
      slots.push({ round: r, exerciseIndex: ei });
    }
  }
  return slots;
}

function slotKey(slot: SetSlot): string {
  return `${slot.round}-${slot.exerciseIndex}`;
}

type SetHeroPageProps = {
  slot: SetSlot;
  group: ExploreV2Group;
  completedSets: Set<string>;
  getSetDisplayValues: Props['getSetDisplayValues'];
  localValues: Props['localValues'];
  setLocalValues: Props['setLocalValues'];
  useKg: boolean;
  weightUnit: string;
  getBarbellMode: Props['getBarbellMode'];
  metricsEditable: boolean;
  heroValueColor: string;
  perSideLabelColor: string;
  unitLabelColor: string;
  pageWidth: number;
  commitsRef: React.MutableRefObject<Record<string, () => { weight: number; reps: number } | void>>;
  progressionValuesByItemId: Props['progressionValuesByItemId'];
};

function CurrentSetHeroPage({
  slot,
  group,
  completedSets,
  getSetDisplayValues,
  localValues,
  setLocalValues,
  useKg,
  weightUnit,
  getBarbellMode,
  metricsEditable,
  heroValueColor,
  perSideLabelColor,
  unitLabelColor,
  pageWidth,
  commitsRef,
  progressionValuesByItemId,
}: SetHeroPageProps) {
  const heroEx = group.exercises[slot.exerciseIndex];
  const heroRound = slot.round;
  const heroVals = getSetDisplayValues(
    heroEx.id,
    heroRound,
    heroEx.weight ?? 0,
    Number(heroEx.reps) ?? 0,
  );
  const setId = `${heroEx.id}-set-${heroRound}`;
  const lvHero = localValues[setId];
  const heroW = lvHero?.weight ?? heroVals.weight;
  const heroR = lvHero?.reps ?? heroVals.reps;

  const weightDefault = useMemo(
    () => formatWeightForLoad(heroW, useKg),
    [setId, heroW, useKg],
  );
  const repsDefault = useMemo(
    () => (heroEx.isTimeBased ? String(heroR) : String(Math.round(heroR))),
    [setId, heroR, heroEx.isTimeBased],
  );

  const weightInputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const repsInputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const weightDraftRef = useRef(weightDefault);
  const repsDraftRef = useRef(repsDefault);
  const weightDirtyRef = useRef(false);
  const repsDirtyRef = useRef(false);
  const skipBlurCommitUntilRef = useRef(0);

  const prevSetIdForInputsRef = useRef<string | null>(null);
  useEffect(() => {
    const isSetChanged = prevSetIdForInputsRef.current !== setId;
    prevSetIdForInputsRef.current = setId;

    if (isSetChanged) {
      weightDraftRef.current = weightDefault;
      repsDraftRef.current = repsDefault;
      weightDirtyRef.current = false;
      repsDirtyRef.current = false;
      return;
    }

    // Same set id can still receive external value updates (session recovery/propagation/reset).
    // Keep drafts aligned unless user is actively editing that field.
    if (!weightDirtyRef.current) {
      weightDraftRef.current = weightDefault;
      weightInputRef.current?.setNativeProps({ text: weightDefault });
    }
    if (!repsDirtyRef.current) {
      repsDraftRef.current = repsDefault;
      repsInputRef.current?.setNativeProps({ text: repsDefault });
    }
  }, [setId, weightDefault, repsDefault]);

  const parseWeightFromDraft = useCallback((): number | null => {
    const cleaned = weightDraftRef.current.replace(',', '.').trim();
    if (cleaned === '') return null;
    const n = parseFloat(cleaned);
    if (Number.isNaN(n) || n < 0) return null;
    return fromDisplayWeight(n, useKg);
  }, [useKg]);

  const parseRepsFromDraft = useCallback((): number | null => {
    const cleaned = repsDraftRef.current.replace(',', '.').trim();
    if (cleaned === '') return null;
    const n = parseFloat(cleaned);
    if (Number.isNaN(n) || n < 0) return null;
    return heroEx.isTimeBased ? n : Math.round(n);
  }, [heroEx.isTimeBased]);

  const commitWeight = useCallback(() => {
    if (Date.now() < skipBlurCommitUntilRef.current) return;
    if (!weightDirtyRef.current) return;
    const cleaned = weightDraftRef.current.replace(',', '.').trim();
    const n = parseFloat(cleaned);
    const wLbs = Number.isNaN(n) || n < 0 ? 0 : fromDisplayWeight(n, useKg);
    const parsedReps = parseRepsFromDraft();
    setLocalValues(prev => {
      const reps = parsedReps ?? prev[setId]?.reps ?? heroVals.reps;
      return applyForwardPropagationForExerciseRounds(
        prev,
        heroEx.id,
        heroRound,
        group.totalRounds,
        completedSets,
        setId,
        { weight: wLbs, reps },
      );
    });
    const formatted = formatWeightForLoad(wLbs, useKg);
    weightDraftRef.current = formatted;
    weightDirtyRef.current = false;
    weightInputRef.current?.setNativeProps({ text: formatted });
  }, [
    useKg,
    setId,
    setLocalValues,
    heroVals.reps,
    heroEx.id,
    heroRound,
    group.totalRounds,
    completedSets,
    parseRepsFromDraft,
  ]);

  const commitReps = useCallback(() => {
    if (Date.now() < skipBlurCommitUntilRef.current) return;
    if (!repsDirtyRef.current) return;
    const cleaned = repsDraftRef.current.replace(',', '.').trim();
    const n = parseFloat(cleaned);
    let r = 0;
    if (!Number.isNaN(n) && n >= 0) {
      r = heroEx.isTimeBased ? n : Math.round(n);
    }
    const parsedWeight = parseWeightFromDraft();
    setLocalValues(prev => {
      // Keep current card weight stable when reps are edited; only override if user entered a valid weight draft.
      const w = parsedWeight ?? prev[setId]?.weight ?? heroW;
      return applyForwardPropagationForExerciseRounds(
        prev,
        heroEx.id,
        heroRound,
        group.totalRounds,
        completedSets,
        setId,
        { weight: w, reps: r },
      );
    });
    const formatted = heroEx.isTimeBased ? String(r) : String(Math.round(r));
    repsDraftRef.current = formatted;
    repsDirtyRef.current = false;
    repsInputRef.current?.setNativeProps({ text: formatted });
  }, [
    setId,
    setLocalValues,
    heroEx.isTimeBased,
    heroEx.id,
    heroW,
    heroRound,
    group.totalRounds,
    completedSets,
    parseWeightFromDraft,
  ]);

  const commitBothDrafts = useCallback(() => {
    // Ignore trailing blur commits fired by input focus changes during CTA taps.
    skipBlurCommitUntilRef.current = Date.now() + 400;
    const parsedWeight = parseWeightFromDraft();
    const parsedReps = parseRepsFromDraft();
    const effectiveParsedWeight = weightDirtyRef.current ? parsedWeight : null;
    const effectiveParsedReps = repsDirtyRef.current ? parsedReps : null;
    setLocalValues(prev => {
      const w = effectiveParsedWeight ?? prev[setId]?.weight ?? heroW;
      const r = effectiveParsedReps ?? prev[setId]?.reps ?? heroR;
      return applyForwardPropagationForExerciseRounds(
        prev,
        heroEx.id,
        heroRound,
        group.totalRounds,
        completedSets,
        setId,
        { weight: w, reps: r },
      );
    });
    weightDirtyRef.current = false;
    repsDirtyRef.current = false;
    return {
      weight: effectiveParsedWeight ?? heroW,
      reps: effectiveParsedReps ?? heroR,
    };
  }, [
    setLocalValues,
    setId,
    parseWeightFromDraft,
    parseRepsFromDraft,
    heroW,
    heroR,
    heroEx.id,
    heroRound,
    group.totalRounds,
    completedSets,
  ]);

  useEffect(() => {
    commitsRef.current[setId] = commitBothDrafts;
    return () => {
      delete commitsRef.current[setId];
    };
  }, [setId, commitBothDrafts, commitsRef]);

  const _barbellMode = getBarbellMode(heroEx.id);
  const weightPerSideLbs = heroW > 45 ? (heroW - 45) / 2 : null;
  const perSideText =
    weightPerSideLbs != null && weightPerSideLbs > 0
      ? `${formatWeightForLoad(weightPerSideLbs, useKg)}/side`
      : null;
  const prog = progressionValuesByItemId[heroEx.id];

  return (
    <View style={[styles.carouselPage, pageWidth > 0 ? { width: pageWidth } : { flex: 1 }]}>
      <View style={styles.valuesBlock}>
        <View style={styles.valueRow}>
          <TextInput
            ref={weightInputRef}
            key={`${setId}-weight`}
            style={[styles.valueInput, { color: heroValueColor }]}
            allowFontScaling={false}
            maxFontSizeMultiplier={1}
            defaultValue={weightDefault}
            onChangeText={t => {
              weightDraftRef.current = t;
              weightDirtyRef.current = true;
            }}
            onBlur={commitWeight}
            keyboardType="decimal-pad"
            selectTextOnFocus
            editable={metricsEditable}
            placeholder="0"
            placeholderTextColor={heroValueColor}
            underlineColorAndroid="transparent"
          />
          <View style={styles.unitWithDelta}>
            <View style={styles.unitLabelRow}>
              <Text style={[styles.valueMetric, { color: unitLabelColor }]}>{weightUnit}</Text>
              {prog && prog.weightDelta > 0 ? (
                <Text style={[styles.heroDeltaLabel, { color: heroValueColor }]} numberOfLines={1}>
                  ↑
                </Text>
              ) : null}
            </View>
            {perSideText ? (
              <Text style={[styles.perSideSingleLine, { color: perSideLabelColor }]}>{perSideText}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.valueRow}>
          <TextInput
            ref={repsInputRef}
            key={`${setId}-reps`}
            style={[styles.valueInput, { color: heroValueColor }]}
            allowFontScaling={false}
            maxFontSizeMultiplier={1}
            defaultValue={repsDefault}
            onChangeText={t => {
              repsDraftRef.current = t;
              repsDirtyRef.current = true;
            }}
            onBlur={commitReps}
            keyboardType={heroEx.isTimeBased ? 'decimal-pad' : 'number-pad'}
            selectTextOnFocus
            editable={metricsEditable}
            placeholder="0"
            placeholderTextColor={heroValueColor}
            underlineColorAndroid="transparent"
          />
          <View style={styles.unitWithDelta}>
            <View style={styles.unitLabelRow}>
              <Text style={[styles.valueMetric, { color: unitLabelColor }]}>
                {heroEx.isTimeBased ? 'sec' : 'reps'}
              </Text>
              {prog && prog.repsDelta > 0 ? (
                <Text style={[styles.heroDeltaLabel, { color: heroValueColor }]} numberOfLines={1}>
                  ↑
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export function ExploreV2CurrentCard({
  group,
  primaryRevealed,
  currentRounds: _currentRounds,
  completedSets,
  getSetDisplayValues,
  localValues,
  setLocalValues,
  useKg,
  weightUnit,
  getBarbellMode,
  onLogNextSet,
  onSkipRest,
  exploreV2TimerPhase,
  exploreV2WorkBlueProgress,
  preStart: _preStart,
  onCollapsedPress,
  showPrimaryCta,
  showCollapsedWhenSecondary,
  frontBottomRadius,
  coveredBottomRadius,
  timerThemeActive,
  restThemeProgress,
  settingsOverflow,
  progressionValuesByItemId,
  celebrationProgress,
  celebrationActive = false,
}: Props) {
  const theme = useAppTheme();
  const { explore: ex, colors: themeColors } = theme;
  const isV2Theme = theme.id === 'v2';
  const accentPrimary = themeColors.accentPrimary;
  const accentPrimaryDimmed = themeColors.accentPrimaryDimmed;
  const accentSecondarySoft = themeColors.accentSecondarySoft;
  const accentSecondaryDisabled = themeColors.accentSecondaryDisabled;
  const containerTertiary = themeColors.containerTertiary;
  const skipRestCtaBg = ex.skipRestCtaBg;
  const ctaPillLabelInk = ex.ctaPillText;
  const isPrimary = primaryRevealed === 'current';
  const [drawerSlotHeight, setDrawerSlotHeight] = useState(0);
  const bottomCornerRadius = isPrimary ? frontBottomRadius : coveredBottomRadius;

  const orderedSlots = useMemo(() => buildOrderedSetSlots(group), [group]);
  const nextIncomplete = useMemo(() => findNextIncompleteSet(group, completedSets), [group, completedSets]);
  const nextIncompleteIndex = useMemo(() => {
    if (!nextIncomplete) return -1;
    return orderedSlots.findIndex(
      s => s.round === nextIncomplete.round && s.exerciseIndex === nextIncomplete.exerciseIndex,
    );
  }, [orderedSlots, nextIncomplete]);

  const [carouselIndex, setCarouselIndex] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const carouselViewportWidth = Math.max(0, pageWidth - pad.horizontal - 24);
  const scrollRef = useRef<ScrollView>(null);
  const commitsRef = useRef<Record<string, () => { weight: number; reps: number } | void>>({});
  const prevIncompleteKeyRef = useRef<string | null>(null);

  const groupHasStarted = useMemo(
    () => group.exercises.some(ex => completedSets.has(`${ex.id}-set-0`)),
    [group, completedSets],
  );

  const activeSlot = orderedSlots[carouselIndex] ?? orderedSlots[0];
  const displayExerciseName = useMemo(() => {
    if (!activeSlot) return group.exercises.map(e => e.exerciseName).join(' + ');
    const ex = group.exercises[activeSlot.exerciseIndex];
    if (ex?.exerciseName) return ex.exerciseName;
    return group.exercises.map(e => e.exerciseName).join(' + ');
  }, [activeSlot, group.exercises]);

  const activeHeroEx = activeSlot ? group.exercises[activeSlot.exerciseIndex] : group.exercises[0];
  const activeSetId = activeSlot && activeHeroEx ? `${activeHeroEx.id}-set-${activeSlot.round}` : '';
  const activeSetValues = useMemo(() => {
    if (!activeHeroEx || !activeSlot) return undefined;
    const defaults = getSetDisplayValues(
      activeHeroEx.id,
      activeSlot.round,
      activeHeroEx.weight ?? 0,
      Number(activeHeroEx.reps) ?? 0,
    );
    return localValues[activeSetId] ?? defaults;
  }, [activeHeroEx, activeSlot, getSetDisplayValues, localValues, activeSetId]);

  useEffect(() => {
    if (carouselViewportWidth <= 0 || orderedSlots.length === 0) return;
    const key = nextIncomplete ? slotKey(nextIncomplete) : 'all-done';
    const idx = nextIncompleteIndex >= 0 ? nextIncompleteIndex : 0;

    if (prevIncompleteKeyRef.current === null) {
      prevIncompleteKeyRef.current = key;
      setCarouselIndex(idx);
      scrollRef.current?.scrollTo({ x: idx * carouselViewportWidth, animated: false });
      return;
    }

    if (prevIncompleteKeyRef.current !== key) {
      prevIncompleteKeyRef.current = key;
      if (nextIncompleteIndex >= 0) {
        setCarouselIndex(nextIncompleteIndex);
        scrollRef.current?.scrollTo({ x: nextIncompleteIndex * carouselViewportWidth, animated: true });
      }
    }
  }, [carouselViewportWidth, nextIncomplete, nextIncompleteIndex, orderedSlots.length]);

  const heroTimerActive = exploreV2TimerPhase !== 'none';
  const ctaLabel =
    exploreV2TimerPhase === 'rest'
      ? 'Skip rest time'
      : exploreV2TimerPhase === 'work'
        ? 'Skip timer'
        : exploreV2TimerPhase === 'switchSides'
          ? 'Skip'
          : activeHeroEx?.isTimeBased
            ? 'Start timer'
          : !groupHasStarted
            ? 'Log first set'
            : 'Log next set';
  const collapsedSecondary = !isPrimary && showCollapsedWhenSecondary;
  const metricsEditable = isPrimary && !heroTimerActive;

  const logEnabledForSlot =
    nextIncompleteIndex < 0 || carouselIndex === nextIncompleteIndex;
  const inactiveSetPreview = !heroTimerActive && !logEnabledForSlot;
  const useDisabledHeroPalette = heroTimerActive || inactiveSetPreview;
  const heroValueColor = useDisabledHeroPalette ? accentSecondaryDisabled : accentPrimary;
  const heroUnitColor = useDisabledHeroPalette ? accentSecondaryDisabled : accentPrimary;
  const settingsDisabledTone = heroTimerActive ? accentSecondaryDisabled : accentSecondarySoft;
  const currentHeaderInk = isV2Theme ? containerTertiary : accentSecondarySoft;
  const settingsInk = isV2Theme ? containerTertiary : settingsDisabledTone;
  const perSideInk = isV2Theme
    ? containerTertiary
    : (useDisabledHeroPalette ? accentSecondaryDisabled : accentSecondarySoft);
  const inactivePaginationInk = isV2Theme ? containerTertiary : accentSecondarySoft;
  const inactivePaginationInkDisabled = isV2Theme ? containerTertiary : accentSecondaryDisabled;
  const logPressable =
    heroTimerActive || (showPrimaryCta && logEnabledForSlot);

  const settingsDrawerOpen = Boolean(settingsOverflow?.visible && isPrimary);
  const surfaceColor = settingsDrawerOpen ? skipRestCtaBg : ex.surfaceCurrentCard;
  const shellAnimatedStyle = useAnimatedStyle(() => {
    const b = restThemeProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const pRest = b * (1 - w);
    return {
      borderColor: interpolateColor(pRest, [0, 1], [themeColors.canvasLight, accentPrimary]),
    };
  }, [themeColors.canvasLight, accentPrimary]);
  const shellCornerAnimatedStyle = useAnimatedStyle(() => {
    const cp = celebrationProgress?.value ?? 0;
    return {
      borderTopLeftRadius: interpolate(cp, [0, 1], [EXPLORE_V2.cardTopRadius, 10]),
      borderTopRightRadius: interpolate(cp, [0, 1], [EXPLORE_V2.cardTopRadius, 10]),
      borderBottomLeftRadius: interpolate(cp, [0, 1], [bottomCornerRadius, 10]),
      borderBottomRightRadius: interpolate(cp, [0, 1], [bottomCornerRadius, 10]),
    };
  }, [celebrationProgress, bottomCornerRadius]);
  const ctaBgStyle = useAnimatedStyle(() => {
    if (exploreV2TimerPhase === 'rest' || exploreV2TimerPhase === 'work' || exploreV2TimerPhase === 'switchSides') {
      return { backgroundColor: accentPrimary };
    }
    if (inactiveSetPreview) {
      return { backgroundColor: accentSecondaryDisabled };
    }
    return {
      backgroundColor: interpolateColor(restThemeProgress.value, [0, 1], [accentPrimary, accentPrimaryDimmed]),
    };
  }, [exploreV2TimerPhase, inactiveSetPreview, accentPrimary, accentPrimaryDimmed, accentSecondaryDisabled]);
  const ctaLabelStyle = useAnimatedStyle(() => {
    if (exploreV2TimerPhase === 'work' && isPrimary) {
      return { color: themeColors.containerPrimary };
    }
    if (exploreV2TimerPhase === 'rest' && isPrimary) {
      return { color: themeColors.containerPrimary };
    }
    if (exploreV2TimerPhase === 'switchSides' && isPrimary) {
      return { color: themeColors.containerPrimary };
    }
    return {
      color: interpolateColor(restThemeProgress.value, [0, 1], [ctaPillLabelInk, themeColors.canvasLight]),
    };
  }, [exploreV2TimerPhase, isPrimary, themeColors.containerPrimary, themeColors.canvasLight, ctaPillLabelInk]);
  const heroColumnReserveStyle = useAnimatedStyle(() => ({
    marginBottom: 0,
  }));

  const onCarouselScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (carouselViewportWidth <= 0) return;
      const x = e.nativeEvent.contentOffset.x;
      const i = Math.round(x / carouselViewportWidth);
      const clamped = Math.max(0, Math.min(i, orderedSlots.length - 1));
      setCarouselIndex(clamped);
    },
    [carouselViewportWidth, orderedSlots.length],
  );

  const scrollToSetIndex = useCallback(
    (i: number) => {
      if (carouselViewportWidth <= 0) return;
      const clamped = Math.max(0, Math.min(i, orderedSlots.length - 1));
      setCarouselIndex(clamped);
      scrollRef.current?.scrollTo({ x: clamped * carouselViewportWidth, animated: true });
    },
    [carouselViewportWidth, orderedSlots.length],
  );

  const onLogPress = useCallback(() => {
    if (heroTimerActive) {
      onSkipRest();
      return;
    }
    const committedValues = activeSetId ? commitsRef.current[activeSetId]?.() : undefined;
    const values = committedValues ?? activeSetValues;
    void onLogNextSet(activeSetId && values ? { setId: activeSetId, values } : undefined);
  }, [heroTimerActive, onSkipRest, activeSetId, onLogNextSet, activeSetValues, carouselIndex, nextIncompleteIndex]);
  const celebrationContentFadeStyle = useAnimatedStyle(() => ({
    opacity: 1 - (celebrationProgress?.value ?? 0),
  }), [celebrationProgress]);
  const celebrationMessageStyle = useAnimatedStyle(() => ({
    opacity: celebrationProgress?.value ?? 0,
    transform: [{ translateY: interpolate(celebrationProgress?.value ?? 0, [0, 1], [12, 0]) }],
  }), [celebrationProgress]);

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
          shellCornerAnimatedStyle,
          {
            backgroundColor: surfaceColor,
            borderBottomLeftRadius: bottomCornerRadius,
            borderBottomRightRadius: bottomCornerRadius,
          },
          collapsedSecondary && styles.collapsedSecondarySurface,
          celebrationActive && styles.celebrationActiveShell,
        ]}
      >
        <Reanimated.View style={[styles.celebrationContentWrap, celebrationContentFadeStyle]}>
        <View style={styles.topBlock}>
          <View style={styles.topBlockContent}>
            <View style={styles.headerBar}>
              <Text
                style={[
                  styles.eyebrow,
                  { color: currentHeaderInk },
                ]}
              >
                Current
              </Text>
              {settingsOverflow && isPrimary ? (
                <UnderlinedActionButton
                  label="Settings"
                  onPress={() => {
                    if (settingsOverflow.visible) settingsOverflow.onClose();
                    else settingsOverflow.onOpenSheet();
                  }}
                  textStyle={[styles.currentSettingsButtonText, { color: settingsInk }]}
                  color={settingsInk}
                  underlineColor={settingsInk}
                />
              ) : null}
            </View>
            <Text style={[styles.exerciseName, { color: currentHeaderInk }]} numberOfLines={2}>
              {displayExerciseName}
            </Text>
          </View>
          {settingsOverflow?.visible && isPrimary ? (
            <Pressable
              style={[StyleSheet.absoluteFillObject, styles.settingsBackdrop]}
              onPress={() => settingsOverflow.onClose()}
              accessibilityRole="button"
              accessibilityLabel="Dismiss settings"
            />
          ) : null}
        </View>

        <View style={styles.heroCtaContainer}>
          <>
              <Reanimated.View style={[styles.heroColumn, heroColumnReserveStyle]}>
                <View style={styles.heroUpper}>
                  <View
                    style={styles.carouselViewport}
                    onLayout={e => {
                      const w = e.nativeEvent.layout.width;
                      if (w > 0 && w !== pageWidth) setPageWidth(w);
                    }}
                  >
                    {orderedSlots.length > 0 && carouselViewportWidth > 0 ? (
                      <ScrollView
                        ref={scrollRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        onMomentumScrollEnd={onCarouselScrollEnd}
                        scrollEventThrottle={16}
                      >
                        {orderedSlots.map(slot => (
                          <CurrentSetHeroPage
                            key={slotKey(slot)}
                            slot={slot}
                            group={group}
                            completedSets={completedSets}
                            getSetDisplayValues={getSetDisplayValues}
                            localValues={localValues}
                            setLocalValues={setLocalValues}
                            useKg={useKg}
                            weightUnit={weightUnit}
                            getBarbellMode={getBarbellMode}
                            metricsEditable={metricsEditable}
                            heroValueColor={heroValueColor}
                            unitLabelColor={heroUnitColor}
                            perSideLabelColor={perSideInk}
                            pageWidth={carouselViewportWidth}
                            commitsRef={commitsRef}
                            progressionValuesByItemId={progressionValuesByItemId}
                          />
                        ))}
                      </ScrollView>
                    ) : null}
                  </View>

                  <View style={styles.footerRow}>
                    <AnimatedTouchableOpacity
                      style={[
                        styles.ctaPill,
                        ctaBgStyle,
                        !logPressable && !inactiveSetPreview && styles.ctaPillDisabled,
                      ]}
                      onPress={onLogPress}
                      disabled={!logPressable}
                      activeOpacity={0.88}
                    >
                      <Reanimated.Text style={[styles.ctaPillText, ctaLabelStyle]}>{ctaLabel}</Reanimated.Text>
                    </AnimatedTouchableOpacity>

                    <View style={styles.paginationWrap}>
                      {orderedSlots.map((slot, i) => {
                        const ex = group.exercises[slot.exerciseIndex];
                        const sid = `${ex.id}-set-${slot.round}`;
                        const done = completedSets.has(sid);
                        const isView = i === carouselIndex;
                        const isNext =
                          nextIncomplete != null &&
                          slot.round === nextIncomplete.round &&
                          slot.exerciseIndex === nextIncomplete.exerciseIndex;
                        return (
                          <TouchableOpacity
                            key={slotKey(slot)}
                            onPress={() => scrollToSetIndex(i)}
                            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                            accessibilityRole="button"
                            accessibilityLabel={`Set ${i + 1}`}
                            accessibilityState={{ selected: isView }}
                          >
                            <View style={styles.paginationItem}>
                              <Text
                                style={[
                                  styles.paginationDigit,
                                  isView && styles.paginationInView,
                                  heroTimerActive
                                    ? {
                                        color: isView
                                          ? accentSecondaryDisabled
                                          : inactivePaginationInkDisabled,
                                      }
                                    : {
                                        color: isView
                                          ? accentPrimary
                                          : inactivePaginationInk,
                                      },
                                ]}
                              >
                                {i + 1}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              </Reanimated.View>

              {settingsOverflow?.visible && isPrimary ? (
                <Pressable
                  style={[StyleSheet.absoluteFillObject, styles.settingsBackdrop]}
                  onPress={() => settingsOverflow.onClose()}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss settings"
                />
              ) : null}

              {settingsOverflow?.visible && isPrimary ? (
                <View
                  style={styles.drawerSlot}
                  pointerEvents="box-none"
                  onLayout={e => setDrawerSlotHeight(e.nativeEvent.layout.height)}
                >
                  {drawerSlotHeight > 0 ? (
                    <ExploreV2CurrentOverflowPanel
                      containerHeight={drawerSlotHeight}
                      interactive={isPrimary}
                      {...settingsOverflow}
                    />
                  ) : null}
                </View>
              ) : null}
          </>
        </View>
        </Reanimated.View>
        <Reanimated.View pointerEvents="none" style={[styles.completionMessageOverlay, celebrationMessageStyle]}>
          <Text style={[styles.completionMessageText, { color: themeColors.canvasLight }]}>Great Job!</Text>
        </Reanimated.View>
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
    paddingTop: EXPLORE_V2.cardHeader.topInset,
    paddingLeft: pad.horizontal,
    paddingRight: 24,
    paddingBottom: 32,
    borderWidth: 2,
    borderColor: 'transparent',
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
  collapsedTapOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
  },
  topBlock: {
    position: 'relative',
    width: '100%',
  },
  topBlockContent: {
    zIndex: 0,
  },
  settingsBackdrop: {
    zIndex: 1,
  },
  headerBar: {
    height: EXPLORE_V2.cardHeader.rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: EXPLORE_V2.cardHeader.rowVerticalPadding,
    width: '100%',
  },
  eyebrow: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  currentSettingsButtonText: {
    ...TYPOGRAPHY.legal,
  },
  exerciseName: {
    ...TYPOGRAPHY.displayLarge,
    fontWeight: '400',
    flexShrink: 1,
    marginTop: 12,
  },
  heroCtaContainer: {
    width: '100%',
    flex: 1,
    flexDirection: 'column',
    minHeight: 0,
    position: 'relative',
  },
  heroColumn: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    justifyContent: 'flex-end',
    zIndex: 0,
  },
  heroUpper: {
    width: '100%',
    flexShrink: 0,
    justifyContent: 'flex-end',
  },
  carouselViewport: {
    width: '100%',
    minHeight: 200,
    marginLeft: -pad.horizontal,
    marginRight: -24,
    paddingLeft: pad.horizontal,
    paddingRight: 24,
  },
  carouselPage: {
    flexShrink: 0,
  },
  drawerSlot: {
    position: 'absolute',
    left: -pad.horizontal,
    right: -24,
    top: 0,
    bottom: -24,
    zIndex: 2,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  valuesBlock: {
    width: '100%',
    paddingTop: 8,
  },
  perSideRow: {
    marginBottom: 0,
  },
  perSideSingleLine: {
    ...TYPOGRAPHY.meta,
    fontWeight: '400',
    marginTop: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'nowrap',
    gap: 8,
    marginBottom: 0,
    overflow: 'visible',
  },
  /** Wraps unit only so ↑ is positioned over this label, not in the gap between weight/reps rows */
  unitWithDelta: {
    paddingTop: 12,
  },
  unitLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  heroDeltaLabel: {
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '500',
    width: 22,
    height: 22,
    textAlign: 'center',
    marginLeft: -4,
    transform: [{ translateY: -1 }],
  },
  valueMetric: {
    ...TYPOGRAPHY.displayLarge,
    fontWeight: '400',
  },
  valueInput: {
    ...TYPOGRAPHY.valueDisplay,
    lineHeight: 132,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    minWidth: 48,
    height: 132,
    textAlignVertical: 'top',
    paddingTop: 4,
    paddingBottom: 0,
    paddingHorizontal: 12,
    marginHorizontal: -12,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 40,
    gap: 12,
  },
  paginationWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    flex: 1,
    gap: 10,
    maxWidth: '52%',
  },
  paginationItem: {
    position: 'relative',
    alignItems: 'center',
  },
  paginationDigit: {
    ...TYPOGRAPHY.legal,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 18,
    textAlign: 'center',
  },
  paginationInView: {
    fontWeight: '600',
  },
  ctaPill: {
    paddingVertical: 17,
    paddingHorizontal: 32,
    borderRadius: 14,
    flexShrink: 0,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
  },
  ctaPillDisabled: {
    opacity: 0.45,
  },
  ctaPillText: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  completionMessageOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationContentWrap: {
    flex: 1,
    minHeight: 0,
  },
  completionMessageText: {
    ...TYPOGRAPHY.h1,
    fontWeight: '400',
  },
  celebrationActiveShell: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
});
