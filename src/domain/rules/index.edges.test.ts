/**
 * domain/rules/index — re-export 경계 테스트.
 * index.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import * as rules from "./index";

describe("domain/rules/index (edges)", () => {
  it("leaderboardSort from barrel sorts by weeklyXp desc", () => {
    const entries = [{ userId: "a", xpTotal: 10 }, { userId: "b", xpTotal: 20 }];
    const sorted = rules.leaderboardSort(entries);
    expect(sorted[0].xpTotal).toBe(20);
    expect(sorted[1].xpTotal).toBe(10);
  });
});
