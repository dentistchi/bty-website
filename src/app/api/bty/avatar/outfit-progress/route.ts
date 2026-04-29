/**
 * GET /api/bty/avatar/outfit-progress?userId=
 * {@link getOutfitUnlockProgress} + equipped / unlocked ids for {@link OutfitUnlockPanel}.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getOutfitTintByAssetId, getUnlockedAssets } from "@/engine/avatar/avatar-assets.service";
import { getAvatarState } from "@/engine/avatar/avatar-state.service";
import { getOutfitUnlockProgress } from "@/engine/avatar/avatar-outfit-unlock.service";

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

  const [items, state, unlocked_assets, asset_tints] = await Promise.all([
    getOutfitUnlockProgress(userId, admin),
    getAvatarState(userId, admin),
    getUnlockedAssets(userId, admin),
    getOutfitTintByAssetId(userId, admin),
  ]);

  const res = NextResponse.json({
    items,
    equipped_asset_ids: state.equipped_asset_ids,
    unlocked_assets,
    asset_tints,
    current_tier: state.current_tier,
    core_xp_total: typeof state.core_xp_total === "number" ? state.core_xp_total : undefined,
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
