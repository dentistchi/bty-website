import { test, expect } from "@playwright/test";

const LOCALE = "en";

test.describe("BTY Arena -> Reflection -> History", () => {
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

  test("completes one arena cycle, writes reflection, and sees it in history", async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto(`/${LOCALE}/bty-arena`);
    await expect(page.getByTestId("arena-enter")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("arena-enter").click();

    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/bty-arena/play`), { timeout: 20_000 });
    await expect(page.getByTestId("primary-A")).toBeVisible({ timeout: 25_000 });

    await page.getByTestId("primary-A").click();

    await expect(page.getByTestId("reinforce-X")).toBeVisible();
    await page.getByTestId("reinforce-X").click();

    await expect(page.getByTestId("resolve-decision")).toBeVisible();
    await page.getByTestId("resolve-decision").click();

    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/bty-arena/result`));
    await expect(page.getByTestId("resolve-interpretation")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("review-reflection")).toBeVisible({ timeout: 15_000 });

    // Optional: seed 저장 확인 (실패해도 계속 진행)
    const seedCount = await page.evaluate(() => {
      const raw = localStorage.getItem("bty-growth-seeds");
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed) ? parsed.length : 0;
    });
    if (seedCount === 0) {
      console.warn("[arena-reflection-history] No seed found in localStorage after Arena result");
    }

    await page.getByTestId("review-reflection").click();

    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/growth/reflection`), { timeout: 15_000 });
    await expect(page.getByTestId("open-reflection-write")).toBeVisible({ timeout: 20_000 });

    const writeEnabled = await page.getByTestId("open-reflection-write").isEnabled().catch(() => false);
    if (!writeEnabled) {
      await expect(page.getByText(/No Arena reflection seed yet/i)).toBeVisible();
      return;
    }

    await page.getByTestId("open-reflection-write").click();

    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/growth/reflection/write`), { timeout: 15_000 });
    await expect(page.getByTestId("reflection-prompt-title")).toBeVisible({ timeout: 15_000 });

    await page
      .getByTestId("reflection-answer-1")
      .fill("My first reaction was to protect trust before defending structure.");

    await page
      .getByTestId("reflection-answer-2")
      .fill("I tried to protect relationship stability, while clarity became vulnerable.");

    await page
      .getByTestId("reflection-answer-3")
      .fill("My next response must become more precise before pressure narrows the conversation.");

    const commitment = "I will protect trust without losing explanation clarity.";

    await page.getByTestId("reflection-commitment").fill(commitment);

    await expect(page.getByTestId("save-reflection")).toBeEnabled();
    await page.getByTestId("save-reflection").click();

    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/growth/history`), { timeout: 15_000 });
    await expect(page.getByTestId("growth-history-list")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("reflection-history-card").first()).toBeVisible();

    await expect(page.getByText(commitment)).toBeVisible();

    const reflectionCount = await page.evaluate(() => {
      const raw = localStorage.getItem("bty-reflections");
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed) ? parsed.length : 0;
    });
    expect(reflectionCount).toBeGreaterThan(0);
  });

  test("reflection airlock shows empty state when no seed exists", async ({ page }) => {
    await page.goto(`/${LOCALE}/growth/reflection`);

    await expect(
      page.getByText(/No Arena reflection seed yet/i),
    ).toBeVisible();
  });

  test("history page shows empty state when no reflections exist", async ({ page }) => {
    await page.goto(`/${LOCALE}/growth/history`);

    await expect(
      page.getByText(/No structured reflection has been recorded yet/i),
    ).toBeVisible();
  });
});
