import { NextResponse } from "next/server";

/**
 * NextResponse의 Set-Cookie들을 모두 수집 (환경별 API 차이 대응)
 * - Next.js/Undici 계열: getSetCookie() 지원
 * - Cloudflare Workers: 모든 set-cookie 헤더 직접 추출
 * - Fallback: 단일 set-cookie만 있는 환경
 */
export function getSetCookies(res: NextResponse): string[] {
  const h: any = res.headers as any;

  // Next.js/Undici 계열: getSetCookie() 지원
  const a = h.getSetCookie?.();
  if (Array.isArray(a) && a.length) return a;

  // Cloudflare Workers 호환: 모든 set-cookie 헤더 직접 추출
  const allHeaders = Array.from(res.headers.entries());
  const setCookieHeaders = allHeaders
    .filter(([key]) => key.toLowerCase() === 'set-cookie')
    .map(([, value]) => value);
  
  if (setCookieHeaders.length > 0) return setCookieHeaders;

  // Fallback: 단일 set-cookie만 있는 환경
  const one = res.headers.get("set-cookie");
  return one ? [one] : [];
}

/**
 * from의 Set-Cookie들을 to에 모두 append
 * 여러 개의 쿠키가 있어도 모두 안전하게 복사됨
 */
export function copySetCookies(from: NextResponse, to: NextResponse): void {
  const cookies = getSetCookies(from);
  for (const c of cookies) {
    to.headers.append("set-cookie", c);
  }
}
