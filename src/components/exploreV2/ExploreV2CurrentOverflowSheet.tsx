import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Pressable,
  Platform,
  Animated,
  Easing as AnimatedEasing,
} from 'react-native';
import Reanimated, {
  Easing,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Toggle } from '../Toggle';
import { EXPLORE_V2 } from './exploreV2Tokens';
import dayjs from 'dayjs';
import { COLORS, SPACING, TYPOGRAPHY } from '../../constants';
import { useAppTheme } from '../../theme/useAppTheme';
import { formatWeightForLoad } from '../../utils/weight';
import type { ExploreV2Exercise } from './exploreV2Types';
import { useTranslation } from '../../i18n/useTranslation';

const PANEL_TOP_RADIUS = 16;
const DRAWER_TOP_DIVIDER_H = 1;
/** Settings header row (Settings + chevron) */
const DRAWER_HEADER_ROW_H = 48;
/** When rest timer is visible, push drawer down out of frame. */
const REST_TIMER_DRAWER_OFFSET = 56;
/** Space above “Settings” / label row */
const HEADER_PADDING_TOP = 0;
/**
 * Collapsed drawer: full soft panel height (divider + header row).
 * 49 = 1 + 48
 */
const COLLAPSED_SHELL_H = DRAWER_TOP_DIVIDER_H + DRAWER_HEADER_ROW_H;
/** Divider + expanded header row (before scroll body). */
const EXPANDED_TOP_STACK_H = DRAWER_TOP_DIVIDER_H + HEADER_PADDING_TOP + DRAWER_HEADER_ROW_H;
/** Collapsed strip sits 16px above the slot bottom; expanded is flush (0). */
const COLLAPSED_BOTTOM_OFFSET = 16;

/** Gap between hero (values + Log) and the top of the settings drawer (divider). */
export const EXPLORE_V2_CURRENT_SETTINGS_HERO_GAP = 24;

/** Vertical space from divider line down to the bottom of the drawer slot (collapsed). */
export const EXPLORE_V2_CURRENT_SETTINGS_COLLAPSED_STACK_H =
  COLLAPSED_BOTTOM_OFFSET + COLLAPSED_SHELL_H;

/** Horizontal inset + full-bleed math for settings body / actions row */
const CONTENT_PAD_H = 24;

function progressionPillLabel(name: string): string {
  const s = name.replace(/^Main\s+/i, '').replace(/\bAccessories\b/g, 'Accessory').trim();
  return s.length > 0 ? s : name;
}

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

export type ExerciseDrawerHistoryEntry = {
  date: string;
  sets: Array<{ setNumber: number; weight: number; reps: number }>;
};

export type ExploreV2CurrentSettingsOverflowProps = {
  visible: boolean;
  onClose: () => void;
  onOpenSheet: () => void;
  exercise: ExploreV2Exercise;
  templateItemId: string;
  libraryExerciseId: string | undefined;
  /** Sorted oldest → newest (same source as legacy drawer); panel ignores today and shows last prior day. */
  history: ExerciseDrawerHistoryEntry[];
  useKg: boolean;
  weightUnit: string;
  timeBased: boolean;
  onTimeBasedChange: (v: boolean) => void;
  perSide: boolean;
  onPerSideChange: (v: boolean) => void;
  progressionGroups: Array<{ id: string; name: string; exerciseIds: string[] }>;
  currentProgressionGroupId: string | null;
  onProgressionGroupSelect: (groupId: string | null) => void | Promise<void>;
  onSwap: () => void;
  onDelete: () => void;
  type: 'warmup' | 'main' | 'core';
  /** When rest timer starts, drawer collapses with animation then onClose runs (parent must not flip visible first). */
  inlineRestActive: boolean;
  /** Shared rest transition driver so drawer and hero reserve move in sync. */
  restThemeProgress: SharedValue<number>;
};

type PanelProps = ExploreV2CurrentSettingsOverflowProps & {
  containerHeight: number;
  interactive?: boolean;
};

