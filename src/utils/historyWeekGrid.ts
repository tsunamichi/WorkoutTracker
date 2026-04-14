import dayjs, { type Dayjs } from 'dayjs';

export type HistoryGridCell = {
  isoDate: string;
  instant: Dayjs;
  /** Column 0 = Sunday … 6 = Saturday */
  weekdayIndex: number;
  isSunday: boolean;
};

export type HistoryGridRow = HistoryGridCell[];

/**
 * Sunday (column 0) of the week containing `reference`, start of local calendar day.
 */
export function startOfWeekSunday(reference: Dayjs): Dayjs {
  const d = reference.startOf('day');
  return d.subtract(d.day(), 'day');
}

/**
 * Four calendar rows × 7 columns, oldest week first.
 * The bottom row is the week that contains `reference`.
 */
export function buildSundayFirstFourWeekGrid(reference: Dayjs = dayjs()): HistoryGridRow[] {
  const bottomSunday = startOfWeekSunday(reference);
  const topSunday = bottomSunday.subtract(21, 'day');

  const rows: HistoryGridRow[] = [];
  for (let w = 0; w < 4; w++) {
    const weekStart = topSunday.add(w * 7, 'day');
    const row: HistoryGridCell[] = [];
    for (let c = 0; c < 7; c++) {
      const instant = weekStart.add(c, 'day');
      row.push({
        isoDate: instant.format('YYYY-MM-DD'),
        instant,
        weekdayIndex: c,
        isSunday: c === 0,
      });
    }
    rows.push(row);
  }
  return rows;
}

/** Ordinal day label e.g. 19 → "19th" */
export function ordinalDay(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

/** e.g. "April 2nd" */
export function formatHistorySelectedHeading(isoDate: string): string {
  const d = dayjs(isoDate);
  return `${d.format('MMMM')} ${ordinalDay(d.date())}`;
}
