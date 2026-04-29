/**
 * GET /api/arena/session/delayed-outcomes?locale=ko|en
 * Due delayed outcomes for the signed-in user — {@link getDueOutcomes}.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDueOutcomes } from "@/engine/scenario/delayed-outcome-trigger.service";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const locale = req.nextUrl.searchParams.get("locale") === "en" ? "en" : "ko";
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "ADMIN_UNAVAILABLE" }, { status: 503 });
  }

  try {
    const outcomes = await getDueOutcomes(user.id, { locale, supabase: admin });
    const res = NextResponse.json({ ok: true, outcomes });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const res = NextResponse.json({ error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
