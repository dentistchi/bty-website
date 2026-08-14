import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { listUserFoundryHistory, toThreadRecords } from "@/lib/bty/foundry/events/foundryHistoryService";
import { restoreLivingThread } from "@/lib/bty/foundry/events/livingThreadService";
import { THREAD_STATUS_COPY } from "@/lib/bty/foundry/events/livingThreadExpression";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/history — the caller's completed Foundry trainings +, if a
 * Living Thread has ALREADY been generated for the current evidence, that thread.
 *
 * This path never calls the provider (restore-only) so History renders immediately;
 * an eligible-but-not-yet-generated thread is signalled via `threadNeedsGeneration`
 * and produced by a separate POST to `/history/thread`. Ownership: the user id
 * comes from the session (`requireUser`), never the client; the service-role read
 * is always scoped to that user's `linked_user_id`. A thread outcome never blocks
 * history and never surfaces an error to the employee.
 */
export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const admin = getSupabaseAdmin();
  if (!admin) {
    const res = NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  const items = await listUserFoundryHistory(admin, user.id);

  let thread = null;
  let threadStatus: string = "none";
  let threadStatusCopy: string | null = null;
  let threadNeedsGeneration = false;
  try {
    const result = await restoreLivingThread(admin, user.id, toThreadRecords(items));
    threadStatus = result.status;
    threadStatusCopy = THREAD_STATUS_COPY[result.status];
    if (result.status === "eligible") {
      thread = result.thread;
      threadNeedsGeneration = result.needsGeneration;
    }
  } catch {
    threadStatus = "none";
  }

  const res = NextResponse.json({
    ok: true,
    history: items.map((it) => ({
      entryId: it.entryId,
      eventId: it.eventId,
      eventTitle: it.eventTitle,
      contentType: it.contentType,
      sharedUnderstanding: it.sharedUnderstanding,
      completedAt: it.completedAt,
      responseText: it.responseText,
      responseExcerpt: it.responseExcerpt,
      // The learner's own REFLECT answer (Slice 3.2R-R8D-R1). This route is authenticated and
      // owner-scoped; it is the only surface allowed to carry it, and Center is what renders it.
      learnerReflection: it.learnerReflection,
      aiReflection: it.aiReflection,
      aiReflectionLine: it.aiReflectionLine,
      completionState: it.completionState,
    })),
    thread,
    threadStatus,
    threadStatusCopy,
    threadNeedsGeneration,
  });
  // Private Reflection body travels here → never cache it anywhere (Slice 3.1B-3I).
  res.headers.set("Cache-Control", "private, no-store");
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
