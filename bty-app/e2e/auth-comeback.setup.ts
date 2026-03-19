/**
 * Comeback 전용 계정 → e2e/.auth/comeback-user.json
 * 진단: URL·로그인 제목 확인 후 폼 대기, fallback selector, 실패 시 body 텍스트 출력.
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

  await page.goto(`${baseUrl}/en/bty/login?next=/en/bty`, { waitUntil: "load", timeout: 30_000 });

  const currentUrl = page.url();
  console.log("[comeback-setup] URL after goto:", currentUrl);

  await expect(page).toHaveURL(/\/(en|ko)\/(bty\/login|bty)/);

  const signInHeading = page.getByRole("heading", { name: /sign in|로그인|Log in/i });
  if (await signInHeading.isVisible().catch(() => false)) {
    await expect(signInHeading).toBeVisible();
  } else {
    console.log("[comeback-setup] Login heading not visible. Body text (first 500 chars):");
    console.log((await page.locator("body").innerText()).slice(0, 500));
  }

  const emailInput = page
    .getByLabel(/email/i)
    .or(page.getByPlaceholder("you@example.com"))
    .or(page.locator('input[type="email"]').first());
  const passwordInput = page
    .getByLabel(/password/i)
    .or(page.getByPlaceholder("••••••••"))
    .or(page.locator('input[type="password"]').first());

  await emailInput.waitFor({ state: "visible", timeout: 15_000 });
  await emailInput.fill(email);
  await passwordInput.waitFor({ state: "visible", timeout: 5_000 });
  await passwordInput.fill(password);

  await page.getByRole("button", { name: /sign in|login|로그인|Log in/i }).click();

  await page.waitForURL(/\/en\/(bty|bty-arena|growth|my-page)/, { timeout: 20_000 });
  await expect(page).toHaveURL(/\/en\//);

  await page.context().storageState({ path: authFile });
});
