/**
 * GET /api/bty/dashboard/integrity?refresh=1
 * Single-call {@link getIntegrityDashboard} for the session user (active league → team TII).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getIntegrityDashboard,
  invalidateIntegrityDashboardCache,
} from "@/engine/integrity/integrity-dashboard.service";
import { getActiveLeague } from "@/lib/bty/arena/activeLeague";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const admin = getSupabaseAdmin();
  const league = await getActiveLeague(supabase, admin);
  const teamId = league?.league_id ?? null;

  if (req.nextUrl.searchParams.get("refresh") === "1") {
    invalidateIntegrityDashboardCache(user.id, teamId);
  }

  try {
    const payload = await getIntegrityDashboard(user.id, teamId);
    const res = NextResponse.json(payload);
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const res = NextResponse.json({ error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
