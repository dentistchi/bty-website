/**
 * WHO MAY RECEIVE AN ADOPTION RECEIPT (Slice 3.2L-R11.2).
 *
 * R11.1 made the receipt recoverable; it did not make it PROVABLE. The server stamped any
 * attempt id the draft carried, checking only that it was a UUID owned by the Host. That is
 * necessary and nowhere near sufficient: the canonical draft has FIVE successful attempts
 * sharing one context fingerprint, so a stale, buggy or hostile client could adopt the v9
 * journey and name a v1 proposal from days earlier, and the ledger would agree.
 *
 * The attempts table was designed for this. Its own migration says of `context_fingerprint`:
 * "a proposal whose fingerprint no longer matches may not be applied." Nothing enforced it.
 *
 * Everything below is decided from data that already exists — no new column, no migration,
 * and no trust in the client beyond the id it names.
 */

/** Why a claimed adoption may not be stamped. Closed vocabulary, never prose. */
export type AdoptionRefusal =
  /** The request named an attempt without also writing the journey it claims to have adopted. */
  | "no_journey_in_same_patch"
  /** No such attempt for this Host. */
  | "attempt_not_found"
  /** The attempt belongs to a different draft. */
  | "attempt_other_draft"
  /** The attempt never produced a proposal to adopt. */
  | "attempt_not_successful"
  /** The Host's answers moved after the proposal was written. */
  | "context_moved"
  /** An older sibling proposal cannot be stamped while a newer one exists for the same inputs. */
  | "superseded_attempt"
  /**
   * The journey being adopted is not the proposal that attempt generated — or that attempt
   * never durably recorded what it generated, so the claim cannot be proved at all
   * (Slice 3.2L-R11.3).
   */
  | "proposal_mismatch";

export type AdoptionClaim = {
  /** The attempt id the draft now carries. */
  claimedAttemptId: string;
  /** Did THIS request write the journey? A marker alone adopts nothing. */
  journeyInSamePatch: boolean;
  /** The attempt row, or null when the Host owns no such attempt. */
  attempt: {
    id: string;
    draftId: string;
    outcome: string;
    contextFingerprint: string;
    /** The exact proposal identity, or null when this attempt never recorded one. */
    proposalDigest: string | null;
  } | null;
  /** This draft's identity, recomputed by the server from its own stored answers. */
  draftId: string;
  currentFingerprint: string;
  /**
   * The most recent SUCCESSFUL attempt for this draft at this fingerprint. The review
   * surface holds one proposal at a time and generating again replaces it, so the proposal
   * a Host can be looking at is always the newest one — naming an older sibling is not
   * something the product can produce.
   */
  latestSuccessfulAttemptId: string | null;
  /**
   * The identity of the journey THIS request wrote, computed server-side. Null when the
   * exact-identity authority is not yet in force, which keeps the R11.2 predicates as the
   * complete set rather than silently weakening them.
   */
  adoptedJourneyDigest: string | null;
};

export type AdoptionDecision = { ok: true } | { ok: false; reason: AdoptionRefusal };

export function decideAdoptionReceipt(claim: AdoptionClaim): AdoptionDecision {
  if (!claim.journeyInSamePatch) return { ok: false, reason: "no_journey_in_same_patch" };
  if (claim.attempt === null) return { ok: false, reason: "attempt_not_found" };
  if (claim.attempt.draftId !== claim.draftId) return { ok: false, reason: "attempt_other_draft" };
  if (claim.attempt.outcome !== "success") return { ok: false, reason: "attempt_not_successful" };
  /*
    The stale-context authority the schema always intended, enforced on the SERVER. The
    client's fingerprint gate protects the ordinary path; client enforcement is not server
    authority, and a direct request bypasses it entirely.
  */
  if (claim.attempt.contextFingerprint !== claim.currentFingerprint) return { ok: false, reason: "context_moved" };
  if (claim.latestSuccessfulAttemptId !== null && claim.latestSuccessfulAttemptId !== claim.attempt.id) {
    return { ok: false, reason: "superseded_attempt" };
  }
  /*
    THE EXACT CLAIM (Slice 3.2L-R11.3). Everything above proves the receipt names the newest
    successful generation for these inputs; only this proves the journey being adopted IS
    what that generation produced. An attempt with no recorded identity cannot satisfy it —
    null means "never recorded", never "close enough".
  */
  if (claim.adoptedJourneyDigest !== null) {
    if (claim.attempt.proposalDigest === null) return { ok: false, reason: "proposal_mismatch" };
    if (claim.attempt.proposalDigest !== claim.adoptedJourneyDigest) return { ok: false, reason: "proposal_mismatch" };
  }
  return { ok: true };
}
