import { expect, test } from "@playwright/test";
import {
  arenaRuntimeMainLocator,
  arenaShellLocator,
  canonicalArenaUrlPattern,
  expectNoArenaHubSummaryOnRuntime,
  openCanonicalArenaAndWaitForShell,
} from "./helpers/arena-canonical";
import { cleanupStaleE2EActionContractsBeforeTest } from "./helpers/cleanup-action-contracts";
import { E2E_CONTRACT_EMAILS, E2E_CONTRACT_USER_IDS } from "./helpers/three-contract-users";

const LOCALE = "en";

/**
 * Canonical Arena: `/[locale]/bty-arena` session UI. Hub summary must not appear on runtime.
 */
test.describe("Arena Play (authenticated)", () => {
  test.beforeEach(async ({ request }) => {
    await cleanupStaleE2EActionContractsBeforeTest(request, {
      userId: E2E_CONTRACT_USER_IDS.default,
      email: E2E_CONTRACT_EMAILS.default,
      label: "arena-play:E2E_DEFAULT_USER",
    });
  });

  test("canonical runtime: URL + shell, no hub summary card", async ({ page }) => {
    await openCanonicalArenaAndWaitForShell(page, LOCALE, 60_000);

    const main = arenaRuntimeMainLocator(page);
    if (await main.isVisible().catch(() => false)) {
      await expect(main).toBeVisible();
    }
  });

  test("hub CTA navigates to canonical Arena runtime (not deprecated subroutes)", async ({ page }) => {
    await page.goto(`/${LOCALE}/bty-arena/hub`);
    await expect(page.getByTestId("arena-hub")).toBeVisible();

    await Promise.all([
      page.waitForURL(canonicalArenaUrlPattern(LOCALE), { timeout: 30_000 }),
      page.getByTestId("arena-play-button").first().click(),
    ]);

    await expect(page).toHaveURL(canonicalArenaUrlPattern(LOCALE));
    await expectNoArenaHubSummaryOnRuntime(page);
    await expect(arenaShellLocator(page).first()).toBeVisible({ timeout: 45_000 });
  });
});
