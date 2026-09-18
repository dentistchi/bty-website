/**
 * c18 CONSTRAINT-COMPLIANT GENERATION — REGRESSION.
 *
 * THIS FILE MAKES NO PROVIDER CALL. Every `chat.completions.create` is intercepted by
 * `mockCreate`, using the same seam `c18PtrBoundaryRegression.test.ts` relies on. No
 * `.eval-artifacts` file is read at runtime.
 *
 * THE MEASURED DEFECT (live c18, plan_render_v1)
 *
 * The constrained Plan instruction bound how a DIMENSION is phrased. The live plan obeyed it —
 * `"How to verify the two identifiers before treatment"` is a how-to-comply question — and then
 * offered `p2.stance = "Proceed without full verification"` with a branch whose resulting world
 * was `"Treatment is initiated without complete verification of identifiers."` Render copied the
 * stance verbatim into a learner-facing label, and `validateConstraintCompliance` rejected the
 * draft at Level 3. Nothing bound the OPTIONS the dimension offers, so the confirmed rule became
 * the axis of the dilemma instead of the floor beneath it.
 *
 * TEST A — the deterministic safety gate catches the real defect shape, with a negative control.
 * TEST B — correction-enabled generation recovers: two attempts, packet on the second, success.
 * TEST C — correction-disabled generation stops at one attempt and reports the violation.
 * TEST D — the constrained PLAN request forbids introducing a violating alternative.
 *
 * STEP 5 — `boundaryCompliance` is a CLAIM, never proof. The violating choice below carries
 * `boundaryCompliance: ["c1_verify"]` and is still rejected.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";
import type { ProviderBoundaryGrounding } from "@/domain/foundry/arena-draft/boundaryGrounding";
import { validateConstraintCompliance } from "@/domain/foundry/arena-draft/safety";
import { validateChoiceConstructions } from "@/domain/foundry/arena-draft/choiceConstruction";
import { C18_BOUNDARY, C18_SCENARIO } from "@/domain/foundry/arena-draft/c18BoundaryFixture";
import {
  toProviderDto,
  providerJson,
  acceptReview,
  compliantBoundaryReview,
  isReviewRequest,
  isBoundaryReviewRequest,
} from "@/domain/foundry/arena-draft/providerDto.fixture";
import { PROVIDER_SCHEMA_NAME } from "@/domain/foundry/arena-draft/providerDto";
import { MAX_CALLS_PER_KIND } from "@/domain/foundry/arena-draft/generationCallSequence";

// --- mock the shared LLM seam so no live provider is ever contacted ---------
const mockCreate = vi.fn();
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => true,
  getLlmModel: () => "test-model",
  getLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
  isLocalLlm: () => false,
}));

// Imports below must come AFTER `vi.mock` so the mocked client seam is what the SUT sees.
import { generateArenaScenarioDraft, __setGenObserver, type GenObservation } from "./arenaScenarioGenerationService";
import { EVAL_CORPUS } from "./practice-generation.eval";

/** The literal Plan schema name; `PLAN_SCHEMA_NAME` is not exported from the service. */
const PLAN_SCHEMA_NAME_LITERAL = "arena_decision_plan_v1";

const C18 = EVAL_CORPUS.find((c) => c.id === "c18-constrained-clinical")!;
const CONFIRMED_IDS = [C18_BOUNDARY.id];

// --- the measured live defect, as data --------------------------------------
const VIOLATING_LABEL = "Proceed without full verification";
const VIOLATING_ACTION = "Initiate treatment without verifying both identifiers.";

/** c18, with the live violating stance substituted at `primary[1]`. Everything else is the fixture. */
const VIOLATING_SCENARIO: ArenaScenarioDraft = {
  ...C18_SCENARIO,
  primary: {
    ...C18_SCENARIO.primary,
    choices: C18_SCENARIO.primary.choices.map((c, i) => (i === 1 ? { ...c, label: VIOLATING_LABEL } : c)),
  },
};

