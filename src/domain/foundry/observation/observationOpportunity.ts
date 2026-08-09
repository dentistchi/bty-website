/**
 * AVAILABLE REVIEW WORK, NOT A TASK (Slice 3.2N).
 *
 * 3.2M-4 and 3.2M-5 built an observation engine nobody could find: the page worked, and no
 * product path led to it. This is the discovery half — and the whole difficulty is saying what
 * the item IS without overclaiming.
 *
 * An ACTION_REVIEWER edge is PERMISSION, not assignment. Nothing was requested, nothing is
 * owed, and no date exists anywhere in the chain — 3.2M-5 deliberately added no scheduler. So
 * an observation opportunity is AVAILABLE work: it stands open because someone is authorised
 * and a behaviour was published, not because anyone is late.
 *
 * That is why no state here carries urgency, no state produces a deadline, and none of these
 * items may ever be rendered as something to miss. The same reasoning is already encoded in
 * `todayReminders`, which refuses to build REVIEW_DUE precisely because no canonical dated
 * per-participant source exists and the engine must never invent a deadline.
 */
import type { SustainedEvidence } from "./sustainedEvidence";

/**
 * What must be true before a reviewer may be shown an opportunity at all.
 *
 * Deliberately NOT here: the learner's APPLIED report, a completed practice, an existing
 * observation, an established span, the obligation's PENDING/RESPONDED status, or any request
 * from anyone. Observation is an independent source, and gating it on the learner's own words
 * would discard a true sighting because the learner had not got round to reporting.
 */
export type OpportunityFacts = {
  /** The edge resolver's verdict for this reviewer → this learner. Re-resolved per candidate. */
  readonly authorityAllowed: boolean;
  /** The canonical follow-up obligation exists (it is what binds learner + event + training). */
  readonly obligationExists: boolean;
  /** From `foundry_participant_followups.user_id_snapshot` — never from the caller. */
  readonly learnerUserId: string | null;
  /** The frozen, grounded observable_standard. Null → no observation path, so no opportunity. */
  readonly observableStandard: string | null;
};

/** Is there anything here for this reviewer to do? Total and pure. */
export function isObservationOpportunity(f: OpportunityFacts): boolean {
  if (!f.authorityAllowed) return false;
  if (!f.obligationExists) return false;
  if (!f.learnerUserId) return false;
  return typeof f.observableStandard === "string" && f.observableStandard.trim().length > 0;
}

/**
 * The five human-facing states. Every one of them is AVAILABLE — the difference is only what
 * the reviewer is told has happened so far.
 *
 * `not_seen` exists as its own state so a colleague who honestly reported they did not see
 * something is never shown the same blank prompt as someone who has said nothing. It is not a
 * failure, and nothing in the copy derived from it may suggest one: they may simply not have
 * been there, which is exactly why NOT_OBSERVED establishes nothing in either direction.
 */
export type OpportunityState = "none" | "not_seen" | "seen_once" | "seen_repeatedly" | "sustained";

export type ObservationOpportunityView = {
  readonly state: OpportunityState;
  /** Earliest / latest positive OCCURRENCE date, when there is one. Never a filing timestamp. */
  readonly firstObservedOn: string | null;
  readonly lastObservedOn: string | null;
  /** Distinct days it was positively seen. The thing that is counted — never the row count. */
  readonly positiveDates: number;
};

/**
 * Derive the state from the SAME longitudinal evidence the Host surface reads.
 *
 * Taking `SustainedEvidence` rather than raw rows is deliberate: it means the reviewer's card
 * and the Host's line can never disagree about whether something was sustained, because there
 * is one derivation and both read its output.
 */
export function observationOpportunityView(evidence: SustainedEvidence): ObservationOpportunityView {
  const positiveDates = evidence.distinctPositiveDates.length;
  const state: OpportunityState = evidence.sustained
    ? "sustained"
    : positiveDates >= 2
      ? "seen_repeatedly"
      : positiveDates === 1
        ? "seen_once"
        : // Nothing positive. Someone may still have looked and honestly seen nothing.
          evidence.contradictions.length > 0
          ? "not_seen"
          : "none";
  return {
    state,
    firstObservedOn: evidence.firstObservedOn,
    lastObservedOn: evidence.lastObservedOn,
    positiveDates,
  };
}

/**
 * NONE OF THESE STATES IS URGENT — asserted in code so a future caller cannot quietly promote
 * an opportunity into a deadline. There is no ordering by lateness here for the same reason:
 * nothing is late.
 */
export function opportunityDemandsAttention(_state: OpportunityState): false {
  return false;
}

/**
 * Deterministic display order: the ones with the least evidence first, because those are where
 * a sighting would tell the product something it does not already know. Stable id tie-break, so
 * two reloads never shuffle the list.
 */
const STATE_RANK: Record<OpportunityState, number> = {
  none: 0,
  not_seen: 1,
  seen_once: 2,
  seen_repeatedly: 3,
  sustained: 4,
};

export function orderObservationOpportunities<T extends { state: OpportunityState; followupId: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || a.followupId.localeCompare(b.followupId),
  );
}
