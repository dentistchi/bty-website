import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { hardenCookieOptions } from "@/lib/cookie-defaults";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Route Handler용 Supabase 서버 클라이언트
 * - Cloudflare/OpenNext에서 Set-Cookie 손실/옵션 꼬임 방지
 * - options는 절대 우리 기본값을 덮어쓰지 못함(마지막에 강제)
 */
export function getSupabaseServer(req: NextRequest, res: NextResponse) {
  if (!url || !key) return null;

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: Array<{ name: string; value: string; options?: unknown }>) {
        for (const { name, value, options } of cookies) {
          res.cookies.set(name, value, hardenCookieOptions(options));
        }
      },
    },
  });
}
