/** Deterministic chart geometry — tweak here only. */
export const HISTORY_CHART = {
  /** Fixed layout cell — dot face matches the slot (38×38). */
  slotSize: 38,
  /** Selected-day indicator strip at bottom of the dot face. */
  selectionCapHeight: 7,
  /**
   * Concentric with the dot — cap arc is from this inner circle, so
   * `(slotSize - selectionInnerDiameter) / 2` gap to the dot edge (1px at 38).
   */
  selectionInnerDiameter: 36,
  rowGap: 16,
  headerToGridGap: 12,
  sundayNumberSize: 12,
} as const;
