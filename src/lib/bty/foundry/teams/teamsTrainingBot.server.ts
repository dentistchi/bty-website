import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPersonalAppLink } from "@/domain/teams/personalAppLink";
import type { LearnerAnswer, Quiz } from "@/domain/foundry/events/quickTrainingQuiz";
import {
  buildCompletionCard,
  buildNoticeCard,
  buildQuestionCard,
  buildReadCard,
  BTY_TRAINING_VERBS,
  type BtyTrainingVerb,
} from "@/domain/teams/trainingCard";
import {
  newTeamsSession,
  sessionAfterAnswer,
  sessionAfterRead,
  sessionSurface,
  type TeamsTrainingSession,
} from "@/domain/teams/trainingSession";
import { readGuidanceContent } from "@/lib/bty/foundry/events/foundryGuidanceService";
import { finalizeQuizAttempt, readEventQuiz } from "@/lib/bty/foundry/events/quickTrainingQuizService";
import type { EventRow, ParticipantRow } from "@/lib/bty/foundry/events/foundryEventService";
import { ensureTeamsParticipant } from "./teamsParticipant.server";

/**
 * THE LEARNER'S LOOP, INSIDE A TEAMS CHAT.
 * SERVER ONLY. Slice Teams Chat-Native Text Training + Quiz V1.
 *
 * read → question 1 … question N → score → completion, each step one card that replaces the last.
 *
 * ★ EVERY ACTION RE-ESTABLISHES WHO IS ASKING. The caller has verified the Bot Framework token and
 * derived `(tenantId, aadObjectId)` from the activity. This module then requires that the DELIVERY
 * named by the card belongs to exactly that tuple. So recipient A tapping a card addressed to
 * recipient B is refused — the card's id is a handle, never an authorization.
 *
 * ★ NO SECOND ENGINE. Scoring and completion go through `finalizeQuizAttempt`, the same function
 * the web room uses: one immutable attempt, one canonical completion, one XP path. Nothing here
 * computes a score, and the answer key is never read outside it.
 *
 * ★ NO XP AT THE READ STEP. Acknowledging the text stamps `written_guidance_read_at` — exposure
 * evidence, the same rung the web room records — and nothing else. Completion happens once, at the
 * end, through the canonical finalizer.
 */

const COPY = {
  notForYou: "This training was sent to someone else.",
  gone: "This training is no longer available.",
  unsupported: "This training can't be taken in Teams yet.",
  busy: "Something went wrong. Please try again in a moment.",
  stale: "That card is out of date — here is where you are.",
} as const;

export type BotActionResult = { card: Record<string, unknown> };

type DeliveryRow = {
  id: string;
  event_id: string;
  tenant_id: string;
  aad_object_id: string;
  display_name_snapshot: string | null;
};

type SessionRow = {
  delivery_id: string;
  participant_id: string;
  state: "READING" | "QUIZ" | "COMPLETED";
  current_question_index: number;
  /*
    The session stores only ANSWERED questions, so its choice id is always present — unlike the
    canonical `LearnerAnswer`, whose choice may be null for a question the learner skipped. The
    two shapes are deliberately not the same type.
  */
  answers: { questionId: string; choiceId: string }[];
};

type ProgressRow = {
  id: string;
  video_completed_at: string | null;
  document_read_completed_at: string | null;
  written_guidance_read_at: string | null;
  completed_at: string | null;
  quiz_attempt_id: string | null;
};

const PROGRESS_COLS =
  "id,video_completed_at,document_read_completed_at,written_guidance_read_at,completed_at,quiz_attempt_id";

const notice = (text: string): BotActionResult => ({ card: buildNoticeCard(text) });

/**
 * The delivery this card names, ONLY IF it belongs to the caller.
 *
 * The tuple comparison is the authorization. A delivery id is a random uuid and is not secret in
 * any useful sense once a card has been rendered on a device, so it must never be sufficient on
 * its own — and here it is not.
 */
