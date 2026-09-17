/**
 * c18 CONSTRUCTION BOUNDARY-COMPLIANCE COVERAGE — TEST-ONLY RED / CHARACTERIZATION.
 *
 * Authorized by `[GOV-ARENA-C18-CONSTRUCTION-COVERAGE-1]`.
 *
 * THIS FILE MAKES NO PROVIDER CALL. Every `chat.completions.create` is intercepted by
 * `mockCreate`, using the same seam the c18 plan-then-render regression already relies on
 * (`c18PtrBoundaryRegression.test.ts:44-50`). No `.eval-artifacts` file is read at runtime.
 *
 * THE MEASURED GAP
 *
 * `validateChoiceConstructions` rejects an EMPTY `boundaryCompliance` the moment any confirmed
 * constraint applies (`choiceConstruction.ts` rule 5). Nothing upstream of that rejection tells
 * the provider so: the Render instruction says only "the confirmed boundary ids it obeys (empty
 * when there are none)", and the Render JSON schema bounds the array from ABOVE
 * (`maxItems`) while permitting zero items and any string. The coverage floor the validator
 * enforces is therefore never stated in the request that must satisfy it.
 *
 * TEST A (CHARACTERIZATION — PASS)
 *   Pins the validator's CURRENT contract. Not an assertion that the validator is wrong.
 *
 * TEST B (RED — assertion only)
 *   The Render construction instruction must state the coverage floor and the single condition
 *   under which an empty array is allowed. Asserted semantically over the instruction segments
 *   that name `boundaryCompliance`; no prompt ordering and no future sentence is pinned.
 *
 * TEST C (RED — assertion only)
 *   The Render request's OWN json_schema must carry the floor for a constrained request:
 *   `minItems >= 1` and an `items.enum` of the current confirmed ids.
 *
 * TEST D (NEGATIVE CONTROL — PASS)
 *   An UNCONSTRAINED request must keep the permissive shape, and the validator must keep
 *   accepting an empty array when nothing is confirmed. Guards the B/C repair against
 *   over-reach onto scenarios that have no boundary at all.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import type { DecisionPlan } from "@/domain/foundry/arena-draft/decisionPlan";
import type { ProviderBoundaryGrounding } from "@/domain/foundry/arena-draft/boundaryGrounding";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";
import {
  enumerateChoices,
  validateChoiceConstructions,
  type ProviderChoiceConstruction,
} from "@/domain/foundry/arena-draft/choiceConstruction";
import { C18_BOUNDARY, C18_SCENARIO } from "@/domain/foundry/arena-draft/c18BoundaryFixture";
import {
  providerJson,
  acceptReview,
  compliantBoundaryReview,
  constructionFor,
  isReviewRequest,
  isBoundaryReviewRequest,
} from "@/domain/foundry/arena-draft/providerDto.fixture";
import { PROVIDER_SCHEMA_NAME } from "@/domain/foundry/arena-draft/providerDto";

// --- mock the shared LLM seam so no live provider is ever contacted ---------
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

/** The literal Plan schema name; `PLAN_SCHEMA_NAME` is not exported from the service. */
const PLAN_SCHEMA_NAME_LITERAL = "arena_decision_plan_v1";

const C18 = EVAL_CORPUS.find((c) => c.id === "c18-constrained-clinical")!;

/** The confirmed id the c18 fixture carries. Test C's enum expectation is exactly this set. */
const CONFIRMED_IDS = [C18_BOUNDARY.id];

/**
 * The same corpus input with its boundary replaced by a confirmed-but-EMPTY constraint set —
 * the c17 shape. Built locally so Test D never depends on another corpus row staying unconstrained.
 */
const UNCONSTRAINED_INPUT = {
  ...C18.input,
  boundary: { mode: "judgment" as const, confirmed: true, constraints: [] },
};

// A schema-compliant plan so the orchestrator advances past Plan into Render.
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
  response_format?: { type?: string; json_schema?: { name?: string; schema?: unknown } };
  messages?: Array<{ role?: string; content?: string }>;
};

/** Grounding + accepted boundary ids the mocked responses carry; set per test. */
let respondWithIds: string[] = CONFIRMED_IDS;

