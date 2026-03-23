import { expect, test } from "@playwright/test";
import { canonicalArenaUrlPattern, openCanonicalArenaAndWaitForShell } from "../helpers/arena-canonical";

const LOCALE = "en";

test.describe("BTY Arena entry (reflection chain retired from E2E)", () => {
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

  test("canonical Arena runtime after navigation", async ({ page }) => {
    await openCanonicalArenaAndWaitForShell(page, LOCALE, 60_000);
    await expect(page).toHaveURL(canonicalArenaUrlPattern(LOCALE));
  });
});
