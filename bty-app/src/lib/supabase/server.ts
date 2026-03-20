import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Supabase browser session for App Router **Route Handlers** and Server Actions.
 * Uses `getAll` / `setAll` per `@supabase/ssr` (v0.5+).
 * Cookie writes may no-op in read-only contexts; auth reads work when the session cookie is present.
 */
export async function createSupabaseRouteClient() {
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(
        cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[],
      ) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set({ name, value, ...options });
          }
        } catch {
          // e.g. read-only cookie store in some RSC/route contexts
        }
      },
    },
  });
}
