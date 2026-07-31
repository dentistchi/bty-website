import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { ArenaScenarioDraft, GuidedAnswers } from "@/domain/foundry/arena-draft/types";
import type { ModuleSourceFacts } from "./arenaScenarioSource";

/**
 * PROVIDER OUTPUT CONTRACT regression matrix (Slice 3.2I-R5B1A.1-R2.15).
 *
 * The first full live run generated 0 of 20 scenarios: the model answered (14.9–25.3 s) but the
 * canonical pipeline rejected everything. Two measured transport defects explain that class of
 * failure — the request carried NO `response_format`, and `max_tokens` was 1,400 against a schema
 * whose worst case is ~4,000 output tokens, while `finish_reason` was never inspected so a
 * truncated body was parsed and misreported as `malformed_shape`.
 *
 * These tests pin the corrected contract and reproduce each measured/latent response shape. Every
 * case states its expected disposition: ACCEPTED, or REJECTED with an exact code. Nothing here
 * fabricates missing scenario content, and no gate is relaxed.
 */

const mockCreate = vi.fn();
let available = true;
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => available,
  getLlmModel: () => "test-model",
  getLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
}));

import { generateArenaScenarioDraft, __setGenObserver, type GenObservation } from "./arenaScenarioGenerationService";

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
const input = { locale: "en" as const, facts, guided };

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
    escalationText:
      "A second reviewer now reports the same gap from a different angle, and the client asks for a status call within the hour.",
    choices: [
      { id: "tradeoff_1", label: "Tell the client the review is incomplete and ask for more time" },
      { id: "tradeoff_2", label: "Narrow the release scope so the unverified part ships later" },
    ],
  },
  actionDecision: {
    prompt: "What do you do in the next hour?",
    choices: [
      { id: "action_1", label: "Call the client now and disclose the open risk", isActionCommitment: true },
      { id: "action_2", label: "Document the gap and run one more verification pass first", isActionCommitment: false },
    ],
  },
  branches: {
    primary_1: {
      escalationText: "Stopping the line frees the reviewers, but the client escalates to your director within the hour.",
      tradeoffChoices: [
        { id: "b1_t1", label: "Brief the director yourself before the client reaches them" },
        { id: "b1_t2", label: "Send the written risk summary and let the director lead the call" },
      ],
      actionDecision: {
        prompt: "What do you commit to now?",
        choices: [
          { id: "b1_a1", label: "Give the director a dated recovery plan on the call", isActionCommitment: true },
          { id: "b1_a2", label: "Ask for a day to confirm the fix before committing a date", isActionCommitment: false },
        ],
      },
    },
    primary_2: {
      escalationText: "Your own check narrows the gap, but the verification consumes the buffer the schedule depended on.",
      tradeoffChoices: [
        { id: "b2_t1", label: "Ship the verified portion and hold the rest for the next window" },
        { id: "b2_t2", label: "Ask the team for an overtime push to close the remaining gap" },
      ],
      actionDecision: {
        prompt: "What do you commit to now?",
        choices: [
          { id: "b2_a1", label: "Tell the client today which portion slips", isActionCommitment: true },
          { id: "b2_a2", label: "Wait for the overtime result before telling the client", isActionCommitment: false },
        ],
      },
    },
  },
};

/** Build a provider envelope. Mirrors the real OpenAI-compatible response shape. */
function envelope(
  content: string | null,
  over: { finish_reason?: string; refusal?: string | null } = {},
): unknown {
  return { choices: [{ message: { content, refusal: over.refusal ?? null }, finish_reason: over.finish_reason ?? "stop" }] };
}

let observed: GenObservation[] = [];
beforeEach(() => {
  available = true;
  mockCreate.mockReset();
  observed = [];
  __setGenObserver((o) => observed.push(o));
});
afterEach(() => __setGenObserver(null));

const lastCode = () => observed[observed.length - 1]?.code;

