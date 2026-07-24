import { NextRequest, NextResponse } from "next/server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  getHostActionReviewStageCounts,
  listHostActionReviewQueue,
} from "@/lib/bty/arena/hostActionReviewQueue.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/arena/action-review-queue (Slice 3.1B-3N, Phase 5B) — READ-ONLY.
 *
 * The authenticated Host's reviewable Action Contract queue ONLY. Authority is decided per
 * candidate by the Phase 5A resolver; a non-Host / no-edge actor gets an empty list (200).
 * No client-supplied reviewer/learner/org/edge id is accepted. No status/verification write.
 *
 * PATH NOTE: this is a top-level static segment (NOT an index under the `action-reviews/[id]`
 * dynamic route) — the opennextjs-cloudflare runtime 404s an index route that is a sibling of a
 * `[param]` route, so the queue and the detail live under distinct segments.
 */
export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const locale = req.nextUrl.searchParams.get("locale") === "ko" ? "ko" : "en";
  const admin = getSupabaseAdmin();

  let items = [] as Awaited<ReturnType<typeof listHostActionReviewQueue>>;
  let stageCounts = {
    verificationPending: 0,
    needsRevision: 0,
    reviewedAccepted: 0,
    awaitingResolution: 0,
  } as Awaited<ReturnType<typeof getHostActionReviewStageCounts>>;
  if (admin) {
    try {
      items = await listHostActionReviewQueue(admin, user.id, locale);
    } catch {
      items = []; // fail-soft: a projection failure must never break Today
    }
    // Independent read (Slice 3.1B-3N-5D.1) — operational stage counts, own isolated failure.
    try {
      stageCounts = await getHostActionReviewStageCounts(admin, user.id);
    } catch {
      /* fail-soft — the counts row is simply omitted */
    }
  }

  const out = NextResponse.json({ items, stageCounts });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
