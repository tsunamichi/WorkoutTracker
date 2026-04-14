import dayjs, { type Dayjs } from 'dayjs';
import type { HistoryGridRow } from './historyWeekGrid';

/**
 * Prefer the third-row Sunday (week before current) when it has a log,
 * else the latest past day with a log, else today if it appears in the grid,
 * else the first grid day.
 */
export function pickDefaultHistorySelection(
  rows: HistoryGridRow[],
  completedIsoSet: ReadonlySet<string>,
  reference: Dayjs,
): string {
  const flat = rows.flat();
  const preferred = rows[2]?.[0]?.isoDate;
  if (preferred && !dayjs(preferred).isAfter(reference, 'day') && completedIsoSet.has(preferred)) {
    return preferred;
  }

  for (let i = flat.length - 1; i >= 0; i--) {
    const cell = flat[i];
    if (!cell.instant.isAfter(reference, 'day') && completedIsoSet.has(cell.isoDate)) {
      return cell.isoDate;
    }
  }

  const todayIso = reference.format('YYYY-MM-DD');
  if (flat.some(c => c.isoDate === todayIso)) return todayIso;
  return flat[0]?.isoDate ?? todayIso;
}
