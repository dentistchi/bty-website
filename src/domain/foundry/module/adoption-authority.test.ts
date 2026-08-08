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
  mode: "initial",
  durableJourneyPresent: true,
  claimedAttemptId: V9,
  journeyInSamePatch: true,
  attempt: { id: V9, draftId: DRAFT, outcome: "success", contextFingerprint: FP, proposalDigest: null },
  draftId: DRAFT,
  currentFingerprint: FP,
  latestSuccessfulAttemptId: V9,
  adoptedJourneyDigest: null,
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
      attempt: { id: V1, draftId: DRAFT, outcome: "success", contextFingerprint: FP, proposalDigest: null },
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
    const claim = base({ attempt: { id: V9, draftId: "other-draft", outcome: "success", contextFingerprint: FP, proposalDigest: null } });
    expect(decideAdoptionReceipt(claim)).toEqual({ ok: false, reason: "attempt_other_draft" });
  });

  it("a refusal or in-flight attempt produced no proposal to adopt", () => {
    for (const outcome of ["validation_refused", "provider_error", "timeout", "started"]) {
      const claim = base({ attempt: { id: V9, draftId: DRAFT, outcome, contextFingerprint: FP, proposalDigest: null } });
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

describe("[3.2L-R11.3] exact proposal identity", () => {
  const D = `program_proposal_digest_v1:${"a".repeat(64)}`;
  const OTHER = `program_proposal_digest_v1:${"b".repeat(64)}`;

  it("A: the exact generated proposal with its own attempt is accepted", () => {
    expect(decideAdoptionReceipt(base({
      attempt: { id: V9, draftId: DRAFT, outcome: "success", contextFingerprint: FP, proposalDigest: D },
      adoptedJourneyDigest: D,
    }))).toEqual({ ok: true });
  });

  it("B/C: any journey that is not that proposal is refused", () => {
    expect(decideAdoptionReceipt(base({
      attempt: { id: V9, draftId: DRAFT, outcome: "success", contextFingerprint: FP, proposalDigest: D },
      adoptedJourneyDigest: OTHER,
    }))).toEqual({ ok: false, reason: "proposal_mismatch" });
  });

  it("G10: an attempt that never recorded its proposal cannot be bound", () => {
    // NULL means "not recorded" — never "close enough". This is the state every one of the
    // five historical successes is in, 15108cf3 included.
    expect(decideAdoptionReceipt(base({
      attempt: { id: V9, draftId: DRAFT, outcome: "success", contextFingerprint: FP, proposalDigest: null },
      adoptedJourneyDigest: D,
    }))).toEqual({ ok: false, reason: "proposal_mismatch" });
  });

  it("D: predicate ordering is deterministic — recency is judged before content", () => {
    expect(decideAdoptionReceipt(base({
      claimedAttemptId: V1,
      attempt: { id: V1, draftId: DRAFT, outcome: "success", contextFingerprint: FP, proposalDigest: OTHER },
      latestSuccessfulAttemptId: V9,
      adoptedJourneyDigest: D,
    }))).toEqual({ ok: false, reason: "superseded_attempt" });
  });

  it("E/F/G/H: the earlier predicates still win, and are not weakened by the digest", () => {
    const withDigest = { adoptedJourneyDigest: D };
    expect(decideAdoptionReceipt(base({ ...withDigest, attempt: null }))).toEqual({ ok: false, reason: "attempt_not_found" });
    expect(decideAdoptionReceipt(base({ ...withDigest, journeyInSamePatch: false }))).toEqual({ ok: false, reason: "no_journey_in_same_patch" });
    expect(decideAdoptionReceipt(base({
      ...withDigest,
      attempt: { id: V9, draftId: DRAFT, outcome: "success", contextFingerprint: FP, proposalDigest: D },
      currentFingerprint: "moved", latestSuccessfulAttemptId: null,
    }))).toEqual({ ok: false, reason: "context_moved" });
    expect(decideAdoptionReceipt(base({
      ...withDigest,
      attempt: { id: V9, draftId: DRAFT, outcome: "validation_refused", contextFingerprint: FP, proposalDigest: D },
    }))).toEqual({ ok: false, reason: "attempt_not_successful" });
  });

  it("I/L: the same exact claim replays identically, however it arrives", () => {
    const claim = base({
      attempt: { id: V9, draftId: DRAFT, outcome: "success", contextFingerprint: FP, proposalDigest: D },
      adoptedJourneyDigest: D,
    });
    for (let i = 0; i < 3; i++) expect(decideAdoptionReceipt(claim)).toEqual({ ok: true });
  });

  it("K: a forged marker cannot ripen into a receipt through a later generic save", () => {
    // A later save writes no journey, so the first predicate refuses it forever.
    expect(decideAdoptionReceipt(base({ journeyInSamePatch: false, adoptedJourneyDigest: null }))).toEqual({
      ok: false, reason: "no_journey_in_same_patch",
    });
  });
});

describe("[3.2L-R11.3A] initial claim vs receipt recovery", () => {
  const D = `program_proposal_digest_v1:${"a".repeat(64)}`;
  const OTHER = `program_proposal_digest_v1:${"b".repeat(64)}`;
  const good = { id: V9, draftId: DRAFT, outcome: "success", contextFingerprint: FP, proposalDigest: D };

  it("G8: an INITIAL claim must carry the journey it says it adopted", () => {
    expect(decideAdoptionReceipt(base({ mode: "initial", journeyInSamePatch: false, durableJourneyPresent: true }))).toEqual({
      ok: false,
      reason: "no_journey_in_same_patch",
    });
  });

  it("G5: RECOVERY does not need the journey resent — the row already has it", () => {
    // This is what R11.2 silently broke: with the predicate keyed to the REQUEST, a later
    // generic save could never complete a receipt, so matrix J was unreachable in the code.
    expect(decideAdoptionReceipt(base({
      mode: "recovery",
      journeyInSamePatch: false,
      durableJourneyPresent: true,
      attempt: good,
      adoptedJourneyDigest: D,
    }))).toEqual({ ok: true });
  });

  it("recovery still needs A journey — a marker on a journey-less row proves nothing", () => {
    expect(decideAdoptionReceipt(base({ mode: "recovery", journeyInSamePatch: false, durableJourneyPresent: false }))).toEqual({
      ok: false,
      reason: "no_journey_in_same_patch",
    });
  });

  it("G6/G7: recovery re-proves identity against the DURABLE journey", () => {
    // A forged or legacy marker beside a journey that is not that proposal cannot recover.
    expect(decideAdoptionReceipt(base({
      mode: "recovery", journeyInSamePatch: false, durableJourneyPresent: true,
      attempt: good, adoptedJourneyDigest: OTHER,
    }))).toEqual({ ok: false, reason: "proposal_mismatch" });
  });

  it("G9: recovery weakens no other predicate", () => {
    const rec = { mode: "recovery" as const, journeyInSamePatch: false, durableJourneyPresent: true, adoptedJourneyDigest: D };
    expect(decideAdoptionReceipt(base({ ...rec, attempt: null }))).toEqual({ ok: false, reason: "attempt_not_found" });
    expect(decideAdoptionReceipt(base({ ...rec, attempt: { ...good, draftId: "other" } }))).toEqual({ ok: false, reason: "attempt_other_draft" });
    expect(decideAdoptionReceipt(base({ ...rec, attempt: { ...good, outcome: "validation_refused" } }))).toEqual({ ok: false, reason: "attempt_not_successful" });
    expect(decideAdoptionReceipt(base({ ...rec, attempt: good, currentFingerprint: "moved", latestSuccessfulAttemptId: null }))).toEqual({ ok: false, reason: "context_moved" });
    expect(decideAdoptionReceipt(base({ ...rec, attempt: { ...good, id: V1 }, claimedAttemptId: V1, latestSuccessfulAttemptId: V9 }))).toEqual({ ok: false, reason: "superseded_attempt" });
  });

  it("N: an authority refusal never becomes a receipt because time passed", () => {
    // The refused claim's marker is never persisted, so there is nothing to recover FROM.
    // And even if a marker existed, recovery re-proves everything.
    expect(decideAdoptionReceipt(base({ mode: "recovery", journeyInSamePatch: false, durableJourneyPresent: true, attempt: { ...good, proposalDigest: OTHER }, adoptedJourneyDigest: D }))).toEqual({
      ok: false,
      reason: "proposal_mismatch",
    });
  });
});
