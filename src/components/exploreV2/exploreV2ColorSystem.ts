/**
 * Explore v2 — centralized per-card color system.
 * Edit EXPLORE_V2_CARD_MAINS only; soft / dark / muted derive from each main.
 */

import { COLORS } from '../../constants';

export type CardRole = 'complete' | 'upNext' | 'current';

export type CardPalette = {
  /** Primary surface fill */
  main: string;
  /** Lighter / softer companion (highlights, secondary surfaces) */
  soft: string;
  /** Dark tone for primary text & strong UI on this card */
  dark: string;
  /** Secondary / meta text on this card */
  muted: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function toHex(r: number, g: number, b: number): string {
  const x = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${x(r)}${x(g)}${x(b)}`;
}

/** Linear blend between two hex colors (0 = a, 1 = b). */
export function mixHex(a: string, b: string, t: number): string {
  const A = parseHex(a);
  const B = parseHex(b);
  const u = clamp(t, 0, 1);
  return toHex(A.r + (B.r - A.r) * u, A.g + (B.g - A.g) * u, A.b + (B.b - A.b) * u);
}

/**
 * Build soft / dark / muted from a single main brand color per card role.
 * Tweak ratios here to globally tune how “pastel” vs “saturated” derived tones feel.
 */
export function getCardPalette(mainHex: string): CardPalette {
  const main = mainHex.startsWith('#') ? mainHex : `#${mainHex}`;
  return {
    main,
    soft: mixHex(main, '#121018', 0.24),
    dark: mixHex(main, '#121018', 0.7),
    muted: mixHex(main, '#2A2435', 0.55),
  };
}

/**
 * Single source of truth for card “main” hues — change these to retheme Explore v2.
 * Soft/dark/muted update automatically via getCardPalette.
 */
export const EXPLORE_V2_CARD_MAINS: Record<CardRole, string> = {
  /** Muted mauve / back archive layer */
  complete: '#E5E5E5',
  /** Soft lavender queue layer — matches core `containerSecondary` */
  upNext: '#B0E8E5',
  /** Primary current workspace */
  current: '#1F1F1F',
};

export const EXPLORE_V2_PALETTES: Record<CardRole, CardPalette> = {
  complete: getCardPalette(EXPLORE_V2_CARD_MAINS.complete),
  upNext: getCardPalette(EXPLORE_V2_CARD_MAINS.upNext),
  current: getCardPalette(EXPLORE_V2_CARD_MAINS.current),
};

/** Page + chrome (not tied to card mains — edit independently). */
export const EXPLORE_V2_CHROME = {
  pageBg: '#F5F4F4',
  /** Dark pill CTA on colored Current surface */
  ctaPillBg: '#1F1F1F',
  ctaPillText: '#F5F4F4',
  /** Timer row when idle */
  timerIdleBg: 'rgba(255,255,255,0.06)',
  timerActiveBorder: 'rgba(255,255,255,0.14)',
  timerTrack: 'rgba(255,255,255,0.12)',
  timerHeroText: '#1F1F1F',
  timerIcon: '#1F1F1F',
} as const;
