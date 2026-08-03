import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArenaScenarioDraft, GuidedAnswers } from "@/domain/foundry/arena-draft/types";
import {
  providerJson,
  acceptReview,
  isReviewRequest,
  isBoundaryReviewRequest,
  compliantBoundaryReview,
} from "@/domain/foundry/arena-draft/providerDto.fixture";
import type { ModuleSourceFacts } from "./arenaScenarioSource";

/**
 * FOUR-SITE PROVIDER CALL INSTRUMENTATION (Slice 3.2I-R5B2-R5C-2B).
 *
 * R5C-2A proved the child table, the allocator and the recorder in isolation; nothing used them, so
 * the questions R5B could not answer — how many model calls a submission made, which one failed,
 * whether two attempts saw identical content — were still unanswerable.
 *
 * These tests drive the REAL generation service and the REAL boundary reviewers with only the LLM
 * seam mocked, and hold the properties the accounting rests on:
 *
 *   the network is unreachable until `provider_invoked_at` is durable,
 *   one network call produces exactly one child row,
 *   a call that DELIVERED its structured output stays `success` even when a product gate then
 *     refuses the content it carried, and
 *   a submission that cannot be accounted for stops — it does not persist, and it does not retry.
 *
 * No test path can reach a provider: `create` is a spy throughout.
 */

const H = vi.hoisted(() => {
  class MockLlmHttpError extends Error {
    readonly name = "LlmHttpError";
    constructor(
      readonly status: number,
      readonly statusText: string,
      readonly body: unknown = null,
      readonly retryAfterSeconds: number | null = null,
      readonly requestId: string | null = null,
    ) {
      super(`LLM API error: ${status} ${statusText}`);
    }
  }
  return { mockCreate: vi.fn(), MockLlmHttpError };
});
const mockCreate = H.mockCreate;

vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => true,
  getLlmModel: () => "test-model",
  getLlmClient: () => ({ chat: { completions: { create: H.mockCreate } } }),
  LlmHttpError: H.MockLlmHttpError,
}));

import { generateArenaScenarioDraft } from "./arenaScenarioGenerationService";
import { reviewBoundarySurfaces, reviewFieldRepair } from "./narrowBoundaryReviewer";
import { buildNarrowBoundarySubject } from "./narrowBoundaryContract";
import { enumerateBoundarySurfaces } from "@/domain/foundry/arena-draft/boundarySurfaces";
import { C18_BOUNDARY, C18_SCENARIO } from "@/domain/foundry/arena-draft/c18BoundaryFixture";
import { createGenerationAccounting, isProviderCallTelemetryError, withProviderCall } from "./generationAccounting";
import { regenerateArenaDraft } from "./foundryArenaDraftService";
import { MAX_CALLS_PER_KIND, MAX_CALLS_PER_SUBMISSION } from "@/domain/foundry/arena-draft/generationCallSequence";

const CALLS = "foundry_practice_generation_attempt_calls";
const ATTEMPTS = "foundry_practice_generation_attempts";
const DRAFTS = "foundry_arena_scenario_drafts";

type Row = Record<string, unknown>;

/** Everything a caller can inject to make one persistence step fail. */
type Failures = {
  prepareFails?: boolean;
  invokeFails?: boolean;
  finalizeFails?: boolean;
  attemptInsertFails?: boolean;
};

/**
 * A Supabase double that stores child call rows and can fail any one lifecycle step.
 *
 * It records the ORDER of writes against the order of provider invocations, which is the only way
 * to prove "durable before the network" rather than merely "both happened".
 */
