/**
 * domain/leadership-engine/index — barrel re-exports 검증 (비즈니스/XP 미변경).
 */
import { describe, it, expect } from "vitest";
import * as le from "./index";

describe("domain/leadership-engine/index", () => {
  it("re-exports stages (STAGE_1, STAGES)", () => {
    expect(le.STAGE_1).toBe(1);
    expect(le.STAGES).toBeDefined();
    expect(le.STAGES).toHaveLength(4);
  });

  it("re-exports air constants", () => {
    expect(le.WEIGHT_MICRO_WIN).toBe(1);
    expect(le.WEIGHT_RESET).toBe(2);
  });

  it("re-exports tii constants", () => {
    expect(le.TII_WEIGHT_AIR).toBe(0.6);
    expect(le.TII_WEIGHT_MWD).toBe(0.25);
  });
});
