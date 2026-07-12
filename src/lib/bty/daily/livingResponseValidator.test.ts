import { describe, it, expect } from "vitest";
import { validateLivingResponse } from "@/lib/bty/daily/livingResponseValidator";
import { guardPhrasesFor } from "@/domain/daily/livingResponseGuardPhrases";

const guards = guardPhrasesFor("en", "self");
const guardsKo = guardPhrasesFor("ko", "self");
const SELF_CONCEPTS = ["return", "consistency", "naming"];
const OTHERS_CONCEPTS = ["ownership", "communication", "repair", "directness", "truth", "follow_through"];

const ok = (t: string, over: { guardPhrases?: string[]; recentTexts?: string[]; relationship?: "self" | "others" | "world"; concepts?: string[] } = {}) =>
  validateLivingResponse(t, {
    relationship: over.relationship ?? "self",
    guardPhrases: over.guardPhrases ?? guards,
    concepts: over.concepts ?? SELF_CONCEPTS,
    recentTexts: over.recentTexts ?? [],
  });
const others = (t: string) => ok(t, { relationship: "others", concepts: OTHERS_CONCEPTS, guardPhrases: guardPhrasesFor("en", "others") });

describe("validateLivingResponse — structural", () => {
  it("accepts a calm, single, evidence-anchored sentence", () => {
    const r = ok("Returning to yourself starts with one thing named clearly.");
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });
  it("rejects a question", () => expect(ok("What will you carry with you today?").violations).toContain("QUESTION"));
  it("rejects two sentences", () => expect(ok("You returned. It counts for something.").violations).toContain("NOT_ONE_SENTENCE"));
  it("rejects an over-long line (chars or >16 words)", () => {
    expect(ok("Your quiet return " + "and steady work ".repeat(12)).violations).toContain("TOO_LONG");
    expect(ok("What is named plainly and directly and openly and honestly becomes real when it truly reaches another person nearby").violations).toContain("TOO_LONG"); // >16 words
  });
  it("empty output fails", () => expect(ok("   ").violations).toContain("EMPTY"));
});

describe("V1.2 — the new device-observed generic line is rejected", () => {
  it("rejects 'Regularly naming one specific thought or feeling can create a steady anchor'", () => {
    const r = ok("Regularly naming one specific thought or feeling can create a steady anchor.");
    expect(r.ok).toBe(false);
    expect(r.violations).toEqual(expect.arrayContaining(["INSTRUCTION", "GENERIC_WELLNESS"])); // 'regularly' + 'steady anchor'
  });
  it("rejects the expanded imperative words", () => {
    for (const s of [
      "Try to own your part in the conversation.",
      "Remember what you avoided and face it.",
      "Consider the change before it reaches anyone.",
      "Keep returning to the same honest word.",
      "Practice naming one thing each day.",
    ]) {
      expect(ok(s, { concepts: OTHERS_CONCEPTS }).violations).toContain("INSTRUCTION");
    }
  });
});

describe("V1.1 — generic wellness rejection", () => {
  it("rejects the EXACT observed generic sentence", () => {
    const r = ok("Embrace the steady presence within, nurturing a strong connection to your own essence.");
    expect(r.ok).toBe(false);
    expect(r.violations).toContain("GENERIC_WELLNESS");
  });
  it("rejects representative wellness paraphrases", () => {
    for (const s of [
      "Honor your journey and step into your power today.",
      "Trust the process and allow yourself to find balance.",
      "A gentle reminder to reconnect with your authentic self.",
      "Cultivate inner strength and hold space for your true self.",
    ]) {
      expect(ok(s).violations).toContain("GENERIC_WELLNESS");
    }
  });
});

describe("V1.1 — evidence anchor + relationship-label-only", () => {
  it("rejects output with no packet-derived semantic anchor", () => {
    expect(ok("The morning felt unusually still and grey outside.").violations).toContain("ANCHOR_MISSING");
  });
  it("rejects a relationship-label-only restatement", () => {
    const r = ok("Deepen the relationship you have with yourself today.", { concepts: SELF_CONCEPTS });
    expect(r.ok).toBe(false); // no evidence anchor (ANCHOR_MISSING) and/or restatement
  });
  it("accepts an ownership + communication perspective (Others)", () => {
    const r = others("Responsibility becomes real the moment it enters a conversation.");
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });
  it("accepts a repair / truth / follow-through perspective", () => {
    expect(others("Repair begins when what was avoided is finally addressed.").ok).toBe(true);
    expect(others("What is named clearly becomes easier to carry honestly.").ok).toBe(true);
    expect(others("A change holds when it is carried through more than once.").ok).toBe(true);
  });
});

describe("V1.1 — instruction / diagnosis / numbers / codes", () => {
  it("rejects instruction language", () => {
    expect(others("Remember to own your part in the conversation.").violations).toContain("INSTRUCTION");
    expect(others("Make sure you repair what was avoided.").violations).toContain("INSTRUCTION");
  });
  it("rejects diagnosis / identity", () => {
    expect(ok("You are avoidant and broken when you return to yourself.").violations).toContain("PROHIBITED");
    expect(ok("You seem depressed about your own quiet return.").violations).toContain("PROHIBITED");
  });
  it("rejects counts / metrics", () => {
    expect(ok("You returned to yourself three times this week.").ok).toBe(false);
    expect(ok("Your streak of quiet returns is your xp.").violations).toContain("PROHIBITED");
  });
  it("rejects a raw machine code", () => {
    expect(others("Your OTHERS_RELATIONAL evidence shows ownership.").violations).toContain("MACHINE_CODE");
    expect(ok("SELF_RETURN_STRONG means you keep returning.").violations).toContain("MACHINE_CODE");
  });
});

describe("restatement guard — real CTA/benediction, EN + KO, near-variants", () => {
  it("rejects the pre-confirm CTA verbatim + variants", () => {
    expect(ok("I'll live this relationship today").violations).toContain("RESTATES_GUARD");
    expect(ok("I’ll live this relationship today.").violations).toContain("RESTATES_GUARD");
  });
  it("rejects the benediction (and a containing line)", () => {
    expect(ok("You have entered the relationship with yourself today.").violations).toContain("RESTATES_GUARD");
  });
  it("rejects the KO CTA / benediction incl. ending-only variants", () => {
    const koOk = (t: string) => validateLivingResponse(t, { relationship: "self", guardPhrases: guardsKo, concepts: SELF_CONCEPTS, recentTexts: [] });
    expect(koOk("오늘 이 관계로 살아갑니다").violations).toContain("RESTATES_GUARD");
    expect(koOk("오늘 이 관계로 살아간다").violations).toContain("RESTATES_GUARD");
  });
});

describe("count rejection (Arabic / EN number-words / KO 수사)", () => {
  it("rejects EN number-word counts", () => expect(ok("You came back to yourself four times.").violations).toContain("COUNT_EXPRESSION"));
  it("rejects KO count expressions", () => {
    const koOk = (t: string) => validateLivingResponse(t, { relationship: "self", guardPhrases: guardsKo, concepts: SELF_CONCEPTS, recentTexts: [] });
    expect(koOk("세 번 나에게 돌아왔습니다").violations).toContain("COUNT_EXPRESSION");
  });
});
