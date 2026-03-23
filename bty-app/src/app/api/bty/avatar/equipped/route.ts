/**
 * GET /api/bty/avatar/equipped?userId=
 * Slot-based equipped state from `user_equipped_assets` (see {@link getEquippedState} engine).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  equippedIdsCompact,
  getEquippedState,
} from "@/engine/avatar/avatar-equipped-state.service";

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

  try {
    const state = await getEquippedState(userId, admin);
    const equipped_assets = equippedIdsCompact(state.equipped_asset_ids);
    const res = NextResponse.json({
      equipped_assets,
      equipped_slots: state.equipped_asset_ids,
    });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    console.warn("[equipped GET]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "LOAD_FAILED" }, { status: 500 });
  }
}
