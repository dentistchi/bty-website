import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoveryPatients } from "./discovery-cases.server";
import { case001Variant } from "./case001-variant.server";
import { case001VariantB } from "./case001-variant-b.server";
import { respondToDiscovery } from "./discovery-router.server";

beforeEach(() => { vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", ""); vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", ""); });
afterEach(() => vi.unstubAllEnvs());

const versions = discoveryPatients.filter(p => p.caseId === "drchi-001");
const [base, variantA, variantB] = versions;

describe("Case 001 variant B — a fuller fictional encounter, appended", () => {
  it("is appended after the original pack and variant A, which both still resolve unchanged", () => {
    expect(versions.map(p => p.version)).toEqual(["discovery-2026-10-23.1", "discovery-2026-10-23.1-variant-a", "discovery-2026-10-23.1-variant-b"]);
    // New attempts take the latest Case 001 pack; frozen attempts look theirs up by version.
    expect([...discoveryPatients].reverse().find(p => p.caseId === "drchi-001")).toBe(variantB);
    expect(variantA).toEqual(case001Variant(base!));
    expect(base!.facts.some(f => f.provenance)).toBe(false);
  });

  it("keeps every variant A fact, and labels every new or re-answered fact as awaiting Dr. Chi's review", () => {
    const a = new Map(variantA!.facts.map(f => [f.id, f]));
    expect(variantB!.facts.slice(0, a.size).map(f => f.id)).toEqual([...a.keys()]);
    const content = (f: { answer: string; available?: boolean; provenance?: string; channel: string }) =>
      JSON.stringify([f.answer, f.available, f.provenance, f.channel]);
    // New facts, or facts whose answer changed, are fictional additions.
    const reAnswered = variantB!.facts.filter(f => !a.has(f.id) || content(f) !== content(a.get(f.id)!));
    expect(reAnswered.map(f => f.id)).toContain("drchi-001:location");
    expect(reAnswered).toHaveLength(26);
    for (const f of reAnswered) expect(f.provenance).toBe("fictional-extension-awaiting-review");
    // Recorded facts may only be reinterpreted (topic label / pattern); their answer and provenance stay recorded.
    for (const id of ["chewing", "spontaneous", "cold"]) {
      const before = a.get(`drchi-001:${id}`)!, after = variantB!.facts.find(f => f.id === `drchi-001:${id}`)!;
      expect(before.provenance).toBeUndefined();
      expect(content(after)).toBe(content(before));
    }
    expect(new Set(variantB!.facts.map(f => f.id)).size).toBe(variantB!.facts.length);
  });

  it.each([
    // The two reported authored over-matches, and same-meaning variants.
    ["Does it act up all by itself, even when you're not eating?", ["drchi-001:spontaneous"]],
    ["Does it hurt for no reason, without biting?", ["drchi-001:spontaneous"]],
    ["Have you changed how you eat because of it?", ["drchi-001:chewing-avoidance"]],
    ["Has this changed the way you chew?", ["drchi-001:chewing-avoidance"]],
    // Round 2: chewing tobacco and a preferred chewing side are not pain on chewing.
    ["Do you chew tobacco?", ["drchi-001:tobacco"]],
    ["Do you favour one side when chewing now?", ["drchi-001:chewing-avoidance"]],
    ["Do you prefer the left side for chewing?", ["drchi-001:chewing-avoidance"]],
    // Pain on chewing is still recognized.
    ["Does it hurt when you chew?", ["drchi-001:chewing"]],
    ["Does it hurt when you eat?", ["drchi-001:chewing"]],
    ["Does chewing hurt on that tooth?", ["drchi-001:chewing"]],
  ] as const)("authored rules: %s", async (question, ids) => {
    expect((await respondToDiscovery(question, "patient", variantB!)).factIds).toEqual(ids);
  });

  it.each([
    // The words shown must answer the question, not only carry a plausible fact ID.
    ["Do you chew tobacco?", /\bchew tobacco\b/u],
    ["How often do you get your teeth cleaned?", /\bonce a year\b/u],
  ] as const)("the answer to %s addresses what was asked", async (question, words) => {
    // The second question reaches its fact through the model; ask for the fact directly here.
    const fact = variantB!.facts.find(f => f.id === (question.includes("tobacco") ? "drchi-001:tobacco" : "drchi-001:last-visit"))!;
    expect(fact.answer).toMatch(words);
    expect(fact.topic).toMatch(question.includes("tobacco") ? /chewing tobacco/u : /how often/u);
  });

  it("answers a comparison with the opposite tooth about that tooth", async () => {
    const r = await respondToDiscovery("Compare with the contralateral tooth", "exam", variantB!);
    expect(r.factIds).toEqual(["drchi-001:adjacent-teeth"]);
    expect(r.text).toMatch(/\bsame tooth on the other side\b/u);
  });

  it("keeps every authored pattern compilable and under the router's 500-character limit", () => {
    for (const f of variantB!.facts) for (const pattern of f.patterns) {
      expect(pattern.length, f.id).toBeLessThanOrEqual(500);
      expect(() => new RegExp(pattern, "iu"), f.id).not.toThrow();
    }
  });

  it("leaves the over-match in variant A untouched: frozen attempts keep their original interpretation", async () => {
    expect((await respondToDiscovery("Have you changed how you eat because of it?", "patient", variantA!)).factIds).toEqual(["drchi-001:chewing"]);
    expect((await respondToDiscovery("Do you favour one side when chewing now?", "patient", variantA!)).factIds).toEqual(["drchi-001:chewing"]);
  });

  it("refuses to build on anything but variant A", () => {
    expect(() => case001VariantB(base!)).toThrow("CASE001_VARIANT_A_REQUIRED");
  });

  it.each([
    ["Check mobility", "exam", "drchi-001:mobility"],
    ["Palpate the buccal vestibule", "exam", "drchi-001:palpation"],
    ["EPT please", "exam", "drchi-001:ept"],
    ["Take a bitewing", "exam", "drchi-001:bitewing"],
    ["Do hot drinks bother it?", "patient", "drchi-001:heat"],
    ["Do you smoke?", "patient", "drchi-001:tobacco"],
  ] as const)("answers %s from the fictional additions", async (question, channel, id) => {
    const r = await respondToDiscovery(question, channel, variantB!);
    expect(r.resolution).toBe("answered");
    expect(r.factIds).toEqual([id]);
    expect(r.fictionalExtensionFactIds).toEqual([id]);
  });

  it("keeps deliberately unsupplied results as case information, never as a doctor's omission", async () => {
    for (const q of ["Order a CBCT", "Use methylene blue dye on the crack", "Determine root extension and definitive restorability"]) {
      const r = await respondToDiscovery(q, "exam", variantB!);
      expect(r.resolution).toBe("unavailable");
      expect(r.responseKind).toBe("case-information");
      expect(r.availableFactIds).toEqual([]);
    }
  });
});
