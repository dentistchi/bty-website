import { expect, test } from "@playwright/test";
import { canonicalArenaUrlPattern } from "../helpers/arena-canonical";

const LOCALE = "en";

/**
 * Growth reflection/history flows are no longer driven by the retired mission `/result` screen.
 * Canonical Arena completes inside `/bty-arena`; growth E2E should target Growth routes directly when needed.
 */
test.describe("BTY Growth (post–canonical Arena)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${LOCALE}/bty-arena`);
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  test("Arena entry uses canonical /bty-arena URL (not /play)", async ({ page }) => {
    await page.goto(`/${LOCALE}/bty-arena`);
    await expect(page).toHaveURL(canonicalArenaUrlPattern(LOCALE));
    await expect(page).not.toHaveURL(/\/bty-arena\/play/);
  });
});
