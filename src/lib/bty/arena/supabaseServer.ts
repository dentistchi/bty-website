import { cookies as nextCookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server Supabase client bound to the **current request** cookie jar (Next.js App Router).
 *
 * **Only call from Route Handlers, Server Actions, or Server Components** — `cookies()` from
 * `next/headers` throws outside an active request. Engine/services must not import this; they
 * should receive a `SupabaseClient` from the caller or use **`getSupabaseAdmin()`** where
 * service-role access is appropriate (tests, smoke, admin jobs).
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
        // Read-only here.
      },
    },
  });
}
