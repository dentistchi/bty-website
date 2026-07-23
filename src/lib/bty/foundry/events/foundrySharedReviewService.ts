import type { SupabaseClient } from "@supabase/supabase-js";

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
  /** The shared answer — visible because the learner was explicitly told it is shared. */
  sharedResponse: string;
  submittedAt: string;
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
      "id, participant_id, completed_at, shared_understanding_response, shared_response_submitted_at, host_review_status, host_review_note, host_reviewed_at",
    )
    .eq("event_id", eventId)
    .not("shared_understanding_response", "is", null);

  const progress = (rows ?? []) as Array<{
    id: string;
    participant_id: string;
    completed_at: string | null;
    shared_understanding_response: string;
    shared_response_submitted_at: string;
    host_review_status: HostReviewStatus | null;
    host_review_note: string | null;
    host_reviewed_at: string | null;
  }>;

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

  const responses: SharedUnderstandingResponse[] = progress.map((p) => ({
    participantId: p.participant_id,
    progressId: p.id,
    displayName: nameById.get(p.participant_id) ?? "",
    completed: Boolean(p.completed_at),
    sharedResponse: p.shared_understanding_response,
    submittedAt: p.shared_response_submitted_at,
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
