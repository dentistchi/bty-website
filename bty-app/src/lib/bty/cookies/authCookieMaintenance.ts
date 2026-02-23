import type { NextResponse } from "next/server";

type CookieName = string;

const AUTH_BASE = "sb-mveycersmqfiuddslnrj-auth-token";

// Supabase가 chunk로 쪼개는 케이스까지 모두 포함
export function getAuthCookieNames(): CookieName[] {
  return [AUTH_BASE, `${AUTH_BASE}.0`, `${AUTH_BASE}.1`, `${AUTH_BASE}.2`, `${AUTH_BASE}.3`];
}

/** 과거 잘못된 Path(/ko/bty 등)로 남아있는 sb auth 쿠키를 여러 path에서 만료. domain 미설정(host-only). */
export function expireAuthCookiesEverywhere(res: NextResponse) {
  const names = getAuthCookieNames();

  const paths = [
    "/",
    "/api",
    "/en",
    "/ko",
    "/en/bty",
    "/ko/bty",
    "/en/bty/login",
    "/ko/bty/login",
  ];

  for (const name of names) {
    for (const path of paths) {
      res.cookies.set(name, "", {
        path,
        expires: new Date(0),
        maxAge: 0,
        secure: true,
        httpOnly: true,
        sameSite: "lax",
      });
    }
  }

  res.headers.set("x-auth-expire-cookie-names", names.join(","));
  res.headers.set("x-auth-expire-paths", paths.join(","));
}
