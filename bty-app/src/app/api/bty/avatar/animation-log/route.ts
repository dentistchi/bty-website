/**
 * POST — log one animation play; GET — history + 30d stats for activity feed / integrity signals.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  AVATAR_ANIMATION_PRESETS,
  getAnimationHistory,
  getAnimationStats,
  logAvatarAnimation,
  type AvatarAnimationPresetId,
} from "@/engine/avatar/avatar-animation-log.service";

export const runtime = "nodejs";

function isPreset(s: string): s is AvatarAnimationPresetId {
  return (AVATAR_ANIMATION_PRESETS as readonly string[]).includes(s);
}

export async function POST(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "ADMIN_UNAVAILABLE" }, { status: 503 });
  }

  let body: { preset?: string; triggered_by_event?: string };
  try {
    body = (await req.json()) as { preset?: string; triggered_by_event?: string };
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const presetRaw = typeof body.preset === "string" ? body.preset.trim() : "";
  if (!isPreset(presetRaw)) {
    return NextResponse.json({ error: "INVALID_PRESET" }, { status: 400 });
  }

  const triggered =
    typeof body.triggered_by_event === "string" && body.triggered_by_event.trim() !== ""
      ? body.triggered_by_event.trim()
      : presetRaw;

  await logAvatarAnimation(user.id, presetRaw, triggered, admin);

  const res = NextResponse.json({ ok: true });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}

export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let userId = req.nextUrl.searchParams.get("userId")?.trim() ?? "";
  if (!userId) userId = user.id;
  if (userId !== user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "ADMIN_UNAVAILABLE" }, { status: 503 });
  }

  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = limitRaw != null ? Number(limitRaw) : 20;

  const [history, stats] = await Promise.all([
    getAnimationHistory(userId, limit, admin),
    getAnimationStats(userId, admin, 30),
  ]);

  const res = NextResponse.json({ history, stats });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
