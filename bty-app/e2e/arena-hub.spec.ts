import { expect, test } from "@playwright/test";
import { canonicalArenaUrlPattern } from "./helpers/arena-canonical";

/** Arena hub — testid-first (less sensitive to copy/i18n tweaks). */
test.describe("Arena Hub (authenticated)", () => {
  test("hub entry, summary values, Play → canonical /bty-arena", async ({ page }) => {
    await page.goto("/en/bty-arena/hub");
    await expect(page).not.toHaveURL(/login/);

    await expect(page.getByTestId("arena-hub")).toBeVisible();
    const card = page.getByTestId("arena-hub-card");
    await expect(card).toBeVisible();
    await expect(card).toContainText(/Continue your Arena\.|System ready/);

    await expect(page.getByTestId("arena-play-button").first()).toBeVisible();

    const summary = page.getByTestId("arena-hub-summary");
    await expect(summary).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("arena-weekly-rank")).toBeVisible();
    await expect(page.getByTestId("arena-season-ends")).toBeVisible();

    await Promise.all([
      page.waitForURL(canonicalArenaUrlPattern("en"), { timeout: 30_000 }),
      page.getByTestId("arena-play-button").first().click(),
    ]);
  });
});