// ---------------------------------------------------------------------------
describe("request contract — the model is constrained, not merely asked", () => {
  it("sends response_format json_object, a sufficient token budget, and the model id", async () => {
    mockCreate.mockResolvedValueOnce(envelope(JSON.stringify(goodDraft)));
    await generateArenaScenarioDraft(input);
    const [params] = mockCreate.mock.calls[0];
    expect(params.response_format).toEqual({ type: "json_object" });
    expect(params.max_tokens).toBeGreaterThanOrEqual(4000); // ~4,000-token worst case
    expect(params.model).toBe("test-model");
  });

  it("the prompt still names JSON — json_object mode requires it", async () => {
    mockCreate.mockResolvedValueOnce(envelope(JSON.stringify(goodDraft)));
    await generateArenaScenarioDraft(input);
    const [params] = mockCreate.mock.calls[0];
    const text = params.messages.map((m: { content: string }) => m.content).join("\n");
    expect(text).toMatch(/JSON/);
  });

  it("ACCEPTED — a well-formed branch-aware draft generates", async () => {
    mockCreate.mockResolvedValueOnce(envelope(JSON.stringify(goodDraft)));
    const r = await generateArenaScenarioDraft(input);
    expect(r.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("provider envelope shapes", () => {
  it("REJECTED truncated_output — finish_reason 'length' is never parsed as content", async () => {
    // The measured defect: a truncated body used to reach JSON.parse and be misreported.
    const cut = JSON.stringify(goodDraft).slice(0, 900);
    mockCreate.mockResolvedValue(envelope(cut, { finish_reason: "length" }));
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect(lastCode()).toBe("truncated_output");
  });

  it("REJECTED provider_refusal — an explicit refusal is never scenario content", async () => {
    mockCreate.mockResolvedValue(envelope(null, { refusal: "I can't help with that." }));
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect(lastCode()).toBe("provider_refusal");
  });

  it("ACCEPTED — markdown code-fenced JSON is unwrapped, not rejected", async () => {
    mockCreate.mockResolvedValueOnce(envelope("```json\n" + JSON.stringify(goodDraft) + "\n```"));
    const r = await generateArenaScenarioDraft(input);
    expect(r.ok).toBe(true);
  });

  it("REJECTED malformed_shape — a prose preamble before the JSON", async () => {
    mockCreate.mockResolvedValue(envelope("Here is the scenario you asked for:\n" + JSON.stringify(goodDraft)));
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect(lastCode()).toBe("malformed_shape");
  });

  it("REJECTED malformed_shape — truncated JSON without a finish_reason signal", async () => {
    mockCreate.mockResolvedValue(envelope(JSON.stringify(goodDraft).slice(0, 400)));
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect(lastCode()).toBe("malformed_shape");
  });

  it("REJECTED — valid JSON with the wrong root (array)", async () => {
    mockCreate.mockResolvedValue(envelope(JSON.stringify([goodDraft])));
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("generation_failed — empty content is transport failure, not rejected content", async () => {
    mockCreate.mockResolvedValue(envelope(null));
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_failed" });
  });

  it("generation_failed — a thrown provider error never becomes content", async () => {
    mockCreate.mockRejectedValue(new Error("LLM API error: 500 Internal Server Error"));
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_failed" });
  });
});

// ---------------------------------------------------------------------------
describe("canonical schema rejections — exact codes, no invented content", () => {
  const mutate = (fn: (d: ArenaScenarioDraft) => void): string => {
    const d = JSON.parse(JSON.stringify(goodDraft)) as ArenaScenarioDraft;
    fn(d);
    return JSON.stringify(d);
  };

  it("REJECTED duplicate_choice_id — duplicate primary identifiers", async () => {
    mockCreate.mockResolvedValue(envelope(mutate((d) => { d.primary.choices[1].id = d.primary.choices[0].id; })));
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect(lastCode()).toBe("duplicate_choice_id");
  });

  it("REJECTED — a duplicate identifier inside one branch", async () => {
    mockCreate.mockResolvedValue(envelope(mutate((d) => { d.branches!.primary_1.tradeoffChoices[1].id = d.branches!.primary_1.tradeoffChoices[0].id; })));
    expect(await generateArenaScenarioDraft(input)).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("REJECTED — too few primary choices", async () => {
    mockCreate.mockResolvedValue(envelope(mutate((d) => { d.primary.choices = [d.primary.choices[0]]; delete d.branches!.primary_2; })));
    expect(await generateArenaScenarioDraft(input)).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("REJECTED — a primary choice with no branch continuation", async () => {
    mockCreate.mockResolvedValue(envelope(mutate((d) => { delete d.branches!.primary_2; })));
    expect(await generateArenaScenarioDraft(input)).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("REJECTED — a branch keyed to an unknown primary choice", async () => {
    mockCreate.mockResolvedValue(envelope(mutate((d) => {
      d.branches!.primary_99 = d.branches!.primary_1;
      delete d.branches!.primary_2;
    })));
    expect(await generateArenaScenarioDraft(input)).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("REJECTED — an empty choice label is never accepted as content", async () => {
    mockCreate.mockResolvedValue(envelope(mutate((d) => { d.primary.choices[0].label = ""; })));
    expect(await generateArenaScenarioDraft(input)).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("REJECTED — branches whose continuations are semantically identical (ids differ, text does not)", async () => {
    // IDs stay unique on purpose: this must be caught as a DIFFERENTIATION failure, not as
    // duplicate_choice_id. Copying the ids too would make the test pass for the wrong reason.
    mockCreate.mockResolvedValue(envelope(mutate((d) => {
      const a = d.branches!.primary_1;
      const b = d.branches!.primary_2;
      b.escalationText = a.escalationText;
      b.tradeoffChoices = a.tradeoffChoices.map((c, i) => ({ id: `b2_t${i + 1}`, label: c.label }));
      b.actionDecision = {
        prompt: a.actionDecision.prompt,
        choices: a.actionDecision.choices.map((c, i) => ({ id: `b2_a${i + 1}`, label: c.label, isActionCommitment: c.isActionCommitment })),
      };
    })));
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect(lastCode()).not.toBe("duplicate_choice_id"); // rejected on differentiation, not identifiers
  });
});

// ---------------------------------------------------------------------------
describe("no fallback, ever", () => {
  it("returns generation_unavailable rather than a deterministic scenario when no model exists", async () => {
    available = false;
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_unavailable" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("a rejected generation never returns a draft", async () => {
    mockCreate.mockResolvedValue(envelope("not json at all"));
    const r = await generateArenaScenarioDraft(input);
    expect(r.ok).toBe(false);
    expect(r as unknown as { value?: unknown }).not.toHaveProperty("value");
  });
});

// ---------------------------------------------------------------------------
describe("evaluation observability records the stage, never a secret", () => {
  it("captures the exact rejection code and finish reason", async () => {
    mockCreate.mockResolvedValue(envelope(JSON.stringify(goodDraft).slice(0, 900), { finish_reason: "length" }));
    await generateArenaScenarioDraft(input);
    const o = observed[observed.length - 1];
    expect(o.code).toBe("truncated_output");
    expect(o.finishReason).toBe("length");
  });

  it("never records credential-shaped material", async () => {
    mockCreate.mockResolvedValue(envelope("Here is the scenario:\n{\"broken\":"));
    await generateArenaScenarioDraft(input);
    const blob = JSON.stringify(observed);
    expect(blob).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(blob).not.toMatch(/Authorization|Bearer /);
  });

  it("is OFF by default — production installs no sink", async () => {
    __setGenObserver(null);
    mockCreate.mockResolvedValue(envelope("not json"));
    await generateArenaScenarioDraft(input);
    expect(observed).toEqual([]);
  });
});