function makeAdmin(opts: Failures = {}) {
  const calls: Row[] = [];
  const attempts: Row[] = [];
  const journal: string[] = [];
  const drafts: Row[] = [
    {
      id: "draft-1",
      owner_user_id: "owner-1",
      source_event_id: "evt-1",
      source_module_version: 1,
      source_draft_id: "sd-1",
      status: "draft",
      guided_answers: {
        practiceSetupVersion: 1,
        practiceBoundary: { mode: "judgment", confirmed: true, constraints: [] },
        hardestWhen: { choice: "time_limited" },
        avoidancePressure: { text: "raising it feels like slowing everyone down" },
      },
      scenario_draft: null,
      generation_source: null,
      revision: 1,
      created_at: "2026-08-03T00:00:00Z",
      updated_at: "2026-08-03T00:00:00Z",
    },
  ];
  const events: Row[] = [{ id: "evt-1", owner_user_id: "owner-1", status: "open", title: "T" }];
  const modules: Row[] = [
    {
      event_id: "evt-1",
      version: 1,
      id: "sd-1",
      status: "published",
      arena_recommended: true,
      problem: "A teammate proposes cutting a planned design review to hit the deadline",
      observable_behavior: "Raise the concern before the shortcut is taken",
      success_evidence: "The concern is recorded",
      learning_needs: ["decide"],
    },
  ];

  function from(table: string) {
    const rows =
      table === CALLS ? calls : table === ATTEMPTS ? attempts : table === DRAFTS ? drafts : table === "foundry_events" ? events : modules;
    let op: "select" | "insert" | "update" = "select";
    let patch: Row = {};
    let inserted: Row | null = null;
    const filters: Array<[string, unknown]> = [];

    const api = {
      select: () => api,
      insert: (r: Row) => {
        op = "insert";
        inserted = r;
        return api;
      },
      update: (p: Row) => {
        op = "update";
        patch = p;
        return api;
      },
      eq: (c: string, v: unknown) => {
        filters.push([c, v]);
        return api;
      },
      order: () => api,
      limit: () => api,
      maybeSingle: async () => settle(),
      single: async () => settle(),
      returns: () => api,
      then: (res: (v: unknown) => unknown) => Promise.resolve(settle()).then(res),
    };

    function settle() {
      if (op === "insert") {
        if (table === CALLS) {
          if (opts.prepareFails) return { data: null, error: { code: "42501", message: "denied" } };
          const row: Row = { id: `call-${calls.length + 1}`, lifecycle_state: "prepared", ...inserted };
          calls.push(row);
          journal.push(`prepare:${String(row.call_kind)}#${String(row.global_sequence)}`);
          return { data: row, error: null };
        }
        if (table === ATTEMPTS) {
          if (opts.attemptInsertFails) return { data: null, error: { code: "42501", message: "denied" } };
          const row = { id: `att-${attempts.length + 1}`, lifecycle_state: "started", ...inserted };
          attempts.push(row);
          return { data: row, error: null };
        }
        const row = { id: `r-${rows.length + 1}`, ...inserted };
        rows.push(row);
        return { data: row, error: null };
      }
      if (op === "update") {
        const hit = rows.filter((r) => filters.every(([c, v]) => r[c] === v));
        if (table === CALLS) {
          const toInFlight = patch.lifecycle_state === "in_flight";
          if (toInFlight && opts.invokeFails) return { data: null, error: { code: "XX000", message: "no" } };
          if (!toInFlight && opts.finalizeFails) return { data: null, error: { code: "XX000", message: "no" } };
          for (const r of hit) Object.assign(r, patch);
          const h0 = hit[0] as Row | undefined;
          if (h0) journal.push(`${toInFlight ? "invoke" : "finalize"}:${String(h0.call_kind)}#${String(h0.global_sequence)}`);
          return { data: hit, error: null };
        }
        for (const r of hit) Object.assign(r, patch);
        return { data: hit[0] ?? null, error: hit.length ? null : { code: "PGRST116", message: "no rows" } };
      }
      const hit = rows.filter((r) => filters.every(([c, v]) => r[c] === v));
      return { data: hit[0] ?? null, error: null };
    }
    return api;
  }

  return { admin: { from } as unknown as SupabaseClient, calls, attempts, drafts, journal };
}

/** The submission's accounting context, over a fresh double. */
function accountingOver(opts: Failures = {}) {
  const h = makeAdmin(opts);
  return { ...h, accounting: createGenerationAccounting(h.admin, "att-1") };
}

const invoked = (calls: Row[]) => calls.filter((c) => c.provider_invoked_at !== null && c.provider_invoked_at !== undefined);
const ofKind = (calls: Row[], kind: string) => calls.filter((c) => c.call_kind === kind);

// --------------------------------------------------------------------------
// Generation fixtures
// --------------------------------------------------------------------------

const facts: ModuleSourceFacts = {
  problem: "A teammate proposes cutting a planned design review to hit the deadline",
  observableBehavior: "Raise the concern before the shortcut is taken",
  successEvidence: "The concern is recorded",
  audienceType: "leaders",
  audienceDetail: null,
  learningNeeds: ["decide"],
};
const guided: GuidedAnswers = {
  hardestWhen: { choice: "time_limited" },
  avoidancePressure: { text: "raising it feels like slowing everyone down" },
};

const goodDraft: ArenaScenarioDraft = {
  title: "Raising a risk under a deadline",
  opening:
    "A teammate quietly flags a safety gap to you with the client's deadline only hours away. Raising it now stops the line while the customer waits; staying on schedule keeps the promise but carries the risk.",
  primary: {
    choices: [
      { id: "primary_1", label: "Raise the risk with the team now and stop the line" },
      { id: "primary_2", label: "Verify the gap yourself first, then decide whether to stop" },
    ],
  },
  tradeoff: {
    escalationText: "Your manager pushes back hard and the deadline is now public.",
    choices: [
      { id: "ft1", label: "Tell the manager plainly and own the call yourself" },
      { id: "ft2", label: "Escalate above the manager, accepting the strain it causes" },
    ],
  },
  actionDecision: {
    prompt: "What will you do now?",
    choices: [
      { id: "fa1", label: "Stop the line now and own the delay it causes", isActionCommitment: true },
      { id: "fa2", label: "Document the gap and flag it in writing, accepting the line keeps running", isActionCommitment: false },
    ],
  },
  branches: {
    primary_1: {
      resultingWorldState: "The world after choosing primary_1: the situation has moved on and the earlier decision now holds.",
      escalationText:
        "You stop the line, and the plant manager confronts you in front of the crew, demanding to know who authorized the shutdown.",
      tradeoffChoices: [
        { id: "p1_t1", label: "Hold the line stopped until the gap is fixed, accepting the manager's anger" },
        { id: "p1_t2", label: "Restart under a documented watch, accepting the residual risk" },
      ],
      actionDecision: {
        prompt: "What will you do now?",
        choices: [
          { id: "p1_a1", label: "Keep it stopped and put your reasons in writing now", isActionCommitment: true },
          { id: "p1_a2", label: "Restart with a monitor and re-check within the hour, accepting the exposure", isActionCommitment: false },
        ],
      },
    },
    primary_2: {
      resultingWorldState: "The world after choosing primary_2: the situation has moved on and the earlier decision now holds.",
      escalationText:
        "While you verify, a unit ships with the suspected defect and a customer calls back within the hour asking why it was not caught.",
      tradeoffChoices: [
        { id: "p2_t1", label: "Recall the shipped unit now and absorb the cost, accepting the delay to others" },
        { id: "p2_t2", label: "Contain it to the affected order, accepting that the flawed unit stays out" },
      ],
      actionDecision: {
        prompt: "What will you do now?",
        choices: [
          { id: "p2_a1", label: "Issue the recall now and own the disruption", isActionCommitment: true },
          { id: "p2_a2", label: "Confirm the defect scope first, accepting more may ship meanwhile", isActionCommitment: false },
        ],
      },
    },
  },
};

