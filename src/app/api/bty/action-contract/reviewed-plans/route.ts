import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { listMyReviewedActionPlans } from "@/lib/bty/action-contract/reviewedActionPlans.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/bty/action-contract/reviewed-plans (Slice 3.1B-3N-5D.1) — READ-ONLY.
 *
 * The caller's OWN approved Field Action plans ("Action plan reviewed & accepted"),
 * for the My Learning surface. Ownership comes from the session (`requireUser`), never
 * the client. The service is a pure read over `bty_action_contracts` — no write, no
 * Arena/AIR/XP effect, no `foundry_participant_followups` touch. Fail-soft: any failure
 * yields an empty list so My Learning never breaks.
 */
export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const admin = getSupabaseAdmin();
  let items = [] as Awaited<ReturnType<typeof listMyReviewedActionPlans>>;
  if (admin) {
    try {
      items = await listMyReviewedActionPlans(admin, user.id);
    } catch {
      items = [];
    }
  }

  const res = NextResponse.json({ items });
  res.headers.set("Cache-Control", "private, no-store");
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
