/**
 * AVATAR_LAYER_SPEC §3.2, §6, §7: GET/PATCH avatar with allowed (outfits, accessorySlots).
 * GET: AvatarUiResponse (avatar + allowed). PATCH: theme, outfitKey, accessoryKeys with validation.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { tierFromCoreXp } from "@/lib/bty/arena/codes";
import {
  tierToDisplayLevelId,
  getOutfitById,
  getUnifiedOutfitManifestAllowed,
  accessorySlotsFromTier,
  getOutfitForLevel,
  parseApiOutfitKey,
  toUnifiedOutfitKey,
} from "@/lib/bty/arena/avatarOutfits";
import type { AvatarUiResponse, PatchAvatarRequest } from "@/types/arena";

const AVATAR_SELECT =
  "user_id, core_xp_total, avatar_character_id, avatar_character_locked, avatar_outfit_theme, avatar_selected_outfit_id, avatar_accessory_ids";

export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  await supabase.rpc("ensure_arena_profile");

  const { data: row, error } = await supabase
    .from("arena_profiles")
    .select(AVATAR_SELECT)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    const isMissingColumn =
      typeof error.message === "string" &&
      (error.message.includes("does not exist") || error.message.includes("column"));
    if (isMissingColumn) {
      const { data: fallbackRow, error: fallbackErr } = await supabase
        .from("arena_profiles")
        .select("user_id, core_xp_total, avatar_character_id, avatar_character_locked, avatar_outfit_theme, avatar_selected_outfit_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (fallbackErr || !fallbackRow) {
        const out = NextResponse.json({ error: error.message }, { status: 500 });
        copyCookiesAndDebug(base, out, req, true);
        return out;
      }
      const p = fallbackRow as Record<string, unknown>;
      const coreXp = typeof p.core_xp_total === "number" ? p.core_xp_total : 0;
      const tier = tierFromCoreXp(coreXp);
      const levelId = tierToDisplayLevelId(tier);
      const theme: "professional" | "fantasy" =
        p.avatar_outfit_theme === "fantasy" ? "fantasy" : "professional";
      const outfitIdRaw = (p.avatar_selected_outfit_id as string | null) ?? null;
      const effectiveOutfitId =
        outfitIdRaw && typeof outfitIdRaw === "string" && outfitIdRaw.trim()
          ? outfitIdRaw.trim()
          : getOutfitForLevel(theme, levelId).outfitId;
      const res: AvatarUiResponse = {
        avatar: {
          characterKey: (p.avatar_character_id as string) ?? "",
          theme,
          outfitKey: toUnifiedOutfitKey(effectiveOutfitId),
          accessoryKeys: [],
          characterLocked: (p.avatar_character_locked as boolean) === true,
        },
        allowed: {
          outfits: [],
          accessorySlots: accessorySlotsFromTier(tier),
          accessories: [],
        },
      };
      const out = NextResponse.json(res);
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    const out = NextResponse.json({ error: error.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const p = (row ?? {}) as Record<string, unknown>;
  const coreXp = typeof p.core_xp_total === "number" ? p.core_xp_total : 0;
  const tier = tierFromCoreXp(coreXp);
  const levelId = tierToDisplayLevelId(tier);
  const theme: "professional" | "fantasy" =
    p.avatar_outfit_theme === "fantasy" ? "fantasy" : "professional";
  const outfitIdRaw = (p.avatar_selected_outfit_id as string | null) ?? null;
  const effectiveOutfitId =
    outfitIdRaw && typeof outfitIdRaw === "string" && outfitIdRaw.trim()
      ? outfitIdRaw.trim()
      : getOutfitForLevel(theme, levelId).outfitId;
  const accessoryIds = Array.isArray(p.avatar_accessory_ids)
    ? (p.avatar_accessory_ids as string[]).filter((x): x is string => typeof x === "string")
    : [];

  const res: AvatarUiResponse = {
    avatar: {
      characterKey: (p.avatar_character_id as string) ?? "",
      theme,
      outfitKey: toUnifiedOutfitKey(effectiveOutfitId),
      accessoryKeys: accessoryIds,
      characterLocked: (p.avatar_character_locked as boolean) === true,
    },
    allowed: {
      outfits: getUnifiedOutfitManifestAllowed(),
      accessorySlots: accessorySlotsFromTier(tier),
    },
  };

  const out = NextResponse.json(res);
  copyCookiesAndDebug(base, out, req, true);
  return out;
}

export async function PATCH(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: PatchAvatarRequest;
  try {
    body = await req.json();
  } catch {
    const out = NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, false);
    return out;
  }

  const themeRaw = body.theme;
  const theme: "professional" | "fantasy" | undefined =
    themeRaw === "professional" || themeRaw === "fantasy" ? themeRaw : undefined;

  const outfitKey =
    body.outfitKey === null || body.outfitKey === undefined
      ? undefined
      : typeof body.outfitKey === "string"
        ? body.outfitKey.trim() || null
        : null;
  const accessoryKeys = Array.isArray(body.accessoryKeys)
    ? (body.accessoryKeys as string[]).filter((x): x is string => typeof x === "string")
    : undefined;

  // Load current profile for validation and lock check
  const { data: row, error: selectErr } = await supabase
    .from("arena_profiles")
    .select(AVATAR_SELECT)
    .eq("user_id", user.id)
    .maybeSingle();

  if (selectErr || !row) {
    const out = NextResponse.json({ error: "PROFILE_NOT_FOUND" }, { status: 404 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const p = row as Record<string, unknown>;
  const coreXp = typeof p.core_xp_total === "number" ? p.core_xp_total : 0;
  const tier = tierFromCoreXp(coreXp);
  /** 통합 옷 목록(전체 매니페스트). 향후 tier/code 해금 시 여기서 필터. */
  const allowedOutfits = getUnifiedOutfitManifestAllowed();
  const allowedSlots = accessorySlotsFromTier(tier);

  if (outfitKey !== undefined) {
    if (outfitKey === null) {
      // null = use level default; allowed
    } else {
      const parsed = parseApiOutfitKey(outfitKey);
      if (!parsed) {
        const out = NextResponse.json({ error: "INVALID_OUTFIT_KEY" }, { status: 400 });
        copyCookiesAndDebug(base, out, req, true);
        return out;
      }
      const unifiedKey = toUnifiedOutfitKey(parsed.outfitId);
      const inAllowed =
        unifiedKey != null && allowedOutfits.some((o) => o.key === unifiedKey);
      if (!inAllowed) {
        const out = NextResponse.json({ error: "OUTFIT_NOT_ALLOWED" }, { status: 400 });
        copyCookiesAndDebug(base, out, req, true);
        return out;
      }
      const outfitInfo = getOutfitById(null, parsed.outfitId);
      if (!outfitInfo) {
        const out = NextResponse.json({ error: "INVALID_OUTFIT_KEY" }, { status: 400 });
        copyCookiesAndDebug(base, out, req, true);
        return out;
      }
    }
  }

  if (accessoryKeys !== undefined) {
    if (accessoryKeys.length > allowedSlots) {
      const out = NextResponse.json({ error: "ACCESSORY_SLOTS_EXCEEDED" }, { status: 400 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (theme !== undefined) updates.avatar_outfit_theme = theme;
  if (outfitKey !== undefined) {
    if (outfitKey === null) {
      updates.avatar_selected_outfit_id = null;
    } else {
      const parsed = parseApiOutfitKey(outfitKey);
      if (parsed) {
        updates.avatar_selected_outfit_id = parsed.outfitId;
        updates.avatar_outfit_theme = parsed.avatarOutfitTheme;
      }
    }
    updates.avatar_outfit_updated_at = new Date().toISOString();
  }
  if (accessoryKeys !== undefined) {
    updates.avatar_accessory_ids = accessoryKeys;
    updates.avatar_accessories_updated_at = new Date().toISOString();
  }

  const { error: updateErr } = await supabase
    .from("arena_profiles")
    .update(updates)
    .eq("user_id", user.id);

  if (updateErr) {
    const isLock = typeof updateErr.message === "string" && updateErr.message.includes("locked");
    const out = NextResponse.json(
      { error: isLock ? "AVATAR_CHARACTER_LOCKED" : updateErr.message },
      { status: isLock ? 403 : 500 }
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const out = NextResponse.json({ ok: true });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
