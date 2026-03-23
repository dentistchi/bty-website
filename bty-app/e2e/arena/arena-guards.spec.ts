import { expect, test } from "@playwright/test";

/**
 * Legacy mission routes redirect to canonical `/[locale]/bty-arena`.
 * (No separate sessionStorage gate on /play — unified client state on canonical route.)
 */
test.describe("Arena legacy route redirects", () => {
  test("/result redirects to canonical Arena", async ({ page }) => {
    await page.goto("/en/bty-arena/result", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/en\/bty-arena(\/beginner)?$/, { timeout: 15_000 });
  });

  test("/play redirects to canonical Arena", async ({ page }) => {
    await page.goto("/en/bty-arena/play", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/en\/bty-arena(\/beginner)?$/, { timeout: 15_000 });
  });

  test("/play/resolve redirects to canonical Arena", async ({ page }) => {
    await page.goto("/en/bty-arena/play/resolve", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/en\/bty-arena(\/beginner)?$/, { timeout: 15_000 });
  });

  test("/run compatibility redirect goes to canonical Arena", async ({ page }) => {
    await page.goto("/en/bty-arena/run", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/en\/bty-arena(\/beginner)?$/, { timeout: 15_000 });
  });
});
