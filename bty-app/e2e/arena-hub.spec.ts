import { expect, test } from "@playwright/test";

/**
 * Arena 허브 — 허브/플레이 분리, 주간·시즌 요약은 허브에만.
 * Continue 카피는 로컬 세션 이어하기 가능 시에만 노출 (그 외 System ready).
 */
test.describe("Arena Hub (authenticated)", () => {
  test("hub entry, hub-only summary, Play navigates to /play", async ({ page }) => {
    await page.goto("/en/bty-arena");
    await expect(page).not.toHaveURL(/login/);

    const card = page.getByTestId("arena-hub-card");
    await expect(card).toBeVisible();
    await expect(card).toContainText(/Continue your Arena\.|System ready/);

    await expect(page.getByRole("link", { name: /Play Game/i })).toBeVisible();

    const continueLink = page.getByRole("link", { name: /^Continue$/i });
    if (await continueLink.isVisible()) {
      await expect(card).toContainText(/Resume your last simulation|Continue your Arena/i);
    } else {
      await expect(card).toContainText(/Start a new scenario|System ready/i);
    }

    const summary = page.getByTestId("arena-hub-summary");
    await expect(summary).toBeVisible({ timeout: 20_000 });
    await expect(summary.getByText("Weekly rank", { exact: false })).toBeVisible();
    await expect(summary.getByText(/Season ends in/i)).toBeVisible();

    await page.getByRole("link", { name: /Play Game/i }).first().click();
    await expect(page).toHaveURL(/\/en\/bty-arena\/play/);
  });
});
