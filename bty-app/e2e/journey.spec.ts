import { expect, test } from "@playwright/test";

/**
 * Journey — Growth 하위 recovery loop.
 * Comeback modal: is_comeback_eligible + 세션 미확인 시에만 노출 → 시드 계정 시 강화 가능.
 */
test.describe("Journey (authenticated)", () => {
  test("Growth → Journey card → board → day step", async ({ page }) => {
    await page.goto("/en/growth");
    await expect(page.getByText("Continue your 28-day recovery path")).toBeVisible({
      timeout: 20_000,
    });
    await page.locator('a[href$="/growth/journey"]').click();
    await expect(page).toHaveURL(/\/en\/growth\/journey/);

    await expect(page.getByText(/Day\s+\d+/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /Continue Day/i })).toBeVisible();

    await page.getByRole("button", { name: /Continue Day/i }).click();
    await expect(page).toHaveURL(/\/en\/growth\/journey\/day\/\d+/);

    await expect(page.getByRole("button", { name: /Complete Day/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Back to Journey/i }).first()).toBeVisible();
  });

  test("comeback modal UX when eligible (seeded profile)", async ({ page }) => {
    await page.goto("/en/growth/journey");
    await expect(page.getByText(/Day\s+\d+/i).first()).toBeVisible({ timeout: 25_000 });

    const modalCopy = page.getByText("System detected interruption.");
    const visible = await modalCopy.isVisible().catch(() => false);
    if (!visible) {
      test.info().annotations.push({
        type: "note",
        description: "Comeback modal not shown — seed is_comeback_eligible to assert Resume Journey flow.",
      });
      return;
    }

    await expect(modalCopy).toBeVisible();
    await expect(page.getByRole("button", { name: "Resume Journey" })).toBeVisible();
    await page.getByRole("button", { name: "Resume Journey" }).click();
    await expect(modalCopy).not.toBeVisible();
    await expect(page).toHaveURL(/\/en\/growth\/journey/);
    await expect(page.getByText(/Day\s+\d+/i).first()).toBeVisible();
  });
});
