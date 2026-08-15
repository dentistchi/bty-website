import { describe, it, expect } from "vitest";
import { decideAdoptionReceipt, type AdoptionClaim } from "./adoption-authority";

/**
 * SLICE 3.2R-R8F — A COMPLETED ADOPTION IS NOT RE-DECIDED.
 *
 * MEASURED on the pilot. Draft `093b0361` adopted attempt `764411ae` on 2026-08-08 and the
 * receipt was stamped in that same request (`applied_at` 20:33:49.350) — the canonical Apply the
 * Founder authorised, digest byte-exact. That attempt was generated under `program_authorship_v9`
 * and acceptance has since moved to v22.
 *
 * The recovery path re-proves the durable marker on EVERY later save, and the version gate
 * (3.2P-W4-R1) now refuses it: `proposal_no_longer_valid`. So the endpoint reports a REFUSAL for
 * an adoption that genuinely happened, whose receipt is already on the ledger, and which no rule
 * change can un-happen.
 *
 * The gate itself is right — it exists so a proposal written under older rules may not be ADOPTED
 * today. Recovery asks a different question: not "may this be adopted?" but "did this adoption,
 * already complete, need its receipt finished?" Once `applied_at` is set the answer is no, and
 * there is nothing left to decide.
 *
 * FAIL-CLOSED IS PRESERVED. Only the version gate is passed over, and only in recovery, and only
 * for an attempt that already carries a receipt. Every identity check runs first and unchanged —
 * a receipt cannot launder a marker that names another draft, another owner or another journey.
 */

const DRAFT = "093b0361-7cc8-4688-9f93-396d60582501";
const ATTEMPT = "764411ae-d38a-4e87-9491-bd182f12d1d9";
const FP = "our handoffs are inconsistent.¦everyone¦…¦youtube";
const DIGEST = "program_proposal_digest_v1:9d2234db361481d7cb810b1836e94d49b0e6269f6567cf54bf051f37f0d1581b";
/** What the canonical Apply was generated under. */
const ADOPTED_UNDER = "program_authorship_v9";
/** What acceptance requires today. */
const TODAY = "program_authorship_v23";

const claim = (over: Partial<AdoptionClaim> = {}): AdoptionClaim => ({
  mode: "recovery",
  claimedAttemptId: ATTEMPT,
  journeyInSamePatch: false,
  durableJourneyPresent: true,
  attempt: {
    id: ATTEMPT, draftId: DRAFT, outcome: "success", contextFingerprint: FP,
    proposalDigest: DIGEST, proposalVersion: ADOPTED_UNDER,
  },
  draftId: DRAFT,
  currentFingerprint: FP,
  currentAuthorityVersion: TODAY,
  latestSuccessfulAttemptId: ATTEMPT,
  adoptedJourneyDigest: DIGEST,
  receiptAlreadyStamped: true,
  ...over,
});

describe("[3.2R-R8F] recovery is stable across an authority change", () => {
  it("Case 3 — a stamped receipt re-reads as adopted, not as refused", () => {
    expect(decideAdoptionReceipt(claim())).toEqual({ ok: true });
  });

  it("Case 4 — repeated reads are idempotent: the same claim always answers the same", () => {
    const c = claim();
    expect(decideAdoptionReceipt(c)).toEqual(decideAdoptionReceipt(c));
    expect(decideAdoptionReceipt(c)).toEqual({ ok: true });
  });

  it("the gate still refuses an UNSTAMPED proposal written under the old rules", () => {
    // Nothing was adopted, so there is no completed act to protect — 3.2P-W4-R1 stands.
    expect(decideAdoptionReceipt(claim({ receiptAlreadyStamped: false })))
      .toEqual({ ok: false, reason: "proposal_no_longer_valid" });
    // …and an INITIAL claim can never take this path, whatever the ledger says.
    expect(decideAdoptionReceipt(claim({ mode: "initial", journeyInSamePatch: true })))
      .toEqual({ ok: false, reason: "proposal_no_longer_valid" });
  });

  it("absent `receiptAlreadyStamped` defaults to refusing — the strict answer, not the lenient one", () => {
    const { receiptAlreadyStamped: _omitted, ...withoutFlag } = claim();
    expect(decideAdoptionReceipt(withoutFlag as AdoptionClaim))
      .toEqual({ ok: false, reason: "proposal_no_longer_valid" });
  });

  it("Case 5/6 — a receipt never launders an identity fault", () => {
    // Case 5 — the source no longer resolves.
    expect(decideAdoptionReceipt(claim({ attempt: null }))).toEqual({ ok: false, reason: "attempt_not_found" });
    // The exact pilot shape: a marker inherited by a revision, naming its parent's attempt.
    expect(decideAdoptionReceipt(claim({ draftId: "843bbe80-d1ed-477d-b022-a7c5e5e69227" })))
      .toEqual({ ok: false, reason: "attempt_other_draft" });
    // Case 6 — a newer sibling exists, so this one is not the current source.
    expect(decideAdoptionReceipt(claim({ latestSuccessfulAttemptId: "ece8e133-021a-400a-b6db-9530e034fbfc" })))
      .toEqual({ ok: false, reason: "superseded_attempt" });
    // Case 7 — digest integrity outranks the receipt.
    expect(decideAdoptionReceipt(claim({ adoptedJourneyDigest: "program_proposal_digest_v1:other" })))
      .toEqual({ ok: false, reason: "proposal_mismatch" });
    // A journey that is simply not there cannot be recovered into existence.
    expect(decideAdoptionReceipt(claim({ durableJourneyPresent: false })))
      .toEqual({ ok: false, reason: "no_journey_in_same_patch" });
  });
});