const c18Grounding: ProviderBoundaryGrounding = {
  boundaryId: C18_BOUNDARY.id,
  boundaryStatement: C18_BOUNDARY.statement,
  scenarioPresence:
    "The opening establishes in the charge nurse's own voice that two identifiers must be verified before proceeding.",
  operationalEffect:
    "No option may treat a patient before verifying two identifiers; every path keeps the rule in force.",
  affectedDecisionStages: ["opening", "primary", "flat_tradeoff", "flat_action", "branch_tradeoff", "branch_action"],
  prohibitedAlternativeExcluded: "Treating a patient without verifying two identifiers is off the table.",
  remainingJudgmentDimensions: ["who verifies first", "how to sequence the queue", "when to escalate staffing"],
};

/**
 * The violating Render response, on the wire.
 *
 * `boundaryCompliance` is left at `["c1_verify"]` — exactly what the generator claimed live — and
 * `concreteAction` carries the measured violating action. The CLAIM is therefore present and
 * well-formed while the ACTION violates the rule it names. That combination is the point of STEP 5.
 */
function violatingProviderJson(): string {
  const dto = toProviderDto(VIOLATING_SCENARIO, undefined, [c18Grounding]);
  dto.primaryChoices[1].construction.concreteAction = VIOLATING_ACTION;
  return JSON.stringify(dto);
}

const compliantProviderJson = () => providerJson(C18_SCENARIO, undefined, [c18Grounding]);

const envelope = (content: string) => ({ choices: [{ message: { content } }, ].map((c) => ({ ...c, finish_reason: "stop" })) });

type CreateParams = {
  response_format?: { type?: string; json_schema?: { name?: string; schema?: unknown } };
  messages?: Array<{ role?: string; content?: string }>;
};

/** A schema-valid plan, so the plan_render_v1 orchestrator advances into Render. */
const validPlan = {
  primary: {
    dimensionId: "how_to_sequence_the_verification",
    dimension: "how to sequence the verification across both waiting patients",
    tension: "the ward is backed up while every treatment still waits on two identifiers",
    choices: [
      { id: "p1", stance: "verify the sicker patient first", acceptedCost: "the second patient waits longer" },
      { id: "p2", stance: "verify in arrival order", acceptedCost: "acuity is not what sets the order" },
    ],
  },
  branches: [
    {
      primaryChoiceId: "p1",
      resultingWorldState: "the sicker patient is verified and treated while the second still waits",
      tradeoff: {
        dimensionId: "how_to_staff_the_remaining_queue",
        dimension: "how to staff the remaining queue while one clinician is occupied",
        tension: "coverage now versus fatigue later",
      },
      action: {
        dimensionId: "when_to_escalate_for_support",
        dimension: "when to escalate for additional support outside the ward",
      },
    },
    {
      primaryChoiceId: "p2",
      resultingWorldState: "patients are verified in arrival order and the queue moves at a steady rate",
      tradeoff: {
        dimensionId: "how_to_explain_the_order",
        dimension: "how to explain the chosen order to a waiting family",
        tension: "candour versus reassurance while people are anxious",
      },
      action: {
        dimensionId: "how_to_record_the_decision",
        dimension: "how to record the ordering decision for the administrator",
      },
    },
  ],
};

/** Generation (Render) requests only — the Plan call uses a different schema name. */
const renderCalls = (): CreateParams[] =>
  mockCreate.mock.calls
    .map(([a]) => a as CreateParams)
    .filter((a) => a.response_format?.json_schema?.name === PROVIDER_SCHEMA_NAME);

const firstCallForSchema = (name: string): CreateParams | undefined =>
  mockCreate.mock.calls.map(([a]) => a as CreateParams).find((a) => a.response_format?.json_schema?.name === name);

/**
 * Drive the mocked provider. `renderBodies` is consumed in order by successive Render calls; the
 * last entry repeats if more Render calls arrive than bodies were supplied.
 */
