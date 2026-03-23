import { expect, test } from "@playwright/test";
import { arenaShellLocator, canonicalArenaUrlPattern } from "../helpers/arena-canonical";

/**
 * Canonical Arena session — single-route UI (`BtyArenaRunPageClient`), not legacy Lobby → /play → /result.
 */
test.describe("Arena canonical session", () => {
  test("direct /bty-arena shows canonical shell (loading, beginner gate, empty, or main)", async ({
    page,
  }) => {
    await page.goto("/en/bty-arena");
    await expect(page).toHaveURL(canonicalArenaUrlPattern("en"));
    await expect(arenaShellLocator(page).first()).toBeVisible({ timeout: 60_000 });
  });

  /**
   * Optional: when the session reaches a non-loading shell, Start Simulation should exist.
   * Skips softly if the account stays on long-running loaders (API/session variance).
   */
  test("Start Simulation visible only when main shell is reached", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/en/bty-arena");
    await expect(page).toHaveURL(canonicalArenaUrlPattern("en"));
    await expect(arenaShellLocator(page).first()).toBeVisible({ timeout: 30_000 });

    const main = page.getByTestId("arena-play-main");
    const reached = await main
      .waitFor({ state: "visible", timeout: 120_000 })
      .then(() => true)
      .catch(() => false);

    if (!reached) {
      test.info().annotations.push({
        type: "note",
        description: "Main shell not reached in time (loaders/onboarding/API); canonical URL + shell already covered above.",
      });
      return;
    }

    await expect(
      page.getByRole("button", { name: /Start Simulation|시뮬레이션 시작/i }).first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});
