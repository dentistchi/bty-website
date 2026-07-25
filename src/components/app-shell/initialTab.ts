import type { AppTabKey } from "@/components/app-shell/AppTabBar";

/** The four visible installed-app tabs — the canonical values `?tab=` may select. */
const KNOWN_TABS: readonly AppTabKey[] = ["today", "learn", "practice", "me"];

/**
 * Backward-compatible aliases (App Shell + Today Simplification V1). Every previously-shipped
 * deep link — account-switch returns, Host attention links, Today follow-up/practice reminders —
 * still emits the OLD five-domain tab values (`foundry`/`arena`/`center`). Those canonical links
 * are intentionally left untouched (translate at the navigation layer), so they resolve here to
 * the new visible tab: Foundry → Learn, Arena → Practice, Center → Me (Recovery/Center lives in Me).
 */
const LEGACY_TAB_ALIAS: Record<string, AppTabKey> = {
  foundry: "learn",
  arena: "practice",
  center: "me",
};

/**
 * Resolve a requested initial tab from a URL query string (e.g. after an account switch returns to
 * `/app?tab=learn`, or a legacy `/app?tab=foundry`). Returns a known tab, or null when absent/unknown
 * so the shell keeps its default ("today"). Pure + sanitizing — an unrecognized value never alters
 * shell state, and there is no navigation here (the caller consumes the param once).
 */
export function resolveInitialAppTab(search: string): AppTabKey | null {
  let requested: string | null = null;
  try {
    requested = new URLSearchParams(search).get("tab");
  } catch {
    return null;
  }
  if (!requested) return null;
  if ((KNOWN_TABS as readonly string[]).includes(requested)) {
    return requested as AppTabKey;
  }
  return LEGACY_TAB_ALIAS[requested] ?? null;
}
