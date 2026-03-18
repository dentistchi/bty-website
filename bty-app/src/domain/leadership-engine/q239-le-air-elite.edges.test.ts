/**
 * C6 239 — LE·AIR·Elite 판별 도메인 엣지 (AIR 밴드 경계·주간 Elite 컷오프).
 */
import { describe, it, expect } from "vitest";
import {
  airToBand,
  AIR_BAND_LOW_MID,
  AIR_BAND_MID_HIGH,
} from "./air";
import { isElite, eliteCutoffRank } from "../rules/leaderboard";

describe("239 LE·AIR·Elite domain edges", () => {
  it("AIR: just below LOW_MID is low; just below MID_HIGH is mid", () => {
    expect(airToBand(AIR_BAND_LOW_MID - 1e-6)).toBe("low");
    expect(airToBand(AIR_BAND_LOW_MID)).toBe("mid");
    expect(airToBand(AIR_BAND_MID_HIGH - 1e-6)).toBe("mid");
    expect(airToBand(AIR_BAND_MID_HIGH)).toBe("high");
  });

  it("Elite: rank at eliteCutoffRank inclusive; rank+1 exclusive", () => {
    const n = 73;
    const c = eliteCutoffRank(n);
    expect(isElite(c, n)).toBe(true);
    expect(isElite(c + 1, n)).toBe(false);
  });
});
