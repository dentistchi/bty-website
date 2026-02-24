import type { NextResponse } from "next/server";

const AUTH_BASE = "sb-mveycersmqfiuddslnrj-auth-token";

export function getAuthCookieNames(): string[] {
  return [AUTH_BASE, `${AUTH_BASE}.0`, `${AUTH_BASE}.1`, `${AUTH_BASE}.2`, `${AUTH_BASE}.3`];
}

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
