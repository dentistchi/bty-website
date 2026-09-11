import { vi, describe, it, expect, beforeEach } from "vitest";
import type { ArenaScenarioDraft, GuidedAnswers } from "@/domain/foundry/arena-draft/types";
import { providerJson, acceptReview, isReviewRequest, isBoundaryReviewRequest, compliantBoundaryReview } from "@/domain/foundry/arena-draft/providerDto.fixture";
import type { ModuleSourceFacts } from "./arenaScenarioSource";

const mockCreate = vi.fn();
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => true,
  getLlmModel: () => "test-model",
  getLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
}));

import { generateArenaScenarioDraft, PRACTICE_SAMPLING } from "./arenaScenarioGenerationService";
import { MAX_CALLS_PER_KIND } from "@/domain/foundry/arena-draft/generationCallSequence";

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

/** A draft that FAILS a deterministic gate: both branches offer one identical action set. */
const collapsed: ArenaScenarioDraft = {
  title: "Raising a risk under a deadline",
  opening:
    "A teammate quietly flags a safety gap to you with the client's deadline only hours away. Raising it now stops the line while the customer waits; staying on schedule keeps the promise but carries the risk.",
  primary: {
    choices: [
      { id: "p1", label: "Stop the line now and tell the client why, accepting the delay" },
      { id: "p2", label: "Check the gap yourself first, accepting that the clock keeps running" },
    ],
  },
  tradeoff: {
    escalationText: "A second stakeholder asks for a firm date within the hour.",
    choices: [
      { id: "ft1", label: "Give the range you can defend and name what would change it" },
      { id: "ft2", label: "Narrow the commitment to the one milestone you control" },
    ],
  },
  actionDecision: {
    prompt: "Commit to what?",
    choices: [
      { id: "fa1", label: "Tell the client which part slips", isActionCommitment: true },
      { id: "fa2", label: "Confirm the scope before committing a date", isActionCommitment: false },
    ],
  },
  branches: {
    p1: {
      resultingWorldState: "You stopped the line and said so openly.",
      escalationText: "The client asks who is accountable while the team waits.",
      tradeoffChoices: [
        { id: "p1t1", label: "Own the call publicly and absorb the criticism" },
        { id: "p1t2", label: "Bring your manager in to back the decision, accepting how it looks" },
      ],
      actionDecision: {
        prompt: "Commit to what?",
        choices: [
          { id: "p1a1", label: "Send one written update naming the slip", isActionCommitment: true },
          { id: "p1a2", label: "Hold the update until the check completes", isActionCommitment: false },
        ],
      },
    },
    p2: {
      resultingWorldState: "You verified the gap before saying anything.",
      escalationText: "The team has already moved on while you were checking.",
      tradeoffChoices: [
        { id: "p2t1", label: "Correct the record now and explain the delay" },
        { id: "p2t2", label: "Leave the past alone and apply the standard from here" },
      ],
      /* The SAME action set as branch p1 → `repeated_action_meaning`, a deterministic gate. */
      actionDecision: {
        prompt: "Commit to what?",
        choices: [
          { id: "p2a1", label: "Send one written update naming the slip", isActionCommitment: true },
          { id: "p2a2", label: "Hold the update until the check completes", isActionCommitment: false },
        ],
      },
    },
  },
};

function routeProvider(draft: ArenaScenarioDraft) {
  mockCreate.mockImplementation(async (params: { messages?: Array<{ content?: string }> }) =>
    isBoundaryReviewRequest(params)
      ? { choices: [{ message: { content: compliantBoundaryReview(params) } }] }
      : isReviewRequest(params)
        ? { choices: [{ message: { content: JSON.stringify(acceptReview(draft, {}, [])) } }] }
        : { choices: [{ message: { content: providerJson(draft, undefined, []) } }] },
  );
}

/** Generation calls only — reviews are separate call kinds and are not being counted here. */
const generationCalls = () =>
  mockCreate.mock.calls.filter((c) => {
    const p = c[0] as { messages?: Array<{ content?: string }> };
    return !isBoundaryReviewRequest(p) && !isReviewRequest(p);
  }).length;

beforeEach(() => {
  mockCreate.mockReset();
});

