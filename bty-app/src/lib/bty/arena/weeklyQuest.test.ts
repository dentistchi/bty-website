import { describe, it, expect } from "vitest";
import {
  getWeekStartUTC,
  REFLECTION_QUEST_TARGET,
  REFLECTION_QUEST_BONUS_XP,
} from "./weeklyQuest";

describe("weeklyQuest", () => {
  describe("getWeekStartUTC", () => {
    it("returns Monday 00:00 UTC of the same week when given a Monday", () => {
      const monday = new Date("2025-03-03T00:00:00.000Z");
      expect(getWeekStartUTC(monday)).toBe("2025-03-03");
    });

    it("returns previous Monday when given a Sunday (edge: week boundary)", () => {
      const sunday = new Date("2025-03-09T12:00:00.000Z");
      expect(getWeekStartUTC(sunday)).toBe("2025-03-03");
    });

    it("returns that week's Monday when given Wednesday", () => {
      const wed = new Date("2025-03-05T15:30:00.000Z");
      expect(getWeekStartUTC(wed)).toBe("2025-03-03");
    });

    it("returns YYYY-MM-DD string", () => {
      const d = new Date("2025-01-15T00:00:00.000Z");
      const result = getWeekStartUTC(d);
      expect(/^\d{4}-\d{2}-\d{2}$/.test(result)).toBe(true);
    });
  });

  describe("constants", () => {
    it("REFLECTION_QUEST_TARGET is 3", () => {
      expect(REFLECTION_QUEST_TARGET).toBe(3);
    });
    it("REFLECTION_QUEST_BONUS_XP is 15", () => {
      expect(REFLECTION_QUEST_BONUS_XP).toBe(15);
    });
  });
});
