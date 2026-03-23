import { expect, test } from "@playwright/test";

/**
 * Arena Play — 실행 화면; 허브 전용 요약 카드(arena-hub-summary)는 플레이에 없어야 함.
 */
test.describe("Arena Play (authenticated)", () => {
  test("play route is separate from hub; simulation shell without hub summary card", async ({
    page,
  }) => {
    await page.goto("/en/bty-arena");
    await expect(page).toHaveURL(/\/en\/bty-arena\/run/);
    await expect(page.getByTestId("arena-hub-summary")).toHaveCount(0);

    const shell = page.locator(
      '[data-testid="arena-play-main"], [data-testid="arena-play-loading"], [data-testid="arena-play-gate-beginner"], [data-testid="arena-play-empty-scenario"]',
    );
    await expect(shell.first()).toBeVisible({ timeout: 45_000 });

    const main = page.getByRole("main", { name: /Arena scenario play/i });
    if (await main.isVisible().catch(() => false)) {
      await expect(main).toBeVisible();
      await expect(
        main.getByText(/Better Than Yesterday|One step today|시나리오|Scenario/i).first(),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test("hub → Play preserves route separation", async ({ page }) => {
    await page.goto("/en/bty-arena/hub");
    await page.getByTestId("arena-play-button").first().click();
    await expect(page).toHaveURL(/\/en\/bty-arena\/run/);
    await expect(page.getByTestId("arena-hub-summary")).toHaveCount(0);
  });
});
