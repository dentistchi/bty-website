import { describe, it, expect } from "vitest";
import {
  ASSET_UNLOCK_MAP,
  diffNewlyUnlockedAssets,
  getAssetUnlockMap,
  unlockedAssetsForTier,
} from "./avatar-assets.service";

describe("avatar-assets.service", () => {
  it("getAssetUnlockMap matches ASSET_UNLOCK_MAP", () => {
    expect(getAssetUnlockMap()).toBe(ASSET_UNLOCK_MAP);
  });

  it("diffNewlyUnlockedAssets 0→1 adds tier-1 grants only", () => {
    const d = diffNewlyUnlockedAssets(0, 1);
    expect(d).toEqual(ASSET_UNLOCK_MAP[1]);
  });

  it("diffNewlyUnlockedAssets 1→3 adds tier 2 and 3 grants", () => {
    const d = diffNewlyUnlockedAssets(1, 3);
    expect(new Set(d)).toEqual(
      new Set([...ASSET_UNLOCK_MAP[2], ...ASSET_UNLOCK_MAP[3]]),
    );
  });

  it("unlockedAssetsForTier is cumulative", () => {
    expect(unlockedAssetsForTier(4).length).toBeGreaterThan(unlockedAssetsForTier(0).length);
    expect(unlockedAssetsForTier(4)).toEqual(
      expect.arrayContaining(unlockedAssetsForTier(0)),
    );
  });
});
