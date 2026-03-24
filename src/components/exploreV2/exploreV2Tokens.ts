/**
 * Explore v2 — layout + motion + re-exports of the color system.
 * Prefer importing EXPLORE_V2_PALETTES / EXPLORE_V2_CHROME from exploreV2ColorSystem for color work.
 */

import { EXPLORE_V2_CHROME } from './exploreV2ColorSystem';

export { EXPLORE_V2_CARD_MAINS, EXPLORE_V2_CHROME, EXPLORE_V2_PALETTES, getCardPalette, mixHex } from './exploreV2ColorSystem';
export type { CardPalette, CardRole } from './exploreV2ColorSystem';

export const EXPLORE_V2 = {
  margin: 4,
  /** Space between stacked card layers (negative overlap for a softer “wallet” read) */
  stackOverlap: 14,
  /** Visible header strip when a card is covered by the card in front */
  peekHeaderHeight: 54,
  timerAreaHeight: 64,
  /** Match iOS-style device corner radius on card bottoms */
  cardRadius: 40,
  /** Top corners only (wallet stack read) */
  cardTopRadius: 16,
  /** Inner padding for all Explore v2 cards */
  cardPadding: {
    top: 16,
    horizontal: 24,
    bottom: 24,
  },
  /** Expanded Current card — fixed height (wallet layer) */
  currentCardExpandedHeight: 460,
  /** Completed card — fixed height (full shell: header row + scroll body) */
  completedCardHeight: 566,
  /**
   * Up Next — fixed height when no Completed layer is in the stack.
   * Total outer shell height, including the “Up next” header row and list below.
   */
  upNextCardHeightSolo: 566,
  /**
   * Up Next — fixed height when Completed sits behind it in the stack.
   * Total outer shell height, including the header row + list (not content-only).
   */
  upNextCardHeightWithCompleteBehind: 514,
  /** From header row (Up next / Completed / Current + actions) to first content below */
  headerToContentGap: 64,
  /** Between exercise rows in Up Next & Completed lists */
  exerciseListRowGap: 16,
  /** Prefer soft color fields over heavy strokes */
  borderWidth: 0,
  /** Stack flex weights — shallow back band, mid band, dominant Current */
  weights: {
    primaryCurrent: { complete: 0.07, upNext: 0.11, current: 0.82 },
    primaryUpNext: { complete: 0.1, upNext: 0.58, current: 0.32 },
    primaryComplete: { complete: 0.52, upNext: 0.24, current: 0.24 },
    noCurrent: { complete: 0.24, upNext: 0.76, current: 0 },
  },
  colors: {
    pageBg: EXPLORE_V2_CHROME.pageBg,
    timerAreaBg: 'transparent',
    timerBorderIdle: 'rgba(255,255,255,0.06)',
    timerBorderActive: EXPLORE_V2_CHROME.timerActiveBorder,
    /** @deprecated use EXPLORE_V2_PALETTES.current — kept for gradual migration */
    accent: '#E8D5FF',
    /** Legacy flat grays — avoid in new UI; palettes drive card surfaces */
    textPrimary: '#FAFAFA',
    textSecondary: 'rgba(250,250,250,0.72)',
    textMeta: 'rgba(250,250,250,0.45)',
    divider: 'rgba(255,255,255,0.08)',
  },
  motion: {
    currentExitMs: 300,
    currentEnterMs: 420,
    upNextRevealMs: 320,
    upNextSettleMs: 380,
    stackStaggerMs: 40,
    currentExitEase: [0.32, 0.72, 0, 1] as const,
    currentEnterEase: [0.22, 1, 0.36, 1] as const,
    currentExitScale: 0.985,
    currentExitOpacity: 0.98,
    timer: {
      timerEnterMs: 360,
      timerExitMs: 220,
      timerDigitChangeMs: 210,
      timerControlStaggerMs: 50,
      timerEnterTranslateY: 14,
      timerExitTranslateY: 6,
      timerDigitOffsetY: 6,
      timerEnterScaleFrom: 0.985,
      timerExitScaleTo: 0.985,
      timerEnterBounceOvershootY: -2,
      timerEnterRiseMs: 260,
      timerEnterBounceSettleMs: 120,
      timerContainerEnterEase: [0.22, 1, 0.36, 1] as const,
      timerContainerExitEase: [0.32, 0.72, 0, 1] as const,
      timerDigitEase: [0.22, 0.61, 0.36, 1] as const,
    },
    stackLayoutTransitionMs: 320,
    stackLayoutTransitionEase: [0.22, 1, 0.36, 1] as const,
  },
  layout: {
    timerInactiveHeight: 0,
    timerVisibleHeight: 88,
  },
  typography: {
    /** Exercise title on Current */
    currentTitle: 26,
    /** Hero weight / reps */
    heroNumeral: 44,
    heroNumeralSmall: 36,
    timerHero: 30,
  },
} as const;
