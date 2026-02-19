export type CookieLike = {
  name: string;
  value: string;
  options?: Record<string, any>;
};

/**
 * Cloudflare/OpenNext에서 Supabase가 주는 options에 의해
 * httpOnly/secure/sameSite/path가 뒤집히는 케이스 방지용 "강제" 옵션 병합.
 *
 * 핵심: ...options 를 먼저 깔고, 우리가 마지막에 강제로 덮어쓴다.
 */
export function mergeCookieOptions(options?: Record<string, any>) {
  return {
    ...(options ?? {}),
    path: "/",
    sameSite: "lax",
    secure: true,
    httpOnly: true,
  } as Record<string, any>;
}
