import { describe, it, expect } from "vitest";
import {
  coreXpProfileDisplayLevelKey,
  coreXpTierDisplayCodeKey,
} from "./coreXpDisplay";
import { STAGE_NUMBER_MAX } from "../constants";

describe("coreXpProfileDisplayLevelKey", () => {
  it("maps Core XP to display level key (not weekly rank)", () => {
    expect(coreXpProfileDisplayLevelKey(0)).toBe("profile_core_display_level_1");
    expect(coreXpProfileDisplayLevelKey(100)).toBe("profile_core_display_level_2");
    expect(coreXpProfileDisplayLevelKey(600)).toBe(`profile_core_display_level_${STAGE_NUMBER_MAX}`);
  });
});

describe("coreXpTierDisplayCodeKey (245)", () => {
  it("maps Core XP to code index display key", () => {
    expect(coreXpTierDisplayCodeKey(0)).toBe("profile_tier_code_0");
    expect(coreXpTierDisplayCodeKey(1000)).toBe("profile_tier_code_1");
    expect(coreXpTierDisplayCodeKey(6000)).toBe("profile_tier_code_6");
  });
});
