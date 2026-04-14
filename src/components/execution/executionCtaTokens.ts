import type { TextStyle, ViewStyle } from 'react-native';
import { SPACING, TYPOGRAPHY } from '../../constants';

/** Shared height for primary / secondary CTAs on exercise execution and timer flows. */
export const EXECUTION_CTA_HEIGHT = 56;

/** Horizontal padding inside labeled execution CTAs (`SPACING.xxl` = 24px). */
export const EXECUTION_CTA_PADDING_H = SPACING.xxl;

/** Horizontal gap between adjacent side-by-side CTAs in a row (`SPACING.lg` = 16px). */
export const EXECUTION_CTA_ROW_GAP = SPACING.lg;

/** Label typography: body size, regular weight, centered. */
export const executionCtaLabelStyle: TextStyle = {
  ...TYPOGRAPHY.body,
  fontWeight: '400',
  textAlign: 'center',
};

/** Fixed-height touch target (standalone pill / sheet button, text-only CTAs). */
export const executionCtaTouchableFixed: ViewStyle = {
  height: EXECUTION_CTA_HEIGHT,
  minHeight: EXECUTION_CTA_HEIGHT,
  paddingHorizontal: EXECUTION_CTA_PADDING_H,
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

/** Fill parent (e.g. tinted card) while keeping horizontal inset and vertical centering. */
export const executionCtaTouchableFill: ViewStyle = {
  width: '100%',
  height: '100%',
  paddingHorizontal: EXECUTION_CTA_PADDING_H,
  alignItems: 'center',
  justifyContent: 'center',
};
