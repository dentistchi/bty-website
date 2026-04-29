/**
 * POST /api/bty/notifications/read — `{ notificationId }` or `{ notifId }` → {@link markNotificationRead}.
 */
import { NextRequest, NextResponse } from "next/server";
import { markNotificationRead } from "@/engine/integration/notification-router.service";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const res = NextResponse.json({ ok: false as const, error: "INVALID_JSON" }, { status: 400 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  const o = typeof body === "object" && body ? (body as Record<string, unknown>) : null;
  const id = String(o?.notificationId ?? o?.notifId ?? "").trim();
  if (!id) {
    const res = NextResponse.json({ ok: false as const, error: "MISSING_ID" }, { status: 400 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  try {
    const supabase = await getSupabaseServerClient();
    await markNotificationRead(user.id, id, supabase);
    const res = NextResponse.json({ ok: true as const });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "mark_read_failed";
    const res = NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
