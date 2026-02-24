import { NextRequest, NextResponse } from "next/server";
import { expireAuthCookiesHard, reassertAuthCookiesPathRoot } from "@/lib/bty/cookies/authCookies";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get("next") || "/bty";
  const url = new URL(next, req.url);

  const res = NextResponse.redirect(url, 303);
  res.headers.set("Cache-Control", "no-store");
  expireAuthCookiesHard(req, res);
  reassertAuthCookiesPathRoot(req, res);
  return res;
}
