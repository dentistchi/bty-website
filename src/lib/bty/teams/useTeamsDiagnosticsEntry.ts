"use client";

import { useEffect, useState } from "react";
import { useTeamsHost } from "@/lib/bty/teams/useTeamsHost";

/**
 * MAY THIS PERSON, IN THIS HOST, OPEN THE TEAMS DISPLAY DIAGNOSTIC? (Slice TQ-2)
 *
 * ★ WHY THE ENTRY MOVED INTO THE TAB.
 *
 * TQ-1 shipped the runtime probe behind `/teams?diag=1`, and the Founder opened exactly that URL
 * on his iPhone — in Safari. MEASURED, 2026-09-05: browser chrome visible, no Teams host, the
 * bootstrap failed, and the screen read "BTY couldn't open yet." / "Open BTY". Nothing was
 * measured, because `/teams` typed into a browser is not the Teams Personal Tab; it is the same
 * document with none of the host that the numbers are about. A URL cannot summon a host.
 *
 * The diagnostic therefore has to be entered from INSIDE a tab that has already bootstrapped —
 * which is the only place the runtime we are asking about actually exists.
 *
 * ★ BOTH CONDITIONS, AND WHY EACH IS SEPARATELY NECESSARY.
 *
 *   Teams-hosted   `useTeamsHost` — the ONE existing authority for "am I in the tab", reused, not
 *                  re-derived. Outside it the row would be an ordinary participant's Me tab
 *                  carrying a developer control, and it would measure the wrong runtime anyway.
 *   Platform admin  asked of the SERVER, which is the only holder of `bty_platform_admin_grants`.
 *
 * ★ THE FETCH DOES NOT HAPPEN AT ALL OUTSIDE TEAMS. Web and native pay nothing: no request, no
 * state change, no render difference. The effect returns before it asks.
 *
 * ★ FAILS CLOSED, AND STAYS QUIET. A non-200, a malformed body, a thrown fetch, an unmounted
 * component — every one of them leaves this false. It never throws, never retries, never blocks a
 * render, and never surfaces an error: a diagnostic entry that cannot establish its own authority
 * simply is not there.
 */
export function useTeamsDiagnosticsEntry(): boolean {
  const inTeams = useTeamsHost();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!inTeams) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/bty/authority/platform-admin", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json()) as { ok?: boolean; isPlatformAdmin?: boolean };
        if (cancelled) return;
        setIsAdmin(body?.ok === true && body?.isPlatformAdmin === true);
      } catch {
        /* an authority that could not be reached has not said yes */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inTeams]);

  return inTeams && isAdmin;
}
