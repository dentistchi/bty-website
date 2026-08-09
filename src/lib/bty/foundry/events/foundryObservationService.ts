import type { SupabaseClient } from "@supabase/supabase-js";
import { journeyObservableStandard, type RealityGroundedJourneyV1 } from "@/domain/foundry/module/journey";
import {
  isObservationOutcome,
  observationEstablished,
  type ObservationFact,
  type ObservationOutcome,
} from "@/domain/foundry/observation/behaviorObservation";
import {
  deriveSustainedEvidence,
  type SustainedEvidence,
  type SustainedObservationFact,
} from "@/domain/foundry/observation/sustainedEvidence";
import { userDayKey } from "@/domain/daily/userDayKey";
import { isValidIanaTz } from "@/lib/bty/daily/userDay";
import { resolveEdgeAuthority } from "@/lib/bty/arena/actionReviewAuthorityResolver.server";

/**
 * INDEPENDENT OBSERVATION OF A GUIDED BEHAVIOUR (Slice 3.2M-4).
 *
 * The follow-up obligation is the parent because it already binds the learner, the event and
 * the published training — the lineage 3.2M-3 proved. The observer is authorised by the SAME
 * explicit non-self reviewer edge the action-review path uses; no new organisation rules are
 * invented here, and possession of a URL grants nothing.
 *
 * Everything this file returns to an observer is deliberately thin. They get who they are
 * observing and the frozen standard to watch for — never the learner's reflection, decision,
 * shared answer, follow-up outcome or Arena history. An observation biased by reading the
 * learner's own claim is not independent.
 */
const OBSERVATIONS = "foundry_behavior_observations";

/**
 * A stored attestation. Carries the standard it was made about (Slice 3.2M-5) so a temporal
 * claim can prove the repeated evidence is about the SAME behaviour rather than assume it.
 */
export type StoredObservation = ObservationFact & { observedStandardSnapshot: string };

export type ObservationRequest = {
  followupId: string;
  learnerDisplayName: string;
  /** The frozen observable_standard — what the observer is asked to have seen or heard. */
  observableStandard: string;
  /**
   * The latest date this observer may report (Slice 3.2M-5) — today, in the CANONICAL
   * obligation timezone. The client renders it as the date control's max; the server checks it
   * again, because a max attribute is a courtesy and not a rule.
   */
  maxObservedOn: string;
  /** This observer's own prior reports, oldest first by occurrence date. Never anyone else's. */
  myObservations: { outcome: ObservationOutcome; observedOn: string; submittedAt: string }[];
};

export type ObservationUnavailable =
  | "not_found"
  | "not_authorized"
  | "no_observable_standard";

export type SubmitObservationResult =
  | { ok: true; outcome: ObservationOutcome; observedOn: string; created: boolean }
  | { ok: false; reason: ObservationUnavailable | "invalid_outcome" | "invalid_date" | "future_date" | "error" };

type ObligationRow = {
  id: string;
  event_id: string | null;
  user_id_snapshot: string;
  follow_up_days: number;
  timezone_snapshot: string | null;
};

