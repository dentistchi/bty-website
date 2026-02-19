import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies as nextCookies, headers as nextHeaders } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type CookieSetInput = {
  name: string;
  value: string;
  options?: Record<string, any>;
};

function assertEnv() {
  if (!url || !key) return null;
  return { url, key };
}

/**
 * ✅ Route Handler / API 용 (req,res로 쿠키 읽고 Set-Cookie 반영)
 * - /api/** 에서 사용
 */
export function getSupabaseServer(req: NextRequest, res: NextResponse): SupabaseClient | null {
  const env = assertEnv();
  if (!env) return null;

  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookiesToSet: CookieSetInput[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
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
 * ✅ Server Component / Layout 용 (next/headers의 cookies()는 Next 15에서 Promise)
 * - app/** layout.tsx 등에서 사용
 */
export async function createServerComponentSupabaseClient(): Promise<SupabaseClient | null> {
  const env = assertEnv();
  if (!env) return null;

  const cookieStore = await nextCookies();
  const headerStore = await nextHeaders();

  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(_cookiesToSet: CookieSetInput[]) {
        // Server Component는 응답 쿠키를 직접 set 할 수 없음
        // (필요하면 Route Handler(/api/auth/session POST 등)로 위임)
      },
    },
    headers: {
      getAll() {
        // @supabase/ssr가 headers를 요구하는 경우 대비
        return Array.from(headerStore.entries()).map(([name, value]) => ({ name, value }));
      },
    } as any,
  });
}

/**
 * ✅ 기존 코드 호환용 alias (auth-server.ts 등에서 import하던 이름 유지)
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient | null> {
  return createServerComponentSupabaseClient();
}
