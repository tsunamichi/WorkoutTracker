/**
 * Default (v1) color tokens used only to build `AppTheme` and static token tables in `constants`.
 * App code should use `useAppTheme().colors` (e.g. `themeColors.textMeta`), not this export.
 */
import { adjustLightness, hexToRgba } from './colorUtils';

const ACCENT_PRIMARY = '#FFA424';
const ACCENT_PRIMARY_SOFT = hexToRgba(ACCENT_PRIMARY, 0.6);
const ACCENT_PRIMARY_BACKGROUND = hexToRgba(ACCENT_PRIMARY, 0.16);
const SIGNAL_NEGATIVE = '#FF453A';
const BASE_GREEN = '#00351D';
const SIGNAL_POSITIVE = BASE_GREEN;
const BASE_FAILURE = '#FF005B';
const BASE_INFO = '#062FFF';
const SIGNAL_WARNING = '#FFD60A';
const BORDER_DIMMED = 'rgba(255, 255, 255, 0.06)';

const CONTAINER_SECONDARY = '#D9D9D9';
const ACCENT_SECONDARY = '#58A186';
const ACCENT_SECONDARY_SOFT = '#CFF0EE';
const ACCENT_SECONDARY_DISABLED = hexToRgba(ACCENT_SECONDARY_SOFT, 0.2);

export const basePalette = {
  // Core colors — dark palette
  background: '#121212', // Default background
  backgroundCanvas: '#0D0D0D', // Page/canvas background
  /** Light page canvas (schedule, explore-style) */
  canvasLight: '#F5F4F4',
  /** Primary ink on light canvas — text, icons, dark surfaces */
  inkCharcoal: '#1F1F1F',
  /** Mid gray surface (Up Next idle, section bands) */
  containerSecondary: CONTAINER_SECONDARY,
  /** Spec container-primary — primary dark surfaces (e.g. execution current card) */
  containerPrimary: '#002E29',
  /** Spec container-primary-dark — dark teal container used under pie remainders */
  containerPrimaryDark: '#011D1B',
  /** Spec container-tertiary — lighter surfaces (e.g. selected calendar pill, Up Next add CTA) */
  containerTertiary: '#CBE659',
  /** Text/icons on `container-primary` / dark hero card surfaces */
  textOnPrimary: CONTAINER_SECONDARY,
  backgroundContainer: '#1C1C1E', // Header/nav/card containers
  canvas: '#1C1C1E', // Card/container background
  container: '#2C2C2E', // Elevated secondary container
  cardBackground: '#1C1C1E', // Card background
  activeCard: '#1C1C1E', // Active/selected card state
  /** Settings/profile card containers on light surfaces */
  canvasContainer: '#1C1C1E',
  /** Active cycle strip and pill background (backgroundCanvas at 30% opacity) */
  cycleStripBackground: 'rgba(13, 13, 13, 0.3)',

  // Primary actions
  primary: ACCENT_PRIMARY, // Spec accent-primary
  primarySoft: '#1A1C0D', // Very dark lime tint

  // Secondary/accent
  secondary: '#007AFF', // Blue
  secondarySoft: '#1C2A3A', // Soft blue background
  accentPrimary: ACCENT_PRIMARY,
  accentPrimarySoft: ACCENT_PRIMARY_SOFT,
  accentPrimaryBackground: ACCENT_PRIMARY_BACKGROUND,
  accentPrimaryLight: adjustLightness(ACCENT_PRIMARY, 15),
  accentPrimaryDark: '#8C5509',
  todayIndicator: BASE_INFO, // Current day label & selected box
  accentPrimaryDimmed: '#372E1A', // Subtle lime tint bg for selected states
  /** Spec accent-secondary (teal) */
  accentSecondary: ACCENT_SECONDARY,
  /** Spec accent-secondary-soft — schedule pie incomplete, muted teal surfaces */
  accentSecondarySoft: ACCENT_SECONDARY_SOFT,
  /** Spec accent-secondary-disabled — disabled content on light surfaces */
  accentSecondaryDisabled: ACCENT_SECONDARY_DISABLED,
  /** Work timer (time-based) — page tint */
  backgroundTimer: '#C1FF24',
  /** Work timer — Completed card surface */
  containerTertiaryTimer: '#B1EF15',
  /** Work timer — Up Next card surface */
  containerSecondaryTimer: '#9BD508',
  /** accent-secondary @ 60% — work-timer header chrome (Complete / Up Next) */
  textMetaTimer: hexToRgba(ACCENT_SECONDARY, 0.6),
  /** Workout completion stacked numerals — middle trail echo */
  celebrationTrailMid: '#9960FB',

  // Text — white on dark
  text: '#FFFFFF', // Default text color
  textPrimary: '#1F1F1F', // Primary text
  textSecondary: '#AEAEB2', // Secondary text
  /** Spec text-meta (light canvas) */
  textMeta: '#685456',
  textMetaSoft: '#48484A', // Soft metadata/dividers
  textDisabled: '#48484A', // Disabled text

  // Borders & dividers — very subtle on dark
  border: 'rgba(88, 88, 88, 0.2)', // #585858 @ 20%
  disabledBorder: '#38383A', // Disabled button border
  borderDimmed: BORDER_DIMMED, // Dimmed dividers
  divider: BORDER_DIMMED, // Dividers
  overlay: 'rgba(0, 0, 0, 0.5)', // Bottom sheet overlays
  containerBackground: '#1C1C1E', // Container background

  // Status colors
  signalNegative: SIGNAL_NEGATIVE,
  signalPositive: SIGNAL_POSITIVE,
  signalWarning: SIGNAL_WARNING,
  signalWarningDimmed: 'rgba(255, 214, 10, 0.15)',
  signalNegativeDimmed: 'rgba(255, 69, 58, 0.15)',
  success: SIGNAL_POSITIVE,
  successBright: '#06FF8F',
  successDark: adjustLightness(BASE_GREEN, 10),
  successDimmed: '#142A22',
  failure: BASE_FAILURE,
  failureBright: adjustLightness(BASE_FAILURE, 40),
  info: BASE_INFO,
  infoBright: adjustLightness(BASE_INFO, 40),
  infoDimmed: '#0f1528',
  warning: SIGNAL_WARNING,
  error: SIGNAL_NEGATIVE,

  // Exercise categories
  chest: SIGNAL_NEGATIVE,
  back: '#4ECDC4',
  legs: SIGNAL_WARNING,
  shoulders: '#A8E6CF',
  arms: '#FF8B94',
  core: '#C7CEEA',
};
