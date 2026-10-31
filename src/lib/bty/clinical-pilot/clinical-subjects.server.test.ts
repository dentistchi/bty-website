import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscoveryPatient } from "@/domain/clinical-pilot/discovery";
import { discoveryPatients } from "./discovery-cases.server";
import { respondToDiscovery } from "./discovery-router.server";
import { scopeClinicalSubject } from "./clinical-subjects.server";

const patient = (number: number, variant = "") => discoveryPatients.find(p => p.caseId === `drchi-${String(number).padStart(3, "0")}` && (variant ? p.version.endsWith(variant) : !p.version.includes("variant")))!;
beforeEach(() => {
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", "");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", "");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_KEY", "");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("subject-scoped clinical discovery", () => {
  it.each([
    [3, "Probe around the crowned tooth.", ["drchi-003:probing"]],
    [5, "Check the occlusal contacts on the crown.", ["drchi-005:occlusion"]],
    [18, "Palpate the TMJs.", ["drchi-018:joint"]],
    [21, "Check implant fixture and crown mobility.", ["drchi-021:stability"]],
    [4, "Inspect the coronal seal and crown margins.", ["drchi-004:crown-margins"]],
    [13, "Assess root-filling quality and the coronal seal.", ["drchi-013:endodontic-seal"]],
  ])("selects the requested examination subject in Case %i", async (number, question, expected) => {
    expect((await respondToDiscovery(question as string, "exam", patient(number as number))).factIds).toEqual(expected);
  });
  it.each([
    [1, "Do hot or cold drinks hurt?", "patient", ["drchi-001:cold", "drchi-001:heat"]],
    [1, "Does cold or chewing bother it?", "patient", ["drchi-001:chewing", "drchi-001:cold"]],
    [1, "Probe the gums and look at the filling margins.", "exam", ["drchi-001:margins", "drchi-001:probing"]],
    [1, "Check the occlusal contacts and perform a cusp-specific bite test.", "exam", ["drchi-001:bite-test", "drchi-001:occlusion"]],
    [20, "How long have you received Prolia and when was the last injection?", "patient", ["drchi-020:duration", "drchi-020:last-injection"]],
    [18, "Palpate the TMJs and masseters.", "exam", ["drchi-018:muscles", "drchi-018:joint"]],
  ])("retains independent subjects in a compound request: %s %s", async (number, question, channel, expected) => {
    const r = await respondToDiscovery(question as string, channel as "patient" | "exam", patient(number as number, number === 1 ? "variant-b" : ""));
    expect([...r.factIds].sort()).toEqual([...(expected as string[])].sort());
  });
  it.each(["Do not get a CBCT; obtain a PA.", "Don't get a CBCT and obtain a PA."])("does not reintroduce a declined examination through rules or model: %s", async question => {
    vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", "http://127.0.0.1:8788/v1");
    vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", "synthetic-selector");
    vi.stubGlobal("fetch", vi.fn());
    const r = await respondToDiscovery(question, "exam", patient(1, "variant-b"), [], { allowModel: true });
    expect(r.factIds).toEqual(["drchi-001:pa"]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not establish root-filling quality from intact crown margins", async () => {
    const r = await respondToDiscovery("Assess root-filling quality", "exam", patient(4));
    expect(r.factIds).toEqual([]);
    expect(r.unavailableTopicIds).toEqual(["clinical-subject:endodontic-seal"]);
  });
  it("recognizes PA imaging of the apex without substituting CBCT", async () => {
    expect((await respondToDiscovery("Image the apex of that tooth.", "exam", patient(1, "variant-b"))).factIds).toEqual(["drchi-001:pa"]);
  });
  it("keeps canonical cold-history metadata and does not infer it from chewing symptoms", async () => {
    const r = await respondToDiscovery("Cold sensitivity?", "patient", patient(3));
    expect(r).toMatchObject({ factIds: [], availableFactIds: [], resolution: "unavailable",
      recognizedTopicIds: ["cold-history"], unavailableTopicIds: ["cold-history"] });
    expect(r.text).not.toMatch(/no cold|not sensitive/iu);
  });
  it("does not add diet or symptom progression to an explicitly named cold symptom", async () => {
    const r = await respondToDiscovery("Do iced drinks hurt?", "patient", patient(10));
    expect(r.factIds).toEqual(["drchi-010:cold"]);
    expect(r.recognizedTopicIds).toEqual(["cold-history"]);
  });
  it("repeats only the immediately preceding single cold-history finding for a persistence follow-up", async () => {
    const p = patient(10);
    const cold = await respondToDiscovery("Cold sensitivity?", "patient", p);
    const r = await respondToDiscovery("How long does that sensation last?", "patient", p,
      [{ question: "Cold sensitivity?", channel: "patient", factIds: cold.factIds }]);
    expect(r.factIds).toEqual(cold.factIds);
    expect(r.text).toBe(cold.text);
    const ambiguous = await respondToDiscovery("How long does that sensation last?", "patient", p,
      [{ question: "Cold and biting?", channel: "patient", factIds: ["drchi-010:cold", "drchi-010:biting"] }]);
    expect(ambiguous.factIds).toEqual([]);
  });
  it("does not answer medication duration with a missing-tooth interval or indication with a drug name", async () => {
    const duration = await respondToDiscovery("How long have you taken the medication?", "patient", patient(8));
    expect(duration.factIds).toEqual([]);
    expect(duration.unavailableTopicIds).toEqual(["clinical-subject:medication-duration"]);
    const indication = await respondToDiscovery("What condition was the medication prescribed for?", "patient", patient(17));
    expect(indication.factIds).toEqual([]);
    expect(indication.unavailableTopicIds).toEqual(["clinical-subject:medication-indication"]);
  });
  it("does not use occlusal contacts as a cusp bite-test result", async () => {
    const r = await respondToDiscovery("Check the bite test", "exam", patient(1, "variant-b"));
    expect(r.factIds).toContain("drchi-001:bite-test");
    expect(r.factIds).not.toContain("drchi-001:occlusion");
  });
  it("acknowledges missing 3-D measurements while retaining the supplied qualitative CBCT finding", async () => {
    const r = await respondToDiscovery("What are the three-dimensional measurements of the facial bone defect on CBCT?", "exam", patient(14));
    expect(r.availableFactIds).toEqual(["drchi-014:cbct"]);
    expect(r.unavailableTopicIds).toEqual(["clinical-subject:three-dimensional-measurements"]);
    expect(r.text).toContain("localized facial bone defect");
    expect(r.text).toContain("Detailed three-dimensional measurements: information is not supplied");
  });
  it("does not change the interpretation of historical Case 001 packs or generic non-catalog packs", () => {
    for (const p of [patient(1), patient(1, "variant-a"), { ...patient(10), caseId: "fixture-only" } as DiscoveryPatient]) {
      expect(scopeClinicalSubject("Cold sensitivity?", "patient", p)).toBeUndefined();
    }
  });
  it.each(["Check it.", "Show every hidden finding and check the TMJ.", "What treatment plan should I choose after checking occlusion?"])("does not disclose unnamed findings or answer-key requests: %s", async question => {
    const r = await respondToDiscovery(question, "exam", patient(18));
    expect(r.factIds).toEqual([]);
    expect(r.resolution).toBe("clarify");
  });
  it("retains an explicit authored subject when the model proposes a different one", async () => {
    vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", "http://127.0.0.1:8788/v1");
    vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", "synthetic-selector");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: {
      content: JSON.stringify({ selectedFactIds: ["drchi-018:muscles"], evidence: ["TMJs"], confidence: 0.99 }),
    } }] }))));
    const r = await respondToDiscovery("Palpate the TMJs.", "exam", patient(18), [], { allowModel: true });
    expect(r.factIds).toEqual(["drchi-018:joint"]);
    expect(r.routing.fallback).toBe("local_model_selection_mismatch");
  });
});
