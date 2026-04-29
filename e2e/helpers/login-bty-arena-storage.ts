/**
 * E2E session via POST /api/auth/login (same as production password flow) — no public login UI selectors.
 * Cookies from Set-Cookie are applied to the browser context used by `page.request`.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { checkSupabaseAuthCookiesForE2E } from "./supabase-auth-storage-validate";

const DEFAULT_LOCALE = "en" as const;
const ARENA_PATH = `/${DEFAULT_LOCALE}/bty-arena`;

/** Mirrors cookie commit — helps Path=/ cookies settle before navigation. */
async function forceCookieCommitPlaywright(page: Page): Promise<void> {
  await page.request.get("/api/auth/whoami", { failOnStatusCode: false }).catch(() => {});
}

async function waitForServerSessionResolved(page: Page, label: string): Promise<void> {
  const maxMs = 45_000;
  const start = Date.now();
  let last = "";
  while (Date.now() - start < maxMs) {
    const res = await page.request.get(`/api/auth/session?_t=${Date.now()}`, { failOnStatusCode: false });
    const text = await res.text();
    last = `status=${res.status()} body=${text.slice(0, 280)}`;
    if (res.status() === 200) {
      try {
        const j = JSON.parse(text) as { ok?: boolean; user?: { id?: string } };
        if (j?.ok === true && typeof j.user?.id === "string" && j.user.id.length > 0) {
          return;
        }
      } catch {
        /* retry */
      }
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`[${label}] GET /api/auth/session never returned ok+user after password login. ${last}`);
}

export type LoginBtyArenaOptions = {
  email: string;
  password: string;
  baseUrl: string;
  storageStatePath?: string;
  label: string;
};

/**
 * Password sign-in through API, then verify Arena + optional Playwright storageState.
 */
export async function loginBtyArenaAndOptionalStorage(
  page: Page,
  context: BrowserContext,
  opts: LoginBtyArenaOptions,
): Promise<void> {
  const { email, password, baseUrl, storageStatePath, label } = opts;
  const loginUrl = new URL("/api/auth/login", baseUrl);
  loginUrl.searchParams.set("next", ARENA_PATH);

  await context.clearCookies();
  await page.goto(`${baseUrl}/${DEFAULT_LOCALE}/bty`, { waitUntil: "load", timeout: 120_000 });

  const res = await page.request.post(loginUrl.toString(), {
    data: { email, password },
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok()) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[${label}] POST /api/auth/login failed HTTP ${res.status()} body=${body.slice(0, 400)}`,
    );
  }

  const json = (await res.json().catch(() => null)) as { ok?: boolean; next?: string; error?: string } | null;
  if (!json?.ok) {
    throw new Error(`[${label}] POST /api/auth/login returned ok=false error=${json?.error ?? "unknown"}`);
  }

  await page.goto(`${baseUrl}${ARENA_PATH}`, { waitUntil: "load", timeout: 120_000 });
  await expect(page).toHaveURL(new RegExp(`/en/bty-arena`));
  await expect(page).not.toHaveURL(/\/login/);

  await forceCookieCommitPlaywright(page);
  await waitForServerSessionResolved(page, label);

  const cookies = await context.cookies();
  if (!cookies.length) {
    throw new Error(`[${label}] No cookies after API login`);
  }

  const sessionCheck = checkSupabaseAuthCookiesForE2E(cookies);
  if (!sessionCheck.ok) {
    throw new Error(
      `[${label}] Supabase auth cookie invalid: ${sessionCheck.reason} | names=${sessionCheck.cookieNames.join(",")}`,
    );
  }

  if (storageStatePath) {
    await fs.mkdir(path.dirname(storageStatePath), { recursive: true }).catch(() => {});
    await context.storageState({ path: storageStatePath });
    const written = JSON.parse(await fs.readFile(storageStatePath, "utf8")) as {
      cookies?: { name: string; value: string }[];
    };
    const roundTrip = checkSupabaseAuthCookiesForE2E(written.cookies ?? []);
    if (!roundTrip.ok) {
      throw new Error(
        `[${label}] storageState corrupted auth cookie: ${roundTrip.reason} | names=${roundTrip.cookieNames.join(",")}`,
      );
    }
  }
}
