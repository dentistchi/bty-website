/**
 * Leaderboard rules 도메인 경계 테스트.
 * leaderboard.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import {
  rankByWeeklyXpOnly,
  rankByWeeklyXpWithTieBreak,
  eliteCutoffRank,
  isElite,
  rankFromCountAbove,
  weeklyRankFromCounts,
  weeklyCompetitionDisplay,
  leaderboardLiveRowsAreDisplaySafeOrder,
} from "./leaderboard";

describe("domain/rules/leaderboard (edges)", () => {
  it("rankByWeeklyXpOnly empty array returns empty array", () => {
    const result = rankByWeeklyXpOnly([]);
    expect(result).toEqual([]);
  });

  it("rankByWeeklyXpOnly: same weeklyXp keeps stable order (not tiebreak rule)", () => {
    const entries = [
      { id: "a", weeklyXp: 100 },
      { id: "b", weeklyXp: 100 },
      { id: "c", weeklyXp: 50 },
    ];
    const result = rankByWeeklyXpOnly(entries);
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(result[0].weeklyXp).toBe(100);
    expect(result[1].weeklyXp).toBe(100);
  });

  it("eliteCutoffRank for small totalEntries", () => {
    expect(eliteCutoffRank(20)).toBe(1);
    expect(eliteCutoffRank(21)).toBe(2);
  });

  it("isElite at boundary rank", () => {
    expect(isElite(1, 1)).toBe(true);
    expect(isElite(2, 1)).toBe(false);
  });

  it("rankFromCountAbove handles countAbove 0 and totalCount 1", () => {
    expect(rankFromCountAbove(1, 0)).toBe(1);
  });

  it("weeklyRankFromCounts totalCount 1 returns rank 1 and isTop5Percent true", () => {
    const r = weeklyRankFromCounts(1, 0);
    expect(r.rank).toBe(1);
    expect(r.isTop5Percent).toBe(true);
  });

  it("weeklyRankFromCounts totalCount 0 returns rank 0 and isTop5Percent false", () => {
    const r = weeklyRankFromCounts(0, 0);
    expect(r.rank).toBe(0);
    expect(r.isTop5Percent).toBe(false);
  });

  it("eliteCutoffRank(0) returns 1", () => {
    expect(eliteCutoffRank(0)).toBe(1);
  });

  /** C6 237: weekly tier from XP still computed; elite off when no leaderboard rows. */
  it("weeklyCompetitionDisplay: totalLeaderboardEntries 0 → not elite regardless of rank", () => {
    const d = weeklyCompetitionDisplay({
      weeklyXpTotal: 200,
      rank: 1,
      totalLeaderboardEntries: 0,
    });
    expect(d.isWeeklyElite).toBe(false);
    expect(d.weeklyTier).toBeTruthy();
  });

  /** 238: 랭킹은 Weekly XP만; 시즌·Core XP 필드가 있어도 순서 불변. */
  /** 242: 시즌·리그 메타필드가 있어도 정렬 키는 weekly+타이브레이크뿐. */
  it("rankByWeeklyXpWithTieBreak: season_id·league_stage ignored for order", () => {
    const r = rankByWeeklyXpWithTieBreak([
      {
        weeklyXp: 20,
        updatedAt: null,
        userId: "zebra",
        season_id: "S1",
        league_stage: 1,
      },
      {
        weeklyXp: 20,
        updatedAt: null,
        userId: "alpha",
        season_id: "S99",
        league_stage: 99,
      },
    ]);
    expect(r[0]!.userId).toBe("alpha");
    expect(r[1]!.userId).toBe("zebra");
  });

  it("rankByWeeklyXpOnly: higher coreXp/season fields do not reorder — weekly XP only", () => {
    const rows = [
      {
        id: "a",
        weeklyXp: 50,
        coreXp: 50_000,
        seasonId: "S99",
        leagueTier: "mythic",
      },
      {
        id: "b",
        weeklyXp: 200,
        coreXp: 10,
        seasonId: "S1",
        leagueTier: "bronze",
      },
      {
        id: "c",
        weeklyXp: 200,
        coreXp: 999,
        seasonId: "S2",
        leagueTier: "gold",
      },
    ];
    const ranked = rankByWeeklyXpOnly(rows);
    expect(ranked.map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(ranked[0].weeklyXp).toBe(200);
    expect(ranked[2].weeklyXp).toBe(50);
  });

  /** 241: 라이브 행은 API rank 연속 순서 유지; 동점 시 타이브레이크는 API 전용(클라 임의 정렬 금지). */
  it("leaderboardLiveRowsAreDisplaySafeOrder: strict rank 1..n; tie order API-owned", () => {
    const apiOrdered = rankByWeeklyXpWithTieBreak([
      { weeklyXp: 100, updatedAt: "2026-01-01Z", userId: "alice" },
      { weeklyXp: 100, updatedAt: "2026-01-01Z", userId: "bob" },
    ]);
    const rows = apiOrdered.map((r) => ({
      rank: r.rank,
      weeklyXp: r.weeklyXp,
      userId: r.userId,
    }));
    expect(leaderboardLiveRowsAreDisplaySafeOrder(rows)).toBe(true);
    expect(rows[0]!.userId).toBe("alice");
    const clientByNameDesc = [...rows].sort((a, b) => b.userId.localeCompare(a.userId));
    expect(clientByNameDesc[0]!.userId).toBe("bob");
  });

  it("leaderboardLiveRowsAreDisplaySafeOrder rejects gap or wrong start", () => {
    expect(
      leaderboardLiveRowsAreDisplaySafeOrder([
        { rank: 1, weeklyXp: 10, userId: "a" },
        { rank: 3, weeklyXp: 9, userId: "b" },
      ])
    ).toBe(false);
    expect(
      leaderboardLiveRowsAreDisplaySafeOrder([{ rank: 2, weeklyXp: 10, userId: "a" }])
    ).toBe(false);
  });
});
