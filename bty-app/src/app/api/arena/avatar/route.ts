import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/arena/avatar?userId=xxx
 * Proxies avatar image from Supabase Storage so the leaderboard (and any cross-origin page)
 * can load it without CORS issues. Storage bucket "avatars" is public; we fetch server-side
 * and return with permissive CORS.
 */
export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId || !UUID_REGEX.test(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  const baseUrl = base.replace(/\/$/, "");

  const exts = ["png", "jpg", "jpeg", "webp", "gif"];
  let res: Response | null = null;
  let contentType = "image/png";
  for (const ext of exts) {
    const storagePath = `${baseUrl}/storage/v1/object/public/avatars/${userId}/avatar.${ext}`;
    const r = await fetch(storagePath, { cache: "no-store" });
    if (r.ok) {
      res = r;
      contentType = r.headers.get("content-type") || `image/${ext === "jpg" ? "jpeg" : ext}`;
      break;
    }
  }

  if (!res || !res.ok) {
    // No custom avatar in Storage — redirect to default so <img> always gets an image (no broken icon).
    const defaultUrl = new URL("/avatars/default-avatar.svg", req.url);
    return NextResponse.redirect(defaultUrl, 302);
  }

  const blob = await res.blob();
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
  headers.set("Access-Control-Allow-Origin", "*");

  return new NextResponse(blob, { status: 200, headers });
}
