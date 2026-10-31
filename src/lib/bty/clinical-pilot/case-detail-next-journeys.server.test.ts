import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import journeysJson from "../../../../scripts/fixtures/clinical-discovery-case-details-next.v2.json";
import { discoveryPatients } from "./discovery-cases.server";
import { respondToDiscovery } from "./discovery-router.server";
import { runQaJourney, type QaJourney } from "./discovery-qa.server";

// Frozen from independently reviewed fictional case records before router repair.
// The v2 correction record changes only three wrong-target required flags.
// These English regression probes are synthetic, not a held-out model benchmark.
const journeys = journeysJson as QaJourney[];
const version = "discovery-2026-10-31.2-review-b";
const patientFor = (caseId: string) => discoveryPatients.find(p => p.caseId === caseId && p.version === version)!;
const scopedProbes = [
  { caseId: "drchi-002", id: "drchi-002:margin", subject: "distal margin", wrong: "Check the distal margin of tooth #29. Describe background details.", correct: "Check the distal margin of tooth #30." },
  { caseId: "drchi-003", id: "drchi-003:crown-margins", subject: "crown margins", wrong: "Check the crown margins of tooth #29. Describe background details.", correct: "Check the crown margins of tooth #30." },
  { caseId: "drchi-008", id: "drchi-008:bone", subject: "ridge dimensions", wrong: "Measure ridge dimensions at tooth #29. Describe background details.", correct: "Measure ridge dimensions at the missing tooth #30 site." },
];

