import { test, expect } from "@playwright/test";

const LOCALE = "en";

test.describe("BTY Arena flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${LOCALE}/bty-arena`);
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  test("lobby → play → result with primary A + reinforce X", async ({ page }) => {
    await page.goto(`/${LOCALE}/bty-arena`);

    await expect(page.getByTestId("arena-enter")).toBeVisible();
    await page.getByTestId("arena-enter").click();

    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/bty-arena/play`));

    await expect(page.getByTestId("arena-system-log")).toBeVisible();
    await page.getByTestId("primary-A").click();
    await expect(page.getByTestId("reinforce-X")).toBeVisible();
    await page.getByTestId("reinforce-X").click();

    await expect(page.getByTestId("resolve-decision")).toBeVisible();
    await page.getByTestId("resolve-decision").click();

    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/bty-arena/result`));
    await expect(page.getByTestId("resolve-interpretation")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("review-reflection")).toBeVisible({ timeout: 15_000 });
  });
});
