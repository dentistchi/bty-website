/**
 * POST /api/bty/avatar/tint
 * Body: `{ assetId: string; tintColor: string }` — persists `#RRGGBB` to `user_avatar_assets.tint_color` for outfit assets.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getUnlockedAssets } from "@/engine/avatar/avatar-assets.service";
import { OUTFIT_TINT_SWATCHES } from "@/engine/avatar/avatar-manifest.service";
import { assetTypeForEquipConflict } from "@/engine/avatar/avatar-outfit-unlock.service";
import { persistSnapshotForUser } from "@/engine/avatar/avatar-composite-snapshot.service";

export const runtime = "nodejs";

const ALLOWED_HEX = new Set(OUTFIT_TINT_SWATCHES.map((s) => s.hex.toLowerCase()));

export async function POST(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "ADMIN_UNAVAILABLE" }, { status: 503 });
  }

  let body: { assetId?: string; tintColor?: string };
  try {
    body = (await req.json()) as { assetId?: string; tintColor?: string };
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const assetId = typeof body.assetId === "string" ? body.assetId.trim() : "";
  const tintColorRaw = typeof body.tintColor === "string" ? body.tintColor.trim() : "";
  if (!assetId || !tintColorRaw) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  if (assetTypeForEquipConflict(assetId) !== "outfit") {
    return NextResponse.json({ error: "NOT_OUTFIT_ASSET" }, { status: 400 });
  }

  const tintLower = tintColorRaw.toLowerCase();
  if (!ALLOWED_HEX.has(tintLower)) {
    return NextResponse.json({ error: "INVALID_TINT" }, { status: 400 });
  }
  const tintColor = OUTFIT_TINT_SWATCHES.find((s) => s.hex.toLowerCase() === tintLower)?.hex ?? tintColorRaw;

  const userId = user.id;
  const unlocked = await getUnlockedAssets(userId, admin);
  if (!unlocked.includes(assetId)) {
    return NextResponse.json({ error: "ASSET_NOT_UNLOCKED" }, { status: 403 });
  }

  const { data: existing, error: selErr } = await admin
    .from("user_avatar_assets")
    .select("asset_id")
    .eq("user_id", userId)
    .eq("asset_id", assetId)
    .maybeSingle();

  if (selErr) {
    console.warn("[avatar/tint] select", selErr.message);
    return NextResponse.json({ error: "LOAD_FAILED" }, { status: 500 });
  }

  const now = new Date().toISOString();
  if (existing) {
    const { error: upErr } = await admin
      .from("user_avatar_assets")
      .update({ tint_color: tintColor })
      .eq("user_id", userId)
      .eq("asset_id", assetId);
    if (upErr) {
      console.warn("[avatar/tint] update", upErr.message);
      return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
    }
  } else {
    const { error: insErr } = await admin.from("user_avatar_assets").insert({
      user_id: userId,
      asset_id: assetId,
      unlocked_at: now,
      tint_color: tintColor,
    });
    if (insErr) {
      console.warn("[avatar/tint] insert", insErr.message);
      return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
    }
  }

  await persistSnapshotForUser(userId, admin).catch(() => {});

  const res = NextResponse.json({ ok: true, assetId, tintColor });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
