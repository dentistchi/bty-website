import { cookies as nextCookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { forceAuthCookieDefaults } from "@/lib/auth-cookie-defaults";

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