function driveProvider(renderBodies: string[]): void {
  let renderIndex = 0;
  mockCreate.mockImplementation(async (params: CreateParams) => {
    const name = params.response_format?.json_schema?.name;
    if (name === PLAN_SCHEMA_NAME_LITERAL) return envelope(JSON.stringify(validPlan));
    if (isBoundaryReviewRequest(params)) return envelope(compliantBoundaryReview(params));
    if (isReviewRequest(params)) return envelope(JSON.stringify(acceptReview(C18_SCENARIO, {}, CONFIRMED_IDS)));
    const body = renderBodies[Math.min(renderIndex, renderBodies.length - 1)];
    renderIndex += 1;
    return envelope(body);
  });
}

beforeEach(() => {
  mockCreate.mockReset();
});

afterEach(() => {
  __setGenObserver(null);
});

describe("c18 constraint-compliant generation", () => {
  it("A. the deterministic safety gate catches the measured violating choice", () => {
    const violating = validateConstraintCompliance(VIOLATING_SCENARIO);
    expect(violating.ok).toBe(false);
    expect(violating.errors).toContain("constraint_violation");

    // NEGATIVE CONTROL — the unmodified c18 fixture must NOT trip the gate, so Test A is
    // measuring the substituted stance and not the scenario it was substituted into.
    const baseline = validateConstraintCompliance(C18_SCENARIO);
    expect(baseline.ok).toBe(true);
    expect(baseline.errors).toEqual([]);
  });

  it("A2. boundaryCompliance is a CLAIM and never overrides deterministic violation detection", () => {
    const dto = JSON.parse(violatingProviderJson()) as {
      primaryChoices: Array<{ construction: { boundaryCompliance: string[]; concreteAction: string } }>;
    };
    const claimed = dto.primaryChoices[1].construction;

    // The choice claims the confirmed id and describes the action that breaks it.
    expect(claimed.boundaryCompliance).toEqual(CONFIRMED_IDS);
    expect(claimed.concreteAction).toBe(VIOLATING_ACTION);

    // The construction validator ACCEPTS the claim — coverage is exactly what it checks.
    const constructions = Object.fromEntries(
      [
        ...VIOLATING_SCENARIO.primary.choices,
        ...VIOLATING_SCENARIO.tradeoff.choices,
        ...VIOLATING_SCENARIO.actionDecision.choices,
      ].map((c) => [c.id, claimed]),
    );
    const construction = validateChoiceConstructions(VIOLATING_SCENARIO, constructions, {
      constraintIds: CONFIRMED_IDS,
      factsText: "",
    });
    expect(construction.errors).not.toContain("unsupported_boundary_compliance");

    // And the safety gate still rejects the draft. The claim is metadata, not evidence.
    expect(validateConstraintCompliance(VIOLATING_SCENARIO).errors).toContain("constraint_violation");
  });

  it("B. correction-enabled generation retries and recovers from constraint_violation", async () => {
    driveProvider([violatingProviderJson(), compliantProviderJson()]);

    const observed: GenObservation[] = [];
    __setGenObserver((o) => observed.push(o));

    const result = await generateArenaScenarioDraft(C18.input, null, {
      architecture: "legacy",
      correction: "enabled",
    });

    // Two Render attempts, not one.
    expect(renderCalls()).toHaveLength(2);

    // The FIRST attempt was rejected by the deterministic constraint gate.
    const rejected = observed.find((o) => o.outcome.startsWith("gate_level_"));
    expect(rejected?.code).toBe("constraint_violation");
    expect(rejected?.defectCodes).toContain("constraint_violation");

    // The correction packet was built and reached the SECOND request's user message.
    const packet = observed.find((o) => o.outcome === "correction_packet");
    expect(packet?.code).toBe("constraint_violation");
    const secondUser = renderCalls()[1]?.messages?.[1]?.content ?? "";
    expect(secondUser).toContain("constraint_violation");
    expect(secondUser).toContain(C18_BOUNDARY.statement);

    // The corrected draft succeeds and is free of the violation.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(validateConstraintCompliance(result.value.draft).errors).toEqual([]);

    // Every learner-facing label stays inside the confirmed rule.
    const labels = [
      ...result.value.draft.primary.choices,
      ...result.value.draft.tradeoff.choices,
      ...result.value.draft.actionDecision.choices,
      ...Object.values(result.value.draft.branches ?? {}).flatMap((b) => [
        ...b.tradeoffChoices,
        ...b.actionDecision.choices,
      ]),
    ].map((c) => c.label);
    expect(labels).not.toContain(VIOLATING_LABEL);
  });

  it("B2. plan_render_v1 cannot spend a correction: generation is capped at two calls", () => {
    // Plan and Render already occupy generation positions 1 and 2, so a correction would be a
    // THIRD generation call. The ceiling is why `plan_render_v1` pins `correction: "disabled"`
    // in its own option type; this pins the ceiling itself so the reason cannot drift.
    expect(MAX_CALLS_PER_KIND.generation).toBe(2);
  });

  it("C. correction-disabled generation stops at one attempt and reports the violation", async () => {
    driveProvider([violatingProviderJson()]);

    const observed: GenObservation[] = [];
    __setGenObserver((o) => observed.push(o));

    const result = await generateArenaScenarioDraft(C18.input, null, {
      architecture: "legacy",
      correction: "disabled",
    });

    expect(renderCalls()).toHaveLength(1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("generation_rejected");

    const rejected = observed.find((o) => o.outcome.startsWith("gate_level_"));
    expect(rejected?.outcome).toBe("gate_level_3");
    expect(rejected?.code).toBe("constraint_violation");
    expect(rejected?.defectCodes).toEqual(["constraint_violation"]);

    // No correction packet was built, so observer semantics are unchanged.
    expect(observed.find((o) => o.outcome === "correction_packet")).toBeUndefined();
  });

  it("D. the constrained PLAN request forbids inventing a violating alternative", async () => {
    driveProvider([compliantProviderJson()]);

    await generateArenaScenarioDraft(C18.input, null, {
      architecture: "plan_render_v1",
      correction: "disabled",
    });

    const planCall = firstCallForSchema(PLAN_SCHEMA_NAME_LITERAL);
    expect(planCall).toBeDefined();
    const system = planCall?.messages?.[0]?.content ?? "";

    // The confirmed rule reaches the Plan at all (pre-existing contract).
    expect(system).toContain("CONFIRMED NON-NEGOTIABLE CONSTRAINTS");
    expect(system).toContain(C18_BOUNDARY.statement);

    /*
      The repair, asserted semantically. Each claim is a CONJUNCTION of concept regexes that must
      co-occur in ONE instruction line, so the sentence may be rewritten without breaking the test
      as long as it still says these things. No prompt ordering is pinned.
    */
    const segments = system
      .split(/\n+/)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    // CLAIM 1 — the prohibition names a violating alternative and forbids introducing it.
    const FORBIDS = /\b(do not|never|must not|may not)\b/i;
    // Morphology-agnostic: the prohibition may name the option before or after the violation verb.
    const VIOLATING_ALTERNATIVE =
      /\bviolat\w*\b[^.]{0,60}\b(alternative|option|choice|stance)\b|\b(alternative|option|choice|stance)\b[^.]{0,40}\bviolat\w*/i;
    expect(segments.some((s) => FORBIDS.test(s) && VIOLATING_ALTERNATIVE.test(s))).toBe(true);

    // CLAIM 2 — difficulty is relocated to competing COMPLIANT options.
    const DIFFICULTY = /\b(difficult|difficulty|hard|tension)\b/i;
    // "competing", "differences among", "between" — the concept is contrast among compliant options.
    const COMPLIANT_COMPETITION = /\b(compet\w*|differen\w*|among|between)\b[^.]{0,60}\bcompliant\b/i;
    expect(segments.some((s) => DIFFICULTY.test(s) && COMPLIANT_COMPETITION.test(s))).toBe(true);

    // CLAIM 3 — the rule binds the plan's OPTIONS, not only its dimension phrasing.
    const OPTION_FIELDS = /\bstance\b/i;
    const STAY_INSIDE = /\b(inside|within|comply|compliant)\b/i;
    expect(segments.some((s) => OPTION_FIELDS.test(s) && STAY_INSIDE.test(s))).toBe(true);
  });
});
