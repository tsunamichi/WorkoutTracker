/** `fontFamily` key passed to `useFonts` in App.tsx — must match exactly in styles. */
export const FONT_OUTFIT_MEDIUM = 'OutfitMedium';

/** Hero numerals: Current card, explore-v2 timers, homepage deck index. Do not set fontWeight alongside this. */
export const outfitNumericStyle = {
  fontFamily: FONT_OUTFIT_MEDIUM,
} as const;
