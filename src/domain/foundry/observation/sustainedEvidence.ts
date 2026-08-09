/**
 * SUSTAINED — REPETITION OVER TIME, DERIVED AND NEVER STORED (Slice 3.2M-5).
 *
 * OBSERVED asks "did anyone see it?" and is answered by a single attestation. SUSTAINED asks
 * a different question — "did it keep happening?" — and no number of answers to the first
 * question can answer the second. `observationEstablished` says so in as many words, and this
 * file is the separate contract it defers to.
 *
 * THE PREDICATE, in full:
 *
 *   positive OBSERVED attestations
 *   about the SAME immutable behaviour (same published event + byte-identical standard)
 *   on at least TWO DISTINCT OCCURRENCE DATES
 *   whose span is at least that training's OWN authored followUpDays (7 or 30)
 *
 * Every clause earns its place:
 *
 * OCCURRENCE DATES, NOT ROWS. Three attestations filed in one afternoon are one sighting
 * reported three times. Row count is never the predicate.
 *
 * OCCURRENCE DATES, NOT SUBMISSION TIMES. `submittedAt` is when the observer got round to
 * telling us. Deriving persistence from it would measure their admin habits.
 *
 * THE TRAINING'S OWN WINDOW. The threshold is not a number invented here — it is the Host's
 * authored follow-up checkpoint, the only temporal constant this product owns. A training
 * that authored no follow-up window (followUpDays = 0) has no threshold, so nothing about it
 * can be called sustained; inventing a default would be inventing the standard.
 *
 * OBSERVER COUNT IS NOT A CLAUSE. One person seeing the same behaviour on two qualifying
 * dates establishes it; three people seeing it once on one day does not. Corroboration and
 * persistence are different properties, and only the second is what SUSTAINED means. The
 * distinct-observer count is still reported — as description, never as a gate.
 *
 * WHAT MAY NEVER FEED THIS: the learner's own APPLIED report, Arena practice, XP, QR scans,
 * attendance. This function's only input is independent human attestation, which is the
 * canonical `manager_observation` ceiling on the verified-behaviour rungs.
 *
 * PURE. No clock, no I/O. A derivation that read `Date.now()` would give a different answer
 * on Tuesday than on Monday for the same evidence, and could never be proven by a test.
 */
import { establishesObservation, type ObservationFact, type ObservationOutcome } from "./behaviorObservation";

/**
 * One attestation, with the identity of the behaviour it was made about.
 *
 * The identity travels WITH the fact rather than being assumed from the query that fetched
 * it, so this function can refuse a mismatched row instead of trusting its caller's join.
 */
export type SustainedObservationFact = ObservationFact & {
  /** The published event the attestation belongs to. */
  readonly eventId: string;
  /** The frozen observable_standard as copied at submission — byte-compared, never fuzzy-matched. */
  readonly observedStandardSnapshot: string;
};

/**
 * The one behaviour a sustained claim may be about.
 *
 * V1 IS EXACT-VERSION ONLY. A new module version is a new event with its own snapshot, and no
 * authority anywhere in this repository can decide whether v1's "state each unfinished item
 * and its next owner" and v2's "…and due date" are the same behaviour. Until such an authority
 * exists, combining them would be a claim nobody made. `program_id` groups versions and says
 * nothing about behavioural equivalence, so it is deliberately not consulted here.
 */
export type SustainedScope = {
  readonly eventId: string;
  /** The frozen observable_standard for that event. */
  readonly observableStandard: string;
  /** The training's own authored checkpoint. 0 / absent → no threshold exists → never sustained. */
  readonly followUpDays: number;
};

/** A non-positive attestation, kept visible. Never subtracted from anything. */
export type ObservationContradiction = {
  readonly outcome: ObservationOutcome;
  readonly observerUserId: string;
  readonly observedOn: string;
};

