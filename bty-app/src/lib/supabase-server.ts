import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { forceCookieOptions } from "@/lib/cookie-options";

// Route Handler/Server Action에서 사용
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function getSupabaseServer() {
  const cookieStore = await cookies(); // Next 15: Promise
  // Route Handler는 항상 https로 들어오는 Cloudflare(OpenNext) 환경을 가정
  // (dev에서 http면 secure=false가 필요하면 여기서 분기 가능)
  const isHttps = true;

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, forceCookieOptions(options, { isHttps }) as any);
        });
      },
    },
  });
}
