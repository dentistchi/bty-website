/**
 * 기본 E2E 계정 → e2e/.auth/user.json
 *
 * Setup 성공 = 로그인 후 /en/bty-arena 보호 페이지 실제 접근 가능할 때만 state 저장.
 *
 * Login UI: `src/app/[locale]/bty/(public)/login/` → route **`/{locale}/bty/login`** (e.g. `/en/bty/login`).
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { expect, test as setup, type Page } from "@playwright/test";

const authFile = path.join(__dirname, ".auth", "user.json");
const failureScreenshot = path.join(__dirname, ".auth", "last-auth-setup-failure.png");

/** App login page (locale-prefixed). Email field has no `type="email"` (text + autocomplete). */
const LOGIN_PATH = "/en/bty/login";

async function mkdirAuthDir(): Promise<void> {
  await fs.mkdir(path.dirname(authFile), { recursive: true }).catch(() => {});
}

async function logAuthSetupFailure(page: Page, label: string): Promise<void> {
  console.error(`[auth-setup] ${label}`);
  if (page.isClosed()) {
    console.error("[auth-setup] page already closed; skipping URL/title/screenshot");
    return;
  }
  try {
    console.error("[auth-setup] url:", page.url());
  } catch (e) {
    console.error("[auth-setup] url error:", e instanceof Error ? e.message : String(e));
  }
  try {
    if (!page.isClosed()) {
      console.error("[auth-setup] title:", await page.title());
    }
  } catch (e) {
    console.error("[auth-setup] title error:", e instanceof Error ? e.message : String(e));
  }
  try {
    if (!page.isClosed()) {
      await mkdirAuthDir();
      await page.screenshot({ path: failureScreenshot, fullPage: true });
      console.error("[auth-setup] screenshot:", failureScreenshot);
    }
  } catch (e) {
    console.error("[auth-setup] screenshot error:", e instanceof Error ? e.message : String(e));
  }
}

setup("authenticate default user", async ({ page, context }) => {
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD;
  const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3000").trim().replace(/\/$/, "") || "http://127.0.0.1:3000";

  if (!email || !password) {
    throw new Error("Missing E2E credentials");
  }

  const loginUrl = `${baseUrl}${LOGIN_PATH}?next=${encodeURIComponent("/en/bty-arena")}`;

  try {
    await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.getByTestId("login-page").waitFor({ state: "visible", timeout: 30_000 });
  } catch (e) {
    await logAuthSetupFailure(page, "goto or login shell not visible");
    throw e instanceof Error ? e : new Error(String(e));
  }

  console.log("[auth-setup] URL after goto:", page.url());
  console.log("[auth-setup] title:", await page.title());

  const emailInput = page
    .getByTestId("login-email-input")
    .or(page.locator("#login-email"))
    .or(page.locator('input[autocomplete="email"]'))
    .first();
  const passwordInput = page
    .getByTestId("login-password-input")
    .or(page.locator("#login-password"))
    .or(page.locator('input[type="password"]'))
    .first();
  const submitBtn = page
    .getByTestId("login-submit-button")
    .or(page.getByRole("button", { name: /sign in|login|로그인/i }));

  try {
    await emailInput.waitFor({ state: "visible", timeout: 20_000 });
  } catch (e) {
    await logAuthSetupFailure(page, "login form (email input) not found");
    throw e instanceof Error ? e : new Error("login form (email input) not found");
  }

  await emailInput.fill(email);
  await passwordInput.waitFor({ state: "visible", timeout: 10_000 });
  await passwordInput.fill(password);
  await submitBtn.click();

  try {
    await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45_000 });
  } catch (e) {
    await logAuthSetupFailure(page, "login did not redirect away from /login");
    let current = "(unavailable)";
    try {
      if (!page.isClosed()) current = page.url();
    } catch {
      current = "(url error)";
    }
    throw new Error(`Login did not redirect from /login (current: ${current})`);
  }

  try {
    await page.goto(`${baseUrl}/en/bty-arena`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  } catch (e) {
    await logAuthSetupFailure(page, "goto /en/bty-arena after login failed");
    throw e instanceof Error ? e : new Error(String(e));
  }

  await expect(page).toHaveURL(/\/en\/bty-arena/);
  await expect(page).not.toHaveURL(/\/login/);

  const cookies = await context.cookies();
  if (!cookies.length) {
    throw new Error("No cookies found after login");
  }

  await mkdirAuthDir();
  await context.storageState({ path: authFile });
});
