import { expect, test } from "@playwright/test";

/**
 * My Page — 상태 확인 화면; AIR raw·과도한 분석 수치 비노출.
 */
test.describe("My Page (authenticated)", () => {
  test("overview: Identity / Progress / Team, no raw AIR token", async ({ page }) => {
    await page.goto("/en/my-page");
    const overview = page.getByRole("region", { name: /My Page overview/i });
    await expect(overview).toContainText("Identity");
    await expect(overview).toContainText("Progress");
    await expect(overview).toContainText("Team");
    await expect(overview).toContainText("Code Name");
    await expect(overview).toContainText("Stage");
    await expect(overview).toContainText("Core Progress");
    await expect(overview).toContainText("Weekly Progress");
    await expect(overview.getByText("TII", { exact: true })).toBeVisible();

    await expect(overview.getByText(/^AIR$/)).toHaveCount(0);
    await expect(overview.getByText(/AIR\s*(score|raw|index)/i)).toHaveCount(0);
  });

  test("progress: Core XP, Weekly XP, system message", async ({ page }) => {
    await page.goto("/en/my-page/progress");
    await expect(page.getByText("Core XP").first()).toBeVisible();
    await expect(page.getByText("Weekly XP").first()).toBeVisible();
    await expect(page.getByText("System message", { exact: true })).toBeVisible();
  });

  test("team: TII, status, trend, rank", async ({ page }) => {
    await page.goto("/en/my-page/team");
    await expect(page.getByText(/Team Integrity Score \(TII\)/i)).toBeVisible();
    await expect(page.getByText("Status", { exact: true })).toBeVisible();
    await expect(page.getByText("Trend", { exact: true })).toBeVisible();
    await expect(page.getByText("Rank", { exact: true })).toBeVisible();
  });

  test("leader: readiness & certification as state, not raw analytics dump", async ({ page }) => {
    await page.goto("/en/my-page/leader");
    await expect(page.getByText(/Leader readiness/i)).toBeVisible();
    await expect(page.getByText("Certification", { exact: true })).toBeVisible();
    await expect(page.getByText(/not raw analytics|Leadership status is shown as state/i)).toBeVisible();

    const region = page.locator('[role="main"], main').first();
    await expect(region.getByText(/p-value|confidence interval|coefficient/i)).toHaveCount(0);
  });
});
