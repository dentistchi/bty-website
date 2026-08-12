import { describe, it, expect } from "vitest";
import { programContext, programContextFingerprint, programContextsCompatible } from "./program-authorship";
import type { BuilderAnswers } from "./module-builder";

/**
 * SLICE 3.2P-W1-R1 — ONE FINGERPRINT AUTHORITY, AND IT IS NOT A HASH.
 *
 * R3 published `c14d97f9…` as "the context fingerprint". W1 measured `fc7037a9…` for the same,
 * byte-identical context and briefly read as drift. Neither number is the fingerprint. The
 * product's fingerprint is the STRING `programContextFingerprint` returns; it is stored verbatim
 * in `foundry_program_generation_attempts.context_fingerprint` and compared verbatim by the
 * route, the adoption authority and the resume path. Nothing in the product hashes it.
 *
 * The two digests came from two engineering harnesses: one hashed the raw string, the other
 * hashed `JSON.stringify(string)` — the same value with quotes around it. A harness decided
 * what "the fingerprint" was, twice, differently.
 *
 * So this file pins the AUTHORITY rather than a number: the canonical string, its stability,
 * and the fact that an external re-encoding of it is not an alternate valid fingerprint.
 */
const ANSWERS = {
  problem: "During morning huddles, team members report problems but leave without naming who will act or when the next step will happen.",
  audienceType: "leaders",
  evidenceType: "confirmed",
  followUpDays: 7,
  learningNeeds: ["shared_standard", "practice"],
  materialIntent: "pdf",
  sharedQuestion: "In your own words, what is the most important standard from this training?",
  successEvidence: "The huddle note records one owner and one deadline for every agreed action.",
  arenaRecommended: true,
  completionPrompt: "What specific phrases will you use in the next huddle to confirm the action owner and deadline for each reported issue?",
  recurringMoment: "During morning huddles",
  observableBehavior: "At the next huddle, what exact words will you use to confirm the owner, action, and deadline?",
  capabilityCandidate: "Accountability",
} as unknown as BuilderAnswers;

/** The live pilot v2's canonical fingerprint, verbatim. `¦` is the field separator. */
const CANONICAL =
  "during morning huddles, team members report problems but leave without naming who will act or when the next step will happen.¦leaders¦¦accountability¦during morning huddles¦at the next huddle, what exact words will you use to confirm the owner, action, and deadline?¦the huddle note records one owner and one deadline for every agreed action.¦shared_standard+practice¦true¦7¦in your own words, what is the most important standard from this training?¦what specific phrases will you use in the next huddle to confirm the action owner and deadline for each reported issue?¦pdf";

describe("[3.2P-W1-R1] the fingerprint is a string, and there is exactly one of it", () => {
  it("the pilot's canonical fingerprint is stable", () => {
    const fp = programContextFingerprint(programContext(ANSWERS)!);
    expect(fp).toBe(CANONICAL);
  });

  it("it is deterministic across repeated computation", () => {
    const ctx = programContext(ANSWERS)!;
    const runs = new Set(Array.from({ length: 25 }, () => programContextFingerprint(ctx)));
    expect(runs.size).toBe(1);
  });

  it("key order in the stored answers cannot change it", () => {
    // Postgres jsonb does not preserve insertion order, so a reordered read must be identical.
    const reordered = Object.fromEntries(
      Object.entries(ANSWERS as Record<string, unknown>).reverse(),
    ) as unknown as BuilderAnswers;
    expect(programContextFingerprint(programContext(reordered)!)).toBe(CANONICAL);
    expect(programContextsCompatible(programContext(ANSWERS)!, programContext(reordered)!)).toBe(true);
  });

  it("a JSON re-encoding by a caller is NOT an alternate valid fingerprint", () => {
    const fp = programContextFingerprint(programContext(ANSWERS)!);
    // This is precisely the difference that produced two published numbers for one context.
    expect(JSON.stringify(fp)).not.toBe(fp);
    expect(JSON.stringify(fp)).toBe(`"${fp}"`);
    // Whatever a caller does to it, only the raw value compares equal to a stored one.
    expect(programContextsCompatible(programContext(ANSWERS)!, programContext(ANSWERS)!)).toBe(true);
  });

  it("a real change to Host intent DOES change it", () => {
    const withDecide = programContext({
      ...ANSWERS,
      learningNeeds: ["shared_standard", "practice", "decide"],
    } as unknown as BuilderAnswers)!;
    expect(programContextFingerprint(withDecide)).not.toBe(CANONICAL);
    expect(programContextsCompatible(programContext(ANSWERS)!, withDecide)).toBe(false);
  });

  it("every field that changes what a program is authored from is in it", () => {
    const base = programContext(ANSWERS)!;
    const mutations: [string, Partial<Record<string, unknown>>][] = [
      ["problem", { problem: "Something else entirely happens at huddles." }],
      ["audienceType", { audienceType: "everyone" }],
      ["capabilityCandidate", { capabilityCandidate: "Clarity" }],
      ["observableBehavior", { observableBehavior: "Name one owner before the group leaves." }],
      ["successEvidence", { successEvidence: "A different artifact records it." }],
      ["learningNeeds", { learningNeeds: ["practice"] }],
      ["arenaRecommended", { arenaRecommended: false }],
      ["followUpDays", { followUpDays: 30 }],
      ["sharedQuestion", { sharedQuestion: "A different shared question entirely?" }],
      ["completionPrompt", { completionPrompt: "A different completion prompt entirely?" }],
      ["materialIntent", { materialIntent: "youtube" }],
    ];
    for (const [label, patch] of mutations) {
      const ctx = programContext({ ...ANSWERS, ...patch } as unknown as BuilderAnswers);
      expect(ctx, label).not.toBeNull();
      expect(programContextFingerprint(ctx!), label).not.toBe(CANONICAL);
    }
  });
});
