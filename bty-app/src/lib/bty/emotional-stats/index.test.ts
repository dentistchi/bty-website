import { describe, it, expect } from "vitest";
import * as emotionalStats from "./index";

describe("emotional-stats index", () => {
  it("re-exports coreStats (CORE_STAT_IDS, getQualityWeight)", () => {
    expect(emotionalStats.CORE_STAT_IDS).toBeDefined();
    expect(Array.isArray(emotionalStats.CORE_STAT_IDS)).toBe(true);
    expect(typeof emotionalStats.getQualityWeight).toBe("function");
  });

  it("re-exports formula (computeSessionGains)", () => {
    expect(emotionalStats.computeSessionGains).toBeDefined();
    expect(typeof emotionalStats.computeSessionGains).toBe("function");
  });

  it("re-exports phase (getAccelerationFactor)", () => {
    expect(emotionalStats.getAccelerationFactor).toBeDefined();
    expect(typeof emotionalStats.getAccelerationFactor).toBe("function");
  });

  it("re-exports unlock (getUnlockedAdvancedStats)", () => {
    expect(emotionalStats.getUnlockedAdvancedStats).toBeDefined();
    expect(typeof emotionalStats.getUnlockedAdvancedStats).toBe("function");
  });

  it("re-exports antiExploit (shouldApplyReward)", () => {
    expect(emotionalStats.shouldApplyReward).toBeDefined();
    expect(typeof emotionalStats.shouldApplyReward).toBe("function");
  });

  it("re-exports detectEvent (detectEmotionalEventFromText)", () => {
    expect(emotionalStats.detectEmotionalEventFromText).toBeDefined();
    expect(typeof emotionalStats.detectEmotionalEventFromText).toBe("function");
  });

  it("re-exports recordEmotionalEventServer", () => {
    expect(emotionalStats.recordEmotionalEventServer).toBeDefined();
    expect(typeof emotionalStats.recordEmotionalEventServer).toBe("function");
  });
});
