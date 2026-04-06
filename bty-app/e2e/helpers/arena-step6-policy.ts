import { expect, type BrowserContext, type Page, type Response } from "@playwright/test";
import {
  logE2eForcedElite,
  summarizeSessionBodyForLog,
  summarizeStep6GateForLog,
  truncateForE2eLog,
} from "./arena-step6-forced-elite-debug";

export const ARENA_STEP6_LOCALE = "en" as const;

/** Session router GET response shape (minimal). */
export type SessionRouterBody = {
  ok?: boolean;
  scenario?: { scenarioId?: string; eliteSetup?: unknown };
  error?: string;
};

/**
 * Fail fast — do not use `test.skip` for missing credentials.
 * Call from `test.beforeAll` in the Step 6 suite (or rely on `auth.setup` throwing first).
 */
export function assertE2eCredentialsOrThrow(): void {
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Arena Step 6 E2E requires E2E_EMAIL and E2E_PASSWORD. Set them in the environment before running.",
    );
  }
}

/**
 * Fail fast when the Playwright context has no cookies after auth setup (storageState missing or empty).
 */
export async function assertAuthCookiesPresentOrThrow(context: BrowserContext): Promise<void> {
  const cookies = await context.cookies();
  if (cookies.length === 0) {
    throw new Error(
      "No cookies in browser context — auth setup may have failed or storageState was not applied.",
    );
  }
}

/**
 * Fail fast when navigation to the canonical arena lands on a login surface (session missing / expired).
 */
export async function assertNotRedirectedToLoginOrThrow(page: Page, landingUrl: string): Promise<void> {
  const path = (() => {
    try {
      return new URL(landingUrl).pathname;
    } catch {
      return "";
    }
  })();
  if (path.includes("/bty/login") || path.includes("/login")) {
    throw new Error(
      `Unauthenticated redirect to login: ${landingUrl}. Re-run auth setup or check session cookies.`,
    );
  }
}

const SESSION_ROUTER_WAIT_MS = 120_000;

function isSessionRouterGetResponse(r: Response): boolean {
  if (r.request().method() !== "GET") return false;
  const u = r.url();
  return u.includes("/api/arena/session/next") || u.includes("/api/arena/n/session");
}

/**
 * Resolves on the first matching session-router GET **or** navigation to beginner arena.
 * `useArenaSession` does not call the session router when `requiresBeginnerPath` is true (client redirect only),
 * so waiting for that GET alone can time out. Non-OK session responses (409, etc.) must be observed without
 * requiring `status === 200` — otherwise `waitForResponse` never matches and hangs until timeout.
 */
async function waitForSessionRouterGetOrBeginnerAfter(
  page: Page,
  trigger: () => Promise<void>,
  phase: string,
): Promise<{ kind: "response"; response: Response } | { kind: "beginner" }> {
  logE2eForcedElite(`${phase}:race-setup`, {
    urlBeforeTrigger: page.url(),
    waitingFor: ["GET /api/arena/session/next|n/session", "URL /bty-arena/beginner"],
  });

  const resPromise = page.waitForResponse((r) => isSessionRouterGetResponse(r), {
    timeout: SESSION_ROUTER_WAIT_MS,
  });
  const beginnerPromise = page.waitForURL((url) => url.pathname.includes("/bty-arena/beginner"), {
    timeout: SESSION_ROUTER_WAIT_MS,
  });

  void resPromise.catch(() => {});
  void beginnerPromise.catch(() => {});

  await trigger();

  const outcome = await Promise.race([
    resPromise.then((response) => ({ kind: "response" as const, response })),
    beginnerPromise.then(() => ({ kind: "beginner" as const })),
  ]);

  if (outcome.kind === "beginner") {
    logE2eForcedElite(`${phase}:race-winner`, {
      winner: "beginner-url",
      urlAfterRace: page.url(),
      note: "Session router GET may be skipped when requiresBeginnerPath (onboarding gate)",
    });
  } else {
    const req = outcome.response.request();
    logE2eForcedElite(`${phase}:race-winner`, {
      winner: "session-router-response",
      responseUrl: outcome.response.url(),
      requestUrl: req.url(),
      requestMethod: req.method(),
      status: outcome.response.status(),
    });
  }

  return outcome;
}

