/**
 * Contract §6.1 — minimal API smoke per account.
 *
 * Uses **browser context** (`page` + `page.request`) so cookies from `storageState` are sent.
 * The standalone Playwright `request` fixture uses a separate APIRequestContext and does **not**
 * reliably pick up `test.use({ storageState })` from nested describes — that caused 401 UNAUTHENTICATED.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  arenaSessionSmokePath,
  E2E_CONTRACT_EMAILS,
  formatContractSmokeFailure,
  storageStatePathForContractUser,
  type E2EThreeContractKey,
} from "./helpers/three-contract-users";

const KEYS: E2EThreeContractKey[] = ["default", "step6Policy", "step6Forced"];

/** Supabase SSR cookies follow `sb-<project-ref>-auth-token` (+ optional `.0`, `.1`, … chunks). */
function authCookieSummary(cookies: { name: string; domain: string; path: string }[]): {
  names: string[];
  count: number;
} {
  const auth = cookies.filter((c) => c.name.includes("-auth-token"));
  return { names: auth.map((c) => c.name), count: auth.length };
}

async function gotoArenaForSameOriginApi(page: Page): Promise<void> {
  await page.goto("/en/bty-arena", { waitUntil: "domcontentloaded", timeout: 120_000 });
}

function appendCookieDiagnostics(base: string, page: Page): Promise<string> {
  return page.context().cookies().then((cookies) => {
    const { names, count } = authCookieSummary(cookies);
    const origins = [...new Set(cookies.map((c) => `${c.domain}${c.path}`))].slice(0, 8);
    return (
      `${base} | cookies_total=${cookies.length} | sb_auth_token_cookies=${count}` +
      ` | sb_auth_cookie_names=${names.length ? names.join(";") : "(none)"}` +
      ` | page_url=${page.url()} | cookie_origins_sample=${origins.join(",") || "(none)"}`
    );
  });
}

async function getWithSharedBrowserCookies(page: Page, requestPath: string): Promise<{ status: number; text: string }> {
  const res = await page.request.get(requestPath, { failOnStatusCode: false });
  const status = res.status();
  const text = await res.text();
  return { status, text };
}

for (const key of KEYS) {
  test.describe(E2E_CONTRACT_EMAILS[key], () => {
    test.use({ storageState: storageStatePathForContractUser(key) });

    test.beforeEach(async ({ page }) => {
      await gotoArenaForSameOriginApi(page);
    });

    test("GET /api/arena/core-xp — 200, requiresBeginnerPath === false (§6.1)", async ({ page }) => {
      const email = E2E_CONTRACT_EMAILS[key];
      const path = "/api/arena/core-xp";
      const { status, text } = await getWithSharedBrowserCookies(page, path);

      if (status !== 200) {
        const detail = await appendCookieDiagnostics(
          formatContractSmokeFailure({
            email,
            stage: "api",
            expected: `HTTP 200 from GET ${path} via page.request (browser storageState)`,
            actual: `HTTP ${status} body=${text.slice(0, 400)}`,
          }),
          page,
        );
        throw new Error(detail);
      }

      let body: { requiresBeginnerPath?: boolean };
      try {
        body = JSON.parse(text) as { requiresBeginnerPath?: boolean };
      } catch {
        const detail = await appendCookieDiagnostics(
          formatContractSmokeFailure({
            email,
            stage: "api",
            expected: "valid JSON body from GET /api/arena/core-xp",
            actual: `parse error body=${text.slice(0, 400)}`,
          }),
          page,
        );
        throw new Error(detail);
      }
      expect(
        body.requiresBeginnerPath,
        formatContractSmokeFailure({
          email,
          stage: "api",
          expected: "requiresBeginnerPath === false",
          actual: `requiresBeginnerPath=${JSON.stringify(body.requiresBeginnerPath)}`,
        }),
      ).toBe(false);
    });

    test("GET arena session — 200, ok, scenario.scenarioId; not 409 (§6.1)", async ({ page }) => {
      const email = E2E_CONTRACT_EMAILS[key];
      const sessionPath = arenaSessionSmokePath();
      const { status, text } = await getWithSharedBrowserCookies(page, sessionPath);

      if (status === 409) {
        const detail = await appendCookieDiagnostics(
          formatContractSmokeFailure({
            email,
            stage: "api",
            expected: "HTTP not 409 (session APIs)",
            actual: `HTTP 409 path=${sessionPath}`,
          }),
          page,
        );
        throw new Error(detail);
      }

      if (status !== 200) {
        const detail = await appendCookieDiagnostics(
          formatContractSmokeFailure({
            email,
            stage: "api",
            expected: `HTTP 200 from GET ${sessionPath} (match server ARENA_PIPELINE_DEFAULT with Playwright env)`,
            actual: `HTTP ${status} path=${sessionPath} body=${text.slice(0, 400)}`,
          }),
          page,
        );
        throw new Error(detail);
      }

      let body: {
        ok?: boolean;
        scenario?: { scenarioId?: string };
        error?: unknown;
      };
      try {
        body = JSON.parse(text) as {
          ok?: boolean;
          scenario?: { scenarioId?: string };
          error?: unknown;
        };
      } catch {
        const detail = await appendCookieDiagnostics(
          formatContractSmokeFailure({
            email,
            stage: "api",
            expected: `valid JSON from GET ${sessionPath}`,
            actual: `parse error body=${text.slice(0, 400)}`,
          }),
          page,
        );
        throw new Error(detail);
      }

      expect(
        body.ok,
        formatContractSmokeFailure({
          email,
          stage: "api",
          expected: "body.ok === true",
          actual: `ok=${JSON.stringify(body.ok)} error=${JSON.stringify(body.error)}`,
        }),
      ).toBe(true);

      const scenarioId = body.scenario?.scenarioId;
      expect(
        typeof scenarioId === "string" && scenarioId.length > 0,
        formatContractSmokeFailure({
          email,
          stage: "api",
          expected: "scenario.scenarioId non-empty string",
          actual: `scenario=${JSON.stringify(body.scenario)}`,
        }),
      ).toBe(true);
    });
  });
}
