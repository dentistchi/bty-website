import { NextRequest, NextResponse } from "next/server";

/**
 * Re-issue existing Supabase auth cookies at Path=/ so they are sent to /api/*.
 * This is a pragmatic Cloudflare/OpenNext fix when initial Set-Cookie path is missing.
 */
export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });

  const incoming = req.cookies.getAll();
  const authCookies = incoming.filter((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  res.headers.set("x-fix-incoming-count", String(incoming.length));
  res.headers.set("x-fix-auth-cookie-count", String(authCookies.length));

  for (const c of authCookies) {
    // Force Path=/ (host-only). Keep secure/httpOnly/lax.
    res.headers.append(
      "Set-Cookie",
      `${c.name}=${encodeURIComponent(c.value)}; Path=/; SameSite=Lax; Secure; HttpOnly`
    );
  }

  return res;
}
