import { cookies as nextCookies, headers as nextHeaders } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  readIncomingAuthorization,
  bearerGlobalOption,
  withBearerFallback,
} from "@/lib/supabase/bearerTransport";

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
  /*
    TWO TRANSPORTS (Slice A0.2). 61 API routes build their client here — the largest single group
    in the product, and the one A0-RUNTIME2 missed because a substring grep folded this factory in
    with `getSupabaseServer`. In the Teams tab, which carries no cookie, every one of them refused;
    the Center "Today personalization" toggle was simply the first that a Founder tapped.

    Cookie first and unchanged; the bearer is consulted only when there is no cookie session.
  */
  const bearer = await readIncomingAuthorization(nextHeaders);

  const client = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll() {
        // Read-only here.
      },
    },
    ...bearerGlobalOption(bearer),
  });

  return withBearerFallback(client, bearer);
}
