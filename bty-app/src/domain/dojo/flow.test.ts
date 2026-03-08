/**
 * Dojo flow domain — 진입·제출·결과 순수 함수.
 * docs/DOJO_DEAR_ME_NEXT_CONTENT.md §7.
 */
import { describe, it, expect } from "vitest";
import {
  canEnterDojo,
  validateDojo50Submit,
  computeDojo50Result,
  validateIntegritySubmit,
  DOJO_50_AREAS,
} from "./flow";

describe("canEnterDojo", () => {
  it("returns true when authenticated", () => {
    expect(canEnterDojo(true)).toBe(true);
  });
  it("returns false when not authenticated", () => {
    expect(canEnterDojo(false)).toBe(false);
  });
});

describe("validateDojo50Submit", () => {
  it("ok when 50 answers each 1..5", () => {
    const answers: Record<number, number> = {};
    for (let i = 1; i <= 50; i++) answers[i] = 3;
    expect(validateDojo50Submit(answers)).toEqual({ ok: true });
  });
  it("fails when count != 50", () => {
    expect(validateDojo50Submit({ 1: 1 })).toEqual({ ok: false, error: "answers_count" });
  });
  it("fails when value out of range", () => {
    const answers: Record<number, number> = {};
    for (let i = 1; i <= 50; i++) answers[i] = 3;
    answers[25] = 0;
    expect(validateDojo50Submit(answers)).toEqual({ ok: false, error: "invalid_range" });
  });
});

describe("computeDojo50Result", () => {
  it("returns scores 0..100 per area and summaryKey", () => {
    const answers: Record<number, number> = {};
    for (let i = 1; i <= 50; i++) answers[i] = 3;
    const r = computeDojo50Result(answers);
    for (const area of DOJO_50_AREAS) {
      expect(r.scores[area]).toBeGreaterThanOrEqual(0);
      expect(r.scores[area]).toBeLessThanOrEqual(100);
    }
    expect(["high", "mid", "low"]).toContain(r.summaryKey);
  });
});

describe("validateIntegritySubmit", () => {
  it("ok when text non-empty", () => {
    expect(validateIntegritySubmit({ text: "한 줄 상황" })).toEqual({ ok: true });
  });
  it("ok when choiceId non-empty", () => {
    expect(validateIntegritySubmit({ choiceId: "A" })).toEqual({ ok: true });
  });
  it("fails when missing input", () => {
    expect(validateIntegritySubmit({})).toEqual({ ok: false, error: "missing_input" });
    expect(validateIntegritySubmit({ text: "" })).toEqual({ ok: false, error: "missing_input" });
  });
});
