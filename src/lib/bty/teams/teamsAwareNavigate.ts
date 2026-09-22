"use client";

import { isTeamsTabPath } from "@/domain/teams/tabRuntime";
import {
  BTY_SHELL_DESTINATION_EVENT,
  classifyBtyHref,
  leavesTeamsDocument,
  shellSearchFor,
} from "@/domain/teams/btyDestination";

/**
 * Navigate to a BTY route from code, staying inside BTY wherever BTY can render it. Slice A0,
 * re-audited by Slice No-Browser-Escape V1.
 *
 * WHY THIS EXISTS AS A HELPER RATHER THAN A GUARD. The click guard in `teamsTabTransport` catches
 * anchors, because an anchor's destination is in the DOM where a capture-phase listener can read
 * it. A programmatic `router.push` is invisible to that guard — there is no event and no href —
 * so shell surfaces that navigate programmatically call this instead.
 *
 * ★ WHAT CHANGED. This previously handed every destination outside `/teams` to `app.openLink`,
 * which leaves the product. That is the same mistake the click guard made: it treats "the frame
 * cannot render this route" as "the person wanted a browser". Inside Teams a BTY destination is
 * now re-expressed as state in the shell that is already mounted, and only genuinely unrenderable
 * or third-party destinations are opened outside.
 *
 * Outside Teams the behaviour is IDENTICAL to calling `push` directly.
 */
export function navigateWithinFrame(push: (href: string) => void, href: string): void {
  if (typeof window === "undefined") {
    push(href);
    return;
  }
  const origin = window.location.origin;
  const inTeamsTab = isTeamsTabPath(window.location.pathname);
  if (!inTeamsTab || !leavesTeamsDocument(href, origin)) {
    push(href);
    return;
  }

  // Ours, and the shell can already render it: stay, exactly as the click guard does.
  if (classifyBtyHref(href, origin) === "shell") {
    const search = shellSearchFor(href, origin);
    if (search !== null) {
      try {
        window.history.replaceState({}, "", `${window.location.pathname}${search}`);
        window.dispatchEvent(new Event(BTY_SHELL_DESTINATION_EVENT));
        return;
      } catch {
        /* fall through to the opener rather than leaving the caller with nothing */
      }
    }
  }

  /*
    A frame-denied BTY page or third-party content. Pushing it would blank the tab silently, with
    nothing to go back to, so it is opened outside instead.
  */
  void (async () => {
    const absolute = new URL(href, origin).toString();
    try {
      const { app } = await import("@microsoft/teams-js");
      await app.openLink(absolute);
    } catch {
      window.open(absolute, "_blank", "noopener,noreferrer");
    }
  })();
}
