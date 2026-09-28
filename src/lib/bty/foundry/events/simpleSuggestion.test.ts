import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * FOUNDRY SIMPLE MODE — Slice 1: ONE suggestion from ONE manager sentence. The provider is mocked;
 * the real domain validator runs. Mirrors directionCopilotService.test.ts so the same pipeline is
 * proven the same way.
 */
const create = vi.fn();
const llmAvailable = vi.fn<() => boolean>();
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => llmAvailable(),
  getLlmClient: () => ({ chat: { completions: { create: (...a: unknown[]) => create(...a) } } }),
  getLlmModel: () => "test-model",
}));

import { generateSimpleSuggestion, generateDirections, SIMPLE_GOAL_MAX_CHARS } from "./directionCopilotService";
import { validateSimpleSuggestion, SIMPLE_SUGGESTION_LIMITS, containsInternalTerminology } from "@/domain/foundry/module/direction-copilot";

const GOAL = "Check one preventable problem before the first patient arrives.";
const VALID = { behavior: "Checks one thing that could interrupt patient care and fixes it before it causes a delay.", when: "Before the first patient of the day" };
const reply = (content: unknown) => ({ choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }] });

beforeEach(() => {
  create.mockReset();
  llmAvailable.mockReset();
  llmAvailable.mockReturnValue(true);
});

describe("validateSimpleSuggestion — one short, plain, observable suggestion", () => {
  it("1–4. accepts exactly one {behavior, when}, both present and short", () => {
    const v = validateSimpleSuggestion(VALID);
    expect(v).toEqual({ ok: true, suggestion: VALID });
    if (v.ok) {
      expect(v.suggestion.behavior.length).toBeLessThanOrEqual(SIMPLE_SUGGESTION_LIMITS.behavior);
      expect(v.suggestion.when.length).toBeLessThanOrEqual(SIMPLE_SUGGESTION_LIMITS.when);
    }
  });

  it("7. a list is never a Simple Mode answer — not even a list of one", () => {
    expect(validateSimpleSuggestion([VALID])).toEqual({ ok: false, code: "multiple_suggestions" });
    expect(validateSimpleSuggestion({ suggestions: [VALID] })).toEqual({ ok: false, code: "multiple_suggestions" });
  });

  it.each([
    [{ when: VALID.when }, "missing_field"],
    [{ behavior: VALID.behavior }, "missing_field"],
    [{ behavior: 3, when: VALID.when }, "field_not_string"],
    [{ behavior: "   ", when: VALID.when }, "empty_field"],
    [{ behavior: "x".repeat(SIMPLE_SUGGESTION_LIMITS.behavior + 1), when: VALID.when }, "too_long"],
    [{ behavior: VALID.behavior, when: "w".repeat(SIMPLE_SUGGESTION_LIMITS.when + 1) }, "too_long"],
    [{ behavior: "<b>Checks</b> the room", when: VALID.when }, "unsafe_markup"],
    [{ behavior: "What will you check before the first patient arrives?", when: VALID.when }, "behavior_is_a_question"],
    [{ behavior: "Improve patient care awareness", when: VALID.when }, "vague_behavior"],
  ])("refuses %j → %s", (raw, code) => {
    expect(validateSimpleSuggestion(raw)).toEqual({ ok: false, code });
  });

  it("5. no BTY or instructional-design vocabulary reaches a manager (EN + KO)", () => {
    for (const leak of [
      "Records observable evidence of each check before the first patient",
      "Checks the room as part of the huddle training module",
      "Confirms the capability rubric with the team lead",
      "Checks the Arena score before the first patient",
    ]) expect(validateSimpleSuggestion({ behavior: leak, when: VALID.when })).toEqual({ ok: false, code: "internal_terminology" });
    expect(containsInternalTerminology("첫 환자 전에 역량 증거를 기록한다")).toBe(true);
    expect(containsInternalTerminology(VALID.behavior + " " + VALID.when)).toBe(false);
  });
});

describe("generateSimpleSuggestion — same pipeline, one call, truthful failures", () => {
  it("returns ONE suggestion from ONE sentence, in one provider call, with timing", async () => {
    create.mockResolvedValueOnce(reply(VALID));
    const r = await generateSimpleSuggestion({ goal: GOAL, locale: "en" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.suggestion).toEqual(VALID);
      expect(r.timing.attempts).toBe(1);
      expect(typeof r.timing.totalMs).toBe("number");
    }
    expect(create).toHaveBeenCalledTimes(1);
    // Only the sentence reaches the provider: no ids, names or draft content.
    const msgs = create.mock.calls[0]![0].messages as { content: string }[];
    expect(msgs[1]!.content).toContain(GOAL);
    expect(create.mock.calls[0]![0].response_format).toEqual({ type: "json_object" });
  });

  it("6. empty or oversized input fails truthfully BEFORE any provider call", async () => {
    for (const goal of ["", "   \n\t "]) {
      expect(await generateSimpleSuggestion({ goal, locale: "en" })).toMatchObject({ ok: false, code: "empty_input" });
    }
    expect(await generateSimpleSuggestion({ goal: "a".repeat(SIMPLE_GOAL_MAX_CHARS + 1), locale: "en" })).toMatchObject({ ok: false, code: "input_too_long" });
    expect(create).not.toHaveBeenCalled();
  });

  it("6. provider unavailable is reported, never faked", async () => {
    llmAvailable.mockReturnValue(false);
    expect(await generateSimpleSuggestion({ goal: GOAL, locale: "en" })).toMatchObject({ ok: false, code: "provider_unavailable" });
    expect(create).not.toHaveBeenCalled();
  });

  it("invalid output gets ONE bounded retry, then succeeds or fails closed", async () => {
    create.mockResolvedValueOnce(reply({ suggestions: [VALID, VALID] })).mockResolvedValueOnce(reply(VALID));
    const ok = await generateSimpleSuggestion({ goal: GOAL, locale: "en" });
    expect(ok).toMatchObject({ ok: true, timing: { attempts: 2 } });
    create.mockReset();
    create.mockResolvedValue(reply("not json"));
    expect(await generateSimpleSuggestion({ goal: GOAL, locale: "en" })).toMatchObject({ ok: false, code: "invalid_output", timing: { attempts: 2 } });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("a provider error does NOT retry (the manager's flow must not hang)", async () => {
    create.mockRejectedValueOnce(new Error("500"));
    expect(await generateSimpleSuggestion({ goal: GOAL, locale: "en" })).toMatchObject({ ok: false, code: "provider_error", timing: { attempts: 1 } });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("9. timing is measured, and logs carry numbers and codes only — never the sentence or suggestion", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    let t = 1000;
    create.mockImplementationOnce(async () => { t += 1234; return reply(VALID); });
    const r = await generateSimpleSuggestion({ goal: GOAL, locale: "ko" }, () => t);
    expect(r).toMatchObject({ ok: true, timing: { totalMs: 1234, attempts: 1 } });
    const logged = info.mock.calls.flat().join(" ");
    expect(logged).toContain("ms=1234");
    expect(logged).not.toContain(GOAL);
    expect(logged).not.toContain(VALID.behavior);
    // KO locale is requested explicitly.
    expect((create.mock.calls[0]![0].messages as { content: string }[])[0]!.content).toContain("natural Korean");
    info.mockRestore();
  });

  it("8. the Advanced three-direction generator is untouched: it still demands exactly three", async () => {
    create.mockResolvedValue(reply(VALID));
    const r = await generateDirections({ problemStatement: GOAL, locale: "en" });
    expect(r).toMatchObject({ ok: false, code: "invalid_output" });
  });
});
