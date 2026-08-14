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
  /**
   * The proposal was valid when it was generated and is not acceptable under the rules in force
   * now (Slice 3.2P-W4-R1). NOT `proposal_mismatch` — the identity is exact — and NOT
   * `context_moved`: the host changed nothing.
   */
  | "proposal_no_longer_valid"
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

/**
 * TWO MODES, ONE AUTHORITY (Slice 3.2L-R11.3A).
 *
 * `initial` — this request is claiming adoption. The journey must be in THIS patch, and the
 * claim must pass before the marker is allowed to become durable at all.
 *
 * `recovery` — the marker is ALREADY durable and the receipt never landed. A later save need
 * not resend the journey, because the journey is already on the row; everything else is
 * re-proved from durable state, including the exact proposal identity. The marker's mere
 * existence is never taken as evidence — a forged or legacy marker has to pass the same
 * seven checks as a fresh one.
 */
export type AdoptionMode = "initial" | "recovery";

export type AdoptionClaim = {
  mode: AdoptionMode;
  /** The attempt id the draft now carries. */
  claimedAttemptId: string;
  /** Did THIS request write the journey? Required for an `initial` claim only. */
  journeyInSamePatch: boolean;
  /** Does the row already carry a journey? The `recovery` mode's equivalent. */
  durableJourneyPresent: boolean;
  /** The attempt row, or null when the Host owns no such attempt. */
  attempt: {
    id: string;
    draftId: string;
    outcome: string;
    contextFingerprint: string;
    /** The exact proposal identity, or null when this attempt never recorded one. */
    proposalDigest: string | null;
    /**
     * The semantic acceptance contract this proposal was generated under (Slice 3.2P-W4-R1).
     * Null for an attempt predating the column's use.
     */
    proposalVersion: string | null;
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
  /** The acceptance contract in force NOW, from `PROGRAM_AUTHORSHIP_VERSION`. */
  currentAuthorityVersion: string;
  /**
   * Does this attempt ALREADY carry its `applied_at` receipt (Slice 3.2R-R8F)? Only a `recovery`
   * consults it, and only to stop re-deciding an adoption that is already complete.
   *
   * OPTIONAL, AND ABSENT MEANS "NO". A caller that cannot see the ledger gets the strict answer,
   * so the lenient branch is never reached by omission.
   */
  receiptAlreadyStamped?: boolean;
};

export type AdoptionDecision = { ok: true } | { ok: false; reason: AdoptionRefusal };

export function decideAdoptionReceipt(claim: AdoptionClaim): AdoptionDecision {
  /*
    An INITIAL claim must carry the journey it says it adopted. A RECOVERY has nothing left
    to prove on that point — the journey is already durable — and demanding it again is what
    made R11.2's receipt unrecoverable in practice.
  */
  if (claim.mode === "initial" ? !claim.journeyInSamePatch : !claim.durableJourneyPresent) {
    return { ok: false, reason: "no_journey_in_same_patch" };
  }
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

  /*
    STILL ACCEPTABLE TODAY (Slice 3.2P-W4-R1). Everything above proves IDENTITY — that this
    journey is what that generation produced. None of it proves VALIDITY, and those stopped
    being the same question the moment a semantic floor moved.

    MEASURED: W3 succeeded under `program_authorship_v9`, before the participant subject became
    server-written and before confirmer role-head authority existed. Its cached proposal names a
    learner population the host did not choose and a record keeper the source never mentioned,
    and every check above passes for it — same draft, success, fingerprint unchanged, newest
    attempt, digest exact. Only this refuses it.

    Deliberately LAST, so a genuine identity fault is still reported as one, and deliberately
    distinct from `proposal_mismatch`: nothing about this proposal changed. The rules did.
  */
  if (claim.attempt.proposalVersion !== claim.currentAuthorityVersion) {
    /*
      EXCEPT WHERE THERE IS NOTHING LEFT TO DECIDE (Slice 3.2R-R8F).

      The gate above asks "may this be adopted today?". A RECOVERY whose attempt already carries
      its `applied_at` receipt is not asking that. The adoption happened, the ledger recorded it,
      and a floor that moved afterwards cannot un-happen it — MEASURED on `093b0361`/`764411ae`,
      adopted under v9 with a byte-exact digest, which every later save re-judged against v22 and
      reported as refused.

      Deliberately the narrowest possible carve-out: recovery mode only, stamped receipt only, and
      strictly AFTER every identity check — so a receipt can never launder a marker that names
      another draft, another owner or another journey. An unstamped old proposal is still refused,
      and an initial claim can never reach here at all.
    */
    if (!(claim.mode === "recovery" && claim.receiptAlreadyStamped === true)) {
      return { ok: false, reason: "proposal_no_longer_valid" };
    }
  }
  return { ok: true };
}
