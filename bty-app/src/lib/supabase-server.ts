import { NextRequest, NextResponse } from "next/server";
import { cookies as nextCookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { forceAuthCookieDefaults, type CookieOptionsLike } from "@/lib/auth-cookie-defaults";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Route Handler / Server Action에서 쓰는 서버 클라이언트
 * - cookies()가 Promise인 런타임/타입 조합이 있어서 await로 통일
 * - setAll()에서 옵션을 마지막에 강제 덮어쓰기
 */
export async function getSupabaseServer() {
  const cookieStore = await nextCookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookies.forEach((c) => {
          cookieStore.set(c.name, c.value, forceAuthCookieDefaults(c.options as CookieOptionsLike) as Record<string, unknown>);
        });
      },
    },
  });
}

/**
 * Route Handler에서 세션 쿠키를 반드시 path="/" 로 붙여서 반환하고 싶을 때 사용.
 * setAll 시 쿠키를 수집하고, applyCookiesToResponse(res)로 지정한 NextResponse에 path="/", domain=hostname 강제 적용.
 */
export async function getSupabaseServerWithCookieCapture(req: NextRequest) {
  const cookieStore = await nextCookies();
  const hostname = req.nextUrl.hostname;
  const cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookies.forEach((c) => cookiesToSet.push({ name: c.name, value: c.value, options: c.options }));
      },
    },
  });

  function applyCookiesToResponse(res: NextResponse) {
    cookiesToSet.forEach((c) => {
      res.cookies.set(c.name, c.value, forceAuthCookieDefaults(c.options as CookieOptionsLike, hostname) as Record<string, unknown>);
    });
  }

  return { supabase, applyCookiesToResponse };
}
