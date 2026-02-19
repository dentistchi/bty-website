import type { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { mergeCookieOptions } from "@/lib/cookie-options";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * ✅ Route Handler에서만 사용 (login/logout/session 같은 API)
 * req + res 둘 다 필요. (set-cookie를 res에 심기 위해)
 */
export function getSupabaseServer(req: NextRequest, res: NextResponse) {
  if (!url || !key) return null;

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        // NextRequest.cookies.getAll()은 동기
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: Array<{ name: string; value: string; options?: Record<string, any> }>) {
        // 옵션은 mergeCookieOptions로 최종 강제
        for (const { name, value, options } of cookies as Array<{
          name: string;
          value: string;
          options?: Record<string, any>;
        }>) {
          res.cookies.set(name, value, mergeCookieOptions(options));
        }
      },
    },
  });
}
