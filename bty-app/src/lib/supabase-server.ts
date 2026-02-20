import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { forceCookieOptions, type CookieToSet } from "@/lib/cookie-utils";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Route Handler 전용 (app/api/.../route.ts)
 * - req: NextRequest
 * - res: NextResponse (쿠키를 여기에 set 해야 브라우저로 Set-Cookie가 내려감)
 */
export function getSupabaseServer(req: NextRequest, res: NextResponse) {
  if (!url || !key) return null;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        // NextRequest cookies는 동기
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: CookieToSet[]) {
        cookies.forEach((c) => {
          res.cookies.set(c.name, c.value, forceCookieOptions(c.options));
        });
      },
    },
  });

  return supabase;
}