function gateFromSessionRouterResponse(res: Response, body: SessionRouterBody): Step6ArenaGate {
  const parsedJson = truncateForE2eLog(JSON.stringify(body));
  logE2eForcedElite("gate:evaluate", {
    responseUrl: res.url(),
    requestUrl: res.request().url(),
    status: res.status(),
    parsedJson,
    parsedSummary: summarizeSessionBodyForLog(body),
    eliteRecognized:
      res.status() === 200 &&
      Boolean(body.scenario?.scenarioId) &&
      Boolean(body.scenario?.eliteSetup),
  });

  let gate: Step6ArenaGate;
  if (res.status() !== 200) {
    gate = {
      proceed: false,
      reason: "session-router-non-ok",
      detail: `HTTP ${res.status}`,
    };
  } else if (!body.scenario?.scenarioId) {
    gate = {
      proceed: false,
      reason: "no-scenario",
      detail: body.error ?? "no scenario in session response",
    };
  } else if (!body.scenario.eliteSetup) {
    gate = {
      proceed: false,
      reason: "non-elite-scenario",
      detail: body.scenario.scenarioId,
    };
  } else {
    gate = { proceed: true, sessionBody: body, response: res };
  }

  logE2eForcedElite("gate:outcome", {
    gate: summarizeStep6GateForLog(gate),
    failureBranch:
      gate.proceed === false
        ? gate.reason === "session-router-non-ok"
          ? "session-router-non-ok"
          : gate.reason === "no-scenario"
            ? "no-scenario-id"
            : gate.reason === "non-elite-scenario"
              ? "missing-eliteSetup-on-scenario"
              : gate.reason
        : null,
  });

  return gate;
}

/** Routing outcomes that are valid but do not support elite step 6 — use `test.skip`, not failure. */
export type Step6RoutingSkipReason =
  | "beginner-path"
  | "non-elite-scenario"
  | "no-scenario"
  | "elite-flow-not-reached"
  | "session-router-non-ok";

export type Step6ArenaGate =
  | { proceed: true; sessionBody: SessionRouterBody; response: Response }
  | { proceed: false; reason: Step6RoutingSkipReason; detail?: string };

/**
 * Opens `/en/bty-arena`, waits for session router GET, returns whether elite step 6 UI can appear.
 * Treats beginner gate and non-elite catalog assignment as **skip** candidates, not errors.
 */
export async function openArenaAndGateEliteStep6(page: Page): Promise<Step6ArenaGate> {
  const outcome = await waitForSessionRouterGetOrBeginnerAfter(
    page,
    () =>
      page.goto(`/${ARENA_STEP6_LOCALE}/bty-arena`, { waitUntil: "domcontentloaded", timeout: 120_000 }),
    "openArena",
  );
  await assertNotRedirectedToLoginOrThrow(page, page.url());

  if (outcome.kind === "beginner" || page.url().includes("/bty-arena/beginner")) {
    const gate: Step6ArenaGate = { proceed: false, reason: "beginner-path", detail: page.url() };
    logE2eForcedElite("openArena:final", { gate: summarizeStep6GateForLog(gate), winnerNote: "beginner-path" });
    return gate;
  }

  const body = (await outcome.response.json().catch(() => ({}))) as SessionRouterBody;
  const gate = gateFromSessionRouterResponse(outcome.response, body);
  logE2eForcedElite("openArena:final", { gate: summarizeStep6GateForLog(gate) });
  return gate;
}

/**
 * After `clearArenaStorage` + reload, re-fetch session and gate elite again (fresh run for elite tests).
 */
