import { describe, it, expect } from "vitest";
import {
  MAX_AVOIDANCE_TEXT_LENGTH,
  MAX_CUSTOM_TEXT_LENGTH,
  guidedAnswersChanged,
  validateGuidedAnswers,
} from "./guidedSetupAnswers";

/**
 * WHAT COUNTS AS A REAL SETUP CHANGE (Slice 3.2I-R5B2-R5C-4B).
 *
 * This flag moves the generation-input epoch, which resets retry governance. So it must fire when
 * the model would see something different, and NOT fire otherwise — a save that changes nothing the
 * prompt can observe must never become a way to escape two same-input refusals.
 */

const ok = (over: Record<string, unknown> = {}) => ({
  hardestWhen: { choice: "time_limited" },
  avoidancePressure: { text: "raising it feels like slowing everyone down" },
  ...over,
});

describe("[R5C-4B] validation", () => {
  it("accepts a well-formed pair and normalizes whitespace", () => {
    const r = validateGuidedAnswers({ hardestWhen: { choice: "time_limited" }, avoidancePressure: { text: "  a   b  " } });
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.avoidancePressure.text).toBe("a b");
  });

  it("preserves CASE — the model sees it", () => {
    const r = validateGuidedAnswers(ok({ avoidancePressure: { text: "The Director pushes back" } }));
    expect(r.ok && r.value.avoidancePressure.text).toBe("The Director pushes back");
  });

  it("DROPS custom text that the prompt cannot read", () => {
    // Under a non-`other` choice the prompt never reads `customText`. Storing it would make two
    // drafts that generate identically look different.
    const r = validateGuidedAnswers(ok({ hardestWhen: { choice: "time_limited", customText: "left over" } }));
    expect(r.ok && r.value.hardestWhen).toEqual({ choice: "time_limited" });
  });

  it("requires custom text under `other`", () => {
    const r = validateGuidedAnswers(ok({ hardestWhen: { choice: "other", customText: "   " } }));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.errors).toContain("hardest_when_custom_required");
  });

  it.each([
    ["an unknown choice", { hardestWhen: { choice: "whenever" } }, "hardest_when_choice_invalid"],
    ["a missing choice", { hardestWhen: {} }, "hardest_when_choice_invalid"],
    ["blank pressure", { avoidancePressure: { text: "   " } }, "avoidance_pressure_required"],
    ["missing pressure", { avoidancePressure: {} }, "avoidance_pressure_required"],
  ])("rejects %s", (_l, over, code) => {
    const r = validateGuidedAnswers(ok(over as Record<string, unknown>));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.errors).toContain(code);
  });

  it("bounds both free-text fields", () => {
    const longP = validateGuidedAnswers(ok({ avoidancePressure: { text: "x".repeat(MAX_AVOIDANCE_TEXT_LENGTH + 1) } }));
    expect(longP.ok === false && longP.errors).toContain("avoidance_pressure_too_long");
    const longC = validateGuidedAnswers(ok({ hardestWhen: { choice: "other", customText: "y".repeat(MAX_CUSTOM_TEXT_LENGTH + 1) } }));
    expect(longC.ok === false && longC.errors).toContain("hardest_when_custom_too_long");
  });

  it("rejects non-objects without throwing", () => {
    for (const bad of [null, undefined, 42, "text", []]) expect(validateGuidedAnswers(bad).ok).toBe(false);
  });

  it("returns bounded CODES, never the submitted value", () => {
    const r = validateGuidedAnswers(ok({ avoidancePressure: { text: "x".repeat(MAX_AVOIDANCE_TEXT_LENGTH + 1) } }));
    expect(r.ok === false && r.errors.every((e) => /^[a-z_]+$/.test(e))).toBe(true);
  });
});

describe("[R5C-4B] semantic change detection follows GENERATION semantics", () => {
  const prev = { hardestWhen: { choice: "time_limited" as const }, avoidancePressure: { text: "it slows everyone down" } };

  it("a different choice IS a change", () => {
    expect(guidedAnswersChanged(prev, { ...prev, hardestWhen: { choice: "other_resists" } })).toBe(true);
  });

  it("different pressure text IS a change", () => {
    expect(guidedAnswersChanged(prev, { ...prev, avoidancePressure: { text: "the director pushes back" } })).toBe(true);
  });

  it("identical answers are NOT a change", () => {
    expect(guidedAnswersChanged(prev, { hardestWhen: { choice: "time_limited" }, avoidancePressure: { text: "it slows everyone down" } })).toBe(false);
  });

  it("whitespace-equivalent pressure text is NOT a change — the closed bypass", () => {
    expect(guidedAnswersChanged(prev, { ...prev, avoidancePressure: { text: "  it   slows everyone   down  " } })).toBe(false);
  });

  it("custom text under a NON-other choice is inert, so changing it is NOT a change", () => {
    // The prompt never reads it; moving the epoch for it would reset governance for nothing.
    const a = { hardestWhen: { choice: "time_limited" as const, customText: "one" }, avoidancePressure: prev.avoidancePressure };
    const b = { hardestWhen: { choice: "time_limited" as const, customText: "two" }, avoidancePressure: prev.avoidancePressure };
    expect(guidedAnswersChanged(a, b)).toBe(false);
  });

  it("custom text under `other` IS read, so changing it IS a change", () => {
    const a = { hardestWhen: { choice: "other" as const, customText: "when the ward is short-staffed" }, avoidancePressure: prev.avoidancePressure };
    const b = { hardestWhen: { choice: "other" as const, customText: "when the consultant is unreachable" }, avoidancePressure: prev.avoidancePressure };
    expect(guidedAnswersChanged(a, b)).toBe(true);
  });

  it("case IS a change — the model sees it", () => {
    expect(guidedAnswersChanged(prev, { ...prev, avoidancePressure: { text: "It Slows Everyone Down" } })).toBe(true);
  });

  it("an absent previous value is a change", () => {
    expect(guidedAnswersChanged(null, prev)).toBe(true);
    expect(guidedAnswersChanged(undefined, prev)).toBe(true);
  });

  it("BOTH fields moving in one save is still ONE change", () => {
    // The writer receives a single flag, so one save is one epoch regardless of how many fields moved.
    expect(guidedAnswersChanged(prev, { hardestWhen: { choice: "authority_unclear" }, avoidancePressure: { text: "nobody owns the call" } })).toBe(true);
  });
});
