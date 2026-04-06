import { expect, test } from "@playwright/test";
import { cleanupStaleE2EActionContractsBeforeTest } from "../helpers/cleanup-action-contracts";
import { E2E_CONTRACT_EMAILS, E2E_CONTRACT_USER_IDS } from "../helpers/three-contract-users";
import { canonicalArenaUrlPattern, openCanonicalArenaAndWaitForShell } from "../helpers/arena-canonical";

const LOCALE = "en";

test.describe("BTY Growth (canonical Arena entry)", () => {
  test.beforeEach(async ({ page, request }) => {
    await cleanupStaleE2EActionContractsBeforeTest(request, {
      userId: E2E_CONTRACT_USER_IDS.default,
      email: E2E_CONTRACT_EMAILS.default,
      label: "bty-growth-flow:E2E_DEFAULT_USER",
    });
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
