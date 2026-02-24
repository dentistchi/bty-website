import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAMES } from "@/lib/bty/cookies/authCookies";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const all = req.cookies.getAll();
  const names = all.map((c) => c.name);
  const authNames = names.filter((n) => AUTH_COOKIE_NAMES.includes(n));

  const res = NextResponse.json({
    ok: true,
    cookieCount: all.length,
    authCookieCount: authNames.length,
    authCookieNames: authNames,
  });
  res.headers.set("x-auth-cookie-count", String(all.length));
  return res;
}
