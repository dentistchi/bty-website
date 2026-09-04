"use client";

import { planOpenSourceLink } from "@/domain/teams/openSourceLink";

/**
 * Open a saved item's source, in whichever host BTY is running in. CLIENT ONLY.
 *
 * ★ ONE OPENER, TWO HOSTS. Inside the Teams Personal Tab a cross-origin navigation must go through
 * TeamsJS or the tab is simply bounced back to its own `contentUrl` (see `planOpenSourceLink` for
 * the measured failure). Everywhere else — standalone web, the native hosted-URL shell — TeamsJS is
 * neither present nor needed, and a direct navigation is correct. Requiring TeamsJS outside Teams
 * would break the surface that currently works.
 *
 * Returns whether the open was ACCEPTED. A false answer is what lets the row stay where it is and
 * say so, instead of the person being thrown out to a bootstrap error screen.
 */

/**
 * Are we inside the Teams-hosted tab?
 *
 * Two independent signals, OR'd, because either alone has a hole: the tab's `contentUrl` is
 * `/teams` (so the path is authoritative when it is there), and a Teams host embeds the app
 * (so a framed document is a strong hint even if the path were ever rewritten). Deliberately NOT
 * a TeamsJS call: `app.initialize()` is async and can hang outside Teams, and a host check that
 * can hang is a button that does nothing.
 */
export function isTeamsHosted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.location.pathname.startsWith("/teams")) return true;
    return window.self !== window.top;
  } catch {
    // A cross-origin frame access throw means we ARE framed.
    return true;
  }
}

export async function openSourceLink(
  rawUrl: string | null | undefined,
  deps?: {
    teamsHosted?: boolean;
    openInTeams?: (url: string) => Promise<void>;
    openInBrowser?: (url: string) => void;
  },
): Promise<boolean> {
  const plan = planOpenSourceLink(rawUrl, {
    teamsHosted: deps?.teamsHosted ?? isTeamsHosted(),
  });
  if (plan.mode === "refuse") return false;

  if (plan.mode === "browser") {
    const open =
      deps?.openInBrowser ??
      ((url: string) => {
        window.open(url, "_blank", "noopener,noreferrer");
      });
    try {
      open(plan.url);
      return true;
    } catch {
      return false;
    }
  }

  /*
    TEAMS HOST. `app.openLink` is the documented way to hand a deep link to the host, and the
    stored URL is passed through unchanged.

    NO `window.open` FALLBACK HERE, deliberately. That fallback is exactly what produced the defect
    — an off-domain `_blank` inside the tab is not a second chance, it is the failure. If the host
    refuses, the caller keeps the person on their saved item and offers to open it again.
  */
  try {
    const openIt =
      deps?.openInTeams ??
      (async (url: string) => {
        const { app } = await import("@microsoft/teams-js");
        await app.openLink(url);
      });
    await openIt(plan.url);
    return true;
  } catch {
    return false;
  }
}
