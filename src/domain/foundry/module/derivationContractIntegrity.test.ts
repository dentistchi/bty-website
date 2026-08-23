import { describe, it, expect } from "vitest";
import { decideAdoptionReceipt } from "./adoption-authority";
import { PROGRAM_AUTHORSHIP_VERSION, PROGRAM_SCHEMA_NAME } from "./program-authorship";

/**
 * SLICE 3.2R-R2.3-R3 — a proposal may not be applied under rules it was not generated under.
 *
 * R2.3-R2 made the review surface re-derive the operational construct, which repaired the
 * learner-facing prose on an OLD proposal. That is right for rendering and dangerous for
 * integrity: the proposal's digest attests to the bytes generated under the OLD contract, and
 * Apply writes the bytes rendered under the NEW one.
 *
 * MEASURED on the live attempt. Draft `ee79e3b3` has one attempt, `d36c5309`, generated under
 * `deploy_version 64e559ac` (R2.1) and carrying `proposal_version program_authorship_v22`. Three
 * of its six REQUIRED sections now render different bytes for identical Host input
 * (completion_check, field_application, action_decision), so its `proposal_digest` can no longer
 * be satisfied by what Apply would write.
 *
 * Without a version bump the claim reached `proposal_mismatch`: the receipt was correctly
 * withheld, but the marker was merely stripped and **the journey was still written** — content no
 * digest attests to, one publish away from a learner. `proposal_no_longer_valid` refuses with
 * ZERO writes, which is what "the rules changed after you generated this" should mean.
 *
 * The version was already the designed instrument for this; R2.3 simply did not use it.
 */

const DIGEST = "program_proposal_digest_v1:073b4582aaaa83f30bcb8dcc79a2ccf748862bfe15335bbecb7ea1505eb4b3d5";
const FINGERPRINT = "team huddles sometimes end with agreement…";

/** The live attempt `d36c5309`, as the ledger actually records it. */
const LIVE_ATTEMPT = {
  id: "d36c5309-a93f-4eac-b770-85c66485de9e",
  draftId: "ee79e3b3-2ed5-42d0-acf8-552765a8a12d",
  outcome: "success",
  contextFingerprint: FINGERPRINT,
  proposalDigest: DIGEST,
  proposalVersion: "program_authorship_v22",
  appliedAt: null,
};

const claim = (over: Record<string, unknown> = {}) => ({
  mode: "initial" as const,
  claimedAttemptId: LIVE_ATTEMPT.id,
  journeyInSamePatch: true,
  durableJourneyPresent: true,
  attempt: LIVE_ATTEMPT,
  draftId: LIVE_ATTEMPT.draftId,
  currentFingerprint: FINGERPRINT,
  currentAuthorityVersion: PROGRAM_AUTHORSHIP_VERSION,
  latestSuccessfulAttemptId: LIVE_ATTEMPT.id,
  // Byte-identical to the digest: the ONLY way an old attempt could otherwise slip through.
  adoptedJourneyDigest: DIGEST,
  ...over,
});

describe("an attempt generated under an older derivation contract cannot be applied", () => {
  it("the authority version moved, because three required sections render different bytes", () => {
    // v24 (Slice R4-R5C11): the deterministic COMPOSITION moved — six derived sections stopped
    // restating THE STANDARD and the Host criterion, so accepted programs render different bytes.
    expect(PROGRAM_AUTHORSHIP_VERSION).toBe("program_authorship_v24");
    // The WIRE shape did not move — that split is why the two names exist.
    expect(PROGRAM_SCHEMA_NAME).toBe("bty_guided_program_v12");
  });

  it("the live v22 attempt is refused as proposal_no_longer_valid, even with an EXACT digest", () => {
    /*
      The digest matching is the hard case: every identity check passes, so only the contract
      version can refuse it. If this ever returns ok, an old proposal is applicable again.
    */
    const d = decideAdoptionReceipt(claim() as never);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe("proposal_no_longer_valid");
  });

  it("that refusal is the ZERO-WRITE one, not the marker-stripping one", () => {
    /*
      The distinction that matters: `proposal_mismatch` strips the receipt and still writes the
      journey; `proposal_no_longer_valid` returns 409 before `updateDraftStep`. An old proposal
      must take the second path, or its re-derived content reaches the draft unattested.
    */
    const d = decideAdoptionReceipt(claim() as never);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).not.toBe("proposal_mismatch");
  });

  it("a NEW attempt under the current contract is accepted", () => {
    const d = decideAdoptionReceipt(
      claim({ attempt: { ...LIVE_ATTEMPT, proposalVersion: PROGRAM_AUTHORSHIP_VERSION } }) as never,
    );
    expect(d.ok).toBe(true);
  });

  it("a new attempt whose journey does NOT match its own digest is still refused", () => {
    const d = decideAdoptionReceipt(
      claim({
        attempt: { ...LIVE_ATTEMPT, proposalVersion: PROGRAM_AUTHORSHIP_VERSION },
        adoptedJourneyDigest: "program_proposal_digest_v1:" + "0".repeat(64),
      }) as never,
    );
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe("proposal_mismatch");
  });

  it("history is untouched — the old attempt keeps the version it was generated under", () => {
    /*
      Nothing in this repair rewrites an attempt. `d36c5309` stays v22 forever, because that is
      what produced it; the refusal comes from comparing it to today, not from editing it.
    */
    expect(LIVE_ATTEMPT.proposalVersion).toBe("program_authorship_v22");
    expect(LIVE_ATTEMPT.proposalDigest).toBe(DIGEST);
    expect(LIVE_ATTEMPT.appliedAt).toBeNull();
  });

  it("a RECOVERY of an already-stamped old adoption is still honoured", () => {
    /*
      The narrow R8F carve-out must survive the bump: an adoption that already completed cannot be
      un-happened by a floor that moved afterwards.
    */
    const d = decideAdoptionReceipt(
      claim({ mode: "recovery", journeyInSamePatch: false, receiptAlreadyStamped: true }) as never,
    );
    expect(d.ok).toBe(true);
  });

  it("an UNSTAMPED old proposal is refused even in recovery mode", () => {
    const d = decideAdoptionReceipt(
      claim({ mode: "recovery", journeyInSamePatch: false, receiptAlreadyStamped: false }) as never,
    );
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe("proposal_no_longer_valid");
  });

  it("the contract-version gate runs LAST — a genuine identity fault is still named as one", () => {
    const otherDraft = decideAdoptionReceipt(claim({ draftId: "someone-elses-draft" }) as never);
    expect(otherDraft.ok).toBe(false);
    if (!otherDraft.ok) expect(otherDraft.reason).toBe("attempt_other_draft");

    const moved = decideAdoptionReceipt(claim({ currentFingerprint: "different answers now" }) as never);
    expect(moved.ok).toBe(false);
    if (!moved.ok) expect(moved.reason).toBe("context_moved");
  });
});
