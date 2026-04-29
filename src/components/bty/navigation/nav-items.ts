export type BtyNavKey = "arena" | "growth" | "my-page";

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
 * @param arenaHrefOverride — from GET session-router snapshot (see {@link useArenaEntryResolution}); defaults to `/[locale]/bty-arena`.
 */
export function getBtyNavItems(
  locale: string,
  labels: Record<BtyNavKey, string>,
  arenaHrefOverride?: string,
): BtyNavItem[] {
  const base = `/${locale}`;
  return [
    { key: "arena", label: labels.arena, href: arenaHrefOverride ?? `${base}/bty-arena` },
    { key: "growth", label: labels.growth, href: `${base}/growth` },
    { key: "my-page", label: labels["my-page"], href: `${base}/my-page` },
  ];
}

/**
 * Bottom tabs: which item is “current”. Uses snapshot-driven `arenaEntryHref` so the Arena tab can match `/center`
 * (forced reset) or `/my-page` (action contract) without implying `/bty-arena` play when the user is elsewhere.
 * Fallback `/bty-arena` prefix keeps legacy paths aligned when href is the Arena shell.
 */
export function getActiveBtyNav(pathname: string, locale: string, arenaEntryHref: string): BtyNavKey {
  const p = pathname || "";
  if (p.includes("/my-page")) return "my-page";
  if (
    p.includes("/growth") ||
    /\/bty\/(dojo|integrity|mentor)(\/|$|\?)/.test(p)
  ) {
    return "growth";
  }
  if (pathnameMatchesArenaEntryHref(p, arenaEntryHref)) return "arena";
  if (p.includes("/bty-arena")) return "arena";
  return "arena";
}
