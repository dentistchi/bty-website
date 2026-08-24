import { describe, it, expect } from "vitest";
import { decideAdoptionReceipt, type AdoptionClaim } from "./adoption-authority";
import { PROGRAM_AUTHORSHIP_VERSION, programAuthorshipVersionNumber } from "./program-authorship";

/**
 * SLICE 3.2P-W4-R1 — IDENTITY IS NOT VALIDITY.
 *
 * A successful, unapplied W3 proposal sat in the browser's continuity cache for 24 hours while
 * acceptance changed four times — the interrogative-action floor, the filename material floor,
 * the server-written participant subject, and confirmer role-head authority. Re-entering Review
 * restored it looking like current work, naming a learner population the host had not chosen and
 * a record keeper the source never mentioned.
 *
 * Nothing in the adoption chain could see it. Same draft, outcome success, fingerprint unchanged
 * (the host changed nothing), newest attempt, digest exact — every one of those proves the
 * journey IS what that generation produced, and none of them proves that generation would still
 * be accepted. Those were the same question until a floor moved.
 */
const DRAFT = "3e079b1b-0077-48e6-80f7-fb7869b7eef1";
const ATTEMPT = "513e1642-92be-4be6-bb52-50febfe81b3c";
const FP = "during morning huddles…¦leaders¦¦accountability¦…¦pdf";
const DIGEST = "program_proposal_digest_v1:7bdfeca7";
/** What W3 was actually generated under. */
const OLD_AUTHORITY = "program_authorship_v9";

const claim = (over: Partial<AdoptionClaim> = {}): AdoptionClaim => ({
  mode: "initial",
  claimedAttemptId: ATTEMPT,
  journeyInSamePatch: true,
  durableJourneyPresent: false,
  attempt: {
    id: ATTEMPT, draftId: DRAFT, outcome: "success", contextFingerprint: FP,
    proposalDigest: DIGEST, proposalVersion: PROGRAM_AUTHORSHIP_VERSION,
  },
  draftId: DRAFT,
  currentFingerprint: FP,
  currentAuthorityVersion: PROGRAM_AUTHORSHIP_VERSION,
  latestSuccessfulAttemptId: ATTEMPT,
  adoptedJourneyDigest: DIGEST,
  ...over,
});

describe("[3.2P-W4-R1] E/H/I — the adoption gate", () => {
  it("E — the real W3 shape: every identity check passes, and it is still refused", () => {
    const stale = claim({
      attempt: { id: ATTEMPT, draftId: DRAFT, outcome: "success", contextFingerprint: FP, proposalDigest: DIGEST, proposalVersion: OLD_AUTHORITY },
    });
    // Everything that used to decide this says yes:
    expect(stale.attempt!.draftId).toBe(stale.draftId);
    expect(stale.attempt!.outcome).toBe("success");
    expect(stale.attempt!.contextFingerprint).toBe(stale.currentFingerprint);
    expect(stale.latestSuccessfulAttemptId).toBe(stale.attempt!.id);
    expect(stale.adoptedJourneyDigest).toBe(stale.attempt!.proposalDigest);
    // …and the authority gate refuses it anyway.
    expect(decideAdoptionReceipt(stale)).toEqual({ ok: false, reason: "proposal_no_longer_valid" });
  });

  it("G — a proposal generated under the CURRENT contract is accepted", () => {
    expect(decideAdoptionReceipt(claim())).toEqual({ ok: true });
  });

  it("an attempt that never recorded a version is refused, not waved through", () => {
    expect(decideAdoptionReceipt(claim({
      attempt: { id: ATTEMPT, draftId: DRAFT, outcome: "success", contextFingerprint: FP, proposalDigest: DIGEST, proposalVersion: null },
    }))).toEqual({ ok: false, reason: "proposal_no_longer_valid" });
  });

  it("H — a digest mismatch is still reported as ITSELF, not as a stale authority", () => {
    expect(decideAdoptionReceipt(claim({ adoptedJourneyDigest: "program_proposal_digest_v1:something-else" })))
      .toEqual({ ok: false, reason: "proposal_mismatch" });
    // …and a digest fault under an OLD authority still reports the identity fault first, so a
    // real mismatch is never hidden behind the newer rule.
    expect(decideAdoptionReceipt(claim({
      adoptedJourneyDigest: "program_proposal_digest_v1:something-else",
      attempt: { id: ATTEMPT, draftId: DRAFT, outcome: "success", contextFingerprint: FP, proposalDigest: DIGEST, proposalVersion: OLD_AUTHORITY },
    }))).toEqual({ ok: false, reason: "proposal_mismatch" });
  });

  it("I — stale-context protection is untouched and still reports its own reason", () => {
    expect(decideAdoptionReceipt(claim({ currentFingerprint: "the host changed the problem¦…" })))
      .toEqual({ ok: false, reason: "context_moved" });
  });

  it("every pre-existing refusal keeps its own meaning", () => {
    expect(decideAdoptionReceipt(claim({ attempt: null }))).toEqual({ ok: false, reason: "attempt_not_found" });
    expect(decideAdoptionReceipt(claim({ journeyInSamePatch: false }))).toEqual({ ok: false, reason: "no_journey_in_same_patch" });
    expect(decideAdoptionReceipt(claim({ latestSuccessfulAttemptId: "a-newer-one" }))).toEqual({ ok: false, reason: "superseded_attempt" });
    expect(decideAdoptionReceipt(claim({
      attempt: { id: ATTEMPT, draftId: DRAFT, outcome: "validation_refused", contextFingerprint: FP, proposalDigest: DIGEST, proposalVersion: PROGRAM_AUTHORSHIP_VERSION },
    }))).toEqual({ ok: false, reason: "attempt_not_successful" });
  });
});

