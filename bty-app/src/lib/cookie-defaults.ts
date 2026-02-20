// bty-app/src/lib/cookie-defaults.ts
export type CookieOptions = {
  domain?: string;
  path?: string;
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
};

export function withForcedAuthCookieDefaults(options: CookieOptions | undefined) {
  const o = options ?? {};
  return {
    ...o,
    // ✅ Cloudflare/OpenNext에서는 이 4개는 "절대" 뒤집히면 안 됨
    path: "/",
    sameSite: "lax" as const,
    secure: true,
    httpOnly: true,
  };
}
