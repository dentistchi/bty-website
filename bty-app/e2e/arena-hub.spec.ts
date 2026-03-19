import { expect, test } from "@playwright/test";

/** Arena 허브 — testid 우선 (카피/i18n 변경에 덜 민감). */
test.describe("Arena Hub (authenticated)", () => {
  test("hub entry, summary values, Play → /play", async ({ page }) => {
    await page.goto("/en/bty-arena");
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

    await page.getByTestId("arena-play-button").first().click();
    await expect(page).toHaveURL(/\/en\/bty-arena\/play/);
  });
});
