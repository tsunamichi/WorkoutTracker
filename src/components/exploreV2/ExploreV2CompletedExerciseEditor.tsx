import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Keyboard,
  InputAccessoryView,
  Platform,
  TouchableOpacity,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Reanimated, { useAnimatedStyle, interpolateColor, type SharedValue } from 'react-native-reanimated';
import { EXPLORE_V2 } from './exploreV2Tokens';
import { BORDER_RADIUS, COLORS, TYPOGRAPHY } from '../../constants';
import { EXECUTION_CTA_HEIGHT, EXECUTION_CTA_PADDING_H, executionCtaLabelStyle } from '../execution/executionCtaTokens';
import { useAppTheme } from '../../theme/useAppTheme';
import { useTranslation } from '../../i18n/useTranslation';
import type { ExploreV2Group } from './exploreV2Types';
import { CurrentSetHeroPage } from './ExploreV2CurrentCard';
import { UnderlinedActionButton } from '../common/UnderlinedActionButton';
import { IconAdd } from '../icons';

const AnimatedTouchableOpacity = Reanimated.createAnimatedComponent(TouchableOpacity);

const pad = EXPLORE_V2.cardPadding;

/** Same as Completed list row units (`ExploreV2CompleteCard` / `completedUnitAnimatedStyle`). */
const IDLE_UNIT_INK = '#787878';

/** Distinct from Current card so two InputAccessoryViews never share a nativeID when both layers mount. */
export const EXPLORE_V2_COMPLETED_HERO_METRICS_ACCESSORY_ID = 'exploreV2CompletedHeroMetricsAccessory';

type SetSlot = { round: number; exerciseIndex: number };

function slotKey(slot: SetSlot): string {
  return `${slot.round}-${slot.exerciseIndex}`;
}

export type ExploreV2CompletedExerciseEditorRef = {
  commitPendingDrafts: () => void;
};

type Props = {
  group: ExploreV2Group;
  exerciseIndex: number;
  completedSets: Set<string>;
  getSetDisplayValues: (exerciseId: string, round: number, w: number, r: number) => { weight: number; reps: number };
  localValues: Record<string, { weight: number; reps: number }>;
  setLocalValues: React.Dispatch<React.SetStateAction<Record<string, { weight: number; reps: number }>>>;
  useKg: boolean;
  weightUnit: string;
  getBarbellMode: (id: string) => boolean;
  progressionValuesByItemId: Record<
    string,
    { weight: number; reps: number; weightDelta: number; repsDelta: number }
  >;
  /** When false, omit the exercise name heading (e.g. content-only layout shows it in the top bar). */
  showExerciseTitle?: boolean;
  /** Same shared values as `ExploreV2CompleteCard` so hero colors track the list row + unit tokens. */
  restThemeProgress: SharedValue<number>;
  exploreV2WorkBlueProgress: SharedValue<number>;
  menuToneProgress: SharedValue<number>;
  /** Commits drafts, dismisses keyboard, and closes inline edit (same as former header Done). */
  onSave: () => void;
  /** Wallet / timer menu colorway (matches Current card). */
  menuThemeActive?: boolean;
  /** Rest timer band — dims chrome; blocks add/remove like Current. */
  timerThemeActive?: boolean;
  /** Main workout: add/remove rounds for this group (template + snapshot). */
  onAdjustGroupSets?: (delta: 1 | -1) => void | Promise<void>;
};

