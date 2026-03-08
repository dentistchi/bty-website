import { describe, it, expect } from "vitest";
import { applySeasonalXpToCore } from "./applyCoreXp";

describe("applyCoreXp", () => {
  it("returns zero gain when seasonalXp <= 0", async () => {
    const mockSupabase = {} as Parameters<typeof applySeasonalXpToCore>[0];
    const result = await applySeasonalXpToCore(mockSupabase, "user-1", 0);
    expect(result).toEqual({ coreGain: 0, newCoreTotal: 0 });
  });
});
