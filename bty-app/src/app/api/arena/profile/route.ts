import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";

export async function GET(req: NextRequest) {
  const { user, supabase: routeSupabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);
  const supabase = routeSupabase;

  await supabase.rpc("ensure_arena_profile");

  const { data, error } = await supabase
    .from("arena_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error) {
    const out = NextResponse.json({ error: error.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }
  const profile = data as Record<string, unknown> & { avatar_character_id?: string | null };
  const res = NextResponse.json({
    profile: data,
    avatarCharacterId: profile?.avatar_character_id ?? null,
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}

/** Update current user's avatar URL and/or avatar character id. Uses request cookies (same as core-xp) for consistency. */
export async function PATCH(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: {
    avatarUrl?: string | null;
    avatarCharacterId?: string | null;
    avatarOutfitTheme?: "professional" | "fantasy" | null;
    avatarSelectedOutfitId?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    const out = NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, false);
    return out;
  }

  const avatarUrl =
    body.avatarUrl === null || body.avatarUrl === ""
      ? null
      : typeof body.avatarUrl === "string"
        ? body.avatarUrl.trim().slice(0, 2048)
        : undefined;

  const { isValidAvatarCharacterId } = await import("@/lib/bty/arena/avatarCharacters");
  const rawCharId = body.avatarCharacterId;
  const avatarCharacterId =
    rawCharId === null || rawCharId === undefined || rawCharId === ""
      ? null
      : typeof rawCharId === "string"
        ? rawCharId.trim() || null
        : null;
  if (avatarCharacterId !== null && !isValidAvatarCharacterId(avatarCharacterId)) {
    const out = NextResponse.json({ error: "INVALID_AVATAR_CHARACTER_ID" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const rawTheme = body.avatarOutfitTheme;
  const avatarOutfitTheme =
    rawTheme === null || rawTheme === undefined
      ? null
      : rawTheme === "professional" || rawTheme === "fantasy"
        ? rawTheme
        : null;

  // If client is trying to change character, check lock
  if (rawCharId !== undefined) {
    const { data: row } = await supabase
      .from("arena_profiles")
      .select("avatar_character_locked, avatar_character_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const locked = (row as { avatar_character_locked?: boolean } | null)?.avatar_character_locked === true;
    const currentCharId = (row as { avatar_character_id?: string | null } | null)?.avatar_character_id ?? null;
    const wantsChange = avatarCharacterId !== currentCharId;
    if (locked && wantsChange) {
      const out = NextResponse.json({ error: "AVATAR_CHARACTER_LOCKED" }, { status: 403 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
  if (rawCharId !== undefined) {
    updates.avatar_character_id = avatarCharacterId;
    // Lock character when first time setting to non-null
    if (avatarCharacterId !== null) {
      updates.avatar_character_locked = true;
    }
  }
  if (rawTheme !== undefined) updates.avatar_outfit_theme = avatarOutfitTheme;

  const rawOutfitId = body.avatarSelectedOutfitId;
  if (rawOutfitId !== undefined) {
    const outfitId =
      rawOutfitId === null || rawOutfitId === ""
        ? null
        : typeof rawOutfitId === "string"
          ? rawOutfitId.trim() || null
          : null;
    if (outfitId !== null) {
      const { getOutfitById } = await import("@/lib/bty/arena/avatarOutfits");
      const themeForValidation = avatarOutfitTheme ?? "professional";
      const valid = getOutfitById(themeForValidation, outfitId);
      if (!valid) {
        const out = NextResponse.json({ error: "INVALID_AVATAR_OUTFIT_ID" }, { status: 400 });
        copyCookiesAndDebug(base, out, req, true);
        return out;
      }
    }
    updates.avatar_selected_outfit_id = outfitId;
  }

  const { error: updateError } = await supabase
    .from("arena_profiles")
    .update(updates)
    .eq("user_id", user.id);

  if (updateError) {
    const out = NextResponse.json({ error: updateError.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }
  const out = NextResponse.json({ ok: true });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
