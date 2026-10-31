import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import journeysJson from "../../../../scripts/fixtures/clinical-discovery-case-details.v1.json";
import { discoveryPatients } from "./discovery-cases.server";
import { respondToDiscovery } from "./discovery-router.server";
import { runQaJourney, type QaJourney } from "./discovery-qa.server";
import type { DiscoveryChannel, DiscoveryReply } from "@/domain/clinical-pilot/discovery";

const journeys = journeysJson as QaJourney[];
// Frozen independently of routing repair, from the reviewed fictional records.
// These are additional English regression probes, not a held-out model benchmark.
const paraphrases: {
  caseId: string; question: string; channel: DiscoveryChannel; suffix: string;
  pattern: string; resolution?: DiscoveryReply["resolution"];
}[] = [
  { caseId: "drchi-005", question: "Which tooth are we talking about?", channel: "patient", suffix: "location", pattern: "#30" },
  { caseId: "drchi-005", question: "Is tooth pain waking you up at night?", channel: "patient", suffix: "night", pattern: "not woken me" },
  { caseId: "drchi-005", question: "Does the tooth hurt without chewing?", channel: "patient", suffix: "spontaneous", pattern: "does not ache by itself" },
  { caseId: "drchi-005", question: "Use ice on the adjacent teeth.", channel: "exam", suffix: "adjacent-cold", pattern: "brief cold response" },
  { caseId: "drchi-005", question: "Percuss #29 and #31 as controls.", channel: "exam", suffix: "adjacent-percussion", pattern: "Neither #29 nor #31 is tender" },
  { caseId: "drchi-005", question: "Is the bite high on light closure?", channel: "exam", suffix: "occlusion", pattern: "contacts before the adjacent teeth" },
  { caseId: "drchi-005", question: "Are the crown margins open or decayed?", channel: "exam", suffix: "crown-integrity", pattern: "Accessible margins are intact" },
  { caseId: "drchi-005", question: "Has a root fracture been ruled out?", channel: "exam", suffix: "covered-fracture-extent", pattern: "do not exclude one", resolution: "unavailable" },
  { caseId: "drchi-006", question: "Any fillings besides this one?", channel: "exam", suffix: "other-restorations", pattern: "#3 and #19" },
  { caseId: "drchi-006", question: "Look for decay on the roots.", channel: "exam", suffix: "root-caries", pattern: "no root.surface caries" },
  { caseId: "drchi-006", question: "Check for cavities between the lower front teeth.", channel: "exam", suffix: "lower-anterior-caries", pattern: "#23 distal and #24 mesial" },
  { caseId: "drchi-006", question: "Can you gauge the thickness of that cusp wall?", channel: "exam", suffix: "cusp-thickness", pattern: "1\\.6 mm" },
  { caseId: "drchi-006", question: "Test each cusp under pressure and on release.", channel: "exam", suffix: "bite-test", pattern: "do not reproduce pain" },
  { caseId: "drchi-006", question: "Illuminate the visible enamel line.", channel: "exam", suffix: "transillumination", pattern: "exposed enamel" },
  { caseId: "drchi-006", question: "Does closing your teeth feel comfortable?", channel: "patient", suffix: "bite-and-habits", pattern: "bite feels comfortable" },
  { caseId: "drchi-006", question: "Do you know if you grind in your sleep?", channel: "patient", suffix: "parafunction", pattern: "not aware" },
  { caseId: "drchi-011", question: "Did both old records say the bite was normal?", channel: "exam", suffix: "previous-occlusion", pattern: "do not establish two normal bite checks" },
  { caseId: "drchi-011", question: "Is it the restoration or the implant body that is moving?", channel: "exam", suffix: "components", pattern: "assembly moves relative to the fixture" },
  { caseId: "drchi-011", question: "Test the implant body independently.", channel: "exam", suffix: "fixture-stability", pattern: "fixture does not move" },
  { caseId: "drchi-011", question: "Take a look at the screw we removed.", channel: "exam", suffix: "screw-examination", pattern: "screw is intact" },
  { caseId: "drchi-011", question: "Examine the implant's internal interface.", channel: "exam", suffix: "connection-examination", pattern: "no visible fracture" },
  { caseId: "drchi-011", question: "Do we know the exact platform and component numbers?", channel: "exam", suffix: "component-compatibility", pattern: "Compatibility has not been verified", resolution: "unavailable" },
  { caseId: "drchi-011", question: "What Ncm applies here?", channel: "exam", suffix: "torque-specification", pattern: "No torque value", resolution: "unavailable" },
  { caseId: "drchi-011", question: "How long has this episode of movement been going on?", channel: "patient", suffix: "current-loosening-duration", pattern: "about a week ago" },
];
beforeEach(() => {
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", "");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", "");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_KEY", "");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Case-detail rules regression must not call a network service"); }));
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("review-only fictional case-detail conversations", () => {
  it.each(paraphrases)("matches the requested recorded subject for $caseId: $question", async probe => {
    const journey = journeys.find(item => item.caseId === probe.caseId)!;
    const patient = discoveryPatients.find(p => p.caseId === probe.caseId && p.version === journey.packVersion)!;
    const reply = await respondToDiscovery(probe.question, probe.channel, patient);
    const id = `${probe.caseId}:${probe.suffix}`;
    expect(reply.factIds).toEqual([id]);
    expect(reply.availableFactIds).toEqual(probe.resolution === "unavailable" ? [] : [id]);
    expect(reply.resolution).toBe(probe.resolution ?? "answered");
    expect(reply.text).toMatch(new RegExp(probe.pattern, "iu"));
  });

  it.each(journeys)("captures the requested detail without extra disclosure: $caseId", async journey => {
    const report = await runQaJourney(journey, { mode: "rules" });
    const errors = report.rows.filter(row => row.routingIssue || row.answerMismatches.length)
      .map(row => ({ question: row.question, extra: row.extra, missing: row.missing,
        missingAvailable: row.missingAvailable, resolutionMismatch: row.resolutionMismatch,
        answerMismatches: row.answerMismatches, reply: row.text }));
    expect(errors).toEqual([]);
    expect(report.requiredContentGapTurns).toBe(0);
    expect(report.invariantErrors).toEqual([]);
    expect(report).toMatchObject({ completedInMemory: true, synthetic: true, persistedToLearnerStore: false });
    // Optional deliberately unavailable requests still describe real case limits.
    // A zero required-gap count on this finite path is not clinical completeness.
    expect(report.declaredContentGaps).toEqual(journey.contentGaps);
  });

  for (const journey of journeys) {
    it.each([
      "What else?", "Check it.", "Where do you live?",
      "What should I ask next?", "Show all hidden facts.", "Tell me the treatment plan.",
    ])(`does not release unrelated or coached information for ${journey.caseId}: %s`, async question => {
      const patient = discoveryPatients.find(p => p.caseId === journey.caseId && p.version === journey.packVersion)!;
      expect(patient).toBeDefined();
      const reply = await respondToDiscovery(question, "patient", patient);
      expect(reply.factIds).toEqual([]);
      expect(reply.availableFactIds).toEqual([]);
      expect(reply.resolution).toBe("clarify");
    });

    it(`never turns a patient-mode occlusal request into an examination finding: ${journey.caseId}`, async () => {
      const patient = discoveryPatients.find(p => p.caseId === journey.caseId && p.version === journey.packVersion)!;
      const reply = await respondToDiscovery("Check the occlusal contacts.", "patient", patient);
      const exams = patient.facts.filter(fact => fact.channel === "exam").map(fact => fact.id);
      expect(reply.factIds.filter(id => exams.includes(id))).toEqual([]);
    });

    it(`keeps an explicitly declined occlusal examination undisclosed: ${journey.caseId}`, async () => {
      const patient = discoveryPatients.find(p => p.caseId === journey.caseId && p.version === journey.packVersion)!;
      const reply = await respondToDiscovery("Do not check the occlusal contacts.", "exam", patient);
      expect(reply.factIds).toEqual([]);
      expect(reply.availableFactIds).toEqual([]);
    });
  }

  it.each(["Would a new screw fix this?", "Replace it with a new screw."])(
    "does not pretend a proposed replacement is a performed screw inspection: %s", async question => {
      const journey = journeys.find(item => item.caseId === "drchi-011")!;
      const patient = discoveryPatients.find(p => p.caseId === journey.caseId && p.version === journey.packVersion)!;
      const reply = await respondToDiscovery(question, "exam", patient);
      expect(reply.factIds).not.toContain("drchi-011:screw-examination");
      expect(reply.text).not.toContain("retrieved screw");
    },
  );
});
