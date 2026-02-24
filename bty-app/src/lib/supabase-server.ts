import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies as nextCookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { writeSupabaseAuthCookies } from "@/lib/bty/cookies/authCookies";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Route Handler / Server Action에서 쓰는 서버 클라이언트 (읽기 전용 쿠키).
 * - getAll()만 사용. setAll()은 no-op.
 * - Edge/next/headers에서 setAll 시 요청 path(/en, /ko 등)로 쿠키가 설정되어
 *   /api/* 에 쿠키가 안 붙는 문제가 있으므로, 쿠키 쓰기는 로그인/세션 API에서만 Path=/ 로 수행.
 */
export async function getSupabaseServer() {
  const cookieStore = await nextCookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(_cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        // no-op: RSC/레이아웃에서 호출 시 요청 path로 쿠키가 설정되어 /api/* 에 쿠키 미전달 방지
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
