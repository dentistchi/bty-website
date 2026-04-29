import { expect, type Page } from "@playwright/test";

/**
 * Canonical Arena runtime entry only:
 * `/[locale]/bty-arena` or `/[locale]/bty-arena/beginner`.
 * Legacy `/run`, `/play`, `/result` are never final destinations.
 */
export function canonicalArenaUrlPattern(locale: string): RegExp {
  const loc = locale === "ko" ? "ko" : "en";
  return new RegExp(`/${loc}/bty-arena(/beginner)?$`);
}

/** Run/session UI from `BtyArenaRunPageClient` (not hub, not mission lobby). */
export function arenaShellLocator(page: Page) {
  return page.locator(
    '[data-testid="arena-play-main"], [data-testid="arena-play-loading"], [data-testid="arena-play-loading-scenario"], [data-testid="arena-play-gate-beginner"], [data-testid="arena-play-empty-scenario"]',
  );
}

/** Hub summary card must not appear on the live Arena runtime surface. */
export async function expectNoArenaHubSummaryOnRuntime(page: Page) {
  await expect(page.getByTestId("arena-hub-summary")).toHaveCount(0);
}

/** Primary `<main>` for the canonical run page (stable `aria-label` from i18n). */
export function arenaRuntimeMainLocator(page: Page) {
  return page.getByRole("main", { name: /Arena mission run|Arena 런/i });
}

/**
 * Open `/[locale]/bty-arena`, assert canonical URL, no hub summary, wait for run shell.
 */
export async function openCanonicalArenaAndWaitForShell(
  page: Page,
  locale: "en" | "ko" = "en",
  shellTimeoutMs = 90_000,
) {
  await page.goto(`/${locale}/bty-arena`);
  await expect(page).toHaveURL(canonicalArenaUrlPattern(locale));
  await expectNoArenaHubSummaryOnRuntime(page);
  await expect(arenaShellLocator(page).first()).toBeVisible({ timeout: shellTimeoutMs });
}

/**
 * Optional: when the run UI shows step-1 Start, click it (handles some beginner / entry paths).
 * Does not fail if the button is absent.
 */
export async function optionalStartSimulationIfPresent(page: Page, locale: "en" | "ko" = "en") {
  const btn = page.getByRole("button", { name: /Start Simulation|시뮬레이션 시작/i });
  if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await btn.click().catch(() => {});
    await expect(page).toHaveURL(canonicalArenaUrlPattern(locale), { timeout: 30_000 }).catch(() => {});
  }
}
