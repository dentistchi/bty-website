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
import { userHasForcedResetPending } from "@/lib/bty/leadership-engine/state-service";
import { isPostLoginOnboardingWizardEnabled } from "@/lib/bty/arena/postLoginEliteEntry";
import { requireApprovedMembership } from "@/lib/bty/arena/requireApprovedMembership";
import { sanitizeNextForRedirect } from "@/lib/auth/sanitize-next-for-redirect";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasSupabase = Boolean(url && key);

const LOCALES = ["en", "ko"] as const;

/**
 * AL-LAUNCH-D3 consent gate (placeholder infra):
 * Block protected pages until `arena_profiles.consent_version` is set.
 * Defensive API list — current matcher excludes /api/*, but listed for
 * safety if matcher expands later.
 */
const CONSENT_BYPASS_PATHS = new Set<string>([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/send-reset-email",
  "/api/auth/callback",
  "/api/auth/after-login",
  "/api/auth/session",
  "/api/version",
  "/api/debug",
  "/api/legal/accept",
]);

const CONSENT_BYPASS_PATTERNS = [
  /^\/(en|ko)\/legal\//,
  /^\/_next\//,
  /^\/favicon/,
  /\.(png|jpe?g|gif|svg|ico|css|js|woff2?|webp)$/,
];

export function isConsentBypassed(pathname: string): boolean {
  if (CONSENT_BYPASS_PATHS.has(pathname)) return true;
  return CONSENT_BYPASS_PATTERNS.some((p) => p.test(pathname));
}

function getLocale(pathname: string): (typeof LOCALES)[number] | null {
  if (pathname.startsWith("/en") || pathname === "/en") return "en";
  if (pathname.startsWith("/ko") || pathname === "/ko") return "ko";
  return null;
}

/**
 * Locale for the canonical root redirect (Slice 3.1B-3E.3). No separate i18n runtime exists
 * (LangSwitch just navigates between `/en` and `/ko` paths), so this is the single entry
 * resolver — do not add a parallel locale system: a persisted `NEXT_LOCALE` cookie wins, else
 * the browser's primary Accept-Language, else default `en`.
 */
function resolveEntryLocale(req: NextRequest): (typeof LOCALES)[number] {
  const cookie = req.cookies.get("NEXT_LOCALE")?.value;
  if (cookie === "ko" || cookie === "en") return cookie;
  const al = (req.headers.get("accept-language") ?? "").trim().toLowerCase();
  if (al.startsWith("ko")) return "ko";
  return "en";
}

