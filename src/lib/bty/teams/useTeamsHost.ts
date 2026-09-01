"use client";

import { useEffect, useState } from "react";
import { isTeamsTabPath } from "@/domain/teams/tabRuntime";

/**
 * ARE WE RENDERING INSIDE THE TEAMS PERSONAL TAB? (Slice A0-RUNTIME2)
 *
 * ONE authority, reused — never re-derived per component. It asks the same predicate that already
 * decides which Supabase client this document gets (`src/lib/supabase.ts`), so the session model
 * and the UI can never disagree about which host they are in.
 *
 * Deliberately NOT inferred from the user agent, from `window.self !== window.top`, or from a
 * component guessing at the URL. The tab is served at `/teams` and stays there — that is the fact,
 * and everything else is a proxy for it.
 *
 * Starts false and resolves after mount, so the server-rendered markup and the first client render
 * agree. The consequence is honest: for one frame the tab renders the web treatment, which is the
 * safe direction — the Teams treatment only ever REMOVES controls.
 */
export function useTeamsHost(): boolean {
  const [inTeams, setInTeams] = useState(false);
  useEffect(() => {
    setInTeams(isTeamsTabPath(window.location.pathname));
  }, []);
  return inTeams;
}
