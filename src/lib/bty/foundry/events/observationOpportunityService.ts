import type { SupabaseClient } from "@supabase/supabase-js";
import { journeyObservableStandard, type RealityGroundedJourneyV1 } from "@/domain/foundry/module/journey";
import { isObservationOutcome, type ObservationOutcome } from "@/domain/foundry/observation/behaviorObservation";
import { deriveSustainedEvidence, type SustainedObservationFact } from "@/domain/foundry/observation/sustainedEvidence";
import {
  isObservationOpportunity,
  observationOpportunityView,
  orderObservationOpportunities,
  type OpportunityState,
} from "@/domain/foundry/observation/observationOpportunity";
import { resolveEdgeAuthority } from "@/lib/bty/arena/actionReviewAuthorityResolver.server";

/**
 * WHAT REVIEW WORK IS AVAILABLE TO ME (Slice 3.2N).
 *
 * 3.2M-4 and 3.2M-5 shipped a working observation page that no product path led to. This is the
 * read that closes it: given one authenticated reviewer, which behaviours are they authorised to
 * confirm, and what has been recorded so far.
 *
 * NOTHING IS PERSISTED. Every field is derived from state that is already authoritative — the
 * reviewer's edges, the learner's follow-up obligation, the frozen module snapshot, and the
 * observations themselves. A cached work-item row could only drift from those, and there is no
 * fact here it would be the source of.
 *
 * SHAPE OF THE READ, and why it is not the obvious loop:
 *   1. narrow to learners this reviewer has an ACTIVE edge to        (2 queries, bounded)
 *   2. their obligations                                             (1 query)
 *   3. the module snapshots for those events                         (1 query, batched)
 *   4. every observation for those obligations                       (1 query, batched)
 *   5. re-resolve authority once PER LEARNER, not per obligation
 * The per-candidate re-resolution is what makes appearing in this list grant nothing — but it is
 * also the expensive part, so it is keyed by learner: a reviewer with one learner and six
 * trainings pays for one resolution, not six. Sustained evidence is derived in memory from the
 * batched rows rather than by calling the per-obligation service in a loop, which would be an
 * N+1 against the same data.
 */

/** V1 bound, mirroring HOST_ACTION_REVIEW_MAX — this list is never organization-wide. */
export const OBSERVATION_OPPORTUNITY_MAX = 50;

const AUTHORITY_KEY = "ACTION_REVIEWER";
const MEMBERSHIP_COLS = "id, user_id, organization_id, status";

/**
 * One card. Deliberately thinner than the observer page it links to: the reviewer learns who
 * and what to watch for, and nothing about the learner's own evidence.
 */
export type ObservationOpportunity = {
  /** Internal routing data only — the destination page re-checks authority itself. */
  followupId: string;
  /** The SAME source the observation page uses, so the card and the page agree (Slice 3.2N). */
  learnerLabel: string;
  /** The frozen observable_standard — what they are asked to have seen or heard. */
  behavior: string;
  state: OpportunityState;
  /** Positive OCCURRENCE dates, never filing timestamps. Null when nothing positive exists. */
  firstObservedOn: string | null;
  lastObservedOn: string | null;
  positiveDates: number;
};

type MembershipRow = { id: string; user_id: string | null; status: string };

function isActiveBound(m: MembershipRow): boolean {
  return m.status === "active" && !!m.user_id;
}

/**
 * Learners this reviewer holds an ACTIVE edge to. Narrowing only — every candidate is
 * authoritatively re-resolved below, so a mistake here can widen nothing.
 */
async function reachableLearnerUserIds(admin: SupabaseClient, actorUserId: string): Promise<string[]> {
  const { data: actorMems } = await admin.from("bty_org_memberships").select(MEMBERSHIP_COLS).eq("user_id", actorUserId);
  const actorActiveIds = ((actorMems ?? []) as MembershipRow[]).filter(isActiveBound).map((m) => m.id);
  if (actorActiveIds.length === 0) return [];

  const { data: edges } = await admin
    .from("bty_org_action_review_authority")
    .select("learner_membership_id")
    .eq("authority_key", AUTHORITY_KEY)
    .eq("status", "active")
    .is("revoked_at", null)
    .in("reviewer_membership_id", actorActiveIds);
  const learnerMembershipIds = [
    ...new Set(((edges ?? []) as Array<{ learner_membership_id: string }>).map((e) => e.learner_membership_id)),
  ];
  if (learnerMembershipIds.length === 0) return [];

  const { data: learnerMems } = await admin.from("bty_org_memberships").select(MEMBERSHIP_COLS).in("id", learnerMembershipIds);
  return [
    ...new Set(((learnerMems ?? []) as MembershipRow[]).filter(isActiveBound).map((m) => m.user_id as string)),
  ];
}

type ObligationRow = {
  id: string;
  event_id: string | null;
  user_id_snapshot: string;
  follow_up_days: number;
};