async function authorizeDelivery(
  admin: SupabaseClient,
  deliveryId: string,
  tenantId: string,
  aadObjectId: string,
): Promise<DeliveryRow | null> {
  const { data } = await admin
    .from("foundry_teams_training_deliveries")
    .select("id, event_id, tenant_id, aad_object_id, display_name_snapshot")
    .eq("id", deliveryId)
    .maybeSingle<DeliveryRow>();
  if (!data) return null;
  if (data.tenant_id !== tenantId || data.aad_object_id !== aadObjectId) return null;
  return data;
}

async function readSession(admin: SupabaseClient, deliveryId: string): Promise<SessionRow | null> {
  const { data } = await admin
    .from("foundry_teams_training_sessions")
    .select("delivery_id, participant_id, state, current_question_index, answers")
    .eq("delivery_id", deliveryId)
    .maybeSingle<SessionRow>();
  return data ?? null;
}

async function writeSession(
  admin: SupabaseClient,
  deliveryId: string,
  participantId: string,
  session: TeamsTrainingSession,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await admin.from("foundry_teams_training_sessions").upsert(
    {
      delivery_id: deliveryId,
      participant_id: participantId,
      state: session.state,
      current_question_index: session.currentQuestionIndex,
      answers: session.answers,
      updated_at: now,
      completed_at: session.state === "COMPLETED" ? now : null,
    },
    { onConflict: "delivery_id" },
  );
  if (error) console.error("[teams-training] session write failed", { code: error.code ?? "unknown" });
  return !error;
}

/** Get-or-create the canonical progress row for this (event, participant). */
async function ensureProgress(
  admin: SupabaseClient,
  eventId: string,
  participantId: string,
): Promise<ProgressRow | null> {
  const read = async () => {
    const { data } = await admin
      .from("foundry_event_training_progress")
      .select(PROGRESS_COLS)
      .eq("event_id", eventId)
      .eq("participant_id", participantId)
      .maybeSingle<ProgressRow>();
    return data ?? null;
  };
  const existing = await read();
  if (existing) return existing;
  const { data } = await admin
    .from("foundry_event_training_progress")
    .insert({ event_id: eventId, participant_id: participantId })
    .select(PROGRESS_COLS)
    .maybeSingle<ProgressRow>();
  return data ?? (await read());
}

/** The deployment these cards link back into. */
const BTY_ORIGIN = "https://arena.btydaily.com";

type Loaded = {
  delivery: DeliveryRow;
  event: EventRow;
  quiz: Quiz;
  participant: ParticipantRow;
  participantUserId: string | null;
  progress: ProgressRow;
  session: TeamsTrainingSession;
  materialText: string;
  title: string;
};

/**
 * Everything one action needs, or a card explaining why not.
 *
 * V1 IS TEXT + QUIZ. A delivery whose event is not `written_guidance`, or has no attached quiz,
 * gets a calm "not yet" rather than a broken card — the Host was already refused at send time, so
 * this only catches a training that changed underneath a delivered card.
 */
async function load(
  admin: SupabaseClient,
  deliveryId: string,
  tenantId: string,
  aadObjectId: string,
): Promise<{ ok: true; value: Loaded } | { ok: false; card: Record<string, unknown> }> {
  const delivery = await authorizeDelivery(admin, deliveryId, tenantId, aadObjectId);
  if (!delivery) return { ok: false, card: buildNoticeCard(COPY.notForYou) };

  const { data: event } = await admin
    .from("foundry_events")
    .select("id, owner_user_id, title, status, content_type, join_version, created_at, closed_at")
    .eq("id", delivery.event_id)
    .maybeSingle<EventRow>();
  if (!event) return { ok: false, card: buildNoticeCard(COPY.gone) };
  if (event.content_type !== "written_guidance") return { ok: false, card: buildNoticeCard(COPY.unsupported) };

  const content = await readGuidanceContent(admin, event.id);
  if (!content) return { ok: false, card: buildNoticeCard(COPY.gone) };

  const quiz = await readEventQuiz(admin, event.id);
  if (!quiz) return { ok: false, card: buildNoticeCard(COPY.unsupported) };

  const ensured = await ensureTeamsParticipant(admin, {
    eventId: event.id,
    tenantId,
    aadObjectId,
    displayNameSnapshot: delivery.display_name_snapshot,
  });
  if (!ensured.ok) return { ok: false, card: buildNoticeCard(ensured.reason === "removed" ? COPY.gone : COPY.busy) };

  const progress = await ensureProgress(admin, event.id, ensured.participant.id);
  if (!progress) return { ok: false, card: buildNoticeCard(COPY.busy) };

  const row = await readSession(admin, deliveryId);
  const session: TeamsTrainingSession = row
    ? { state: row.state, currentQuestionIndex: row.current_question_index, answers: row.answers ?? [] }
    : newTeamsSession();

  return {
    ok: true,
    value: {
      delivery,
      event,
      quiz,
      participant: { id: ensured.participant.id, event_id: event.id, display_name: ensured.participant.displayName, status: "joined", user_id: ensured.participant.userId } as ParticipantRow,
      participantUserId: ensured.participant.userId,
      progress,
      session,
      materialText: content.materialText,
      title: event.title,
    },
  };
}

