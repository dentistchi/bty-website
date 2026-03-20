import { test, expect } from "@playwright/test";

const LOCALE = "en";

test.describe("BTY route guards", () => {
  test("cannot land on arena result without completed play session", async ({ page }) => {
    await page.goto(`/${LOCALE}/bty-arena`);
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    await page.goto(`/${LOCALE}/bty-arena/result`);

    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/bty-arena(?:/play)?$`));
  });

  test("reflection write shows calm empty state when no seed", async ({ page }) => {
    await page.route("**/api/bty/growth/seeds/latest", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ seed: null }),
      }),
    );

    await page.goto(`/${LOCALE}/growth/reflection/write`);
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
    });
    await page.reload();

    await expect(page.getByTestId("reflection-no-seed")).toBeVisible({ timeout: 20_000 });
  });
});