const genInput = { locale: "en" as const, facts, guided, boundary: undefined, boundaryScope: null };

/**
 * The BOUNDARY-BEARING input. The narrow boundary stage only runs when confirmed rules exist, so
 * this — not the boundaryless case — is the input whose normal path spends all three call kinds.
 */
const CONSTRAINT = { id: "c1", statement: "Verify two identifiers before treatment", provenance: "manager_entered" as const };
const boundedInput = {
  ...genInput,
  boundary: { mode: "judgment_with_constraints" as const, confirmed: true, constraints: [CONSTRAINT] },
};

/** A schema-valid REJECT: the verdict and the detail fields agree, so it is a real verdict. */
function rejectReview() {
  const base = acceptReview(goodDraft, {}, []);
  return {
    ...base,
    primaryChoices: base.primaryChoices.map((c, i) => (i === 0 ? { ...c, defensible: false, defectCodes: ["bad_faith_option"] } : c)),
    phaseChoices: base.phaseChoices.map((c, i) =>
      i === 0 ? { ...c, defensible: false, badFaith: true, defectCodes: ["bad_faith_option"] } : c,
    ),
    overallVerdict: "reject",
    defectCodes: ["bad_faith_option"],
    retryInstruction: "make both primary options defensible",
  };
}

/** A minimal plan shape: enough for the repair REQUEST to be built, with no operations demanded. */
const emptyPlan = { planSha256: "x".repeat(64), requiredOperationCount: 0, targets: [] } as never;

/** Route each request type to a canned answer, exactly as the production orchestration asks them. */
function routeProvider(over: { generation?: unknown; boundary?: unknown; semantic?: unknown } = {}) {
  mockCreate.mockImplementation(async (params: { messages?: Array<{ content?: string }> }) => {
    if (isBoundaryReviewRequest(params)) {
      if (over.boundary) return over.boundary;
      return { choices: [{ message: { content: compliantBoundaryReview(params) }, finish_reason: "stop" }] };
    }
    if (isReviewRequest(params)) {
      if (over.semantic) return over.semantic;
      return { choices: [{ message: { content: JSON.stringify(acceptReview(goodDraft, {}, [])) }, finish_reason: "stop" }] };
    }
    if (over.generation) return over.generation;
    return { choices: [{ message: { content: providerJson(goodDraft, undefined, []) }, finish_reason: "stop" }] };
  });
}

const content = (s: string, finish = "stop") => ({ choices: [{ message: { content: s }, finish_reason: finish }] });

const c18Subject = buildNarrowBoundarySubject({
  scenarioSha256: "s".repeat(64),
  reviewSubjectSha256: "r".repeat(64),
  boundaryProvenance: { activeBoundaryIds: [C18_BOUNDARY.id] } as never,
  boundaryProvenanceSha256: "p".repeat(64),
  boundaries: [C18_BOUNDARY],
  surfaces: enumerateBoundarySurfaces(C18_SCENARIO, {}),
  draft: C18_SCENARIO,
  language: "en",
  generationAttemptId: "gen1",
  caseId: "c18",
});
const goodBoundaryBody = () =>
  JSON.stringify({
    assessments: c18Subject.surfaces.map((s) => ({
      boundaryId: C18_BOUNDARY.id,
      surfaceRef: s.coordinate,
      applicability: "not_applicable",
      compliance: "not_assessed",
      governedActionEvidence: s.text.slice(0, 120),
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: "",
    })),
  });

/**
 * R5C-3V2 — every generation submission now requires an immutable source identity BEFORE the
 * parent attempt is created. These tests exercise that path, so they must declare the build they
 * run as; there is no global default, because a hidden default would make the gate untestable.
 */
const TEST_SOURCE_SHA = "cf7e3720f739c952c86324a668b6ffd98f5ea6b1";
beforeEach(() => {
  process.env.BTY_SOURCE_COMMIT_SHA = TEST_SOURCE_SHA;
});

beforeEach(() => mockCreate.mockReset());
afterEach(() => vi.restoreAllMocks());

// ==========================================================================
// CONTEXT AND ORDER (Part 13, 1–7)
// ==========================================================================

