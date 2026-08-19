import type { SupabaseClient } from "@supabase/supabase-js";
import {
  summariseTrainingOutcome,
  type TrainingOutcome,
  type TrainingDownstreamState,
  type FollowUpFact,
  type ObservationFactLite,
} from "@/domain/foundry/events/trainingOutcome";
import { isFollowUpOutcome } from "@/domain/foundry/followup/followUpObligation";
import { isObservationOutcome } from "@/domain/foundry/observation/behaviorObservation";

/**
 * TRAINING OUTCOME — read-only, owner-scoped (Slice R4-R3A).
 *
 * The Host's answer to "did anything change?", assembled from evidence that ALREADY exists. This
 * service adds no column, writes nothing, and interprets nothing: every judgement is made by the
 * domain authority that owns it (`summariseTrainingOutcome` → `classifyFollowUpDue`,
 * `establishesObservation`).
 *
 * PRIVACY IS ENFORCED BY THE SELECT LIST, NOT BY THE UI.
 *
 * `response_text` (the private completion-check answer), `learner_reflection_text` (the private
 * reflection) and the generated `reflection` jsonb are NEVER named in any query below, so they
 * cannot reach a Host payload even by accident. The same rule the shared-review and host-history
 * services already hold, stated the same way, and pinned by `hostEvidencePrivacy.test.ts`.
 *
 * `decision_response_text` IS Host-visible — declared on the column itself since 3.2M-1 ("what the
 * LEARNER decided to do, in their own words. Host-visible.") and already carried by the shared
 * review service's allow-list. It is returned WITHOUT any learner identifier: this slice was told
 * not to widen identity exposure, so the decisions come back as an unattributed list.
 */

/** Only what the Host is authorised to read. No private column is named anywhere. */
const PROGRESS_COLS = "id, completed_at, linked_user_id, decision_response_text";

export type TrainingOutcomeView = TrainingOutcome & {
  /**
   * The learner-authored decisions, unattributed. Present only when the Host is authorised to
   * read them (always, per the column's own declaration) and always rendered behind a disclosure
   * — never in the first viewport.
   */
  decisions: string[];
};

/**
 * Which of the three measured "this training has no downstream" states applies — or `configured`.
 *
 * Measured in production before this was written: of 32 module snapshots only 5 are
 * journey-enabled and only 2 ask for a decision, and 16 of 48 events have no module row at all.
 * A Host looking at any of those must be told the training was never set up to continue, NOT
 * shown an empty follow-up table that reads as learner failure.
 */
async function resolveDownstream(admin: SupabaseClient, eventId: string): Promise<TrainingDownstreamState> {
  const { data } = await admin
    .from("foundry_event_module")
    .select("module_snapshot")
    .eq("event_id", eventId)
    .maybeSingle<{ module_snapshot: Record<string, unknown> | null }>();
  if (!data) return "no_module";
  const journey = (data.module_snapshot ?? {})["realityGroundedJourneyV1"] as
    | { elements?: { kind?: string; confirmationStatus?: string }[] }
    | undefined;
  if (!journey) return "no_journey";
  const hasDecision = (journey.elements ?? []).some(
    (e) => e?.kind === "action_decision" && e?.confirmationStatus === "grounded",
  );
  return hasDecision ? "configured" : "no_decision";
}

/**
 * The outcome view for one training the caller owns. `null` when the event is not theirs — a
 * non-disclosing miss, exactly like every other owner-scoped read here.
 */
export async function getTrainingOutcome(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
  now: Date = new Date(),
  tz = "UTC",
): Promise<TrainingOutcomeView | null> {
  const { data: event } = await admin
    .from("foundry_events")
    .select("id")
    .eq("id", eventId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle<{ id: string }>();
  if (!event) return null;

  const { data: participants } = await admin
    .from("foundry_event_participants")
    .select("id, status")
    .eq("event_id", eventId)
    .returns<{ id: string; status: string }[]>();
  const joined = (participants ?? []).filter((p) => p.status === "joined").length;

  const { data: progress } = await admin
    .from("foundry_event_training_progress")
    .select(PROGRESS_COLS)
    .eq("event_id", eventId)
    .returns<{ id: string; completed_at: string | null; linked_user_id: string | null; decision_response_text: string | null }[]>();
  const rows = progress ?? [];
  const completedRows = rows.filter((r) => r.completed_at);

  const { data: followups } = await admin
    .from("foundry_participant_followups")
    .select("id, status, outcome, due_at")
    .eq("event_id", eventId)
    .returns<{ id: string; status: string; outcome: string | null; due_at: string }[]>();

  const followUps: FollowUpFact[] = (followups ?? []).map((f) => ({
    status: f.status === "RESPONDED" ? "RESPONDED" : "PENDING",
    outcome: isFollowUpOutcome(f.outcome) ? f.outcome : null,
    dueAtIso: f.due_at,
  }));

  /*
    Observations hang off follow-ups, not off the event, so they are fetched by the follow-up ids
    this training actually produced. An event with no follow-ups therefore has no observations to
    look for, and we do not issue a query with an empty `in` list.
  */
  const followUpIds = (followups ?? []).map((f) => f.id);
  let observations: ObservationFactLite[] = [];
  if (followUpIds.length > 0) {
    const { data: obs } = await admin
      .from("foundry_behavior_observations")
      /*
        `followup_id` comes back because the aggregate counts TARGETS, not rows: several
        observers — and one observer on several days — can all report on the same follow-up, and
        each of those is still one confirmed person. Observer identity is deliberately NOT
        selected; the Host is shown counts, never who said what.
      */
      .select("followup_id, outcome")
      .in("followup_id", followUpIds)
      .returns<{ followup_id: string; outcome: string }[]>();
    observations = (obs ?? [])
      .filter((o) => isObservationOutcome(o.outcome))
      .map((o) => ({ followUpId: o.followup_id, outcome: o.outcome as ObservationFactLite["outcome"] }));
  }

  const decisions = completedRows
    .map((r) => (r.decision_response_text ?? "").trim())
    .filter((d) => d.length > 0);

  const summary = summariseTrainingOutcome(
    {
      joined,
      completed: completedRows.length,
      linkedCompletions: completedRows.filter((r) => r.linked_user_id).length,
      decisionCount: decisions.length,
      followUps,
      observations,
      downstream: await resolveDownstream(admin, eventId),
    },
    now,
    tz,
  );

  return { ...summary, decisions };
}
