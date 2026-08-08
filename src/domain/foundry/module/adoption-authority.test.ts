import { describe, it, expect } from "vitest";
import { decideAdoptionReceipt, type AdoptionClaim } from "./adoption-authority";

/**
 * SLICE 3.2L-R11.2 — the adversarial matrix A–J, against the pure decision.
 *
 * The live canonical draft has FIVE successful attempts sharing one context fingerprint,
 * so "owned UUID" was never proof of anything.
 */
const DRAFT = "093b0361-7cc8-4688-9f93-396d60582501";
const FP = "our handoffs are inconsistent.¦everyone¦…";
const V9 = "15108cf3-0c72-4dea-ba1f-aa54f98ca0e1";
const V1 = "b71273e8-0000-0000-0000-000000000000";

const base = (over: Partial<AdoptionClaim> = {}): AdoptionClaim => ({
  claimedAttemptId: V9,
  journeyInSamePatch: true,
  attempt: { id: V9, draftId: DRAFT, outcome: "success", contextFingerprint: FP },
  draftId: DRAFT,
  currentFingerprint: FP,
  latestSuccessfulAttemptId: V9,
  ...over,
});

describe("[3.2L-R11.2] a receipt cannot be invented", () => {
  it("A/G1: the exact valid adoption is accepted", () => {
    expect(decideAdoptionReceipt(base())).toEqual({ ok: true });
  });

  it("B/J/G2: a marker with no journey in the same request adopts nothing", () => {
    expect(decideAdoptionReceipt(base({ journeyInSamePatch: false }))).toEqual({
      ok: false,
      reason: "no_journey_in_same_patch",
    });
  });

  it("C/F/G3/G6: an older owned sibling cannot be stamped while a newer success exists", () => {
    // The live-reachable case: five successes, one fingerprint. Naming the v1 proposal
    // while adopting the v9 journey used to be stamped without complaint.
    const claim = base({
      claimedAttemptId: V1,
      attempt: { id: V1, draftId: DRAFT, outcome: "success", contextFingerprint: FP },
      latestSuccessfulAttemptId: V9,
    });
    expect(decideAdoptionReceipt(claim)).toEqual({ ok: false, reason: "superseded_attempt" });
  });

  it("D/E/G4/G5: a foreign or nonexistent attempt is refused", () => {
    // The owner-scoped read returns null for both — the decision cannot tell them apart,
    // and must not: neither is adoptable.
    expect(decideAdoptionReceipt(base({ attempt: null }))).toEqual({ ok: false, reason: "attempt_not_found" });
  });

  it("an attempt from another draft is refused", () => {
    const claim = base({ attempt: { id: V9, draftId: "other-draft", outcome: "success", contextFingerprint: FP } });
    expect(decideAdoptionReceipt(claim)).toEqual({ ok: false, reason: "attempt_other_draft" });
  });

  it("a refusal or in-flight attempt produced no proposal to adopt", () => {
    for (const outcome of ["validation_refused", "provider_error", "timeout", "started"]) {
      const claim = base({ attempt: { id: V9, draftId: DRAFT, outcome, contextFingerprint: FP } });
      expect(decideAdoptionReceipt(claim), outcome).toEqual({ ok: false, reason: "attempt_not_successful" });
    }
  });

  it("G/I/G7: a direct PATCH cannot adopt a proposal written from answers that have moved", () => {
    // Server authority, not the client's fingerprint gate — a direct request bypasses that.
    const claim = base({ currentFingerprint: "our handoffs are fine now.¦everyone¦…", latestSuccessfulAttemptId: null });
    expect(decideAdoptionReceipt(claim)).toEqual({ ok: false, reason: "context_moved" });
  });

  it("H/G8: the identical valid claim is stable on replay", () => {
    for (let i = 0; i < 3; i++) expect(decideAdoptionReceipt(base())).toEqual({ ok: true });
  });

  it("the checks are ordered so the cheapest disqualifier wins", () => {
    // No journey + everything else wrong still reports the journey fault first.
    expect(
      decideAdoptionReceipt(base({ journeyInSamePatch: false, attempt: null, currentFingerprint: "moved" })),
    ).toEqual({ ok: false, reason: "no_journey_in_same_patch" });
  });
});
