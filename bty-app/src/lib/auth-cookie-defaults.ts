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
 * path="/" 로 해서 모든 경로에서 쿠키가 실리도록 함.
 */
export function forceAuthCookieDefaults(
  options?: CookieOptionsLike,
  domain?: string
): Record<string, unknown> {
  const o = { ...(options ?? {}) };

  return {
    ...o,
    path: "/",
    sameSite: "lax" as const,
    secure: true,
    httpOnly: true,
    ...(domain != null && domain !== "" ? { domain } : {}),
  };
}
