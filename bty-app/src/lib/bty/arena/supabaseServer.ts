import { cookies as nextCookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Arena API용 서버 Supabase 클라이언트.
 * middleware가 /api를 public으로 두므로, 각 API에서 auth 검사 필수.
 * OpenNext/Cloudflare에서 쿠키 세션이 읽히도록 @supabase/ssr 사용.
 */
export async function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieStore = await nextCookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll() {
        // MVP: 읽기 전용. 필요 시 set-cookie 반영 추가.
      },
    },
  });
}
