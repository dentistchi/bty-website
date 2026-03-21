/**
 * Arena 19차: leaderboardService edges — buildLeaderboardRows·타입·경계.
 * 기존 동작만 검증, 비즈니스/XP 로직 미변경.
 */
import { describe, it, expect } from "vitest";
import {
  buildLeaderboardRows,
  type WeeklyXpRow,
  type NormalizedProfile,
  type LeaderboardRow,
  type ScopeFilterResult,
  type MyRankInfo,
} from "./leaderboardService";

describe("leaderboardService", () => {
  describe("buildLeaderboardRows", () => {
    it("returns empty array when rows is empty", () => {
      const rows: WeeklyXpRow[] = [];
      const profileMap = new Map<string, NormalizedProfile>();
      expect(buildLeaderboardRows(rows, profileMap)).toEqual([]);
    });

    it("single row with xp_total 0 yields rank 1 and xpTotal 0", () => {
      const rows: WeeklyXpRow[] = [{ user_id: "u0", xp_total: 0 }];
      const profileMap = new Map<string, NormalizedProfile>();
      const result = buildLeaderboardRows(rows, profileMap);
      expect(result).toHaveLength(1);
      expect(result[0].rank).toBe(1);
      expect(result[0].xpTotal).toBe(0);
    });

    it("assigns rank 1-based from index", () => {
      const rows: WeeklyXpRow[] = [
        { user_id: "a", xp_total: 100 },
        { user_id: "b", xp_total: 50 },
      ];
      const profileMap = new Map<string, NormalizedProfile>();
      const result = buildLeaderboardRows(rows, profileMap);
      expect(result).toHaveLength(2);
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
    });

    it("uses xp_total from row and defaults when profile missing", () => {
      const rows: WeeklyXpRow[] = [{ user_id: "u1", xp_total: 250 }];
      const profileMap = new Map<string, NormalizedProfile>();
      const result = buildLeaderboardRows(rows, profileMap);
      expect(result[0].xpTotal).toBe(250);
      expect(result[0].codeName).toBeDefined();
      expect(result[0].subName).toBeDefined();
      expect(result[0].avatar).toEqual({
        characterKey: "hero_01",
        theme: "professional",
        outfitKey: "professional_outfit_scrub_general",
        accessoryKeys: [],
      });
      expect(result[0].tier).toBeDefined();
    });

    it("uses profile when present for code_index and sub_name", () => {
      const rows: WeeklyXpRow[] = [{ user_id: "u1", xp_total: 150 }];
      const profileMap = new Map<string, NormalizedProfile>([
        [
          "u1",
          {
            core_xp_total: 150,
            code_index: 1,
            sub_name: "Custom",
            avatar_url: null,
            avatar_character_id: null,
            avatar_outfit_theme: null,
            avatar_selected_outfit_id: null,
            avatar_accessory_ids: [],
          },
        ],
      ]);
      const result = buildLeaderboardRows(rows, profileMap);
      expect(result[0].codeName).toBe("PULSE");
      expect(result[0].subName).toBe("Custom");
      expect(result[0].avatarUrl).toBeDefined();
    });

    it("uses code_index 6 from profile for CODELESS ZONE", () => {
      const rows: WeeklyXpRow[] = [{ user_id: "u1", xp_total: 0 }];
      const profileMap = new Map<string, NormalizedProfile>([
        [
          "u1",
          {
            core_xp_total: 0,
            code_index: 6,
            sub_name: null,
            avatar_url: null,
            avatar_character_id: null,
            avatar_outfit_theme: null,
            avatar_selected_outfit_id: null,
            avatar_accessory_ids: [],
          },
        ],
      ]);
      const result = buildLeaderboardRows(rows, profileMap);
      expect(result[0].codeName).toBe("CODELESS ZONE");
    });

    it("returns LeaderboardRow shape with tier from weekly XP", () => {
      const rows: WeeklyXpRow[] = [{ user_id: "u1", xp_total: 200, updated_at: null }];
      const profileMap = new Map<string, NormalizedProfile>();
      const result = buildLeaderboardRows(rows, profileMap);
      const row = result[0] as LeaderboardRow;
      expect(row).toHaveProperty("rank");
      expect(row).toHaveProperty("codeName");
      expect(row).toHaveProperty("subName");
      expect(row).toHaveProperty("xpTotal");
      expect(row).toHaveProperty("avatarUrl");
      expect(row).toHaveProperty("avatar");
      expect(row).toHaveProperty("tier");
      expect(typeof row.tier).toBe("string");
    });
  });

  describe("types", () => {
    it("ScopeFilterResult allows userIds and scopeLabel", () => {
      const s: ScopeFilterResult = { userIds: ["a"], scopeLabel: "Role" };
      expect(s.userIds).toEqual(["a"]);
      expect(s.scopeLabel).toBe("Role");
    });

    it("MyRankInfo has myRank, myXp, gapToAbove", () => {
      const m: MyRankInfo = { myRank: 1, myXp: 100, gapToAbove: null };
      expect(m.myRank).toBe(1);
      expect(m.myXp).toBe(100);
      expect(m.gapToAbove).toBeNull();
    });
  });
});