function isPublicPath(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/api")) return true;
  if (pathname === "/") return true;

  const locale = getLocale(pathname);
  if (locale) {
    if (pathname === `/${locale}` || pathname === `/${locale}/`) return true;
    /** Center 50-item assessment + results: must be reachable without Foundry login. */
    if (pathname === `/${locale}/assessment` || pathname.startsWith(`/${locale}/assessment/`))
      return true;
    /** Legacy typo: `/[locale]/result` → handled by app route redirect to `/[locale]/assessment/result`. */
    if (pathname === `/${locale}/result` || pathname.startsWith(`/${locale}/result/`)) return true;
    if (pathname === `/${locale}/admin/login`) return true;
    if (pathname === `/${locale}/dev/scenario-preview`) return true;
    /** P0 Orb Sensory Test — dev-only, frontend-only, auth-free preview. */
    if (pathname === `/${locale}/dev/orb`) return true;
    /**
     * Program review readability gate (Slice 3.2L-R5) — a static fixture rendered by the
     * real review component. Auth-free because it reads nothing: no draft, no API, no
     * provider. The page itself 404s outside development/staging.
     */
    if (pathname === `/${locale}/dev/program-review-preview`) return true;
    if (pathname === `/${locale}/bty/login`) return true;
    if (pathname === `/${locale}/bty/forgot-password`) return true;
    /** OAuth return + password reset: session is created client-side on these pages. Must not require auth. */
    if (pathname === `/${locale}/auth/callback` || pathname.startsWith(`/${locale}/auth/callback/`))
      return true;
    if (pathname === `/${locale}/auth/reset-password`) return true;
    if (pathname === `/${locale}/reset-password`) return true;
    if (pathname === `/${locale}/bty/logout`) return true;
  }

  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const cookieSecure = authCookieSecureForRequest(req);

  // Canonical root → app-shell journey (Slice 3.1B-3E.3). arena.btydaily.com is the Arena
  // APPLICATION origin, not the legacy web landing: `/` resolves locale and enters
  // `/{locale}/app`; the existing protected-route gate below then sends an unauthenticated
  // user to `/{locale}/bty/login?next=/{locale}/app`. (Previously `/` → `/en` rendered the
  // legacy LandingClient portal.)
  if (pathname === "/") {
    const entryLocale = resolveEntryLocale(req);
    return NextResponse.redirect(new URL(`/${entryLocale}/app`, req.url), 307);
  }

  const locale = getLocale(pathname);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-locale", locale ?? "ko");

  // Canonical bare-locale entry: `/{locale}` (+ trailing slash) must enter the app shell, not
  // the legacy landing portal (Slice 3.1B-3E.3). Deep routes `/{locale}/…` are untouched; an
  // unauthenticated user is routed to `/{locale}/bty/login?next=/{locale}/app` by the
  // protected-route gate below.
  if (locale && (pathname === `/${locale}` || pathname === `/${locale}/`)) {
    return NextResponse.redirect(new URL(`/${locale}/app`, req.url), 307);
  }

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

  /** VRS-1-A1: deprecated `/[locale]/dear-me` → canonical `/[locale]/center` (301). */
  if (
    locale &&
    (pathname === `/${locale}/dear-me` ||
      pathname.startsWith(`/${locale}/dear-me/`))
  ) {
    const rest = pathname.slice(`/${locale}/dear-me`.length);
    const targetPath =
      rest === "" || rest === "/"
        ? `/${locale}/center`
        : `/${locale}/center${rest}`;
    const dest = new URL(targetPath + req.nextUrl.search, req.url);
    return NextResponse.redirect(dest, 301);
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
    return NextResponse.next({ request: { headers: requestHeaders } });
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
      const resLogin = NextResponse.next({ request: { headers: requestHeaders } });
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
        // Honor a safe post-login `next` (installed-app sign-out → /app?tab=me,
        // account switch → /app?tab=foundry). Without this, an authenticated hit to
        // the login page is force-redirected to /bty and the app-shell target is lost.
        // This is the FAIL surface for Slice 3.1B-3E.2: the native cookie-propagation
        // race briefly bounces /app back here (with `next` preserved) and, once the
        // WKWebView cookie becomes visible, this branch previously dropped `next` → /bty.
        // sanitizeNextForRedirect is the single shared safe-next resolver (rejects
        // external/protocol-relative/malformed values and login-loop paths, falling back
        // to /{locale}/bty only when no valid app path is present).
        const dest = sanitizeNextForRedirect(req.nextUrl.searchParams.get("next"), { locale });
        return NextResponse.redirect(new URL(dest, req.url), 302);
      }
      return resLogin;
    } catch {
      // fall through to normal public path handling
    }
  }

  if (isPublicPath(pathname)) return NextResponse.next({ request: { headers: requestHeaders } });

  const isAaloPublicScan =
    /^\/(en|ko)\/my-page$/.test(pathname) &&
    req.nextUrl.searchParams.get("arena_action_loop") === "commit" &&
    req.nextUrl.searchParams.has("aalo");

  if (isAaloPublicScan) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // DEV ONLY: scenario runtime testing bypass
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_BTY_DEV_BYPASS_AUTH === "true" &&
    locale &&
    (pathname === `/${locale}/bty-arena` || pathname.startsWith(`/${locale}/bty-arena/`))
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });

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

    if (!isConsentBypassed(pathname)) {
      const { data: prof } = await supabase
        .from("arena_profiles")
        .select("consent_version")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!prof?.consent_version) {
        const acceptUrl = new URL(`/${locale}/legal/accept`, req.url);
        acceptUrl.searchParams.set("return", pathname + req.nextUrl.search);
        const redirect = NextResponse.redirect(acceptUrl, 307);
        reassertAuthCookiesPathRoot(req, redirect);
        redirect.headers.set("x-mw-hit", "1");
        redirect.headers.set("x-mw-user", "1");
        redirect.headers.set("x-mw-consent", "required");
        return redirect;
      }
    }

    /**
     * `BTY_ARENA_SEMANTIC_LOCKING_TABLE_v1.1.md` v1.1.1 §5.5.2 + FD-5 + §8-7 —
     * FORCED_RESET_PENDING sub-mode: full redirect to /center (HARD LOCKED).
     *
     * Source scope: `/[locale]/bty-arena/*` (v1.1.1 §2 row 8) + `/[locale]/bty/foundry/*`
     * (v1.1.1 §5.4 secondary block). `/center` itself is excluded to avoid loops;
     * `/api/*` is already excluded by the early-return at L61; `/bty/login` is
     * excluded by being outside the matched scope.
     *
     * Precedence: this check is BEFORE the LOCKED `userHasBlockingArenaActionContract`
     * block below — HARD LOCKED (§4.1: Center 외 모든 surface 접근 금지) outranks
     * LOCKED (다른 화면 진입은 허용). If both are true, the user goes to /center.
     */
    if (
      locale &&
      (pathname === `/${locale}/bty-arena` ||
        pathname.startsWith(`/${locale}/bty-arena/`) ||
        pathname === `/${locale}/bty/foundry` ||
        pathname.startsWith(`/${locale}/bty/foundry/`))
    ) {
      const forcedReset = await userHasForcedResetPending(supabase, user.id);
      if (forcedReset) {
        const dest = new URL(`/${locale}/center`, req.url);
        const redirect = NextResponse.redirect(dest, 307);
        reassertAuthCookiesPathRoot(req, redirect);
        redirect.headers.set("x-mw-hit", "1");
        redirect.headers.set("x-mw-user", "1");
        redirect.headers.set("x-forced-reset", "redirect");
        return redirect;
      }
    }

    /**
     * S2 Arena-entry gate: Arena play requires an approved `arena_membership_requests`
     * row. Unapproved (no row / pending / rejected) → submit at `/[locale]/my-page/team`.
     * Scoped to `/[locale]/bty-arena/*` only (Foundry/Center are not membership-gated).
     * Shares the single-source `requireApprovedMembership` helper with the API entry
     * points (defense-in-depth). Runs after consent + forced-reset; precedes the contract gate.
     */
    if (
      locale &&
      (pathname === `/${locale}/bty-arena` || pathname.startsWith(`/${locale}/bty-arena/`))
    ) {
      const membershipGate = await requireApprovedMembership(supabase, user.id);
      if (!membershipGate.approved) {
        const dest = new URL(`/${locale}/my-page/team`, req.url);
        const redirect = NextResponse.redirect(dest, 307);
        reassertAuthCookiesPathRoot(req, redirect);
        redirect.headers.set("x-mw-hit", "1");
        redirect.headers.set("x-mw-user", "1");
        redirect.headers.set("x-arena-membership", "required");
        return redirect;
      }
    }

    /**
     * Pipeline N: open Action contract → canonical validation surface (307).
     * The blocking contract gates Arena play; send the user to the resolve
     * surface (`ArenaResolveClient` → `ArenaActionValidationForm`). The resolve
     * path itself is excluded from the match so the redirect terminates there
     * (no loop). See MVP-PRE-DIAG-11/12.
     */
    const arenaResolvePath = `/${locale}/bty-arena/play/resolve`;
    if (
      getArenaPipelineDefault() === "new" &&
      locale &&
      (pathname === `/${locale}/bty-arena` || pathname.startsWith(`/${locale}/bty-arena/`)) &&
      pathname !== arenaResolvePath &&
      !pathname.startsWith(`${arenaResolvePath}/`)
    ) {
      const blocking = await userHasBlockingArenaActionContract(supabase, user.id);
      if (blocking) {
        const dest = new URL(arenaResolvePath, req.url);
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
