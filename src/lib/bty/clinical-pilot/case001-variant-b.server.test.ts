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

  it("keeps every variant A fact, and labels every addition or replacement as awaiting Dr. Chi's review", () => {
    const a = new Map(variantA!.facts.map(f => [f.id, f]));
    expect(variantB!.facts.slice(0, a.size).map(f => f.id)).toEqual([...a.keys()]);
    const changed = variantB!.facts.filter(f => JSON.stringify(f) !== JSON.stringify(a.get(f.id)));
    expect(changed.map(f => f.id)).toContain("drchi-001:location");
    expect(changed.length).toBeGreaterThan(20);
    for (const f of changed) expect(f.provenance).toBe("fictional-extension-awaiting-review");
    expect(new Set(variantB!.facts.map(f => f.id)).size).toBe(variantB!.facts.length);
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
