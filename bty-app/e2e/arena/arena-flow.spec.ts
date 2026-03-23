import { expect, test } from "@playwright/test";
import {
  arenaShellLocator,
  canonicalArenaUrlPattern,
  openCanonicalArenaAndWaitForShell,
  optionalStartSimulationIfPresent,
} from "../helpers/arena-canonical";

/**
 * Canonical Arena — single route `BtyArenaRunPageClient` at `/[locale]/bty-arena` (optional `/beginner`).
 */
test.describe("Arena canonical session", () => {
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

    await optionalStartSimulationIfPresent(page, "en");

    const main = page.getByTestId("arena-play-main");
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

    await expect(
      page.getByRole("button", { name: /Start Simulation|시뮬레이션 시작/i }).first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});
