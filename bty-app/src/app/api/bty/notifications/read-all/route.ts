/**
 * POST /api/bty/notifications/read-all — {@link markAllNotificationsRead}.
 */
import { NextRequest, NextResponse } from "next/server";
import { markAllNotificationsRead } from "@/engine/integration/notification-router.service";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  try {
    const supabase = await getSupabaseServerClient();
    await markAllNotificationsRead(user.id, supabase);
    const res = NextResponse.json({ ok: true as const });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "mark_all_failed";
    const res = NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
