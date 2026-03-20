import { test, expect } from "@playwright/test";

const LOCALE = "en";

test.describe("BTY My Page", () => {
  test("identity console renders leadership regions", async ({ page }) => {
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
