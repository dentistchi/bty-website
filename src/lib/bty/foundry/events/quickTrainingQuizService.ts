import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isQuizSourceKind,
  learnerQuizPayload,
  scoreQuiz,
  validateQuiz,
  type LearnerAnswer,
  type Quiz,
  type QuizSourceKind,
} from "@/domain/foundry/events/quickTrainingQuiz";
import { finalizeCanonicalTrainingCompletion, resolvePublic } from "./foundryTrainingService";

type Progress = { id: string; video_completed_at: string | null; document_read_completed_at: string | null; written_guidance_read_at: string | null; completed_at: string | null; quiz_attempt_id: string | null };
type Attempt = { id: string; answers: LearnerAnswer[]; correct_count: number; total_count: number; submitted_at: string };
/**
 * Is this payload a quiz the server will accept? Pure structural read, used by the create route
 * BEFORE anything is written, so "a quiz is attached" and "the completion question is not asked"
 * are decided from the same fact.
 */
export function readReviewedQuiz(rawQuiz: unknown): Quiz | null {
  if (!rawQuiz || typeof rawQuiz !== "object") return null;
  const quiz = rawQuiz as Quiz;
  if (!Array.isArray(quiz.questions)) return null;
  if (quiz.schemaVersion !== 1) return null;
  for (const q of quiz.questions) {
    if (!q || typeof q !== "object") return null;
    if (typeof q.id !== "string" || typeof q.text !== "string") return null;
    if (typeof q.correctChoiceId !== "string" || typeof q.position !== "number") return null;
    if (!Array.isArray(q.choices)) return null;
    for (const c of q.choices) {
      if (!c || typeof c !== "object" || typeof c.id !== "string" || typeof c.label !== "string") return null;
    }
    if (q.explanation !== undefined && typeof q.explanation !== "string") return null;
  }
  return validateQuiz(quiz) ? null : quiz;
}

/**
 * HOW THE QUIZ SAYS IT CAME TO EXIST. The client names the authoring method; an unrecognised or
 * missing value is NOT silently coerced to `manual`, because `manual` is a claim that a person
 * wrote these questions and a quiz an AI drafted must never carry it. A bad value is refused.
 */
export function readQuizSourceKind(raw: unknown): QuizSourceKind | null {
  return isQuizSourceKind(raw) ? raw : null;
}

/**
 * Persist the quiz a manager reviewed. Nothing an AI produced and nothing a CSV contained
 * reaches this function without passing through the manager's editor first — this is the ONLY
 * writer of `foundry_event_quizzes`, and it re-validates rather than trusting the client.
 */
export async function attachReviewedQuiz(
  admin: SupabaseClient,
  eventId: string,
  ownerUserId: string,
  rawQuiz: unknown,
  sourceKind: QuizSourceKind,
) {
  const quiz = readReviewedQuiz(rawQuiz);
  if (!quiz) return { ok: false as const, reason: "quiz_invalid" };
  const { error } = await admin.from("foundry_event_quizzes").insert({
    event_id: eventId,
    source_kind: sourceKind,
    quiz_snapshot: quiz,
    question_count: quiz.questions.length,
    created_by_user_id: ownerUserId,
  });
  return error ? { ok: false as const, reason: "quiz_insert_failed" } : { ok: true as const };
}
export const quizStudyComplete = (p: Omit<Progress, "id" | "completed_at" | "quiz_attempt_id">) => Boolean(p.video_completed_at || p.document_read_completed_at || p.written_guidance_read_at);

function learnerResult(quiz: Quiz, attempt: Attempt) {
  const byQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer.choiceId]));
  return { correctCount: attempt.correct_count, totalCount: attempt.total_count, scorePercent: Math.round((attempt.correct_count * 100) / attempt.total_count), submittedAt: attempt.submitted_at, questions: quiz.questions.map((q) => ({ id: q.id, text: q.text, choices: q.choices, selectedChoiceId: byQuestion.get(q.id) ?? null, correctChoiceId: q.correctChoiceId, explanation: q.explanation ?? null })) };
}
async function readQuiz(admin: SupabaseClient, eventId: string): Promise<Quiz | null> {
  const { data } = await admin.from("foundry_event_quizzes").select("quiz_snapshot").eq("event_id", eventId).maybeSingle<{ quiz_snapshot: Quiz }>();
  return data?.quiz_snapshot ?? null;
}
async function readAttempt(admin: SupabaseClient, eventId: string, participantId: string): Promise<Attempt | null> {
  const { data } = await admin.from("foundry_event_quiz_attempts").select("id,answers,correct_count,total_count,submitted_at").eq("event_id", eventId).eq("participant_id", participantId).maybeSingle<Attempt>();
  return data ?? null;
}

