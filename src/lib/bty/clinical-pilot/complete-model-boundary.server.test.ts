import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoveryPatients } from "./discovery-cases.server";
import { respondToDiscovery } from "./discovery-router.server";

// Controlled adversarial selections exercise disclosure boundaries only. These
// stubs are not a measurement of qwen accuracy or a production connection check.
const patient = discoveryPatients.find(p => p.caseId === "drchi-021" && p.version === "discovery-2026-10-31.3-review-c")!;
const result = (id: string, evidence: string) => new Response(JSON.stringify({ choices: [{ message: {
  content: JSON.stringify({ selectedFactIds: [id], evidence: [evidence], confidence: 0.99 }),
} }] }));
beforeEach(() => {
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", "https://synthetic.invalid/v1");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", "synthetic-boundary-selector");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_KEY", "synthetic-only");
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("complete review selector disclosure boundary", () => {
  it.each(["Continue.", "Go on.", "Further information?", "Carry on.", "Explain further."])("a vague continuation cannot acquire a hidden history fact: %s", async question => {
    vi.mocked(fetch).mockResolvedValue(result("drchi-021:medical-history", question.replace(/[.?]/gu, "")));
    const reply = await respondToDiscovery(question, "patient", patient, [], { allowModel: true });
    expect(reply.factIds).toEqual([]);
    expect(reply.availableFactIds).toEqual([]);
    expect(reply.resolution).toBe("clarify");
  });
  it("cannot borrow a matching clinical noun to acquire the opposite support surface", async () => {
    vi.mocked(fetch).mockResolvedValue(result("drchi-021:remaining-support-lingual", "buccal support"));
    const reply = await respondToDiscovery("Measure buccal support at #30. Describe background details.", "exam", patient, [], { allowModel: true });
    expect(reply.factIds).toEqual(["drchi-021:remaining-support-buccal"]);
    expect(reply.text).not.toMatch(/On the lingual aspect/iu);
    expect(reply.routing.method).toBe("authored-rules");
  });
  it("retains a valid narrow selection", async () => {
    vi.mocked(fetch).mockResolvedValue(result("drchi-021:remaining-support-buccal", "buccal support"));
    const reply = await respondToDiscovery("Measure buccal support at #30.", "exam", patient, [], { allowModel: true });
    expect(reply.factIds).toEqual(["drchi-021:remaining-support-buccal"]);
    expect(reply.routing.method).toBe("local-model");
  });
  it("handles an explicit five-region muscle examination by fixed rules without expanding model selection limits", async () => {
    const musclePatient = discoveryPatients.find(p => p.caseId === "drchi-018" && p.version === patient.version)!;
    const reply = await respondToDiscovery("Palpate the masseters, temporalis, SCM, neck, and shoulders.", "exam", musclePatient, [], { allowModel: true });
    expect(new Set(reply.factIds)).toEqual(new Set(["muscles", "temporalis", "scm", "neck", "shoulder"].map(id => `drchi-018:${id}`)));
    expect(reply.routing.method).toBe("authored-rules");
    expect(fetch).not.toHaveBeenCalled();
  });
});
