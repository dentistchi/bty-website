import { NextRequest, NextResponse } from "next/server";
import { inferLocaleFromNextParam, sanitizeNextForRedirect } from "@/lib/auth/sanitize-next-for-redirect";
import {
  authCookieSecureForRequest,
  expireAuthCookiesHard,
  reassertAuthCookiesPathRoot,
} from "@/lib/bty/cookies/authCookies";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const rawNext = req.nextUrl.searchParams.get("next");
  const locale = inferLocaleFromNextParam(rawNext);
  const safe = sanitizeNextForRedirect(rawNext, { locale });
  const url = new URL(safe, req.nextUrl.origin);

  const res = NextResponse.redirect(url, 303);
  res.headers.set("Cache-Control", "no-store");
  const cookieSecure = authCookieSecureForRequest(req);
  expireAuthCookiesHard(req, res, { secure: cookieSecure });
  reassertAuthCookiesPathRoot(req, res, { secure: cookieSecure });
  return res;
}
