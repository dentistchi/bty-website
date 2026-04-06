/**
 * 기본 E2E 계정 → e2e/.auth/user.json
 *
 * Session: POST /api/auth/login (password) — public BTY login UI is OAuth/phone-only; E2E uses API only.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { test as setup, type Page } from "@playwright/test";
import { cleanupStaleE2EActionContractsBeforeTest } from "./helpers/cleanup-action-contracts";
import { loginBtyArenaAndOptionalStorage } from "./helpers/login-bty-arena-storage";

const authFile = path.join(__dirname, ".auth", "user.json");
const failureScreenshot = path.join(__dirname, ".auth", "last-auth-setup-failure.png");

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

setup("authenticate default user", async ({ page, context, request }) => {
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD;
  const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3000").trim().replace(/\/$/, "") || "http://127.0.0.1:3000";

  if (!email || !password) {
    throw new Error("Missing E2E credentials");
  }

  const cleanupEmail = email.toLowerCase();
  await cleanupStaleE2EActionContractsBeforeTest(request, {
    email: cleanupEmail,
    label: `legacy-auth-setup:${cleanupEmail}`,
  });

  try {
    await loginBtyArenaAndOptionalStorage(page, context, {
      email,
      password,
      baseUrl,
      storageStatePath: authFile,
      label: "legacy-auth-setup",
    });
  } catch (e) {
    await logAuthSetupFailure(page, "API login or arena verification failed");
    throw e instanceof Error ? e : new Error(String(e));
  }
});
