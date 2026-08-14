/**
 * POST /api/me/day/open — STEP 1C / D1 daily-instance open.
 *
 * Thin handler: authenticate the user, read the request's device tz, delegate to the
 * server-authoritative {@link ensureUserDay} service (resolve canonical userDayKey +
 * idempotently create/reuse today's row). Returns `{ dayKey, isNew, timezone, tzFallback }`.
 *
 * Best-effort / never 500s: an unauthenticated or degraded call returns `200 { ok:false }`
 * so a Today mount is never blocked. No auth/session-restore behavior is touched (read-only getUser).
 */
import { NextRequest, NextResponse } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ensureUserDay } from "@/lib/bty/daily/userDay";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 200 });
    if (!(await isConsentCurrent(supabase, user.id))) return consentRequiredResponse();

    const body = (await req.json().catch(() => null)) as { tz?: unknown } | null;
    const deviceTz = typeof body?.tz === "string" ? body.tz : null;

    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ ok: false }, { status: 200 });

    const result = await ensureUserDay(admin, user.id, new Date(), deviceTz);
    const res = NextResponse.json({ ok: true, ...result }, { status: 200 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
