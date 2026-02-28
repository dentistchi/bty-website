import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  await supabase.rpc("ensure_arena_profile");

  const { data, error } = await supabase
    .from("arena_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const profile = data as Record<string, unknown> & { avatar_character_id?: string | null };
  return NextResponse.json({
    profile: data,
    avatarCharacterId: profile?.avatar_character_id ?? null,
  });
}

/** Update current user's avatar URL and/or avatar character id. */
export async function PATCH(req: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: { avatarUrl?: string | null; avatarCharacterId?: string | null; avatarOutfitTheme?: "professional" | "fantasy" | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const avatarUrl =
    body.avatarUrl === null || body.avatarUrl === ""
      ? undefined
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
    return NextResponse.json({ error: "INVALID_AVATAR_CHARACTER_ID" }, { status: 400 });
  }

  const rawTheme = body.avatarOutfitTheme;
  const avatarOutfitTheme =
    rawTheme === null || rawTheme === undefined
      ? null
      : rawTheme === "professional" || rawTheme === "fantasy"
        ? rawTheme
        : null;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
  if (rawCharId !== undefined) updates.avatar_character_id = avatarCharacterId;
  if (rawTheme !== undefined) updates.avatar_outfit_theme = avatarOutfitTheme;

  const { error: updateError } = await supabase
    .from("arena_profiles")
    .update(updates)
    .eq("user_id", user.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
