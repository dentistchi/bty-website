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

import { __setGenObserver, generateArenaScenarioDraft, type GenObservation } from "./arenaScenarioGenerationService";

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

const GOOD: ArenaScenarioDraft = {
  title: "Raising a risk under a deadline",
  opening:
    "A teammate quietly flags a safety gap to you with the client's deadline only hours away. Raising it now stops the line while the customer waits; staying on schedule keeps the promise but carries the risk.",
  primary: { choices: [
    { id: "p1", label: "Stop the line now and tell the client why, accepting the delay" },
    { id: "p2", label: "Check the gap yourself first, accepting that the clock keeps running" }] },
  tradeoff: { escalationText: "A second stakeholder asks for a firm date within the hour.", choices: [
    { id: "ft1", label: "Give the range you can defend and name what would change it" },
    { id: "ft2", label: "Narrow the commitment to the one milestone you control" }] },
  actionDecision: { prompt: "Commit to what?", choices: [
    { id: "fa1", label: "Tell the client which part slips", isActionCommitment: true },
    { id: "fa2", label: "Confirm the scope before committing a date", isActionCommitment: false }] },
  branches: {
    p1: { resultingWorldState: "You stopped the line and said so openly.",
      escalationText: "The client asks who is accountable while the team waits.",
      tradeoffChoices: [{ id: "p1t1", label: "Own the call publicly and absorb the criticism" }, { id: "p1t2", label: "Bring your manager in to back the decision, accepting how it looks" }],
      actionDecision: { prompt: "Commit to what?", choices: [
        { id: "p1a1", label: "Send one written update naming the slip", isActionCommitment: true },
        { id: "p1a2", label: "Hold the update until the check completes", isActionCommitment: false }] } },
    p2: { resultingWorldState: "You verified the gap before saying anything.",
      escalationText: "The team has already moved on while you were checking.",
      tradeoffChoices: [{ id: "p2t1", label: "Correct the record now and explain the delay" }, { id: "p2t2", label: "Leave the past alone and apply the standard from here" }],
      actionDecision: { prompt: "Commit to what?", choices: [
        { id: "p2a1", label: "Publish a short correction to the same channel", isActionCommitment: true },
        { id: "p2a2", label: "Brief only the two people still at risk", isActionCommitment: false }] } },
  },
};

/** The SAME draft with one branch's action set copied → trips `repeated_action_meaning` (a gate). */
const GATED: ArenaScenarioDraft = JSON.parse(JSON.stringify(GOOD));
GATED.branches!.p2.actionDecision = JSON.parse(JSON.stringify(GATED.branches!.p1.actionDecision));

function route(draft: ArenaScenarioDraft) {
  mockCreate.mockImplementation(async (p: { messages?: Array<{ content?: string }> }) =>
    isBoundaryReviewRequest(p)
      ? { choices: [{ message: { content: compliantBoundaryReview(p) } }] }
      : isReviewRequest(p)
        ? { choices: [{ message: { content: JSON.stringify(acceptReview(draft, {}, [])) } }] }
        : { choices: [{ message: { content: providerJson(draft, undefined, []) } }] },
  );
}

const collect = (opts?: { captureContent?: boolean }) => {
  const seen: GenObservation[] = [];
  __setGenObserver((o) => seen.push(o), opts);
  return seen;
};

beforeEach(() => { mockCreate.mockReset(); __setGenObserver(null); });

/** Field names that must NEVER appear in a caller-visible result. */
const TIMING_FIELDS = ["stageName", "stageStartedMonoMs", "stageFinishedMonoMs", "stageDurationMs"];

