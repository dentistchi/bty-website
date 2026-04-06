import { test, expect } from "@playwright/test";
import { cleanupStaleE2EActionContractsBeforeTest } from "../helpers/cleanup-action-contracts";
import { E2E_CONTRACT_EMAILS, E2E_CONTRACT_USER_IDS } from "../helpers/three-contract-users";
import { canonicalArenaUrlPattern } from "../helpers/arena-canonical";

const LOCALE = "en";

test.describe("BTY route guards", () => {
  test.beforeEach(async ({ request }) => {
    await cleanupStaleE2EActionContractsBeforeTest(request, {
      userId: E2E_CONTRACT_USER_IDS.default,
      email: E2E_CONTRACT_EMAILS.default,
      label: "bty-guards:E2E_DEFAULT_USER",
    });
  });

  test("deprecated arena result URL resolves to canonical Arena entry", async ({ page }) => {
    await page.goto(`/${LOCALE}/bty-arena`);
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    await page.goto(`/${LOCALE}/bty-arena/result`);

    await expect(page).toHaveURL(canonicalArenaUrlPattern(LOCALE), { timeout: 15_000 });
  });

  test("reflection write shows calm empty state when no seed", async ({ page }) => {
    await page.route("**/api/bty/growth/seeds/latest", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ seed: null }),
      }),
    );

    await page.goto(`/${LOCALE}/growth/reflection/write`);
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
    });
    await page.reload();

    await expect(page.getByTestId("reflection-no-seed")).toBeVisible({ timeout: 20_000 });
  });
});
