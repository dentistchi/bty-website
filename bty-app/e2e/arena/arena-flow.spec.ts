import { expect, test } from "@playwright/test";

/**
 * BTY Arena mission flow — route + sessionStorage contract (Lobby → Play → Result).
 */
test.describe("Arena mission flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/bty-arena");
    await page.evaluate(() => {
      try {
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
    });
    await page.goto("/en/bty-arena");
  });

  test("full flow: lobby → play → result → continue → play", async ({ page }) => {
    await expect(page.getByTestId("arena-enter")).toBeVisible();

    await page.getByTestId("arena-enter").click();
    await expect(page).toHaveURL(/\/en\/bty-arena\/play/);

    await page.getByTestId("primary-A").click();
    await expect(page.getByTestId("reinforce-X")).toBeVisible();

    await page.getByTestId("reinforce-X").click();
    await expect(page.getByTestId("resolve-decision")).toBeVisible();

    await page.getByTestId("resolve-decision").click();
    await expect(page).toHaveURL(/\/en\/bty-arena\/result/, { timeout: 15_000 });

    await expect(page.getByTestId("resolve-interpretation")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("resolve-interpretation")).toContainText(/System detected|relational/i);

    await expect(page.getByTestId("continue-arena")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("continue-arena").click();

    await expect(page).toHaveURL(/\/en\/bty-arena\/play/);
  });

  test("resume from lobby keeps primary + reinforcement selection", async ({ page }) => {
    await page.getByTestId("arena-enter").click();
    await expect(page).toHaveURL(/\/en\/bty-arena\/play/);

    await page.getByTestId("primary-A").click();
    await page.getByTestId("reinforce-X").click();

    await page.goto("/en/bty-arena");
    await expect(page.getByTestId("arena-resume")).toBeVisible();

    await page.getByTestId("arena-resume").click();
    await expect(page).toHaveURL(/\/en\/bty-arena\/play/);

    await expect(page.getByTestId("primary-A")).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("reinforce-X")).toHaveAttribute("data-selected", "true");
  });
});
