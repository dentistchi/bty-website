import { expect, test } from "@playwright/test";
import { canonicalArenaUrlPattern, openCanonicalArenaAndWaitForShell } from "../helpers/arena-canonical";

const LOCALE = "en";

test.describe("BTY Growth (canonical Arena entry)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${LOCALE}/bty-arena`);
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  test("Arena entry is canonical runtime URL only", async ({ page }) => {
    await openCanonicalArenaAndWaitForShell(page, LOCALE, 60_000);
    await expect(page).toHaveURL(canonicalArenaUrlPattern(LOCALE));
  });
});
