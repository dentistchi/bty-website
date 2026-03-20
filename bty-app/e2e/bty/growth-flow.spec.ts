import { test, expect } from "@playwright/test";

const LOCALE = "en";

test.describe("BTY Growth flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${LOCALE}/bty-arena`);
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  test("arena result → reflection write → history", async ({ page }) => {
    await page.goto(`/${LOCALE}/bty-arena`);
    await page.getByTestId("arena-enter").click();
    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/bty-arena/play`));

    await page.getByTestId("primary-A").click();
    await page.getByTestId("reinforce-X").click();
    await page.getByTestId("resolve-decision").click();

    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/bty-arena/result`));
    await expect(page.getByTestId("review-reflection")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("review-reflection").click();

    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/growth/reflection`));
    await expect(page.getByTestId("open-reflection-write")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("open-reflection-write")).toBeEnabled();
    await page.getByTestId("open-reflection-write").click();

    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/growth/reflection/write`));
    await expect(page.getByTestId("reflection-prompt-title")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("reflection-answer-1").fill("I noticed a relational protection reflex first.");
    await page.getByTestId("reflection-answer-2").fill("I tried to protect trust, while clarity became vulnerable.");
    await page.getByTestId("reflection-answer-3").fill("My next response must become more precise before tension rises.");
    await page.getByTestId("reflection-commitment").fill("I will protect trust without losing explanation clarity.");

    await page.getByTestId("save-reflection").click();

    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/growth/history`));
    await expect(page.getByTestId("growth-history-list")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("reflection-history-card").first()).toBeVisible();
  });
});
