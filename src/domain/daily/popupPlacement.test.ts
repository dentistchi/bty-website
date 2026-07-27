import { describe, it, expect } from "vitest";
import { choosePopupPlacement } from "./popupPlacement";

describe("choosePopupPlacement — collision-aware inline placement (B3A.2D-R3)", () => {
  it("prefers above when it fits below the top safe area", () => {
    expect(choosePopupPlacement({ anchorTop: 400, anchorBottom: 600, popupHeight: 120, viewportHeight: 800, safeTop: 56, margin: 10 })).toBe("above");
  });
  it("flips below when the above-top would cross the top safe area", () => {
    expect(choosePopupPlacement({ anchorTop: 100, anchorBottom: 300, popupHeight: 120, viewportHeight: 800, safeTop: 56, margin: 10 })).toBe("below");
  });
  it("falls back to above (with internal scroll) when neither fully fits", () => {
    expect(choosePopupPlacement({ anchorTop: 100, anchorBottom: 300, popupHeight: 700, viewportHeight: 800, safeTop: 56, margin: 10 })).toBe("above");
  });
});
