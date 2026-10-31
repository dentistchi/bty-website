import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { buildSync } from "esbuild";
import { createQaEncounter, runQaJourney, type QaJourney } from "./discovery-qa.server";
import { respondToDiscovery } from "./discovery-router.server";
import { releasedReference } from "@/domain/clinical-pilot/pilot";

const journey: QaJourney = { caseId: "drchi-006", packVersion: "discovery-2026-10-23.1", contentGaps: [], turns: [
  { question: "Recurrent decay?", channel: "exam", expectedFactIds: ["drchi-006:restoration"], expectedAvailableFactIds: ["drchi-006:restoration"], reason: "Target restoration" },
  { question: "Assess caries risk", channel: "exam", expectedFactIds: ["drchi-006:caries-risk"], expectedAvailableFactIds: [], required: true, reason: "Needed for plan" },
] };
beforeEach(() => { vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", ""); vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", ""); });
afterEach(() => vi.unstubAllEnvs());

describe("synthetic autonomous encounter QA", () => {
  it("distinguishes a correctly understood question from missing required case information", async () => {
    const report = await runQaJourney(journey);
    expect(report).toMatchObject({ synthetic: true, persistedToLearnerStore: false, completedInMemory: true,
      routingIssueTurns: 0, requiredContentGapTurns: 1, invariantErrors: [] });
    expect(report.rows[1]).toMatchObject({ routingIssue: false, contentGap: true, availableFactIds: [], unavailableFactIds: ["drchi-006:caries-risk"] });
  });
  it("uses actual independently issued context and limits it to the production four-turn window", async () => {
    const responder = vi.fn(respondToDiscovery);
    const longer = { ...journey, turns: Array.from({ length: 6 }, (_, i) => ({ ...journey.turns[0], question: `Recurrent decay? ${i}` })) };
    await runQaJourney(longer, { responder });
    expect(responder.mock.calls[5][3]?.map(t => t.question)).toEqual(longer.turns.slice(1, 5).map(t => t.question));
    expect(responder.mock.calls[5][4]).toEqual({ allowModel: false });
  });
  it("detects fabricated acquisition rather than crediting an unavailable finding", async () => {
    const report = await runQaJourney({ ...journey, turns: [journey.turns[1]] }, { responder: async () => ({
      channel: "exam", text: "There is no caries risk.", factIds: ["drchi-006:caries-risk"], availableFactIds: ["drchi-006:caries-risk"],
      unavailableFactIds: [], resolution: "answered", routing: { method: "authored-rules", version: "bad-qa-fixture" },
    }) });
    expect(report.invariantErrors).toContain("unavailable-fact-recorded-as-acquired");
  });
  it("detects an issued available finding omitted from the acquisition record", async () => {
    const report = await runQaJourney({ ...journey, turns: [journey.turns[0]] }, { responder: async () => ({
      channel: "exam", text: "Synthetic finding", factIds: ["drchi-006:restoration"], availableFactIds: [],
      unavailableFactIds: [], resolution: "answered", routing: { method: "authored-rules", version: "bad-qa-fixture" },
    }) });
    expect(report.invariantErrors).toContain("issued-facts-and-availability-partition-disagree");
  });
  it("keeps reference release and reactions in the in-memory domain flow", async () => {
    const session = createQaEncounter(journey);
    await session.message(journey.turns[1].question, "exam");
    expect(releasedReference(session.trace)).toBeNull();
    session.conclude("Synthetic QA assessment.");
    expect(releasedReference(session.trace)?.interviewContext?.packVersion).toBe(journey.packVersion);
    const before = structuredClone(session.trace);
    session.react();
    expect(session.trace.events.slice(0, before.events.length)).toEqual(before.events);
    expect(session.invariantErrors).toEqual([]);
  });
  it("does not silently call a model without explicit configuration", () => {
    expect(() => createQaEncounter(journey, { mode: "model" })).toThrow("Explicit local-model configuration");
  });
  it("has no database, authentication or persistence service in its import graph", () => {
    const result = buildSync({ entryPoints: ["src/lib/bty/clinical-pilot/discovery-qa.server.ts"], bundle: true,
      write: false, platform: "node", metafile: true, alias: { "@": `${process.cwd()}/src` } });
    expect(Object.keys(result.metafile!.inputs).filter(p => /@supabase|\/auth\/|service\.server|supabaseAdmin/iu.test(p))).toEqual([]);
  });
});
