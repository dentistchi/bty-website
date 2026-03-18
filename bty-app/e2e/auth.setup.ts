/**
 * BTY E2E v1 — 로그인 후 storage 저장. `/en/bty/login` (locale 고정).
 * @see docs/BTY_E2E_OPERATIONS_V1.md
 */
import * as path from "node:path";
import { test as setup, expect } from "@playwright/test";

const authFile = path.join(__dirname, ".auth", "user.json");

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error("Set E2E_EMAIL and E2E_PASSWORD (never commit).");
  }

  await page.goto("/en/bty/login?next=/en/bty", { waitUntil: "domcontentloaded" });
  await page.locator('input[autocomplete="email"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.locator('form button[type="submit"]').click();

  await expect(page).not.toHaveURL(/\/bty\/login/, { timeout: 45_000 });
  await expect(page).toHaveURL(/\/en\/(bty|bty-arena)/, { timeout: 15_000 });

  await page.context().storageState({ path: authFile });
});
