import type { SupabaseClient } from "@supabase/supabase-js";
import { hasCompletedPracticeForEvent } from "@/lib/bty/foundry/arena/foundryArenaPracticeRunService";
import type { EvidenceProjection } from "@/domain/foundry/events/learner-evidence";
import { projectEvidenceByProgressId } from "./learnerEvidenceService";

/**
 * Foundry Shared Understanding — Host educational review (Slice 3.1B-3G).
 *
 * PRIVACY (non-negotiable): this Host-facing surface exposes the learner's SHARED UNDERSTANDING
 * response (the learner was explicitly told it is shared) plus the Host's own review state. It
 * NEVER selects, returns, or logs `response_text` (private Reflection) or the AI `reflection`.
 * The private Reflection is reachable only through the learner's own private path.
 *
 * AUTHORIZATION: every function is scoped by `foundry_events.owner_user_id` — the MEASURED
 * canonical Host actor (auth.users.id). An unrelated owner id resolves nothing (never another
 * owner's data). The review WRITE goes through the atomic, audited, service-role-only RPC
 * `bty_foundry_set_shared_review` (owner re-checked inside the function).
 */

export type HostReviewStatus = "NOT_REVIEWED" | "ALIGNED" | "PARTIALLY_CLEAR" | "FOLLOW_UP_NEEDED";

/** One learner's SHARED evidence for the Host review surface — never any private field. */
export type SharedUnderstandingResponse = {
  participantId: string;
  /** Canonical progress-row id — the deep-link focus target (Slice 3.1B-3L). Not private (row id only). */
  progressId: string;
  displayName: string;
  completed: boolean;
  /** The shared answer — visible because the learner was explicitly told it is shared. Null when
   *  the training asked no shared question but the learner did record a decision (3.2M-1). */
  sharedResponse: string | null;
  submittedAt: string | null;
  /** What the LEARNER decided to do, in their own words. Null when the program asked for none. */
  decisionResponse: string | null;
  decisionSubmittedAt: string | null;
  /**
   * Slice 3.2M-2 — did this person rehearse it?
   *
   * `unattributable` is not a hedge: an anonymous participant has no account, so no practice
   * run can belong to them. Saying "not practised yet" would be a claim the data cannot make.
   */
  practice: "practised" | "not_practised" | "unattributable";
  /**
   * Slice 3.2R-R1 — HOW FAR HAS EVIDENCE PROGRESSED, and nothing else.
   *
   * Rung NAMES only, from the canonical `projectEvidence`. This field cannot carry text: its
   * type has no string field, and the assembly that produces it reduces every private column to
   * a boolean before returning. So the Host learns that a reflection EXISTS and still cannot
   * read a word of it — which is the whole point of showing it.
   *
   * NOT A SCORE. There is no total, no percentage, no ranking and no comparison between
   * learners. An empty array is a legitimate answer and means "nothing established yet", never
   * "failed" — and it says nothing about whether the training itself was completed, which is
   * `completed` above and remains a separate fact.
   */
  evidence: EvidenceProjection;
  reviewStatus: HostReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
};

export type SharedUnderstandingView = {
  eventId: string;
  /** The configured module question; null = no shared question (no review surface). */
  sharedQuestion: string | null;
  /** Only participants who actually SUBMITTED a shared response (never a legacy backlog). */
  responses: SharedUnderstandingResponse[];
};

/** Owner-scoped event header: title + whichever content type carries the shared question. */
async function getOwnedEventSharedQuestion(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
): Promise<{ content_type: string } | null> {
  const { data } = await admin
    .from("foundry_events")
    .select("id, content_type")
    .eq("id", eventId)
    .eq("owner_user_id", ownerUserId) // authorization — a foreign event id resolves nothing
    .maybeSingle<{ id: string; content_type: string }>();
  return data ? { content_type: data.content_type } : null;
}

async function sharedQuestionFor(
  admin: SupabaseClient,
  eventId: string,
  contentType: string,
): Promise<string | null> {
  const table =
    contentType === "document" ? "foundry_event_document_content" : "foundry_event_training_content";
  const { data } = await admin
    .from(table)
    .select("shared_question")
    .eq("event_id", eventId)
    .maybeSingle<{ shared_question: string | null }>();
  return data?.shared_question ?? null;
}

/**
 * Host read projection. Returns the shared question + every SUBMITTED shared response for an OWNED
 * event, with review state. Returns null when the event is not owned by `ownerUserId` (no leak).
 * The progress SELECT is an explicit safe allow-list — response_text / reflection are NOT selected.
 */
