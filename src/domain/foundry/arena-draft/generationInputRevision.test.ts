import { describe, it, expect } from "vitest";
import {
  GENERATION_INPUT_BASELINE_REVISION,
  isSameInputEpochAttempt,
  isValidGenerationInputRevision,
  nextGenerationInputRevision,
} from "./generationInputRevision";

/**
 * THE SEMANTIC INPUT EPOCH (Slice 3.2I-R5B2-R5C-4A1).
 *
 * R5C-4A measured that `revision` increments on writes leaving the generation input identical, so
 * governance built on it could be reset by re-saving the same boundary. These tests hold the
 * replacement to the property that closes that bypass: the epoch moves only when the INPUT moves.
 */

describe("[R5C-4A1] the epoch begins at 1 and moves only on a real change", () => {
  it("baseline is 1, not 0 — 0 would be indistinguishable from unset", () => {
    expect(GENERATION_INPUT_BASELINE_REVISION).toBe(1);
  });

  it("a meaningful change increments exactly once", () => {
    expect(nextGenerationInputRevision(1, true)).toBe(2);
    expect(nextGenerationInputRevision(7, true)).toBe(8);
  });

  it("an idempotent save does not move it — THE bypass this slice closes", () => {
    // Re-saving the same boundary still bumps `revision` (concurrency), but must not create a new
    // input epoch, or prior refusals would appear to belong to a different input.
    expect(nextGenerationInputRevision(1, false)).toBe(1);
    expect(nextGenerationInputRevision(9, false)).toBe(9);
  });

  it("many fields changing in ONE save is still one epoch", () => {
    // The writer passes a single `changed` flag for the whole save, so mode + constraints + scope
    // moving together advance the epoch once, not three times.
    let epoch = 1;
    epoch = nextGenerationInputRevision(epoch, true);
    expect(epoch).toBe(2);
  });

  it("is monotonic — it never decreases", () => {
    let epoch = 1;
    for (const changed of [true, false, true, false, false, true]) {
      const next = nextGenerationInputRevision(epoch, changed);
      expect(next).toBeGreaterThanOrEqual(epoch);
      epoch = next;
    }
    expect(epoch).toBe(4);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["zero", 0],
    ["negative", -3],
    ["a fraction", 1.5],
    ["a string", "1"],
    ["NaN", Number.NaN],
  ])("treats %s as the baseline rather than trusting it", (_l, bad) => {
    // A missing or malformed stored value must never produce 0, NaN or a decrement.
    expect(nextGenerationInputRevision(bad, false)).toBe(1);
    expect(nextGenerationInputRevision(bad, true)).toBe(2);
  });
});

describe("[R5C-4A1] validation", () => {
  it.each([[1], [2], [9999]])("accepts %i", (v) => expect(isValidGenerationInputRevision(v)).toBe(true));
  it.each([[0], [-1], [1.5], ["1"], [null], [undefined], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    "rejects %s",
    (v) => expect(isValidGenerationInputRevision(v)).toBe(false),
  );
});

describe("[R5C-4A1] the LEGACY BASELINE policy is pinned so it cannot drift", () => {
  it("at draft epoch 1, a NULL attempt IS a baseline-epoch attempt", () => {
    // The two historical attempts predate the contract. While the draft is still at epoch 1 the
    // input has not meaningfully changed since, so their refusals still describe what a Host would
    // submit right now — and must keep counting once governance exists.
    expect(isSameInputEpochAttempt(1, null)).toBe(true);
    expect(isSameInputEpochAttempt(1, undefined)).toBe(true);
  });

  it("past epoch 1, a NULL attempt is NOT counted", () => {
    // The input has demonstrably moved at least once; an attempt whose epoch was never recorded
    // cannot be proven to describe the current one.
    expect(isSameInputEpochAttempt(2, null)).toBe(false);
    expect(isSameInputEpochAttempt(5, undefined)).toBe(false);
  });

  it("a recorded epoch counts only against its exact match", () => {
    expect(isSameInputEpochAttempt(3, 3)).toBe(true);
    expect(isSameInputEpochAttempt(3, 2)).toBe(false);
    expect(isSameInputEpochAttempt(3, 4)).toBe(false);
    expect(isSameInputEpochAttempt(1, 1)).toBe(true);
    expect(isSameInputEpochAttempt(1, 2)).toBe(false);
  });

  it("the asymmetry is deliberate: it preserves blocking evidence at epoch 1", () => {
    // At epoch 1 the conservative direction is to KEEP the evidence that prevents repeated
    // spending. Past epoch 1 it is to discard evidence that cannot be placed, rather than block a
    // Host on attempts that may predate their edits.
    expect(isSameInputEpochAttempt(1, null)).toBe(true);
    expect(isSameInputEpochAttempt(2, null)).toBe(false);
  });

  it("the CAPTURED live fixture resolves as a baseline-epoch pair", () => {
    // Draft 98a6d068… is at epoch 1; both historical attempts carry NULL. Governance must still
    // see two same-input refusals.
    const draftEpoch = 1;
    const historical = [null, null];
    expect(historical.filter((a) => isSameInputEpochAttempt(draftEpoch, a))).toHaveLength(2);
  });

  it("counts nothing by itself — this slice provides the data contract only", () => {
    // A predicate, not a policy: no refusal classification and no admission decision live here.
    expect(typeof isSameInputEpochAttempt(1, null)).toBe("boolean");
  });
});
