import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import dayjs from 'dayjs';
import type { HistoryGridRow } from '../../utils/historyWeekGrid';
import { useAppTheme } from '../../theme/useAppTheme';
import { HISTORY_CHART } from './historyChartLayout';
import {
  textMetaForHistoryCalendarDayLabel,
  textMetaForHistoryCalendarFutureFace,
  historyCalendarEmptyUnselectedDayLabelFromContainerPrimary,
  historyCalendarCompletedUnselectedDayLabelFromContainerSecondary,
} from './historyTextMetaDerive';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

const SLOT = HISTORY_CHART.slotSize;
const FACE = HISTORY_CHART.slotSize;

/** Bottom slice of the concentric inner circle (see `selectionInnerDiameter`). */
function buildHistorySelectionCapPath(): string {
  const face = HISTORY_CHART.slotSize;
  const innerR = HISTORY_CHART.selectionInnerDiameter / 2;
  const cx = face / 2;
  const cy = face / 2;
  const chordY = cy + innerR - HISTORY_CHART.selectionCapHeight;
  const dy = chordY - cy;
  const dx = Math.sqrt(innerR * innerR - dy * dy);
  const xl = cx - dx;
  const xr = cx + dx;
  const n = (v: number) => Number(v.toFixed(4));
  /** Flat chord on top, single bottom arc of the inner circle (two arcs meeting at the pole looked like a lens). */
  return `M ${n(xl)} ${n(chordY)} L ${n(xr)} ${n(chordY)} A ${innerR} ${innerR} 0 0 1 ${n(xl)} ${n(chordY)} Z`;
}

const HISTORY_SELECTION_CAP_PATH = buildHistorySelectionCapPath();

const SELECTION_SLIDE_PX = 10;
const SELECTION_IN_MS = 280;
const SELECTION_OUT_MS = 220;
const SELECTION_EASE_OUT = Easing.bezier(0.33, 0, 0.2, 1);
const SELECTION_EASE_IN = Easing.bezier(0.4, 0, 0.2, 1);

export type FourWeekActivityChartProps = {
  rows: HistoryGridRow[];
  selectedIso: string;
  completedIsoSet: ReadonlySet<string>;
  /** Local “today” for empty/future treatment. */
  todayIso: string;
  onSelectIso: (iso: string) => void;
  /** Theme token — days with completed workout logs. */
  completedWorkoutColor: string;
  /** Theme token — days with no workout log (face fill). */
  emptyDayFill: string;
};

type DotState = 'completed' | 'empty' | 'future';

function cellState(iso: string, completed: ReadonlySet<string>, todayIso: string): DotState {
  if (iso > todayIso) return 'future';
  return completed.has(iso) ? 'completed' : 'empty';
}