export async function getSharedUnderstandingForOwner(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
): Promise<SharedUnderstandingView | null> {
  if (!ownerUserId || !eventId) return null;
  const ev = await getOwnedEventSharedQuestion(admin, ownerUserId, eventId);
  if (!ev) return null; // not owned → neutral null (authorization)

  const sharedQuestion = await sharedQuestionFor(admin, eventId, ev.content_type);

  // SAFE allow-list ONLY — never response_text, never reflection. `id` (progress row id) is the
  // deep-link focus target (Slice 3.1B-3L) — a row identifier, not a private field.
  const { data: rows } = await admin
    .from("foundry_event_training_progress")
    .select(
      "id, participant_id, completed_at, shared_understanding_response, shared_response_submitted_at, host_review_status, host_review_note, host_reviewed_at, decision_response_text, decision_submitted_at, linked_user_id",
    )
    .eq("event_id", eventId);

  /*
    Slice 3.2M-1: a learner may now have a DECISION without a shared answer — a training can ask
    for one and not the other — so "has something to show" is decided here rather than by a
    single-column NOT NULL in the query. `response_text` and `reflection` were never selected and
    still are not; widening the row filter cannot widen the allow-list.
  */
  const progress = ((rows ?? []) as Array<{
    id: string;
    participant_id: string;
    completed_at: string | null;
    shared_understanding_response: string | null;
    shared_response_submitted_at: string | null;
    decision_response_text: string | null;
    decision_submitted_at: string | null;
    linked_user_id: string | null;
    host_review_status: HostReviewStatus | null;
    host_review_note: string | null;
    host_reviewed_at: string | null;
  }>).filter(
    (p) =>
      (p.shared_understanding_response ?? "").trim().length > 0 ||
      (p.decision_response_text ?? "").trim().length > 0,
  );

  // Participant display names (no PII beyond the display name the learner chose).
  const ids = progress.map((p) => p.participant_id);
  const nameById = new Map<string, string>();
  if (ids.length > 0) {
    const { data: parts } = await admin
      .from("foundry_event_participants")
      .select("id, display_name")
      .eq("event_id", eventId)
      .in("id", ids);
    for (const p of (parts ?? []) as Array<{ id: string; display_name: string }>) {
      nameById.set(p.id, p.display_name);
    }
  }

  /*
    Practice status, DERIVED from durable facts (Slice 3.2M-2): a run of a practice built from
    THIS event, belonging to THIS learner's account, that reached completed. Nothing is cached
    — a stored rung is one that can disagree with its own evidence.
  */
  const practiced = new Set<string>();
  const linked = [...new Set(progress.map((p) => p.linked_user_id).filter((v): v is string => Boolean(v)))];
  if (linked.length > 0) {
    for (const userId of linked) {
      if (await hasCompletedPracticeForEvent(admin, userId, eventId)) practiced.add(userId);
    }
  }

  /*
    Evidence rungs (Slice 3.2R-R1), from the ONE canonical projection. Assembled in a single
    batched pass for the whole roster rather than per row, and read-only: it adds no column to
    the allow-list above and returns no text of any kind.
  */
  const evidenceByProgress = await projectEvidenceByProgressId(
    admin,
    progress.map((p) => ({ progressId: p.id, eventId, userId: p.linked_user_id })),
  );
  const noEvidence: EvidenceProjection = { established: [], highestEstablished: null };

  const responses: SharedUnderstandingResponse[] = progress.map((p) => ({
    participantId: p.participant_id,
    progressId: p.id,
    displayName: nameById.get(p.participant_id) ?? "",
    completed: Boolean(p.completed_at),
    sharedResponse: p.shared_understanding_response,
    submittedAt: p.shared_response_submitted_at,
    /** What the learner decided to do, in their own words. Null when the program asked for none. */
    decisionResponse: p.decision_response_text,
    decisionSubmittedAt: p.decision_submitted_at,
    practice: !p.linked_user_id ? "unattributable" : practiced.has(p.linked_user_id) ? "practised" : "not_practised",
    evidence: evidenceByProgress.get(p.id) ?? noEvidence,
    reviewStatus: p.host_review_status ?? "NOT_REVIEWED",
    reviewNote: p.host_review_note,
    reviewedAt: p.host_reviewed_at,
  }));

  return { eventId, sharedQuestion, responses };
}

export type SetReviewResult =
  | "reviewed"
  | "unchanged"
  | "not_owner"
  | "no_progress"
  | "no_shared_response"
  | "invalid_status";

/**
 * Set the Host educational review status (+ optional note) for one participant's shared response,
 * via the atomic audited RPC. Review NEVER modifies completed_at, XP, the assignment claim, or the
 * learner's response — the RPC touches only the review columns and writes one audit row per real
 * change. An identical (status, note) resubmission returns 'unchanged' (no duplicate audit).
 */
export async function setSharedReview(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
  participantId: string,
  status: HostReviewStatus,
  note: string | null,
): Promise<SetReviewResult> {
  const { data, error } = await admin.rpc("bty_foundry_set_shared_review", {
    p_event_id: eventId,
    p_participant_id: participantId,
    p_owner_user_id: ownerUserId,
    p_status: status,
    p_note: note ?? null,
  });
  if (error) return "no_progress"; // degrade safely; never throws to the caller
  const row = (Array.isArray(data) ? data[0] : data) as { result?: string } | undefined;
  const r = row?.result;
  if (
    r === "reviewed" ||
    r === "unchanged" ||
    r === "not_owner" ||
    r === "no_progress" ||
    r === "no_shared_response" ||
    r === "invalid_status"
  ) {
    return r;
  }
  return "no_progress";
}
