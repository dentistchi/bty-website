/**
 * GET /api/bty/notifications — unread list ({@link getUnreadNotifications}).
 */
import { NextRequest, NextResponse } from "next/server";
import { getUnreadNotifications } from "@/engine/integration/notification-router.service";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  try {
    const supabase = await getSupabaseServerClient();
    const notifications = await getUnreadNotifications(user.id, supabase);
    const res = NextResponse.json({
      ok: true as const,
      count: notifications.length,
      notifications,
    });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "notifications_failed";
    const res = NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
