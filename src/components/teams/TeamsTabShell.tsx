"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import BtyDailyAppShell from "@/components/app-shell/BtyDailyAppShell";
import TeamsRuntimeProbe from "@/components/teams/TeamsRuntimeProbe";
import { getSupabase } from "@/lib/supabase";
import { isSavedLocale, readSavedLocale } from "@/lib/localePreference";
import {
  installTeamsApiTransport,
  installTeamsFrameContainment,
} from "@/lib/bty/teams/teamsTabTransport";

/**
 * The BTY Personal Tab. Slice A0.
 *
 * ONE JOB: turn the identity Teams already holds into the Supabase session the existing BTY shell
 * already expects, then get out of the way and render that shell. There is deliberately no Teams
 * product UI here — the same `BtyDailyAppShell` renders Today / Learn / Practice / Me, and this
 * file adds a bootstrap in front of it and a frame guard around it.
 *
 * THE LIFECYCLE, ONCE PER TAB LOAD:
 *
 *   app.initialize() → authentication.getAuthToken()   ← silent; Teams caches this token itself
 *   POST /api/auth/teams-bootstrap  (Bearer <Entra token>)
 *   → { session }            supabase.auth.setSession(...)  → render
 *   → { needsFirstSignIn }   one user-initiated popup, once per person ever → re-bootstrap
 *
 * NOTHING DURABLE IS STORED. The Supabase client under `/teams` is memory-only (see
 * `src/lib/supabase.ts`), and nothing here writes to localStorage, sessionStorage, IndexedDB, a
 * cookie, the URL, `window.name`, or a Teams card. Durability belongs to Teams, which already
 * caches the Entra token, and to Supabase, which owns the user record. A cold load simply
 * bootstraps again.
 *
 * BOOTSTRAP RUNS ONCE PER TAB SESSION, never per render and never per API call. `/auth/v1/verify`
 * is limited to 360/hour with bursts of 30 per IP and is not configurable, and BTY's calls all
 * egress from one Worker — so a bootstrap per render would spend an organisation-wide budget on
 * nothing. Once the session exists, Supabase's ordinary refresh keeps it alive on a separate and
 * much larger budget.
 */

type Phase =
  | { k: "starting" }
  | { k: "needs_first_sign_in" }
  | { k: "signing_in" }
  | { k: "ready"; locale: "en" | "ko" }
  | { k: "retry"; message: string }
  | { k: "failed"; message: string };

/** Bounded backoff for a throttled bootstrap. Never unbounded, never instant. */
const RETRY_DELAYS_MS = [1500, 4000, 10000];

const COPY = {
  starting: "Opening BTY…",
  signingIn: "Waiting for Microsoft…",
  firstTitle: "BTY",
  firstBody: "Connect your Microsoft account once to start using BTY here.",
  firstCta: "Continue with Microsoft",
  retry: "BTY couldn't open yet. Trying again…",
  failed: "BTY couldn't open yet.",
  failedCta: "Open BTY",
} as const;

/** Teams' own language, used only when the person has expressed no BTY preference. */
function localeFromTeams(raw: unknown): "en" | "ko" | null {
  const s = typeof raw === "string" ? raw.toLowerCase() : "";
  if (s.startsWith("ko")) return "ko";
  if (s.startsWith("en")) return "en";
  return null;
}

