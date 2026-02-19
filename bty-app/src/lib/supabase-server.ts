import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { cookies as nextCookies } from "next/headers";

// ✅ @supabase/ssr 에는 CookieToSet export가 없을 수 있어서 직접 타입 선언
type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, any>;
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * ✅ Route Handler용 (쿠키 set-cookie 필요)
 * - GET/POST route.ts 같은 곳에서 사용
 */
export function getSupabaseServer(req: NextRequest, res: NextResponse) {
  if (!url || !key) return null;

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: CookieToSet[]) {
        cookies.forEach(({ name, value, options }) => {
          // ✅ 기본 옵션 강제
          res.cookies.set(name, value, {
            path: "/",
            sameSite: "lax",
            secure: true,
            httpOnly: true,
            ...(options ?? {}),
          });
        });
      },
    },
  });
}

/**
 * ✅ Server Component / Layout / Page (RSC)용
 * - 여기서는 응답 헤더에 set-cookie를 쓸 수 없어서 setAll은 noop
 * - 대신 "쿠키 읽기"로 getUser / getSession 체크 가능
 */
export function createServerComponentSupabaseClient() {
  if (!url || !key) return null;

  const store = nextCookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(_cookies: CookieToSet[]) {
        // RSC에서는 쿠키 set이 불가한 경우가 많아서 noop 처리
      },
    },
  });
}

/**
 * ✅ (레거시 호환) createServerSupabaseClient 이름을 기대하는 코드 대응
 * - 실제 구현은 RSC용과 동일하게 "읽기 전용"으로 둠
 */
export function createServerSupabaseClient() {
  return createServerComponentSupabaseClient();
}
