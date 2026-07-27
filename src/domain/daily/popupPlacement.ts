/**
 * Collision-aware inline-popup placement (pure) — kept from B3A.2D-R3 for the Me weekly popover.
 * Prefer ABOVE the anchor (the approved anchor); flip BELOW when the above-placement top would
 * cross the top safe area, provided below fits; if neither fits fully, stay above (the caller
 * applies a compact max-height with internal scroll).
 */
export function choosePopupPlacement(p: {
  anchorTop: number;
  anchorBottom: number;
  popupHeight: number;
  viewportHeight: number;
  safeTop?: number;
  safeBottom?: number;
  margin?: number;
}): "above" | "below" {
  const safeTop = p.safeTop ?? 0;
  const safeBottom = p.safeBottom ?? 0;
  const margin = p.margin ?? 8;
  const topIfAbove = p.anchorTop - margin - p.popupHeight;
  if (topIfAbove >= safeTop) return "above";
  const bottomIfBelow = p.anchorBottom + margin + p.popupHeight;
  if (bottomIfBelow <= p.viewportHeight - safeBottom) return "below";
  return "above";
}