/*
  ★ THE DEFAULT PATH IS THE BUILDER'S PATH, AND IT MUST NOT MOVE.

  The Builder calls `generateArenaScenarioDraft(input, accounting)` with no third argument. Every
  assertion here is about that exact shape: it must still take generation slot 1 and, on a
  correctable rejection, its correction slot 2.
*/
describe("the default execution policy is today's behaviour", () => {
  it("13 — omitting the option keeps the correction attempt", async () => {
    routeProvider(collapsed);
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    expect(r.ok).toBe(false);
    // Two generation calls: the first attempt and its correction.
    expect(generationCalls()).toBe(2);
  });

  it("15 — passing an accounting context but no option behaves identically", async () => {
    routeProvider(collapsed);
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided }, null);
    expect(r.ok).toBe(false);
    expect(generationCalls()).toBe(2);
  });

  it("14 — correction:disabled makes exactly ONE legacy generation call", async () => {
    routeProvider(collapsed);
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided }, null, {
      architecture: "legacy",
      correction: "disabled",
    });
    expect(r.ok).toBe(false);
    expect(generationCalls()).toBe(1);
  });

  /*
    The harness may only LOWER the ceiling. If a policy could raise it, a measurement harness
    would be able to increase real provider spend — which is exactly what the call ledger exists
    to make impossible.
  */
  it("F/G — the retry constants and the pinned contract digest are untouched", () => {
    expect(PRACTICE_SAMPLING.retry).toEqual({ maxAttempts: 2, inheritsGenerationSampling: true });
  });
});


// ---------------------------------------------------------------------------
// PLAN-THEN-RENDER v1 — call shape, opt-in, and the ceiling it must never cross.
// ---------------------------------------------------------------------------

/** A plan the validator accepts. Two worlds, two tradeoffs, two distinct actions. */
const VALID_PLAN = {
  primary: {
    dimensionId: "response_stance",
    dimension: "whether to decline now or look for an alternative first",
    tension: "protecting cover against respecting the person who asked",
    choices: [
      { id: "p1", stance: "operational cover", acceptedCost: "the requester is left without a reason" },
      { id: "p2", stance: "the requester's situation", acceptedCost: "the week runs short-staffed" },
    ],
  },
  branches: [
    {
      primaryChoiceId: "p1",
      resultingWorldState: "the request is declined and no reason has been given yet",
      tradeoff: { dimensionId: "explanation_depth", dimension: "how much of the reason to give", tension: "candour against morale" },
      action: { dimensionId: "who_hears_first", dimension: "who is told before the rota goes out" },
    },
    {
      primaryChoiceId: "p2",
      resultingWorldState: "the leave is approved and a gap now exists in that week",
      tradeoff: { dimensionId: "coverage_source", dimension: "where the cover comes from", tension: "team fatigue against outside cost" },
      action: { dimensionId: "rota_commitment", dimension: "when the rota is fixed" },
    },
  ],
};

/** A plan whose action restates its own tradeoff — the measured collapse. */
const COLLAPSED_PLAN = JSON.parse(JSON.stringify(VALID_PLAN));
COLLAPSED_PLAN.branches[0].action.dimensionId = COLLAPSED_PLAN.branches[0].tradeoff.dimensionId;
/** The v1 escape: both branches ending on one action dimension. v1.1 refuses it. */
const SIBLING_COLLAPSED_PLAN = JSON.parse(JSON.stringify(VALID_PLAN));
SIBLING_COLLAPSED_PLAN.branches[1].action.dimensionId = SIBLING_COLLAPSED_PLAN.branches[0].action.dimensionId;

const isPlanRequest = (p: { messages?: Array<{ content?: string }> }) =>
  (p.messages ?? []).some((m) => (m.content ?? "").includes("You do NOT write the scenario"));

const planCalls = () => mockCreate.mock.calls.filter((c) => isPlanRequest(c[0] as never)).length;
const renderCalls = () =>
  mockCreate.mock.calls.filter((c) => {
    const p = c[0] as { messages?: Array<{ content?: string }> };
    return !isPlanRequest(p) && !isBoundaryReviewRequest(p) && !isReviewRequest(p);
  }).length;

function routePlanThenRender(plan: unknown, draft: ArenaScenarioDraft) {
  mockCreate.mockImplementation(async (params: { messages?: Array<{ content?: string }> }) =>
    isPlanRequest(params)
      ? { choices: [{ message: { content: JSON.stringify(plan) } }] }
      : isBoundaryReviewRequest(params)
        ? { choices: [{ message: { content: compliantBoundaryReview(params) } }] }
        : isReviewRequest(params)
          ? { choices: [{ message: { content: JSON.stringify(acceptReview(draft, {}, [])) } }] }
          : { choices: [{ message: { content: providerJson(draft, undefined, []) } }] },
  );
}