describe("the hook is a side-channel: production results do not move", () => {
  /*
    ★ INSTRUMENTATION MUST NOT WIDEN THE PRODUCT CONTRACT.

    Timing lives in GenObservation only. If it ever reached ArenaScenarioDraft or the generation
    result, every caller and the published snapshot would inherit telemetry.
  */
  it("J — with the observer UNSET the result is byte-identical across cases", async () => {
    for (const draft of [GOOD, GATED]) {
      route(draft);
      __setGenObserver(null);
      const a = await generateArenaScenarioDraft({ locale: "en", facts, guided });
      route(draft);
      const b = await generateArenaScenarioDraft({ locale: "en", facts, guided });
      expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    }
  });

  it("J2 — the returned object carries NONE of the new timing field names", async () => {
    route(GOOD);
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    const body = JSON.stringify(r);
    for (const f of TIMING_FIELDS) expect(body).not.toContain(f);
    expect(body).not.toContain("stage_finished");
  });

  it("K — observer enabled vs disabled returns byte-identical results", async () => {
    route(GOOD);
    __setGenObserver(null);
    const off = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    route(GOOD);
    collect({ captureContent: true });
    const on = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    __setGenObserver(null);
    expect(JSON.stringify(on)).toBe(JSON.stringify(off));
  });
});

describe("the rejected candidate draft now survives its own gate", () => {
  it("F — a deterministic gate rejection carries the draft when captureContent is on", async () => {
    route(GATED);
    const seen = collect({ captureContent: true });
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    __setGenObserver(null);
    expect(r.ok).toBe(false);
    const gate = seen.find((o) => o.outcome.startsWith("gate_level_"));
    expect(gate, "a gate_level_* event must be emitted").toBeTruthy();
    expect(gate!.scenario, "the candidate draft must ride the gate event").toBeTruthy();
    expect(JSON.stringify(gate!.scenario)).toContain(GATED.opening);
  });

  /* The capture POLICY is unchanged: content only when the harness explicitly opts in. */
  it("captureContent=false still exposes no scenario content", async () => {
    route(GATED);
    const seen = collect({ captureContent: false });
    await generateArenaScenarioDraft({ locale: "en", facts, guided });
    __setGenObserver(null);
    const gate = seen.find((o) => o.outcome.startsWith("gate_level_"));
    expect(gate).toBeTruthy();
    expect(gate!.scenario).toBeUndefined();
    expect(JSON.stringify(seen)).not.toContain(GATED.opening);
  });
});

describe("every provider stage reports a monotonic duration", () => {
  it("I — generation emits one stage_finished with a non-negative duration", async () => {
    route(GOOD);
    const seen = collect();
    await generateArenaScenarioDraft({ locale: "en", facts, guided });
    __setGenObserver(null);
    const stages = seen.filter((o) => o.outcome === "stage_finished");
    expect(stages.length).toBeGreaterThan(0);
    const gen = stages.find((o) => o.stageName === "generation");
    expect(gen).toBeTruthy();
    expect(typeof gen!.stageDurationMs).toBe("number");
    expect(gen!.stageDurationMs!).toBeGreaterThanOrEqual(0);
    expect(gen!.stageFinishedMonoMs!).toBeGreaterThanOrEqual(gen!.stageStartedMonoMs!);
    // The semantic reviewer is a separate stage and must be separately timed.
    expect(stages.some((o) => o.stageName === "semantic_review")).toBe(true);
  });

  it("M — a provider timeout still emits stage evidence rather than nothing", async () => {
    mockCreate.mockImplementation(async (_p: unknown, opts?: { signal?: AbortSignal }) => {
      // Reproduce an abort exactly as the runtime would see it, without waiting 120 s.
      const err = Object.assign(new Error("aborted"), { name: "AbortError" });
      (opts?.signal as AbortSignal & { dispatchEvent?: unknown })?.dispatchEvent;
      throw err;
    });
    const seen = collect();
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    __setGenObserver(null);
    expect(r.ok).toBe(false);
    const gen = seen.find((o) => o.outcome === "stage_finished" && o.stageName === "generation");
    expect(gen, "a failed stage must still be measured").toBeTruthy();
    expect(gen!.stageDurationMs!).toBeGreaterThanOrEqual(0);
  });
});

