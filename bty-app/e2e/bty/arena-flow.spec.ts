import { expect, test } from "@playwright/test";
import { canonicalArenaUrlPattern, openCanonicalArenaAndWaitForShell } from "../helpers/arena-canonical";

const LOCALE = "en";

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

  test("canonical URL and run shell", async ({ page }) => {
    await openCanonicalArenaAndWaitForShell(page, LOCALE, 60_000);
    await expect(page).toHaveURL(canonicalArenaUrlPattern(LOCALE));
  });
});
