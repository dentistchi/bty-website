/**
 * Quick Training Quiz — generating a draft from study content.
 *
 * The manager's box is SOURCE MATERIAL. What this file pins is that the generator treats it that
 * way: it asks the provider for a strict JSON shape, survives the code fences providers add
 * anyway, refuses output it cannot verify against that source, and never returns something the
 * editor would then have to guess about.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const create = vi.fn();
vi.mock("@/lib/bty/llm/client", () => ({
  getLlmClient: () => ({ chat: { completions: { create: (...a: unknown[]) => create(...a) } } }),
  getLlmModel: () => "test-model",
  isLlmAvailable: () => available.value,
}));

const available = { value: true };

import { generateQuizDraft } from "./quickTrainingQuizGeneration";

/** Long enough to clear the source floor for a 5-question request (5 × 60 = 300 chars). */
const SOURCE =
  "Incidents must be reported within 24 hours of being noticed. " +
  "The shift lead signs off every report before it is filed. " +
  "A report that is not signed off within the same week is escalated to the clinical director. " +
  "Reports are stored for seven years and may be reviewed at any time by the auditor. " +
  "Nobody may alter a filed report; a correction is added as a new entry.";

function reply(content: string) {
  return { choices: [{ message: { content } }] };
}

const ONE_GOOD_QUESTION = {
  text: "How soon must an incident be reported?",
  choices: [
    { id: "a", label: "Within 24 hours" },
    { id: "b", label: "Within a week" },
  ],
  correctChoiceId: "a",
  explanation: "The policy names one day.",
  sourceEvidence: "reported within 24 hours",
};

function body(count: number, over: Record<string, unknown> = {}) {
  return JSON.stringify({
    questions: Array.from({ length: count }, (_, i) => ({
      ...ONE_GOOD_QUESTION,
      text: `${ONE_GOOD_QUESTION.text} (${i + 1})`,
      ...over,
    })),
  });
}

beforeEach(() => {
  create.mockReset();
  available.value = true;
});
afterEach(() => vi.clearAllMocks());

describe("the request itself", () => {
  it("asks for structured output with a strict JSON schema", async () => {
    create.mockResolvedValue(reply(body(5)));
    const r = await generateQuizDraft(SOURCE, 5, "en");
    expect(r.ok).toBe(true);
    const [params] = create.mock.calls[0] as [Record<string, unknown>];
    expect(params.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "quick_training_quiz_v1", strict: true },
    });
    expect(params.temperature).toBe(0);
  });

  it("falls back to plain JSON mode ONLY when the provider cannot honour the schema", async () => {
    create.mockRejectedValueOnce(new Error("LLM API error: 400 Bad Request response_format not supported"));
    create.mockResolvedValueOnce(reply(body(5)));
    const r = await generateQuizDraft(SOURCE, 5, "en");
    expect(r.ok).toBe(true);
    expect((create.mock.calls[1]![0] as Record<string, unknown>).response_format).toEqual({ type: "json_object" });
  });

  it("does NOT retry an unrelated provider failure as a schema problem", async () => {
    create.mockRejectedValue(new Error("LLM API error: 500 Internal Server Error"));
    expect(await generateQuizDraft(SOURCE, 5, "en")).toEqual({ ok: false, code: "provider_error" });
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("the reply is read defensively", () => {
  it("strips the ```json fences providers add despite being told not to", async () => {
    create.mockResolvedValue(reply("```json\n" + body(5) + "\n```"));
    const r = await generateQuizDraft(SOURCE, 5, "en");
    expect(r.ok).toBe(true);
    expect(r.ok && r.quiz.questions).toHaveLength(5);
  });

  it("assigns the ids and positions itself, so a repeated model id cannot slip through", async () => {
    create.mockResolvedValue(reply(body(5)));
    const r = await generateQuizDraft(SOURCE, 5, "en");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.quiz.questions.map((q) => q.id)).toEqual(["q1", "q2", "q3", "q4", "q5"]);
    expect(r.quiz.questions.map((q) => q.position)).toEqual([1, 2, 3, 4, 5]);
  });

  it("refuses unparseable output, the wrong question count, and an unmarked answer", async () => {
    create.mockResolvedValue(reply("I'm afraid I can't do that."));
    expect(await generateQuizDraft(SOURCE, 5, "en")).toEqual({ ok: false, code: "invalid_output" });

    create.mockResolvedValue(reply(body(3)));
    expect(await generateQuizDraft(SOURCE, 5, "en")).toEqual({ ok: false, code: "invalid_output" });

    create.mockResolvedValue(reply(body(5, { correctChoiceId: "z" })));
    expect(await generateQuizDraft(SOURCE, 5, "en")).toEqual({ ok: false, code: "invalid_output" });
  });
});

describe("strict source grounding", () => {
  it("accepts evidence that is verbatim apart from line wrapping", async () => {
    create.mockResolvedValue(reply(body(5, { sourceEvidence: "reported   within\n24 hours" })));
    expect((await generateQuizDraft(SOURCE, 5, "en")).ok).toBe(true);
  });

  it("refuses a question whose evidence is not in the supplied source", async () => {
    create.mockResolvedValue(reply(body(5, { sourceEvidence: "reported within 48 hours" })));
    expect(await generateQuizDraft(SOURCE, 5, "en")).toEqual({ ok: false, code: "source_ungrounded" });
  });

  it("refuses evidence too short to be evidence, and absent evidence", async () => {
    create.mockResolvedValue(reply(body(5, { sourceEvidence: "the" })));
    expect(await generateQuizDraft(SOURCE, 5, "en")).toEqual({ ok: false, code: "source_ungrounded" });

    create.mockResolvedValue(reply(body(5, { sourceEvidence: "" })));
    expect(await generateQuizDraft(SOURCE, 5, "en")).toEqual({ ok: false, code: "source_ungrounded" });
  });
});

describe("a useful refusal when there is not enough to ask about", () => {
  it("says how much source material is needed, and never calls the provider", async () => {
    const result = await generateQuizDraft("Report incidents quickly.", 5, "en");
    expect(result).toMatchObject({ ok: false, code: "source_too_short", requiredChars: 300, suppliedChars: 25 });
    expect(create).not.toHaveBeenCalled();
  });

  it("asks for more material for ten questions than for five", async () => {
    const five = await generateQuizDraft("x".repeat(250), 5, "en");
    const ten = await generateQuizDraft("x".repeat(250), 10, "en");
    expect(five).toMatchObject({ code: "source_too_short", requiredChars: 300 });
    expect(ten).toMatchObject({ code: "source_too_short", requiredChars: 600 });
  });

  it("reports an unconfigured provider rather than inventing questions", async () => {
    available.value = false;
    expect(await generateQuizDraft(SOURCE, 5, "en")).toEqual({ ok: false, code: "provider_unavailable" });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a question count this feature does not offer", async () => {
    expect(await generateQuizDraft(SOURCE, 7, "en")).toEqual({ ok: false, code: "invalid_input" });
  });
});
