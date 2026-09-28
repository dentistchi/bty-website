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
const VALID = { title: "Early problem check", behavior: "checks one thing that could interrupt patient care and fixes it", when: "Before the first patient of the day", successEvidence: "the teammate hears which item was fixed" };
const reply = (content: unknown) => ({ choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }] });

beforeEach(() => {
  create.mockReset();
  llmAvailable.mockReset();
  llmAvailable.mockReturnValue(true);
});

describe("validateSimpleSuggestion — one short, plain, observable suggestion", () => {
  it("1–4. accepts exactly one {title, behavior, when, successEvidence}, all present and short", () => {
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
    [{ ...VALID, when: undefined }, "missing_field"],
    [{ ...VALID, successEvidence: undefined }, "missing_field"],
    [{ ...VALID, behavior: 3 }, "field_not_string"],
    [{ ...VALID, behavior: "   " }, "empty_field"],
    [{ ...VALID, behavior: "x".repeat(SIMPLE_SUGGESTION_LIMITS.behavior + 1) }, "too_long"],
    [{ ...VALID, when: "w".repeat(SIMPLE_SUGGESTION_LIMITS.when + 1) }, "too_long"],
    [{ ...VALID, behavior: "<b>checks</b> the room" }, "unsafe_markup"],
    [{ ...VALID, behavior: "what will you check first?" }, "behavior_is_a_question"],
    [{ ...VALID, behavior: "Improve patient care awareness" }, "vague_behavior"],
  ])("refuses %j → %s", (raw, code) => {
    expect(validateSimpleSuggestion(raw)).toEqual({ ok: false, code });
  });

  it("5. no BTY or instructional-design vocabulary reaches a manager (EN + KO)", () => {
    for (const leak of [
      "Records observable evidence of each check before the first patient",
      "Checks the room as part of the huddle training module",
      "Confirms the capability rubric with the team lead",
      "Checks the Arena score before the first patient",
    ]) expect(validateSimpleSuggestion({ ...VALID, behavior: leak })).toEqual({ ok: false, code: "internal_terminology" });
    expect(containsInternalTerminology("첫 환자 전에 역량 증거를 기록한다")).toBe(true);
    expect(containsInternalTerminology(`${VALID.title} ${VALID.behavior} ${VALID.when} ${VALID.successEvidence}`)).toBe(false);
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

import { visibleSuggestion, validateSimpleGuidance, fallbackSimpleGuidance, SIMPLE_GUIDANCE_LIMITS } from "@/domain/foundry/module/direction-copilot";
import { generateSimpleGuidance } from "./directionCopilotService";
import { programRepairInstruction } from "./programAuthorshipService";
import { PROGRAM_REJECT_CODES } from "@/domain/foundry/module/program-authorship";
import { effectiveBuilderMode, validateDraftPatch } from "@/domain/foundry/module/module-builder";
import { approximateMinutes, learnSummary } from "@/domain/foundry/module/simple-mode";

describe("SLICE 2 — hidden fields and the program's own contract rules", () => {
  it("9/10/11. title and successEvidence are generated but the authoring projection is behavior + when only", () => {
    const v = validateSimpleSuggestion(VALID);
    expect(v.ok && v.suggestion.title).toBe(VALID.title);
    expect(v.ok && v.suggestion.successEvidence).toBe(VALID.successEvidence);
    expect(v.ok && Object.keys(visibleSuggestion(v.suggestion)).sort()).toEqual(["behavior", "when"]);
  });

  it("12. the action stays pure: naming WHO or WHEN inside the behaviour is refused (the program would refuse it)", () => {
    expect(validateSimpleSuggestion({ ...VALID, behavior: "the lead checks one thing that could delay care" })).toEqual({ ok: false, code: "behavior_names_actor" });
    expect(validateSimpleSuggestion({ ...VALID, behavior: "checks one thing before the first patient" })).toEqual({ ok: false, code: "behavior_names_moment" });
    expect(validateSimpleSuggestion({ ...VALID, behavior: "첫 환자가 오기 전에 문제 하나를 확인하고 해결한다", when: "첫 환자가 오기 전에" })).toEqual({ ok: false, code: "behavior_names_moment" });
  });

  it("12. the hidden evidence is refused when it overclaims, by the SAME policy the program validator uses", () => {
    const r = validateSimpleSuggestion({ ...VALID, successEvidence: "this proves the team has mastered it" });
    expect(r).toEqual({ ok: false, code: "evidence_overclaim" });
  });
});

describe("SLICE 2 — default written guidance", () => {
  it("21/22. validates plain guidance and always has a deterministic, non-empty fallback", () => {
    const text = "Why it matters: a small problem found early does not interrupt a patient later.\n- Walk the room.\n- Fix one thing.\nAvoid: leaving it for later.";
    expect(validateSimpleGuidance({ guidance: text })).toMatchObject({ ok: true });
    expect(validateSimpleGuidance({ guidance: "too short" })).toMatchObject({ ok: false, code: "too_short" });
    expect(validateSimpleGuidance({ guidance: "x".repeat(SIMPLE_GUIDANCE_LIMITS.max + 1) })).toMatchObject({ ok: false, code: "too_long" });
    expect(validateSimpleGuidance({ guidance: text + " This module builds evidence." })).toMatchObject({ ok: false, code: "internal_terminology" });
    for (const locale of ["en", "ko"] as const) {
      const fb = fallbackSimpleGuidance({ goal: GOAL, behavior: VALID.behavior, when: VALID.when }, locale);
      expect(fb).toContain(VALID.behavior);
      expect(fb.length).toBeGreaterThan(20);
    }
  });

  it("guidance never blocks: a provider error returns the fallback in one call, and json_object prompts say JSON", async () => {
    create.mockRejectedValueOnce(new Error("500"));
    const r = await generateSimpleGuidance({ goal: GOAL, title: VALID.title, behavior: VALID.behavior, when: VALID.when, locale: "en" });
    expect(r.source).toBe("fallback");
    expect(create).toHaveBeenCalledTimes(1);
    expect((create.mock.calls[0]![0].messages as { content: string }[])[0]!.content).toMatch(/JSON/);
  });
});

describe("SLICE 2 — one closed-vocabulary repair", () => {
  it("18. every repair instruction is a fixed sentence keyed by the validator's own codes; unknown → none", () => {
    expect(programRepairInstruction("non_observable_standard")).toMatch(/NO subject.*NO time/);
    expect(programRepairInstruction("evidence_overclaim")).toMatch(/do not claim results/);
    expect(programRepairInstruction("missing_field")).toBeNull();
    for (const code of PROGRAM_REJECT_CODES) {
      const line = programRepairInstruction(code);
      if (line) expect(line).not.toMatch(/\$\{|undefined/);
    }
  });
});

describe("SLICE 2 — mode and Review helpers (no schema change)", () => {
  it("only an EMPTY draft opens Simple Mode; any authored answer keeps the detailed builder", () => {
    expect(effectiveBuilderMode({})).toBe("simple");
    expect(effectiveBuilderMode(undefined)).toBe("simple");
    expect(effectiveBuilderMode({ title: "Huddles" })).toBe("advanced");
    expect(effectiveBuilderMode({ problem: "x" })).toBe("advanced");
    expect(effectiveBuilderMode({ builderMode: "simple", problem: "x" })).toBe("simple");
    expect(effectiveBuilderMode({ builderMode: "advanced" })).toBe("advanced");
  });

  it("25. builderMode rides the existing answers JSON through the same whitelist validator", () => {
    expect(validateDraftPatch({ answers: { builderMode: "simple" } })).toMatchObject({ ok: true, value: { answers: { builderMode: "simple" } } });
    expect(validateDraftPatch({ answers: { builderMode: "expert" } })).toMatchObject({ ok: false });
  });

  it("7. Review derives 'what they'll learn' and a modest time estimate from what was adopted", () => {
    const journey = { version: 1, displayTitle: "t", displayTitleStatus: "grounded", elements: [
      { id: "a", kind: "why_it_matters", content: "A problem found early does not interrupt a patient. More text follows.", confirmationStatus: "grounded" },
      { id: "b", kind: "reflection", content: "What did you notice?", confirmationStatus: "grounded" },
      { id: "c", kind: "action_decision", content: "Decide one thing.", confirmationStatus: "grounded" },
    ] } as never;
    expect(learnSummary(journey)).toBe("A problem found early does not interrupt a patient.");
    expect(learnSummary(undefined)).toBeNull();
    expect(approximateMinutes(journey, "short guidance")).toBeGreaterThanOrEqual(2);
    expect(approximateMinutes(undefined, undefined)).toBe(2);
  });
});
