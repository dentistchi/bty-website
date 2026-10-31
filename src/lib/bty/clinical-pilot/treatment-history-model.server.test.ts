import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoveryPatients } from "./discovery-cases.server";
import { respondToDiscovery } from "./discovery-router.server";

// Transport is entirely stubbed: these are selection-contract regressions, not
// a measurement of qwen, gateway availability, or a real doctor's conversation.
const patient = discoveryPatients.find(p => p.caseId === "drchi-005")!;
const completion = (id: string, evidence: string) => new Response(JSON.stringify({
  choices: [{ message: { content: JSON.stringify({ selectedFactIds: [id], evidence: [evidence], confidence: 0.95 }) } }],
}));
beforeEach(() => {
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", "https://model.invalid/v1");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", "synthetic-selector");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_KEY", "synthetic-key");
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("treatment-history model contract", () => {
  it.each(["patient", "exam"] as const)("keeps the screenshot answer when model grounding fails in %s", async channel => {
    vi.mocked(fetch).mockResolvedValue(completion("drchi-005:rct-history", "What did we do"));
    const r = await respondToDiscovery("What did we do", channel, patient, [], { allowModel: true });
    expect(fetch).toHaveBeenCalledOnce();
    expect(r.factIds).toEqual(["drchi-005:rct-history"]);
    expect(r.text).toBe("I had root canal treatment eight months ago.");
    expect(r.routing.method).toBe("authored-rules");
    expect(r.routing.fallback).toBe("local_model_ungrounded_selection");
  });
  it.each(["patient", "exam"] as const)("accepts the matching bounded history selection in %s", async channel => {
    vi.mocked(fetch).mockResolvedValue(completion("drchi-005:rct-history", "previous work"));
    const r = await respondToDiscovery("Any previous work on this tooth?", channel, patient, [], { allowModel: true });
    expect(r.factIds).toEqual(["drchi-005:rct-history"]);
    expect(r.routing.method).toBe("local-model");
    expect(r.responseKind).toBe("history");
  });
  it("does not substitute an unrelated fact for missing procedure history", async () => {
    const missing = discoveryPatients.find(p => p.caseId === "drchi-002")!;
    vi.mocked(fetch).mockResolvedValue(completion(missing.facts[0].id, "previous work"));
    const r = await respondToDiscovery("Any previous work on this tooth?", "patient", missing, [], { allowModel: true });
    expect(r.factIds).toEqual([]);
    expect(r.resolution).toBe("unavailable");
    expect(r.unavailableTopicIds).toContain("dental-treatment-history");
    expect(r.routing.fallback).toBe("local_model_selection_mismatch");
  });
  it("preserves correct history without inference for a caller outside model access", async () => {
    const r = await respondToDiscovery("What did we do", "exam", patient);
    expect(fetch).not.toHaveBeenCalled();
    expect(r.factIds).toEqual(["drchi-005:rct-history"]);
    expect(r.routing.fallback).toBe("local_model_not_enabled");
  });
});
