import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoveryPatients } from "./discovery-cases.server";
import { respondToDiscovery } from "./discovery-router.server";

const patient = discoveryPatients.find(p => p.caseId === "drchi-001" && p.version.endsWith("-variant-b"))!;
const id = (suffix: string) => `${patient.caseId}:${suffix}`;
const coldContext = [{ question: "Does cold bother it?", channel: "patient" as const, factIds: [id("cold")] }];
const selection = (suffix: string, evidence: string) => new Response(JSON.stringify({ choices: [{ message: {
  content: JSON.stringify({ selectedFactIds: [id(suffix)], evidence: [evidence], confidence: 0.99 }),
} }] }));
beforeEach(() => {
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", "http://model.invalid/v1");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", "fixture-model");
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Founder preview: cold-persistence context", () => {
  it.each(["How long does that last?", "How long does it last?", "Does it linger?", "Does the feeling stay for a while?", "Does it hang around afterwards?"])(
    "repeats only the already disclosed cold history for %s", async question => {
      vi.mocked(fetch).mockResolvedValue(selection("pain-severity", "last"));
      const r = await respondToDiscovery(question, "patient", patient, coldContext, { allowModel: true });
      expect(r.factIds).toEqual([id("cold")]);
      expect(r.text).toBe(patient.facts.find(f => f.id === id("cold"))!.answer);
      expect(r.availableFactIds).toEqual(coldContext[0].factIds);
      expect(r.routing).toMatchObject({ method: "authored-rules", version: expect.stringContaining("context-persistence/v1") });
      expect(r.routing.fallback).toBeUndefined();
      expect(fetch).not.toHaveBeenCalled();
    });

  it("uses the history source even when both UI selections are Exam", async () => {
    const r = await respondToDiscovery("How long does that last?", "exam", patient,
      [{ ...coldContext[0], channel: "exam" }], { allowModel: true });
    expect(r).toMatchObject({ channel: "exam", responseKind: "history", factIds: [id("cold")] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [],
    [{ ...coldContext[0], factIds: [] }],
    [{ ...coldContext[0], factIds: [id("cold"), id("heat")] }],
    [{ ...coldContext[0], factIds: ["another-case:cold"] }],
    [{ ...coldContext[0], factIds: [id("cold-test")] }],
    [...coldContext, { question: "Do you take medication?", channel: "patient" as const, factIds: [id("medications")] }],
  ].map(context => ({ context })))("does not infer a single cold antecedent from $context", async ({ context }) => {
    vi.mocked(fetch).mockResolvedValue(selection("pain-severity", "last"));
    const r = await respondToDiscovery("How long does that last?", "patient", patient, context, { allowModel: true });
    expect(r.routing.version).not.toContain("context-persistence");
    expect(r.factIds).not.toContain(id("cold"));
  });

  it("does not turn an unavailable cold history into available information", async () => {
    const p = { ...patient, facts: patient.facts.map(f => f.id === id("cold") ? { ...f, available: false } : f) };
    vi.mocked(fetch).mockResolvedValue(selection("pain-severity", "last"));
    const r = await respondToDiscovery("How long does that last?", "patient", p, coldContext, { allowModel: true });
    expect(r.routing.version).not.toContain("context-persistence");
    expect(r.availableFactIds).not.toContain(id("cold"));
  });

  it.each(["And hot ones?", "How long ago was the filling put in?", "How long does that last? Also check mobility.", "How long does tooth #31 hurt?"])(
    "does not intercept a new or mixed request: %s", async question => {
      vi.mocked(fetch).mockResolvedValue(selection("heat", "hot"));
      const r = await respondToDiscovery(question, "exam", patient, coldContext, { allowModel: true });
      expect(r.routing.version).not.toContain("context-persistence");
    });
});

describe("Founder preview: apical imaging", () => {
  it.each(["Image the apex of that tooth.", "Get a film of the root end.", "Take a picture of the root tip."])(
    "keeps the authored PA convention when a model proposes CBCT: %s", async question => {
      vi.mocked(fetch).mockResolvedValue(selection("cbct", question));
      const r = await respondToDiscovery(question, "exam", patient, [], { allowModel: true });
      expect(r.factIds).toEqual([id("pa")]);
      expect(r.routing).toMatchObject({ method: "authored-rules", fallback: "local_model_selection_mismatch" });
    });

  it.each([
    ["Get a CBCT image of the apex.", ["cbct"]],
    ["Take a 3-D image of the root tip.", ["cbct"]],
    ["Order a PA and a CBCT.", ["pa", "cbct"]],
    ["Get a CBCT of the periapical area.", ["cbct"]],
    ["Inspect the 3-D printed crown.", []],
    ["Order a periapical radiograph and a CBCT.", ["pa", "cbct"]],
    ["Order a CBCT and a periapical radiograph.", ["pa", "cbct"]],
    ["Does the root tip hurt?", []],
  ] as const)("retains the imaging scope in %s", async (question, suffixes) => {
    vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", ""); vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", "");
    const r = await respondToDiscovery(question, "exam", patient);
    expect(r.factIds).toEqual(suffixes.map(id));
  });
});