export default function TeamsTabShell() {
  const [phase, setPhase] = useState<Phase>({ k: "starting" });
  /** The live access token, read through a getter by the transport so refresh is picked up. */
  const accessTokenRef = useRef<string | null>(null);
  /** Bootstrap is idempotent per tab; this stops StrictMode and re-renders from spending budget. */
  const startedRef = useRef(false);
  const attemptRef = useRef(0);

  /** Install the transport + containment exactly once, before any shell fetch can run. */
  useEffect(() => {
    const uninstallTransport = installTeamsApiTransport(() => accessTokenRef.current);
    const uninstallContainment = installTeamsFrameContainment((url) => {
      void (async () => {
        try {
          const { app } = await import("@microsoft/teams-js");
          await app.openLink(url);
        } catch {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      })();
    });
    return () => {
      uninstallTransport();
      uninstallContainment();
    };
  }, []);

  /**
   * Tell the server WHICH pre-bootstrap step failed (Slice A0-RUNTIME).
   *
   * A failure before the token exists sends no request, so a live tail sees nothing — which is
   * indistinguishable from nobody having tapped. This carries a short step name and NO token, and
   * the 401 it receives is expected and ignored.
   */
  const reportPreBootstrapFailure = useCallback(async (step: string): Promise<void> => {
    try {
      await fetch("/api/auth/teams-bootstrap", {
        method: "POST",
        headers: { "X-BTY-Teams-Client-Error": step },
        cache: "no-store",
      });
    } catch {
      /* diagnostics must never become a second failure */
    }
  }, []);

  const bootstrap = useCallback(async (): Promise<void> => {
    /*
      Each pre-bootstrap step is named, because they fail for completely different reasons: a chunk
      that did not load, a tab that is not really inside Teams, and an Entra refusal are three
      different repairs and one indistinguishable screen.
    */
    let step = "import_teams_js";
    let app: typeof import("@microsoft/teams-js").app;
    let entraToken: string;
    try {
      const sdk = await import("@microsoft/teams-js");
      app = sdk.app;
      step = "app_initialize";
      await app.initialize();
      step = "get_auth_token";
      // Silent for anyone already signed into Teams. Teams caches and returns the token itself.
      entraToken = await sdk.authentication.getAuthToken();
    } catch (e) {
      await reportPreBootstrapFailure(step);
      throw e;
    }

    const res = await fetch("/api/auth/teams-bootstrap", {
      method: "POST",
      headers: { Authorization: `Bearer ${entraToken}` },
      cache: "no-store",
    });

    if (res.status === 429) throw Object.assign(new Error("rate_limited"), { retryable: true });
    if (!res.ok) throw Object.assign(new Error(`bootstrap_${res.status}`), { retryable: res.status >= 500 });

    const body = (await res.json()) as
      | { needsFirstSignIn: true }
      | { session: { access_token: string; refresh_token: string } };

    if ("needsFirstSignIn" in body) {
      setPhase({ k: "needs_first_sign_in" });
      return;
    }

    // A genuine Supabase session. From here the browser Supabase client, RLS, `auth.uid()` and
    // every existing component behave exactly as they do on the web.
    const supabase = getSupabase();
    const { error } = await supabase.auth.setSession({
      access_token: body.session.access_token,
      refresh_token: body.session.refresh_token,
    });
    if (error) throw Object.assign(new Error("set_session_failed"), { retryable: false });

    accessTokenRef.current = body.session.access_token;
    // Keep the transport's token current across Supabase's own refreshes.
    supabase.auth.onAuthStateChange((_e, session) => {
      accessTokenRef.current = session?.access_token ?? null;
    });

    let ctxLocale: "en" | "ko" | null = null;
    try {
      const ctx = await app.getContext();
      ctxLocale = localeFromTeams(ctx?.app?.locale);
    } catch {
      /* context is a convenience here, never an authority */
    }
    const saved = readSavedLocale(typeof document !== "undefined" ? document.cookie : null);
    const locale = isSavedLocale(saved) ? saved : (ctxLocale ?? "en");
    setPhase({ k: "ready", locale });
  }, []);

  const run = useCallback(async () => {
    try {
      await bootstrap();
    } catch (e) {
      const retryable = Boolean((e as { retryable?: unknown })?.retryable);
      const delay = RETRY_DELAYS_MS[attemptRef.current];
      if (retryable && delay !== undefined) {
        attemptRef.current += 1;
        setPhase({ k: "retry", message: COPY.retry });
        window.setTimeout(() => void run(), delay);
        return;
      }
      // Fail closed. No fabricated session, no cached identity, no silent email fallback.
      accessTokenRef.current = null;
      setPhase({ k: "failed", message: COPY.failed });
    }
  }, [bootstrap]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void run();
  }, [run]);

  /**
   * First-ever sign-in. A USER ACTION, never automatic: Microsoft's own guidance is that an
   * auto-opened auth popup gets blocked by the browser and confuses the person.
   *
   * The popup returns the literal `"ok"` and NOTHING else — no token, no email, no user id. That
   * is deliberate: Microsoft's documented pattern hands tokens back through `localStorage`, and
   * Microsoft also documents that pattern failing under third-party storage partitioning, which is
   * the default on iOS. The session is re-derived server-side instead, so the failure mode never
   * applies.
   */
  const onFirstSignIn = useCallback(async () => {
    setPhase({ k: "signing_in" });
    try {
      const { authentication } = await import("@microsoft/teams-js");
      await authentication.authenticate({
        url: `${window.location.origin}/teams/link`,
        width: 600,
        height: 620,
      });
    } catch {
      /*
        ★ A REJECTED POPUP IS NOT PROOF THAT NOTHING HAPPENED (Slice A0-FIRST-TIME-ACTIVATION).

        MEASURED ON A REAL FIRST USE, 2026-09-01. The activation genuinely SUCCEEDED — Supabase
        created the canonical `auth.users` row and its azure identity at 22:12:13, on the first
        attempt — and yet this tab sat unable to open until the person force-quit Teams and came
        back at 01:58. Nearly four hours, with a working account the whole time.

        The reason was here: `run()` used to live inside the `try`, so a popup that rejected sent
        the person straight back to the button without ever asking the server again. And
        `authenticate()` rejects for several reasons that say nothing about whether activation
        happened — the host dismissing the window, a cancel, or the callback page reporting a
        failure for a step that runs AFTER the identity already exists.

        So the popup's verdict is no longer the authority on whether the person has an account.
        The SERVER is, and it is asked below on every outcome. If activation really did not
        happen, the bootstrap simply answers `needsFirstSignIn` again and the button comes back —
        no reload, no polling, no sleep, and no second identity.
      */
    }
    attemptRef.current = 0;
    await run();
  }, [run]);

  /*
    Slice TQ-1 — the runtime probe, and ONLY when the URL asks for it.

    Read straight from `window.location` rather than `useSearchParams`, because this tab is
    deliberately outside the app's routing conventions and a Suspense boundary here would be a new
    way for the surface we are diagnosing to fail. A missing or absent flag renders nothing at all,
    so the ordinary tab is byte-identical to what it was.
  */
  const diag =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("diag") === "1";

  if (phase.k === "ready") {
    return (
      <>
        <BtyDailyAppShell locale={phase.locale} />
        {diag ? <TeamsRuntimeProbe /> : null}
      </>
    );
  }

  const line =
    phase.k === "starting"
      ? COPY.starting
      : phase.k === "signing_in"
        ? COPY.signingIn
        : phase.k === "retry"
          ? phase.message
          : phase.k === "failed"
            ? phase.message
            : "";

  return (
    <main
      data-testid="teams-tab-gate"
      data-phase={phase.k}
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center text-white"
    >
      <p className="text-lg font-semibold">{COPY.firstTitle}</p>

      {phase.k === "needs_first_sign_in" ? (
        <>
          <p className="max-w-xs text-sm text-white/70">{COPY.firstBody}</p>
          <button
            type="button"
            data-testid="teams-first-sign-in"
            onClick={() => void onFirstSignIn()}
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-[#0B1F3A]"
          >
            {COPY.firstCta}
          </button>
        </>
      ) : (
        <p className="text-sm text-white/70">{line}</p>
      )}

      {phase.k === "failed" ? (
        <button
          type="button"
          data-testid="teams-retry"
          onClick={() => {
            attemptRef.current = 0;
            setPhase({ k: "starting" });
            void run();
          }}
          className="rounded-lg border border-white/30 px-5 py-2.5 text-sm font-semibold"
        >
          {COPY.failedCta}
        </button>
      ) : null}
    </main>
  );
}
