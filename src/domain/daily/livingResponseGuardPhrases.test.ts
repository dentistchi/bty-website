/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { LIVING_RESPONSE_GUARD_PHRASES, guardPhrasesFor, isRestatement, normalizeGuard } from "@/domain/daily/livingResponseGuardPhrases";
import { COPY } from "@/components/app-shell/BtyDailyAppShell";

describe("guard phrases mirror the shell's locked copy (drift guard)", () => {
  for (const loc of ["en", "ko"] as const) {
    it(`${loc}: cta / ctaDone / benedictions equal COPY.${loc}.today`, () => {
      const g = LIVING_RESPONSE_GUARD_PHRASES[loc];
      const t = COPY[loc].today;
      expect(g.cta).toBe(t.cta);
      expect(g.ctaDone).toBe(t.ctaDone);
      expect(g.benediction.self).toBe(t.benediction.Self);
      expect(g.benediction.others).toBe(t.benediction.Others);
      expect(g.benediction.world).toBe(t.benediction.World);
      expect(g.benediction.fallback).toBe(t.benediction.fallback);
    });
  }
});

describe("guardPhrasesFor + normalization", () => {
  it("returns both CTA states and all benedictions for the locale", () => {
    const set = guardPhrasesFor("en", "self");
    expect(set).toContain(COPY.en.today.cta);
    expect(set).toContain(COPY.en.today.ctaDone);
    expect(set).toContain(COPY.en.today.benediction.Self);
  });
  it("normalizeGuard collapses case / apostrophes / punctuation / whitespace", () => {
    expect(normalizeGuard("I’ll  LIVE, this — relationship today.")).toBe(normalizeGuard("i'll live this relationship today"));
  });
  it("isRestatement is false for a genuinely different line", () => {
    expect(isRestatement("Returning to yourself is quiet work today", guardPhrasesFor("en", "self"))).toBe(false);
  });
});
