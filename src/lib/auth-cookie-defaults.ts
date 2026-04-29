export type CookieOptionsLike = {
  path?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
  httpOnly?: boolean;
  domain?: string;
  expires?: Date;
  maxAge?: number;
};

/**
 * Cloudflare/OpenNext에서 Supabase가 내려주는 options가 환경/버전별로 흔들릴 수 있어서
 * 우리가 원하는 보안 기본값을 "항상 마지막에" 덮어써서 고정한다.
 */
export function forceAuthCookieDefaults(options?: CookieOptionsLike): Record<string, unknown> {
  const o = { ...(options ?? {}) };

  return {
    ...o,
    // ✅ 반드시 고정(절대 덮어쓰이지 않게 마지막에 둠)
    path: "/",
    sameSite: "lax" as const,
    secure: true,
    httpOnly: true,
  };
}
