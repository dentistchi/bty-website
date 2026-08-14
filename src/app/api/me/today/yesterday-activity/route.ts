/**
 * GET /api/me/today/yesterday-activity — canonical prior-day counts for the Today
 * "Yesterday" section (Slice 3.2C-B3A.2B). Read-only, local BTY-day boundary,
 * fail-soft per category (an unavailable source is omitted, never estimated).
 * Returns { ok, counts: { trainingsCompleted?, trainingsCreated?, centerReflections?, presence } }.
 */
import { NextRequest, NextResponse } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { loadYesterdayActivity } from "@/lib/bty/daily/yesterdayActivity.server";

export const dynamic = "force-dynamic";

const noStore = (res: NextResponse) => {
  res.headers.set("Cache-Control", "no-store");
  return res;
};

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return noStore(NextResponse.json({ ok: false, code: "UNAUTHENTICATED", counts: null }, { status: 401 }));
    if (!(await isConsentCurrent(supabase, user.id))) return consentRequiredResponse();

    const admin = getSupabaseAdmin();
    if (!admin) return noStore(NextResponse.json({ ok: true, counts: null }, { status: 200 }));

    const tz = req.nextUrl.searchParams.get("tz");
    const counts = await loadYesterdayActivity(admin, user.id, new Date(), tz || null);
    return noStore(NextResponse.json({ ok: true, counts }, { status: 200 }));
  } catch {
    // Fail-soft: a read failure must never break Today's arrival.
    return noStore(NextResponse.json({ ok: true, counts: null }, { status: 200 }));
  }
}
