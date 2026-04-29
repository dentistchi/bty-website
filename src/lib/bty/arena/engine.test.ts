/**
 * arena/engine — computeXp, pickSystemMessageId, evaluateChoice, evaluateFollowUp 단위 테스트.
 */
import { describe, it, expect } from "vitest";
import {
  INTEGRITY_BONUS_XP,
  computeXp,
  pickSystemMessageId,
  evaluateChoice,
  evaluateFollowUp,
} from "./engine";

describe("arena/engine", () => {
  describe("INTEGRITY_BONUS_XP", () => {
    it("is 5", () => {
      expect(INTEGRITY_BONUS_XP).toBe(5);
    });
  });

  describe("computeXp", () => {
    it("returns round(xpBase * difficulty)", () => {
      expect(computeXp(40, 1.2)).toBe(48);
      expect(computeXp(85, 0.9)).toBe(77);
    });
    it("defaults difficulty to 1", () => {
      expect(computeXp(50)).toBe(50);
    });
    it("returns >= 0", () => {
      expect(computeXp(-10, 1)).toBe(0);
    });
    it("handles invalid inputs as 0", () => {
      expect(computeXp(NaN, 1)).toBe(0);
      expect(computeXp(50, NaN)).toBe(0);
    });
  });

  describe("pickSystemMessageId", () => {
    it("returns gratitude when gratitude >= 2", () => {
      expect(pickSystemMessageId({ xp: 0, deltas: { gratitude: 2 } })).toBe("gratitude");
    });
    it("returns integrity when integrity >= 3 (and gratitude < 2)", () => {
      expect(pickSystemMessageId({ xp: 0, deltas: { integrity: 3 } })).toBe("integrity");
    });
    it("returns telemetry when xp >= 90", () => {
      expect(pickSystemMessageId({ xp: 90, deltas: {} })).toBe("telemetry");
    });
    it("returns arch_init when no condition matches", () => {
      expect(pickSystemMessageId({ xp: 50, deltas: {} })).toBe("arch_init");
    });
  });

  describe("evaluateChoice", () => {
    it("returns xp = baseXp + integrity bonus when integrity > 0", () => {
      const out = evaluateChoice({
        scenarioId: "s1",
        choiceId: "A",
        xpBase: 40,
        difficulty: 1,
        hiddenDelta: { integrity: 2 },
      });
      expect(out.xp).toBe(40 + INTEGRITY_BONUS_XP);
      expect(out.tags).toContain("scenario:s1");
      expect(out.tags).toContain("choice:A");
    });
    it("returns no integrity bonus when integrity is 0 or missing", () => {
      const out = evaluateChoice({
        scenarioId: "s1",
        choiceId: "B",
        xpBase: 40,
      });
      expect(out.xp).toBe(40);
    });
  });

  describe("evaluateFollowUp", () => {
    it("returns xp 0 and followup:selected tag", () => {
      const out = evaluateFollowUp({
        scenarioId: "s1",
        choiceId: "A",
        followUpIndex: 0,
      });
      expect(out.xp).toBe(0);
      expect(out.tags).toContain("followup:selected");
      expect(out.systemMessageId).toBe("arch_init");
    });
  });
});