export type SustainedEvidence = {
  /** The rung. Derived here or nowhere. */
  readonly sustained: boolean;
  /** Earliest positive OCCURRENCE date in scope, or null. */
  readonly firstObservedOn: string | null;
  /** Latest positive OCCURRENCE date in scope, or null. */
  readonly lastObservedOn: string | null;
  /** Whole calendar days between first and last positive occurrence. null when fewer than one. */
  readonly spanDays: number | null;
  /** The distinct days the behaviour was positively seen, ascending. The thing that is counted. */
  readonly distinctPositiveDates: readonly string[];
  /** Description only. Never a threshold. */
  readonly distinctPositiveObservers: readonly string[];
  /** NOT_OBSERVED / UNABLE_TO_TELL in scope, ascending by occurrence date. Preserved, never netted. */
  readonly contradictions: readonly ObservationContradiction[];
  /**
   * Attestations discarded because they were about a DIFFERENT behaviour (other event, or a
   * standard that is not byte-identical). Surfaced rather than silently dropped, so a caller
   * that mis-scoped its query finds out.
   */
  readonly outOfScope: number;
};

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** A well-formed BTY day key? Anything else is not a date this may reason about. */
function isDayKey(v: unknown): v is string {
  return typeof v === "string" && DAY_KEY.test(v);
}

/**
 * Whole calendar days from `a` to `b`, both "YYYY-MM-DD".
 *
 * The same UTC-calendar technique `addDaysToDayKey` uses (Slice 3.1B-3K): day keys are already
 * resolved into the canonical local frame before they are stored, so the arithmetic on them is
 * plain calendar arithmetic and must NOT re-apply a timezone. `Date.UTC` is pure — it is not
 * `Date.now()` — so this stays clock-free.
 */
export function dayKeySpanDays(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

const EMPTY: SustainedEvidence = {
  sustained: false,
  firstObservedOn: null,
  lastObservedOn: null,
  spanDays: null,
  distinctPositiveDates: [],
  distinctPositiveObservers: [],
  contradictions: [],
  outOfScope: 0,
};

/**
 * Does this evidence establish SUSTAINED, and what exactly is the evidence?
 *
 * Returns the working as well as the verdict: a Host is told a span and two dates, not a
 * boolean they have to trust. Nothing here mutates or orders the caller's array.
 */
export function deriveSustainedEvidence(
  facts: readonly SustainedObservationFact[],
  scope: SustainedScope,
): SustainedEvidence {
  // Same behaviour, proved rather than assumed: the exact published event AND the exact
  // sentence the observer read. Similar prose is never the same behaviour.
  const inScope = facts.filter(
    (f) => f.eventId === scope.eventId && f.observedStandardSnapshot === scope.observableStandard,
  );
  const outOfScope = facts.length - inScope.length;

  const positives = inScope.filter((f) => establishesObservation(f.outcome) && isDayKey(f.observedOn));
  const contradictions = inScope
    .filter((f) => !establishesObservation(f.outcome) && isDayKey(f.observedOn))
    .map((f) => ({ outcome: f.outcome, observerUserId: f.observerUserId, observedOn: f.observedOn }))
    .sort((x, y) => x.observedOn.localeCompare(y.observedOn));

  if (positives.length === 0) return { ...EMPTY, contradictions, outOfScope };

  // Day keys are fixed-width and zero-padded, so lexical order IS chronological order.
  const distinctPositiveDates = [...new Set(positives.map((f) => f.observedOn))].sort();
  const distinctPositiveObservers = [...new Set(positives.map((f) => f.observerUserId))];
  const firstObservedOn = distinctPositiveDates[0]!;
  const lastObservedOn = distinctPositiveDates[distinctPositiveDates.length - 1]!;
  const spanDays = dayKeySpanDays(firstObservedOn, lastObservedOn);

  /*
    The threshold is the training's own. A checkpoint of 0 (or a corrupt value) means the Host
    never authored a window, so there is no elapsed period this program considers meaningful
    and no honest sustained claim exists for it — not even across a year.
  */
  const hasThreshold = Number.isInteger(scope.followUpDays) && scope.followUpDays > 0;
  const sustained = hasThreshold && distinctPositiveDates.length >= 2 && spanDays >= scope.followUpDays;

  return {
    sustained,
    firstObservedOn,
    lastObservedOn,
    // A single positive date has no span to report; null says "not applicable", not "zero days".
    spanDays: distinctPositiveDates.length >= 2 ? spanDays : null,
    distinctPositiveDates,
    distinctPositiveObservers,
    contradictions,
    outOfScope,
  };
}
