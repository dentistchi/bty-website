import type { SupabaseClient } from "@supabase/supabase-js";
import { learnerResult, type Attempt } from "./quickTrainingQuizService";
import { readGuidanceContent } from "./foundryGuidanceService";
import { listMyEvidence, type CheckInAgainTarget, type OpenFollowUpTarget } from "./learnerEvidenceService";
import type { Quiz } from "@/domain/foundry/events/quickTrainingQuiz";

/**
 * ONE COMPLETED TRAINING, FOR THE LEARNER WHO COMPLETED IT. SERVER ONLY.
 * Slice My Learning — Canonical Training History V1.
 *
 * ★ WHY THIS IS THE CANONICAL SURFACE AND THE BOT CHAT IS NOT. A chat is a stream: the completion
 * card is correct where it sits, and it is the wrong place to return to in three weeks to ask
 * "what did I actually get wrong". My Learning is where a learner comes back, so the review lives
 * there and the card stays a notification.
 *
 * ★ NOTHING IS DUPLICATED. The quiz snapshot, the learner's answers and the guidance content are
 * read from where they already are, and the per-question projection is the SAME `learnerResult`
 * the room uses. No second copy of a quiz, no second scoring, no new table.
 *
 * ★ OWNERSHIP IS `linked_user_id`, exactly as `listUserFoundryHistory` scopes the list this detail
 * is opened from. A progress row that is not this learner's is not found — the same answer as one
 * that does not exist, so an id cannot be probed.
 */

type ProgressRow = {
  id: string;
  event_id: string;
  participant_id: string;
  completed_at: string | null;
  learner_reflection_text: string | null;
};

export type LearnerTrainingDetail = {
  entryId: string;
  eventId: string;
  title: string;
  contentType: string | null;
  completedAt: string | null;
  /** The learner-facing training body, exactly as the room shows it. Null when there is none. */
  content: unknown | null;
  /** Present only when this learner submitted a quiz for this training. */
  quiz: ReturnType<typeof learnerResult> | null;
  /** Whether a private reflection exists. The TEXT is never returned here — Center renders it. */
  hasReflection: boolean;
  /**
   * A follow-up on this training that is still open to a later report.
   *
   * ★ WHY THIS SURFACE CARRIES IT. `canCheckInAgain` is about a SETTLED obligation, and the domain
   * says in as many words that it "belongs to My Learning" — Today deliberately shows only PENDING
   * ones. So when the list stopped rendering it, this became the learner's ONLY door back to a
   * NOT_YET they later did act on. The rule is not re-implemented here: this reuses
   * `listMyEvidence`, which is the surface that owns the predicate.
   */
  checkInAgain: readonly CheckInAgainTarget[];
  /** A follow-up whose checkpoint has arrived and that has never been answered. */
  openFollowUp: readonly OpenFollowUpTarget[];
};

export async function readLearnerTrainingDetail(
  admin: SupabaseClient,
  input: { userId: string; entryId: string; timezone?: string | null },
): Promise<{ ok: true; detail: LearnerTrainingDetail } | { ok: false; reason: "not_found" }> {
  if (!input.userId || !input.entryId) return { ok: false, reason: "not_found" };

  const { data: progress } = await admin
    .from("foundry_event_training_progress")
    .select("id, event_id, participant_id, completed_at, learner_reflection_text")
    .eq("id", input.entryId)
    .eq("linked_user_id", input.userId)
    .not("completed_at", "is", null)
    .maybeSingle<ProgressRow>();
  if (!progress) return { ok: false, reason: "not_found" };

  const { data: event } = await admin
    .from("foundry_events")
    .select("id, title, content_type")
    .eq("id", progress.event_id)
    .maybeSingle<{ id: string; title: string; content_type: string | null }>();
  if (!event) return { ok: false, reason: "not_found" };

  const content = await readGuidanceContent(admin, event.id);

  /*
    THE QUIZ HALF IS OPTIONAL AND ITS ABSENCE IS NOT AN ERROR. A training with no quiz, or one this
    learner completed before a quiz existed, simply has no review to show — and inventing an empty
    "0 / 0" result would be a claim about their performance that nothing supports.
  */
  let quiz: LearnerTrainingDetail["quiz"] = null;
  const { data: attempt } = await admin
    .from("foundry_event_quiz_attempts")
    .select("id,answers,correct_count,total_count,submitted_at")
    .eq("event_id", event.id)
    .eq("participant_id", progress.participant_id)
    .maybeSingle<Attempt>();
  if (attempt) {
    const { data: quizRow } = await admin
      .from("foundry_event_quizzes")
      .select("quiz_snapshot")
      .eq("event_id", event.id)
      .maybeSingle<{ quiz_snapshot: Quiz }>();
    if (quizRow?.quiz_snapshot) quiz = learnerResult(quizRow.quiz_snapshot, attempt);
  }

  /*
    The follow-up doors for THIS record, decided by the surface that owns the rule. A failure here
    is additive-only: a learner reviewing a training must still see it when follow-up assembly is
    unavailable, so the doors are simply absent rather than an error.
  */
  let checkInAgain: readonly CheckInAgainTarget[] = [];
  let openFollowUp: readonly OpenFollowUpTarget[] = [];
  try {
    /*
      The clock and the reader's frame are ARGUMENTS to that service by design — a follow-up door
      is a "has the checkpoint arrived?" question, and the same reader-tz authority must answer it
      here as answers it on Today. A missing device tz falls back to UTC rather than to a guess.
    */
    const evidence = await listMyEvidence(admin, input.userId, new Date(), (input.timezone ?? "").trim() || "UTC");
    const mine = evidence.find((e) => e.entryId === progress.id);
    checkInAgain = mine?.checkInAgain ?? [];
    openFollowUp = mine?.openFollowUp ?? [];
  } catch {
    /* additive — never blocks the review */
  }

  return {
    ok: true,
    detail: {
      entryId: progress.id,
      eventId: event.id,
      title: event.title,
      contentType: event.content_type,
      completedAt: progress.completed_at,
      content: content ?? null,
      quiz,
      /*
        PRESENCE, NOT CONTENT. Private Reflection is the learner's own and Center is where they
        read it; this surface only needs to know whether there is something to open, so the body
        never travels here at all.

        ★ `response_text` IS NOT A REFLECTION, and including it here was wrong. It is the answer to
        the COMPLETION QUESTION — the thing a learner types to finish a non-quiz training — and it
        is written by a different step for a different purpose. A quiz-backed training has no
        completion question at all (`completionPrompt` is null exactly when `completionEvidence`
        is `"quiz"`), so conflating the two would have claimed a reflection existed for a learner
        who was never asked for one. Only `learner_reflection_text`, written by the journey's
        REFLECT step, is a reflection.
      */
      hasReflection: Boolean((progress.learner_reflection_text ?? "").trim()),
      checkInAgain,
      openFollowUp,
    },
  };
}
