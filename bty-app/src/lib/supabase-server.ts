import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { forceCookieOptions } from "@/lib/cookie-utils";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type CookieToSetLocal = { name: string; value: string; options?: any };

/**
 * ✅ "쿠키 세션"을 읽고/갱신하고/set-cookie까지 필요한 용도
 * (login/logout/session 같은 라우트에서 사용)
 */
export function getSupabaseServer(req: NextRequest, res: NextResponse) {
  if (!url || !key) return null;

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        // NextRequest.cookies.getAll()는 동기
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: CookieToSetLocal[]) {
        cookies.forEach(({ name, value, options }) => {
          // ✅ 강제 옵션이 마지막에 와서 절대 덮어써지지 않음
          res.cookies.set(name, value, forceCookieOptions(options));
        });
      },
    },
  });
}
