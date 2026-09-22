import type { SupabaseClient } from "@supabase/supabase-js";
import { missedQuestions, type MissedQuestion } from "@/domain/foundry/events/quizFollowUp";
import type { LearnerAnswer, Quiz } from "@/domain/foundry/events/quickTrainingQuiz";
import { graphConfigFromEnv, getGraphAppToken, readChatAddress } from "@/lib/bty/microsoft/graphDirectory.server";

/**
 * ONE LEARNER'S RESULT, FOR THE HOST WHO OWNS THE TRAINING — and the door to a human conversation.
 * SERVER ONLY. Slice Training Result → Human Teams Chat V1.
 *
 * ★ THE PRIVACY BOUNDARY, STATED ONCE. Two learner-authored texts exist in Foundry and neither is
 * in scope here:
 *
 *     response_text                   PRIVATE REFLECTION. Learner-owned, never Host-visible.
 *     shared_understanding_response   Host-reviewable, but through its OWN owner-scoped path.
 *
 * Both live on `foundry_event_training_progress`, and this module never selects from that table at
 * all. What it does read — `foundry_event_quizzes.quiz_snapshot` and the learner's multiple-choice
 * selections in `foundry_event_quiz_attempts.answers` — contains no learner-authored prose by
 * construction: the questions and choices were written by the Host, and the learner contributed
 * only which choice id they picked. There is no free-text field in this projection to leak.
 *
 * ★ OWNERSHIP IS READ, NEVER CLAIMED. Every function here re-checks that the caller owns the
 * training and that the participant belongs to it, so a valid participant id from a DIFFERENT
 * training cannot be used to read across events.
 */

type ParticipantRow = {
  id: string;
  event_id: string;
  display_name: string | null;
  user_id: string | null;
  microsoft_tenant_id: string | null;
  microsoft_aad_object_id: string | null;
};

export type LearnerResultDetail = {
  participantId: string;
  displayName: string | null;
  correctCount: number;
  totalCount: number;
  scorePercent: number;
  submittedAt: string;
  missed: MissedQuestion[];
  /** Presentation for the draft the Host will edit. */
  trainingTitle: string;
  /** Can a direct 1:1 chat even be addressed for this learner? Separate from "who they are". */
  canMessageInTeams: boolean;
};

type Failure = { ok: false; reason: "not_owner" | "not_found" | "no_attempt" | "quiz_missing" };

/**
 * Resolve the training + participant together, under the Host's ownership.
 *
 * The two `.eq()` filters are the whole access rule: the event must be owned by this Host, and the
 * participant must belong to that event. Neither is inferred from the other.
 */
async function resolveOwned(
  admin: SupabaseClient,
  input: { eventId: string; ownerUserId: string; participantId: string },
): Promise<{ ok: true; title: string; participant: ParticipantRow } | Failure> {
  const { data: event } = await admin
    .from("foundry_events")
    .select("id, title")
    .eq("id", input.eventId)
    .eq("owner_user_id", input.ownerUserId)
    .maybeSingle<{ id: string; title: string }>();
  if (!event) return { ok: false, reason: "not_owner" };

  const { data: participant } = await admin
    .from("foundry_event_participants")
    .select("id, event_id, display_name, user_id, microsoft_tenant_id, microsoft_aad_object_id")
    .eq("id", input.participantId)
    .eq("event_id", event.id)
    .maybeSingle<ParticipantRow>();
  if (!participant) return { ok: false, reason: "not_found" };

  return { ok: true, title: event.title, participant };
}

/** The Host-facing detail behind one score row. */
export async function readLearnerResultDetail(
  admin: SupabaseClient,
  input: { eventId: string; ownerUserId: string; participantId: string },
): Promise<{ ok: true; detail: LearnerResultDetail } | Failure> {
  const owned = await resolveOwned(admin, input);
  if (!owned.ok) return owned;

  const { data: attempt } = await admin
    .from("foundry_event_quiz_attempts")
    .select("answers, correct_count, total_count, submitted_at")
    .eq("event_id", input.eventId)
    .eq("participant_id", owned.participant.id)
    .maybeSingle<{ answers: LearnerAnswer[]; correct_count: number; total_count: number; submitted_at: string }>();
  if (!attempt) return { ok: false, reason: "no_attempt" };

  const { data: quizRow } = await admin
    .from("foundry_event_quizzes")
    .select("quiz_snapshot")
    .eq("event_id", input.eventId)
    .maybeSingle<{ quiz_snapshot: Quiz }>();
  if (!quizRow?.quiz_snapshot) return { ok: false, reason: "quiz_missing" };

  return {
    ok: true,
    detail: {
      participantId: owned.participant.id,
      displayName: owned.participant.display_name,
      correctCount: attempt.correct_count,
      totalCount: attempt.total_count,
      scorePercent: attempt.total_count > 0
        ? Math.round((attempt.correct_count * 100) / attempt.total_count)
        : 0,
      submittedAt: attempt.submitted_at,
      missed: missedQuestions(quizRow.quiz_snapshot, attempt.answers),
      trainingTitle: owned.title,
      /*
        A learner who joined through a web link has no Entra coordinate, so there is no 1:1 chat to
        open for them. The Host is told that by the CTA being absent, not by a failure after a tap.
      */
      canMessageInTeams: Boolean(owned.participant.microsoft_aad_object_id),
    },
  };
}

/**
 * The Host chose to reach out. Resolve where the chat window points, and record that it happened.
 *
 * ★ BTY IS NOT A PARTY TO WHAT FOLLOWS. It returns an address and writes one row saying a Host
 * initiated contact. The message is composed, edited and sent by the Host inside Teams, and its
 * text never reaches this server — the record has no column that could hold it.
 *
 * ★ THE RECORD IS FAIL-SOFT. A Host reaching out must not be blocked because a diagnostic insert
 * failed; the conversation matters more than the bookkeeping about it.
 */
export async function beginFollowUpContact(
  admin: SupabaseClient,
  input: { eventId: string; ownerUserId: string; participantId: string },
): Promise<{ ok: true; chatTarget: string; trainingTitle: string } | (Failure | { ok: false; reason: "no_teams_identity" | "address_unavailable" })> {
  const owned = await resolveOwned(admin, input);
  if (!owned.ok) return owned;

  const oid = owned.participant.microsoft_aad_object_id;
  if (!oid) return { ok: false, reason: "no_teams_identity" };

  const graphConfig = graphConfigFromEnv();
  if (!graphConfig) return { ok: false, reason: "address_unavailable" };
  /*
    SAME TENANT OR NOTHING. The app-only token is issued for one tenant; a participant stamped with
    a different tenant is not someone this credential may resolve, and guessing would be reading
    another organisation's directory.
  */
  if (owned.participant.microsoft_tenant_id && owned.participant.microsoft_tenant_id !== graphConfig.tenantId) {
    return { ok: false, reason: "address_unavailable" };
  }
  const token = await getGraphAppToken(graphConfig);
  if (!token) return { ok: false, reason: "address_unavailable" };

  const chatTarget = await readChatAddress(token, oid);
  if (!chatTarget) return { ok: false, reason: "address_unavailable" };

  const { error } = await admin.from("foundry_host_followup_contacts").insert({
    event_id: input.eventId,
    host_user_id: input.ownerUserId,
    participant_id: owned.participant.id,
    learner_user_id: owned.participant.user_id,
    event_type: "follow_up_initiated",
  });
  if (error) console.error("[host-followup] contact record failed", { code: error.code ?? "unknown" });

  return { ok: true, chatTarget, trainingTitle: owned.title };
}