/** The card for wherever this learner actually is. One place decides, so every path agrees. */
function surfaceCard(loaded: Loaded): Record<string, unknown> {
  const surface = sessionSurface(loaded.session, loaded.quiz.questions.length);
  if (surface.kind === "read") {
    return buildReadCard({
      deliveryId: loaded.delivery.id,
      title: loaded.title,
      materialText: loaded.materialText,
    });
  }
  if (surface.kind === "question") {
    const q = loaded.quiz.questions[surface.index]!;
    return buildQuestionCard({
      deliveryId: loaded.delivery.id,
      questionIndex: surface.index,
      total: loaded.quiz.questions.length,
      question: { text: q.text, choices: q.choices },
    });
  }
  return buildNoticeCard(COPY.stale);
}

/**
 * Handle one verified card action.
 *
 * `tenantId` / `aadObjectId` are the caller's, derived from an activity whose Bot Framework token
 * has already been verified. Nothing in `action` is trusted for identity.
 */
export async function handleTrainingCardAction(
  admin: SupabaseClient,
  action: { verb: BtyTrainingVerb; deliveryId: string; questionIndex: number | null; choiceId: string | null },
  caller: { tenantId: string; aadObjectId: string },
): Promise<BotActionResult> {
  const loadedOrCard = await load(admin, action.deliveryId, caller.tenantId, caller.aadObjectId);
  if (!loadedOrCard.ok) return { card: loadedOrCard.card };
  const loaded = loadedOrCard.value;

  // A finished training always shows its result, whatever was tapped.
  if (loaded.session.state === "COMPLETED") {
    const attemptCard = await completionCardFor(admin, loaded);
    return { card: attemptCard };
  }

  if (action.verb === BTY_TRAINING_VERBS.resume) return { card: surfaceCard(loaded) };

  if (action.verb === BTY_TRAINING_VERBS.read) {
    /*
      EXPOSURE EVIDENCE, TRUTHFULLY AND ONCE. The learner acknowledged reading the guidance that
      was rendered on their screen — the same rung, and the same column, the web room records. It
      awards nothing: Core XP is decided only by the canonical completion at the end.
    */
    if (!loaded.progress.written_guidance_read_at) {
      const now = new Date().toISOString();
      const { error } = await admin
        .from("foundry_event_training_progress")
        .update({ written_guidance_read_at: now, updated_at: now })
        .eq("id", loaded.progress.id)
        .is("written_guidance_read_at", null);
      if (error) {
        console.error("[teams-training] read stamp failed", { code: error.code ?? "unknown" });
        return notice(COPY.busy);
      }
      loaded.progress.written_guidance_read_at = now;
    }
    const next = sessionAfterRead(loaded.session);
    if (!(await writeSession(admin, loaded.delivery.id, loaded.participant.id, next))) return notice(COPY.busy);
    loaded.session = next;
    return { card: surfaceCard(loaded) };
  }

  // ---- The answer ----
  if (action.questionIndex === null || action.choiceId === null) return notice(COPY.busy);
  const index = action.questionIndex;
  const question = loaded.quiz.questions[loaded.session.currentQuestionIndex];
  if (!question) return { card: surfaceCard(loaded) };

  // The choice must exist on the question the SERVER believes is current. Correctness is not read.
  const chosen = question.choices.find((c) => c.id === action.choiceId);
  if (!chosen) return { card: surfaceCard(loaded) };

  const outcome = sessionAfterAnswer(loaded.session, {
    expectedIndex: index,
    questionId: question.id,
    choiceId: chosen.id,
    totalQuestions: loaded.quiz.questions.length,
  });

  // A stale or duplicate tap re-renders where the learner actually is. It is not an error.
  if (outcome.kind === "replay" || outcome.kind === "not_in_quiz") return { card: surfaceCard(loaded) };

  if (outcome.kind === "advanced") {
    if (!(await writeSession(admin, loaded.delivery.id, loaded.participant.id, outcome.session))) {
      return notice(COPY.busy);
    }
    loaded.session = outcome.session;
    return { card: surfaceCard(loaded) };
  }

  /*
    ---- THE FINAL ANSWER ----

    The canonical answers are built from SERVER session state, never from the card. They go to the
    same `finalizeQuizAttempt` the web room uses, which scores against the immutable event quiz,
    writes the one immutable attempt, completes the canonical progress row and runs the canonical
    completion finalizer — XP, follow-up, apply window and assignment claim included, idempotently.
  */
  if (!(await writeSession(admin, loaded.delivery.id, loaded.participant.id, outcome.session))) {
    return notice(COPY.busy);
  }
  loaded.session = outcome.session;

  const answers: LearnerAnswer[] = loaded.quiz.questions.map((q, i) => ({
    questionId: q.id,
    choiceId: outcome.session.answers[i]?.choiceId ?? null,
  }));

  const finalized = await finalizeQuizAttempt(admin, {
    event: loaded.event,
    participant: loaded.participant,
    progress: loaded.progress,
    quiz: loaded.quiz,
    answers,
    // The canonical account when this person has one; NULL never blocks the completion.
    authUserId: loaded.participantUserId,
  });
  if (!finalized.ok) {
    console.error("[teams-training] finalize refused", { reason: finalized.reason });
    return notice(COPY.busy);
  }
  return {
    card: buildCompletionCard({
      correctCount: finalized.result.correctCount,
      totalCount: finalized.result.totalCount,
      scorePercent: finalized.result.scorePercent,
      reviewUrl: reviewLinkFor(loaded),
    }),
  };
}

