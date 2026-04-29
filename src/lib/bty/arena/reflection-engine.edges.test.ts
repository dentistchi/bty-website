/**
 * Edge-case tests for reflection-engine (Arena 16차 + TASK 9 보강).
 * 기존 동작만 검증, 비즈니스/XP 로직 미변경.
 */
import { describe, it, expect } from "vitest";
import { detectPatterns, type PatternTag } from "./reflection-engine";

describe("reflection-engine (edges)", () => {
  const ALL_TAGS: PatternTag[] = [
    "defensive", "blame", "rushed", "control", "avoidant",
    "people_blame", "short_term", "ego_threat",
  ];

  describe("detectPatterns priority tie-breaking", () => {
    it("people_blame beats blame when scores are equal", () => {
      const r = detectPatterns("He is lazy, their fault");
      if (r.scores.people_blame === r.scores.blame && r.scores.people_blame > 0) {
        expect(r.topTag).toBe("people_blame");
      }
    });
    it("topTag is undefined when all scores are 0", () => {
      const r = detectPatterns("the sky is blue");
      expect(r.topTag).toBeUndefined();
    });
    it("empty string yields all scores 0 and no topTag", () => {
      const r = detectPatterns("");
      expect(r.topTag).toBeUndefined();
      for (const tag of ALL_TAGS) expect(r.scores[tag]).toBe(0);
    });
  });

  describe("detectPatterns dental/SSO domain keywords", () => {
    it("claim/denial bumps short_term", () => {
      const r = detectPatterns("the claim was denied, need to appeal the denial");
      expect(r.scores.short_term).toBeGreaterThan(0);
    });
    it("rework bumps blame and control", () => {
      const r = detectPatterns("we had to rework the entire thing and fix again");
      expect(r.scores.blame).toBeGreaterThan(0);
      expect(r.scores.control).toBeGreaterThan(0);
    });
    it("turnaround/TAT bumps rushed", () => {
      const r = detectPatterns("the turnaround time is too slow, SLA breached");
      expect(r.scores.rushed).toBeGreaterThan(0);
    });
    it("compliance/HIPAA bumps control", () => {
      const r = detectPatterns("we had a HIPAA compliance audit issue");
      expect(r.scores.control).toBeGreaterThan(0);
    });
  });

  describe("detectPatterns score threshold", () => {
    it("tags only includes patterns with score >= 3", () => {
      const r = detectPatterns("but 근데");
      expect(r.scores.defensive).toBe(2);
      expect(r.tags).not.toContain("defensive");
    });
  });

  describe("detectPatterns scores shape", () => {
    it("always returns all 8 pattern keys in scores", () => {
      const r = detectPatterns("anything");
      for (const tag of ALL_TAGS) {
        expect(tag in r.scores).toBe(true);
        expect(typeof r.scores[tag]).toBe("number");
      }
    });
  });

  // ----- (1) KO 텍스트 패턴 감지 — 방어적·비난·성급·통제 -----

  describe("KO pattern detection (4종)", () => {
    it("방어적: 억울 triggers defensive >= 3", () => {
      const r = detectPatterns("정말 억울해요, 왜 나만 이런 거예요");
      expect(r.scores.defensive).toBeGreaterThanOrEqual(3);
      expect(r.tags).toContain("defensive");
    });

    it("방어적: 어쩔 수 없 triggers defensive >= 3", () => {
      const r = detectPatterns("어쩔 수 없었어요 하지만 난 잘했어");
      expect(r.scores.defensive).toBeGreaterThanOrEqual(3);
      expect(r.tags).toContain("defensive");
    });

    it("비난: 쟤네 때문 triggers blame >= 3", () => {
      const r = detectPatterns("쟤네 때문에 일이 이렇게 된 거야");
      expect(r.scores.blame).toBeGreaterThanOrEqual(3);
      expect(r.tags).toContain("blame");
    });

    it("비난: 탓이야 triggers blame >= 3", () => {
      const r = detectPatterns("전부 그 사람 탓이야");
      expect(r.scores.blame).toBeGreaterThanOrEqual(3);
      expect(r.tags).toContain("blame");
    });

    it("성급: 당장 + 빨리 triggers rushed >= 3", () => {
      const r = detectPatterns("당장 처리해야 해, 빨리 해주세요");
      expect(r.scores.rushed).toBeGreaterThanOrEqual(3);
      expect(r.tags).toContain("rushed");
    });

    it("성급: 시간 없어 triggers rushed >= 3", () => {
      const r = detectPatterns("시간 없어, 지금 바로 해야 해");
      expect(r.scores.rushed).toBeGreaterThanOrEqual(3);
      expect(r.tags).toContain("rushed");
    });

    it("통제: 반드시 + 강제로 triggers control >= 3", () => {
      const r = detectPatterns("반드시 강제로라도 시켜야 해");
      expect(r.scores.control).toBeGreaterThanOrEqual(3);
      expect(r.tags).toContain("control");
    });

    it("통제: 처벌 triggers control >= 3", () => {
      const r = detectPatterns("제재하고 처벌해야 해요");
      expect(r.scores.control).toBeGreaterThanOrEqual(3);
      expect(r.tags).toContain("control");
    });
  });

  // ----- (2) EN 텍스트 패턴 감지 — defensive·blame·rushed·control -----

  describe("EN pattern detection (4종)", () => {
    it("defensive: 'i had to' + 'unfair' triggers defensive >= 3", () => {
      const r = detectPatterns("I had to do it, this is unfair treatment");
      expect(r.scores.defensive).toBeGreaterThanOrEqual(3);
      expect(r.tags).toContain("defensive");
    });

    it("defensive: 'they always' triggers defensive >= 3", () => {
      const r = detectPatterns("they always do this, i did nothing wrong");
      expect(r.scores.defensive).toBeGreaterThanOrEqual(3);
      expect(r.tags).toContain("defensive");
    });

    it("blame: 'because of them' triggers blame >= 3", () => {
      const r = detectPatterns("This happened because of them, they messed up everything");
      expect(r.scores.blame).toBeGreaterThanOrEqual(3);
      expect(r.tags).toContain("blame");
    });

    it("blame: 'they failed' triggers blame >= 3", () => {
      const r = detectPatterns("they failed to deliver on time");
      expect(r.scores.blame).toBeGreaterThanOrEqual(3);
      expect(r.tags).toContain("blame");
    });

    it("rushed: 'immediately' + 'no time' triggers rushed >= 3", () => {
      const r = detectPatterns("We need this immediately, there is no time");
      expect(r.scores.rushed).toBeGreaterThanOrEqual(3);
      expect(r.tags).toContain("rushed");
    });

    it("rushed: 'urgent' + 'right now' triggers rushed >= 3", () => {
      const r = detectPatterns("This is urgent, do it right now");
      expect(r.scores.rushed).toBeGreaterThanOrEqual(3);
      expect(r.tags).toContain("rushed");
    });

    it("control: 'make them' + 'must' triggers control >= 3", () => {
      const r = detectPatterns("You must make them follow the rule");
      expect(r.scores.control).toBeGreaterThanOrEqual(3);
      expect(r.tags).toContain("control");
    });

    it("control: 'zero tolerance' + 'force' triggers control >= 3", () => {
      const r = detectPatterns("Zero tolerance policy, force compliance now");
      expect(r.scores.control).toBeGreaterThanOrEqual(3);
      expect(r.tags).toContain("control");
    });
  });

  // ----- (3) 혼합 언어 입력 경계 -----

  describe("mixed language input", () => {
    it("KO defensive + EN blame detects both", () => {
      const r = detectPatterns("내 탓 아니야, their fault entirely");
      expect(r.scores.defensive).toBeGreaterThanOrEqual(3);
      expect(r.scores.blame).toBeGreaterThanOrEqual(3);
      expect(r.tags).toContain("defensive");
      expect(r.tags).toContain("blame");
    });

    it("KO rushed + EN control detects both", () => {
      const r = detectPatterns("당장 해야 해, must force them to comply");
      expect(r.scores.rushed).toBeGreaterThanOrEqual(3);
      expect(r.scores.control).toBeGreaterThanOrEqual(3);
      expect(r.tags).toContain("rushed");
      expect(r.tags).toContain("control");
    });

    it("mixed KO+EN keywords accumulate scores across languages", () => {
      const r = detectPatterns("왜 나만 이래 but it was not my fault");
      expect(r.scores.defensive).toBeGreaterThanOrEqual(4);
    });

    it("topTag resolves correctly with multi-language patterns", () => {
      const r = detectPatterns("걔가 무능해, he is lazy and incompetent");
      expect(r.scores.people_blame).toBeGreaterThanOrEqual(4);
      expect(r.topTag).toBeDefined();
    });
  });

  // ----- (4) 빈 문자열·null·undefined 안전 -----

  describe("empty / null / undefined safety", () => {
    it("empty string returns zero scores, empty tags, undefined topTag", () => {
      const r = detectPatterns("");
      expect(r.tags).toEqual([]);
      expect(r.topTag).toBeUndefined();
      for (const tag of ALL_TAGS) expect(r.scores[tag]).toBe(0);
    });

    it("whitespace-only string returns zero scores", () => {
      const r = detectPatterns("   \t\n  ");
      expect(r.tags).toEqual([]);
      expect(r.topTag).toBeUndefined();
    });

    it("null input treated as empty string (no throw)", () => {
      const r = detectPatterns(null as unknown as string);
      expect(r.tags).toEqual([]);
      expect(r.topTag).toBeUndefined();
      for (const tag of ALL_TAGS) expect(r.scores[tag]).toBe(0);
    });

    it("undefined input treated as empty string (no throw)", () => {
      const r = detectPatterns(undefined as unknown as string);
      expect(r.tags).toEqual([]);
      expect(r.topTag).toBeUndefined();
      for (const tag of ALL_TAGS) expect(r.scores[tag]).toBe(0);
    });

  });
});
