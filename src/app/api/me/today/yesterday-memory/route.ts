/**
 * /api/me/today/yesterday-memory — the one quiet remembered line from yesterday's real commitment.
 *
 * GET: authenticate → resolve yesterday's provenance-safe evidence (server-canonical day boundary)
 *      → return { memory: { line } | null }. Read-only: NO writes, NO generation, NO provider call.
 *
 * Server is the source of truth for reality/evidence; the client renders the returned line only.
 * Fail-soft everywhere → { memory: null } so Today's arrival never breaks. English-only (V1 scope).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { loadYesterdayMemory } from "@/lib/bty/daily/yesterdayMemory.server";

export const dynamic = "force-dynamic";

const noStore = (res: NextResponse) => {
  res.headers.set("Cache-Control", "no-store");
  return res;
};

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return noStore(NextResponse.json({ ok: false, code: "UNAUTHENTICATED", memory: null }, { status: 401 }));

    const admin = getSupabaseAdmin();
    if (!admin) return noStore(NextResponse.json({ ok: true, memory: null }, { status: 200 }));

    const tz = req.nextUrl.searchParams.get("tz");
    const memory = await loadYesterdayMemory(admin, user.id, new Date(), tz || null);
    return noStore(NextResponse.json({ ok: true, memory: memory ? { line: memory.line } : null }, { status: 200 }));
  } catch {
    // Fail-soft: a read failure must never break Today's arrival.
    return noStore(NextResponse.json({ ok: true, memory: null }, { status: 200 }));
  }
}
