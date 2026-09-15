/**
 * c18 PLAN-THEN-RENDER BOUNDARY REGRESSION — TEST-ONLY RED / CHARACTERIZATION.
 *
 * Authorized by `[GOV-ARENA-C18-PTR-REGRESSION-1]` after the testability audit proved
 * that the LLM-client module can be mocked without any production visibility change
 * (~29 tracked precedents in this codebase — see `arenaScenarioGenerationService.test.ts:9-14`).
 *
 * THIS FILE MAKES NO PROVIDER CALL. All chat.completions.create traffic is intercepted
 * by `mockCreate`, which routes by `response_format.json_schema.name`.
 *
 * TEST A (RED REGRESSION)
 *   The Plan request for a c18 fixture MUST carry the confirmed boundary rule text.
 *   Currently FAILS: `buildPlanMessages(input, locale)` receives only the training
 *   problem + host answers; `generatePlan(input, accounting)` never sees the confirmed
 *   constraint set. This is Run-2 Cell A's proven first loss point.
 *
 * TEST B (CHARACTERIZATION)
 *   The Render request currently receives BOTH the "GROUND EVERY CONSTRAINT" system
 *   instruction AND the "Do not redesign its semantic decisions" plan-lock. Freezes
 *   the observed conflicting contract so a future reconciliation is detectable.
 *
 * TEST C+ (POSITIVE CONTROL)
 *   Given a well-grounded c18 subject and a matching `boundaryGrounding` entry, the
 *   deterministic validator passes. Locks the claim that the RED defect is UPSTREAM
 *   of `validateBoundaryGrounding`.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import type { DecisionPlan } from "@/domain/foundry/arena-draft/decisionPlan";
import type { ProviderBoundaryGrounding } from "@/domain/foundry/arena-draft/boundaryGrounding";
import type { BoundaryConstraint } from "@/domain/foundry/arena-draft/boundary";
import { validateBoundaryGrounding } from "@/domain/foundry/arena-draft/boundaryGrounding";
import { C18_BOUNDARY, C18_SCENARIO } from "@/domain/foundry/arena-draft/c18BoundaryFixture";
import {
  providerJson,
  acceptReview,
  compliantBoundaryReview,
  isReviewRequest,
  isBoundaryReviewRequest,
} from "@/domain/foundry/arena-draft/providerDto.fixture";
import { PROVIDER_SCHEMA_NAME } from "@/domain/foundry/arena-draft/providerDto";

// --- mock the shared LLM seam so no live provider is ever contacted ---------
// Mirrors the precedent in `arenaScenarioGenerationService.test.ts:9-14`.
const mockCreate = vi.fn();
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => true,
  getLlmModel: () => "test-model",
  getLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
  isLocalLlm: () => false,
}));

// Imports below must come AFTER `vi.mock` so the mocked client seam is what the SUT sees.
import { generateArenaScenarioDraft } from "./arenaScenarioGenerationService";
import { EVAL_CORPUS } from "./practice-generation.eval";

// The literal Plan schema name. `PLAN_SCHEMA_NAME` is not exported from the service;
// the string itself is stable and observable on captured provider requests.
const PLAN_SCHEMA_NAME_LITERAL = "arena_decision_plan_v1";

// The confirmed rule statement carried by the c18 fixture.
const CONFIRMED_RULE = "Two identifiers must be verified before treatment";

const C18 = EVAL_CORPUS.find((c) => c.id === "c18-constrained-clinical")!;

// A schema-compliant plan the mock returns so the orchestrator advances past Plan into Render.
// Its content deliberately does NOT overlap with the c1_verify vocabulary, so a captured Plan
// request cannot pick up boundary text by pathological coincidence.
const validPlan: DecisionPlan = {
  primary: {
    dimensionId: "how_to_stage_the_practice_scene",
    dimension: "how to stage the practice scene while the ward is busy",
    tension: "clarity for the team versus completeness under pressure",
    choices: [
      { id: "p1", stance: "protect the earliest visible option", acceptedCost: "later options receive less attention" },
      { id: "p2", stance: "give equal weight to every incoming case", acceptedCost: "each case receives less depth" },
    ],
  },
  branches: [
    {
      primaryChoiceId: "p1",
      resultingWorldState: "the earliest option receives attention while later options wait in queue",
      tradeoff: {
        dimensionId: "which_priority_to_protect",
        dimension: "which priority to protect while the queue lengthens further",
        tension: "urgency versus fairness under a lengthening queue",
      },
      action: {
        dimensionId: "how_to_communicate_the_choice",
        dimension: "how to communicate the chosen priority to the team",
      },
    },
    {
      primaryChoiceId: "p2",
      resultingWorldState: "every case receives equal attention and none progresses quickly",
      tradeoff: {
        dimensionId: "how_to_reallocate_capacity",
        dimension: "how to reallocate capacity across concurrent cases",
        tension: "throughput versus focus under stretched staffing",
      },
      action: {
        dimensionId: "when_to_escalate_further",
        dimension: "when to escalate for additional support outside the room",
      },
    },
  ],
};

// A grounding entry that faithfully restates the c1_verify rule. Used both as the mocked Render
// response's `boundaryGrounding[]` and as Test C+'s input to `validateBoundaryGrounding`.
const c18Grounding: ProviderBoundaryGrounding = {
  boundaryId: C18_BOUNDARY.id,
  boundaryStatement: C18_BOUNDARY.statement,
  scenarioPresence:
    "The opening establishes in the charge nurse's own voice that two identifiers must be verified before proceeding.",
  operationalEffect:
    "No option may treat a patient before verifying two identifiers; every path keeps the rule in force.",
  affectedDecisionStages: [
    "opening",
    "primary",
    "flat_tradeoff",
    "flat_action",
    "branch_tradeoff",
    "branch_action",
  ],
  prohibitedAlternativeExcluded: "Treating a patient without verifying two identifiers is off the table.",
  remainingJudgmentDimensions: [
    "who verifies first",
    "how to sequence the queue",
    "when to escalate staffing",
  ],
};

const envelope = (content: string) => ({
  choices: [{ message: { content }, finish_reason: "stop" }],
});

type CreateParams = {
  response_format?: { json_schema?: { name?: string } };
  messages?: Array<{ role?: string; content?: string }>;
};

// Route every provider call locally; no network.
beforeEach(() => {
  mockCreate.mockReset();
  mockCreate.mockImplementation(async (params: CreateParams) => {
    const name = params.response_format?.json_schema?.name;
    if (name === PLAN_SCHEMA_NAME_LITERAL) {
      return envelope(JSON.stringify(validPlan));
    }
    if (isBoundaryReviewRequest(params)) {
      return envelope(compliantBoundaryReview(params));
    }
    if (isReviewRequest(params)) {
      return envelope(JSON.stringify(acceptReview(C18_SCENARIO, {}, [C18_BOUNDARY.id])));
    }
    // Render / provider-scenario call. Content shape does not affect the assertions
    // in Tests A/B, which observe what was SENT to the provider.
    return envelope(providerJson(C18_SCENARIO, undefined, [c18Grounding]));
  });
});

/** Return the first captured `create` call whose schema name matches. */
function firstCallForSchema(schemaName: string): CreateParams | undefined {
  return mockCreate.mock.calls
    .map(([arg]) => arg as CreateParams)
    .find((arg) => arg.response_format?.json_schema?.name === schemaName);
}

