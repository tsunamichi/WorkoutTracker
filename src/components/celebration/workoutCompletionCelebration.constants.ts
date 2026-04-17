/**
 * Workout completion celebration — tunable layout, timing, and trail behavior.
 * Adjust here; component reads these for all motion + type scale.
 */

/** Mock copy for the prototype (wire real data later). */
export const MOCK_WORKOUT_COMPLETION = {
  completionLabel: 'Workout complete',
  /** Static header second line — total lifted (no animation) */
  headerLiftSummary: 'You lifted 2,358 lb',
  streakIntro: "You're on a",
  streakNumber: '7',
  streakDetail: 'day streak',
  prIntro: 'New bench press PR',
  prMain: '145',
  prDetail: 'lb',
  showPr: true,
} as const;

// --- Timing (total staged sequence ~1.2–1.8s) ---

export const CELEBRATION_TIMING = {
  /** Overall feel: confident ease-out, no bounce */
  easePrimary: [0.22, 1, 0.36, 1] as const,

  /** Background blobs scale in */
  blobADurationMs: 520,
  blobBDelayMs: 90,
  blobBDurationMs: 560,

  /**
   * Wait until decorative blobs have finished before any copy / hero / stats animate.
   * max(blob A done, blob B done) + short cushion.
   */
  backgroundReadyMs:
    Math.max(520, 90 + 560) + 48,

  /** Screen / backdrop fade (when layered under execution UI later) */
  backdropFadeMs: 220,

  /** Hero + entire trail stack: one shared timing curve */
  heroFrontDelayMs: 140,
  /** Same duration + easing for every hero stack layer; only start time differs */
  chainDurationMs: 520,
  /** Shared horizontal travel (px): layers enter from the right and ease left into place */
  heroFrontTranslateStart: 48,
  /** Wall-clock delay between front → accent → tertiary (ms) */
  layerStaggerMs: 45,

  /** Supporting typographic lines after hero */
  supportStartDelayMs: 720,
  supportStaggerMs: 95,
  supportLineDurationMs: 420,
  supportLineTranslateStart: 28,
} as const;

// --- Hero trail stack (back → front). Two echo layers + front; motion is right → left. ---

export type TrailLayerRole = 'tertiary' | 'accent' | 'front';

export type TrailLayerSpec = {
  role: TrailLayerRole;
  /** Reserved for future micro-offsets; motion uses identical start/end for all layers */
  finalOffsetX: number;
  finalOffsetY: number;
  /** 0 = furthest back … 2 = front */
  stackIndex: number;
};

/**
 * 2 trail backs + 1 front; paint order = furthest back first, front on top.
 * All share the same rest transform (0,0) — reveal is from lag only.
 */
export const HERO_TRAIL_STACK: TrailLayerSpec[] = [
  { role: 'tertiary', finalOffsetX: 0, finalOffsetY: 0, stackIndex: 0 },
  { role: 'accent', finalOffsetX: 0, finalOffsetY: 0, stackIndex: 1 },
  { role: 'front', finalOffsetX: 0, finalOffsetY: 0, stackIndex: 2 },
];

// --- Typography (hero + supporting) ---

export const CELEBRATION_TYPE = {
  /** Large metric figures (animated streak / PR values) */
  heroMainSize: 120,
  heroMainLineHeight: 115,
  heroMainWeight: '600' as const,
  heroLetterSpacing: -2,

  heroUnitSize: 30,
  heroUnitWeight: '600' as const,

  /** Stat third row — “day streak” / “lb” */
  statUnitSize: 72,
  statUnitLineHeight: 68,
} as const;

// --- Background shapes (graphic, not cards) ---

export const CELEBRATION_SHAPES = {
  blobATop: -140,
  blobARight: -100,
  blobASize: 440,
  blobBOpacity: 0.14,

  blobBBottom: -120,
  blobBLeft: -140,
  blobBSize: 380,
  blobAOpacity: 0.12,
} as const;

// --- Layout ---

export const CELEBRATION_LAYOUT = {
  screenPaddingH: 24,
  /** Extra padding below status bar / safe area */
  safeTopExtra: 22,
  /** Space below header block before first stat block */
  gapHeaderToStats: 56,
  /** Space between total-weight block and day streak / PR */
  supportBlockTop: 64,
  /** Between day streak and PR (and other stacked stat sections) */
  statSectionGap: 64,
  /** Asymmetric placement multipliers */
  streakAlign: 'flex-start' as const,
  prAlign: 'flex-end' as const,
};
