import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { applyCookieDefaults } from "@/lib/cookie-defaults";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Route Handler( /api/* )에서 쓰는 Supabase 서버 클라이언트.
 * - 요청 쿠키를 읽고(getAll)
 * - Supabase가 설정하려는 쿠키를 "같은 응답"에 심는다(setAll)
 * - applyCookieDefaults로 path/samesite/secure/httponly를 최종 강제
 */
export function getSupabaseServer(req: NextRequest, res: NextResponse) {
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, applyCookieDefaults(options));
        });
      },
    },
  });
}
