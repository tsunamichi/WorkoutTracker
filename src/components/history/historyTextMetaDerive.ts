import { hexToRgba } from '../../constants';

/**
 * History calendar (future days) — day-of-month numeral, derived from current `textMeta`
 * so brand/theme teams only adjust `textMeta` at the source.
 */
export function textMetaForHistoryCalendarDayLabel(textMeta: string) {
  return hexToRgba(textMeta, 0.3);
}

/**
 * History calendar (future days) — dot face fill, derived from current `textMeta` @ 12% opacity.
 */
export function textMetaForHistoryCalendarFutureFace(textMeta: string) {
  return hexToRgba(textMeta, 0.12);
}

/**
 * Unselected calendar day with **no** logged workout — day-of-month numeral, `containerPrimary` @ 20% opacity.
 */
export function historyCalendarEmptyUnselectedDayLabelFromContainerPrimary(containerPrimary: string) {
  return hexToRgba(containerPrimary, 0.2);
}

/**
 * Unselected calendar day **with** logged workout — day-of-month numeral, `containerSecondary` @ 40% opacity.
 */
export function historyCalendarCompletedUnselectedDayLabelFromContainerSecondary(containerSecondary: string) {
  return hexToRgba(containerSecondary, 0.4);
}

/**
 * Workout detail (History) — horizontal rule between exercise rows, `textMeta` @ 8% opacity.
 */
export function textMetaForHistoryWorkoutDetailExerciseDivider(textMeta: string) {
  return hexToRgba(textMeta, 0.08);
}
