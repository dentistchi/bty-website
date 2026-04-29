/**
 * Edge-case tests for arena/engine (Arena 15차).
 * 13차(avatarCharacters)·14차(avatarOutfits)와 다른 미커버 모듈. 기존 동작만 검증, 비즈니스/XP 로직 미변경.
 */
import { describe, it, expect } from "vitest";
import {
  computeXp,
  pickSystemMessageId,
  evaluateChoice,
  evaluateFollowUp,
  INTEGRITY_BONUS_XP,
} from "./engine";

describe("engine (edges)", () => {
  describe("computeXp boundary", () => {
    it("0 xpBase always returns 0 regardless of difficulty", () => {
      expect(computeXp(0, 5)).toBe(0);
      expect(computeXp(0, 0)).toBe(0);
    });
    it("rounds .5 up (Math.round)", () => {
      expect(computeXp(5, 1.5)).toBe(8);
      expect(computeXp(3, 1.5)).toBe(5);
    });
    it("difficulty 0 yields 0", () => {
      expect(computeXp(100, 0)).toBe(0);
    });
    it("negative xpBase yields 0 (floor at 0)", () => {
      expect(computeXp(-10, 1)).toBe(0);
      expect(computeXp(-1, 2)).toBe(0);
    });
  });

  describe("pickSystemMessageId priority", () => {
    it("gratitude takes priority over integrity and telemetry", () => {
      expect(pickSystemMessageId({ xp: 100, deltas: { gratitude: 2, integrity: 5 } })).toBe("gratitude");
    });
    it("integrity takes priority over telemetry (xp >= 90)", () => {
      expect(pickSystemMessageId({ xp: 95, deltas: { integrity: 3 } })).toBe("integrity");
    });
    it("gratitude 1 does not trigger gratitude", () => {
      expect(pickSystemMessageId({ xp: 0, deltas: { gratitude: 1 } })).toBe("arch_init");
    });
    it("integrity 2 does not trigger integrity", () => {
      expect(pickSystemMessageId({ xp: 0, deltas: { integrity: 2 } })).toBe("arch_init");
    });
    it("xp 89 does not trigger telemetry", () => {
      expect(pickSystemMessageId({ xp: 89, deltas: {} })).toBe("arch_init");
    });
  });

  describe("evaluateChoice tags", () => {
    it("intent:unknown when intent not provided", () => {
      const out = evaluateChoice({ scenarioId: "s", choiceId: "c", xpBase: 10 });
      expect(out.tags).toContain("intent:unknown");
    });
    it("includes xp:low when xp < 60", () => {
      const out = evaluateChoice({ scenarioId: "s", choiceId: "c", xpBase: 10 });
      expect(out.tags).toContain("xp:low");
    });
    it("includes xp:mid when 60 <= xp < 90", () => {
      const out = evaluateChoice({ scenarioId: "s", choiceId: "c", xpBase: 70 });
      expect(out.tags).toContain("xp:mid");
    });
    it("includes xp:high when xp >= 90", () => {
      const out = evaluateChoice({ scenarioId: "s", choiceId: "c", xpBase: 90 });
      expect(out.tags).toContain("xp:high");
    });
    it("negative integrity does not add bonus", () => {
      const out = evaluateChoice({ scenarioId: "s", choiceId: "c", xpBase: 50, hiddenDelta: { integrity: -1 } });
      expect(out.xp).toBe(50);
    });
  });

  describe("evaluateFollowUp", () => {
    it("always returns empty deltas", () => {
      const out = evaluateFollowUp({ scenarioId: "x", choiceId: "y", followUpIndex: 99 });
      expect(out.deltas).toEqual({});
      expect(out.xp).toBe(0);
    });
  });
});
