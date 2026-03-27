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
    /** Rest timer active — Completed / Up Next headers, chevrons, Add exercise, Up Next superscript */
    restTimerHeaderInk: '#915100',
    /** Rest timer active — unit suffixes in Completed list (kg, reps, s) */
    restTimerCompletedUnitInk: '#C87000',
    /** Work timer active — Completed / Up Next card fills (matches page blue family) */
    workTimerCompleteCardBg: '#B1EF15',
    workTimerUpNextCardBg: '#9BD508',
  },
  motion: {
    currentExitMs: 300,
    /** Brief opposite motion before Current slides off the deck (px up, then exit down) */
    currentExitAnticipationPx: 14,
    currentExitAnticipationMs: 110,
    currentEnterMs: 420,
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
    stackLayoutTransitionMs: 420,
    stackLayoutTransitionEase: [0.42, 0, 0.58, 1] as const,
    /** Official rest timer — color + spatial choreography (entry/exit) */
    rest: {
      /** Rest entry/exit — stack shrink + colors + shared timer progress */
      colorMs: 420,
      /** Legacy — prefer `restTransitionEase` for the shared progress driver */
      colorEase: [0.22, 1, 0.36, 1] as const,
      /** Band + stack + colors: ease-in-out so resize doesn’t feel front-loaded (Material-like) */
      restTransitionEase: [0.42, 0, 0.58, 1] as const,
      /** Wallet pulls over timer band so digits can start occluded under the stack */
      stackOverlapPx: 28,
      /** Timer hero starts this far down (positive = toward stack), then rises into slot */
      timerEmergenceTranslateY: 32,
      /** Digits / pressable value fade & rise slightly after the outer container begins */
      timerValueStaggerMs: 56,
      /** Reserved for future controls row — keep in sync with timerControlStagger concept */
      timerControlsStaggerMs: 60,
    },
  },
  layout: {
    timerInactiveHeight: 0,
    /** Legacy fixed strip height — prefer `restTimerHeightFraction` × content height */
    timerVisibleHeight: 88,
    /**
     * Rest layout: share of explore-v2 **content** height (below header). Idle = stack 100%, timer 0%.
     * When rest enters, timer grows to `restTimerHeightFraction` and stack shrinks to `restStackHeightFraction`.
     */
    restTimerHeightFraction: 0.2,
    restStackHeightFraction: 0.8,
    /** Vertical center of rest timer hero: half of `restTimerHeightFraction` (fixed in root %, not tied to band flex). */
    restTimerCenterFromRootTopFraction: 0.1,
    /** Extra upward offset (px) so the overlay hero sits closer to the header; added to half digit-slot height in screen anchor */
    restTimerOverlayUpNudgePx: 20,
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