/**
 * Every observation opportunity available to this reviewer, least-evidenced first.
 *
 * Empty is a legitimate answer, not an error: a signed-in person with no reviewer edges, or a
 * reviewer whose learners have no observable training, gets `[]` — never a refusal, because
 * "you have no review work" and "you are not allowed" must not look the same to someone who
 * simply has nothing to do today.
 */
export async function listMyObservationOpportunities(
  admin: SupabaseClient,
  reviewerUserId: string,
  options?: { now?: Date },
): Promise<ObservationOpportunity[]> {
  const actor = typeof reviewerUserId === "string" ? reviewerUserId.trim() : "";
  if (!actor) return [];
  const now = options?.now ?? new Date();

  const learnerIds = await reachableLearnerUserIds(admin, actor);
  if (learnerIds.length === 0) return [];

  // 1. Their obligations. The obligation is the canonical parent: it binds learner + event.
  const { data: obligationRows } = await admin
    .from("foundry_participant_followups")
    .select("id, event_id, user_id_snapshot, follow_up_days")
    .in("user_id_snapshot", learnerIds)
    .limit(OBSERVATION_OPPORTUNITY_MAX + 1);
  const obligations = ((obligationRows ?? []) as ObligationRow[]).filter((o) => o.event_id);
  if (obligations.length === 0) return [];
  if (obligations.length > OBSERVATION_OPPORTUNITY_MAX) {
    // Bounded on purpose, and said out loud — a silent truncation would read as "that is all".
    console.warn("[observation_opportunities] candidate cap hit", {
      actor: actor.slice(0, 8),
      cap: OBSERVATION_OPPORTUNITY_MAX,
      seen: obligations.length,
    });
  }
  const capped = obligations.slice(0, OBSERVATION_OPPORTUNITY_MAX);

  // 2. Frozen standards, batched by event. No grounded standard → no observation path at all.
  const eventIds = [...new Set(capped.map((o) => o.event_id as string))];
  const { data: mods } = await admin
    .from("foundry_event_module")
    .select("event_id, module_snapshot")
    .in("event_id", eventIds);
  const standardByEvent = new Map<string, string>();
  for (const m of (mods ?? []) as Array<{
    event_id: string;
    module_snapshot: { realityGroundedJourneyV1?: RealityGroundedJourneyV1 } | null;
  }>) {
    const s = journeyObservableStandard(m.module_snapshot?.realityGroundedJourneyV1);
    if (s) standardByEvent.set(m.event_id, s);
  }
  const observable = capped.filter((o) => standardByEvent.has(o.event_id as string));
  if (observable.length === 0) return [];

  // 3. Authority, re-resolved ONCE PER LEARNER. Appearing in a list grants nothing.
  const allowedLearner = new Map<string, boolean>();
  for (const learnerId of [...new Set(observable.map((o) => o.user_id_snapshot))]) {
    const decision = await resolveEdgeAuthority(admin, { actorUserId: actor, learnerUserId: learnerId }, { now });
    allowedLearner.set(learnerId, decision.allowed);
  }
  const authorized = observable.filter((o) => allowedLearner.get(o.user_id_snapshot) === true);
  if (authorized.length === 0) return [];

  /*
    4. THIS REVIEWER'S OWN observations, batched — never one query per card, and never anyone
    else's answers.

    Scoped to the actor deliberately. The observation page shows a reviewer only their own prior
    reports, because someone who has read a colleague's verdict is no longer an independent
    source — and a discovery card that said "two colleagues already saw this" would put the bias
    back one screen earlier, where it is harder to notice. So the card describes the reviewer's
    own record and nothing else.

    The cost is honest and worth stating: where two different reviewers each contributed one
    sighting, neither card will read "sustained" even though the behaviour is. The Host surface
    is the aggregate view and always was; that is where the span belongs.
  */
  const followupIds = authorized.map((o) => o.id);
  const { data: obsRows } = await admin
    .from("foundry_behavior_observations")
    .select("followup_id, outcome, observer_user_id, observed_on, submitted_at, observed_standard_snapshot")
    .in("followup_id", followupIds)
    .eq("observer_user_id", actor);
  const byFollowup = new Map<string, SustainedObservationFact[]>();
  for (const r of (obsRows ?? []) as Array<{
    followup_id: string;
    outcome: string;
    observer_user_id: string;
    observed_on: string | null;
    submitted_at: string | null;
    observed_standard_snapshot: string | null;
  }>) {
    if (!isObservationOutcome(r.outcome)) continue;
    const parent = authorized.find((o) => o.id === r.followup_id);
    if (!parent) continue;
    const list = byFollowup.get(r.followup_id) ?? [];
    list.push({
      outcome: r.outcome as ObservationOutcome,
      observerUserId: r.observer_user_id,
      observedOn: r.observed_on ?? "",
      submittedAt: r.submitted_at ?? "",
      observedStandardSnapshot: r.observed_standard_snapshot ?? "",
      eventId: parent.event_id as string,
    });
    byFollowup.set(r.followup_id, list);
  }

  // 5. Learner labels from the SAME source the observation page uses, so the card and the page
  //    it opens never show one person under two different names (Slice 3.2N).
  const { data: parts } = await admin
    .from("foundry_event_participants")
    .select("event_id, display_name")
    .in("event_id", eventIds);
  const labelByEvent = new Map<string, string>();
  for (const p of (parts ?? []) as Array<{ event_id: string; display_name: string | null }>) {
    if (!labelByEvent.has(p.event_id)) labelByEvent.set(p.event_id, (p.display_name ?? "").trim());
  }

  const cards: ObservationOpportunity[] = authorized.map((o) => {
    const eventId = o.event_id as string;
    const behavior = standardByEvent.get(eventId) as string;
    const evidence = deriveSustainedEvidence(byFollowup.get(o.id) ?? [], {
      eventId,
      observableStandard: behavior,
      followUpDays: o.follow_up_days,
    });
    const view = observationOpportunityView(evidence);
    return {
      followupId: o.id,
      learnerLabel: labelByEvent.get(eventId) ?? "",
      behavior,
      state: view.state,
      firstObservedOn: view.firstObservedOn,
      lastObservedOn: view.lastObservedOn,
      positiveDates: view.positiveDates,
    };
  });

  /*
    Belt-and-braces: the pure predicate runs over the assembled facts, so a card can only ship
    if the domain also agrees it is one. Everything above narrows; this decides.
  */
  const kept = cards.filter((c, i) =>
    isObservationOpportunity({
      authorityAllowed: allowedLearner.get(authorized[i]!.user_id_snapshot) === true,
      obligationExists: true,
      learnerUserId: authorized[i]!.user_id_snapshot,
      observableStandard: c.behavior,
    }),
  );
  return orderObservationOpportunities(kept);
}

