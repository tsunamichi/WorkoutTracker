/** Deterministic chart geometry — tweak here only. */
export const HISTORY_CHART = {
  /**
   * Fixed layout cell — measured size for grid (ring is drawn outside via absolute
   * offset and must not change this box).
   */
  slotSize: 38,
  /** Unselected day — filled circle centered in the slot. */
  unselectedFaceDiameter: 30,
  /** Selected day — inner fill is full slot (38×38). */
  selectedFaceDiameter: 38,
  /**
   * Ring thickness **outside** the 38×38 face. Ring is larger than the slot and
   * positioned with a negative offset so layout / flex spacing stays on `slotSize`.
   */
  selectionRingWidth: 3,
  rowGap: 16,
  headerToGridGap: 12,
  sundayNumberSize: 12,
} as const;

/** Outer diameter of the selection ring (does not affect layout slot). */
export const HISTORY_CHART_RING_OUTER =
  HISTORY_CHART.slotSize + 2 * HISTORY_CHART.selectionRingWidth;

/** Position ring so it’s centered on the slot while extending past the slot bounds. */
export const HISTORY_CHART_RING_OFFSET =
  (HISTORY_CHART.slotSize - HISTORY_CHART_RING_OUTER) / 2;