export function ExploreV2CurrentOverflowPanel({
  containerHeight,
  visible,
  onClose,
  onOpenSheet,
  exercise: _exercise,
  templateItemId: _templateItemId,
  libraryExerciseId: _libraryExerciseId,
  history,
  useKg,
  weightUnit,
  timeBased,
  onTimeBasedChange,
  perSide,
  onPerSideChange,
  progressionGroups,
  currentProgressionGroupId,
  onProgressionGroupSelect,
  onSwap,
  onDelete,
  type,
  inlineRestActive,
  restThemeProgress,
  interactive = true,
}: PanelProps) {
  const { t } = useTranslation();
  const { colors: themeColors, explore } = useAppTheme();
  const [scrollContentHeight, setScrollContentHeight] = useState(0);

  /** Same timing / motion as ExploreV2UpNextCard add exercise ↔ chevron swap. */
  const swapProgress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(swapProgress, {
      toValue: visible ? 1 : 0,
      duration: 180,
      easing: AnimatedEasing.out(AnimatedEasing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, swapProgress]);

  const settingsHeaderLayerStyle = {
    opacity: swapProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [{ translateY: swapProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }) }],
  };
  const closeHeaderLayerStyle = {
    opacity: swapProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
    transform: [{ translateY: swapProgress.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
  };

  /** Exclude today so the drawer shows the last completed workout from a prior day (sorted oldest → newest). */
  const latestPriorWorkout = useMemo(() => {
    const todayYmd = dayjs().format('YYYY-MM-DD');
    const prior = history.filter(h => dayjs(h.date).format('YYYY-MM-DD') !== todayYmd);
    return prior.length > 0 ? prior[prior.length - 1] : null;
  }, [history]);

  const expandedTarget = useMemo(() => {
    if (!visible || containerHeight <= 0) return COLLAPSED_SHELL_H;
    if (scrollContentHeight <= 0) return containerHeight;
    const intrinsic = EXPANDED_TOP_STACK_H + scrollContentHeight;
    return Math.min(containerHeight, Math.max(intrinsic, COLLAPSED_SHELL_H));
  }, [visible, containerHeight, scrollContentHeight]);

  /** Fill slot until content is measured, or when content is taller than the slot (scroll). */
  const bodyFillsSlot =
    visible &&
    (scrollContentHeight <= 0 ||
      EXPANDED_TOP_STACK_H + scrollContentHeight >= containerHeight - 1);

  const scrollInteractionNeeded =
    visible &&
    (scrollContentHeight <= 0 || EXPANDED_TOP_STACK_H + scrollContentHeight > containerHeight - 2);

  /** Whole panel height: collapsed strip, or content-hugging height when expanded (capped by slot). */
  const panelHeight = useSharedValue(COLLAPSED_SHELL_H);
  /** Collapsed strip sits above the slot bottom; must animate with height or motion cancels out visually. */
  const bottomOffset = useSharedValue(visible ? 0 : COLLAPSED_BOTTOM_OFFSET);

  /** Blocks height sync while rest-dismiss animation runs so wallet shrink doesn't snap panelHeight. */
  const dismissingForRestRef = useRef(false);
  const prevInlineRestRef = useRef(false);

  useEffect(() => {
    if (!visible) setScrollContentHeight(0);
  }, [visible]);

  /** Rising edge: rest timer on while sheet open — collapse with timing, then notify parent (do not set visible false before this). */
  useLayoutEffect(() => {
    const rose = inlineRestActive && !prevInlineRestRef.current;
    prevInlineRestRef.current = inlineRestActive;

    if (!rose || !visible) return;

    dismissingForRestRef.current = true;
    const duration = 260;
    const easing = Easing.out(Easing.cubic);
    bottomOffset.value = withTiming(COLLAPSED_BOTTOM_OFFSET, { duration, easing });
    panelHeight.value = withTiming(COLLAPSED_SHELL_H, { duration, easing }, finished => {
      if (finished) {
        dismissingForRestRef.current = false;
        runOnJS(onClose)();
      }
    });
    Animated.timing(swapProgress, {
      toValue: 0,
      duration: 180,
      easing: AnimatedEasing.out(AnimatedEasing.cubic),
      useNativeDriver: true,
    }).start();
  }, [inlineRestActive, visible, onClose, bottomOffset, panelHeight, swapProgress]);

  useEffect(() => {
    if (dismissingForRestRef.current) return;

    const duration = visible ? 320 : 260;
    const easing = Easing.out(Easing.cubic);
    const bottomTarget = visible ? 0 : COLLAPSED_BOTTOM_OFFSET;
    bottomOffset.value = withTiming(bottomTarget, { duration, easing });

    if (containerHeight <= 0) {
      if (!visible) {
        panelHeight.value = withTiming(COLLAPSED_SHELL_H, { duration, easing });
      }
      return;
    }
    const heightTarget = visible ? expandedTarget : COLLAPSED_SHELL_H;
    panelHeight.value = withTiming(heightTarget, { duration, easing });
  }, [visible, containerHeight, expandedTarget, panelHeight, bottomOffset]);

  const shellAnimStyle = useAnimatedStyle(() => ({
    height: panelHeight.value,
    bottom:
      bottomOffset.value -
      interpolate(restThemeProgress.value, [0, 1], [0, REST_TIMER_DRAWER_OFFSET]),
  }));

  const onHeaderPress = () => {
    if (!interactive) return;
    if (visible) onClose();
    else onOpenSheet();
  };

  return (
    <Reanimated.View
      pointerEvents={interactive ? 'auto' : 'none'}
      style={[styles.panelOuter, shellAnimStyle]}
    >
      {/** Outside rounded clip so the hairline spans the full drawer width (true full bleed). */}
      <View style={[styles.drawerTopDivider, { backgroundColor: themeColors.accentSecondarySoft }]} />
      <View
        style={[
          styles.panelSoftBase,
          bodyFillsSlot ? styles.panelSoftFill : styles.panelSoftHug,
          { backgroundColor: explore.surfaceCurrentCard },
        ]}
      >
        <Pressable
          style={[styles.drawerHeaderRow, visible ? styles.drawerHeaderRowExpanded : styles.drawerHeaderRowCollapsed]}
          onPress={onHeaderPress}
          disabled={!interactive}
          accessibilityRole="button"
          accessibilityLabel={visible ? t('done') : t('settings')}
          hitSlop={10}
        >
          <View style={styles.settingsHeaderBtn}>
            <View style={styles.settingsHeaderSwapSlot}>
              <Animated.View style={[styles.settingsHeaderLayer, settingsHeaderLayerStyle]} pointerEvents="none">
                <Text
                  style={[
                    styles.settingsLinkText,
                    {
                      color: themeColors.containerSecondary,
                      borderBottomColor: themeColors.containerSecondary,
                    },
                  ]}
                >
                  {t('settings')}
                </Text>
              </Animated.View>
              <Animated.View style={[styles.settingsHeaderLayer, closeHeaderLayerStyle]} pointerEvents="none">
                <Text
                  style={[
                    styles.settingsLinkText,
                    {
                      color: themeColors.containerSecondary,
                      borderBottomColor: themeColors.containerSecondary,
                    },
                  ]}
                >
                  {t('done')}
                </Text>
              </Animated.View>
            </View>
          </View>
        </Pressable>

        <View style={bodyFillsSlot ? styles.drawerBodyFill : styles.drawerBodyHug}>
          <ScrollView
            style={bodyFillsSlot ? styles.scrollFill : styles.scrollHug}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            bounces
            scrollEnabled={scrollInteractionNeeded}
            onContentSizeChange={(_w, h) => setScrollContentHeight(h)}
    >
      <View style={styles.pad}>
              {!latestPriorWorkout ? (
                <View style={styles.historyLeadRow}>
                  <Text style={styles.historyLeadLabel}>Last log</Text>
                  <Text style={[styles.historyDateMuted, { color: themeColors.accentSecondary }]}>
                    {t('noHistoryRecordedYet')}
                  </Text>
                </View>
              ) : (
                <View style={styles.historyBlock}>
                  <View style={styles.historyDataRow}>
                    <View style={styles.historyLeftColumn}>
                      <Text style={styles.historyLeadLabel}>Last log</Text>
                      <Text style={[styles.historyDateMuted, { color: themeColors.accentSecondary }]}>
                        {dayjs(latestPriorWorkout.date).format('MMMM D')}
                        {getOrdinalSuffix(dayjs(latestPriorWorkout.date).date())}
                      </Text>
                    </View>
                    <View style={styles.historySetsColumn}>
                      {latestPriorWorkout.sets.map((set, setIndex) => (
                        <View key={setIndex} style={styles.historySetRow}>
                          <View style={styles.historyValueColumn}>
                            <Text style={styles.historySetText}>{formatWeightForLoad(set.weight, useKg)}</Text>
                            <Text style={styles.historySetUnit}>{weightUnit}</Text>
                          </View>
                          <View style={styles.historyValueColumn}>
                            <Text style={styles.historySetText}>{set.reps}</Text>
                            <Text style={styles.historySetUnit}>{timeBased ? 'secs' : 'reps'}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
        </View>
              )}

              <View style={styles.sectionDivider} />
              <Text style={[styles.sectionAfter, { color: themeColors.accentSecondarySoft }]}>Exercise setup</Text>
        <View style={styles.row}>
                <Text style={styles.labelMeta}>Use timer</Text>
                <Toggle
                  label=""
                  hideLabel
                  value={timeBased}
                  trackOffColor={explore.skipRestCtaBg}
                  thumbOnColor={explore.skipRestCtaBg}
                  thumbOffColor={themeColors.containerSecondary}
                  onValueChange={() => {
                    const next = !timeBased;
                    onTimeBasedChange(next);
                    if (!next && perSide) onPerSideChange(false);
                  }}
                />
        </View>
              <Text style={[styles.helperText, { color: themeColors.accentSecondary }]}>
                Track each set by duration instead of reps
              </Text>
        <View style={styles.row}>
                <Text style={[styles.labelMeta, !timeBased && styles.labelDisabled]}>Alternate sides</Text>
                <Toggle
                  label=""
                  hideLabel
                  value={perSide}
                  disabled={!timeBased}
                  trackOffColor={explore.skipRestCtaBg}
                  thumbOnColor={explore.skipRestCtaBg}
                  thumbOffColor={themeColors.containerSecondary}
                  onValueChange={() => onPerSideChange(!perSide)}
                />
        </View>
              <Text style={[styles.helperText, { color: themeColors.accentSecondary }]}>
                Runs the timer once per side for each set
              </Text>

        {type === 'main' && (
          <>
                  <View style={styles.sectionDivider} />
                  <Text style={[styles.sectionAfterTight, { color: themeColors.accentSecondarySoft }]}>
                    Auto progression
                  </Text>
            <View style={styles.pillRow}>
              {progressionGroups.map(g => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.pill, currentProgressionGroupId === g.id && styles.pillOn]}
                        onPress={() =>
                          onProgressionGroupSelect(currentProgressionGroupId === g.id ? null : g.id)
                        }
                >
                  <Text style={styles.pillText} numberOfLines={1}>
                          {progressionPillLabel(g.name)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
            </View>

            <View style={styles.actionsWrap}>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionCell, { backgroundColor: explore.skipRestCtaBg }]}
            onPress={onSwap}
            activeOpacity={0.75}
          >
            <Text style={styles.actionText}>Swap exercise</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionCell, { backgroundColor: explore.skipRestCtaBg }]}
            onPress={() => {
              Alert.alert(t('deleteExerciseTitle'), t('deleteExerciseMessage'), [
                { text: t('cancel'), style: 'cancel' },
                { text: t('remove'), style: 'destructive', onPress: onDelete },
              ]);
            }}
            activeOpacity={0.75}
          >
                  <Text style={[styles.actionText, { color: COLORS.signalNegative }]}>Remove exercise</Text>
          </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  /** Root: no top radius / clip — divider is full width; shadow wraps whole drawer. */
  panelOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  /** Soft surface + rounded corners; divider sits above so the hairline isn’t corner-clipped. */
  panelSoftBase: {
    overflow: 'hidden',
    borderTopLeftRadius: PANEL_TOP_RADIUS,
    borderTopRightRadius: PANEL_TOP_RADIUS,
    borderBottomLeftRadius: EXPLORE_V2.cardRadius,
    borderBottomRightRadius: EXPLORE_V2.cardRadius,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
  },
  panelSoftFill: {
    flex: 1,
    minHeight: 0,
  },
  /** Short content: no extra soft area below Swap/Remove. */
  panelSoftHug: {
    flexGrow: 0,
    flexShrink: 0,
  },
  drawerTopDivider: {
    height: DRAWER_TOP_DIVIDER_H,
    alignSelf: 'stretch',
    width: '100%',
    flexShrink: 0,
  },
  /** Centered header — matches ExploreV2UpNextCard `addExerciseBtn` / `addExerciseText` */
  drawerHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: HEADER_PADDING_TOP,
    paddingHorizontal: CONTENT_PAD_H,
    paddingBottom: 0,
    flexShrink: 0,
  },
  /** Same tap target / layout intent as Up Next `addExerciseBtn` (centered variant) */
  settingsHeaderBtn: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  /** Cross-fade slot for Settings ↔ Close — matches Up Next `countOrPlusSlot` layering. */
  settingsHeaderSwapSlot: {
    position: 'relative',
    minHeight: 30,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsHeaderLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Underlined link — colors from theme (container-secondary) at runtime */
  settingsLinkText: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
    flexShrink: 0,
    paddingBottom: 2,
    borderBottomWidth: 1,
  },
  /** Collapsed shell − 1px divider (header row = 48px) */
  drawerHeaderRowCollapsed: {
    height: COLLAPSED_SHELL_H - DRAWER_TOP_DIVIDER_H,
  },
  drawerHeaderRowExpanded: {
    minHeight: HEADER_PADDING_TOP + DRAWER_HEADER_ROW_H,
  },
  drawerBodyFill: {
    flex: 1,
    minHeight: 0,
  },
  drawerBodyHug: {
    flexGrow: 0,
    flexShrink: 0,
  },
  scrollFill: {
    flex: 1,
    minHeight: 0,
  },
  scrollHug: {
    flexGrow: 0,
  },
  /** Single horizontal inset for Structure, toggles, and Swap/Remove; bottom inset for whole sheet body. */
  scrollContent: {
    flexGrow: 0,
    paddingHorizontal: CONTENT_PAD_H,
    paddingBottom: 32,
  },
  pad: {
    paddingTop: 8,
    paddingBottom: 0,
  },
  actionsWrap: {
    marginTop: 44,
    alignSelf: 'stretch',
  },
  sectionDivider: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.24)',
    marginTop: 16,
    marginBottom: 8,
  },
  sectionAfter: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingTop: 16,
    marginTop: 0,
    marginBottom: 8,
  },
  sectionAfterTight: {
    ...TYPOGRAPHY.legal,
    fontWeight: '500',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingTop: 16,
    marginTop: 0,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    ...TYPOGRAPHY.body,
    color: EXPLORE_V2.colors.textPrimary,
    flex: 1,
  },
  labelMeta: {
    ...TYPOGRAPHY.meta,
    color: EXPLORE_V2.colors.textPrimary,
    flex: 1,
  },
  labelDisabled: {
    color: COLORS.textMeta,
  },
  helperText: {
    ...TYPOGRAPHY.meta,
    marginTop: -4,
    marginBottom: 8,
    maxWidth: '82%',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: EXPLORE_V2.colors.divider,
  },
  pillOn: {
    borderColor: EXPLORE_V2.colors.accent,
    backgroundColor: 'rgba(200,255,61,0.12)',
  },
  pillText: {
    ...TYPOGRAPHY.meta,
    color: EXPLORE_V2.colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  actionCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
  },
  actionText: {
    ...TYPOGRAPHY.meta,
    fontWeight: '500',
    color: COLORS.text,
  },
  historyBlock: {
    alignSelf: 'stretch',
    paddingBottom: 4,
  },
  historyLeadRow: {
    paddingVertical: 8,
    alignSelf: 'stretch',
  },
  historyLeftColumn: {
    flex: 1,
  },
  historyLeadLabel: {
    ...TYPOGRAPHY.meta,
    color: EXPLORE_V2.colors.textPrimary,
  },
  historyDateMuted: {
    ...TYPOGRAPHY.meta,
    marginTop: 2,
  },
  historyDataRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: 0,
  },
  historySetsColumn: {
    alignItems: 'flex-end',
  },
  historySetRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.lg,
    paddingVertical: 2,
  },
  historyValueColumn: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 4,
    width: 48,
  },
  historySetText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.text,
  },
  historySetUnit: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
});
