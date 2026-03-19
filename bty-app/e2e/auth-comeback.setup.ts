/**
 * Comeback 전용 계정 → e2e/.auth/comeback-user.json
 */
import * as path from "node:path";
import { expect, test as setup } from "@playwright/test";

const authFile = path.join(__dirname, ".auth", "comeback-user.json");

setup("authenticate comeback user", async ({ page }) => {
  const email = process.env.E2E_COMEBACK_EMAIL?.trim();
  const password = process.env.E2E_COMEBACK_PASSWORD;
  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";

  if (!email || !password) {
    throw new Error("Missing E2E comeback credentials (E2E_COMEBACK_EMAIL, E2E_COMEBACK_PASSWORD).");
  }

  await page.goto(`${baseUrl}/en/bty/login?next=/en/bty`, { waitUntil: "domcontentloaded" });

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|login|로그인/i }).click();

  await page.waitForURL(/\/en\/(bty|bty-arena|growth|my-page)/, { timeout: 45_000 });
  await expect(page).toHaveURL(/\/en\//);

  await page.context().storageState({ path: authFile });
});