beforeEach(() => {
  respondWithIds = CONFIRMED_IDS;
  mockCreate.mockReset();
  mockCreate.mockImplementation(async (params: CreateParams) => {
    const name = params.response_format?.json_schema?.name;
    if (name === PLAN_SCHEMA_NAME_LITERAL) return envelope(JSON.stringify(validPlan));
    if (isBoundaryReviewRequest(params)) return envelope(compliantBoundaryReview(params));
    if (isReviewRequest(params)) {
      return envelope(JSON.stringify(acceptReview(C18_SCENARIO, {}, respondWithIds)));
    }
    const grounding = respondWithIds.length ? [c18Grounding] : [];
    return envelope(providerJson(C18_SCENARIO, undefined, grounding));
  });
});

/** The first captured `create` whose json_schema name matches. */
function firstCallForSchema(schemaName: string): CreateParams | undefined {
  return mockCreate.mock.calls
    .map(([arg]) => arg as CreateParams)
    .find((arg) => arg.response_format?.json_schema?.name === schemaName);
}

type SchemaNode = { [k: string]: unknown };
const node = (v: unknown): SchemaNode => (v ?? {}) as SchemaNode;

/**
 * Walk the OUTBOUND Render request down to the construction schema's `boundaryCompliance`.
 * Deliberately reads the captured request, never a private builder helper.
 */
function capturedBoundaryComplianceSchema(call: CreateParams | undefined): SchemaNode {
  const schema = node(call?.response_format?.json_schema?.schema);
  const primaryChoices = node(node(schema.properties).primaryChoices);
  const choiceItem = node(primaryChoices.items);
  const construction = node(node(choiceItem.properties).construction);
  return node(node(construction.properties).boundaryCompliance);
}

