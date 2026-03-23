import { expect, test } from "@playwright/test";
import { arenaShellLocator, canonicalArenaUrlPattern } from "./helpers/arena-canonical";

const LOCALE = "en";

/**
 * Canonical Arena lives at `/[locale]/bty-arena` (live `useArenaSession` flow).
 * Hub summary card must not appear on the play shell.
 */
test.describe("Arena Play (authenticated)", () => {
  test("canonical route stays /bty-arena or /bty-arena/beginner; simulation shell without hub summary", async ({
    page,
  }) => {
    await page.goto(`/${LOCALE}/bty-arena`);
    await expect(page).toHaveURL(canonicalArenaUrlPattern(LOCALE));
    await expect(page.getByTestId("arena-hub-summary")).toHaveCount(0);

    const shell = arenaShellLocator(page);
    await expect(shell.first()).toBeVisible({ timeout: 60_000 });

    const main = page.getByRole("main", { name: /Arena mission run|Arena 런/i });
    if (await main.isVisible().catch(() => false)) {
      await expect(main).toBeVisible();
    }
  });

  test("hub Play button opens canonical Arena (same shell, not /run or /play)", async ({ page }) => {
    await page.goto(`/${LOCALE}/bty-arena/hub`);
    await expect(page.getByTestId("arena-hub")).toBeVisible();

    await Promise.all([
      page.waitForURL(canonicalArenaUrlPattern(LOCALE), { timeout: 30_000 }),
      page.getByTestId("arena-play-button").first().click(),
    ]);

    await expect(page).not.toHaveURL(/\/bty-arena\/(run|play)(\/|$)/);
    await expect(page.getByTestId("arena-hub-summary")).toHaveCount(0);
    await expect(arenaShellLocator(page).first()).toBeVisible({ timeout: 45_000 });
  });
});
