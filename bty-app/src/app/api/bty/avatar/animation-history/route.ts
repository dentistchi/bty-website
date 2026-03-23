/**
 * GET /api/bty/avatar/animation-history
 * Recent {@link avatar_animation_log} rows for the signed-in user (newest first).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getAnimationHistory } from "@/engine/avatar/avatar-animation-log.service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "ADMIN_UNAVAILABLE" }, { status: 503 });
  }

  const items = await getAnimationHistory(user.id, 10, admin);
  const res = NextResponse.json({ items });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
