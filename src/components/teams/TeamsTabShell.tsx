"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BTY_SHELL_DESTINATION_EVENT, decodeShellSubEntityId } from "@/domain/teams/btyDestination";
import BtyDailyAppShell from "@/components/app-shell/BtyDailyAppShell";
import TeamsRuntimeProbe from "@/components/teams/TeamsRuntimeProbe";
import { getSupabase } from "@/lib/supabase";
import { isSavedLocale, readSavedLocale } from "@/lib/localePreference";
import { readTrainingRequest, type TrainingRequest } from "@/domain/teams/trainingRequest";
import { BTY_TEAMS_PERSONAL_TAB_ENTITY_ID } from "@/domain/teams/trainingTarget";
import {
  clearTeamsSubPage,
  clearTrainingQueryParam,
  currentSearch,
  readTeamsSubPageId,
} from "@/lib/bty/teams/teamsTabNavigation";
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
  /*
    THE TRAINING THE HOST CONTEXT CURRENTLY NAMES, as a request the shell can act on more than once.
    Held here rather than inside `phase` because it changes on tab RESUME, which is not a phase
    change: the session is already ready and must not be re-derived to notice a new deep link.
  */
  const [trainingRequest, setTrainingRequest] = useState<TrainingRequest | null>(null);
  /** Occurrence counter — what makes two taps of the SAME invitation two distinct asks. */
  const occurrenceRef = useRef(0);

  /** Install the transport + containment exactly once, before any shell fetch can run. */
  useEffect(() => {
    const uninstallTransport = installTeamsApiTransport(() => accessTokenRef.current);
    const uninstallContainment = installTeamsFrameContainment(
      (url) => {
        /*
          LEAVING IS NOW THE EXCEPTION, NOT THE RULE. Only destinations that are not ours, or ours
          with no in-shell representation yet, reach this opener.
        */
        void (async () => {
          try {
            const { app } = await import("@microsoft/teams-js");
            await app.openLink(url);
          } catch {
            window.open(url, "_blank", "noopener,noreferrer");
          }
        })();
      },
      /*
        A BTY DESTINATION STAYS HERE. The shell rendering this tab is the same `BtyDailyAppShell`
        the web serves, and it already reads its destination from the document's query. So the
        query is written onto `/teams` with `replaceState` — no navigation, no history entry, the
        document never changes — and the shell is told to re-read it.

        Returning false hands the link back to the opener rather than swallowing the click: a tap
        that does nothing is worse than a tap that opens a browser.
      */
      (search) => {
        try {
          window.history.replaceState({}, "", `${window.location.pathname}${search}`);
          window.dispatchEvent(new Event(BTY_SHELL_DESTINATION_EVENT));
          return true;
        } catch {
          return false;
        }
      },
    );
    return () => {
      uninstallTransport();
      uninstallContainment();
    };
  }, []);

  /**
   * A personal-tab deep link can name a SHELL destination instead of a training — "open My Learning
   * at this completed training", for instance. Apply it the same way an in-app link is applied:
   * write the query onto this document and tell the mounted shell to re-read it.
   *
   * ★ WHY THIS EXISTS. `subPageId` was previously fed only to `readTrainingRequest`, which parses a
   * signed training target. Anything else fell through it silently and the learner landed on the
   * default surface — the bot's button would have opened BTY and then lost the destination on the
   * way in. Returning false leaves the value to the training parser, which is the other legitimate
   * kind of subPageId; it is never swallowed.
   */
  const applyShellSubEntityId = useCallback((raw: unknown): boolean => {
    const search = decodeShellSubEntityId(raw);
    if (!search) return false;
    try {
      window.history.replaceState({}, "", `${window.location.pathname}${search}`);
      window.dispatchEvent(new Event(BTY_SHELL_DESTINATION_EVENT));
      return true;
    } catch {
      return false;
    }
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
    /*
      THE DEEP-LINKED TRAINING — the COLD read.

      A personal-tab deep link carries `context.subEntityId`, which the Teams client hands back as
      `page.subPageId`. It is read HERE — after the bootstrap above has already produced a real
      session — because a training must never open before we know who is opening it.

      IT IS PARSED, NEVER FOLLOWED. `subPageId` comes from the Teams client and anyone can craft a
      deep link, so it goes through the one approved grammar: either it is
      `foundry-training:<signed room token>` or it is nothing at all. It can never name a path, an
      origin, an internal route, an event id or a user, and a value that fails to parse simply
      opens the ordinary tab — which is also what every non-deep-link launch does.

      This read alone was the bug: see the refresh effect below for why a cold read cannot be the
      only one.
    */
    /*
      TWO TRANSPORTS, ONE GRAMMAR, AND THE SAME GATE.

      `page.subPageId` is what a client that navigates the tab target supplies. Teams iOS was
      measured supplying NOTHING — it opened the BTY app full-screen from `webUrl` instead — so
      the same signed target now also rides `/teams?training=…`, and both are read here.

      BOTH ARE READ ONLY HERE, after the bootstrap above has produced a real session. A query
      parameter is not permission: outside a valid Teams host this line is never reached, the
      request is never set, and the account-backed room is never opened. There is no browser
      auth fallback and no anonymous substitution — the learner gets the ordinary Teams gate.
    */
    try {
      const ctx = await app.getContext();
      ctxLocale = localeFromTeams(ctx?.app?.locale);
      const page = ctx?.page as { subPageId?: unknown; subEntityId?: unknown } | undefined;
      const sub = page?.subPageId ?? page?.subEntityId;
      /*
        A shell destination is applied and consumed here; only a training target continues to the
        training parser below. One value, two kinds, each read by what understands it.
      */
      if (!applyShellSubEntityId(sub)) {
        setTrainingRequest(readTrainingRequest({ subPageId: sub, search: currentSearch() }, "bootstrap", 0));
      }
    } catch {
      /*
        The context could not be read — but the session above already succeeded, so the fallback
        transport is still a legitimate statement of which training was meant, and reading it is
        exactly the case this slice exists for.
      */
      setTrainingRequest(readTrainingRequest({ search: currentSearch() }, "bootstrap", 0));
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

  /*
    ★ RE-READ THE HOST CONTEXT WHEN THE TAB COMES BACK (Slice Teams iOS Deep-Link Resume).

    THE MEASURED FAILURE. The Host's invitation opened BTY inside Teams — routing worked — but the
    tab showed ordinary Learn instead of the named training. On Teams iOS, tapping a deep link
    RESUMES the existing personal-tab WebView rather than remounting it, so the only read of
    `app.getContext()` had already happened, minutes or hours earlier, and the freshly delivered
    `subPageId` was observed by nobody.

    So the tab now asks again whenever it returns to the foreground. `focus` and
    `visibilitychange → visible` are the two signals a resumed WebView actually produces, and both
    are cheap.

    THIS REFRESHES NAVIGATION ONLY. It calls `app.getContext()` and nothing else: no
    `/api/auth/teams-bootstrap`, no token exchange, no session work. Re-bootstrapping to read a
    navigation field would spend the organisation-wide `/auth/v1/verify` budget (360/hour per IP,
    all of BTY behind one Worker) on a question that has nothing to do with identity. A test
    asserts the bootstrap count does not move.

    IT RUNS ONLY WHEN THE SESSION IS READY, so a deep link can never be acted on before we know who
    is opening it — the same ordering the cold read has.

    EVERY OBSERVED TARGET IS A NEW OCCURRENCE. That is deliberate: a learner who finishes, presses
    Back to Learn, returns to the chat and taps the SAME invitation produces an identical
    `subPageId`, and only the occurrence distinguishes the second ask from the first. The shell,
    not this seam, decides what to do with one — it refuses an occurrence naming the training
    already open, so a mid-quiz refocus never remounts the room.
  */
  useEffect(() => {
    if (phase.k !== "ready") return;
    if (typeof window === "undefined") return;
    let cancelled = false;

    const refresh = () => {
      void (async () => {
        const raw = await readTeamsSubPageId();
        if (cancelled) return;
        // Same division on a resumed tab: a destination is applied, a training is delivered.
        if (applyShellSubEntityId(raw)) return;
        occurrenceRef.current += 1;
        /*
          The URL is re-read on every refresh too, not just at bootstrap: an iOS client that
          reopens the tab from `webUrl` delivers the training there and nowhere else, and it may
          do so while this tab is already running.
        */
        setTrainingRequest(
          readTrainingRequest({ subPageId: raw, search: currentSearch() }, "refresh", occurrenceRef.current),
        );
      })();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [phase.k]);

  /*
    LEAVING A TRAINING RETURNS THE HOST TO THE BTY ROOT.

    The host keeps `subPageId` until something changes it, so a finished training would otherwise
    be named forever — and the next return to the tab would put the learner back inside it. The
    local exit has already happened by the time this runs; this only asks Teams to forget the
    subpage, through the stable `pages.currentApp` navigation surface, and fails soft on a client
    that does not have it.

    The local request is dropped either way, so a stale occurrence cannot reopen the room behind
    the learner.
  */
  const onTrainingExit = useCallback(() => {
    setTrainingRequest(null);
    /*
      ★ THE QUERY MUST GO FIRST, AND UNCONDITIONALLY.

      The fallback target lives in this document's own URL. Left there, the very next focus would
      re-read it, produce a new occurrence and put the learner straight back into the training
      they just finished — the local exit would look broken. `history.replaceState` removes it
      without navigating, so the document stays `/teams` and no history entry is added.

      Only then is the Teams host asked to drop its subpage, which still fails soft.
    */
    clearTrainingQueryParam();
    void clearTeamsSubPage(BTY_TEAMS_PERSONAL_TAB_ENTITY_ID);
  }, []);

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
        <BtyDailyAppShell
          locale={phase.locale}
          /*
            THE AUTHORITY ON WHICH RUNTIME THIS IS. Stated here because this component is the one
            place that KNOWS — it completed the Teams bootstrap that produced the session below it.
            Nothing downstream has to detect anything.
          */
          runtime="teams"
          /*
            The training the invitation named, as an OCCURRENCE the shell can act on whenever one
            arrives — at mount for a cold open, and on resume for every tap after that. Null for an
            ordinary tab launch, which is every launch that did not come from an invitation.
          */
          trainingRequest={trainingRequest}
          onTrainingExit={onTrainingExit}
          /*
            ★ CHANGING LANGUAGE IS A STATE CHANGE HERE, NOT A NAVIGATION.

            This component already owns the resolved locale — it picks it once at bootstrap from
            the saved cookie, falling back to the Teams context. Moving it forward re-renders the
            same shell in the new language: same document, same Teams host context, same session,
            same tab, same Today / Track / unread / dismissal state, because nothing unmounts.

            The alternative — letting the control navigate — is what put iOS's in-app browser in
            front of the Founder, since `/teams` opens anything leaving the frame in a real browser.
          */
          onLocaleChanged={(next) => setPhase({ k: "ready", locale: next })}
        />
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