/**
 * Where "View in My Learning" points: the BTY Personal App, at THIS completed training.
 *
 * `loaded.progress.id` is the entry id the learner's own history is keyed by, and
 * `?tab=learn&view=my-learning&entry=<id>` is the shell's existing deep-link contract — the same
 * one Today already uses. No new destination vocabulary, and no web URL.
 */
function reviewLinkFor(loaded: Loaded): string | null {
  return buildPersonalAppLink({
    origin: BTY_ORIGIN,
    search: `?tab=learn&view=my-learning&entry=${encodeURIComponent(loaded.progress.id)}`,
    label: loaded.title,
  });
}

/** The completion card for a training already finished, read from the canonical attempt. */
async function completionCardFor(admin: SupabaseClient, loaded: Loaded): Promise<Record<string, unknown>> {
  const { data } = await admin
    .from("foundry_event_quiz_attempts")
    .select("correct_count,total_count")
    .eq("event_id", loaded.event.id)
    .eq("participant_id", loaded.participant.id)
    .maybeSingle<{ correct_count: number; total_count: number }>();
  if (!data) return buildNoticeCard(COPY.stale);
  return buildCompletionCard({
    correctCount: data.correct_count,
    totalCount: data.total_count,
    scorePercent: Math.round((data.correct_count * 100) / data.total_count),
    reviewUrl: reviewLinkFor(loaded),
  });
}
