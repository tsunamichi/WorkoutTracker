import { hexToRgba } from '../../constants';

/** Sunday-column anchor on history chart — solid on `containerSecondary`-style fills. */
const HISTORY_SUNDAY_ANCHOR_LIME = '#CBE659';

/** History screen — mock-aligned palette (light typographic canvas). */
export const HISTORY_VISUAL = {
  canvas: '#F2EEEE',
  forest: '#122E26',
  lime: '#D7FF64',
  /** Sunday date numeral on chart days filled like `containerSecondary`. */
  historySundayAnchorLime: HISTORY_SUNDAY_ANCHOR_LIME,
  /** Sunday date numeral on chart days filled like `containerPrimary` — anchor @ 24%. */
  historySundayAnchorOnPrimaryFill: hexToRgba(HISTORY_SUNDAY_ANCHOR_LIME, 0.24),
  /**
   * Future days (after “today”) on the history chart — muted meta fill so the
   * lime no-log band reads through today as the latest bright dot.
   */
  futureDayDotFill: 'rgba(102, 102, 102, 0.28)',
  /** Days with no workout logs (chart fill). */
  noLogDayFill: '#E0FB60',
  textGray: '#666666',
  textGraySoft: 'rgba(102, 102, 102, 0.72)',
  columnLabel: 'rgba(102, 102, 102, 0.55)',
  divider: 'rgba(102, 102, 102, 0.22)',
  titleInk: '#2A2A2A',
} as const;
