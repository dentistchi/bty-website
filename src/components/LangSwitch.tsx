"use client";

import { useCallback, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * EN/KO 토글: pathname prefix만 /en <-> /ko 로 바꾸고 query 유지
 *
 * `ensureParams` (Slice R4-R1B) — query keys the CALLER guarantees must be on the target URL,
 * merged over whatever is already there.
 *
 * It exists because the app shell deliberately SCRUBS `?tab=` from the URL on mount ("so a
 * re-render / back never re-triggers them and no navigation loop forms"), so by the time someone
 * is standing on Me the address is a bare `/{locale}/app`. Preserving that query faithfully —
 * which is all this component ever did — would land them on Today in the other language.
 *
 * This is NOT a second language state. Locale still lives in exactly one place, the path prefix,
 * and this component is still the only thing that changes it. The caller is only saying where it
 * is, which the URL no longer says on its behalf. Default is empty, so every existing call site
 * behaves exactly as before.
 *
 * R4-R4B-R1N-R1(-R1) — IT NOW ALSO REMEMBERS, AND THE SERVER DOES THE REMEMBERING.
 *
 * The path prefix held the choice perfectly while a tab was alive and lost it the moment the
 * WebView was destroyed: the native shell relaunches at the locale-neutral `/start`, so a person
 * who chose Korean reopened the app in English.
 *
 * The first fix wrote `NEXT_LOCALE` here with `document.cookie` before navigating. It passed every
 * test and failed on device, for a reason this repository had already measured twice: a JS-store
 * cookie write is not the reliable direction for the hosted WKWebView, and WebKit flushes that
 * store to disk asynchronously — so a write racing a document teardown, followed by a deliberate
 * hard kill, can simply vanish.
 *
 * So the links now point at `/api/locale/set`, which sets the cookie and redirects in ONE response.
 * There is no pre-navigation JS step left to lose. Locale is still the path prefix, and the
 * preference is still written ONLY by an explicit click here — never inferred from visiting `/ko`.
 *
 * ★ HOST ROUTES ARE NOT LOCALE-PREFIXED, AND PREFIXING ONE SENT A SIGNED-IN PERSON TO LOGIN.
 *
 * MEASURED on the Founder's iPhone and reproduced against the live origin. Inside the Teams
 * Personal Tab the pathname is `/teams`, which carries no locale segment because the route is
 * `src/app/teams/` — top level, deliberately outside `[locale]`. This component's prefix rule
 * therefore built `/ko/teams`, and the live chain is:
 *
 *     /api/locale/set?to=ko&next=/ko/teams?tab=me   303 ->  /ko/teams?tab=me
 *     /ko/teams                                     307 ->  /ko/bty/login?next=/ko/teams
 *
 * There is no `app/[locale]/teams` route, so middleware treated it as an unauthenticated protected
 * path. A person changed their language and was handed a login screen wearing the retired five-tab
 * navigation, because `[locale]/bty/layout.tsx` wraps every `/bty/*` route — login included — in
 * `ArenaLayoutShell`.
 *
 * Changing language is presentation, not entry. So a host route keeps its own path and the
 * preference cookie carries the choice: `/teams` stays `/teams`, the Teams shell re-reads
 * `NEXT_LOCALE` through `readSavedLocale()` (which it ALREADY consults, ahead of the Teams context
 * locale), and the person stays signed in, inside Teams, on the canonical four-tab shell.
 *
 * The single writer is unchanged. This does NOT introduce a second locale mechanism — it stops
 * building an address that never existed.
 *
 * ★ AND INSIDE TEAMS THE CONTROL IS A COMMAND, BECAUSE A LINK CANNOT STAY IN THE FRAME.
 *
 * Sending Teams to the right URL was still the wrong fix. MEASURED on the Founder's iPhone: the
 * language control opened iOS's in-app browser, BTY loaded at `arena.btydaily.com` with no Teams
 * host context, and the tab said "BTY couldn't open yet."
 *
 * The destination was never consulted. `/teams` installs a CAPTURE-PHASE document click guard
 * (`installTeamsFrameContainment`) that reads the anchor's OWN href and opens anything leaving
 * `/teams` in a real browser — correctly, because every other BTY route is served
 * `X-Frame-Options: DENY` and would blank the tab instead. Our href is `/api/locale/set`, whose
 * pathname is not `/teams`, so `escapesTeamsFrame` said true and the guard did exactly its job.
 *
 * `preventDefault` in an onClick handler cannot help: the guard runs in the CAPTURE phase on
 * `document`, before React's bubble-phase handler exists to prevent anything.
 *
 * So when a caller passes `onLocaleChanged`, this renders a BUTTON, not a link. There is no href
 * for the guard to find (`closest("a[href]")` matches nothing), the writer is called with `fetch`,
 * and the host tells its own shell to re-render in the new language. Nothing navigates, so nothing
 * can escape — the containment is not bypassed, it is never reached.
 *
 * Same cookie, same route, same single writer. Only the response shape and the transport differ.
 */

/**
 * Paths that live OUTSIDE `[locale]` and must never be given a locale prefix.
 *
 * Matched on the FIRST SEGMENT only, so `/teams` and `/teams/anything` are both host routes while
 * a future `/teamsomething` is not. Kept deliberately small: this is not a routing table, it is the
 * short list of surfaces whose own path is the host and cannot be moved under a language.
 */
const HOST_ROUTE_SEGMENTS = new Set(["teams", "start"]);

function firstSegment(pathname: string): string {
  return pathname.replace(/^\/+/, "").split("/")[0] ?? "";
}
/** Told to the person in the language they are currently reading, not the one that failed. */
const FAILED_COPY = {
  en: "Language couldn't be changed.",
  ko: "\uc5b8\uc5b4\ub97c \ubc14\uafb8\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.",
} as const;

export function LangSwitch({
  ensureParams,
  current,
  onLocaleChanged,
}: {
  ensureParams?: Record<string, string>;
  /** The resolved locale, for surfaces whose path does not carry one (the Teams tab). */
  current?: "en" | "ko";
  /**
   * Present ⇒ COMMAND MODE. The host owns the resolved locale and will re-render in place; this
   * control writes the preference and reports the new choice instead of navigating anywhere.
   * Absent ⇒ the unchanged link behaviour every other surface uses.
   */
  onLocaleChanged?: (locale: "en" | "ko") => void;
} = {}) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  // `useSearchParams()` is nullable in the App Router (and null in several shell test harnesses).
  // The previous direct `.toString()` was only ever safe because nothing mounted this inside the
  // app shell; Me does now, so the absence of a query is treated as an empty one.
  const merged = new URLSearchParams(searchParams?.toString() ?? "");
  for (const [k, v] of Object.entries(ensureParams ?? {})) merged.set(k, v);
  const query = merged.toString();
  const q = query ? `?${query}` : "";

  const isEn = pathname.startsWith("/en");
  const isKo = pathname.startsWith("/ko");
  const rest = isEn ? pathname.slice(3) || "/" : isKo ? pathname.slice(3) || "/" : pathname || "/";

  /*
    ★ A HOST ROUTE KEEPS ITS OWN PATH. Only the cookie changes, and the surface re-reads it.
    Prefixing `/teams` produced `/ko/teams`, which does not exist and redirects to login.
  */
  const onHostRoute = !isEn && !isKo && HOST_ROUTE_SEGMENTS.has(firstSegment(pathname));
  const here = `${pathname || "/"}${q}`;
  const toEn = onHostRoute ? here : `/en${rest}${q}`;
  const toKo = onHostRoute ? here : `/ko${rest}${q}`;

  /** The one place a language choice becomes durable: server writes, server redirects. */
  const prefHref = (locale: "en" | "ko", to: string) =>
    `/api/locale/set?to=${locale}&next=${encodeURIComponent(to)}`;

  /*
    On a host route the path cannot say which language is active, so the active mark is driven by
    the caller (the Teams shell knows its own resolved locale). Without this both links would render
    unselected, which reads as "neither" rather than "this one".
  */
  const activeEn = onHostRoute ? current === "en" : isEn;
  const activeKo = onHostRoute ? current === "ko" : isKo;

  const commandMode = typeof onLocaleChanged === "function";
  const [busy, setBusy] = useState<"en" | "ko" | null>(null);
  const [failed, setFailed] = useState(false);

  /*
    COMMAND MODE ONLY. Write the preference, then tell the host — which re-renders the shell it
    already owns. Deliberately no navigation of any kind: no href, no `window.location`, no
    `router.push`, no `window.open`, no `app.openLink`. The document that was standing on `/teams`
    when this was tapped is the same document afterwards.
  */
  const commit = useCallback(
    async (locale: "en" | "ko") => {
      if (busy) return; // a second tap mid-flight would race two writes for one preference
      setBusy(locale);
      setFailed(false);
      try {
        /*
          `mode=json` so the canonical writer answers instead of redirecting. No `next`: we are not
          going anywhere, and asking for a destination we will never follow would only invite one.
          `credentials: "include"` because the cookie is the whole point of the request.
        */
        const res = await fetch(`/api/locale/set?to=${locale}&mode=json`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`locale_write_${res.status}`);
        onLocaleChanged?.(locale);
      } catch {
        /*
          ★ A FAILED WRITE STAYS PUT. No login, no browser, no navigation, no modal — the person is
          on the screen they were on, in the language they were already reading, and the same
          control is the retry.
        */
        setFailed(true);
      } finally {
        setBusy(null);
      }
    },
    [busy, onLocaleChanged],
  );

  const cls = (active: boolean) =>
    `px-2 py-1 rounded ${active ? "font-medium underline bg-black/5" : "text-gray-500 hover:text-gray-800"}`;

  /*
    ★ A BUTTON, NOT A LINK — and that is the entire containment.

    The Teams frame guard finds its target with `closest("a[href]")`. A button matches nothing, so
    the guard never runs and there is no href for it to judge. It is not disabled or worked around;
    this control simply stops being the kind of thing it looks at.
  */
  if (commandMode) {
    return (
      <div className="flex flex-col items-end gap-0.5 text-sm">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void commit("en")}
            disabled={busy !== null}
            aria-pressed={activeEn}
            data-testid="lang-switch-en"
            className={cls(activeEn)}
          >
            EN
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={() => void commit("ko")}
            disabled={busy !== null}
            aria-pressed={activeKo}
            data-testid="lang-switch-ko"
            className={cls(activeKo)}
          >
            KO
          </button>
        </div>
        {failed ? (
          <p role="status" data-testid="lang-switch-error" className="text-[11px] text-gray-500">
            {FAILED_COPY[current === "ko" ? "ko" : "en"]}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      {/*
        The visible control is unchanged — still EN | KO, still two links. Only the target moved:
        each now goes through the route that writes the preference and redirects to the same place
        the link used to point at directly.
      */}
      <a href={prefHref("en", toEn)} data-testid="lang-switch-en" className={cls(activeEn)}>
        EN
      </a>
      <span className="text-gray-300">|</span>
      <a href={prefHref("ko", toKo)} data-testid="lang-switch-ko" className={cls(activeKo)}>
        KO
      </a>
    </div>
  );
}