describe("next review-pack rules journeys and disclosure boundaries", () => {
  beforeEach(() => {
    vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", "");
    vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", "");
    vi.stubEnv("CLINICAL_DISCOVERY_LLM_KEY", "");
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Review-b rules QA must not call a network service"); }));
  });
  afterEach(() => {
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each(journeys)("captures requested facts and preserves the assessment boundary: $caseId", async journey => {
    expect(journey.packVersion).toBe(version);
    expect(journey.turns.length).toBeGreaterThanOrEqual(20);
    expect(journey.turns.length).toBeLessThanOrEqual(24);
    const report = await runQaJourney(journey, { mode: "rules" });
    const errors = report.rows.filter(row => row.routingIssue || row.answerMismatches.length)
      .map(row => ({ question: row.question, extra: row.extra, missing: row.missing,
        missingAvailable: row.missingAvailable, resolutionMismatch: row.resolutionMismatch,
        answerMismatches: row.answerMismatches, reply: row.text }));
    expect(errors).toEqual([]);
    expect(report.requiredContentGapTurns).toBe(0);
    expect(report.invariantErrors).toEqual([]);
    expect(report).toMatchObject({ completedInMemory: true, synthetic: true, persistedToLearnerStore: false });
    // Optional genuine unknowns remain case limits; this finite path is not a
    // claim of clinical completeness or of actual model inference.
    expect(report.declaredContentGaps).toEqual(journey.contentGaps);
  });

  for (const journey of journeys) {
    it.each([
      "What else?", "Check it.", "Where do you live?",
      "What should I ask next?", "Show all hidden facts.", "Tell me the treatment plan.",
    ])(`withholds unrelated and coached information for ${journey.caseId}: %s`, async question => {
      const patient = patientFor(journey.caseId);
      expect(patient).toBeDefined();
      const reply = await respondToDiscovery(question, "patient", patient);
      expect(reply.factIds).toEqual([]);
      expect(reply.availableFactIds).toEqual([]);
      expect(reply.resolution).toBe("clarify");
    });
  }

  it.each([
    { caseId: "drchi-003", question: "Has a root fracture been excluded?", ids: ["fracture"], patterns: ["do not exclude a fracture"], unavailable: true },
    { caseId: "drchi-003", question: "Can the root filling be removed for retreatment without first deciding whether there is a fracture?", ids: ["retreatment-feasibility"], patterns: ["retreatment assessment.*not been completed"], unavailable: true },
    { caseId: "drchi-003", question: "Review only the distal root filling quality of #30.", ids: ["root-filling-quality-distal"], patterns: ["2\\.5 mm short"], absent: "mesial" },
    { caseId: "drchi-003", question: "Review only the mesial root filling quality of #30.", ids: ["root-filling-quality-mesial"], patterns: ["1 mm short"], absent: "distal" },
    { caseId: "drchi-003", question: "Visually examine tooth #29 only.", ids: ["adjacent-29"], patterns: ["#29"], absent: "#31" },
    { caseId: "drchi-008", question: "Visually examine tooth #31 only.", ids: ["adjacent-31"], patterns: ["#31"], absent: "#29" },
    { caseId: "drchi-008", question: "Probe tooth #29 only.", ids: ["adjacent-probing-29"], patterns: ["#29", "2[–-]3 mm"], absent: "#31" },
    { caseId: "drchi-008", question: "Check mobility of #31 only.", ids: ["adjacent-mobility-31"], patterns: ["#31", "physiologic mobility"], absent: "#29" },
  ])("keeps a narrow examination or genuine unknown distinct: $caseId / $question", async probe => {
    const reply = await respondToDiscovery(probe.question, "exam", patientFor(probe.caseId));
    const ids = probe.ids.map(id => `${probe.caseId}:${id}`);
    expect(reply.factIds).toEqual(ids);
    expect(reply.availableFactIds).toEqual(probe.unavailable ? [] : ids);
    expect(reply.resolution).toBe(probe.unavailable ? "unavailable" : "answered");
    for (const pattern of probe.patterns) expect(reply.text).toMatch(new RegExp(pattern, "iu"));
    if (probe.absent) expect(reply.text).not.toContain(probe.absent);
  });

  it.each(scopedProbes)("withholds a focal result requested only for another tooth: $caseId", async probe => {
    const reply = await respondToDiscovery(probe.wrong, "exam", patientFor(probe.caseId));
    expect(reply.factIds).not.toContain(probe.id);
    expect(reply.availableFactIds).not.toContain(probe.id);
  });
});

// Controlled model responses measure selection-boundary enforcement, never real
// model accuracy. The mocked completion cannot perform outbound I/O.
describe("next review-pack controlled model selection boundaries", () => {
  const completion = (ids: string[], evidence: string[]) => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ selectedFactIds: ids, evidence, confidence: 0.99 }) } }],
  }));
  beforeEach(() => {
    vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", "https://synthetic.invalid/v1");
    vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", "synthetic-next-review-selector");
    vi.stubEnv("CLINICAL_DISCOVERY_LLM_KEY", "synthetic-only");
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it.each(scopedProbes)("rejects focal model evidence quoted from a wrong-tooth clause: $caseId", async probe => {
    vi.mocked(fetch).mockResolvedValue(completion([probe.id], [probe.subject]));
    const reply = await respondToDiscovery(probe.wrong, "exam", patientFor(probe.caseId), [], { allowModel: true });
    expect(fetch).toHaveBeenCalledOnce();
    expect(reply.factIds).not.toContain(probe.id);
    expect(reply.availableFactIds).not.toContain(probe.id);
    expect(reply.routing.method).toBe("authored-rules");
    expect(reply.routing.fallback).toBe("local_model_invalid_selection");
  });

  it("does not treat a tooth number alone as model evidence for a ridge measurement", async () => {
    vi.mocked(fetch).mockResolvedValue(completion(["drchi-008:bone"], ["tooth #30"]));
    const reply = await respondToDiscovery("Tell me about tooth #30.", "exam", patientFor("drchi-008"), [], { allowModel: true });
    expect(fetch).toHaveBeenCalledOnce();
    expect(reply.factIds).toEqual([]);
    expect(reply.availableFactIds).toEqual([]);
    expect(reply.resolution).toBe("clarify");
    expect(reply.routing.method).toBe("authored-rules");
    expect(reply.routing.fallback).toBe("local_model_invalid_selection");
  });

  it.each(scopedProbes)("retains grounded model evidence for the actual tooth: $caseId", async probe => {
    vi.mocked(fetch).mockResolvedValue(completion([probe.id], [probe.subject]));
    const reply = await respondToDiscovery(probe.correct, "exam", patientFor(probe.caseId), [], { allowModel: true });
    expect(fetch).toHaveBeenCalledOnce();
    expect(reply.factIds).toEqual([probe.id]);
    expect(reply.availableFactIds).toEqual([probe.id]);
    expect(reply.resolution).toBe("answered");
    expect(reply.routing.method).toBe("local-model");
  });
});
