import { describe, it, expect } from "vitest";
import {
  GOVERNANCE_CODES,
  confirmationStillValid,
  isGovernanceCode,
  reactionToCode,
  resolveGovernanceView,
  type Governance,
} from "./practiceGovernance";

/**
 * THE HOST'S VIEW OF SERVER GOVERNANCE (Slice 3.2I-R5B2-R5C-4B).
 *
 * The previous screen kept the generate action available because retriability was unknown to it.
 * These tests hold the replacement to the property that fixes it: the screen RENDERS the server's
 * answer and derives nothing of its own.
 */

const g = (over: Partial<Governance>): Governance => ({
  generationInputRevision: 1,
  generationLocale: "en",
  refusalCount: 0,
  state: "ready",
  canStartGeneration: true,
  requiresExplicitConfirmation: false,
  reviewSetupRecommended: false,
  ...over,
});

describe("[R5C-4B] each server state has one complete screen", () => {
  it("READY offers Create, and says nothing about a refusal that never happened", () => {
    const v = resolveGovernanceView(g({}));
    expect(v).toMatchObject({ state: "ready", primary: "create", createEnabled: true, showsRefusalNotice: false, acknowledgementRequired: false });
    expect(v.secondary).toBe("review_setup");
  });

  it("CONFIRM_SECOND_ATTEMPT makes reviewing the setup PRIMARY and retry secondary", () => {
    const v = resolveGovernanceView(g({ state: "confirm_second_attempt", refusalCount: 1, canStartGeneration: false, requiresExplicitConfirmation: true, reviewSetupRecommended: true }));
    expect(v).toMatchObject({
      primary: "review_setup",
      secondary: "confirm_second_attempt",
      createEnabled: false,
      showsRetryAction: true,
      acknowledgementRequired: true,
      refusalCount: 1,
    });
  });

  it("REVISION_REQUIRED offers NO same-input retry at all", () => {
    const v = resolveGovernanceView(g({ state: "revision_required", refusalCount: 2, canStartGeneration: false, reviewSetupRecommended: true }));
    expect(v).toMatchObject({ primary: "review_setup", secondary: "none", createEnabled: false, showsRetryAction: false, refusalCount: 2 });
    // Absent, not merely disabled.
    expect(v.acknowledgementRequired).toBe(false);
  });

  it("IN_PROGRESS blocks submission and offers nothing to press", () => {
    const v = resolveGovernanceView(g({ state: "in_progress", canStartGeneration: false }));
    expect(v).toMatchObject({ primary: "none", secondary: "none", createEnabled: false, showsRetryAction: false });
  });
});

describe("[R5C-4B] an unreadable answer never becomes an enabled button", () => {
  it.each([[null], [undefined]])("absent governance blocks (%s)", (v) => {
    expect(resolveGovernanceView(v as null).createEnabled).toBe(false);
  });

  it("an unknown state blocks", () => {
    expect(resolveGovernanceView(g({ state: "something_new" as never }).valueOf() as Governance).createEnabled).toBe(false);
  });

  it("`input_revision_stale` is not a renderable state and blocks", () => {
    expect(resolveGovernanceView(g({ state: "input_revision_stale" })).createEnabled).toBe(false);
  });
});

describe("[R5C-4B] the count is the SERVER's bounded value", () => {
  it("clamps anything outside 0..2", () => {
    expect(resolveGovernanceView(g({ state: "revision_required", refusalCount: 97 })).refusalCount).toBe(2);
    expect(resolveGovernanceView(g({ state: "in_progress", refusalCount: -4 })).refusalCount).toBe(0);
  });

  it("is never inferred from client history", () => {
    // Two identical readings produce identical screens: nothing accumulates locally.
    const a = resolveGovernanceView(g({ state: "confirm_second_attempt", refusalCount: 1 }));
    const b = resolveGovernanceView(g({ state: "confirm_second_attempt", refusalCount: 1 }));
    expect(a).toEqual(b);
  });
});

describe("[R5C-4B] a confirmation is bound to one epoch and one locale", () => {
  const current = { generationInputRevision: 1, locale: "en" as const };

  it("is valid for the same epoch and locale", () => {
    expect(confirmationStillValid({ generationInputRevision: 1, locale: "en" }, current)).toBe(true);
  });

  it("is DISCARDED when the epoch moves — a confirmation for epoch 1 cannot authorize epoch 2", () => {
    expect(confirmationStillValid({ generationInputRevision: 1, locale: "en" }, { ...current, generationInputRevision: 2 })).toBe(false);
  });

  it("is DISCARDED when the locale changes", () => {
    expect(confirmationStillValid({ generationInputRevision: 1, locale: "en" }, { ...current, locale: "ko" })).toBe(false);
  });

  it("absent means not confirmed — reload cannot resurrect one", () => {
    expect(confirmationStillValid(null, current)).toBe(false);
  });
});

describe("[R5C-4B] stable server codes are handled, never treated as generic failures", () => {
  it("recognises exactly the seven codes", () => {
    expect(GOVERNANCE_CODES).toHaveLength(7);
    for (const c of GOVERNANCE_CODES) expect(isGovernanceCode(c)).toBe(true);
    for (const c of ["provider_timeout", "internal_failure", "", null, 7]) expect(isGovernanceCode(c)).toBe(false);
  });

  it("NO code ever triggers an automatic retry", () => {
    // Automatic retry is the exact behaviour this governance arc exists to prevent.
    for (const c of GOVERNANCE_CODES) expect(reactionToCode(c).automaticRetry).toBe(false);
  });

  it("a stale epoch refreshes the draft and discards the confirmation", () => {
    expect(reactionToCode("generation_input_revision_stale")).toMatchObject({ refreshDraft: true, clearPendingConfirmation: true });
  });

  it("confirmation-required keeps the pending confirmation — it is a request, not a failure", () => {
    expect(reactionToCode("generation_retry_confirmation_required")).toMatchObject({ refreshDraft: false, clearPendingConfirmation: false });
  });

  it("an invalid locale does not silently switch to English", () => {
    const r = reactionToCode("generation_locale_invalid");
    expect(r.refreshDraft).toBe(false);
    expect(r.clearPendingConfirmation).toBe(true);
  });
});
