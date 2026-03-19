import { expect, test } from "@playwright/test";

/** My Page — 상태 화면 testid 고정. */
test.describe("My Page (authenticated)", () => {
  test("overview cards & no raw AIR", async ({ page }) => {
    await page.goto("/en/my-page");
    await expect(page.getByTestId("my-page-overview")).toBeVisible();
    await expect(page.getByTestId("my-page-identity-card")).toBeVisible();
    await expect(page.getByTestId("my-page-progress-card")).toBeVisible();
    await expect(page.getByTestId("my-page-team-card")).toBeVisible();
    await expect(page.getByTestId("my-page-code-name")).toBeVisible();
    await expect(page.getByTestId("my-page-stage")).toBeVisible();
    await expect(page.getByTestId("my-page-core-progress")).toBeVisible();
    await expect(page.getByTestId("my-page-weekly-progress")).toBeVisible();
    await expect(page.getByTestId("my-page-tii-summary")).toBeVisible();

    const overview = page.getByTestId("my-page-overview");
    await expect(overview.getByText(/^AIR$/)).toHaveCount(0);
    await expect(overview.getByText(/AIR\s*(score|raw|index)/i)).toHaveCount(0);
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
