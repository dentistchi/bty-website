import type { SupabaseClient } from "@supabase/supabase-js";
import { journeyObservableStandard, type RealityGroundedJourneyV1 } from "@/domain/foundry/module/journey";
import {
  isObservationOutcome,
  observationEstablished,
  type ObservationFact,
  type ObservationOutcome,
} from "@/domain/foundry/observation/behaviorObservation";
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

export type ObservationRequest = {
  followupId: string;
  learnerDisplayName: string;
  /** The frozen observable_standard — what the observer is asked to have seen or heard. */
  observableStandard: string;
  /** This observer's own prior reports, oldest first. Never anyone else's. */
  myObservations: { outcome: ObservationOutcome; submittedAt: string }[];
};

export type ObservationUnavailable =
  | "not_found"
  | "not_authorized"
  | "no_observable_standard";

export type SubmitObservationResult =
  | { ok: true; outcome: ObservationOutcome; created: boolean }
  | { ok: false; reason: ObservationUnavailable | "invalid_outcome" };

type ObligationRow = {
  id: string;
  event_id: string | null;
  user_id_snapshot: string;
};

async function loadObligation(admin: SupabaseClient, followupId: string): Promise<ObligationRow | null> {
  if (!followupId) return null;
  const { data } = await admin
    .from("foundry_participant_followups")
    .select("id, event_id, user_id_snapshot")
    .eq("id", followupId)
    .maybeSingle<ObligationRow>();
  return data ?? null;
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

/** Every submitted observation for this obligation, oldest first. Append-only by construction. */
export async function listObservations(
  admin: SupabaseClient,
  followupId: string,
): Promise<ObservationFact[]> {
  if (!followupId) return [];
  const { data } = await admin
    .from(OBSERVATIONS)
    .select("outcome, observer_user_id, submitted_at")
    .eq("followup_id", followupId);
  return ((data ?? []) as Array<{ outcome: string; observer_user_id: string; submitted_at: string }>)
    .filter((r) => isObservationOutcome(r.outcome))
    .map((r) => ({
      outcome: r.outcome as ObservationOutcome,
      observerUserId: r.observer_user_id,
      // `submitted_at` is NOT NULL with a default, so this coalesce is belt-and-braces —
      // an ordering helper must not throw on a row shape it did not expect.
      submittedAt: r.submitted_at ?? "",
    }))
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
}

/** Has anyone authorised positively observed this behaviour? The OBSERVED rung, derived. */
export async function hasIndependentObservation(admin: SupabaseClient, followupId: string): Promise<boolean> {
  return observationEstablished(await listObservations(admin, followupId));
}

/**
 * What an authorised observer may see. Returns a refusal — never a partial page — when the
 * caller has no authority, so an unauthorised person cannot learn that the request exists.
 */
export async function getObservationRequest(
  admin: SupabaseClient,
  observerUserId: string,
  followupId: string,
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
      myObservations: mine.map((o) => ({ outcome: o.outcome, submittedAt: o.submittedAt })),
    },
  };
}

/**
 * Record one observation.
 *
 * Append-only: a later report from the same person is a NEW row, so an observer who first said
 * they had not seen it and later did is preserved as both facts. What is NOT appended is the
 * same answer twice in a row from the same observer — that is a double tap, not a second
 * sighting.
 */
export async function submitObservation(
  admin: SupabaseClient,
  observerUserId: string,
  followupId: string,
  outcome: unknown,
): Promise<SubmitObservationResult> {
  if (!isObservationOutcome(outcome)) return { ok: false, reason: "invalid_outcome" };

  const request = await getObservationRequest(admin, observerUserId, followupId);
  if (!request.ok) return { ok: false, reason: request.reason };

  const ob = await loadObligation(admin, followupId);
  if (!ob) return { ok: false, reason: "not_found" };

  const authority = await resolveEdgeAuthority(admin, {
    actorUserId: observerUserId,
    learnerUserId: ob.user_id_snapshot,
  });
  if (!authority.allowed) return { ok: false, reason: "not_authorized" };

  const mine = request.value.myObservations;
  const last = mine.length > 0 ? mine[mine.length - 1] : null;
  // Idempotency boundary: the same answer again from the same observer writes nothing.
  if (last && last.outcome === outcome) return { ok: true, outcome, created: false };

  await admin.from(OBSERVATIONS).insert({
    followup_id: followupId,
    observer_user_id: observerUserId,
    learner_user_id_snapshot: ob.user_id_snapshot,
    authority_edge_id: authority.authorityId,
    organization_id_snapshot: authority.organizationId,
    // Snapshotted so the attestation can never drift from the sentence they actually read.
    observed_standard_snapshot: request.value.observableStandard,
    outcome,
  });

  return { ok: true, outcome, created: true };
}