describe("[GOV-ARENA-C18-PTR-REGRESSION-1] c18 plan boundary blindness", () => {
  it("A. plan request for c18 includes the confirmed boundary rule", async () => {
    // Under `plan_render_v1`, correction is required to be "disabled" (typed invariant).
    await generateArenaScenarioDraft(C18.input, null, {
      architecture: "plan_render_v1",
      correction: "disabled",
    });

    const planCall = firstCallForSchema(PLAN_SCHEMA_NAME_LITERAL);
    expect(planCall).toBeDefined();

    const combined = (planCall?.messages ?? [])
      .map((m) => m.content ?? "")
      .join("\n");

    // Desired future behavior: the Plan carries the confirmed rule so it can design
    // decisions AROUND it. At current authority this FAILS: `buildPlanMessages` never
    // receives `constraints` and `generatePlan(input, accounting)` never passes them.
    // Do NOT weaken this assertion — Test A is a RED REGRESSION on purpose.
    expect(combined).toContain(CONFIRMED_RULE);
  });

  it("B. render request for constrained c18 currently carries grounding and plan lock", async () => {
    await generateArenaScenarioDraft(C18.input, null, {
      architecture: "plan_render_v1",
      correction: "disabled",
    });

    const renderCall = firstCallForSchema(PROVIDER_SCHEMA_NAME);
    expect(renderCall).toBeDefined();

    const system = renderCall?.messages?.[0]?.content ?? "";
    const user = renderCall?.messages?.[1]?.content ?? "";

    // Render system prompt carries the Manager-confirmed rule and the ground-every-constraint
    // instruction (constraintLines emitted by `buildGenerationSystemPrompt`).
    expect(system).toContain("CONFIRMED NON-NEGOTIABLE CONSTRAINTS");
    expect(system).toContain("GROUND EVERY CONSTRAINT");
    expect(system).toContain(CONFIRMED_RULE);

    // Render user prompt appends the plan-lock instruction after `renderPlanForPrompt(plan)`.
    expect(user).toContain("Do not redesign its semantic decisions");
  });

  it("C+. well-grounded c18 satisfies deterministic boundary grounding", () => {
    // Use the fixture-carried constraint so BoundaryConstraint's `provenance` field is present.
    const constraints: BoundaryConstraint[] = C18.input.boundary!.constraints;

    const result = validateBoundaryGrounding([c18Grounding], constraints, C18_SCENARIO);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