/** Learner projection hides answers until this participant has submitted. */
export async function publicQuiz(admin: SupabaseClient, token: string, sessionToken: string | null | undefined) {
  const resolved = await resolvePublic(admin, token, sessionToken);
  if (!resolved.ok) return resolved;
  const quiz = await readQuiz(admin, resolved.event.id);
  if (!quiz) return { ok: false as const, reason: "quiz_missing" };
  const attempt = await readAttempt(admin, resolved.event.id, resolved.participant.id);
  return attempt ? { ok: true as const, submitted: true as const, result: learnerResult(quiz, attempt) } : { ok: true as const, submitted: false as const, quiz: learnerQuizPayload(quiz) };
}

/** Persist once, then retry only canonical finalization from the same attempt. */
export async function submitPublicQuiz(admin: SupabaseClient, token: string, sessionToken: string | null | undefined, authUserId: string | null, answers: LearnerAnswer[], deviceTz?: string | null) {
  const resolved = await resolvePublic(admin, token, sessionToken);
  if (!resolved.ok) return resolved;
  if (resolved.event.status === "closed") return { ok: false as const, reason: "event_closed" };
  const { data: progress } = await admin.from("foundry_event_training_progress").select("id,video_completed_at,document_read_completed_at,written_guidance_read_at,completed_at,quiz_attempt_id").eq("event_id", resolved.event.id).eq("participant_id", resolved.participant.id).maybeSingle<Progress>();
  if (!progress || !quizStudyComplete(progress)) return { ok: false as const, reason: "study_required" };
  const quiz = await readQuiz(admin, resolved.event.id);
  if (!quiz) return { ok: false as const, reason: "quiz_missing" };
  let attempt = await readAttempt(admin, resolved.event.id, resolved.participant.id);
  let reused = Boolean(attempt);
  if (!attempt) {
    const scored = scoreQuiz(quiz, answers); if (!scored.ok) return scored;
    const { data, error } = await admin.from("foundry_event_quiz_attempts").insert({ event_id: resolved.event.id, participant_id: resolved.participant.id, answers, correct_count: scored.correctCount, total_count: scored.totalCount, submitted_at: new Date().toISOString() }).select("id,answers,correct_count,total_count,submitted_at").maybeSingle<Attempt>();
    if (error || !data) { attempt = await readAttempt(admin, resolved.event.id, resolved.participant.id); reused = true; if (!attempt) return { ok: false as const, reason: "attempt_write_failed" }; } else attempt = data;
  }
  if (!progress.completed_at) {
    const { data: completed } = await admin.from("foundry_event_training_progress").update({ quiz_attempt_id: attempt.id, completed_at: attempt.submitted_at, updated_at: new Date().toISOString() }).eq("id", progress.id).is("completed_at", null).select("completed_at,quiz_attempt_id").maybeSingle<{ completed_at: string; quiz_attempt_id: string | null }>();
    if (!completed) { const { data: reread } = await admin.from("foundry_event_training_progress").select("completed_at,quiz_attempt_id").eq("id", progress.id).single<{ completed_at: string | null; quiz_attempt_id: string | null }>(); if (!reread?.completed_at || reread.quiz_attempt_id !== attempt.id) return { ok: false as const, reason: "completion_write_failed" }; progress.completed_at = reread.completed_at; progress.quiz_attempt_id = reread.quiz_attempt_id; } else { progress.completed_at = completed.completed_at; progress.quiz_attempt_id = completed.quiz_attempt_id; }
  }
  if (progress.quiz_attempt_id && progress.quiz_attempt_id !== attempt.id) return { ok: false as const, reason: "attempt_mismatch" };
  const finalized = await finalizeCanonicalTrainingCompletion(admin, { event: resolved.event, participant: resolved.participant, progressId: progress.id, completedAt: progress.completed_at ?? attempt.submitted_at, authUserId, deviceTz });
  return { ok: true as const, alreadySubmitted: reused, result: learnerResult(quiz, attempt), ...finalized };
}
