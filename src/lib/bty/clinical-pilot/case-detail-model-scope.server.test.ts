import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoveryPatients } from "./discovery-cases.server";
import { respondToDiscovery } from "./discovery-router.server";

// Controlled selector responses test the router boundary, not a real model's
// accuracy. No request leaves this process and no learner store is imported.
const version = "discovery-2026-10-31.1-review-a";
const patientFor = (id: string) => discoveryPatients.find(p => p.caseId === id && p.version === version)!;
const completion = (ids: string[], evidence: string[]) => new Response(JSON.stringify({
  choices: [{ message: { content: JSON.stringify({ selectedFactIds: ids, evidence, confidence: 0.99 }) } }],
}));
beforeEach(() => {
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", "https://synthetic.invalid/v1");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", "synthetic-scope-selector");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_KEY", "synthetic-only");
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("review-pack model evidence retains the selected fact's clause and tooth", () => {
  it.each([
    { caseId: "drchi-005", question: "Check cap borders on tooth #29. Describe background details.", id: "drchi-005:crown-integrity", evidence: "cap borders" },
    { caseId: "drchi-011", question: "Assess anchor firmness at #29. Describe background details.", id: "drchi-011:fixture-stability", evidence: "anchor firmness" },
    { caseId: "drchi-005", question: "Check cap borders on tooth #29. Describe background details.", id: "drchi-005:crown-integrity", evidence: "cap borders on tooth #29. Describe background" },
  ])("does not let an unscoped clause authorize a wrong-tooth finding: $caseId / $evidence", async ({ caseId, question, id, evidence }) => {
    vi.mocked(fetch).mockResolvedValue(completion([id], [evidence]));
    const reply = await respondToDiscovery(question, "exam", patientFor(caseId), [], { allowModel: true });
    expect(fetch).toHaveBeenCalledOnce();
    expect(reply.factIds).toEqual([]);
    expect(reply.availableFactIds).toEqual([]);
    expect(reply.resolution).toBe("clarify");
    expect(reply.routing.method).toBe("authored-rules");
    expect(reply.text).not.toMatch(/The #30 crown|#30 fixture/iu);
  });

  it("keeps the single-clause wrong-tooth exclusion", async () => {
    vi.mocked(fetch).mockResolvedValue(completion(["drchi-005:crown-integrity"], ["cap borders"]));
    const reply = await respondToDiscovery("Check cap borders on tooth #29.", "exam", patientFor("drchi-005"), [], { allowModel: true });
    expect(reply.factIds).toEqual([]);
    expect(reply.resolution).toBe("clarify");
    expect(reply.routing.fallback).toBe("local_model_invalid_selection");
  });

  it.each([
    { question: "Check #30 crown margins and percuss tooth #29.", ids: ["drchi-005:crown-integrity", "drchi-005:adjacent-percussion-29"], evidence: ["crown margins", "percuss"] },
    { question: "Check the crown margins and percuss #29.", ids: ["drchi-005:crown-integrity", "drchi-005:adjacent-percussion-29"], evidence: ["crown margins", "percuss"] },
    { question: "Check #30 crown margins. Do you have any medication allergies?", ids: ["drchi-005:crown-integrity", "drchi-005:allergies"], evidence: ["crown margins", "medication allergies"] },
  ])("retains valid independent clause selections: $question", async ({ question, ids, evidence }) => {
    vi.mocked(fetch).mockResolvedValue(completion(ids, evidence));
    const reply = await respondToDiscovery(question, "exam", patientFor("drchi-005"), [], { allowModel: true });
    expect(fetch).toHaveBeenCalledOnce();
    expect(reply.factIds).toEqual(ids);
    expect(reply.availableFactIds).toEqual(ids);
    expect(reply.routing.method).toBe("local-model");
    expect(reply.resolution).toBe("answered");
  });

  it("preserves shared evidence for two procedures requested in one clause", async () => {
    const ids = ["drchi-005:rct-history", "drchi-005:crown-history"];
    vi.mocked(fetch).mockResolvedValue(completion(ids, ["prior dental treatment"]));
    const reply = await respondToDiscovery("What prior dental treatment did tooth #30 receive?", "exam", patientFor("drchi-005"), [], { allowModel: true });
    expect(fetch).toHaveBeenCalledOnce();
    expect(reply.factIds).toEqual(ids);
    expect(reply.routing.method).toBe("local-model");
    expect(reply.responseKind).toBe("history");
  });
});
