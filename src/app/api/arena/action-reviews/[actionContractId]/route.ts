import { NextRequest, NextResponse } from "next/server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getHostActionReviewDetail } from "@/lib/bty/arena/hostActionReviewQueue.server";
import { resolveActionReviewDecision } from "@/lib/bty/arena/actionReviewDecision.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/arena/action-reviews/[actionContractId] (Slice 3.1B-3N, Phase 5B) — READ-ONLY.
 *
 * Re-runs the Phase 5A authority resolver on THIS request (a contract's prior queue presence is
 * NOT proof of current authority). On any deny → a generic NOT_FOUND (404) so existence is never
 * leaked and the internal deny reason is never exposed. No status/verification write.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ actionContractId: string }> },
) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const { actionContractId } = await ctx.params;
  const locale = req.nextUrl.searchParams.get("locale") === "ko" ? "ko" : "en";
  const admin = getSupabaseAdmin();

  let item = null as Awaited<ReturnType<typeof getHostActionReviewDetail>>;
  if (admin) {
    try {
      item = await getHostActionReviewDetail(admin, user.id, actionContractId, locale);
    } catch {
      item = null;
    }
  }

  if (!item) {
    const out = NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const out = NextResponse.json({ item });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}

/**
 * POST /api/arena/action-reviews/[actionContractId] (Slice 3.1B-3N-5C) — reviewer decision.
 *
 * Body: { decision: "approve" | "request_revision", revisionNote?: string }. Thin handler:
 * server-resolved actor identity → canonical service (which re-resolves authority and runs
 * the atomic RPC + gated approve completion). Deny/stale never leak existence or reason.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ actionContractId: string }> },
) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const { actionContractId } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const decision = typeof body.decision === "string" ? body.decision : "";
  const revisionNote = typeof body.revisionNote === "string" ? body.revisionNote : null;

  const admin = getSupabaseAdmin();
  if (!admin) {
    const out = NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const result = await resolveActionReviewDecision(admin, {
    actorUserId: user.id,
    actionContractId,
    decision,
    revisionNote,
  });

  let out: NextResponse;
  if (result.ok) {
    out = NextResponse.json({
      ok: true,
      decision: result.decision,
      resultingStatus: result.resultingStatus,
      reviewedAt: result.reviewedAt,
    });
  } else {
    switch (result.code) {
      case "invalid_decision":
        out = NextResponse.json({ ok: false, error: "INVALID_DECISION" }, { status: 400 });
        break;
      case "note_required":
        out = NextResponse.json({ ok: false, error: "NOTE_REQUIRED" }, { status: 422 });
        break;
      case "note_too_long":
        out = NextResponse.json({ ok: false, error: "NOTE_TOO_LONG" }, { status: 422 });
        break;
      case "already_resolved":
        out = NextResponse.json(
          { ok: false, error: "ALREADY_RESOLVED", status: result.currentStatus ?? null },
          { status: 409 },
        );
        break;
      case "unsupported_source":
        // Fail-closed: an unrecognized contract source is never mutated.
        out = NextResponse.json({ ok: false, error: "UNSUPPORTED_SOURCE" }, { status: 409 });
        break;
      // unauthorized + not_found both collapse to a generic 404 (existence never leaked).
      case "unauthorized":
      case "not_found":
        out = NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
        break;
      default:
        out = NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
    }
  }
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
