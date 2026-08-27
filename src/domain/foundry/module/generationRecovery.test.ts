/**
 * SLICE R4-R9A — THE PURE RULE BEHIND A TRUTHFUL RECOVERY.
 *
 * Measured on live draft `adb75f6a`: two attempts, two genuinely different provider responses
 * (different bytes, different digests), one identical verdict — `non_observable_standard` on
 * `observable_standard`, `structural_retryable: false` on both call rows. The client offered
 * "다시 시도" anyway, because it read retryability off the refusal COPY. The second call was
 * real and was paid for.
 */
import { describe, it, expect } from "vitest";
import { generationRecovery, sourceFieldForKind } from "./generation-recovery";
import { sectionForBlockingCode, ALL_BLOCKING_CODES } from "./module-publish";
import { JOURNEY_KIND_SOURCE } from "./journey";

describe("R4-R9A — retryable vs non-retryable", () => {
  it("T1 — the measured refusal is NOT retryable, and names the Host's own answer", () => {
    const r = generationRecovery("invalid_output", "non_observable_standard", "observable_standard");
    expect(r.retryable).toBe(false);
    expect(r.target?.field).toBe("observableBehavior");
    // T5 — the step is the one the Review screen already sends a Host to for that answer.
    expect(r.target?.section).toEqual(sectionForBlockingCode("behavior_required"));
    expect(r.target?.section.step).toBe(4);
  });

  it("T1b — ANY named refusal is non-retryable: a program came back and was read", () => {
    for (const code of ["evidence_overclaim", "material_fabrication", "generic_completion", "trigger_not_recurring"]) {
      expect(generationRecovery("invalid_output", code, null).retryable, code).toBe(false);
    }
  });

  it("T11 — a failure that decided nothing about the training stays retryable", () => {
    for (const code of ["provider_unavailable", "timeout", "provider_error", "invalid_output", "attempt_recording_failed"]) {
      const r = generationRecovery(code, null, null);
      expect(r.retryable, code).toBe(true);
      expect(r.target, code).toBeNull();
    }
  });

  it("an unknown code is treated as NON-retryable — the safe direction", () => {
    /*
      A withheld retry costs one tap on a Builder field. An offered one that cannot succeed costs
      a provider call and the Host's belief that the button does something. The asymmetry decides
      the default, so a code nobody has classified yet cannot cause a spend.
    */
    expect(generationRecovery("something_new_nobody_mapped", null, null).retryable).toBe(false);
  });

  it("a pre-payable source fault names its field without a provider call ever happening", () => {
    const r = generationRecovery("behavior_is_a_question", null, null);
    expect(r.retryable).toBe(false);
    expect(r.target?.field).toBe("observableBehavior");
  });
});

describe("R4-R9A — the recovery target reuses the maps that already exist", () => {
  it("every kind with a Host source resolves to a real Review section and step", () => {
    for (const kind of Object.keys(JOURNEY_KIND_SOURCE)) {
      const field = sourceFieldForKind(kind);
      if (!field) continue; // no truthful Host field ⇒ the generic recovery, by design
      const r = generationRecovery("invalid_output", "some_refusal", kind);
      expect(r.target, kind).not.toBeNull();
      expect(r.target!.section.step, kind).toBeGreaterThan(0);
    }
  });

  it("a refused kind with no Host source falls back to the generic recovery, inventing nothing", () => {
    for (const kind of ["scenario", "action_decision", "field_application", "follow_up"]) {
      const r = generationRecovery("invalid_output", "some_refusal", kind);
      expect(r.retryable, kind).toBe(false);
      expect(r.target, kind).toBeNull();
    }
  });

  it("every blocking code a recovery can name is registered in the one authority", () => {
    // Anti-drift: the recovery table may only point at codes `CODE_TO_SECTION` knows, so a
    // recovery CTA can never open a step the Review screen does not agree with.
    for (const code of ["problem_required", "audience_required", "recurring_moment_required", "behavior_required", "evidence_required", "material_intent_required"]) {
      expect(ALL_BLOCKING_CODES, code).toContain(code);
      expect(sectionForBlockingCode(code), code).not.toBeNull();
    }
  });
});
