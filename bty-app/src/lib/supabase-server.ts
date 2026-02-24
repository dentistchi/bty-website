import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies as nextCookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { forceAuthCookieDefaults } from "@/lib/auth-cookie-defaults";
import { writeSupabaseAuthCookies } from "@/lib/bty/cookies/authCookies";

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
          cookieStore.set(c.name, c.value, forceAuthCookieDefaults(c.options as any) as any);
        });
      },
    },
  });
}

type SupabaseClient = Awaited<ReturnType<typeof getSupabaseServer>>;

/**
 * OAuth/콜백 등에서 쿠키를 캡처해 응답에 Path=/ 로 적용할 때 사용.
 * /api/* 요청에도 쿠키가 붙도록 함 (Edge/next/headers path 이슈 회피).
 */
export async function getSupabaseServerWithCookieCapture(req: NextRequest): Promise<{
  supabase: SupabaseClient;
  applyCookiesToResponse: (res: NextResponse) => void;
}> {
  const captured: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        for (const c of cookies) captured.push({ name: c.name, value: c.value, options: c.options });
      },
    },
  });
  return {
    supabase,
    applyCookiesToResponse(res) {
      writeSupabaseAuthCookies(res, captured);
    },
  };
}
