"use client";

import { escapesTeamsFrame, isTeamsTabPath } from "@/domain/teams/tabRuntime";

/**
 * Navigate to a BTY route, unless doing so would blank the Teams tab. Slice A0.
 *
 * WHY THIS EXISTS AS A HELPER RATHER THAN A GUARD. The click guard in `teamsTabTransport` catches
 * anchors, because an anchor's destination is in the DOM where a capture-phase listener can read
 * it. A programmatic `router.push` is invisible to that guard — there is no event and no href —
 * so the one shell surface that navigates programmatically calls this instead.
 *
 * The behaviour outside Teams is IDENTICAL to calling `push` directly. Inside `/teams`, a
 * destination outside `/teams/*` is opened in a real browser rather than pushed into the frame:
 * every other BTY route is served `X-Frame-Options: DENY`, so pushing it does not go somewhere
 * else — it blanks the tab silently, with nothing to go back to.
 */
export function navigateWithinFrame(push: (href: string) => void, href: string): void {
  if (typeof window === "undefined") {
    push(href);
    return;
  }
  const inTeamsTab = isTeamsTabPath(window.location.pathname);
  if (!inTeamsTab || !escapesTeamsFrame(href, window.location.origin)) {
    push(href);
    return;
  }
  void (async () => {
    const absolute = new URL(href, window.location.origin).toString();
    try {
      const { app } = await import("@microsoft/teams-js");
      await app.openLink(absolute);
    } catch {
      window.open(absolute, "_blank", "noopener,noreferrer");
    }
  })();
}
