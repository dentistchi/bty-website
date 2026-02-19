import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Server Component(레이아웃/페이지)에서 "읽기 전용"으로 인증 확인할 때 사용
 * - cookies()는 Next 15에서 Promise일 수 있으므로 await 처리
 * - Server Component에서는 set-cookie가 필요 없으니 setAll은 NOOP
 */
export async function getSupabaseServerReadonly() {
  if (!url || !key) return null;

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        // ReadonlyRequestCookies에서 getAll() 사용
        return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll() {
        // Server Component에서는 쿠키 세팅 불가/불필요 → NOOP
      },
    },
  });
}
