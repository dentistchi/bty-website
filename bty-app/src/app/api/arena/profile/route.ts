import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";

/**
 * GET/PATCH `/api/arena/profile` — Arena **`arena_profiles`** 조회·부분 갱신(아바타·display_name).
 *
 * @contract **GET**
 * - **200:** `{ profile: object, avatarCharacterId: string | null }` — `profile`은 테이블 전열.
 * - **401:** `{ error: "UNAUTHENTICATED" }`.
 * - **500:** `{ error: string }` — `ensure_arena_profile` RPC 또는 select 실패.
 * - **캐시:** `Cache-Control: private, no-store, max-age=0` — **304/ETag 미지원**(매 GET 신선 프로필).
 *
 * @contract **PATCH**
 * - **Body (JSON):** 선택 필드 `avatarUrl`, `avatarCharacterId`, `avatarOutfitTheme`, `avatarSelectedOutfitId`, `avatarAccessoryIds`, `display_name`.
 * - **200:** `{ ok: true }` (성공 갱신; 전체 행 미반환).
 * - **400:** `{ error: "INVALID_JSON" }` — 본문 JSON 파싱 실패만.
 * - **422:** `{ error: … }` — `EMPTY_PATCH`(갱신 필드 없음·알 수 없는 키만)·`INVALID_AVATAR_CHARACTER_ID`·`INVALID_AVATAR_OUTFIT_ID`·`ACCESSORY_SLOTS_EXCEEDED`·display_name 검증 실패 키.
 * - **403:** `{ error: "AVATAR_CHARACTER_LOCKED" }`.
 * - **401 / 500:** GET과 동일.
 * - **250:** 422·400 구분 = JSON 파싱만 400, 검증·빈 패치는 422.
 *
 * @see docs/spec/ARENA_DOMAIN_SPEC.md §4-5·§4-6
 */
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
  res.headers.set("Cache-Control", "private, no-store, max-age=0");
  copyCookiesAndDebug(base, res, req, true);
  return res;
}

/** @see 파일 상단 GET/PATCH @contract */
export async function PATCH(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: {
    avatarUrl?: string | null;
    avatarCharacterId?: string | null;
    avatarOutfitTheme?: "professional" | "fantasy" | null;
    avatarSelectedOutfitId?: string | null;
    avatarAccessoryIds?: string[] | null;
    display_name?: string | null;
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
    const out = NextResponse.json({ error: "INVALID_AVATAR_CHARACTER_ID" }, { status: 422 });
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
  let outfitIdToSet: string | null | undefined = undefined;
  if (rawOutfitId !== undefined) {
    outfitIdToSet =
      rawOutfitId === null || rawOutfitId === ""
        ? null
        : typeof rawOutfitId === "string"
          ? rawOutfitId.trim() || null
          : null;
    if (outfitIdToSet !== null) {
      const { getOutfitById } = await import("@/lib/bty/arena/avatarOutfits");
      const themeForValidation = avatarOutfitTheme ?? "professional";
      const valid = getOutfitById(themeForValidation, outfitIdToSet);
      if (!valid) {
        const out = NextResponse.json({ error: "INVALID_AVATAR_OUTFIT_ID" }, { status: 422 });
        copyCookiesAndDebug(base, out, req, true);
        return out;
      }
    }
    updates.avatar_selected_outfit_id = outfitIdToSet;
  }

  const rawAccessoryIds = body.avatarAccessoryIds;
  if (rawAccessoryIds !== undefined) {
    const accessoryIds = Array.isArray(rawAccessoryIds)
      ? (rawAccessoryIds as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    const { tierFromCoreXp } = await import("@/lib/bty/arena/codes");
    const { accessorySlotsFromTier } = await import("@/lib/bty/arena/avatarOutfits");
    const { data: profileRow } = await supabase
      .from("arena_profiles")
      .select("core_xp_total")
      .eq("user_id", user.id)
      .maybeSingle();
    const coreXp = (profileRow as { core_xp_total?: number } | null)?.core_xp_total ?? 0;
    const maxSlots = accessorySlotsFromTier(tierFromCoreXp(coreXp));
    if (accessoryIds.length > maxSlots) {
      const out = NextResponse.json({ error: "ACCESSORY_SLOTS_EXCEEDED" }, { status: 422 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    updates.avatar_accessory_ids = accessoryIds;
    updates.avatar_accessories_updated_at = new Date().toISOString();
  }

  if (body.display_name !== undefined) {
    const { validateDisplayName } = await import("@/lib/bty/arena/profileDisplayName");
    const result = validateDisplayName(body.display_name);
    if (!result.valid) {
      const out = NextResponse.json({ error: result.error ?? "INVALID_DISPLAY_NAME" }, { status: 422 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    updates.display_name = result.sanitized;
  }

  const semanticKeys = Object.keys(updates).filter((k) => k !== "updated_at");
  if (semanticKeys.length === 0) {
    const out = NextResponse.json({ error: "EMPTY_PATCH" }, { status: 422 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const { error: updateError } = await supabase
    .from("arena_profiles")
    .update(updates)
    .eq("user_id", user.id);

  if (updateError) {
    const isMissingColumn =
      typeof updateError.message === "string" &&
      (updateError.message.includes("does not exist") || updateError.message.includes("column"));
    if (isMissingColumn && (outfitIdToSet !== undefined || rawAccessoryIds !== undefined)) {
      const fallbackUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (avatarUrl !== undefined) fallbackUpdates.avatar_url = avatarUrl;
      if (rawCharId !== undefined) {
        fallbackUpdates.avatar_character_id = avatarCharacterId;
        if (avatarCharacterId !== null) fallbackUpdates.avatar_character_locked = true;
      }
      if (rawTheme !== undefined) fallbackUpdates.avatar_outfit_theme = avatarOutfitTheme;
      const { error: fallbackErr } = await supabase
        .from("arena_profiles")
        .update(fallbackUpdates)
        .eq("user_id", user.id);
      if (fallbackErr) {
        const out = NextResponse.json({ error: fallbackErr.message }, { status: 500 });
        copyCookiesAndDebug(base, out, req, true);
        return out;
      }
      const out = NextResponse.json({ ok: true });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    const out = NextResponse.json({ error: updateError.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }
  const out = NextResponse.json({ ok: true });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
