/**
 * domain/types — shape checks for domain type contracts (no business/XP logic).
 */
import { describe, it, expect } from "vitest";
import type {
  LeaderboardEntryDomain,
  StageState,
  SeasonWindow,
  LeaderboardIdentity,
  SeasonalToCoreResult,
} from "./types";

describe("domain/types", () => {
  it("LeaderboardEntryDomain has required keys", () => {
    const entry: LeaderboardEntryDomain = {
      rank: 1,
      weeklyXp: 100,
      coreXp: 500,
      codeName: "FORGE",
      subName: "Spark",
    };
    expect(entry).toMatchObject({
      rank: 1,
      weeklyXp: 100,
      coreXp: 500,
      codeName: "FORGE",
      subName: "Spark",
    });
    expect(Object.keys(entry).sort()).toEqual(
      ["rank", "weeklyXp", "coreXp", "codeName", "subName"].sort()
    );
  });

  it("StageState has required keys", () => {
    const state: StageState = {
      tier: 1,
      codeIndex: 0,
      subTierGroup: 0,
      stageNumber: 1,
      codeName: "FORGE",
      subName: "Spark",
    };
    expect(state.tier).toBe(1);
    expect(state.codeIndex).toBe(0);
    expect(state.codeName).toBe("FORGE");
    expect(Object.keys(state).sort()).toEqual(
      ["tier", "codeIndex", "subTierGroup", "stageNumber", "codeName", "subName"].sort()
    );
  });

  it("SeasonWindow has required keys", () => {
    const w: SeasonWindow = {
      id: "s1",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    };
    expect(w.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(w.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Object.keys(w)).toContain("id");
  });

  it("LeaderboardIdentity has codeIndex, codeName, subName", () => {
    const id: LeaderboardIdentity = {
      codeIndex: 2,
      codeName: "FRAME",
      subName: "Outline",
    };
    expect(id.codeIndex).toBe(2);
    expect(id.codeName).toBe("FRAME");
    expect(id.subName).toBe("Outline");
  });

  it("SeasonalToCoreResult has rate, coreGain, fractionalBuffer", () => {
    const r: SeasonalToCoreResult = {
      rate: 60,
      coreGain: 1,
      fractionalBuffer: 0.5,
    };
    expect(r.rate).toBe(60);
    expect(r.coreGain).toBe(1);
    expect(r.fractionalBuffer).toBe(0.5);
  });
});
