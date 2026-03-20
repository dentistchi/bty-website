import { test, expect } from "@playwright/test";

const LOCALE = "en";

test.describe("BTY full leadership loop", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${LOCALE}/bty-arena`);
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  test("arena → reflection → history → my page", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto(`/${LOCALE}/bty-arena`);
    await expect(page.getByTestId("arena-enter")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("arena-enter").click();

    await expect(page).toHaveURL(new RegExp(`/bty-arena/play`), { timeout: 20_000 });
    await expect(page.getByTestId("primary-A")).toBeVisible({ timeout: 25_000 });
    await page.getByTestId("primary-A").click();
    await page.getByTestId("reinforce-X").click();
    await page.getByTestId("resolve-decision").click();

    await expect(page).toHaveURL(new RegExp(`/bty-arena/result`), { timeout: 15_000 });
    await expect(page.getByTestId("resolve-interpretation")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("review-reflection").click();

    await expect(page).toHaveURL(new RegExp(`/growth/reflection`), { timeout: 15_000 });
    await expect(page.getByTestId("open-reflection-write")).toBeVisible({ timeout: 20_000 });

    const writeEnabled = await page.getByTestId("open-reflection-write").isEnabled().catch(() => false);
    if (writeEnabled) {
      await page.getByTestId("open-reflection-write").click();
      await expect(page).toHaveURL(new RegExp(`/growth/reflection/write`), { timeout: 15_000 });
      await page.getByTestId("reflection-answer-1").fill("My first impulse was to stabilize trust.");
      await page.getByTestId("reflection-answer-2").fill("I protected relationship, but clarity risk remained.");
      await page.getByTestId("reflection-answer-3").fill("My next response must become operationally clearer.");
      await page.getByTestId("reflection-commitment").fill("I will restore clarity before pressure narrows the conversation.");
      await page.getByTestId("save-reflection").click();
      await expect(page).toHaveURL(new RegExp(`/growth/history`), { timeout: 15_000 });
      await expect(page.getByTestId("reflection-history-card").first()).toBeVisible({ timeout: 15_000 });
    }

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
