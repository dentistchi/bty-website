import { expect, test } from "@playwright/test";
import { arenaShellLocator, canonicalArenaUrlPattern } from "../helpers/arena-canonical";

const LOCALE = "en";

/**
 * BTY Arena — canonical `/[locale]/bty-arena` live session (no legacy mission lobby → /play).
 */
test.describe("BTY Arena canonical route", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${LOCALE}/bty-arena`);
    await page.evaluate(() => {
      try {
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
    });
  });

  test("stays on canonical URL with visible Arena shell", async ({ page }) => {
    await page.goto(`/${LOCALE}/bty-arena`);
    await expect(page).toHaveURL(canonicalArenaUrlPattern(LOCALE));
    await expect(arenaShellLocator(page).first()).toBeVisible({ timeout: 60_000 });
  });
});
