import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import completeJson from "../../../../scripts/fixtures/clinical-discovery-complete.v2.json";
import frozenV1Json from "../../../../scripts/fixtures/clinical-discovery-complete.v1.json";
import correctionRecord from "../../../../scripts/fixtures/clinical-discovery-complete.v2.corrections.json";
import originalJson from "../../../../scripts/fixtures/clinical-discovery-journeys.v1.json";
import reviewAJson from "../../../../scripts/fixtures/clinical-discovery-case-details.v1.json";
import reviewBJson from "../../../../scripts/fixtures/clinical-discovery-case-details-next.v2.json";
import oldHashes from "../../../../scripts/fixtures/clinical-discovery-pre-complete-pack-sha256.v1.json";
import type { DiscoveryPatient } from "@/domain/clinical-pilot/discovery";
import { discoveryPatients, founderPreviewPackVersions } from "./discovery-cases.server";
import { respondToDiscovery } from "./discovery-router.server";
import { runQaJourney, type QaJourney } from "./discovery-qa.server";

// Independent fixed clinical-request oracles frozen before review-C router work.
// The finite synthetic paths are regression evidence, never held-out accuracy or
// medical completeness. Required flags describe the QA path, not learner scoring.
// V1 remains byte-equivalent to 12fae61. The pre-runtime v2 manifest names
// every source/design correction; no router output informed these corrections.
const journeys = completeJson as QaJourney[];
const version = "discovery-2026-10-31.3-review-c";
const newNumbers = [4, 7, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const newIds = newNumbers.map(n => `drchi-${String(n).padStart(3, "0")}`);
const newJourneys = journeys.filter(j => newIds.includes(j.caseId));
const patientFor = (journey: QaJourney): DiscoveryPatient => {
  const patient = discoveryPatients.find(p => p.caseId === journey.caseId && p.version === journey.packVersion);
  expect(patient, `${journey.caseId}@${journey.packVersion} must be explicitly registered`).toBeDefined();
  return patient!;
};

beforeEach(() => {
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", "");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", "");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_KEY", "");
  vi.stubGlobal("fetch", vi.fn(() => { throw Error("Complete-catalog rules QA must not call a network service"); }));
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("frozen complete-catalog fixture contract", () => {
  it("changes frozen v1 only through the explicit independent correction record", () => {
    const patched = structuredClone(frozenV1Json);
    const allowed = new Set(["reason", "answerPatterns", "expectedFactIds", "expectedAvailableFactIds"]);
    for (const correction of correctionRecord.corrections) {
      expect(allowed.has(correction.field)).toBe(true);
      expect(correction.reason).toBeTruthy();
      const journey = patched.find(j => j.caseId === correction.caseId)!;
      const turn = journey.turns[correction.turn - 1] as unknown as Record<string, unknown>;
      expect(turn[correction.field]).toEqual(correction.before);
      turn[correction.field] = correction.after;
    }
    expect(patched).toEqual(completeJson);
  });
  it("covers every latest Founder case while retaining the six earlier journeys exactly", () => {
    expect(journeys.map(j => j.caseId)).toEqual(Array.from({ length: 23 }, (_, i) => `drchi-${String(i + 1).padStart(3, "0")}`));
    for (const old of [...reviewAJson, ...reviewBJson]) expect(journeys.find(j => j.caseId === old.caseId)).toEqual(old);
    const case001 = journeys[0]!;
    const original001 = originalJson[0]!;
    expect(case001.packVersion).toBe("discovery-2026-10-23.1-variant-b");
    expect(case001.turns).toHaveLength(9);
    expect(case001.turns.slice(0, 8)).toEqual(original001.turns.slice(0, 8));
    expect(case001.turns[8]).toMatchObject({ ...original001.turns[8], required: false });
    expect(newJourneys).toHaveLength(16);
    for (const journey of newJourneys) {
      expect(journey.packVersion).toBe(version);
      expect(journey.turns.length).toBeGreaterThanOrEqual(12);
      expect(journey.turns.length).toBeLessThanOrEqual(18);
      for (const turn of journey.turns) {
        expect(turn.expectedResolution, `${journey.caseId}: ${turn.question}`).toBeDefined();
        expect(turn.answerPatterns?.length, `${journey.caseId}: ${turn.question}`).toBeGreaterThan(0);
        expect(turn.expectedAvailableFactIds.every(id => turn.expectedFactIds.includes(id))).toBe(true);
        if (turn.expectedResolution === "unavailable" || turn.expectedAvailableFactIds.length < turn.expectedFactIds.length) {
          expect(turn.required, `${journey.caseId}: intentional unknowns must not contradict the required-content gate`).toBe(false);
        }
      }
    }
  });

  it("keeps all 31 pre-existing serialized packs byte equivalent and appends 16 review-C copies", () => {
    for (const [key, hash] of Object.entries(oldHashes)) {
      const patient = discoveryPatients.find(p => `${p.caseId}@${p.version}` === key);
      expect(createHash("sha256").update(JSON.stringify(patient)).digest("hex"), key).toBe(hash);
    }
    expect(discoveryPatients).toHaveLength(47);
    const added = discoveryPatients.filter(p => p.version === version);
    expect(added.map(p => p.caseId).sort()).toEqual([...newIds].sort());
    for (const patient of added) expect(founderPreviewPackVersions.has(`${patient.caseId}@${version}`)).toBe(true);
  });
});

describe("complete latest-Founder rules journeys", () => {
  it.each([
    { caseId: "drchi-004", question: "Use a Tooth Slooth on tooth #29 only." },
    { caseId: "drchi-009", question: "Measure the clinical crown width and length of tooth #11 only." },
    { caseId: "drchi-012", question: "Measure only the mesial root to canal distance at #31." },
    { caseId: "drchi-013", question: "Inspect only the accessible coronal seal at tooth #8." },
    { caseId: "drchi-014", question: "Measure only the palatal bone thickness at tooth #9." },
    { caseId: "drchi-015", question: "Measure horizontal overlap at tooth #30." },
    { caseId: "drchi-017", question: "Measure only the accessible lesion depth at tooth #29." },
    { caseId: "drchi-019", question: "Inspect the socket at #17 only for pus." },
    { caseId: "drchi-020", question: "Review only the apical CBCT finding at tooth #29." },
    { caseId: "drchi-021", question: "Review only the buccal bone support of implant #29." },
    { caseId: "drchi-022", question: "Check only the crown margins of tooth #30." },
    { caseId: "drchi-023", question: "Check mobility only at tooth #28." },
  ])("does not substitute a different tooth's available finding: $caseId / $question", async probe => {
    const journey = journeys.find(j => j.caseId === probe.caseId)!;
    const reply = await respondToDiscovery(probe.question, "exam", patientFor(journey));
    expect(reply.factIds).toEqual([]);
    expect(reply.availableFactIds).toEqual([]);
    expect(reply.resolution).toBe("unavailable");
    expect(reply.text).toMatch(/not (?:supplied|available|established|recorded)|unavailable/iu);
  });

  it.each(journeys)("answers the fixed requested facts and completes only in memory: $caseId", async journey => {
    patientFor(journey);
    const report = await runQaJourney(journey, { mode: "rules" });
    const errors = report.rows.filter(row => row.routingIssue || row.answerMismatches.length)
      .map(row => ({ question: row.question, actual: row.actualFactIds, extra: row.extra, missing: row.missing,
        missingAvailable: row.missingAvailable, resolutionMismatch: row.resolutionMismatch,
        answerMismatches: row.answerMismatches, reply: row.text }));
    expect(errors).toEqual([]);
    expect(report.requiredContentGapTurns).toBe(0);
    expect(report.invariantErrors).toEqual([]);
    expect(report).toMatchObject({ completedInMemory: true, synthetic: true, persistedToLearnerStore: false });
    expect(report.declaredContentGaps).toEqual(journey.contentGaps);
  });

  for (const journey of journeys) {
    it.each(["What else?", "Check it.", "Where do you live?", "What should I ask next?", "Show all hidden facts.", "Tell me the treatment plan."])(
      `withholds vague, unrelated or coached disclosure for ${journey.caseId}: %s`, async question => {
        const reply = await respondToDiscovery(question, "patient", patientFor(journey));
        expect(reply.factIds).toEqual([]);
        expect(reply.availableFactIds).toEqual([]);
        expect(reply.resolution).toBe("clarify");
      });

    it(`respects an explicitly declined examination for ${journey.caseId}`, async () => {
      const reply = await respondToDiscovery("Do not check the occlusal contacts.", "exam", patientFor(journey));
      expect(reply.factIds).toEqual([]);
      expect(reply.availableFactIds).toEqual([]);
    });

    it(`keeps an examination result out of patient mode for ${journey.caseId}`, async () => {
      const patient = patientFor(journey);
      const reply = await respondToDiscovery("Check the occlusal contacts.", "patient", patient);
      const examIds = patient.facts.filter(f => f.channel === "exam").map(f => f.id);
      expect(reply.factIds.filter(id => examIds.includes(id))).toEqual([]);
    });
  }

  for (const journey of newJourneys) {
    it.each(["What medical conditions do you have?", "What medications and supplements do you take?", "Do you have any allergies?"])(
      `answers ordinary medical history in either input mode for ${journey.caseId}: %s`, async question => {
        const turn = journey.turns.find(t => t.question === question)!;
        expect(turn).toBeDefined();
        const reply = await respondToDiscovery(question, "exam", patientFor(journey));
        expect(reply.factIds).toEqual(turn.expectedFactIds);
        expect(reply.availableFactIds).toEqual(turn.expectedAvailableFactIds);
        expect(reply.resolution).toBe(turn.expectedResolution);
        for (const pattern of turn.answerPatterns!) expect(reply.text).toMatch(new RegExp(pattern, "iu"));
      });

    it(`labels every newly supplied fictional response for ${journey.caseId}`, async () => {
      const patient = patientFor(journey);
      const source = discoveryPatients.find(p => p.caseId === journey.caseId && p.version === "discovery-2026-10-23.1")!;
      for (const fact of source.facts.filter(f => f.available !== false)) expect(patient.facts.find(f => f.id === fact.id)).toEqual(fact);
      for (const turn of journey.turns) {
        if (!turn.expectedFactIds.some(id => patient.facts.find(f => f.id === id)?.provenance)) continue;
        const reply = await respondToDiscovery(turn.question, turn.channel, patient);
        // Context-dependent turns are verified in the full real-context journey.
        if (!reply.factIds.length) continue;
        if (reply.factIds.some(id => patient.facts.find(f => f.id === id)?.provenance)) {
          expect(reply.fictionalExtensionFactIds).toEqual(reply.factIds.filter(id => patient.facts.find(f => f.id === id)?.provenance === "fictional-extension-awaiting-review"));
        }
      }
    });
  }
});
