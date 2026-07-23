import { NextRequest, NextResponse } from "next/server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getHostActionReviewDetail } from "@/lib/bty/arena/hostActionReviewQueue.server";

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
