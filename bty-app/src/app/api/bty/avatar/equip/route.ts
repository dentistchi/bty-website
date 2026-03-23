/**
 * POST /api/bty/avatar/equip
 * Body: `{ assetId: string }` — validates ownership, resolves slot, upserts `user_equipped_assets`.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  equippedIdsCompact,
  updateEquippedSlot,
} from "@/engine/avatar/avatar-equipped-state.service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "ADMIN_UNAVAILABLE" }, { status: 503 });
  }

  let body: { assetId?: string; slot?: string };
  try {
    body = (await req.json()) as { assetId?: string; slot?: string };
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const assetId = typeof body.assetId === "string" ? body.assetId.trim() : "";
  if (!assetId) {
    return NextResponse.json({ error: "MISSING_ASSET_ID" }, { status: 400 });
  }

  const badgeSlot = body.slot === "badge";

  const userId = user.id;

  try {
    const state = await updateEquippedSlot(userId, assetId, admin, { badgeSlot });
    const res = NextResponse.json({
      ok: true,
      equipped_asset_ids: equippedIdsCompact(state.equipped_asset_ids),
      equipped_slots: state.equipped_asset_ids,
    });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "ASSET_NOT_OWNED") {
      return NextResponse.json({ error: "ASSET_NOT_OWNED" }, { status: 403 });
    }
    if (msg === "ASSET_SLOT_UNRESOLVABLE") {
      return NextResponse.json({ error: "ASSET_SLOT_UNRESOLVABLE" }, { status: 400 });
    }
    console.warn("[equip]", msg);
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }
}