/** Render the captured Render request's system prompt as whitespace-normalized segments. */
function systemSegments(call: CreateParams | undefined): string[] {
  const system = call?.messages?.[0]?.content ?? "";
  // The generation system prompt is a list of instructions joined with "\n"
  // (`buildGenerationSystemPrompt`), so ONE line is ONE instruction. Splitting no finer keeps a
  // future repair sentence intact even if it happens to contain a semicolon or a colon.
  return system
    .split(/\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// TEST B's semantic helper. Each claim is a CONJUNCTION of concept regexes that must co-occur
// in ONE segment naming `boundaryCompliance`. Ordering inside the segment is not pinned, and no
// candidate repair sentence is quoted.
// ---------------------------------------------------------------------------

const NAMES_FIELD = /boundaryCompliance/;

/** CLAIM 1 — a coverage FLOOR, tied to the confirmed set being non-empty. */
const COVERAGE_FLOOR_QUANTIFIER = /\b(at least one|one or more|minimum of one|non-?empty)\b/i;
const BOUNDARY_ID_REFERENCE = /\bboundary id/i;
const CONFIRMED_SET_PRESENT = /\b(when|whenever|if|where|while)\b[^.]{0,120}\b(confirmed|constraint)/i;

/** CLAIM 2 — empty is permitted EXCLUSIVELY when the applicable confirmed set is empty. */
const EMPTY_ARRAY_REFERENCE = /\bempty\b/i;
const EXCLUSIVITY = /\b(only|solely|exclusively)\b/i;
const EMPTY_CONFIRMED_SET = /\b(no confirmed|none (?:are|is) confirmed|no (?:applicable )?constraints?|empty (?:confirmed )?(?:constraint|boundary) set|unconstrained|zero confirmed)\b/i;

const statesCoverageFloor = (segs: string[]): boolean =>
  segs.some(
    (s) =>
      NAMES_FIELD.test(s) &&
      COVERAGE_FLOOR_QUANTIFIER.test(s) &&
      BOUNDARY_ID_REFERENCE.test(s) &&
      CONFIRMED_SET_PRESENT.test(s),
  );

const statesEmptyOnlyWhenUnconstrained = (segs: string[]): boolean =>
  segs.some(
    (s) =>
      NAMES_FIELD.test(s) &&
      EMPTY_ARRAY_REFERENCE.test(s) &&
      EXCLUSIVITY.test(s) &&
      EMPTY_CONFIRMED_SET.test(s),
  );

// ---------------------------------------------------------------------------

/** Valid constructions for every choice in a draft, with the given claimed boundary ids. */
function constructionsFor(draft: ArenaScenarioDraft, boundaryIds: string[]): Record<string, ProviderChoiceConstruction> {
  const out: Record<string, ProviderChoiceConstruction> = {};
  for (const c of enumerateChoices(draft)) out[c.id] = constructionFor(c.label, c.index, boundaryIds);
  return out;
}

const C18_FACTS = "The ward is backed up and two patients are waiting for treatment.";

describe("[GOV-ARENA-C18-CONSTRUCTION-COVERAGE-1] c18 construction boundary-compliance coverage", () => {
  it("pins current validator rejection for empty boundaryCompliance under confirmed constraints", () => {
    // Every construction claims NO boundary while `c1_verify` is confirmed.
    const constructions = constructionsFor(C18_SCENARIO, []);
    for (const k of Object.values(constructions)) expect(k.boundaryCompliance).toEqual([]);

    const result = validateChoiceConstructions(C18_SCENARIO, constructions, {
      constraintIds: CONFIRMED_IDS,
      factsText: C18_FACTS,
    });

    // CHARACTERIZATION of the CURRENT contract — not a claim that this rule is defective.
    expect(result.errors).toContain("unsupported_boundary_compliance");
  });

  it("requires render instructions to state constrained boundaryCompliance coverage", async () => {
    await generateArenaScenarioDraft(C18.input, null, {
      architecture: "plan_render_v1",
      correction: "disabled",
    });

    const renderCall = firstCallForSchema(PROVIDER_SCHEMA_NAME);
    expect(renderCall).toBeDefined();

    const segs = systemSegments(renderCall);
    const scoped = segs.filter((s) => NAMES_FIELD.test(s));
    expect(scoped.length).toBeGreaterThan(0);

    // CLAIM 1 — with confirmed constraints present, every construction must list at least one
    // CURRENT confirmed boundary id. RED at this authority.
    expect(
      statesCoverageFloor(segs),
      `no boundaryCompliance instruction states a coverage floor. scoped segments = ${JSON.stringify(scoped)}`,
    ).toBe(true);

    // CLAIM 2 — an empty array is permitted ONLY when the applicable confirmed set is empty.
    expect(
      statesEmptyOnlyWhenUnconstrained(segs),
      `no boundaryCompliance instruction limits the empty array to an empty confirmed set. scoped segments = ${JSON.stringify(scoped)}`,
    ).toBe(true);
  });

  it("requires constrained render schema to enforce confirmed-id boundaryCompliance coverage", async () => {
    await generateArenaScenarioDraft(C18.input, null, {
      architecture: "plan_render_v1",
      correction: "disabled",
    });

    const renderCall = firstCallForSchema(PROVIDER_SCHEMA_NAME);
    expect(renderCall).toBeDefined();

    const fragment = capturedBoundaryComplianceSchema(renderCall);
    expect(fragment.type).toBe("array");

    const captured = JSON.stringify(fragment);

    // An ABSENT `minItems` IS a floor of zero — read it as the number the schema actually
    // imposes, so the gap is reported as a failed assertion rather than a type error.
    const minItems = typeof fragment.minItems === "number" ? fragment.minItems : 0;

    // RED — the OUTBOUND schema currently bounds the array from above only.
    expect(
      minItems,
      `captured constrained boundaryCompliance schema = ${captured}`,
    ).toBeGreaterThanOrEqual(1);

    expect(
      node(fragment.items).enum,
      `captured constrained boundaryCompliance schema = ${captured}`,
    ).toEqual(CONFIRMED_IDS);
  });

  it("preserves empty boundaryCompliance for unconstrained requests", async () => {
    respondWithIds = [];
    await generateArenaScenarioDraft(UNCONSTRAINED_INPUT, null, {
      architecture: "plan_render_v1",
      correction: "disabled",
    });

    const renderCall = firstCallForSchema(PROVIDER_SCHEMA_NAME);
    expect(renderCall).toBeDefined();

    const fragment = capturedBoundaryComplianceSchema(renderCall);
    expect(fragment.type).toBe("array");

    // An unconstrained request must NOT inherit the constrained-only floor.
    const minItems = fragment.minItems;
    expect(minItems === undefined || minItems === 0, `unconstrained minItems = ${String(minItems)}`).toBe(true);
    expect(node(fragment.items).enum).toBeUndefined();

    // And the validator must keep accepting an empty claim when nothing is confirmed.
    const result = validateChoiceConstructions(C18_SCENARIO, constructionsFor(C18_SCENARIO, []), {
      constraintIds: [],
      factsText: C18_FACTS,
    });
    expect(result.errors).not.toContain("unsupported_boundary_compliance");
  });
});