async function loadObligation(admin: SupabaseClient, followupId: string): Promise<ObligationRow | null> {
  if (!followupId) return null;
  const { data } = await admin
    .from("foundry_participant_followups")
    .select("id, event_id, user_id_snapshot, follow_up_days, timezone_snapshot")
    .eq("id", followupId)
    .maybeSingle<ObligationRow>();
  return data ?? null;
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * WHOSE CLOCK DECIDES WHAT "TODAY" IS (Slice 3.2M-5).
 *
 * The canonical obligation's `timezone_snapshot` — the frame the learner's own completion day
 * and due date were already resolved in. NOT the observer's device: a timezone sent by the
 * client is a request, and letting it decide the day boundary would let anyone widen their own
 * submission window by changing a phone setting. Falls back to UTC only when the stored
 * snapshot is missing or not a valid IANA id, exactly as `resolveUserTzContext` does.
 */
function obligationTimezone(ob: ObligationRow): string {
  return isValidIanaTz(ob.timezone_snapshot) ? ob.timezone_snapshot : "UTC";
}

/** Today's BTY day key in the obligation's frame — the latest occurrence date anyone may report. */
function latestReportableDay(ob: ObligationRow, now: Date): string {
  return userDayKey(now, obligationTimezone(ob), 5);
}

/**
 * The exact sentence the observer evaluates, from the immutable published snapshot.
 *
 * NO fallback. A training with no grounded observable_standard offers no observation path at
 * all — inventing a criterion from the completion prompt or the field application would be
 * asking someone to attest to a standard nobody ever published.
 */
async function loadObservableStandard(admin: SupabaseClient, eventId: string | null): Promise<string | null> {
  if (!eventId) return null;
  const { data } = await admin
    .from("foundry_event_module")
    .select("module_snapshot")
    .eq("event_id", eventId)
    .maybeSingle<{ module_snapshot: { realityGroundedJourneyV1?: RealityGroundedJourneyV1 } | null }>();
  return journeyObservableStandard(data?.module_snapshot?.realityGroundedJourneyV1);
}

/**
 * Every submitted observation for this obligation, in OCCURRENCE order. Append-only by
 * construction.
 *
 * Ordered by `observed_on` rather than `submitted_at` (Slice 3.2M-5): an observer who reports
 * two sightings out of order — last month's on Tuesday, last week's on Wednesday — described a
 * sequence of events, and the list is about the events.
 */
export async function listObservations(
  admin: SupabaseClient,
  followupId: string,
): Promise<StoredObservation[]> {
  if (!followupId) return [];
  const { data } = await admin
    .from(OBSERVATIONS)
    .select("outcome, observer_user_id, observed_on, submitted_at, observed_standard_snapshot")
    .eq("followup_id", followupId);
  return (
    (data ?? []) as Array<{
      outcome: string;
      observer_user_id: string;
      observed_on: string | null;
      submitted_at: string;
      observed_standard_snapshot: string | null;
    }>
  )
    .filter((r) => isObservationOutcome(r.outcome))
    .map((r) => ({
      outcome: r.outcome as ObservationOutcome,
      observerUserId: r.observer_user_id,
      // NOT NULL in the schema; the coalesce keeps a reader from throwing on a row shape it did
      // not expect, and an empty key can never satisfy the temporal predicate.
      observedOn: r.observed_on ?? "",
      // `submitted_at` is NOT NULL with a default — belt-and-braces for the same reason.
      submittedAt: r.submitted_at ?? "",
      observedStandardSnapshot: r.observed_standard_snapshot ?? "",
    }))
    .sort((a, b) => a.observedOn.localeCompare(b.observedOn) || a.submittedAt.localeCompare(b.submittedAt));
}

/** Has anyone authorised positively observed this behaviour? The OBSERVED rung, derived. */
export async function hasIndependentObservation(admin: SupabaseClient, followupId: string): Promise<boolean> {
  return observationEstablished(await listObservations(admin, followupId));
}

/**
 * Bind stored attestations to the behaviour they are about, then derive SUSTAINED (3.2M-5).
 *
 * The identity is assembled here, from the obligation and the frozen snapshot, and passed INTO
 * the pure derivation — which re-checks it per fact and discards anything that does not match.
 * A training with no grounded observable_standard has no observation path at all, so it also
 * has no sustained path; that returns an empty result rather than a fabricated one.
 */
export async function getSustainedEvidence(
  admin: SupabaseClient,
  followupId: string,
): Promise<SustainedEvidence> {
  const empty = deriveSustainedEvidence([], { eventId: "", observableStandard: "", followUpDays: 0 });
  const ob = await loadObligation(admin, followupId);
  if (!ob || !ob.event_id) return empty;
  const standard = await loadObservableStandard(admin, ob.event_id);
  if (!standard) return empty;

  const facts: SustainedObservationFact[] = (await listObservations(admin, followupId)).map((o) => ({
    ...o,
    // Every observation of this obligation belongs to this obligation's event, by FK.
    eventId: ob.event_id!,
  }));
  return deriveSustainedEvidence(facts, {
    eventId: ob.event_id,
    observableStandard: standard,
    followUpDays: ob.follow_up_days,
  });
}

/**
 * What an authorised observer may see. Returns a refusal — never a partial page — when the
 * caller has no authority, so an unauthorised person cannot learn that the request exists.
 */
export async function getObservationRequest(
  admin: SupabaseClient,
  observerUserId: string,
  followupId: string,
  now: Date = new Date(),
): Promise<{ ok: true; value: ObservationRequest } | { ok: false; reason: ObservationUnavailable }> {
  const ob = await loadObligation(admin, followupId);
  if (!ob) return { ok: false, reason: "not_found" };

  // The learner comes from the obligation, never from the caller.
  const authority = await resolveEdgeAuthority(admin, {
    actorUserId: observerUserId,
    learnerUserId: ob.user_id_snapshot,
  });
  // A refusal is indistinguishable from a missing request on purpose.
  if (!authority.allowed) return { ok: false, reason: "not_authorized" };

  const standard = await loadObservableStandard(admin, ob.event_id);
  if (!standard) return { ok: false, reason: "no_observable_standard" };

  const { data: learner } = await admin
    .from("foundry_event_participants")
    .select("display_name")
    .eq("event_id", ob.event_id)
    .limit(1)
    .maybeSingle<{ display_name: string }>();

  const mine = (await listObservations(admin, followupId)).filter((o) => o.observerUserId === observerUserId);

  return {
    ok: true,
    value: {
      followupId: ob.id,
      learnerDisplayName: learner?.display_name ?? "",
      observableStandard: standard,
      maxObservedOn: latestReportableDay(ob, now),
      myObservations: mine.map((o) => ({
        outcome: o.outcome,
        observedOn: o.observedOn,
        submittedAt: o.submittedAt,
      })),
    },
  };
}

/**
 * Record one observation of one OCCURRENCE.
 *
 * THE IDEMPOTENCY BOUNDARY CHANGED IN 3.2M-5, AND HAD TO.
 *
 * 3.2M-4 compared a new report only against that observer's LAST answer, so the same person
 * answering "yes, I saw it" again a week later wrote nothing at all. That is right for a double
 * tap and catastrophic for a slice about repetition: consistency — the very thing SUSTAINED
 * measures — was the one pattern the service refused to store, while disagreement was kept.
 *
 * The boundary is now the OCCURRENCE EPISODE: (this obligation, this observer, this date, this
 * answer). So —
 *   same date, same answer      a retry or a double tap. Nothing written, `created: false`.
 *   later date, same answer     a genuine second sighting. Appended.
 *   same date, changed answer   a separate fact, appended beside the first exactly as before;
 *                               an observer who corrects themselves is never overwritten.
 *
 * The database enforces the same rule with a unique index, so a concurrent duplicate loses on
 * the write rather than on the read — two devices submitting at once cannot both slip through.
 */
export async function submitObservation(
  admin: SupabaseClient,
  observerUserId: string,
  followupId: string,
  outcome: unknown,
  observedOn: unknown,
  now: Date = new Date(),
): Promise<SubmitObservationResult> {
  if (!isObservationOutcome(outcome)) return { ok: false, reason: "invalid_outcome" };
  if (typeof observedOn !== "string" || !DAY_KEY.test(observedOn)) return { ok: false, reason: "invalid_date" };
  // Reject a shape-valid impossible date ("2026-02-31") before it becomes a stored fact.
  const [y, mo, d] = observedOn.split("-").map(Number);
  const round = new Date(Date.UTC(y, mo - 1, d));
  if (round.getUTCFullYear() !== y || round.getUTCMonth() + 1 !== mo || round.getUTCDate() !== d) {
    return { ok: false, reason: "invalid_date" };
  }

  const request = await getObservationRequest(admin, observerUserId, followupId, now);
  if (!request.ok) return { ok: false, reason: request.reason };

  const ob = await loadObligation(admin, followupId);
  if (!ob) return { ok: false, reason: "not_found" };

  const authority = await resolveEdgeAuthority(admin, {
    actorUserId: observerUserId,
    learnerUserId: ob.user_id_snapshot,
  });
  if (!authority.allowed) return { ok: false, reason: "not_authorized" };

  /*
    NOBODY OBSERVES THE FUTURE. Judged in the CANONICAL obligation timezone, never the caller's
    — a client that sends its own zone is asking, not deciding.

    There is deliberately NO lower bound. A colleague who remembers something from three weeks
    ago and only now has time to report it is telling the truth, and no policy in this
    repository requires that truth be thrown away for being late.
  */
  if (observedOn > request.value.maxObservedOn) return { ok: false, reason: "future_date" };

  const mine = request.value.myObservations;
  if (mine.some((o) => o.observedOn === observedOn && o.outcome === outcome)) {
    return { ok: true, outcome, observedOn, created: false };
  }

  const { error } = await admin.from(OBSERVATIONS).insert({
    followup_id: followupId,
    observer_user_id: observerUserId,
    learner_user_id_snapshot: ob.user_id_snapshot,
    authority_edge_id: authority.authorityId,
    organization_id_snapshot: authority.organizationId,
    // Snapshotted so the attestation can never drift from the sentence they actually read.
    observed_standard_snapshot: request.value.observableStandard,
    outcome,
    observed_on: observedOn,
    // The frame the date is to be read in, from the obligation — durable, and not the client's.
    observation_timezone_snapshot: obligationTimezone(ob),
  });

  /*
    23505 = the unique index caught a duplicate this request's read did not see, because another
    device inserted the identical episode in between. That is the same act, not a second
    sighting, so it reports the same answer a sequential double tap would get.
  */
  if (error) {
    if (error.code === "23505") return { ok: true, outcome, observedOn, created: false };
    // Anything else is a real failure and says so — never a silent success.
    return { ok: false, reason: "error" };
  }

  return { ok: true, outcome, observedOn, created: true };
}