describe("backward compatibility of the event shape", () => {
  /* An old consumer reads outcome/code and ignores the rest; additive keys must not disturb it. */
  it("I2 — an old-shape consumer still reads every event", async () => {
    route(GOOD);
    const oldShape: Array<{ outcome: string; code?: string }> = [];
    __setGenObserver((o) => oldShape.push({ outcome: o.outcome, code: o.code }));
    await generateArenaScenarioDraft({ locale: "en", facts, guided });
    __setGenObserver(null);
    expect(oldShape.length).toBeGreaterThan(0);
    for (const e of oldShape) expect(typeof e.outcome).toBe("string");
    expect(oldShape.some((e) => e.outcome === "generated_valid")).toBe(true);
  });
});


/*
  ★ DETERMINISTIC CHURN PROOF — ONE REVIEW CALL, NOT TWO.

  Contradiction was the ONLY reason `decideAfterReview` ever granted a second review call, and it
  granted one on ~60% of reviewed drafts, re-asking the identical question with no feedback. With
  the verdict derived from details, a contradiction-shaped response is no longer a failure at all,
  so the second call has nothing to trigger it.

  This proves the CALL COUNT, not a wall-clock improvement in production.
*/
describe("contradiction no longer buys a second review call", () => {
  const reviewCalls = () => mockCreate.mock.calls.filter((c) => isReviewRequest(c[0] as never)).length;

  /** A review whose details carry a defect while the model votes accept — the old killer shape. */
  function contradictionShaped(draft: ArenaScenarioDraft) {
    mockCreate.mockImplementation(async (p: { messages?: Array<{ content?: string }> }) => {
      if (isBoundaryReviewRequest(p)) return { choices: [{ message: { content: compliantBoundaryReview(p) } }] };
      if (isReviewRequest(p)) {
        const r = acceptReview(draft, {}, []) as Record<string, unknown> & { branches: Array<Record<string, unknown>> };
        r.overallVerdict = "accept";
        r.branches = r.branches.map((b, i) => (i === 0 ? { ...b, repeatsPrimaryDecision: true, progressionValid: false } : b));
        return { choices: [{ message: { content: JSON.stringify(r) } }] };
      }
      return { choices: [{ message: { content: providerJson(draft, undefined, []) } }] };
    });
  }

  it("J — an accept-with-defects response consumes ONE review call and derives a rejection", async () => {
    contradictionShaped(GOOD);
    const seen = collect();
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided }, null, { architecture: "legacy", correction: "disabled" });
    __setGenObserver(null);
    expect(reviewCalls()).toBe(1);
    expect(r.ok).toBe(false);
    const outcomes = seen.map((o) => o.outcome);
    expect(outcomes).not.toContain("review_rerun");
    expect(outcomes).not.toContain("reviewer_terminal_failure");
    expect(seen.map((o) => o.code)).not.toContain("review_verdict_contradicts_details");
  });

  it("K — an advisory reject with no defect consumes ONE call, accepts, and signals the concern", async () => {
    mockCreate.mockImplementation(async (p: { messages?: Array<{ content?: string }> }) => {
      if (isBoundaryReviewRequest(p)) return { choices: [{ message: { content: compliantBoundaryReview(p) } }] };
      if (isReviewRequest(p)) {
        const r = acceptReview(GOOD, {}, []) as Record<string, unknown>;
        r.overallVerdict = "reject";
        return { choices: [{ message: { content: JSON.stringify(r) } }] };
      }
      return { choices: [{ message: { content: providerJson(GOOD, undefined, []) } }] };
    });
    const seen = collect();
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided }, null, { architecture: "legacy", correction: "disabled" });
    __setGenObserver(null);
    expect(reviewCalls()).toBe(1);
    expect(r.ok).toBe(true);                                  // the unsupported reject does NOT veto
    const valid = seen.find((o) => o.outcome === "generated_valid");
    expect(valid?.reviewerUnspecifiedConcern).toBe(true);      // signal only
    expect(valid?.advisoryConsistency).toBe("disagrees");
    expect(seen.map((o) => o.outcome)).not.toContain("review_rerun");
  });
});
