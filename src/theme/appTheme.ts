/**
 * App color themes — accents + Explore execution chrome only.
 * Structural neutrals (canvas, ink, card grays) stay on COLORS.
 */

import { COLORS, hexToRgba } from '../constants';
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
  /**
   * Workout card face (schedule deck + Explore Current). In `buildAppTheme`, keep this equal to
   * `colors.containerPrimary` for each id so execution and schedule never drift.
   */
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

export function normalizeColorThemeId(raw: unknown): AppColorThemeId {
  if (raw === 'v1' || raw === 'v2') return raw;
  return 'v1';
}

export function buildAppTheme(id: AppColorThemeId): AppTheme {
  if (id === 'v1') {
    /** Forest card + spec accent-primary (#FFA424) + cyan accents (Schedule + Explore execution). */
    const brandPrimary = COLORS.accentPrimary;
    const cyan = '#26C2B4';
    const forest = '#002E29';
    return {
      id,
      colors: {
        ...COLORS,
        ...accentSurfaces(brandPrimary),
        accentPrimaryDark: '#8C5509',
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

  if (id === 'v2') {
    /** v1 palette copy with targeted v2 container/canvas overrides. */
    const brandPrimary = COLORS.accentPrimary;
    const cyan = '#26C2B4';
    const containerPrimaryV2 = '#133011';
    const canvasLightV2 = '#E6DCE1';
    const canvasContainerV2 = '#EDE5E9';
    const containerTertiaryV2 = '#E0FB60';
    const containerSecondaryV2 = '#CBE659';

    return {
      id: 'v2',
      colors: {
        ...COLORS,
        ...accentSurfaces(brandPrimary),
        accentPrimaryDark: '#8C5509',
        secondary: cyan,
        secondarySoft: mixHex(cyan, '#121018', 0.5),
        todayIndicator: mixHex(cyan, '#121018', 0.22),
        info: mixHex(cyan, '#062A26', 0.35),
        canvasLight: canvasLightV2,
        canvasContainer: canvasContainerV2,
        containerPrimary: containerPrimaryV2,
        containerSecondary: containerSecondaryV2,
        containerTertiary: containerTertiaryV2,
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
        surfaceCurrentCard: containerPrimaryV2,
      },
    };
  }

  return buildAppTheme('v1');
}
