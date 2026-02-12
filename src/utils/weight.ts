const LB_PER_KG = 2.2046226218;

export const lbsToKg = (lbs: number): number => lbs / LB_PER_KG;
export const kgToLbs = (kg: number): number => kg * LB_PER_KG;

const roundTo = (value: number, decimals: number): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};

const roundToIncrement = (value: number, increment: number): number =>
  Math.round(value / increment) * increment;

const getIncrementDecimals = (increment: number): number => {
  if (increment % 1 === 0) return 0;
  if ((increment * 10) % 1 === 0) return 1;
  return 2;
};

export const toDisplayWeight = (weightLbs: number, useKg: boolean): number =>
  useKg ? lbsToKg(weightLbs) : weightLbs;

export const fromDisplayWeight = (weight: number, useKg: boolean): number =>
  useKg ? kgToLbs(weight) : weight;

export const formatWeight = (weightLbs: number, useKg: boolean): string => {
  const value = toDisplayWeight(weightLbs, useKg);
  const rounded = roundTo(value, useKg ? 1 : 1);
  const asString = rounded.toFixed(rounded % 1 === 0 ? 0 : 1);
  return asString;
};

export const formatWeightForLoad = (weightLbs: number, useKg: boolean): string => {
  const value = toDisplayWeight(weightLbs, useKg);
  const increment = 0.5;
  const rounded = roundToIncrement(value, increment);
  const asString = rounded.toFixed(rounded % 1 === 0 ? 0 : 1);
  return asString;
};
