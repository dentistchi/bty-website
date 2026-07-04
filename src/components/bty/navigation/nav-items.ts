export type BtyNavKey = "home" | "arena" | "foundry" | "center" | "my-page";

export type BtyNavItem = {
  key: BtyNavKey;
  label: string;
  href: string;
};

/** True when `pathname` is the resolved Arena entry URL or a subpath (includes `/center` for forced reset, `/my-page` for action-contract gate — query stripped for match). */
export function pathnameMatchesArenaEntryHref(pathname: string, arenaEntryHref: string): boolean {
  const p = pathname || "";
  const h = (arenaEntryHref.split("?")[0] ?? arenaEntryHref).trim();
  if (!h) return false;
  return p === h || p.startsWith(`${h}/`);
}

/**
 * 5-tab order (relationship model): Home(Today) · Center(self) · Arena(others) · Foundry(world) · Profile(Me).
 * Self → others → world = Center → Arena → Foundry; Today first (the day's door), Me last (identity).
 * `home` → `/today` (Daily OS home surface); `foundry` → `/bty/foundry` (route-group
 * `(protected)` is not in the URL). `my-page` keeps its key; label renders as "Profile".
 *
 * @param arenaHrefOverride — from GET session-router snapshot (see {@link useArenaEntryResolution}); defaults to `/[locale]/bty-arena`.
 */
export function getBtyNavItems(
  locale: string,
  labels: Record<BtyNavKey, string>,
  arenaHrefOverride?: string,
): BtyNavItem[] {
  const base = `/${locale}`;
  return [
    { key: "home", label: labels.home, href: `${base}/today` },
    { key: "center", label: labels.center, href: `${base}/center` },
    { key: "arena", label: labels.arena, href: arenaHrefOverride ?? `${base}/bty-arena` },
    { key: "foundry", label: labels.foundry, href: `${base}/bty/foundry` },
    { key: "my-page", label: labels["my-page"], href: `${base}/my-page` },
  ];
}

/**
 * Bottom tabs: which item is “current”. Uses snapshot-driven `arenaEntryHref` so the Arena tab can match `/center`
 * (forced reset) or `/my-page` (action contract) without implying `/bty-arena` play when the user is elsewhere.
 * Fallback `/bty-arena` prefix keeps legacy paths aligned when href is the Arena shell.
 * `home` (`/today`) and `foundry` (`/foundry`) are matched before the Arena fallthrough; neither path
 * overlaps `/my-page`, `/center`, or `/bty-arena`, so ordering is collision-free.
 */
export function getActiveBtyNav(pathname: string, locale: string, arenaEntryHref: string): BtyNavKey {
  const p = pathname || "";
  if (p.includes("/my-page")) return "my-page";
  if (p.includes("/foundry")) return "foundry";
  if (p.includes("/today")) return "home";
  if (p.includes("/center") || p.includes("/assessment") || p.includes("/journal")) {
    return "center";
  }
  if (pathnameMatchesArenaEntryHref(p, arenaEntryHref)) return "arena";
  if (p.includes("/bty-arena")) return "arena";
  return "arena";
}