describe("[3.2P-W4-R1] the acceptance contract version", () => {
  it("moved, because acceptance moved", () => {
        /*
      NOT RE-PINNED (Slice R4-R5C14A-R1). This literal was v24, and before that v23, v17, v11 —
      fourteen files edited on every composition change for an assertion that was never about the
      number. What it defends is the SPLIT: acceptance moved, so the authority version moved; the
      wire shape did not, so the schema name did not. v25 is R4-R5C14A, where THE STANDARD became
      the Host's own behaviour sentence and WHAT SUCCESS LOOKS LIKE became their own evidence.
    */
    expect(PROGRAM_AUTHORSHIP_VERSION).toMatch(/^program_authorship_v\d+$/);
    expect(programAuthorshipVersionNumber()).toBeGreaterThanOrEqual(25);
    expect(PROGRAM_AUTHORSHIP_VERSION).not.toBe(OLD_AUTHORITY);
    // Every version this pilot generated under is now stale: W2/W3 v9, W4 v10, W5 v11.
    for (const spent of ["program_authorship_v9", "program_authorship_v10", "program_authorship_v11", "program_authorship_v12", "program_authorship_v13", "program_authorship_v14", "program_authorship_v15", "program_authorship_v16", "program_authorship_v17", "program_authorship_v18", "program_authorship_v19", "program_authorship_v20", "program_authorship_v21"]) {
      expect(PROGRAM_AUTHORSHIP_VERSION).not.toBe(spent);
    }
  });

  it("C — it is NOT the deploy sha, so a cosmetic release keeps a Host's work", () => {
    /*
      A deploy sha changes for a doc edit, a UI tweak, a refactor — none of which can make an
      existing proposal unacceptable. Binding continuity to it would throw away valid unfinished
      work on every release. This string moves only when acceptance does.
    */
    expect(PROGRAM_AUTHORSHIP_VERSION).not.toMatch(/^[0-9a-f]{40}$/);
    expect(PROGRAM_AUTHORSHIP_VERSION).toMatch(/^program_authorship_v\d+$/);
  });

  it("N — history is not rewritten: W3 keeps the contract it was generated under", () => {
    // The ledger row still says v9; this gate reads it and refuses adoption. It does not turn a
    // recorded success into a refusal.
    const stale = claim({
      attempt: { id: ATTEMPT, draftId: DRAFT, outcome: "success", contextFingerprint: FP, proposalDigest: DIGEST, proposalVersion: OLD_AUTHORITY },
    });
    expect(stale.attempt!.outcome).toBe("success");
    expect(decideAdoptionReceipt(stale)).toEqual({ ok: false, reason: "proposal_no_longer_valid" });
  });
});
