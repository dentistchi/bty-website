import { expect, test } from "@playwright/test";
import { cleanupStaleE2EActionContractsBeforeTest } from "./helpers/cleanup-action-contracts";
import { E2E_CONTRACT_EMAILS, E2E_CONTRACT_USER_IDS } from "./helpers/three-contract-users";

/** My Page — 상태 화면 testid 고정. */
test.describe("My Page (authenticated)", () => {
  test.beforeEach(async ({ request }) => {
    await cleanupStaleE2EActionContractsBeforeTest(request, {
      userId: E2E_CONTRACT_USER_IDS.default,
      email: E2E_CONTRACT_EMAILS.default,
      label: "my-page:E2E_DEFAULT_USER",
    });
  });

  test("overview leadership console & no raw AIR", async ({ page }) => {
    test.setTimeout(120_000);

    const statePromise = page
      .waitForResponse(
        (res) => res.url().includes("/api/bty/my-page/state") && res.request().method() === "GET",
        { timeout: 35_000 },
      )
      .catch(() => null);

    await page.goto("/en/my-page", { waitUntil: "load" });
    await expect(page).toHaveURL(/\/en\/my-page/, { timeout: 10_000 });
    await expect(page).not.toHaveURL(/\/bty\/login/);
    await statePromise;

    await expect(page.getByTestId("my-page-overview")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("my-page-leadership-console")).toBeVisible();
    await expect(page.getByTestId("my-page-code-name")).toBeVisible();
    await expect(page.getByTestId("my-page-stage")).toBeVisible();
    await expect(page.getByTestId("leadership-state-row")).toBeVisible();

    const overview = page.getByTestId("my-page-overview");
    await expect(overview.getByText(/AIR\s*\d/)).toHaveCount(0);
  });

  test("progress screen", async ({ page }) => {
    await page.goto("/en/my-page/progress");
    await expect(page.getByTestId("my-page-progress-screen")).toBeVisible();
    await expect(page.getByTestId("my-page-core-xp")).toBeVisible();
    await expect(page.getByTestId("my-page-weekly-xp")).toBeVisible();
    await expect(page.getByTestId("my-page-system-note")).toBeVisible();
  });

  test("team screen", async ({ page }) => {
    await page.goto("/en/my-page/team");
    await expect(page.getByTestId("my-page-team-screen")).toBeVisible();
    await expect(page.getByTestId("my-page-tii")).toBeVisible();
    await expect(page.getByTestId("my-page-team-status")).toBeVisible();
    await expect(page.getByTestId("my-page-team-trend")).toBeVisible();
    await expect(page.getByTestId("my-page-team-rank")).toBeVisible();
  });

  test("leader screen — no analytics dump", async ({ page }) => {
    await page.goto("/en/my-page/leader");
    await expect(page.getByTestId("my-page-leader-screen")).toBeVisible();
    await expect(page.getByTestId("my-page-leader-readiness")).toBeVisible();
    await expect(page.getByTestId("my-page-certification")).toBeVisible();
    await expect(page.getByText(/not raw analytics|Leadership status is shown as state/i)).toBeVisible();

    const main = page.locator("main").first();
    await expect(main.getByText(/p-value|confidence interval|coefficient/i)).toHaveCount(0);
  });
});
