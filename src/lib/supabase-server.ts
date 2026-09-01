import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies as nextCookies, headers as nextHeaders } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient as SupabaseJsClient } from "@supabase/supabase-js";
import { authCookieSecureForRequest, writeSupabaseAuthCookies } from "@/lib/bty/cookies/authCookies";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * THE SECOND TRANSPORT, AT THE FACTORY THE INLINE ROUTES ACTUALLY USE (Slice A0-RUNTIME2).
 *
 * A0 taught `requireUser` to accept a Supabase access token when no cookie is present, which
 * covered the 111 routes that compose it. It did not cover the rest, and the rest is not small:
 * **78 API routes authenticate inline** with their own `supabase.auth.getUser()`, and **74 of
 * them build that client here**. In a Teams tab — which carries no cookie by construction — every
 * one of those 74 returned 401.
 *
 * The Founder saw two symptoms of that single cause: the account row rendered "…" because
 * `/api/auth/session` was one of them, and "This week" span forever because
 * `/api/me/today/weekly-activity` was another. Patching either alone would have left 72 more.
 *
 * SO THE TRANSPORT IS TAUGHT ONCE, HERE, AND NO CALL SITE CHANGES. The cookie path is tried first
 * and is untouched, so a browser request can never reach the bearer branch. The token is a
 * SUPABASE access token — the Entra token's authority still ends at `/api/auth/teams-bootstrap`,
 * and nothing in this file knows Microsoft exists.
 */
function incomingBearer(headerValue: string | null | undefined): string | null {
  if (!headerValue) return null;
  const m = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  const t = m?.[1]?.trim();
  return t ? t : null;
}

/**
 * Wrap `auth.getUser` so a bearer-carrying request resolves without changing 74 call sites.
 *
 * Callers invoke `getUser()` with no argument, which reads the cookie session; with no cookie that
 * is null and the route 401s. This keeps that exact behaviour and adds one fallback: when the
 * cookie yields nothing AND a bearer was presented, ask again with the token. `getUser(jwt)` with
 * an explicit argument is passed straight through, so a caller that already knew what it wanted is
 * never second-guessed.
 */
function withBearerFallback<T extends SupabaseJsClient>(client: T, bearer: string | null): T {
  if (!bearer) return client;
  const auth = client.auth;
  const original = auth.getUser.bind(auth);
  auth.getUser = (async (jwt?: string) => {
    if (jwt) return original(jwt);
    const viaCookie = await original();
    if (viaCookie.data?.user) return viaCookie;
    return original(bearer);
  }) as typeof auth.getUser;
  return client;
}

/**
 * Route Handler / Server Action에서 쓰는 서버 클라이언트 (읽기 전용 쿠키).
 * - getAll()만 사용. setAll()은 no-op.
 * - Edge/next/headers에서 setAll 시 요청 path(/en, /ko 등)로 쿠키가 설정되어
 *   /api/* 에 쿠키가 안 붙는 문제가 있으므로, 쿠키 쓰기는 로그인/세션 API에서만 Path=/ 로 수행.
 */
export async function getSupabaseServer() {
  const cookieStore = await nextCookies();
  // The Teams tab presents a Supabase access token instead of a cookie. Reading it here is what
  // makes all 74 inline-auth routes work in that host without any of them changing.
  const bearer = incomingBearer((await nextHeaders()).get("authorization"));

  const client = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(_cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        // no-op: RSC/레이아웃에서 호출 시 요청 path로 쿠키가 설정되어 /api/* 에 쿠키 미전달 방지
      },
    },
    // Attached GLOBALLY, not just for getUser: these routes keep using the same client for real
    // work, and several read RLS-protected tables. A client that could identify the caller but not
    // act as them would authenticate correctly and then read nothing.
    ...(bearer ? { global: { headers: { Authorization: `Bearer ${bearer}` } } } : {}),
  });

  return withBearerFallback(client, bearer);
}

type SupabaseClient = Awaited<ReturnType<typeof getSupabaseServer>>;

/**
 * OAuth/콜백 등에서 쿠키를 캡처해 응답에 Path=/ 로 적용할 때 사용.
 * /api/* 요청에도 쿠키가 붙도록 함 (Edge/next/headers path 이슈 회피).
 */
export async function getSupabaseServerWithCookieCapture(req: NextRequest): Promise<{
  supabase: SupabaseClient;
  applyCookiesToResponse: (res: NextResponse) => void;
}> {
  const captured: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];
  // Same second transport as `getSupabaseServer` — `/api/auth/session` is built here, and it is
  // the route the account row reads.
  const bearer = incomingBearer(req.headers.get("authorization"));
  const supabase = withBearerFallback(
    createServerClient(url, key, {
      cookies: {
        getAll() {
          return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          for (const c of cookies) captured.push({ name: c.name, value: c.value, options: c.options });
        },
      },
      ...(bearer ? { global: { headers: { Authorization: `Bearer ${bearer}` } } } : {}),
    }),
    bearer,
  );
  return {
    supabase,
    applyCookiesToResponse(res) {
      writeSupabaseAuthCookies(res, captured, { secure: authCookieSecureForRequest(req) });
    },
  };
}
