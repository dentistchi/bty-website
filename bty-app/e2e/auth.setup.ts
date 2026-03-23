/**
 * 기본 E2E 계정 → e2e/.auth/user.json
 *
 * Setup 성공 = 로그인 후 /en/bty-arena 보호 페이지 실제 접근 가능할 때만 state 저장.
 *
 * Login route: `src/app/[locale]/bty/(public)/login/` → **`/{locale}/bty/login`**
 * (e.g. `/en/bty/login`). `data-testid="login-page"` lives on `LoginClient` root; we wait on
 * `#login-email` instead so CI still passes if the shell hydrates slowly or the wrapper is skipped.
 *
 * Middleware: authenticated users hitting `/bty/login` are redirected to `/bty` — clear cookies first.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { expect, test as setup, type Page } from "@playwright/test";

const authFile = path.join(__dirname, ".auth", "user.json");
const failureScreenshot = path.join(__dirname, ".auth", "last-auth-setup-failure.png");

/** Locale-prefixed BTY login (see `src/app/[locale]/bty/(public)/login/`). */
const LOGIN_PATH = "/en/bty/login";

async function mkdirAuthDir(): Promise<void> {
  await fs.mkdir(path.dirname(authFile), { recursive: true }).catch(() => {});
}

function pathnameLooksLikeLogin(url: string): boolean {
  try {
    const p = new URL(url).pathname;
    return p.includes("/bty/login");
  } catch {
    return false;
  }
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

  await context.clearCookies();

  try {
    await page.goto(loginUrl, { waitUntil: "load", timeout: 120_000 });
  } catch (e) {
    await logAuthSetupFailure(page, "goto login failed");
    throw e instanceof Error ? e : new Error(String(e));
  }

  const urlAfter = page.url();
  console.log("[auth-setup] URL after goto:", urlAfter);
  try {
    console.log("[auth-setup] title:", await page.title());
  } catch {
    /* ignore */
  }

  if (!pathnameLooksLikeLogin(urlAfter)) {
    await logAuthSetupFailure(page, "not on /bty/login (middleware redirect or wrong BASE_URL?)");
    throw new Error(
      `[auth-setup] Expected URL path to include /bty/login; got ${urlAfter}. ` +
        `If already authenticated, ensure cookies are cleared. Check BASE_URL in CI.`,
    );
  }

  const emailInput = page
    .locator("#login-email")
    .or(page.getByTestId("login-email-input"))
    .or(page.locator('input[autocomplete="email"]'))
    .first();
  const passwordInput = page
    .locator("#login-password")
    .or(page.getByTestId("login-password-input"))
    .or(page.locator('input[type="password"]'))
    .first();
  const submitBtn = page
    .getByTestId("login-submit-button")
    .or(page.getByRole("button", { name: /sign in|login|로그인/i }));

  try {
    await emailInput.waitFor({ state: "visible", timeout: 90_000 });
  } catch (e) {
    await logAuthSetupFailure(page, "login email field not visible (hydration or wrong page?)");
    throw e instanceof Error ? e : new Error("login form (email input) not found");
  }

  await emailInput.fill(email);
  await passwordInput.waitFor({ state: "visible", timeout: 15_000 });
  await passwordInput.fill(password);
  await submitBtn.click();

  try {
    await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 60_000 });
  } catch {
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
    await page.goto(`${baseUrl}/en/bty-arena`, { waitUntil: "load", timeout: 120_000 });
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
