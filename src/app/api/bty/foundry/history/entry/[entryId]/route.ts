import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireConsentedUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { readLearnerTrainingDetail } from "@/lib/bty/foundry/events/learnerTrainingDetail.server";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/history/entry/:entryId — one completed training, for the learner who completed it.
 * Slice My Learning — Canonical Training History V1.
 *
 * The sibling collection route answers "what have I completed". This answers "what did I actually
 * learn, and what did I get wrong" — the question a learner comes back weeks later to ask, which a
 * chat card cannot answer and a list should not try to.
 *
 * ★ WHY `history/entry/:id` AND NOT `history/:id`. A dynamic segment directly beside the existing
 * static `history/thread` is the shape that has 404'd in this deployment before: `next build`
 * matches both happily and the Cloudflare adapter then lets the dynamic sibling shadow the static
 * one at runtime. A static `entry/` segment removes the ambiguity entirely rather than relying on
 * matcher ordering.
 *
 * OWNER-SCOPED BY `linked_user_id`, the same rule the list uses. It returns the objective quiz and
 * the learner's own answers; the private reflection BODY is not returned at all — only whether one
 * exists, so the surface can offer to open it in Center where it belongs.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ entryId: string }> }) {
  const { user, base, consentDenied } = await requireConsentedUser(req);
  if (!user) return unauthenticated(req, base);
  if (consentDenied) return consentDenied;

  const admin = getSupabaseAdmin();
  if (!admin) {
    const res = NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  const { entryId } = await ctx.params;
  const result = await readLearnerTrainingDetail(admin, { userId: user.id, entryId });
  const res = result.ok
    ? NextResponse.json({ ok: true, ...result.detail })
    : NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  // Learner-private by definition: never cache it anywhere.
  res.headers.set("Cache-Control", "private, no-store");
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
