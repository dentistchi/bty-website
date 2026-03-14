/**
 * Dojo flow domain — 경계·엣지 케이스.
 * Center/Foundry 경계 단위 테스트 1건 (순수 도메인만).
 */
import { describe, it, expect } from "vitest";
import {
  canEnterDojo,
  validateDojo50Submit,
  computeDojo50Result,
  validateIntegritySubmit,
  DOJO_50_AREAS,
  type Dojo50Answers,
} from "./flow";

function makeAnswers(overrides?: Partial<Record<number, number>>): Dojo50Answers {
  const out: Dojo50Answers = {};
  for (let q = 1; q <= 50; q++) out[q] = 3;
  if (overrides) Object.assign(out, overrides);
  return out;
}

describe("canEnterDojo edges", () => {
  it("false when not authenticated", () => {
    expect(canEnterDojo(false)).toBe(false);
  });
  it("true when authenticated", () => {
    expect(canEnterDojo(true)).toBe(true);
  });
});

describe("validateDojo50Submit edges", () => {
  it("rejects empty answers object", () => {
    expect(validateDojo50Submit({})).toEqual({ ok: false, error: "answers_count" });
  });

  it("rejects 49 keys (one missing)", () => {
    const a = makeAnswers();
    delete a[50];
    expect(validateDojo50Submit(a)).toEqual({ ok: false, error: "answers_count" });
  });

  it("rejects 51 keys (extra key)", () => {
    const a = makeAnswers();
    a[51] = 3;
    expect(validateDojo50Submit(a)).toEqual({ ok: false, error: "answers_count" });
  });

  it("rejects value 5.5 (non-integer)", () => {
    const a = makeAnswers();
    a[1] = 5.5 as number;
    expect(validateDojo50Submit(a)).toEqual({ ok: false, error: "invalid_range" });
  });

  it("rejects value 0 at boundary question", () => {
    const a = makeAnswers();
    a[1] = 0;
    expect(validateDojo50Submit(a)).toEqual({ ok: false, error: "invalid_range" });
    a[1] = 3;
    a[50] = 0;
    expect(validateDojo50Submit(a)).toEqual({ ok: false, error: "invalid_range" });
  });

  it("rejects value 6 at last question (50)", () => {
    const a = makeAnswers();
    a[50] = 6;
    expect(validateDojo50Submit(a)).toEqual({ ok: false, error: "invalid_range" });
  });

  it("accepts all 5s and all 1s", () => {
    const all5 = makeAnswers();
    for (let q = 1; q <= 50; q++) all5[q] = 5;
    expect(validateDojo50Submit(all5)).toEqual({ ok: true });
    const all1 = makeAnswers();
    for (let q = 1; q <= 50; q++) all1[q] = 1;
    expect(validateDojo50Submit(all1)).toEqual({ ok: true });
  });

  it("computeDojo50Result with all 3s yields summaryKey mid", () => {
    const a = makeAnswers();
    const r = computeDojo50Result(a);
    expect(r.summaryKey).toBe("mid");
  });
});

describe("computeDojo50Result edges", () => {
  it("summaryKey high when avg >= 70", () => {
    const a = makeAnswers();
    for (let q = 1; q <= 50; q++) a[q] = 5;
    const r = computeDojo50Result(a);
    expect(r.summaryKey).toBe("high");
  });

  it("summaryKey mid when avg in [50, 70)", () => {
    const a = makeAnswers();
    for (let q = 1; q <= 50; q++) a[q] = 3;
    const r = computeDojo50Result(a);
    expect(r.summaryKey).toBe("mid");
  });

  it("summaryKey low when avg < 50", () => {
    const a = makeAnswers();
    for (let q = 1; q <= 50; q++) a[q] = 1;
    const r = computeDojo50Result(a);
    expect(r.summaryKey).toBe("low");
  });

  it("summaryKey high when avg exactly 70 (boundary)", () => {
    const a = makeAnswers();
    for (let area = 0; area < 5; area++) {
      for (let j = 1; j <= 10; j++) {
        const qId = area * 10 + j;
        a[qId] = j <= 8 ? 4 : 3;
      }
    }
    const r = computeDojo50Result(a);
    expect(r.summaryKey).toBe("high");
  });

  it("summaryKey mid when avg exactly 50 (boundary)", () => {
    const a = makeAnswers();
    for (let q = 1; q <= 50; q++) a[q] = 3;
    const r = computeDojo50Result(a);
    expect(r.summaryKey).toBe("mid");
  });

  it("returns all five area keys", () => {
    const r = computeDojo50Result(makeAnswers());
    expect(Object.keys(r.scores).sort()).toEqual([...DOJO_50_AREAS].sort());
  });

  it("scores stay 0..100 when some answers missing (treated as 0)", () => {
    const a = makeAnswers();
    delete a[1];
    delete a[2];
    const r = computeDojo50Result(a);
    for (const area of DOJO_50_AREAS) {
      expect(r.scores[area]).toBeGreaterThanOrEqual(0);
      expect(r.scores[area]).toBeLessThanOrEqual(100);
    }
  });

  it("first area score 0 when all questions in that area are 1 (sum 10 → 0–100 scale floor)", () => {
    const a = makeAnswers();
    for (let q = 1; q <= 10; q++) a[q] = 1;
    const r = computeDojo50Result(a);
    expect(r.scores.perspective_taking).toBe(0);
  });
});

describe("validateIntegritySubmit edges", () => {
  it("fails when text is whitespace only", () => {
    expect(validateIntegritySubmit({ text: "   " })).toEqual({ ok: false, error: "missing_input" });
    expect(validateIntegritySubmit({ text: "\t\n" })).toEqual({ ok: false, error: "missing_input" });
  });

  it("fails when choiceId is empty string", () => {
    expect(validateIntegritySubmit({ choiceId: "" })).toEqual({ ok: false, error: "missing_input" });
  });

  it("ok when both text and choiceId provided", () => {
    expect(validateIntegritySubmit({ text: "a", choiceId: "B" })).toEqual({ ok: true });
  });

  it("ok when text has leading/trailing spaces (non-empty after trim)", () => {
    expect(validateIntegritySubmit({ text: "  x  " })).toEqual({ ok: true });
  });

  it("fails when payload has undefined text and undefined choiceId", () => {
    expect(validateIntegritySubmit({})).toEqual({ ok: false, error: "missing_input" });
  });

  it("ok when text is empty string but choiceId provided", () => {
    expect(validateIntegritySubmit({ text: "", choiceId: "choice-1" })).toEqual({ ok: true });
  });
});
