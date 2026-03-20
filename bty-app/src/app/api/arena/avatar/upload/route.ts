import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import {
  ARENA_AVATAR_UPLOAD_MAX_BYTES,
  ARENA_AVATAR_UPLOAD_ALLOWED_MIME_TYPES,
  isAllowedArenaAvatarMimeType,
} from "@/domain/rules/arenaAvatarUploadLimits";

const AVATAR_BUCKET = "avatars";
const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: NextRequest) {
  const base = NextResponse.json({ ok: true }, { status: 200 });
  const { user, supabase } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    const out = NextResponse.json({ error: "INVALID_FORM" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, false);
    return out;
  }

  const file = formData.get("file") ?? formData.get("avatar");
  if (!file || !(file instanceof File)) {
    const out = NextResponse.json({ error: "NO_FILE" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const type = file.type as string;
  if (!isAllowedArenaAvatarMimeType(type)) {
    const out = NextResponse.json(
      { error: "INVALID_TYPE", allowed: [...ARENA_AVATAR_UPLOAD_ALLOWED_MIME_TYPES] },
      { status: 400 }
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  if (file.size > ARENA_AVATAR_UPLOAD_MAX_BYTES) {
    const out = NextResponse.json(
      { error: "FILE_TOO_LARGE", maxBytes: ARENA_AVATAR_UPLOAD_MAX_BYTES },
      { status: 400 }
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const ext = EXT_MAP[type] ?? "png";
  const path = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: type });

  if (uploadError) {
    const out = NextResponse.json(
      { error: "UPLOAD_FAILED", detail: uploadError.message },
      { status: 500 }
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

  await supabase.rpc("ensure_arena_profile");
  const { error: updateError } = await supabase
    .from("arena_profiles")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (updateError) {
    const out = NextResponse.json(
      { error: "PROFILE_UPDATE_FAILED", detail: updateError.message },
      { status: 500 }
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const out = NextResponse.json({ avatarUrl: publicUrl });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
