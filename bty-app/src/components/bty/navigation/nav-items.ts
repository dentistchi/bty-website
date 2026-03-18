export type BtyNavKey = "arena" | "growth" | "my-page";

export type BtyNavItem = {
  key: BtyNavKey;
  label: string;
  href: string;
};

export function getBtyNavItems(locale: string, labels: Record<BtyNavKey, string>): BtyNavItem[] {
  const base = `/${locale}`;
  return [
    { key: "arena", label: labels.arena, href: `${base}/bty-arena` },
    { key: "growth", label: labels.growth, href: `${base}/growth` },
    { key: "my-page", label: labels["my-page"], href: `${base}/my-page` },
  ];
}

/**
 * Arena: bty-arena*. Growth: /growth/* + Dojo/Integrity/Guidance 진입(bty 하위).
 * My Page: /my-page/*
 */
export function getActiveBtyNav(pathname: string): BtyNavKey {
  const p = pathname || "";
  if (p.includes("/my-page")) return "my-page";
  if (
    p.includes("/growth") ||
    /\/bty\/(dojo|integrity|mentor)(\/|$|\?)/.test(p)
  ) {
    return "growth";
  }
  if (p.includes("/bty-arena")) return "arena";
  return "arena";
}
