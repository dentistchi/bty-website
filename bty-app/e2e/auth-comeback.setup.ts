/**
 * Comeback 전용 계정 → e2e/.auth/comeback-user.json
 *
 * Setup 성공 = 로그인 후 /en/growth/journey 보호 페이지 실제 접근 가능할 때만 state 저장.
 * "로그인 버튼 클릭"만으로는 통과하지 않음. 가짜 성공 방지.
 */
import * as path from "node:path";
import { expect, test as setup } from "@playwright/test";

const authFile = path.join(__dirname, ".auth", "comeback-user.json");

setup("authenticate comeback user", async ({ page, context }) => {
  const email = process.env.E2E_COMEBACK_EMAIL?.trim();
  const password = process.env.E2E_COMEBACK_PASSWORD;
  const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";

  if (!email || !password) {
    throw new Error("Missing E2E comeback credentials");
  }

  await page.goto(`${baseUrl}/en/bty/login?next=/en/growth/journey`, {
    waitUntil: "networkidle",
  });

  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 15_000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').waitFor({ state: "visible", timeout: 5_000 });
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /sign in|login|로그인/i }).click();

  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 20000,
  });

  // 보호 페이지 실제 접근: /en/growth/journey 에 도달해야 setup 성공
  await page.goto(`${baseUrl}/en/growth/journey`, { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/en\/growth\/journey/);
  await expect(page).not.toHaveURL(/\/login/);

  const cookies = await context.cookies();
  if (!cookies.length) {
    throw new Error("No cookies found after comeback login");
  }

  await context.storageState({
    path: authFile,
  });
});