export const ExploreV2CompletedExerciseEditor = forwardRef<ExploreV2CompletedExerciseEditorRef, Props>(
  function ExploreV2CompletedExerciseEditor(
    {
      group,
      exerciseIndex,
      completedSets,
      getSetDisplayValues,
      localValues,
      setLocalValues,
      useKg,
      weightUnit,
      getBarbellMode,
      progressionValuesByItemId,
      showExerciseTitle = true,
      restThemeProgress,
      exploreV2WorkBlueProgress,
      menuToneProgress,
      onSave,
      menuThemeActive = false,
      timerThemeActive = false,
      onAdjustGroupSets,
    },
    ref,
  ) {
    const { t } = useTranslation();
    const theme = useAppTheme();
    const { explore: ex, colors: themeColors } = theme;
    const containerPrimary = themeColors.containerPrimary;
    const containerTertiary = themeColors.containerTertiary;
    const menuMutedInk = themeColors.textMeta;
    const pageBgChrome = themeColors.canvasLight;
    const restCompletedUnitInk = ex.restTimerCompletedUnitInk;
    const textMetaPlaceholder = themeColors.textMeta;
    const upNextBaseBg = themeColors.containerSecondary;
    const amberBand = ex.amberBand;
    const workUpNextBg = ex.workTimerUpNextCardBg;
    const menuMutedBg = '#CFC9CC';
    const isV2Theme = theme.id === 'v2';
    const accentSecondarySoft = themeColors.accentSecondarySoft;
    const accentSecondaryDisabled = themeColors.accentSecondaryDisabled;
    const EXPLORE_V2_MAX_GROUP_SETS = 30;
    const metricsEditable = !timerThemeActive;
    const canRemoveSet = group.totalRounds > 1;
    const canAddSet = group.totalRounds < EXPLORE_V2_MAX_GROUP_SETS;
    /** Plus icon: idle unselected hue — not tied to preview/slide (matches Current card). */
    const addSetPlusIconInk = menuThemeActive
      ? menuMutedInk
      : timerThemeActive
        ? (isV2Theme ? containerTertiary : accentSecondaryDisabled)
        : (isV2Theme ? containerTertiary : accentSecondarySoft);
    const removeSetLinkInk = menuThemeActive
      ? menuMutedInk
      : isV2Theme
        ? containerTertiary
        : accentSecondarySoft;

    const [keyboardBottomInset, setKeyboardBottomInset] = useState(0);
    useEffect(() => {
      const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
      const onShow = (e: { endCoordinates: { height: number } }) =>
        setKeyboardBottomInset(e.endCoordinates.height);
      const onHide = () => setKeyboardBottomInset(0);
      const subShow = Keyboard.addListener(showEvent, onShow);
      const subHide = Keyboard.addListener(hideEvent, onHide);
      return () => {
        subShow.remove();
        subHide.remove();
      };
    }, []);

    const orderedSlots = useMemo((): SetSlot[] => {
      const slots: SetSlot[] = [];
      for (let r = 0; r < group.totalRounds; r++) {
        slots.push({ round: r, exerciseIndex });
      }
      return slots;
    }, [group.totalRounds, exerciseIndex]);

    const heroEx = group.exercises[exerciseIndex];
    const displayExerciseName = heroEx?.exerciseName ?? '';

    const [carouselIndex, setCarouselIndex] = useState(0);
    const [pageWidth, setPageWidth] = useState(0);
    const carouselViewportWidth = Math.max(0, pageWidth);
    const scrollRef = useRef<ScrollView>(null);
    const commitsRef = useRef<Record<string, () => { weight: number; reps: number } | void>>({});

    const commitPendingDrafts = useCallback(() => {
      for (const slot of orderedSlots) {
        const ex = group.exercises[slot.exerciseIndex];
        if (!ex) continue;
        const setId = `${ex.id}-set-${slot.round}`;
        commitsRef.current[setId]?.();
      }
    }, [orderedSlots, group.exercises]);

    useImperativeHandle(ref, () => ({ commitPendingDrafts }), [commitPendingDrafts]);

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

    const showRemoveSetRow =
      Boolean(onAdjustGroupSets) &&
      metricsEditable &&
      orderedSlots.length > 0 &&
      carouselIndex === orderedSlots.length - 1;
    const showAddSetIcon = Boolean(onAdjustGroupSets) && orderedSlots.length > 0;
    const addSetPressable = metricsEditable && canAddSet;

    /** Matches `rowTitleInkStyle` on `ExploreV2CompleteCard` (exercise name + logged numerals). */
    const rowTitleInkAnimatedStyle = useAnimatedStyle(
      () => ({
        color: interpolateColor(
          menuToneProgress.value,
          [0, 1],
          [
            interpolateColor(exploreV2WorkBlueProgress.value, [0, 1], [containerPrimary, pageBgChrome]),
            menuMutedInk,
          ],
        ),
      }),
      [containerPrimary, pageBgChrome, menuMutedInk],
    );

    /** Save pill fill: same color pipeline as completed **value** numerals (`rowTitleInkStyle`). */
    const savePillBackgroundAnimatedStyle = useAnimatedStyle(
      () => ({
        backgroundColor: interpolateColor(
          menuToneProgress.value,
          [0, 1],
          [
            interpolateColor(exploreV2WorkBlueProgress.value, [0, 1], [containerPrimary, pageBgChrome]),
            menuMutedInk,
          ],
        ),
      }),
      [containerPrimary, pageBgChrome, menuMutedInk],
    );

    /** Save label: same color pipeline as completed **card** scroll fill (`scrollContentAnimatedStyle`). */
    const savePillLabelAnimatedStyle = useAnimatedStyle(
      () => {
        const b = restThemeProgress.value;
        const w = exploreV2WorkBlueProgress.value;
        const whenUpBg = interpolateColor(w, [0, 1], [amberBand, workUpNextBg]);
        const baseBg = interpolateColor(b, [0, 1], [upNextBaseBg, whenUpBg]);
        return {
          color: interpolateColor(menuToneProgress.value, [0, 1], [baseBg, menuMutedBg]),
        };
      },
      [upNextBaseBg, amberBand, workUpNextBg, menuMutedBg],
    );

    /** Matches `completedUnitAnimatedStyle` on `ExploreV2CompleteCard` (lbs / reps labels in the log). */
    const completedUnitInkAnimatedStyle = useAnimatedStyle(
      () => {
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
      },
      [restCompletedUnitInk, pageBgChrome, menuMutedInk],
    );

    /** Bottom inset for completed-card edit shell (`48 + keyboard` when metrics are focused). */
    const shellKeyboardPaddingBottom = 48 + keyboardBottomInset;

    if (!heroEx) {
      return null;
    }

    return (
      <View style={[styles.root, { paddingBottom: shellKeyboardPaddingBottom }]}>
        {showExerciseTitle ? (
          <Reanimated.Text style={[styles.exerciseTitle, rowTitleInkAnimatedStyle]} numberOfLines={2}>
            {displayExerciseName}
          </Reanimated.Text>
        ) : null}

        {/* Same vertical structure as `ExploreV2CurrentCard` hero: fill remaining height, pin metrics + CTA row to bottom */}
        <View style={styles.heroCtaContainer}>
          <View style={styles.heroColumn}>
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
                        metricsEditable
                        heroValueColor={containerPrimary}
                        unitLabelColor={themeColors.textMeta}
                        heroValueAnimatedStyle={rowTitleInkAnimatedStyle}
                        unitLabelAnimatedStyle={completedUnitInkAnimatedStyle}
                        heroPlaceholderColor={textMetaPlaceholder}
                        perSideLabelColor={containerTertiary}
                        pageWidth={carouselViewportWidth}
                        commitsRef={commitsRef}
                        progressionValuesByItemId={progressionValuesByItemId}
                        heroMetricsAccessoryId={EXPLORE_V2_COMPLETED_HERO_METRICS_ACCESSORY_ID}
                      />
                    ))}
                  </ScrollView>
                ) : null}
              </View>

              <View style={styles.footerRow}>
                <AnimatedTouchableOpacity
                  style={[styles.ctaPill, savePillBackgroundAnimatedStyle]}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    Keyboard.dismiss();
                    onSave();
                  }}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel={t('save')}
                >
                  <Reanimated.Text style={[styles.ctaPillText, savePillLabelAnimatedStyle]}>{t('save')}</Reanimated.Text>
                </AnimatedTouchableOpacity>
                <View style={styles.paginationColumn}>
                  {showRemoveSetRow ? (
                    <View style={styles.setAdjustRowAbs} pointerEvents="box-none">
                      <UnderlinedActionButton
                        label={t('exploreV2RemoveSet')}
                        onPress={() => {
                          if (canRemoveSet) void onAdjustGroupSets?.(-1);
                        }}
                        color={removeSetLinkInk}
                        underlineColor={removeSetLinkInk}
                        style={[styles.setAdjustButton, !canRemoveSet && styles.setAdjustButtonDimmed]}
                      />
                    </View>
                  ) : null}
                  <View style={styles.paginationWrap}>
                    {orderedSlots.map((slot, i) => {
                      const isView = i === carouselIndex;
                      const digitColor = menuThemeActive
                        ? menuMutedInk
                        : timerThemeActive
                          ? isView
                            ? accentSecondaryDisabled
                            : isV2Theme
                              ? containerTertiary
                              : accentSecondaryDisabled
                          : isView
                            ? containerPrimary
                            : textMetaPlaceholder;
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
                                { color: digitColor },
                              ]}
                            >
                              {i + 1}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                    {showAddSetIcon ? (
                      <TouchableOpacity
                        onPress={() => {
                          if (addSetPressable) void onAdjustGroupSets?.(1);
                        }}
                        disabled={!addSetPressable}
                        style={[styles.addSetIconButton, !addSetPressable && styles.addSetIconButtonDimmed]}
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        accessibilityRole="button"
                        accessibilityLabel={t('exploreV2AddSet')}
                        accessibilityState={{ disabled: !addSetPressable }}
                      >
                        <IconAdd size={22} color={addSetPlusIconInk} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {Platform.OS === 'ios' ? (
          <InputAccessoryView nativeID={EXPLORE_V2_COMPLETED_HERO_METRICS_ACCESSORY_ID}>
            <View style={styles.heroMetricsKeyboardAccessory}>
              <TouchableOpacity
                style={styles.heroMetricsKeyboardDone}
                onPress={() => Keyboard.dismiss()}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t('done')}
              >
                <Text style={styles.heroMetricsKeyboardDoneText}>{t('done')}</Text>
              </TouchableOpacity>
            </View>
          </InputAccessoryView>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  exerciseTitle: {
    ...TYPOGRAPHY.h2,
    fontWeight: '400',
    marginBottom: 8,
    flexShrink: 0,
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
    alignSelf: 'stretch',
    minHeight: 200,
    marginLeft: -pad.horizontal,
    marginRight: -pad.horizontal,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 24,
    gap: 12,
  },
  ctaPill: {
    height: EXECUTION_CTA_HEIGHT,
    minHeight: EXECUTION_CTA_HEIGHT,
    paddingHorizontal: EXECUTION_CTA_PADDING_H,
    borderRadius: 14,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
  },
  ctaPillText: {
    ...executionCtaLabelStyle,
    letterSpacing: 0.2,
  },
  paginationColumn: {
    position: 'relative',
    flex: 1,
    maxWidth: '52%',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  setAdjustRowAbs: {
    position: 'absolute',
    right: 0,
    bottom: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    zIndex: 4,
  },
  setAdjustButton: {
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  setAdjustButtonDimmed: {
    opacity: 0.35,
  },
  paginationWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
  },
  paginationItem: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationDigit: {
    ...TYPOGRAPHY.legal,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 18,
    textAlign: 'center',
    lineHeight: 22,
    ...(Platform.OS === 'android' ? { includeFontPadding: false as const } : {}),
  },
  paginationInView: {
    fontWeight: '600',
  },
  addSetIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 22,
  },
  addSetIconButtonDimmed: {
    opacity: 0.35,
  },
  heroMetricsKeyboardAccessory: {
    backgroundColor: COLORS.backgroundCanvas,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'flex-end',
  },
  heroMetricsKeyboardDone: {
    backgroundColor: COLORS.accentPrimary,
    borderRadius: BORDER_RADIUS.md,
    height: EXECUTION_CTA_HEIGHT,
    minHeight: EXECUTION_CTA_HEIGHT,
    paddingHorizontal: EXECUTION_CTA_PADDING_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMetricsKeyboardDoneText: {
    ...executionCtaLabelStyle,
    color: '#FFFFFF',
  },
});
