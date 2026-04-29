import type { NextResponse } from "next/server";

export type CookieToSet = {
  name: string;
  value: string;
  // @supabase/ssr가 넘기는 options는 런타임별로 shape이 조금씩 다를 수 있어 any로 받는 게 안전
  options?: any;
};

export function forceCookieOptions(options?: any) {
  // 중요한 포인트:
  // - options가 무엇이 오든, 마지막에 우리가 강제할 값이 "항상 승리"하도록 배치
  // - delete cookie/maxAge/expires 같은 값은 options에 있을 수 있으니 살려둔다(강제X)
  const o = options ?? {};
  return {
    ...o,
    // ✅ 마지막 강제 (절대 덮어쓰기 불가)
    path: "/",
    sameSite: "lax",
    secure: true,
    httpOnly: true,
  } as const;
}

/**
 * Cloudflare/OpenNext 호환:
 * - NextResponse 헤더에서 set-cookie를 안정적으로 꺼내서 다른 응답에 복사
 */
export function copySetCookies(from: NextResponse, to: NextResponse) {
  const anyHeaders = from.headers as any;

  // Next.js/런타임에 따라 getSetCookie() 유무가 갈림
  const list: string[] =
    anyHeaders.getSetCookie?.() ??
    (from.headers.get("set-cookie") ? [from.headers.get("set-cookie")!] : []);

  for (const c of list) to.headers.append("set-cookie", c);
}

/**
 * 디버깅용: Cookie 헤더에 어떤 쿠키 이름이 붙는지 확인
 */
export function getCookieNamesFromHeader(cookieHeader: string | null) {
  if (!cookieHeader) return [];
  return cookieHeader
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.split("=")[0]!.trim())
    .filter(Boolean);
}
