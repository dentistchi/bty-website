/**
 * GET /api/arena/avatar/state?userId=
 * Avatar display tier (0–4), unlocked asset ids (`getUnlockedAssets`), Core XP — `getAvatarState` + profile.
 * Authenticated; uses service role to read any user (e.g. leaderboard row avatars).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getUnlockedAssets } from "@/engine/avatar/avatar-assets.service";
import {
  AVATAR_TIER_THRESHOLDS,
  getAvatarState,
} from "@/engine/avatar/avatar-state.service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const userId = req.nextUrl.searchParams.get("userId")?.trim() ?? "";
  if (!userId) {
    return NextResponse.json({ error: "MISSING_USER_ID" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "ADMIN_UNAVAILABLE" }, { status: 503 });
  }

  const state = await getAvatarState(userId, admin);
  const unlocked_assets = await getUnlockedAssets(userId, admin);
  const { data: prof } = await admin
    .from("arena_profiles")
    .select("core_xp_total")
    .eq("user_id", userId)
    .maybeSingle();

  const coreXp = Math.max(
    0,
    Number((prof as { core_xp_total?: number } | null)?.core_xp_total ?? state.core_xp_total ?? 0),
  );

  const res = NextResponse.json({
    user_id: state.user_id,
    current_tier: state.current_tier,
    unlocked_assets,
    core_xp_total: coreXp,
    tier_thresholds: [...AVATAR_TIER_THRESHOLDS],
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
