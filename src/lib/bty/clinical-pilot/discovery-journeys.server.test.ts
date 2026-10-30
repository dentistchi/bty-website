import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import catalog from "@/domain/clinical-pilot/catalog.json";
import journeysJson from "../../../../scripts/fixtures/clinical-discovery-journeys.v1.json";
import { runQaJourney, type QaJourney } from "./discovery-qa.server";

const journeys = journeysJson as QaJourney[];
beforeEach(() => {
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", "");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", "");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_KEY", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("authored catalog autonomous conversation regression", () => {
  it("has one sequential QA journey for each catalog case", () => {
    expect(journeys.map(j => j.caseId).sort()).toEqual(catalog.map(c => c.caseId).sort());
  });
  it.each(journeys)("captures the requested information and completes $caseId without persistence", async journey => {
    const report = await runQaJourney(journey, { mode: "rules" });
    const errors = report.rows.filter(r => r.routingIssue || r.answerMismatches.length)
      .map(r => ({ question: r.question, missing: r.missing, extra: r.extra, answerMismatches: r.answerMismatches }));
    expect(errors).toEqual([]);
    expect(report.invariantErrors).toEqual([]);
    expect(report).toMatchObject({ completedInMemory: true, synthetic: true, persistedToLearnerStore: false });
    // A correct "not supplied" reply is a content gap, not successful clinical
    // information gathering. The CLI --check separately fails those gaps.
  });
});
