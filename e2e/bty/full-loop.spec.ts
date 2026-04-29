import { expect, test } from "@playwright/test";
import { cleanupStaleE2EActionContractsBeforeTest } from "../helpers/cleanup-action-contracts";
import { E2E_CONTRACT_EMAILS, E2E_CONTRACT_USER_IDS } from "../helpers/three-contract-users";
import { arenaShellLocator, canonicalArenaUrlPattern } from "../helpers/arena-canonical";

const LOCALE = "en";

test.describe("BTY leadership loop (smoke)", () => {
  test.beforeEach(async ({ page, request }) => {
    await cleanupStaleE2EActionContractsBeforeTest(request, {
      userId: E2E_CONTRACT_USER_IDS.default,
      email: E2E_CONTRACT_EMAILS.default,
      label: "bty-full-loop:E2E_DEFAULT_USER",
    });
    await page.goto(`/${LOCALE}/bty-arena`);
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  test("canonical Arena loads from hub Play CTA", async ({ page }) => {
    await page.goto(`/${LOCALE}/bty-arena/hub`);
    await expect(page.getByTestId("arena-hub")).toBeVisible({ timeout: 20_000 });

    await Promise.all([
      page.waitForURL(canonicalArenaUrlPattern(LOCALE), { timeout: 30_000 }),
      page.getByTestId("arena-play-button").first().click(),
    ]);

    await expect(arenaShellLocator(page).first()).toBeVisible({ timeout: 60_000 });
  });

  test("my page overview loads when navigated directly", async ({ page }) => {
    test.setTimeout(120_000);

    const statePromise = page
      .waitForResponse(
        (res) => res.url().includes("/api/bty/my-page/state") && res.request().method() === "GET",
        { timeout: 35_000 },
      )
      .catch(() => null);

    await page.goto(`/${LOCALE}/my-page`, { waitUntil: "load" });
    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/my-page`), { timeout: 10_000 });
    await expect(page).not.toHaveURL(/\/bty\/login/);
    await statePromise;

    await expect(page.getByTestId("my-page-overview")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("my-page-leadership-console")).toBeVisible();
    await expect(page.getByTestId("my-page-code-name")).toBeVisible();
    await expect(page.getByTestId("my-page-stage")).toBeVisible();
    await expect(page.getByTestId("leadership-state-row")).toBeVisible();
  });
});
