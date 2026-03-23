import type { Page } from "@playwright/test";

/** Canonical live Arena: `/[locale]/bty-arena` or beginner gate `/[locale]/bty-arena/beginner`. */
export function canonicalArenaUrlPattern(locale: string): RegExp {
  const loc = locale === "ko" ? "ko" : "en";
  return new RegExp(`/${loc}/bty-arena(/beginner)?$`);
}

/** One of the canonical shell states rendered by `BtyArenaRunPageClient`. */
export function arenaShellLocator(page: Page) {
  return page.locator(
    '[data-testid="arena-play-main"], [data-testid="arena-play-loading"], [data-testid="arena-play-loading-scenario"], [data-testid="arena-play-gate-beginner"], [data-testid="arena-play-empty-scenario"]',
  );
}
