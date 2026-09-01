"use client";

/**
 * Teams tab API transport + frame containment. Slice A0. BROWSER ONLY.
 *
 * WHY A TRANSPORT AND NOT 190 EDITS. The BTY shell makes its authenticated reads through ~190
 * plain `fetch(..., { credentials: "include" })` call sites and there is no central fetch helper.
 * In a Teams tab those cookies never travel, so every one of them needs an `Authorization` header
 * instead. Editing 190 call sites to thread a token would be a large, risky diff whose only
 * purpose is to say the same thing 190 times — and it would leave the web and native paths in the
 * blast radius. One wrapper, installed only by `/teams`, says it once and touches nothing else.
 *
 * WHAT IT WILL NOT DO. The token is a real Supabase access token, so it is attached ONLY to
 * same-origin `/api/*` requests (`shouldAttachBearer`). Never to a CDN, an image, a Microsoft
 * endpoint, an "Open in Teams" link, or any third party. An existing `Authorization` header is
 * never overwritten.
 *
 * THE TOKEN IS READ THROUGH A GETTER, not captured. Supabase rotates the access token on refresh,
 * and a wrapper that closed over the first one would keep sending a stale credential until the
 * tab was reloaded.
 *
 * FRAME CONTAINMENT. Every BTY route outside `/teams` is served `X-Frame-Options: DENY`, so an
 * ordinary in-frame link to one of them does not navigate — it blanks the tab, silently. The
 * capture-phase click guard sends those out to a real browser instead, which is what the person
 * wanted anyway. It is installed with the transport because they are the same concern: this
 * document is framed, and framed documents have different rules.
 */

import { escapesTeamsFrame, shouldAttachBearer } from "@/domain/teams/tabRuntime";

type Uninstall = () => void;

/** Wrap `window.fetch` so same-origin BTY API calls carry the current Supabase access token. */
export function installTeamsApiTransport(getAccessToken: () => string | null): Uninstall {
  if (typeof window === "undefined") return () => {};
  // The ORIGINAL reference is kept, not a bound copy, so uninstall restores exactly what was here.
  // `this` is supplied at call time instead.
  const original = window.fetch;
  const origin = window.location.origin;
  const call = (input: RequestInfo | URL, init?: RequestInit) => original.call(window, input, init);

  const wrapped: typeof window.fetch = async (input, init) => {
    const raw =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;

    if (!shouldAttachBearer(raw, origin)) return call(input as RequestInfo | URL, init);

    const token = getAccessToken();
    if (!token) return call(input as RequestInfo | URL, init);

    // Merge rather than replace: a caller that set its own Authorization meant it.
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has("authorization")) headers.set("Authorization", `Bearer ${token}`);

    return call(input as RequestInfo | URL, { ...(init ?? {}), headers });
  };

  window.fetch = wrapped;
  return () => {
    if (window.fetch === wrapped) window.fetch = original;
  };
}

/**
 * Intercept clicks on links that would navigate the Teams frame off `/teams`, and open them
 * externally instead.
 *
 * Capture phase, so it runs before React's own handlers and before the browser's default. Modified
 * clicks (⌘/ctrl/shift/alt, middle button) are left alone — the person has already said "open this
 * somewhere else", and the browser does that better than we can.
 *
 * @param openExternally how to leave Teams; the caller supplies the Teams SDK's own opener so the
 * host decides whether that is a new browser tab or its in-app browser.
 */
export function installTeamsFrameContainment(openExternally: (url: string) => void): Uninstall {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};
  const origin = window.location.origin;

  const onClick = (ev: MouseEvent) => {
    if (ev.defaultPrevented) return;
    if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const el = (ev.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!el) return;
    if (el.target === "_blank") return; // already leaving, on purpose
    const href = el.getAttribute("href") ?? "";
    if (!escapesTeamsFrame(href, origin)) return;

    ev.preventDefault();
    ev.stopPropagation();
    try {
      openExternally(new URL(href, origin).toString());
    } catch {
      /* an unopenable link is a dead link, not a blank tab — which is the whole point */
    }
  };

  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
