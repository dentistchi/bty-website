import { cookies as nextCookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server Supabase client for Arena API. Auth must be checked in each API.
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