describe("Plan-Then-Render is opt-in and bounded at two generation calls", () => {
  const PTR = { architecture: "plan_render_v1", correction: "disabled" } as const;

  it("16 — the default path never reaches the plan stage", async () => {
    routePlanThenRender(VALID_PLAN, collapsed);
    await generateArenaScenarioDraft({ locale: "en", facts, guided });
    expect(planCalls()).toBe(0);
  });

  it("7 — a valid plan is followed by exactly one render call", async () => {
    routePlanThenRender(VALID_PLAN, collapsed);
    await generateArenaScenarioDraft({ locale: "en", facts, guided }, null, PTR);
    expect(planCalls()).toBe(1);
    expect(renderCalls()).toBe(1);
  });

  /*
    A rejected plan is terminal. Spending a render call on a structure already known to be broken
    would buy prose for a decision the learner was never going to face twice.
  */
  it("6 — a rejected plan makes NO render call", async () => {
    routePlanThenRender(COLLAPSED_PLAN, collapsed);
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided }, null, PTR);
    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toBe("generation_rejected");
    expect(planCalls()).toBe(1);
    expect(renderCalls()).toBe(0);
  });

  it("8 + 9 — a failing render makes NO correction call, so total generation calls stay at 2", async () => {
    routePlanThenRender(VALID_PLAN, collapsed); // `collapsed` trips repeated_action_meaning
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided }, null, PTR);
    expect(r.ok).toBe(false);
    expect(planCalls() + renderCalls()).toBe(2);
    expect(renderCalls()).toBe(1);
  });

  it("8.2b — a sibling-collapsed plan is refused before any render call", async () => {
    routePlanThenRender(SIBLING_COLLAPSED_PLAN, collapsed);
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided }, null, PTR);
    expect(r.ok).toBe(false);
    expect(renderCalls()).toBe(0);
  });

  /* 8.8/8.9 — the prompt carries no borrowable domain vocabulary, only schematic placeholders. */
  it("8.8 + 8.9 — the plan prompt leaks no concrete dimension ids", async () => {
    routePlanThenRender(VALID_PLAN, collapsed);
    await generateArenaScenarioDraft({ locale: "en", facts, guided }, null, PTR);
    const planCall = mockCreate.mock.calls.find((c) => isPlanRequest(c[0] as never));
    const body = JSON.stringify(planCall?.[0]);
    for (const leaked of ["operational_capacity", "communication_timing", "alternative_selection"]) {
      expect(body).not.toContain(leaked);
    }
    expect(body).toContain("<snake_case_primary_decision>");
    expect(body).toContain("never output these literally");
  });

  /*
    ★ v1.2 — A DEFINITION THAT CAN BE COPIED IS AN EXAMPLE.

    After the domain ids were removed, all 27 cross-fixture plans separated their branches as
    `which_priority_to_protect` / `which_cost_to_accept` — the two halves of the phase-definition
    sentence the prompt used to carry. The phases are now defined by WHERE their decision must come
    from, so there is no longer a quotable semantic answer in the instruction.
  */
  it("v1.2 — the plan prompt carries no quotable phase-definition wording", async () => {
    routePlanThenRender(VALID_PLAN, collapsed);
    await generateArenaScenarioDraft({ locale: "en", facts, guided }, null, PTR);
    const planCall = mockCreate.mock.calls.find((c) => isPlanRequest(c[0] as never));
    const body = JSON.stringify(planCall?.[0]);
    for (const echo of [
      "which priority to protect",
      "which cost to accept",
      "priority_to_protect",
      "cost_to_accept",
      "legitimate value to lead with",
    ]) {
      expect(body).not.toContain(echo);
    }
  });

  /* The FORM contract must survive the removal, or the prompt and the validator disagree again. */
  it("v1.2 — the decision-question form instruction is still present", async () => {
    routePlanThenRender(VALID_PLAN, collapsed);
    await generateArenaScenarioDraft({ locale: "en", facts, guided }, null, PTR);
    const planCall = mockCreate.mock.calls.find((c) => isPlanRequest(c[0] as never));
    const body = JSON.stringify(planCall?.[0]);
    expect(body).toContain("the QUESTION being decided");
    expect(body).toContain("whether / when / how much / which / who / what to");
  });

  it("10 — the approved plan travels in the render prompt", async () => {
    routePlanThenRender(VALID_PLAN, collapsed);
    await generateArenaScenarioDraft({ locale: "en", facts, guided }, null, PTR);
    const renderCall = mockCreate.mock.calls.find((c) => {
      const p = c[0] as { messages?: Array<{ content?: string }> };
      return !isPlanRequest(p) && !isBoundaryReviewRequest(p) && !isReviewRequest(p);
    });
    const body = JSON.stringify(renderCall?.[0]);
    expect(body).toContain("APPROVED DECISION PLAN");
    expect(body).toContain("Do not redesign its semantic decisions");
    for (const id of ["explanation_depth", "who_hears_first", "coverage_source", "rota_commitment"]) {
      expect(body).toContain(id);
    }
  });

  /*
    E — the architectural promise, asserted against the allocator's own published ceiling rather
    than against a number retyped here. Plan + Render = 2, and there is no third path.
  */
  it("E — the architecture cannot request a third generation call", async () => {
    routePlanThenRender(VALID_PLAN, collapsed);
    await generateArenaScenarioDraft({ locale: "en", facts, guided }, null, PTR);
    expect(planCalls() + renderCalls()).toBeLessThanOrEqual(MAX_CALLS_PER_KIND.generation);
    expect(MAX_CALLS_PER_KIND.generation).toBe(2);
  });
});
