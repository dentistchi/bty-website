import { expect, test } from "@playwright/test";

/**
 * 비인증 E2E — 리다이렉트·퍼블릭 동작만 (auth storage 불필요).
 */
test.describe("Arena hub — unauthenticated", () => {
  test("/en/bty-arena redirects to login", async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/en/bty-arena", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/en\/bty\/login/, { timeout: 20_000 });
  });
});
