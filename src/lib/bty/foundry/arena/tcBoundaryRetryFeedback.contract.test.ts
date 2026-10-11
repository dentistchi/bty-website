import { vi, describe, it, expect, beforeEach } from "vitest";
import type { GuidedAnswers } from "@/domain/foundry/arena-draft/types";
import type { ModuleSourceFacts } from "./arenaScenarioSource";

/**
 * Case Acceptance attempt 05480582, through the real generation service with the provider replaced.
 *
 * Three confirmed rules; the model omits one grounding record and leaves another rule out of every
 * decision — the recorded signature. The retry must now say WHICH rule each defect concerns, while
 * the outcome, the retry limit and the recorded codes stay exactly as they were.
 */

const mockCreate = vi.fn();
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => true,
  getLlmModel: () => "test-model",
  getLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
}));

import { generateArenaScenarioDraft } from "./arenaScenarioGenerationService";
import { providerJson, isReviewRequest, isBoundaryReviewRequest } from "@/domain/foundry/arena-draft/providerDto.fixture";
import { TC_CLINICAL, TC_INSURANCE, TC_NATURAL_VACUOUS, TC_NO_PRESSURE, TC_RULES, tcGrounding } from "@/domain/foundry/arena-draft/tcCaseAcceptanceFixture";

const facts: ModuleSourceFacts = {
  problem: "Treatment Coordinators lose the patient's real concern when a patient hesitates after a treatment plan",
  observableBehavior: "Ask what the patient's real concern is before explaining more",
  successEvidence: "The patient states her concern in her own words",
  audienceType: "everyone",
  audienceDetail: null,
  learningNeeds: ["decide"],
};
const guided: GuidedAnswers = {
  hardestWhen: {
    choice: "other",
    customText: "Right after the patient says they need time to think, when they also doubt the treatment is needed because they have no pain and their insurance barely covers it.",
  },
  avoidancePressure: {
    text: "When a patient hesitates, Treatment Coordinators avoid asking what the real concern is, because the silence feels like losing the case and it is easier to explain more or push for a date.",
  },
};
const input = { locale: "en" as const, facts, guided, boundary: { mode: "judgment_with_constraints" as const, confirmed: true, constraints: TC_RULES } };

const envelope = (content: string) => ({ choices: [{ message: { content, refusal: null }, finish_reason: "stop" }] });
const signature = () => envelope(providerJson(TC_NATURAL_VACUOUS, undefined, [tcGrounding(TC_CLINICAL), tcGrounding(TC_NO_PRESSURE)]));
const genCalls = () => mockCreate.mock.calls.filter(([p]) => !isReviewRequest(p) && !isBoundaryReviewRequest(p));
const text = (i: number) => genCalls()[i]![0].messages.map((m: { content: string }) => m.content).join("\n");
const line = (t: string, code: string) => t.split("\n").find((l) => l.startsWith(`- [${code}]`)) ?? "";

beforeEach(() => {
  mockCreate.mockReset();
  mockCreate.mockImplementation(async () => signature());
});

describe("[05480582] the retry names the failing rule; nothing else changes", () => {
  it("T1 outcome, retry limit and recorded codes are those production recorded", async () => {
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect((r as { diagnosticCodes?: string[] }).diagnosticCodes).toEqual(["g_vacuous_boundary_compliance", "g_missing_boundary_reference"]);
    expect(genCalls()).toHaveLength(2); // one retry, as before
    expect(mockCreate.mock.calls.filter(([p]) => isReviewRequest(p) || isBoundaryReviewRequest(p))).toHaveLength(0);
  });

  it("T2 the second request names the no-pressure rule as vacuous and the insurance rule as missing", async () => {
    await generateArenaScenarioDraft(input);
    expect(text(0)).not.toMatch(/ATTEMPT 1 CORRECTION/);
    const second = text(1);
    expect(second).toMatch(/ATTEMPT 1 CORRECTION/);
    expect(line(second, "vacuous_boundary_compliance")).toContain(`(boundary [${TC_NO_PRESSURE.id}])`);
    expect(line(second, "missing_boundary_reference")).toContain(`(boundary [${TC_INSURANCE.id}])`);
    // The clinical rule was grounded and in the decisions; no defect is attributed to it.
    expect(line(second, "vacuous_boundary_compliance")).not.toContain(TC_CLINICAL.id);
    expect(line(second, "missing_boundary_reference")).not.toContain(TC_CLINICAL.id);
    // Rules are still pinned verbatim and unchanged.
    for (const r of TC_RULES) expect(second).toContain(`[${r.id}] "${r.statement}"`);
  });
});