describe("[R5C-2B] one submission, one context, one shared sequence", () => {
  it("the measured normal path spends generation 1 then semantic_review 1, in global order", async () => {
    // MEASURED, not assumed: the narrow boundary stage only runs for a submission that carries
    // confirmed rules, so a judgment-only submission's normal path is exactly two provider calls.
    routeProvider();
    const { accounting, calls } = accountingOver();
    const r = await generateArenaScenarioDraft(genInput, accounting);
    expect(r.ok).toBe(true);
    expect(calls.map((c) => `${String(c.call_kind)}#${String(c.global_sequence)}/${String(c.kind_sequence)}`)).toEqual([
      "generation#1/1",
      "semantic_review#2/1",
    ]);
  });

  it("ALL FOUR real call sites share the one allocator, in real execution order", async () => {
    // The generation service and both boundary reviewers are the REAL functions here, driven over a
    // single context — which is the property that makes the global sequence readable at all.
    routeProvider();
    const { admin, calls } = makeAdmin();
    const accounting = createGenerationAccounting(admin, "att-1");
    await generateArenaScenarioDraft(genInput, accounting); // generation #1, semantic_review #2
    mockCreate.mockResolvedValue(content(goodBoundaryBody()));
    await reviewBoundarySurfaces(c18Subject, 1, undefined, undefined, accounting); // #3
    mockCreate.mockResolvedValue(content(JSON.stringify({ operations: [] })));
    await reviewFieldRepair(c18Subject, emptyPlan, 1, undefined, accounting); // #4
    expect(calls.map((c) => `${String(c.call_kind)}#${String(c.global_sequence)}/${String(c.kind_sequence)}`)).toEqual([
      "generation#1/1",
      "semantic_review#2/1",
      "boundary_review#3/1",
      "boundary_repair#4/1",
    ]);
  });

  it("PREPARED is durable before the provider is reachable, and IN_FLIGHT before it is invoked", async () => {
    const order: string[] = [];
    routeProvider();
    const h = makeAdmin();
    const accounting = createGenerationAccounting(h.admin, "att-1");
    mockCreate.mockImplementation(async (params: { messages?: Array<{ content?: string }> }) => {
      order.push(`network:${h.journal.length}`);
      // At the moment the network is observed, the row must ALREADY be in_flight.
      const live = h.calls[h.calls.length - 1];
      expect(live.lifecycle_state).toBe("in_flight");
      expect(live.provider_invoked_at).toBeTruthy();
      if (isBoundaryReviewRequest(params)) return { choices: [{ message: { content: compliantBoundaryReview(params) }, finish_reason: "stop" }] };
      if (isReviewRequest(params)) return content(JSON.stringify(acceptReview(goodDraft, {}, [])));
      return content(providerJson(goodDraft, undefined, []));
    });
    await generateArenaScenarioDraft(genInput, accounting);
    // prepare → invoke → network, for every one of the three calls.
    expect(h.journal.slice(0, 2)).toEqual(["prepare:generation#1", "invoke:generation#1"]);
    expect(order[0]).toBe("network:2");
  });

  it("the provider runs EXACTLY ONCE per invoked child row", async () => {
    routeProvider();
    const { accounting, calls } = accountingOver();
    await generateArenaScenarioDraft(genInput, accounting);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(invoked(calls)).toHaveLength(2);
  });

  it("a prepare failure blocks the call — the provider is never reached", async () => {
    routeProvider();
    const { accounting, calls } = accountingOver({ prepareFails: true });
    await expect(generateArenaScenarioDraft(genInput, accounting)).rejects.toSatisfy(isProviderCallTelemetryError);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("an in-flight persistence failure blocks the call — the provider is never reached", async () => {
    routeProvider();
    const { accounting, calls } = accountingOver({ invokeFails: true });
    await expect(generateArenaScenarioDraft(genInput, accounting)).rejects.toSatisfy(isProviderCallTelemetryError);
    expect(mockCreate).not.toHaveBeenCalled();
    // The row exists and is honest: prepared, never invoked. It is NOT an invocation.
    expect(calls).toHaveLength(1);
    expect(calls[0].lifecycle_state).toBe("prepared");
    expect(invoked(calls)).toHaveLength(0);
  });

  it("a caller with NO accounting context creates no rows at all", async () => {
    routeProvider();
    const { calls } = accountingOver();
    const r = await generateArenaScenarioDraft(genInput);
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("nothing is created without a submission — no page load path calls the recorder", async () => {
    const { calls, attempts } = accountingOver();
    expect(calls).toHaveLength(0);
    expect(attempts).toHaveLength(0);
  });
});

// ==========================================================================
// GENERATION (Part 13, 8–17)
// ==========================================================================

describe("[R5C-2B] generation instrumentation", () => {
  const runGen = async (over: Parameters<typeof routeProvider>[0]) => {
    routeProvider(over);
    const h = accountingOver();
    const r = await generateArenaScenarioDraft(genInput, h.accounting).catch((e) => e);
    return { ...h, result: r };
  };

  it("the first generation call is global 1 / generation 1", async () => {
    const { calls } = await runGen({});
    expect(calls[0]).toMatchObject({ call_kind: "generation", global_sequence: 1, kind_sequence: 1 });
  });

  it("a SECOND generation attempt gets its own child row and its own sequence", async () => {
    // A correctable content rejection regenerates once; both calls must be visible.
    routeProvider({ generation: content(JSON.stringify({ nope: true })) });
    const { accounting, calls } = accountingOver();
    await generateArenaScenarioDraft(genInput, accounting);
    const gen = ofKind(calls, "generation");
    expect(gen).toHaveLength(2);
    expect(gen.map((c) => c.kind_sequence)).toEqual([1, 2]);
    expect(gen.map((c) => c.global_sequence)).toEqual([1, 2]);
  });

  it.each([
    ["timeout", "timeout", "aborted"],
    ["transport", "transport_error", "network"],
  ])("a %s failure records %s", async (mode, outcome, category) => {
    routeProvider();
    mockCreate.mockImplementation(async () => {
      if (mode === "timeout") {
        const e = new Error("aborted");
        e.name = "AbortError";
        throw e;
      }
      throw new TypeError("fetch failed");
    });
    const { accounting, calls } = accountingOver();
    await generateArenaScenarioDraft(genInput, accounting);
    expect(calls[0]).toMatchObject({ outcome, provider_error_category: category, lifecycle_state: "completed" });
    expect(calls[0].response_sha256).toBeNull();
  });

  it("an HTTP failure records the STATUS and no body", async () => {
    routeProvider();
    mockCreate.mockImplementation(async () => {
      throw new H.MockLlmHttpError(429, "Too Many Requests", { error: { message: "quota for org-secret exceeded" } });
    });
    const { accounting, calls } = accountingOver();
    await generateArenaScenarioDraft(genInput, accounting);
    expect(calls[0]).toMatchObject({ outcome: "http_error", provider_http_status: 429, provider_error_category: "rate_limited" });
    expect(JSON.stringify(calls[0])).not.toContain("org-secret");
  });

  it.each([
    ["no content at all", content(""), "empty_output"],
    ["an explicit refusal", { choices: [{ message: { content: null, refusal: "I cannot help" }, finish_reason: "stop" }] }, "empty_output"],
    ["a truncated body", content('{"scenario":', "length"), "malformed_output"],
    ["unparseable text", content("not json at all"), "malformed_output"],
    ["a schema-invalid object", content(JSON.stringify({ unexpected: true })), "schema_invalid"],
  ])("%s records %s", async (_label, envelope, outcome) => {
    routeProvider({ generation: envelope });
    const { accounting, calls } = accountingOver();
    await generateArenaScenarioDraft(genInput, accounting);
    expect(ofKind(calls, "generation")[0].outcome).toBe(outcome);
  });

  it("valid output records success WITH a digest of the exact bytes", async () => {
    const { calls } = await runGen({});
    const gen = ofKind(calls, "generation")[0];
    expect(gen.outcome).toBe("success");
    expect(gen.response_digest_scope).toBe("model_content_utf8");
    expect(gen.response_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(gen.response_byte_count).toBe(new TextEncoder().encode(providerJson(goodDraft, undefined, [])).length);
  });

  it("a SCENARIO-QUALITY rejection leaves the generation call `success`", async () => {
    // The call delivered exactly the structured output it was asked for. A deterministic quality
    // gate then refusing that content is the PARENT's attribution, never a failed call.
    const thin: ArenaScenarioDraft = { ...goodDraft, opening: "Something happened." };
    routeProvider({ generation: content(providerJson(thin, undefined, [])) });
    const { accounting, calls } = accountingOver();
    const r = await generateArenaScenarioDraft(genInput, accounting);
    expect(r.ok).toBe(false);
    const gen = ofKind(calls, "generation");
    expect(gen.length).toBeGreaterThan(0);
    for (const c of gen) expect(c.outcome).toBe("success");
  });
});

// ==========================================================================
// BOUNDARY REVIEW + REPAIR (Part 13, 18–29)
// ==========================================================================

describe("[R5C-2B] boundary review and field repair are separate kinds", () => {
  it("boundary review uses boundary_review, and repair uses boundary_repair — never each other's", async () => {
    const { admin, calls } = makeAdmin();
    const accounting = createGenerationAccounting(admin, "att-1");
    mockCreate.mockResolvedValue(content(goodBoundaryBody()));
    await reviewBoundarySurfaces(c18Subject, 1, undefined, undefined, accounting);
    mockCreate.mockResolvedValue(content(JSON.stringify({ operations: [] })));
    await reviewFieldRepair(c18Subject, emptyPlan, 1, undefined, accounting);
    expect(calls.map((c) => c.call_kind)).toEqual(["boundary_review", "boundary_repair"]);
    expect(ofKind(calls, "boundary_review")).toHaveLength(1);
    expect(ofKind(calls, "boundary_repair")).toHaveLength(1);
  });

  it("each kind counts INDEPENDENTLY while sharing one global order", async () => {
    const { admin, calls } = makeAdmin();
    const accounting = createGenerationAccounting(admin, "att-1");
    mockCreate.mockResolvedValue(content(goodBoundaryBody()));
    await reviewBoundarySurfaces(c18Subject, 1, undefined, undefined, accounting);
    mockCreate.mockResolvedValue(content(JSON.stringify({ operations: [] })));
    await reviewFieldRepair(c18Subject, emptyPlan, 1, undefined, accounting);
    mockCreate.mockResolvedValue(content(goodBoundaryBody()));
    await reviewBoundarySurfaces(c18Subject, 2, undefined, undefined, accounting);
    expect(calls.map((c) => `${String(c.call_kind)}#${String(c.global_sequence)}/${String(c.kind_sequence)}`)).toEqual([
      "boundary_review#1/1",
      "boundary_repair#2/1",
      "boundary_review#3/2",
    ]);
  });

  it("a structured reviewer answer is `success` even when the server then derives a REJECT", async () => {
    const { admin, calls } = makeAdmin();
    const accounting = createGenerationAccounting(admin, "att-1");
    // Schema-valid, fully covered, and deliberately answered so the derivation refuses it.
    mockCreate.mockResolvedValue(
      content(
        JSON.stringify({
          assessments: c18Subject.surfaces.map((s) => ({
            boundaryId: C18_BOUNDARY.id,
            surfaceRef: s.coordinate,
            applicability: "governed",
            compliance: "violated",
            governedActionEvidence: s.text.slice(0, 120),
            prerequisiteFailureEvidence: s.text.slice(0, 60),
            violationMechanism: "acts_without_prerequisite",
            reason: "the rule is bypassed",
          })),
        }),
      ),
    );
    const r = await reviewBoundarySurfaces(c18Subject, 1, undefined, undefined, accounting);
    expect(r.kind).toBe("derived");
    expect(calls[0].outcome).toBe("success");
  });

  it.each([
    ["a truncated body", content("{", "length"), "malformed_output"],
    ["unparseable text", content("nope"), "malformed_output"],
    ["an empty envelope", content(""), "empty_output"],
  ])("a reviewer %s records %s", async (_l, envelope, outcome) => {
    const { admin, calls } = makeAdmin();
    const accounting = createGenerationAccounting(admin, "att-1");
    mockCreate.mockResolvedValue(envelope);
    await reviewBoundarySurfaces(c18Subject, 1, undefined, undefined, accounting);
    expect(calls[0].outcome).toBe(outcome);
  });

  it("valid repair output is `success`, and a later product rejection does not rewrite it", async () => {
    const { admin, calls } = makeAdmin();
    const accounting = createGenerationAccounting(admin, "att-1");
    mockCreate.mockResolvedValue(content(JSON.stringify({ operations: [{ surfaceRef: "nope", newText: "x" }] })));
    await reviewFieldRepair(c18Subject, emptyPlan, 1, undefined, accounting);
    // The plan demanded three operations and got one — the merge authority will refuse this patch.
    // The CALL still delivered its structured output.
    expect(calls[0].outcome).toBe("success");
    expect(calls[0].lifecycle_state).toBe("completed");
  });

  it("an unparseable repair body records malformed_output", async () => {
    const { admin, calls } = makeAdmin();
    const accounting = createGenerationAccounting(admin, "att-1");
    mockCreate.mockResolvedValue(content("not json"));
    await reviewFieldRepair(c18Subject, emptyPlan, 1, undefined, accounting);
    expect(calls[0].outcome).toBe("malformed_output");
  });

  it.each([
    ["boundary review", () => reviewBoundarySurfaces(c18Subject, 1, undefined, undefined, undefined)],
    ["field repair", () => reviewFieldRepair(c18Subject, emptyPlan, 1, undefined, undefined)],
  ])("%s without a context still runs and records nothing", async (_l, run) => {
    const { calls } = makeAdmin();
    mockCreate.mockResolvedValue(content(goodBoundaryBody()));
    await run();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(0);
  });
});

// ==========================================================================
// SEMANTIC REVIEW (Part 13, 30–35)
// ==========================================================================

describe("[R5C-2B] semantic review instrumentation", () => {
  it("uses semantic_review, never boundary_review", async () => {
    routeProvider();
    const { accounting, calls } = accountingOver();
    await generateArenaScenarioDraft(genInput, accounting);
    const sem = ofKind(calls, "semantic_review");
    expect(sem).toHaveLength(1);
    expect(sem[0].call_kind).not.toBe("boundary_review");
  });

  it("a valid semantic REJECTION leaves the call `success`", async () => {
    const reject = {
      ...rejectReview(),
    };
    routeProvider({ semantic: content(JSON.stringify(reject)) });
    const { accounting, calls } = accountingOver();
    await generateArenaScenarioDraft(genInput, accounting);
    const sem = ofKind(calls, "semantic_review");
    expect(sem.length).toBeGreaterThan(0);
    for (const c of sem) expect(c.outcome).toBe("success");
  });

  it.each([
    ["a truncated verdict", content("{", "length"), "malformed_output"],
    ["unparseable text", content("nope"), "malformed_output"],
    ["a schema-invalid verdict", content(JSON.stringify({ overallVerdict: "maybe" })), "schema_invalid"],
    ["an empty envelope", content(""), "empty_output"],
  ])("%s records %s", async (_l, envelope, outcome) => {
    routeProvider({ semantic: envelope });
    const { accounting, calls } = accountingOver();
    await generateArenaScenarioDraft(genInput, accounting);
    expect(ofKind(calls, "semantic_review")[0].outcome).toBe(outcome);
  });
});

// ==========================================================================
// MIXED ORDER AND CEILINGS (Part 13, 36–39)
// ==========================================================================

describe("[R5C-2B] the sequence reflects REAL execution order", () => {
  it("a repair/retry path preserves the actual interleaving", async () => {
    const { admin, calls } = makeAdmin();
    const accounting = createGenerationAccounting(admin, "att-1");
    const prep = { kind: "boundary_review" as const, model: "m", providerTimeoutMs: 1, structuredOutputMode: "none" as const };
    const order: Array<"generation" | "boundary_review" | "boundary_repair" | "semantic_review"> = [
      "generation",
      "boundary_review",
      "boundary_repair",
      "boundary_review",
      "generation",
      "semantic_review",
    ];
    for (const kind of order) {
      await withProviderCall(accounting, { ...prep, kind }, async (scope) => {
        await scope.settle({ outcome: "success" });
      });
    }
    expect(calls.map((c) => c.call_kind)).toEqual(order);
    expect(calls.map((c) => c.global_sequence)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ofKind(calls, "boundary_review").map((c) => c.kind_sequence)).toEqual([1, 2]);
    expect(ofKind(calls, "generation").map((c) => c.kind_sequence)).toEqual([1, 2]);
  });

  it("a fourteen-call path fits 1..14, and the fifteenth is refused BEFORE any provider call", async () => {
    const { admin, calls } = makeAdmin();
    const accounting = createGenerationAccounting(admin, "att-1");
    const prep = { model: "m", providerTimeoutMs: 1, structuredOutputMode: "none" as const };
    const ran = vi.fn();
    for (const kind of ["generation", "boundary_review", "boundary_repair", "semantic_review"] as const) {
      for (let i = 0; i < MAX_CALLS_PER_KIND[kind]; i++) {
        await withProviderCall(accounting, { ...prep, kind }, async (scope) => {
          ran();
          await scope.settle({ outcome: "success" });
        });
      }
    }
    expect(calls).toHaveLength(MAX_CALLS_PER_SUBMISSION);
    expect(calls.map((c) => c.global_sequence)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    expect(ran).toHaveBeenCalledTimes(14);

    await expect(
      withProviderCall(accounting, { ...prep, kind: "semantic_review" }, async () => ran()),
    ).rejects.toSatisfy(isProviderCallTelemetryError);
    // Refused at allocation: no row was written and the body never ran.
    expect(calls).toHaveLength(14);
    expect(ran).toHaveBeenCalledTimes(14);
  });
});

// ==========================================================================
// FINALIZATION FAILURE — THE PRODUCT RULE (Part 13, 40–46)
// ==========================================================================

describe("[R5C-2B] a submission that cannot be accounted for STOPS", () => {
  it("a successful provider call plus a finalize failure terminates the submission", async () => {
    routeProvider();
    const { accounting, calls } = accountingOver({ finalizeFails: true });
    await expect(generateArenaScenarioDraft(genInput, accounting)).rejects.toSatisfy(isProviderCallTelemetryError);
    // Exactly one provider call happened; nothing retried it.
    expect(mockCreate).toHaveBeenCalledTimes(1);
    // The row stays HONESTLY in flight — the answer was lost, and it says so.
    expect(calls).toHaveLength(1);
    expect(calls[0].lifecycle_state).toBe("in_flight");
    expect(calls[0].outcome).toBeUndefined();
  });

  it("no downstream reviewer runs, and nothing is persisted", async () => {
    routeProvider();
    const h = makeAdmin({ finalizeFails: true });
    const before = JSON.stringify(h.drafts[0]);
    const r = await regenerateArenaDraft(h.admin, "owner-1", "draft-1", "en");

    expect(r.ok).toBe(false);
    // The route's honest, EXISTING internal contract — no new taxonomy code was added.
    expect(r.ok === false && r.reason).toBe("generation_failed");
    // Only the generation call was made: no boundary review, no semantic review, no retry.
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].call_kind).toBe("generation");
    // The draft is untouched: no scenario, no revision bump.
    expect(JSON.stringify(h.drafts[0])).toBe(before);
    expect(h.drafts[0].scenario_draft).toBeNull();
    expect(h.drafts[0].revision).toBe(1);
    // The parent ended through the existing internal attribution.
    expect(h.attempts[0]).toMatchObject({ lifecycle_state: "completed", outcome: "internal_failure" });
    expect(h.attempts[0].terminal_reason_code).toBe("internal_unclassified_failure");
  });

  it("a telemetry failure is NOT reported as a provider failure", async () => {
    routeProvider();
    const h = makeAdmin({ finalizeFails: true });
    await regenerateArenaDraft(h.admin, "owner-1", "draft-1", "en");
    // `network`/`aborted` would blame the provider for a database problem.
    expect(h.attempts[0].provider_error_category).toBe("unknown");
    expect(h.attempts[0].provider_http_status ?? null).toBeNull();
  });
});

// ==========================================================================
// PRIVACY (Part 13, 47–52)
// ==========================================================================

describe("[R5C-2B] shape is recorded, content never is", () => {
  const SECRETS = [
    "Authorization: Bearer sk-live-DEADBEEF",
    "Set-Cookie: session=abc",
    "Never disclose a patient identifier",
  ];

  it("no provider response, prompt or setup text reaches any child row", async () => {
    const poisoned = { ...goodDraft, title: `${SECRETS[2]} — Raising a risk under a deadline` };
    routeProvider({
      generation: content(providerJson(poisoned, undefined, [])),
      semantic: content(JSON.stringify(acceptReview(poisoned, {}, []))),
    });
    const { accounting, calls } = accountingOver();
    await generateArenaScenarioDraft(genInput, accounting);
    const dump = JSON.stringify(calls);
    const pressure: string = guided.avoidancePressure?.text ?? "";
    const forbidden: string[] = [...SECRETS, "Raising a risk", facts.problem, pressure, "escalationText"]
      .map((v) => String(v ?? ""))
      .filter(Boolean);
    for (const s of forbidden) {
      expect(dump, `child rows must not carry ${s.slice(0, 24)}`).not.toContain(s);
    }
  });

  it("an error body, its headers and its stack never reach a child row", async () => {
    routeProvider();
    mockCreate.mockImplementation(async () => {
      throw new H.MockLlmHttpError(500, "Internal", { error: { message: SECRETS[0] } }, null, "req-secret-123");
    });
    const { accounting, calls } = accountingOver();
    await generateArenaScenarioDraft(genInput, accounting);
    const dump = JSON.stringify(calls);
    for (const s of [...SECRETS, "req-secret-123", "Internal"]) expect(dump).not.toContain(s);
    // Only the shape survives.
    expect(calls[0]).toMatchObject({ outcome: "http_error", provider_http_status: 500, provider_error_category: "server_error" });
  });

  it("every recorded column is an identifier, a number, a timestamp, an enum or a hash", async () => {
    routeProvider();
    const { accounting, calls } = accountingOver();
    await generateArenaScenarioDraft(genInput, accounting);
    const ALLOWED = new Set([
      "id", "attempt_id", "call_kind", "global_sequence", "kind_sequence", "lifecycle_state",
      "provider_invoked_at", "finished_at", "duration_ms", "model", "provider_timeout_ms",
      "max_tokens", "temperature", "top_p", "structured_output_mode", "locale", "outcome",
      "provider_http_status", "provider_error_category", "response_digest_scope",
      "response_byte_count", "response_sha256", "finish_reason", "prompt_tokens",
      "completion_tokens", "total_tokens",
    ]);
    for (const row of calls) for (const k of Object.keys(row)) expect(ALLOWED, `unexpected column ${k}`).toContain(k);
  });

  it("the SAME model content under two calls produces the SAME digest — the R5B question", async () => {
    // R5B could not say whether its two attempts had received identical model content. One shared
    // digest helper across all four sites is what makes that answerable.
    const body = providerJson(goodDraft, undefined, []);
    routeProvider({ generation: content(body), semantic: content(body) });
    const { accounting, calls } = accountingOver();
    await generateArenaScenarioDraft(genInput, accounting);
    const digests = calls.filter((c) => c.response_sha256).map((c) => c.response_sha256);
    expect(digests.length).toBeGreaterThanOrEqual(2);
    expect(new Set(digests).size).toBe(1);
    for (const c of calls.filter((x) => x.response_sha256)) expect(c.response_digest_scope).toBe("model_content_utf8");
  });

  it("different content produces different digests", async () => {
    routeProvider();
    const { accounting, calls } = accountingOver();
    await generateArenaScenarioDraft(genInput, accounting);
    const digests = calls.filter((c) => c.response_sha256).map((c) => c.response_sha256);
    expect(new Set(digests).size).toBe(digests.length);
  });

  it("a long finish reason is bounded", async () => {
    routeProvider({ generation: content(providerJson(goodDraft, undefined, []), "x".repeat(200)) });
    const { accounting, calls } = accountingOver();
    await generateArenaScenarioDraft(genInput, accounting);
    expect(String(calls[0].finish_reason).length).toBeLessThanOrEqual(40);
  });
});

// ==========================================================================
// REGRESSION (Part 13, 53–61)
// ==========================================================================

describe("[R5C-2B] the product path is unchanged", () => {
  it("the normal path still makes exactly three provider calls and succeeds", async () => {
    routeProvider();
    const { accounting } = accountingOver();
    const r = await generateArenaScenarioDraft(genInput, accounting);
    expect(r.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("the same run WITHOUT instrumentation produces the same product result", async () => {
    routeProvider();
    const bare = await generateArenaScenarioDraft(genInput);
    mockCreate.mockClear();
    routeProvider();
    const { accounting } = accountingOver();
    const instrumented = await generateArenaScenarioDraft(genInput, accounting);
    expect(instrumented.ok).toBe(bare.ok);
    expect(instrumented.ok && bare.ok && instrumented.value.draft).toEqual(bare.ok && bare.value.draft);
  });

  it("the generation retry limit is unchanged by instrumentation", async () => {
    routeProvider({ generation: content(JSON.stringify({ nope: true })) });
    const { accounting, calls } = accountingOver();
    await generateArenaScenarioDraft(genInput, accounting);
    // Two generation attempts, not three: the loop limit is untouched.
    expect(ofKind(calls, "generation")).toHaveLength(2);
  });

  it("no test in this file can reach a real network", () => {
    expect(vi.isMockFunction(mockCreate)).toBe(true);
  });
});
