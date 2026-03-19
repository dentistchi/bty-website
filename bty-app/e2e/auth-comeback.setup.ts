/**
 * Comeback 전용 계정 → e2e/.auth/comeback-user.json
 *
 * Setup 성공 = 로그인 후 /en/growth/journey 보호 페이지 실제 접근 가능할 때만 state 저장.
 */
import * as path from "node:path";
import { expect, test as setup } from "@playwright/test";

const authFile = path.join(__dirname, ".auth", "comeback-user.json");

setup("authenticate comeback user", async ({ page, context }) => {
  const email = process.env.E2E_COMEBACK_EMAIL?.trim();
  const password = process.env.E2E_COMEBACK_PASSWORD;
  const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3000").trim().replace(/\/$/, "") || "http://127.0.0.1:3000";

  if (!email || !password) {
    throw new Error("Missing E2E comeback credentials");
  }

  const loginUrl = `${baseUrl}/en/bty/login?next=/en/growth/journey`;
  await page.goto(loginUrl, { waitUntil: "networkidle" });
  console.log("[auth-comeback-setup] URL after goto:", page.url());
  console.log("[auth-comeback-setup] title:", await page.title());

  const emailInput = page.getByTestId("login-email-input").or(page.locator('input[type="email"]').first());
  const passwordInput = page.getByTestId("login-password-input").or(page.locator('input[type="password"]').first());
  const submitBtn = page.getByTestId("login-submit-button").or(page.getByRole("button", { name: /sign in|login|로그인/i }));

  await emailInput.waitFor({ state: "visible", timeout: 15_000 }).catch(async () => {
    console.log("[auth-comeback-setup] login form not found. body preview:", (await page.locator("body").innerText()).slice(0, 500));
    throw new Error("login form (email input) not found");
  });
  await emailInput.fill(email);
  await passwordInput.waitFor({ state: "visible", timeout: 5_000 });
  await passwordInput.fill(password);
  await submitBtn.click();

  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20_000 }).catch(async () => {
    const body = (await page.locator("body").innerText()).slice(0, 800);
    const currentUrl = page.url();
    throw new Error(`Login did not redirect from /login (current: ${currentUrl}). Body preview: ${body}`);
  });

  await page.goto(`${baseUrl}/en/growth/journey`, { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/en\/growth\/journey/);
  await expect(page).not.toHaveURL(/\/login/);

  const cookies = await context.cookies();
  if (!cookies.length) {
    throw new Error("No cookies found after comeback login");
  }

  await context.storageState({ path: authFile });
});
