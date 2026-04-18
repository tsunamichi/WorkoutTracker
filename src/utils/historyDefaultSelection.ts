import { type Dayjs } from 'dayjs';
import type { HistoryGridRow } from './historyWeekGrid';

/**
 * On History load, select **today** (relative to `reference`) when it appears in the grid.
 * The 4-week grid always includes the day of `reference`, so this is the common case.
 * Fallback: first cell in the grid (oldest day shown).
 */
export function pickDefaultHistorySelection(
  rows: HistoryGridRow[],
  _completedIsoSet: ReadonlySet<string>,
  reference: Dayjs,
): string {
  const flat = rows.flat();
  const todayIso = reference.format('YYYY-MM-DD');
  if (flat.some(c => c.isoDate === todayIso)) {
    return todayIso;
  }
  return flat[0]?.isoDate ?? todayIso;
}
