/**
 * leadership-engine/lri — 경계 테스트.
 * lri.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import { normalizePersonalPulse, canApproveLeaderTrack } from "./lri";

describe("lri (edges)", () => {
  it("normalizePersonalPulse(5) returns 1", () => {
    expect(normalizePersonalPulse(5)).toBe(1);
  });

  it("canApproveLeaderTrack(false, false) returns false", () => {
    expect(canApproveLeaderTrack(false, false)).toBe(false);
  });
});
