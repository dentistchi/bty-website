import { expect, test } from "@playwright/test";
import { canonicalArenaUrlPattern } from "../helpers/arena-canonical";

const LOCALE = "en";

/**
 * Full Arena → reflection seed → history chain depended on legacy mission `/result` + `review-reflection`.
 * Canonical Arena completes in-page; reflection integration should be covered by API/unit tests or a dedicated Growth E2E.
 */
test.describe("BTY Arena → reflection → history", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${LOCALE}/bty-arena`);
    await page.evaluate(() => {
      sessionStorage.removeItem("bty-arena-session-v1");
      sessionStorage.removeItem("bty-arena-signal-dedupe-keys-v1");
      localStorage.removeItem("bty-signals");
      localStorage.removeItem("bty-growth-seeds");
      localStorage.removeItem("bty-reflections");
      localStorage.removeItem("bty-reflection-entries");
    });
  });

  test("canonical Arena route (not /play) after navigation", async ({ page }) => {
    await page.goto(`/${LOCALE}/bty-arena`);
    await expect(page).toHaveURL(canonicalArenaUrlPattern(LOCALE));
    await expect(page).not.toHaveURL(/\/bty-arena\/play/);
  });
});
