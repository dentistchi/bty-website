"use client";

import { TRAINING_QUERY_PARAM } from "@/domain/teams/trainingTarget";

/**
 * Teams personal-tab NAVIGATION helpers. BROWSER ONLY. Slice Teams iOS Deep-Link Resume.
 *
 * Two jobs, both about the HOST's navigation state rather than about identity:
 *
 *   readTeamsSubPageId()    re-read the tab's current subpage WITHOUT bootstrapping anything.
 *   clearTeamsSubPage()     return the host to the ordinary BTY root when a training is exited.
 *
 * NEITHER TOUCHES AUTH. `app.getContext()` is navigation state; the Supabase session is already
 * established and is not re-derived, re-fetched or re-verified here, and no context user property
 * is ever read as identity. Identity remains Teams token → verified tid + oid → canonical user.
 */

/**
 * The tab's current subpage, or null.
 *
 * `app.initialize()` is idempotent and already resolved by the time this runs, so calling it again
 * costs nothing and makes this safe to call from a listener that may fire before React has settled.
 * Deliberately NO `/api/auth/teams-bootstrap` call: refreshing navigation must not spend the
 * `/auth/v1/verify` budget (360/hour per IP, shared by the whole organisation through one Worker).
 */
export async function readTeamsSubPageId(): Promise<unknown> {
  try {
    const { app } = await import("@microsoft/teams-js");
    await app.initialize();
    const ctx = await app.getContext();
    const page = ctx?.page as { subPageId?: unknown; subEntityId?: unknown } | undefined;
    // `subEntityId` is the pre-v2 spelling; older clients still populate it.
    return page?.subPageId ?? page?.subEntityId ?? null;
  } catch {
    // A context that cannot be read is not an error state for the tab — it simply names no training.
    return null;
  }
}

/** This document's current query string, or "" when there is no document. */
export function currentSearch(): string {
  if (typeof window === "undefined") return "";
  return window.location.search ?? "";
}

/**
 * Remove `?training=…` from this document's URL WITHOUT navigating.
 *
 * The web-url fallback delivers the training in the tab's own address, so after the learner
 * leaves a training the address still names it — and the next focus would re-read it and reopen
 * the room behind them. `history.replaceState` drops the parameter in place: the document stays
 * `/teams`, no navigation happens, no history entry is added, and every other parameter (a
 * `?diag=1`, for instance) is preserved.
 *
 * Returns true when the URL changed. Never throws: a host that forbids history manipulation must
 * not be able to fail the learner's exit.
 */
export function clearTrainingQueryParam(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(TRAINING_QUERY_PARAM)) return false;
    url.searchParams.delete(TRAINING_QUERY_PARAM);
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next);
    return true;
  } catch {
    return false;
  }
}

export type SubPageClearOutcome = "cleared" | "unsupported" | "failed";

/**
 * Return the Teams host to the BTY root page, so the tab stops permanently naming a training.
 *
 * WHY THIS MATTERS BEYOND TIDINESS. The host keeps `subPageId` until something changes it. Left
 * set, every later return to the tab still reports the finished training — so the learner who
 * pressed "Back to Learn" and came back from another app would be put back inside it.
 *
 * STABLE APIS ONLY. `pages.currentApp.navigateTo({ pageId })` and `navigateToDefaultPage()` are the
 * documented, generally-available navigation surface; no beta lifecycle API is depended on. The
 * capability is CHECKED rather than assumed, and an older client that lacks it FAILS SOFT — the
 * local exit has already happened and the learner is back on Learn either way.
 */
export async function clearTeamsSubPage(pageId: string): Promise<SubPageClearOutcome> {
  try {
    const { pages } = await import("@microsoft/teams-js");
    const currentApp = pages?.currentApp;
    if (!currentApp || typeof currentApp.isSupported !== "function" || !currentApp.isSupported()) {
      return "unsupported";
    }
    /*
      `navigateTo` with our own page id is the precise expression of "this tab, its root page, no
      subpage". `navigateToDefaultPage` is the same idea without naming the page, and is used only
      if the precise call is unavailable on this client.
    */
    if (typeof currentApp.navigateTo === "function") {
      await currentApp.navigateTo({ pageId });
      return "cleared";
    }
    if (typeof currentApp.navigateToDefaultPage === "function") {
      await currentApp.navigateToDefaultPage();
      return "cleared";
    }
    return "unsupported";
  } catch {
    // The host refused. The learner is already out of the room; nothing here is worth failing for.
    return "failed";
  }
}
