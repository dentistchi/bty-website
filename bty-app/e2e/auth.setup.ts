/**
 * 기본 E2E 계정 → e2e/.auth/user.json
 */
import * as path from "node:path";
import { expect, test as setup } from "@playwright/test";

const authFile = path.join(__dirname, ".auth", "user.json");

setup("authenticate default user", async ({ page }) => {
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD;
  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";

  if (!email || !password) {
    throw new Error("Missing E2E credentials (E2E_EMAIL, E2E_PASSWORD).");
  }

  await page.goto(`${baseUrl}/en/bty/login?next=/en/bty`, { waitUntil: "domcontentloaded" });

  const emailInput = page.getByLabel(/email/i).or(page.getByPlaceholder("you@example.com"));
  const passwordInput = page.getByLabel(/password/i).or(page.getByPlaceholder("••••••••"));
  await emailInput.waitFor({ state: "visible", timeout: 15_000 });
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await page.getByRole("button", { name: /sign in|login|로그인|Log in/i }).click();

  await page.waitForURL(/\/en\/(bty|bty-arena|growth|my-page)/, { timeout: 45_000 });
  await expect(page).toHaveURL(/\/en\//);

  await page.context().storageState({ path: authFile });
});
