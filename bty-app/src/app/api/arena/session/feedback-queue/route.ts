import { NextRequest, NextResponse } from "next/server";
import type { SessionFlagBadgeVariant } from "@/domain/arena/sessionSummary";
import { enqueueFeedbackPrompt } from "@/engine/scenario/scenario-feedback.service";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

function parseBadge(v: unknown): SessionFlagBadgeVariant | null {
  if (v === "hero_trap" || v === "integrity_slip" || v === "clean") return v;
  return null;
}

/**
 * POST /api/arena/session/feedback-queue — after {@link SessionSummaryOverlay} dismiss for trap/slip.
 */
export async function POST(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const scenarioId = typeof b.scenarioId === "string" ? b.scenarioId.trim() : "";
  const sessionFlagBadge = parseBadge(b.sessionFlagBadge);
  if (!scenarioId || !sessionFlagBadge) {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  try {
    await enqueueFeedbackPrompt(user.id, scenarioId, sessionFlagBadge, supabase);
    const res = NextResponse.json({ ok: true });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "enqueue_failed";
    const res = NextResponse.json({ ok: false, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
