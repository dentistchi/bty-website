/**
 * GET /api/bty/avatar/badge-context?userId=
 * Awakening milestone completions + Certified Leader grant (for 배지 tab).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const userId = req.nextUrl.searchParams.get("userId")?.trim() ?? "";
  if (!userId) {
    return NextResponse.json({ error: "MISSING_USER_ID" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "ADMIN_UNAVAILABLE" }, { status: 503 });
  }

  const [milestonesRes, grantRes] = await Promise.all([
    admin.from("user_awakening_milestones").select("milestone_id").eq("user_id", userId),
    admin
      .from("certified_leader_grants")
      .select("status, expires_at")
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .maybeSingle(),
  ]);

  const completedMilestoneIds =
    milestonesRes.error || !milestonesRes.data
      ? []
      : (milestonesRes.data as { milestone_id: string }[]).map((r) => r.milestone_id);

  const grant = grantRes.data as { status?: string; expires_at?: string } | null;
  const now = Date.now();
  const certifiedLeaderActive =
    grant != null &&
    grant.status === "ACTIVE" &&
    typeof grant.expires_at === "string" &&
    new Date(grant.expires_at).getTime() > now;

  const res = NextResponse.json({
    completedMilestoneIds,
    certifiedLeaderActive,
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
