import { NextRequest } from "next/server";
import { requireManager, managerJson, attachJoinUrl } from "@/lib/bty/foundry/events/managerGate";
import { listOwnerEvents } from "@/lib/bty/foundry/events/foundryEventService";
import { createTrainingEvent } from "@/lib/bty/foundry/events/foundryTrainingService";
import { createDocumentEvent } from "@/lib/bty/foundry/events/foundryDocumentService";
import { createQuickTextEvent } from "@/lib/bty/foundry/events/quickTrainingTextService";
import { verifyDocumentUploadTicket } from "@/lib/bty/foundry/events/documentUploadTicket";
import {
  attachReviewedQuiz,
  readQuizSourceKind,
  readReviewedQuiz,
} from "@/lib/bty/foundry/events/quickTrainingQuizService";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuizSourceKind } from "@/domain/foundry/events/quickTrainingQuiz";

export const runtime = "nodejs";

/**
 * Foundry Training Rooms — manager collection.
 *
 * POST /api/bty/foundry/events  — create a Quick Training. Branches on content_type:
 *   - 'youtube' (default): body { title, youtube_url, completion_prompt? }.
 *   - 'document': body { title, content_type:'document', completion_prompt?, intro?,
 *     staging_ticket } — the PDF was already staged via POST /events/upload.
 *   - 'written_guidance': body { title, content_type:'written_guidance', material_text,
 *     completion_prompt? } — TEXT material, on the existing written-guidance runtime.
 *
 *   All three accept an OPTIONAL reviewed quiz: { quiz, quiz_source: 'manual'|'csv'|'generated' }.
 *
 * THE QUIZ DECIDES WHETHER A COMPLETION QUESTION IS ASKED, and that decision is made HERE, once,
 * from the payload — before anything is created. With a quiz the learner's scored attempt is the
 * completion evidence and `completion_prompt` is stored NULL; without one the completion question
 * is required exactly as it always was. A placeholder question is never invented.
 *
 * ATOMIC: the event and its material are created first, then the quiz. A failed quiz insert
 * COMPENSATES by deleting the event it was to belong to (cascade drops the content/snapshot row),
 * so a training that was meant to be completed by a quiz never goes live without one — which
 * would be a room with no completion check at all.
 *
 * GET  /api/bty/foundry/events  — list the caller's own events (newest first) with joined counts.
 */

/** Refuse before creating anything: a malformed quiz, or one that will not say where it came from. */
type QuizIntent = { attached: false } | { attached: true; quiz: unknown; sourceKind: QuizSourceKind };

function readQuizIntent(body: unknown): QuizIntent | { error: string } {
  const raw = (body as { quiz?: unknown; quiz_source?: unknown } | null)?.quiz;
  if (raw === undefined || raw === null) return { attached: false };
  const quiz = readReviewedQuiz(raw);
  if (!quiz) return { error: "quiz_invalid" };
  const sourceKind = readQuizSourceKind((body as { quiz_source?: unknown }).quiz_source);
  if (!sourceKind) return { error: "quiz_source_invalid" };
  return { attached: true, quiz, sourceKind };
}

/** Persist the quiz, or undo the event it was to belong to. */
async function attachQuizOrCompensate(
  admin: SupabaseClient,
  eventId: string,
  ownerUserId: string,
  intent: Extract<QuizIntent, { attached: true }>,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const attached = await attachReviewedQuiz(admin, eventId, ownerUserId, intent.quiz, intent.sourceKind);
  if (attached.ok) return { ok: true };
  await admin.from("foundry_events").delete().eq("id", eventId).eq("owner_user_id", ownerUserId);
  return { ok: false, reason: attached.reason };
}

export async function POST(req: NextRequest) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const body = await req.json().catch(() => ({}));

  const quizIntent = readQuizIntent(body);
  if ("error" in quizIntent) return managerJson(base, req, { error: quizIntent.error }, 400);
  const quizAttached = quizIntent.attached;

  if (body?.content_type === "document") {
    // The staging ticket carries the SERVER-derived canonical values; the client
    // supplies none of them. Verify signature + owner + freshness before trusting.
    const verified = verifyDocumentUploadTicket(body?.staging_ticket, Date.now());
    if (!verified.ok) return managerJson(base, req, { error: verified.reason }, 400);
    if (verified.payload.ownerId !== user.id) {
      return managerJson(base, req, { error: "upload_invalid" }, 403);
    }
    const p = verified.payload;
    const result = await createDocumentEvent(admin, user.id, {
      title: body?.title,
      intro: body?.intro,
      completion_prompt: body?.completion_prompt,
      quiz_attached: quizAttached,
      canonical: {
        bucket: p.bucket,
        path: p.path,
        byteSize: p.byteSize,
        pageCount: p.pageCount,
        pageCountVerified: p.pageCountVerified,
        contentHash: p.contentHash,
        fileName: p.fileName,
        sourceType: p.sourceType,
        originalFileId: p.originalFileId,
      },
    });
    if (!result.ok) return managerJson(base, req, { error: result.reason }, 400);
    if (quizIntent.attached) {
      const quiz = await attachQuizOrCompensate(admin, result.value.event.id, user.id, quizIntent);
      if (!quiz.ok) return managerJson(base, req, { error: quiz.reason }, 400);
    }
    return managerJson(base, req, attachJoinUrl(req, result.value), 201);
  }

  if (body?.content_type === "written_guidance") {
    const result = await createQuickTextEvent(admin, user.id, {
      title: body?.title,
      material_text: body?.material_text,
      completion_prompt: body?.completion_prompt,
      quiz_attached: quizAttached,
    });
    if (!result.ok) return managerJson(base, req, { error: result.reason }, 400);
    if (quizIntent.attached) {
      const quiz = await attachQuizOrCompensate(admin, result.value.event.id, user.id, quizIntent);
      if (!quiz.ok) return managerJson(base, req, { error: quiz.reason }, 400);
    }
    return managerJson(base, req, attachJoinUrl(req, result.value), 201);
  }

  const result = await createTrainingEvent(admin, user.id, {
    title: body?.title,
    youtube_url: body?.youtube_url,
    completion_prompt: body?.completion_prompt,
    quiz_attached: quizAttached,
  });
  if (!result.ok) return managerJson(base, req, { error: result.reason }, 400);
  if (quizIntent.attached) {
    const quiz = await attachQuizOrCompensate(admin, result.value.event.id, user.id, quizIntent);
    if (!quiz.ok) return managerJson(base, req, { error: quiz.reason }, 400);
  }

  return managerJson(base, req, attachJoinUrl(req, result.value), 201);
}

export async function GET(req: NextRequest) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const events = await listOwnerEvents(admin, user.id);
  return managerJson(base, req, { events });
}
