import { expect, test } from "@playwright/test";

/**
 * Route guards for mission Play / Result (sessionStorage).
 */
test.describe("Arena mission guards", () => {
  test("cannot access /result without committed decisions", async ({ page }) => {
    await page.goto("/en/bty-arena");
    await page.evaluate(() => {
      try {
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
    });

    await page.goto("/en/bty-arena/result");
    await expect(page).toHaveURL(/\/en\/bty-arena$/, { timeout: 15_000 });
  });

  test("cannot access /play without mission session", async ({ page }) => {
    await page.goto("/en/bty-arena");
    await page.evaluate(() => {
      try {
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
    });

    await page.goto("/en/bty-arena/play");
    await expect(page).toHaveURL(/\/en\/bty-arena$/);
  });
});