export async function reloadArenaFreshAndGateEliteStep6(page: Page): Promise<Step6ArenaGate> {
  logE2eForcedElite("reloadFresh:enter", { url: page.url() });
  await clearArenaStorage(page);
  logE2eForcedElite("reloadFresh:after-clear-storage", { url: page.url() });

  const outcome = await waitForSessionRouterGetOrBeginnerAfter(
    page,
    () => page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 }),
    "reloadFresh",
  );
  await assertNotRedirectedToLoginOrThrow(page, page.url());

  if (outcome.kind === "beginner" || page.url().includes("/bty-arena/beginner")) {
    const gate: Step6ArenaGate = { proceed: false, reason: "beginner-path", detail: page.url() };
    logE2eForcedElite("reloadFresh:final", { gate: summarizeStep6GateForLog(gate), winnerNote: "beginner-path" });
    return gate;
  }

  const body = (await outcome.response.json().catch(() => ({}))) as SessionRouterBody;
  const gate = gateFromSessionRouterResponse(outcome.response, body);
  logE2eForcedElite("reloadFresh:final", { gate: summarizeStep6GateForLog(gate) });
  return gate;
}

/**
 * `goto` → clear persisted arena state → `reload` → gate elite (same as legacy `openCanonicalArenaFreshEliteCheck`).
 */
export async function prepareFreshArenaSessionElite(page: Page): Promise<Step6ArenaGate> {
  logE2eForcedElite("prepare:enter", { url: page.url() });

  await page.goto(`/${ARENA_STEP6_LOCALE}/bty-arena`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await assertNotRedirectedToLoginOrThrow(page, page.url());

  logE2eForcedElite("prepare:after-goto-domcontentloaded", { url: page.url() });

  // Harden: client redirect to beginner can follow domcontentloaded; wait for load then re-check.
  await page.waitForLoadState("load", { timeout: 30_000 }).catch(() => {});
  logE2eForcedElite("prepare:after-load-state", { url: page.url() });

  if (page.url().includes("/bty-arena/beginner")) {
    const gate: Step6ArenaGate = { proceed: false, reason: "beginner-path", detail: page.url() };
    logE2eForcedElite("prepare:final", {
      gate: summarizeStep6GateForLog(gate),
      winnerNote: "beginner-path-before-reload",
    });
    return gate;
  }

  const gate = await reloadArenaFreshAndGateEliteStep6(page);
  logE2eForcedElite("prepare:final", { gate: summarizeStep6GateForLog(gate) });
  return gate;
}

export async function clearArenaStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem("btyArenaState:v1");
    } catch {
      /* ignore */
    }
  });
}

export function skipMessageForGate(reason: Step6RoutingSkipReason, detail?: string): string {
  const d = detail ? ` (${detail})` : "";
  switch (reason) {
    case "beginner-path":
      return `Onboarding / beginner route — elite step 6 not in context${d}`;
    case "non-elite-scenario":
      return `Session router assigned non-elite scenario${d}`;
    case "no-scenario":
      return `No scenario from session router${d}`;
    case "elite-flow-not-reached":
      return `Elite UI not reached within timeout${d}`;
    case "session-router-non-ok":
      return `Session router returned non-200 (fixture hygiene / pending contract / pipeline mismatch?)${d}`;
    default:
      return `Routing skip: ${reason}${d}`;
  }
}

/**
 * If loading is visible, submit must not exist (confirmed loading context only).
 */
export async function assertOptionalLoadingInvariants(page: Page): Promise<void> {
  const loading = page.getByTestId("elite-action-contract-loading");
  if (await loading.isVisible({ timeout: 4_000 }).catch(() => false)) {
    await expect(page.getByTestId("elite-action-contract-submit")).toHaveCount(0);
    await expect(page.getByTestId("elite-action-contract")).toHaveCount(0);
  }
}
