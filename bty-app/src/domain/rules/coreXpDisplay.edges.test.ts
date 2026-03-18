/**
 * Core XP 표시 키 — 음수·비정상 입력 경계 (SPRINT 47 TASK 8 / 253 C3).
 * 주간 랭킹과 무관; 표시용 키만.
 */
import { describe, it, expect } from "vitest";
import {
  coreXpProfileDisplayLevelKey,
  coreXpTierDisplayCodeKey,
} from "./coreXpDisplay";
import { STAGE_NUMBER_MAX } from "../constants";

describe("coreXpDisplay edges (253)", () => {
  it("negative Core XP maps to stage 1 / tier code 0 (clamp)", () => {
    expect(coreXpProfileDisplayLevelKey(-1)).toBe("profile_core_display_level_1");
    expect(coreXpProfileDisplayLevelKey(-999)).toBe("profile_core_display_level_1");
    expect(coreXpTierDisplayCodeKey(-50)).toBe("profile_tier_code_0");
  });

  it("very large Core XP caps at max stage and max code index (display only)", () => {
    expect(coreXpProfileDisplayLevelKey(1e9)).toBe(
      `profile_core_display_level_${STAGE_NUMBER_MAX}`
    );
    expect(coreXpTierDisplayCodeKey(1e9)).toBe("profile_tier_code_6");
  });
});
