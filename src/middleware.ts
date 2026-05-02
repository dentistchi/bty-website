/**
 * Middleware: locale normalization, logout cookie clear, protected page redirects.
 * API (/api/*): not auth-checked here; protected routes return 401 { error: "UNAUTHENTICATED" } via requireUser.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  authCookieSecureForRequest,
  expireAuthCookiesHard,
  reassertAuthCookiesPathRoot,
} from "@/lib/bty/cookies/authCookies";
import { getArenaPipelineDefault } from "@/lib/bty/arena/arenaPipelineConfig";
import { userHasBlockingArenaActionContract } from "@/lib/bty/arena/blockingArenaActionContract";
import { isPostLoginOnboardingWizardEnabled } from "@/lib/bty/arena/postLoginEliteEntry";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasSupabase = Boolean(url && key);

const LOCALES = ["en", "ko"] as const;

function getLocale(pathname: string): (typeof LOCALES)[number] | null {
  if (pathname.startsWith("/en") || pathname === "/en") return "en";
  if (pathname.startsWith("/ko") || pathname === "/ko") return "ko";
  return null;
}

function isPublicPath(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/api")) return true;
  if (pathname === "/") return true;

  const locale = getLocale(pathname);
  if (locale) {
    if (pathname === `/${locale}` || pathname === `/${locale}/`) return true;
    if (pathname === `/${locale}/center` || pathname === `/${locale}/center/`) return true;
    /** Dear Me letter writer: auth handled by AuthGate in component. Never block at middleware. */
    if (pathname === `/${locale}/dear-me` || pathname === `/${locale}/dear-me/`) return true;
    /** Center 50-item assessment + results: must be reachable without Foundry login. */
    if (pathname === `/${locale}/assessment` || pathname.startsWith(`/${locale}/assessment/`))
      return true;
    /** Legacy typo: `/[locale]/result` → handled by app route redirect to `/[locale]/assessment/result`. */
    if (pathname === `/${locale}/result` || pathname.startsWith(`/${locale}/result/`)) return true;
    if (pathname === `/${locale}/admin/login`) return true;
    if (pathname === `/${locale}/dev/scenario-preview`) return true;
    if (pathname === `/${locale}/bty/login`) return true;
    if (pathname === `/${locale}/bty/forgot-password`) return true;
    /** OAuth return + password reset: session is created client-side on these pages. Must not require auth. */
    if (pathname === `/${locale}/auth/callback` || pathname.startsWith(`/${locale}/auth/callback/`))
      return true;
    if (pathname === `/${locale}/auth/reset-password`) return true;
    if (pathname === `/${locale}/reset-password`) return true;
    if (pathname === `/${locale}/bty/logout`) return true;
    /** Leaderboard: API serves public overall view when cookies missing (Workers/Edge). Page load must not force login. */
    if (
      pathname === `/${locale}/bty/leaderboard` ||
      pathname.startsWith(`/${locale}/bty/leaderboard/`)
    )
      return true;
  }

  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const cookieSecure = authCookieSecureForRequest(req);

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/en", req.url), 307);
  }

  const locale = getLocale(pathname);

  /** Canonical Arena play is `/[locale]/bty-arena`; alias `/bty-arena/run` must not serve a cached shell without session/next. */
  if (
    locale &&
    (pathname === `/${locale}/bty-arena/run` || pathname === `/${locale}/bty-arena/run/`)
  ) {
    return NextResponse.redirect(new URL(`/${locale}/bty-arena`, req.url), 308);
  }

  /**
   * Legacy/mistyped Center assessment result URL: `/[locale]/result`
   * Canonical: `/[locale]/assessment/result`
   *
   * Implemented in middleware (308) so crawlers/clients get a real redirect — not an HTML shell with meta refresh.
   */
  if (
    locale &&
    (pathname === `/${locale}/result` || pathname.startsWith(`/${locale}/result/`))
  ) {
    return NextResponse.redirect(new URL(`/${locale}/assessment/result` + req.nextUrl.search, req.url), 308);
  }

  /** Legacy Arena UI `/[locale]/arena` → canonical `/[locale]/bty-arena` (308). */
  if (
    locale &&
    (pathname === `/${locale}/arena` ||
      pathname.startsWith(`/${locale}/arena/`))
  ) {
    const rest = pathname.slice(`/${locale}/arena`.length);
    const targetPath =
      rest === "" || rest === "/"
        ? `/${locale}/bty-arena`
        : `/${locale}/bty-arena${rest}`;
    const dest = new URL(targetPath + req.nextUrl.search, req.url);
    return NextResponse.redirect(dest, 308);
  }

  if (!locale) {
    if (
      pathname.startsWith("/bty") ||
      pathname.startsWith("/bty-arena") ||
      pathname.startsWith("/train") ||
      pathname.startsWith("/admin")
    ) {
      return NextResponse.redirect(new URL(`/en${pathname}`, req.url), 307);
    }
    return NextResponse.next();
  }

  if (pathname === `/${locale}/bty/logout`) {
    try {
      const next = req.nextUrl.searchParams.get("next") || `/${locale}/bty`;
      const login = new URL(`/${locale}/bty/login`, req.url);
      login.searchParams.set("next", next);

      const res = NextResponse.redirect(login, 303);
      res.headers.set("Cache-Control", "no-store");
      res.headers.set("Clear-Site-Data", '"cookies"');
      res.headers.set("x-mw-hit", "1");

      expireAuthCookiesHard(req, res, { secure: cookieSecure });
      return res;
    } catch {
      return NextResponse.redirect(new URL(`/${locale}/bty/login`, req.url), 303);
    }
  }

  // Authenticated user requesting login page → 302 to /bty (no cookie config change)
  if (locale && pathname === `/${locale}/bty/login` && hasSupabase) {
    try {
      const resLogin = NextResponse.next();
      const supabase = createServerClient(url!, key!, {
        cookies: {
          getAll() {
            return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
          },
          setAll(cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            for (const { name, value, options } of cookies) {
              const o = (options ?? {}) as Record<string, unknown>;
              const maxAge = typeof o.maxAge === "number" ? o.maxAge : undefined;
              const expiresRaw = o.expires;
              const expires =
                expiresRaw instanceof Date
                  ? expiresRaw
                  : typeof expiresRaw === "string"
                    ? new Date(expiresRaw)
                    : undefined;
              resLogin.cookies.set(name, value, {
                path: "/",
                sameSite: "lax",
                secure: cookieSecure,
                httpOnly: true,
                ...(typeof maxAge === "number" ? { maxAge } : {}),
                ...(expires && !Number.isNaN(expires.getTime()) ? { expires } : {}),
              });
            }
            resLogin.headers.set("x-cookie-writer", "middleware");
            resLogin.headers.set("x-auth-set-cookie-count", String(cookies.length));
          },
        },
      });
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        return NextResponse.redirect(new URL(`/${locale}/bty`, req.url), 302);
      }
      return resLogin;
    } catch {
      // fall through to normal public path handling
    }
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  // DEV ONLY: scenario runtime testing bypass
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_BTY_DEV_BYPASS_AUTH === "true" &&
    locale &&
    (pathname === `/${locale}/bty-arena` || pathname.startsWith(`/${locale}/bty-arena/`))
  ) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  if (!hasSupabase) {
    return res;
  }

  try {
    const supabase = createServerClient(url!, key!, {
      cookies: {
        getAll() {
          return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          for (const { name, value, options } of cookies) {
            const o = (options ?? {}) as Record<string, unknown>;
            const maxAge = typeof o.maxAge === "number" ? o.maxAge : undefined;
            const expiresRaw = o.expires;
            const expires =
              expiresRaw instanceof Date
                ? expiresRaw
                : typeof expiresRaw === "string"
                  ? new Date(expiresRaw)
                  : undefined;

            res.cookies.set(name, value, {
              path: "/",
              sameSite: "lax",
              secure: cookieSecure,
              httpOnly: true,
              ...(typeof maxAge === "number" ? { maxAge } : {}),
              ...(expires && !Number.isNaN(expires.getTime()) ? { expires } : {}),
            });
          }

          res.headers.set("x-cookie-writer", "middleware");
          res.headers.set("x-auth-set-cookie-count", String(cookies.length));
        },
      },
    });

    const { data } = await supabase.auth.getUser();
    const user = data?.user;

    if (!user) {
      const login = new URL(`/${locale}/bty/login`, req.url);
      login.searchParams.set("next", pathname + req.nextUrl.search);
      return NextResponse.redirect(login);
    }

    /**
     * Onboarding gate (see `OnboardingShell`): when `BTY_POST_LOGIN_ONBOARDING_ENABLED=1`.
     * Default: forced Elite V2 entry — no redirect to `/onboarding` from Arena/Foundry/Center; `/onboarding` → `/bty-arena`.
     */
    const onboardingPath =
      pathname === `/${locale}/onboarding` || pathname.startsWith(`/${locale}/onboarding/`);
    const onboardingGated =
      pathname.startsWith(`/${locale}/bty-arena`) ||
      pathname.startsWith(`/${locale}/bty/foundry`) ||
      pathname.startsWith(`/${locale}/center`);

    if (!isPostLoginOnboardingWizardEnabled()) {
      if (onboardingPath) {
        const jump = NextResponse.redirect(new URL(`/${locale}/bty-arena`, req.url));
        reassertAuthCookiesPathRoot(req, jump);
        jump.headers.set("x-mw-hit", "1");
        jump.headers.set("x-mw-user", "1");
        jump.headers.set("x-mw-onboarding", "skipped");
        return jump;
      }
    } else if (onboardingGated || onboardingPath) {
      const { data: ob } = await supabase
        .from("user_onboarding_progress")
        .select("step_completed")
        .eq("user_id", user.id)
        .maybeSingle();
      const scRaw = (ob as { step_completed?: unknown } | null)?.step_completed;
      const sc = typeof scRaw === "number" && Number.isFinite(scRaw) ? scRaw : 0;
      const onboardingDone = sc >= 5;

      if (!onboardingDone && onboardingGated) {
        const jump = NextResponse.redirect(new URL(`/${locale}/onboarding`, req.url));
        reassertAuthCookiesPathRoot(req, jump);
        jump.headers.set("x-mw-hit", "1");
        jump.headers.set("x-mw-user", "1");
        jump.headers.set("x-mw-onboarding", "required");
        return jump;
      }
      if (onboardingDone && onboardingPath) {
        const jump = NextResponse.redirect(new URL(`/${locale}/bty-arena`, req.url));
        reassertAuthCookiesPathRoot(req, jump);
        jump.headers.set("x-mw-hit", "1");
        jump.headers.set("x-mw-user", "1");
        jump.headers.set("x-mw-onboarding", "done");
        return jump;
      }
    }

    /** `ENGINE_ARCHITECTURE_V1.md` §6.3 — Pipeline N: open contract → My Page resolution (307). */
    if (
      getArenaPipelineDefault() === "new" &&
      locale &&
      (pathname === `/${locale}/bty-arena` || pathname.startsWith(`/${locale}/bty-arena/`))
    ) {
      const blocking = await userHasBlockingArenaActionContract(supabase, user.id);
      if (blocking) {
        const dest = new URL(`/${locale}/bty`, req.url);
        dest.searchParams.set("arena_contract", "resolve");
        const redirect = NextResponse.redirect(dest, 307);
        reassertAuthCookiesPathRoot(req, redirect);
        redirect.headers.set("x-mw-hit", "1");
        redirect.headers.set("x-mw-user", "1");
        redirect.headers.set("x-arena-pipeline", "new");
        redirect.headers.set("x-arena-contract-gate", "resolve");
        return redirect;
      }
    }

    reassertAuthCookiesPathRoot(req, res);
    res.headers.set("x-mw-hit", "1");
    res.headers.set("x-mw-user", "1");
    res.headers.set("x-mw-path", pathname);
    return res;
  } catch {
    const login = new URL(`/${locale}/bty/login`, req.url);
    login.searchParams.set("next", pathname + req.nextUrl.search);
    return NextResponse.redirect(login, 303);
  }
}

export const config = {
  matcher: [
    "/",
    "/en",
    "/en/:path*",
    "/ko",
    "/ko/:path*",
    "/bty/:path*",
    "/bty-arena",
    "/bty-arena/:path*",
    "/train/:path*",
    "/admin/:path*",
  ],
};
