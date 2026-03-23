/**
 * GET /api/bty/avatar/snapshot?userId=
 * Fast avatar paint payload — {@link getAvatarState} + profile Core XP + {@link getUnlockedAssets}
 * in parallel **without** {@link getCoreXPBreakdown} (full `/api/bty/avatar/state` reconciles breakdown).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  AVATAR_TIER_THRESHOLDS,
  getAvatarState,
} from "@/engine/avatar/avatar-state.service";
import { getLatestSnapshot as getLatestCompositeSnapshot } from "@/engine/avatar/avatar-composite-snapshot.service";

export const runtime = "nodejs";

const EMPTY_BREAKDOWN = {
  arenaPct: 0,
  labPct: 0,
  foundryPct: 0,
  mentorPct: 0,
  otherPct: 0,
};

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

  const [state, profRes, compositeSnap] = await Promise.all([
    getAvatarState(userId, admin),
    admin.from("arena_profiles").select("core_xp_total").eq("user_id", userId).maybeSingle(),
    getLatestCompositeSnapshot(userId, admin),
  ]);
  const unlocked_assets = [...state.unlocked_assets];

  const prof = profRes.data as { core_xp_total?: number } | null;
  const coreXp = Math.max(
    0,
    Number(prof?.core_xp_total ?? state.core_xp_total ?? 0),
  );

  const snapshot = {
    user_id: state.user_id,
    current_tier: state.current_tier,
    unlocked_assets,
    equipped_asset_ids: state.equipped_asset_ids,
    equipped_slots: state.equipped_slots ?? null,
    outfit_tint_by_asset_id: state.outfit_tint_by_asset_id ?? {},
    core_xp_total: coreXp,
    tier_thresholds: [...AVATAR_TIER_THRESHOLDS],
    core_xp_breakdown: EMPTY_BREAKDOWN,
    composite_tier: compositeSnap.tier,
    composite_layers: compositeSnap.layers,
    composite_snapped_at: compositeSnap.snapped_at,
  };

  const res = NextResponse.json({ snapshot });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