/**
 * Which of these learners currently have ANYONE authorised to confirm their behaviour?
 * (Slice 3.2N, Host side.)
 *
 * CAPABILITY, NOT EVIDENCE. "No independent observation yet" says nobody has reported; this says
 * nobody is even permitted to. Showing only the first, when the second is true, reads as though
 * the learner or a colleague let it slip — when in fact the product never gave anyone the
 * standing to look.
 *
 * Reads the edge table directly rather than through the per-learner resolver: this is a yes/no
 * about existence for a Host's own event roster, it grants nothing, and the resolver would be a
 * three-query call per participant.
 */
export async function learnersWithAnEligibleObserver(
  admin: SupabaseClient,
  learnerUserIds: readonly string[],
): Promise<Set<string>> {
  const ids = [...new Set(learnerUserIds.filter((v) => typeof v === "string" && v.length > 0))];
  const out = new Set<string>();
  if (ids.length === 0) return out;

  // Three batched queries for the whole roster, not three per participant.
  const { data: learnerMems } = await admin.from("bty_org_memberships").select(MEMBERSHIP_COLS).in("user_id", ids);
  const activeLearnerMems = ((learnerMems ?? []) as MembershipRow[]).filter(isActiveBound);
  if (activeLearnerMems.length === 0) return out;
  const userByMembership = new Map(activeLearnerMems.map((m) => [m.id, m.user_id as string]));

  const { data: edges } = await admin
    .from("bty_org_action_review_authority")
    .select("reviewer_membership_id, learner_membership_id")
    .eq("authority_key", AUTHORITY_KEY)
    .eq("status", "active")
    .is("revoked_at", null)
    .in("learner_membership_id", [...userByMembership.keys()]);
  const edgeRows = (edges ?? []) as Array<{ reviewer_membership_id: string; learner_membership_id: string }>;
  if (edgeRows.length === 0) return out;

  /*
    The reviewer's OWN membership must still be active and user-bound. A departed colleague's
    stale edge points at nobody, and counting it would tell a Host someone can confirm this when
    in fact no one can — the precise falsehood this function exists to prevent.
  */
  const { data: reviewerMems } = await admin
    .from("bty_org_memberships")
    .select(MEMBERSHIP_COLS)
    .in("id", [...new Set(edgeRows.map((e) => e.reviewer_membership_id))]);
  const liveReviewer = new Set(((reviewerMems ?? []) as MembershipRow[]).filter(isActiveBound).map((m) => m.id));

  for (const e of edgeRows) {
    if (!liveReviewer.has(e.reviewer_membership_id)) continue;
    const learnerUserId = userByMembership.get(e.learner_membership_id);
    if (learnerUserId) out.add(learnerUserId);
  }
  return out;
}

/** Single-learner convenience over the batched read. */
export async function hasEligibleObserver(admin: SupabaseClient, learnerUserId: string): Promise<boolean> {
  return (await learnersWithAnEligibleObserver(admin, [learnerUserId])).has(learnerUserId);
}
