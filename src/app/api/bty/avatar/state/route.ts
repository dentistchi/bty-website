/**
 * GET /api/bty/avatar/state?userId=
 * `getAvatarState` + `getUnlockedAssets` + profile Core XP + {@link getCoreXPBreakdown} (ledger buckets).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getUnlockedAssets } from "@/engine/avatar/avatar-assets.service";
import {
  AVATAR_TIER_THRESHOLDS,
  getAvatarState,
} from "@/engine/avatar/avatar-state.service";
import { getCoreXPBreakdown } from "@/engine/xp/core-xp-history.service";

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

  const [state, unlocked_assets, breakdown, profRes] = await Promise.all([
    getAvatarState(userId, admin),
    getUnlockedAssets(userId, admin),
    getCoreXPBreakdown(userId, { supabase: admin }),
    admin.from("arena_profiles").select("core_xp_total").eq("user_id", userId).maybeSingle(),
  ]);

  const prof = profRes.data as { core_xp_total?: number } | null;
  const coreXp = Math.max(
    0,
    Number(prof?.core_xp_total ?? state.core_xp_total ?? 0),
  );

  const res = NextResponse.json({
    user_id: state.user_id,
    current_tier: state.current_tier,
    unlocked_assets,
    equipped_asset_ids: state.equipped_asset_ids,
    equipped_slots: state.equipped_slots ?? null,
    outfit_tint_by_asset_id: state.outfit_tint_by_asset_id ?? {},
    core_xp_total: coreXp,
    tier_thresholds: [...AVATAR_TIER_THRESHOLDS],
    core_xp_breakdown: {
      arenaPct: breakdown.arenaPct,
      labPct: breakdown.labPct,
      foundryPct: breakdown.foundryPct,
      mentorPct: breakdown.mentorPct,
      otherPct: breakdown.otherPct,
    },
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
