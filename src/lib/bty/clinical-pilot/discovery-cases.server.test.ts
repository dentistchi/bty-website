import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoveryPatients } from "./discovery-cases.server";
import { respondToDiscovery } from "./discovery-router.server";

beforeEach(() => { vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", ""); vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", ""); });
afterEach(() => vi.unstubAllEnvs());
const patient = (number: number) => discoveryPatients.find(p => p.caseId === `drchi-${String(number).padStart(3, "0")}`)!;
describe("recorded case context is discovered, not filled in", () => {
  it("covers all 23 cases with valid, unique versioned facts", () => {
    expect(new Set(discoveryPatients.map(p => p.caseId)).size).toBe(23);
    expect(new Set(discoveryPatients.map(p => `${p.caseId}:${p.version}`)).size).toBe(discoveryPatients.length);
    for (const p of discoveryPatients) {
      expect(new Set(p.facts.map(f => f.id)).size).toBe(p.facts.length);
      for (const f of p.facts) {
      expect(f.answer.trim()).not.toBe("");
      for (const pattern of f.patterns) expect(() => new RegExp(pattern, "iu")).not.toThrow();
      }
    }
  });
  it("keeps a bite symptom different from an unrecorded perceived-bite complaint", async () => {
    const symptom = await respondToDiscovery("Does it hurt when you bite?", "patient", patient(1));
    expect(symptom.text).toContain("hard food");
    const bite = await respondToDiscovery("Do you have a problem with your bite?", "patient", patient(1));
    expect(bite.resolution).toBe("unavailable");
    expect(bite.unavailableFactIds).toContain("drchi-001:bite-history");
    expect(bite.availableFactIds).toEqual([]);
    expect(bite.text).not.toContain("no problem");
  });
  it("never turns an unperformed bite test into a crack diagnosis", async () => {
    const r = await respondToDiscovery("Perform cusp-specific bite testing", "exam", patient(1));
    expect(r.resolution).toBe("unavailable");
    expect(r.text).toContain("not performed");
    expect(r.availableFactIds).toEqual([]);
    expect(r.text).not.toContain("positive");
  });
  it("returns the requested contact finding without assuming a defective adjacent filling", async () => {
    const contact = await respondToDiscovery("Check the floss contact", "exam", patient(23));
    expect(contact.text).toContain("little resistance");
    expect(contact.factIds).toEqual(["drchi-023:contact"]);
    const contour = await respondToDiscovery("Assess #29 filling distal contour", "exam", patient(23));
    expect(contour.unavailableFactIds).toContain("drchi-023:adjacent-contour");
    expect(contour.text).toContain("defect has not been confirmed");
    const inspect29 = await respondToDiscovery("Inspect #29", "exam", patient(23));
    expect(inspect29.factIds).toEqual(["drchi-023:adjacent-restoration"]);
    expect(inspect29.text).not.toContain("crown");
    const percuss29 = await respondToDiscovery("Check percussion on tooth 29", "exam", patient(23));
    expect(percuss29.resolution).toBe("clarify");
    expect(percuss29.factIds).toEqual([]);
  });
  it("keeps the original Case 001 while the fixed fictional variant supports a follow-up interview", async () => {
    const base = patient(1);
    const variant = discoveryPatients.find(p => p.caseId === base.caseId && p.version.endsWith("-variant-a"))!;
    expect(variant).toBeDefined();
    expect(base.facts.find(f => f.id.endsWith(":bite-history"))!.available).toBe(false);
    const general = await respondToDiscovery("Do you have any problems with your bite?", "patient", variant);
    expect(general.text).toBe("What do you mean by my bite?");
    expect(general.factIds).toEqual(["drchi-001:bite-history"]);
    expect(general.fictionalExtensionFactIds).toEqual(general.factIds);
    const followup = await respondToDiscovery("Do you move your jaw backward or sideways to make your teeth fit?", "patient", variant);
    expect(followup.factIds).toEqual(["drchi-001:jaw-shift"]);
    expect(followup.text).toMatch(/^No,/);
    const test = await respondToDiscovery("Perform cusp-specific bite testing", "exam", variant);
    expect(test.text).toContain("pain on release");
    const unknown = await respondToDiscovery("Determine root extension and definitive restorability", "exam", variant);
    expect(unknown.resolution).toBe("unavailable");
    expect(unknown.availableFactIds).toEqual([]);
  });
});
