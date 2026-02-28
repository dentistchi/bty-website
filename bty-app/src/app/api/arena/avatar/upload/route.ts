import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";

const AVATAR_BUCKET = "avatars";
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
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
  if (!ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number])) {
    const out = NextResponse.json(
      { error: "INVALID_TYPE", allowed: [...ALLOWED_TYPES] },
      { status: 400 }
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  if (file.size > MAX_SIZE_BYTES) {
    const out = NextResponse.json(
      { error: "FILE_TOO_LARGE", maxBytes: MAX_SIZE_BYTES },
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
