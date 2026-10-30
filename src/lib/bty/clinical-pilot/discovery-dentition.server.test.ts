import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoveryPatients } from "./discovery-cases.server";
import { respondToDiscovery } from "./discovery-router.server";

const patient = discoveryPatients.find(p => p.caseId === "drchi-006")!;
const risk = patient.facts.find(f => f.id === "drchi-006:caries-risk")!;
beforeEach(() => {
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", "");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", "");
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Case 006 dentition-wide requests", () => {
  it.each(["Any other restoration in teeth", "Are there restorations on other teeth?", "On other teeth", "Assess caries risk", "Any root caries?"])(
    "does not substitute the target tooth's restoration for %s", async question => {
      const before = structuredClone(patient);
      const reply = await respondToDiscovery(question, "exam", patient);
      expect(reply.factIds).toEqual([risk.id]);
      expect(reply.unavailableFactIds).toEqual([risk.id]);
      expect(reply.availableFactIds).toEqual([]);
      expect(reply.resolution).toBe("unavailable");
      expect(reply.text).toBe(risk.answer);
      expect(patient).toEqual(before);
    });

  it("retains the known target-tooth finding for a recurrent-decay request", async () => {
    const reply = await respondToDiscovery("Recurrent decay?", "exam", patient);
    expect(reply.factIds).toEqual(["drchi-006:restoration"]);
    expect(reply.unavailableFactIds).toEqual([]);
  });

  it("preserves both explicitly requested scopes in a mixed examination", async () => {
    const reply = await respondToDiscovery("Check caries risk and inspect the restoration", "exam", patient);
    expect(reply.factIds).toEqual(["drchi-006:restoration", "drchi-006:cusp-line", risk.id]);
    expect(reply.unavailableFactIds).toEqual([risk.id]);
    expect(reply.availableFactIds).toEqual(["drchi-006:restoration", "drchi-006:cusp-line"]);
  });

  it("rejects a model's target-tooth substitution for a dentition-wide request", async () => {
    vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", "http://model.invalid/v1");
    vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", "fixture-model");
    vi.mocked(fetch).mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify({
      selectedFactIds: ["drchi-006:restoration"], evidence: ["restoration"], confidence: 0.99,
    }) } }] }));
    const reply = await respondToDiscovery("Any other restoration in teeth", "exam", patient, [], { allowModel: true });
    expect(reply.factIds).toEqual([risk.id]);
    expect(reply.routing.fallback).toBe("local_model_selection_mismatch");
    expect(reply.availableFactIds).toEqual([]);
  });
});
