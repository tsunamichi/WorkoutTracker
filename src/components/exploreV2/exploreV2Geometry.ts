import { EXPLORE_V2 } from './exploreV2Tokens';

export type ExploreV2RadiusTokens = {
  shellRadius: number;
  frontBottomRadius: number;
  coveredBottomRadius: number;
};

export type ExploreV2CardGeometry = {
  stackShellSideInset: number;
  stackShellBottomInset: number;
  stackWidth: number;
  stackShellRadius: number;
  topCardRadius: number;
  frontCardBottomRadius: number;
  coveredCardBottomRadius: number;
};

type GeometryInput = {
  screenWidth: number;
  bottomInset: number;
  preferredSideInset?: number;
  preferredBottomInset?: number;
  topCardRadius?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Width-bucket radius tuning for iPhone-like surfaces.
 * Small safe-area adjustment keeps corners from feeling too sharp on flat-bottom devices.
 */
export function getExploreV2RadiusTokens(screenWidth: number, bottomInset: number): ExploreV2RadiusTokens {
  let shellRadius: number;
  if (screenWidth <= 375) shellRadius = 30; // compact
  else if (screenWidth <= 430) shellRadius = 34; // standard
  else shellRadius = 38; // large/max

  const safeAreaAdjust = bottomInset >= 30 ? 1 : -1;
  const adjustedBase = shellRadius + safeAreaAdjust;
  const boostedShell = adjustedBase * 1.6; // requested: increase bottom radius by 60%
  shellRadius = clamp(Math.round(boostedShell), 45, 64);
  const frontBottomRadius = shellRadius;
  const coveredBottomRadius = clamp(Math.round((adjustedBase - 4) * 1.6), 36, 56);

  return { shellRadius, frontBottomRadius, coveredBottomRadius };
}

/**
 * Explore v2 shell-first geometry model.
 * Insets stay stable; only radii are bucket-tuned.
 */
export function getExploreV2CardGeometry({
  screenWidth,
  bottomInset,
  preferredSideInset = EXPLORE_V2.margin,
  preferredBottomInset = EXPLORE_V2.margin,
  topCardRadius = EXPLORE_V2.cardTopRadius,
}: GeometryInput): ExploreV2CardGeometry {
  const stackShellSideInset = screenWidth >= 430
    ? Math.max(preferredSideInset, 10)
    : Math.max(preferredSideInset, 8);
  const stackShellBottomInset = clamp(preferredBottomInset + (bottomInset > 0 ? -1 : -2), 2, 3);
  const stackWidth = Math.max(0, screenWidth - (stackShellSideInset * 2));
  const radius = getExploreV2RadiusTokens(screenWidth, bottomInset);

  return {
    stackShellSideInset,
    stackShellBottomInset,
    stackWidth,
    stackShellRadius: radius.shellRadius,
    topCardRadius,
    frontCardBottomRadius: radius.frontBottomRadius,
    coveredCardBottomRadius: radius.coveredBottomRadius,
  };
}