function ChartDayDot({
  isSelected,
  dotState,
  dayOfMonth,
  accessibilityLabel,
  onPress,
  completedWorkoutColor,
  emptyDayFill,
  futureDayFaceFill,
  futureDayLabelColor,
  emptyUnselectedDayLabelColor,
  completedUnselectedDayLabelColor,
}: {
  isSelected: boolean;
  dotState: DotState;
  dayOfMonth: number;
  accessibilityLabel: string;
  onPress: () => void;
  completedWorkoutColor: string;
  emptyDayFill: string;
  /** Future-day dot face: `textMeta` @ 12% — see `textMetaForHistoryCalendarFutureFace`. */
  futureDayFaceFill: string;
  /** Future-day unselected numeral: `textMeta` @ 30% — see `textMetaForHistoryCalendarDayLabel`. */
  futureDayLabelColor: string;
  /** Empty-day unselected numeral: `containerPrimary` @ 20% — see `historyCalendarEmptyUnselectedDayLabelFromContainerPrimary`. */
  emptyUnselectedDayLabelColor: string;
  /** Logged-day unselected numeral: `containerSecondary` @ 40% — see `historyCalendarCompletedUnselectedDayLabelFromContainerSecondary`. */
  completedUnselectedDayLabelColor: string;
}) {
  const innerFill =
    dotState === 'completed'
      ? completedWorkoutColor
      : dotState === 'future'
        ? futureDayFaceFill
        : emptyDayFill;
  /** Inverse of face — selection cap + numeral. */
  const selectionInk = dotState === 'completed' ? emptyDayFill : completedWorkoutColor;

  const unselectedNumberColor =
    dotState === 'completed'
      ? completedUnselectedDayLabelColor
      : dotState === 'future'
        ? futureDayLabelColor
        : emptyUnselectedDayLabelColor;

  const [showSelectionChrome, setShowSelectionChrome] = useState(isSelected);
  const capSlideY = useRef(new Animated.Value(isSelected ? 0 : SELECTION_SLIDE_PX)).current;
  const numberOpacity = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const didApplyInitial = useRef(false);
  const prevIsSelected = useRef(isSelected);
  const selectionAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    selectionAnimRef.current?.stop();

    if (!didApplyInitial.current) {
      didApplyInitial.current = true;
      if (isSelected) {
        setShowSelectionChrome(true);
        capSlideY.setValue(0);
        numberOpacity.setValue(1);
      } else {
        setShowSelectionChrome(false);
        capSlideY.setValue(SELECTION_SLIDE_PX);
        numberOpacity.setValue(0);
      }
      prevIsSelected.current = isSelected;
    } else {
      const wasSelected = prevIsSelected.current;
      prevIsSelected.current = isSelected;

      if (isSelected) {
        setShowSelectionChrome(true);
        capSlideY.setValue(SELECTION_SLIDE_PX);
        numberOpacity.setValue(0);
        const anim = Animated.parallel([
          Animated.timing(numberOpacity, {
            toValue: 1,
            duration: SELECTION_IN_MS,
            easing: SELECTION_EASE_OUT,
            useNativeDriver: true,
          }),
          Animated.timing(capSlideY, {
            toValue: 0,
            duration: SELECTION_IN_MS,
            easing: SELECTION_EASE_OUT,
            useNativeDriver: true,
          }),
        ]);
        selectionAnimRef.current = anim;
        anim.start(() => {
          if (selectionAnimRef.current === anim) {
            selectionAnimRef.current = null;
          }
        });
      } else if (wasSelected) {
        const anim = Animated.parallel([
          Animated.timing(numberOpacity, {
            toValue: 0,
            duration: SELECTION_OUT_MS,
            easing: SELECTION_EASE_IN,
            useNativeDriver: true,
          }),
          Animated.timing(capSlideY, {
            toValue: SELECTION_SLIDE_PX,
            duration: SELECTION_OUT_MS,
            easing: SELECTION_EASE_IN,
            useNativeDriver: true,
          }),
        ]);
        selectionAnimRef.current = anim;
        anim.start(({ finished }) => {
          if (selectionAnimRef.current === anim) {
            selectionAnimRef.current = null;
          }
          if (finished) {
            setShowSelectionChrome(false);
          }
        });
      }
    }

    return () => {
      selectionAnimRef.current?.stop();
    };
  }, [isSelected]);

  return (
    <Pressable
      onPress={onPress}
      style={styles.hit}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.slot}>
        <View
          style={[
            styles.face,
            {
              width: FACE,
              height: FACE,
              borderRadius: FACE / 2,
              backgroundColor: innerFill,
              overflow: 'hidden',
            },
          ]}
        >
          {!showSelectionChrome ? (
            <Text style={[styles.unselectedDayNumber, { color: unselectedNumberColor }]}>{dayOfMonth}</Text>
          ) : null}
          {showSelectionChrome ? (
            <>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.selectionCapWrap,
                  { transform: [{ translateY: capSlideY }] },
                ]}
              >
                <Svg width={FACE} height={FACE} style={styles.selectionCapSvg}>
                  <Path d={HISTORY_SELECTION_CAP_PATH} fill={selectionInk} />
                </Svg>
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                style={[styles.selectedDayNumberWrap, { opacity: numberOpacity }]}
              >
                <Text style={[styles.selectedDayNumber, { color: selectionInk }]}>{dayOfMonth}</Text>
              </Animated.View>
            </>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function FourWeekActivityChart({
  rows,
  selectedIso,
  completedIsoSet,
  todayIso,
  onSelectIso,
  completedWorkoutColor,
  emptyDayFill,
}: FourWeekActivityChartProps) {
  const { colors: themeColors } = useAppTheme();
  const futureDayFaceFill = textMetaForHistoryCalendarFutureFace(themeColors.textMeta);
  const futureDayLabelColor = textMetaForHistoryCalendarDayLabel(themeColors.textMeta);
  const emptyUnselectedDayLabelColor = historyCalendarEmptyUnselectedDayLabelFromContainerPrimary(
    themeColors.containerPrimary,
  );
  const completedUnselectedDayLabelColor = historyCalendarCompletedUnselectedDayLabelFromContainerSecondary(
    themeColors.containerSecondary,
  );
  return (
    <View style={styles.wrap}>
      {/* e.g. screenshot: day initials row "S M T W T F S" — `textMeta` */}
      <View style={styles.headerRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <View key={`${label}-${i}`} style={styles.headerCell}>
            <Text style={[styles.headerText, { color: themeColors.textMeta }]}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={{ height: HISTORY_CHART.headerToGridGap }} />

      {rows.map((row, ri) => (
        <View key={ri} style={[styles.row, ri < rows.length - 1 && { marginBottom: HISTORY_CHART.rowGap }]}>
          {row.map(cell => {
            const dotState = cellState(cell.isoDate, completedIsoSet, todayIso);
            const isSelected = cell.isoDate === selectedIso;
            const a11yLabel = dayjs(cell.isoDate).format('dddd, MMMM D');
            return (
              <View key={cell.isoDate} style={styles.cell}>
                <ChartDayDot
                  isSelected={isSelected}
                  dotState={dotState}
                  dayOfMonth={cell.instant.date()}
                  accessibilityLabel={a11yLabel}
                  onPress={() => onSelectIso(cell.isoDate)}
                  completedWorkoutColor={completedWorkoutColor}
                  emptyDayFill={emptyDayFill}
                  futureDayFaceFill={futureDayFaceFill}
                  futureDayLabelColor={futureDayLabelColor}
                  emptyUnselectedDayLabelColor={emptyUnselectedDayLabelColor}
                  completedUnselectedDayLabelColor={completedUnselectedDayLabelColor}
                />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'visible',
  },
  headerRow: {
    flexDirection: 'row',
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'visible',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  hit: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  slot: {
    width: SLOT,
    height: SLOT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  face: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCapWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  selectionCapSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  /** Keeps the numeral centered in the full face so the bottom cap does not shift it. */
  selectedDayNumberWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedDayNumber: {
    textAlign: 'center',
    fontSize: HISTORY_CHART.sundayNumberSize,
    fontWeight: '600',
  },
  unselectedDayNumber: {
    fontSize: HISTORY_CHART.sundayNumberSize,
    fontWeight: '600',
  },
});
