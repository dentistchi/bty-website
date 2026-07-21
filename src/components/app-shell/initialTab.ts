import type { AppTabKey } from "@/components/app-shell/AppTabBar";

/** The five known installed-app tabs — the ONLY values `?tab=` may select. */
const KNOWN_TABS: readonly AppTabKey[] = ["today", "center", "arena", "foundry", "me"];

/**
 * Resolve a requested initial tab from a URL query string (e.g. after an account switch
 * returns to `/app?tab=foundry`). Returns a known tab, or null when absent/unknown so the
 * shell keeps its default ("today"). Pure + sanitizing — an unrecognized value never alters
 * shell state, and there is no navigation here (the caller consumes the param once).
 */
export function resolveInitialAppTab(search: string): AppTabKey | null {
  let requested: string | null = null;
  try {
    requested = new URLSearchParams(search).get("tab");
  } catch {
    return null;
  }
  if (requested && (KNOWN_TABS as readonly string[]).includes(requested)) {
    return requested as AppTabKey;
  }
  return null;
}
