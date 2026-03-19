/**
 * 기본 E2E 계정 → e2e/.auth/user.json
 *
 * Setup 성공 = 로그인 후 /en/bty-arena 보호 페이지 실제 접근 가능할 때만 state 저장.
 */
import * as path from "node:path";
import { expect, test as setup } from "@playwright/test";

const authFile = path.join(__dirname, ".auth", "user.json");

setup("authenticate default user", async ({ page, context }) => {
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD;
  const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";

  if (!email || !password) {
    throw new Error("Missing E2E credentials");
  }

  const loginUrl = `${baseUrl}/en/bty/login?next=/en/bty-arena`;
  await page.goto(loginUrl, { waitUntil: "networkidle" });
  console.log("[auth-setup] URL after goto:", page.url());
  console.log("[auth-setup] title:", await page.title());

  const emailInput = page.getByTestId("login-email-input").or(page.locator('input[type="email"]').first());
  const passwordInput = page.getByTestId("login-password-input").or(page.locator('input[type="password"]').first());
  const submitBtn = page.getByTestId("login-submit-button").or(page.getByRole("button", { name: /sign in|login|로그인/i }));

  await emailInput.waitFor({ state: "visible", timeout: 15_000 }).catch(async () => {
    console.log("[auth-setup] login form not found. body preview:", (await page.locator("body").innerText()).slice(0, 500));
    throw new Error("login form (email input) not found");
  });
  await emailInput.fill(email);
  await passwordInput.waitFor({ state: "visible", timeout: 5_000 });
  await passwordInput.fill(password);
  await submitBtn.click();

  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20_000 });

  await page.goto(`${baseUrl}/en/bty-arena`, { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/en\/bty-arena/);
  await expect(page).not.toHaveURL(/\/login/);

  const cookies = await context.cookies();
  if (!cookies.length) {
    throw new Error("No cookies found after login");
  }

  await context.storageState({ path: authFile });
});
