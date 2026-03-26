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
import { COLORS, TYPOGRAPHY } from '../../constants';
import { formatWeightForLoad, fromDisplayWeight } from '../../utils/weight';
import { applyForwardPropagationForExerciseRounds } from '../../utils/exerciseLocalValues';
import type { ExploreV2Group, PrimaryRevealedCard } from './exploreV2Types';
import {
  ExploreV2CurrentOverflowPanel,
  EXPLORE_V2_CURRENT_SETTINGS_COLLAPSED_STACK_H,
  EXPLORE_V2_CURRENT_SETTINGS_HERO_GAP,
  type ExploreV2CurrentSettingsOverflowProps,
} from './ExploreV2CurrentOverflowSheet';

const CANVAS_INK = '#F5F4F4';
const VALUE_INK = '#FFA424';
const UNIT_INK = '#464646';
/** “Skip rest time” CTA pill — solid dark so orange label stays legible */
const SKIP_REST_CTA_BG = '#161616';

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
  onLogNextSet: () => Promise<void>;
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
  pageWidth: number;
  commitsRef: React.MutableRefObject<Record<string, () => void>>;
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

  const prevSetIdForInputsRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevSetIdForInputsRef.current === setId) return;
    prevSetIdForInputsRef.current = setId;
    weightDraftRef.current = weightDefault;
    repsDraftRef.current = repsDefault;
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
    const cleaned = repsDraftRef.current.replace(',', '.').trim();
    const n = parseFloat(cleaned);
    let r = 0;
    if (!Number.isNaN(n) && n >= 0) {
      r = heroEx.isTimeBased ? n : Math.round(n);
    }
    const parsedWeight = parseWeightFromDraft();
    setLocalValues(prev => {
      const w = parsedWeight ?? prev[setId]?.weight ?? heroVals.weight;
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
    repsInputRef.current?.setNativeProps({ text: formatted });
  }, [
    setId,
    setLocalValues,
    heroEx.isTimeBased,
    heroEx.id,
    heroVals.weight,
    heroRound,
    group.totalRounds,
    completedSets,
    parseWeightFromDraft,
  ]);

  useEffect(() => {
    const flush = () => {
      commitWeight();
      commitReps();
    };
    commitsRef.current[setId] = flush;
    return () => {
      delete commitsRef.current[setId];
    };
  }, [setId, commitWeight, commitReps, commitsRef]);

  const _barbellMode = getBarbellMode(heroEx.id);
  const weightPerSideLbs = heroW > 45 ? (heroW - 45) / 2 : null;
  const showPerSideRow = weightPerSideLbs != null && weightPerSideLbs > 0;
  const prog = progressionValuesByItemId[heroEx.id];

  return (
    <View style={[styles.carouselPage, pageWidth > 0 ? { width: pageWidth } : { flex: 1 }]}>
      <View style={styles.valuesBlock}>
        {showPerSideRow && weightPerSideLbs != null ? (
          <View style={styles.perSideRow}>
            <View style={styles.perSideCluster}>
              <View style={styles.perSideNumUnit}>
                <Text style={[styles.perSideValue, { color: CANVAS_INK }]}>
                  {formatWeightForLoad(weightPerSideLbs, useKg)}
                </Text>
                <Text style={[styles.perSideUnit, { color: CANVAS_INK }]}>{weightUnit}</Text>
              </View>
              <Text style={[styles.perSideLabel, { color: UNIT_INK }]}>weight per side</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.valueRow}>
          <TextInput
            ref={weightInputRef}
            key={`${setId}-weight`}
            style={[styles.valueInput, { color: heroValueColor }]}
            defaultValue={weightDefault}
            onChangeText={t => {
              weightDraftRef.current = t;
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
            {prog && prog.weightDelta > 0 ? (
              <Text style={[styles.heroDeltaLabel, { color: heroValueColor }]} numberOfLines={1}>
                ↑
              </Text>
            ) : null}
            <Text style={[styles.valueMetric, { color: UNIT_INK }]}>{weightUnit}</Text>
          </View>
        </View>
        <View style={styles.valueRow}>
          <TextInput
            ref={repsInputRef}
            key={`${setId}-reps`}
            style={[styles.valueInput, { color: heroValueColor }]}
            defaultValue={repsDefault}
            onChangeText={t => {
              repsDraftRef.current = t;
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
            {prog && prog.repsDelta > 0 ? (
              <Text style={[styles.heroDeltaLabel, { color: heroValueColor }]} numberOfLines={1}>
                ↑
              </Text>
            ) : null}
            <Text style={[styles.valueMetric, { color: UNIT_INK }]}>
              {heroEx.isTimeBased ? 'sec' : 'reps'}
            </Text>
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
}: Props) {
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
  const scrollRef = useRef<ScrollView>(null);
  const commitsRef = useRef<Record<string, () => void>>({});
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

  useEffect(() => {
    if (pageWidth <= 0 || orderedSlots.length === 0) return;
    const key = nextIncomplete ? slotKey(nextIncomplete) : 'all-done';
    const idx = nextIncompleteIndex >= 0 ? nextIncompleteIndex : 0;

    if (prevIncompleteKeyRef.current === null) {
      prevIncompleteKeyRef.current = key;
      setCarouselIndex(idx);
      scrollRef.current?.scrollTo({ x: idx * pageWidth, animated: false });
      return;
    }

    if (prevIncompleteKeyRef.current !== key) {
      prevIncompleteKeyRef.current = key;
      if (nextIncompleteIndex >= 0) {
        setCarouselIndex(nextIncompleteIndex);
        scrollRef.current?.scrollTo({ x: nextIncompleteIndex * pageWidth, animated: true });
      }
    }
  }, [pageWidth, nextIncomplete, nextIncompleteIndex, orderedSlots.length]);

  const heroTimerActive = exploreV2TimerPhase !== 'none';
  const ctaLabel =
    exploreV2TimerPhase === 'rest'
      ? 'Skip rest time'
      : exploreV2TimerPhase === 'work'
        ? 'Skip timer'
        : exploreV2TimerPhase === 'switchSides'
          ? 'Skip'
          : !groupHasStarted
            ? 'Log first set'
            : 'Log next set';
  const collapsedSecondary = !isPrimary && showCollapsedWhenSecondary;
  const metricsEditable = isPrimary && !heroTimerActive;
  const heroValueColor = heroTimerActive ? '#464646' : VALUE_INK;

  const logEnabledForSlot =
    nextIncompleteIndex < 0 || carouselIndex === nextIncompleteIndex;
  const logPressable =
    heroTimerActive || (showPrimaryCta && logEnabledForSlot);

  const surfaceColor = '#1F1F1F';
  const shellAnimatedStyle = useAnimatedStyle(() => {
    const p = restThemeProgress.value;
    const w = exploreV2WorkBlueProgress.value;
    const activeBorder = interpolateColor(w, [0, 1], ['#FFA424', COLORS.info]);
    return {
      borderColor: interpolateColor(p, [0, 1], [EXPLORE_V2.colors.pageBg, activeBorder]),
    };
  });
  const ctaBgStyle = useAnimatedStyle(() => {
    if (exploreV2TimerPhase === 'rest' || exploreV2TimerPhase === 'work' || exploreV2TimerPhase === 'switchSides') {
      return { backgroundColor: SKIP_REST_CTA_BG };
    }
    return {
      backgroundColor: interpolateColor(restThemeProgress.value, [0, 1], [VALUE_INK, '#464646']),
    };
  }, [exploreV2TimerPhase]);
  const ctaLabelStyle = useAnimatedStyle(() => {
    if (exploreV2TimerPhase === 'work' && isPrimary) {
      return { color: COLORS.info };
    }
    if (exploreV2TimerPhase === 'rest' && isPrimary) {
      return { color: VALUE_INK };
    }
    if (exploreV2TimerPhase === 'switchSides' && isPrimary) {
      return { color: VALUE_INK };
    }
    return {
      color: interpolateColor(restThemeProgress.value, [0, 1], ['#1F1F1F', CANVAS_INK]),
    };
  }, [exploreV2TimerPhase, isPrimary]);
  const heroColumnReserveStyle = useAnimatedStyle(() => {
    const reserve =
      settingsOverflow && isPrimary
        ? EXPLORE_V2_CURRENT_SETTINGS_HERO_GAP + EXPLORE_V2_CURRENT_SETTINGS_COLLAPSED_STACK_H
        : 0;
    return {
      marginBottom: interpolate(restThemeProgress.value, [0, 1], [reserve, 0]),
    };
  }, [settingsOverflow, isPrimary]);

  const onCarouselScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth <= 0) return;
      const x = e.nativeEvent.contentOffset.x;
      const i = Math.round(x / pageWidth);
      const clamped = Math.max(0, Math.min(i, orderedSlots.length - 1));
      setCarouselIndex(clamped);
    },
    [pageWidth, orderedSlots.length],
  );

  const scrollToSetIndex = useCallback(
    (i: number) => {
      if (pageWidth <= 0) return;
      const clamped = Math.max(0, Math.min(i, orderedSlots.length - 1));
      setCarouselIndex(clamped);
      scrollRef.current?.scrollTo({ x: clamped * pageWidth, animated: true });
    },
    [pageWidth, orderedSlots.length],
  );

  const onLogPress = useCallback(() => {
    if (heroTimerActive) {
      onSkipRest();
      return;
    }
    if (activeSetId) commitsRef.current[activeSetId]?.();
    void onLogNextSet();
  }, [heroTimerActive, onSkipRest, activeSetId, onLogNextSet]);

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
        <View style={styles.topBlock}>
          <View style={styles.topBlockContent}>
            <View style={styles.headerBar}>
              <Text style={[styles.eyebrow, { color: CANVAS_INK }]}>Current</Text>
            </View>
            <Text style={[styles.exerciseName, { color: CANVAS_INK }]} numberOfLines={2}>
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
          <Reanimated.View style={[styles.heroColumn, heroColumnReserveStyle]}>
            <View style={styles.heroUpper}>
              <View
                style={styles.carouselViewport}
                onLayout={e => {
                  const w = e.nativeEvent.layout.width;
                  if (w > 0 && w !== pageWidth) setPageWidth(w);
                }}
              >
                {orderedSlots.length > 0 && pageWidth > 0 ? (
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
                        pageWidth={pageWidth}
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
                    !logPressable && styles.ctaPillDisabled,
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
                              !isView && done && styles.paginationDone,
                              !isView && !done && styles.paginationDefault,
                            ]}
                          >
                            {i + 1}
                          </Text>
                          {isNext ? (
                            <View style={styles.paginationNextDotWrap} pointerEvents="none">
                              <View style={styles.paginationNextDot} />
                            </View>
                          ) : null}
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

          {settingsOverflow && isPrimary ? (
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
    paddingBottom: 24,
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
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
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
  },
  perSideRow: {
    marginBottom: 0,
  },
  perSideCluster: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 3,
  },
  perSideNumUnit: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  perSideValue: {
    ...TYPOGRAPHY.body,
    fontWeight: '400',
  },
  perSideUnit: {
    ...TYPOGRAPHY.body,
    fontWeight: '400',
  },
  perSideLabel: {
    ...TYPOGRAPHY.body,
    fontWeight: '400',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'nowrap',
    gap: 2,
    marginBottom: 0,
  },
  /** Wraps unit only so ↑ is positioned over this label, not in the gap between weight/reps rows */
  unitWithDelta: {
    position: 'relative',
  },
  heroDeltaLabel: {
    position: 'absolute',
    top: 36,
    right: -12,
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '700',
  },
  valueMetric: {
    fontSize: 80,
    fontWeight: '400',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  valueInput: {
    fontSize: 80,
    fontWeight: '400',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    minWidth: 48,
    padding: 0,
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
  /** Out of layout flow so row alignment uses digit baselines only */
  paginationNextDotWrap: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    alignItems: 'center',
  },
  paginationNextDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  paginationDigit: {
    ...TYPOGRAPHY.legal,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 18,
    textAlign: 'center',
  },
  paginationDefault: {
    color: 'rgba(245,244,244,0.45)',
  },
  paginationDone: {
    color: 'rgba(245,244,244,0.32)',
  },
  paginationInView: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  ctaPill: {
    paddingVertical: 17,
    paddingHorizontal: 32,
    borderRadius: 14,
    backgroundColor: VALUE_INK,
    flexShrink: 0,
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
});
