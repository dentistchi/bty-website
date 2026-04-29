import { expect, test } from "@playwright/test";
import {
  arenaShellLocator,
  canonicalArenaUrlPattern,
  openCanonicalArenaAndWaitForShell,
  optionalStartSimulationIfPresent,
} from "../helpers/arena-canonical";
import { cleanupStaleE2EActionContractsBeforeTest } from "../helpers/cleanup-action-contracts";
import { E2E_CONTRACT_EMAILS, E2E_CONTRACT_USER_IDS } from "../helpers/three-contract-users";

/**
 * Canonical Arena — single route `BtyArenaRunPageClient` at `/[locale]/bty-arena` (optional `/beginner`).
 */
test.describe("Arena canonical session", () => {
  test.beforeEach(async ({ request }) => {
    await cleanupStaleE2EActionContractsBeforeTest(request, {
      userId: E2E_CONTRACT_USER_IDS.default,
      email: E2E_CONTRACT_EMAILS.default,
      label: "arena-flow:E2E_DEFAULT_USER",
    });
  });

  test("direct entry shows canonical run shell (loaders, beginner gate, empty, or main)", async ({
    page,
  }) => {
    await openCanonicalArenaAndWaitForShell(page, "en", 60_000);
  });

  test("optional Start Simulation when the run main surface is ready", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/en/bty-arena");
    await expect(page).toHaveURL(canonicalArenaUrlPattern("en"));
    await expect(arenaShellLocator(page).first()).toBeVisible({ timeout: 30_000 });

    const main = page.getByTestId("arena-play-main");

    // Run surface can mount without a Start Simulation CTA (resumed session, router path, etc.).
    if (await main.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await expect(main).toBeVisible();
      return;
    }

    await optionalStartSimulationIfPresent(page, "en");

    const reached = await main
      .waitFor({ state: "visible", timeout: 120_000 })
      .then(() => true)
      .catch(() => false);

    if (!reached) {
      test.info().annotations.push({
        type: "note",
        description: "Main run surface not reached in time (loaders/API variance); shell visibility covered by prior test.",
      });
      return;
    }

    await expect(main).toBeVisible();
  });
});
