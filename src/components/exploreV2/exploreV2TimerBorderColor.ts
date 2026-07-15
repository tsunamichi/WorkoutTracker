import { interpolateColor } from 'react-native-reanimated';

export type ExploreV2CardBorderPalette = {
  pageIdle: string;
  pageRest: string;
  pageWork: string;
};

/** Card rim color — tracks Explore v2 page fill (idle / rest / work timer). */
export function exploreV2CardBorderColor(
  restThemeProgress: number,
  workTimerProgress: number,
  colors: ExploreV2CardBorderPalette,
): string {
  'worklet';
  const pRest = restThemeProgress * (1 - workTimerProgress);
  const pWork = restThemeProgress * workTimerProgress;
  const restBorder = interpolateColor(pRest, [0, 1], [colors.pageIdle, colors.pageRest]);
  return interpolateColor(pWork, [0, 1], [restBorder, colors.pageWork]);
}
