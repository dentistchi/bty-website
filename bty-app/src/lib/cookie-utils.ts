import type { NextResponse } from "next/server";

/**
 * Cloudflare/OpenNext에서 쿠키 옵션이 뒤에서 덮어써지는 걸 막기 위해
 * "우리가 강제할 값"을 마지막에 둔다.
 */
export function forceCookieOptions(options: any = {}) {
  return {
    ...options, // ✅ supabase가 준 옵션을 먼저
    path: "/", // ✅ 항상 루트
    sameSite: "lax", // ✅ 기본 Lax
    secure: true, // ✅ HTTPS 강제 (workers.dev도 https)
    httpOnly: true, // ✅ 세션 쿠키는 httpOnly 강제
  };
}

/**
 * NextResponse headers에서 Set-Cookie를 가능한 방식으로 전부 꺼낸다.
 * (환경별로 getSetCookie 유무가 달라서 방어적으로)
 */
export function getSetCookieStrings(res: NextResponse): string[] {
  const h = res.headers as any;

  // Next / 일부 런타임
  const viaGetSetCookie = typeof h.getSetCookie === "function" ? h.getSetCookie() : null;
  if (Array.isArray(viaGetSetCookie) && viaGetSetCookie.length) return viaGetSetCookie;

  // 표준 get('set-cookie')는 하나로 합쳐질 수 있음
  const sc = res.headers.get("set-cookie");
  return sc ? [sc] : [];
}

export function copySetCookie(from: NextResponse, to: NextResponse) {
  for (const c of getSetCookieStrings(from)) to.headers.append("set-cookie", c);
}
