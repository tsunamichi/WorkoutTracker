/**
 * App color themes — accents + Explore execution chrome only.
 * Structural neutrals (canvas, ink, card grays) stay on COLORS.
 */

import { COLORS } from '../constants';
import type { AppColorThemeId } from '../types';
import { mixHex } from '../components/exploreV2/exploreV2ColorSystem';

export type { AppColorThemeId } from '../types';

export type ExploreAccentTokens = {
  /** Hero weight / reps numerals (Current card) */
  heroValueInk: string;
  heroUnitInk: string;
  heroValueDimmed: string;
  /** Rest / work stack border interpolation start */
  warmActivity: string;
  /** Partner hue for warmActivity → work blue transitions */
  activityInfo: string;
  /** Mid-tone band (Up Next row → work timer) */
  amberBand: string;
  /** Complete card shell — work timer entry band */
  amberBandComplete: string;
  workTimerCompleteCardBg: string;
  workTimerUpNextCardBg: string;
  restTimerHeaderInk: string;
  restTimerCompletedUnitInk: string;
  skipRestCtaBg: string;
  ctaPillBg: string;
  ctaPillText: string;
  surfaceCurrentCard: string;
};

export type AppTheme = {
  id: AppColorThemeId;
  colors: typeof COLORS;
  explore: ExploreAccentTokens;
};

function lightenTowardWhite(hex: string, t: number) {
  return mixHex(hex, '#FFFFFF', t);
}

function darkenTowardInk(hex: string, t: number) {
  return mixHex(hex, '#121018', t);
}

function accentSurfaces(accent: string) {
  return {
    primary: accent,
    accentPrimary: accent,
    accentPrimaryLight: lightenTowardWhite(accent, 0.16),
    accentPrimaryDark: darkenTowardInk(accent, 0.28),
    accentPrimaryDimmed: darkenTowardInk(accent, 0.78),
  };
}

const ORIGINAL_EXPLORE: ExploreAccentTokens = {
  heroValueInk: '#FFA424',
  heroUnitInk: '#464646',
  heroValueDimmed: '#464646',
  warmActivity: '#FFA424',
  activityInfo: COLORS.info,
  amberBand: '#E78B0B',
  amberBandComplete: '#F3940F',
  workTimerCompleteCardBg: COLORS.containerTertiaryTimer,
  workTimerUpNextCardBg: COLORS.containerSecondaryTimer,
  restTimerHeaderInk: '#915100',
  restTimerCompletedUnitInk: '#C87000',
  skipRestCtaBg: '#161616',
  ctaPillBg: '#FFA424',
  ctaPillText: '#1F1F1F',
  surfaceCurrentCard: '#1F1F1F',
};

export function normalizeColorThemeId(raw: unknown): AppColorThemeId {
  if (raw === 'v1' || raw === 'v3') return raw;
  return 'original';
}

export function buildAppTheme(id: AppColorThemeId): AppTheme {
  if (id === 'original') {
    return {
      id,
      colors: { ...COLORS },
      explore: { ...ORIGINAL_EXPLORE },
    };
  }

  if (id === 'v1') {
    /** Forest card + spec accent-primary (#FFA424) + cyan accents (Schedule + Explore execution). */
    const brandPrimary = COLORS.accentPrimary;
    const cyan = '#26C2B4';
    const forest = '#002D29';
    return {
      id,
      colors: {
        ...COLORS,
        ...accentSurfaces(brandPrimary),
        secondary: cyan,
        secondarySoft: mixHex(cyan, '#121018', 0.5),
        todayIndicator: mixHex(cyan, '#121018', 0.22),
        info: mixHex(cyan, '#062A26', 0.35),
        canvasLight: '#F5F5F5',
        containerPrimary: forest,
      },
      explore: {
        heroValueInk: brandPrimary,
        heroUnitInk: '#9A7A2E',
        heroValueDimmed: '#B8892A',
        warmActivity: brandPrimary,
        activityInfo: cyan,
        amberBand: '#E78B0B',
        amberBandComplete: '#F3940F',
        workTimerCompleteCardBg: COLORS.containerTertiaryTimer,
        workTimerUpNextCardBg: COLORS.containerSecondaryTimer,
        restTimerHeaderInk: '#7A6020',
        restTimerCompletedUnitInk: '#A67C1F',
        skipRestCtaBg: '#052220',
        ctaPillBg: brandPrimary,
        ctaPillText: '#0D0D0D',
        surfaceCurrentCard: forest,
      },
    };
  }

  // v3 — violet / indigo
  const accent = '#A855F7';
  const secondary = '#6366F1';
  const v3Surfaces = accentSurfaces(accent);
  return {
    id,
    colors: {
      ...COLORS,
      ...v3Surfaces,
      secondary,
      secondarySoft: mixHex(secondary, '#121018', 0.55),
      todayIndicator: '#7C3AED',
      info: '#4F46E5',
    },
    explore: {
      heroValueInk: '#C084FC',
      heroUnitInk: '#4B4A5C',
      heroValueDimmed: '#52506B',
      warmActivity: '#C084FC',
      activityInfo: '#6366F1',
      amberBand: '#9333EA',
      amberBandComplete: '#7C3AED',
      workTimerCompleteCardBg: COLORS.containerTertiaryTimer,
      workTimerUpNextCardBg: COLORS.containerSecondaryTimer,
      restTimerHeaderInk: '#78350F',
      restTimerCompletedUnitInk: '#9A3412',
      skipRestCtaBg: '#161616',
      ctaPillBg: '#C084FC',
      ctaPillText: '#1E1B2E',
      surfaceCurrentCard: '#1F1F1F',
    },
  };
}
