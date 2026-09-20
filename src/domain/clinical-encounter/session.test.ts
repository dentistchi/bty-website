import{it,expect}from"vitest";import{startEncounter,submit}from"./session";it("runs authored Case 001 encounter in ordered raw events",()=>{let t=startEncounter("t");t=submit(t,"When did this happen?");t=submit(t,"cold test #8");t=submit(t,"Pulp is exposed?");t=submit(t,"Show me the PA");expect(t.events.map(e=>e.type)).toContain("patient_answered");expect(t.events.map(e=>e.type)).toContain("clinical_finding_revealed");expect(t.events.some(e=>e.response?.includes("#8 responds"))).toBe(true);expect(t.events.some(e=>e.response?.includes("No visible pulp exposure"))).toBe(true);expect(t.events.map(e=>e.sequence)).toEqual(t.events.map((_,i)=>i+1))})

import { completeEncounter, decisionFromTrace, recordDecision, emptyDecision } from "./session";
import { exportEncounterV2 } from "./neurosight";
import { compareEncounter } from "./comparison";
it("records structured reasoning once, uses supplied timestamps and feeds export/comparison from the same immutable trace", () => {
  const start = startEncounter("trace", "2026-09-19T00:00:00Z");
  const answers = { ...emptyDecision, differential: "Pulp injury", diagnosis: "Fracture", treatment: "Protect", followup: "Review", confidence: "Moderate", rationale: "Cold response" };
  const active = recordDecision(submit(start, "cold test #8", "2026-09-19T00:00:05Z"), answers, "2026-09-19T00:00:10Z");
  const done = completeEncounter(active, answers, "2026-09-19T00:00:20Z");
  expect(start.events[0].timestamp).toBe("2026-09-19T00:00:00Z");
  expect(done.events.at(-1)?.elapsedMs).toBe(20000);
  expect(decisionFromTrace(done)).toEqual(answers);
  expect(done.events.filter(e => e.type === "diagnosis_submitted")).toHaveLength(1);
  expect(exportEncounterV2(done, "owner").events).toEqual(done.events);
  expect(exportEncounterV2(done, "owner").diagnosisTimeline[0].response).toBe("Fracture");
  expect(compareEncounter(done).actionsBeforeDecision).toContain("cold-8");
  expect(() => submit(done, "When did this happen?")).toThrow("IMMUTABLE");
  expect(() => completeEncounter(done, answers)).toThrow("IMMUTABLE");
  expect(active.events.some(e => e.type === "encounter_completed")).toBe(false);
});
