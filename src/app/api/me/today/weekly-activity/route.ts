/**
 * GET /api/me/today/weekly-activity — canonical last-7-day counts for the Me
 * "This week" summary (Slice 3.2C-B3A.2D). Read-only, local BTY-day boundary,
 * fail-soft per category (an unavailable source is omitted, never estimated).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { loadWeeklyActivity } from "@/lib/bty/daily/weeklyActivity.server";

export const dynamic = "force-dynamic";

const noStore = (res: NextResponse) => {
  res.headers.set("Cache-Control", "no-store");
  return res;
};

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return noStore(NextResponse.json({ ok: false, code: "UNAUTHENTICATED", summary: null }, { status: 401 }));

    const admin = getSupabaseAdmin();
    if (!admin) return noStore(NextResponse.json({ ok: true, summary: null }, { status: 200 }));

    const tz = req.nextUrl.searchParams.get("tz");
    const summary = await loadWeeklyActivity(admin, user.id, new Date(), tz || null);
    return noStore(NextResponse.json({ ok: true, summary }, { status: 200 }));
  } catch {
    return noStore(NextResponse.json({ ok: true, summary: null }, { status: 200 }));
  }
}
