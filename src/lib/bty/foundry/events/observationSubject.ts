import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * WHO THE OBSERVER IS BEING ASKED ABOUT (Slice 3.2N-R1 / R4-R1).
 *
 * R4-R0 proved the one defect this file exists to close: the observation surfaces named the
 * learner by taking the FIRST participant of the obligation's event —
 *
 *     foundry_event_participants .eq(event_id) .limit(1)
 *
 * — while the evidence row was written against `foundry_participant_followups.user_id_snapshot`.
 * On a single-participant event those coincide by accident. On a multi-participant event they do
 * not, and the product then asks a human to attest about one named colleague and files the
 * answer against another. Measured live: obligation `4dc5f309` displayed "한빛" and belongs to
 * "테스트".
 *
 * `foundry_event_participants` carries NO user linkage column at all — it is a room-join record
 * (`participant_session_token_hash`), not an identity. So the name cannot be filtered by user id;
 * it has to be reached through the obligation's own lineage, which is the hop the HOST control
 * room has always used correctly (`foundryFollowupService`). This module is that hop, extracted
 * once so the observer page and the discovery card cannot drift apart — they are required to
 * agree, and two copies of a rule are how they stop agreeing.
 *
 * THE STORED SUBJECT IS UNCHANGED AND IS STILL THE AUTHORITY. `user_id_snapshot` remains what
 * `learner_user_id_snapshot` is written from. Nothing here decides who the evidence is about; it
 * decides whether BTY can HONESTLY NAME that person, and refuses when it cannot.
 *
 * PRIVACY. `foundry_event_training_progress` holds `response_text`, `decision_response_text` and
 * `learner_reflection_text`. This module selects THREE columns and never a fourth. A future edit
 * that adds `select("*")` here would put private learner writing one return statement away from
 * the observer payload, which is the exact boundary Slice 3.2M-4 was built to hold.
 */

/** The obligation lineage this resolver needs. Nothing here comes from a caller's request body. */
export type ObservationSubjectQuery = {
  /** `foundry_participant_followups.id` — the key the result map is returned under. */
  readonly followupId: string;
  /** The obligation's event. Every hop is cross-checked against it. */
  readonly eventId: string | null;
  /** `foundry_participant_followups.progress_id`. */
  readonly progressId: string | null;
  /** `foundry_participant_followups.user_id_snapshot` — the subject the evidence will name. */
  readonly learnerUserId: string | null;
};

/** A subject BTY can honestly name. Only produced when the whole chain agrees. */
export type ObservationSubject = {
  readonly participantId: string;
  /** Non-empty by construction — a blank name is an unresolved subject, not a subject. */
  readonly displayName: string;
};

type ProgressRow = {
  id: string;
  event_id: string | null;
  participant_id: string | null;
  linked_user_id: string | null;
};

type ParticipantRow = { id: string; event_id: string | null; display_name: string | null };

/**
 * Resolve the display name for each obligation, batched.
 *
 * An obligation is ABSENT from the returned map whenever any link in its chain is missing or
 * disagrees. Absence is the fail-closed signal every caller acts on; there is deliberately no
 * partial result and no placeholder, because a placeholder is what the defect looked like.
 *
 * Two queries for the whole batch, never two per obligation.
 */
export async function resolveObservationSubjects(
  admin: SupabaseClient,
  obligations: readonly ObservationSubjectQuery[],
): Promise<Map<string, ObservationSubject>> {
  const out = new Map<string, ObservationSubject>();

  // An obligation with no event or no progress lineage has nothing to resolve THROUGH. It is
  // dropped here rather than queried for, so a null id can never widen a filter to "any row".
  const usable = obligations.filter((o) => o.followupId && o.eventId && o.progressId);
  if (usable.length === 0) return out;

  const progressIds = [...new Set(usable.map((o) => o.progressId as string))];
  const { data: progRows } = await admin
    .from("foundry_event_training_progress")
    // THREE COLUMNS. This row also holds the learner's private writing — see the file header.
    .select("id, event_id, participant_id, linked_user_id")
    .in("id", progressIds);
  const progressById = new Map<string, ProgressRow>(
    ((progRows ?? []) as ProgressRow[]).map((p) => [p.id, p]),
  );

  const participantIds = [
    ...new Set(
      usable
        .map((o) => progressById.get(o.progressId as string)?.participant_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  ];
  if (participantIds.length === 0) return out;

  const { data: partRows } = await admin
    .from("foundry_event_participants")
    .select("id, event_id, display_name")
    .in("id", participantIds);
  const participantById = new Map<string, ParticipantRow>(
    ((partRows ?? []) as ParticipantRow[]).map((p) => [p.id, p]),
  );

  for (const o of usable) {
    const prog = progressById.get(o.progressId as string);
    if (!prog) continue; // the obligation points at a progress row that is not there
    if (!prog.participant_id) continue; // progress exists but names no participant

    /*
      THE PROGRESS ROW MUST BELONG TO THIS OBLIGATION'S EVENT. A followup whose progress_id
      points into a different event is a broken chain, and the name it would yield would be a
      person from another training.
    */
    if (prog.event_id !== o.eventId) continue;

    /*
      A CONTRADICTED CHAIN IS NOT A CHAIN.

      `linked_user_id` is the progress row's own claim about whose completion it is. When it is
      present and names someone OTHER than the obligation's subject, the two records disagree
      about the human — precisely the confusion this slice exists to make impossible — so no name
      is produced.

      NULL is TOLERATED, deliberately. An unclaimed completion (no linked user yet) is a known
      and separate condition; treating it as a contradiction would fail-close honest obligations
      over a gap that has nothing to do with identity drift.
    */
    if (prog.linked_user_id && o.learnerUserId && prog.linked_user_id !== o.learnerUserId) continue;

    const part = participantById.get(prog.participant_id);
    if (!part) continue; // the participant record is gone
    if (part.event_id !== o.eventId) continue; // participant belongs to another event

    // A blank name names nobody. Refused here so no surface has to decide what to render.
    const displayName = (part.display_name ?? "").trim();
    if (!displayName) continue;

    out.set(o.followupId, { participantId: part.id, displayName });
  }

  return out;
}

/** Single-obligation convenience over the batched read. Null = cannot be honestly named. */
export async function resolveObservationSubject(
  admin: SupabaseClient,
  obligation: ObservationSubjectQuery,
): Promise<ObservationSubject | null> {
  return (await resolveObservationSubjects(admin, [obligation])).get(obligation.followupId) ?? null;
}
