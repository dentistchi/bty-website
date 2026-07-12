import { describe, it, expect } from "vitest";
import { validateLivingResponse } from "@/lib/bty/daily/livingResponseValidator";
import { guardPhrasesFor } from "@/domain/daily/livingResponseGuardPhrases";

const guards = guardPhrasesFor("en", "self");
const guardsKo = guardPhrasesFor("ko", "self");
const ok = (t: string, over: { guardPhrases?: string[]; recentTexts?: string[]; relationship?: "self" | "others" | "world" } = {}) =>
  validateLivingResponse(t, { relationship: over.relationship ?? "self", guardPhrases: over.guardPhrases ?? guards, recentTexts: over.recentTexts ?? [] });

describe("validateLivingResponse — layered guardrails", () => {
  it("accepts a calm, single, relationship-relevant sentence", () => {
    const r = ok("Returning to yourself is quiet work, and it still counts.");
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it("rejects a question", () => {
    expect(ok("What will you carry with you today?").violations).toContain("QUESTION");
  });

  it("rejects two sentences", () => {
    expect(ok("You returned. That still counts for something.").violations).toContain("NOT_ONE_SENTENCE");
  });

  it("rejects an over-long line", () => {
    expect(ok("Your quiet return " + "and steady presence ".repeat(12)).violations).toContain("TOO_LONG");
  });

  it("rejects diagnosis / identity claims", () => {
    expect(ok("You are avoidant and broken when you return to yourself").violations).toContain("PROHIBITED");
    expect(ok("You seem depressed about your own quiet return").violations).toContain("PROHIBITED");
  });

  it("rejects a relationship-irrelevant line", () => {
    expect(ok("The weather turned cold and grey overnight").violations).toContain("RELATIONSHIP_IRRELEVANT");
  });

  it("rejects a novelty repeat (same opening as a recent line)", () => {
    expect(
      ok("Returning to yourself is a little easier now than before", { recentTexts: ["Returning to yourself is quiet work, and it still counts."] }).violations,
    ).toContain("NOVELTY_REPEAT");
  });

  it("empty output fails", () => {
    expect(ok("   ").violations).toContain("EMPTY");
  });
});

describe("exact-count rejection (Arabic / EN number-words / KO 수사)", () => {
  it("rejects an Arabic-digit count (via shared BARE_COUNT)", () => {
    expect(ok("You returned to yourself 3 times this week").ok).toBe(false);
  });
  it("rejects an English number-word count", () => {
    expect(ok("You returned to yourself three times").violations).toContain("COUNT_EXPRESSION");
    expect(ok("You came back to yourself four times").violations).toContain("COUNT_EXPRESSION");
  });
  it("rejects Korean count expressions", () => {
    const koOk = (t: string) => validateLivingResponse(t, { relationship: "self", guardPhrases: guardsKo, recentTexts: [] });
    expect(koOk("세 번 나에게 돌아왔습니다").violations).toContain("COUNT_EXPRESSION");
    expect(koOk("이번 주에 나에게 네 번 돌아왔습니다").violations).toContain("COUNT_EXPRESSION");
    expect(koOk("지난 며칠 중 나를 찾았습니다").violations).toContain("COUNT_EXPRESSION");
  });
  it("does NOT flag an incidental non-count number word", () => {
    expect(ok("One quiet return to yourself is enough for today").violations).not.toContain("COUNT_EXPRESSION");
  });
});

describe("restatement guard — real CTA/benediction, EN + KO, near-variants", () => {
  it("rejects the pre-confirm CTA verbatim + variants", () => {
    expect(ok("I'll live this relationship today").violations).toContain("RESTATES_GUARD");
    expect(ok("I’ll live this relationship today.").violations).toContain("RESTATES_GUARD"); // punctuation/apostrophe
    expect(ok("i ll LIVE this relationship today").violations).toContain("RESTATES_GUARD"); // case/spacing
  });
  it("rejects the confirmed CTA", () => {
    expect(ok("I'm living this relationship today").violations).toContain("RESTATES_GUARD");
  });
  it("rejects the benediction (and a containing line)", () => {
    expect(ok("You have entered the relationship with yourself today.").violations).toContain("RESTATES_GUARD");
    expect(ok("Truly, you have entered the relationship with yourself today").violations).toContain("RESTATES_GUARD"); // substring
  });
  it("rejects the KO CTA / benediction incl. ending-only variants", () => {
    const koOk = (t: string) => validateLivingResponse(t, { relationship: "self", guardPhrases: guardsKo, recentTexts: [] });
    expect(koOk("오늘 이 관계로 살아갑니다").violations).toContain("RESTATES_GUARD");
    expect(koOk("오늘 이 관계로 살아간다").violations).toContain("RESTATES_GUARD"); // 종결어미 변형
    expect(koOk("오늘 당신은 나와의 관계 안으로 들어갔습니다").violations).toContain("RESTATES_GUARD");
  });
});
