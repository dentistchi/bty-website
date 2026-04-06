import type { Page, Route } from "@playwright/test";
import type { Scenario } from "../../src/lib/bty/scenario/types";
import { FORCED_ELITE_SCENARIO } from "../fixtures/forced-elite-scenario";
import { logE2eForcedElite, summarizeSessionBodyForLog } from "./arena-step6-forced-elite-debug";

/** Matches both Pipeline L and N session router GETs (for `page.route` / `page.unroute`). */
export const SESSION_ROUTER_URL_RE = /\/api\/arena\/(session\/next|n\/session)/;

export type ForcedEliteSessionRouterOptions = {
  /** Defaults to {@link FORCED_ELITE_SCENARIO} (A/B escalation). Use {@link FORCED_ELITE_SCENARIO_LEGACY_NO_ESCALATION} for legacy step 3–4 UI. */
  scenario?: Scenario;
};

/**
 * Intercepts GET session router responses and injects an elite `scenario` (default {@link FORCED_ELITE_SCENARIO}) so the client always
 * receives `eliteSetup` regardless of DB/router assignment.
 *
 * - **200**: merges/replaces `scenario` with the fixture; preserves `recallPrompt` / `mirrors` when present.
 * - **409** / other statuses: passed through unchanged (pending action contract or suspension will fail the run —
 *   resolve data or use a clean E2E user).
 *
 * Register **before** any navigation that triggers the session router. Call the returned `uninstall` in `finally`.
 */
export async function installForcedEliteSessionRouter(
  page: Page,
  options?: ForcedEliteSessionRouterOptions,
): Promise<{ uninstall: () => Promise<void> }> {
  const scenario = options?.scenario ?? FORCED_ELITE_SCENARIO;
  const handler = async (route: Route) => {
    const reqUrl = route.request().url();
    const method = route.request().method();

    if (method !== "GET") {
      logE2eForcedElite("intercept:skip-non-get", { requestUrl: reqUrl, method });
      await route.continue();
      return;
    }

    logE2eForcedElite("intercept:handler-get", {
      requestUrl: reqUrl,
      method,
      note: "playwright route handler invoked for this request",
    });

    const response = await route.fetch();
    const status = response.status();

    if (status !== 200) {
      logE2eForcedElite("intercept:passthrough-non-200", {
        requestUrl: reqUrl,
        upstreamStatus: status,
        action: "fulfill-original-response",
      });
      await route.fulfill({ response });
      return;
    }

    try {
      const text = await response.text();
      const json = JSON.parse(text) as Record<string, unknown>;
      logE2eForcedElite("intercept:upstream-200-body", {
        requestUrl: reqUrl,
        upstreamSummary: summarizeSessionBodyForLog({
          ok: json.ok as boolean | undefined,
          error: typeof json.error === "string" ? json.error : undefined,
          scenario: json.scenario as { scenarioId?: string; eliteSetup?: unknown } | undefined,
        }),
      });
      json.ok = true;
      json.scenario = scenario;
      if (json.scenarioRoute == null || json.scenarioRoute === "") {
        json.scenarioRoute = "elite";
      }
      const bodyOut = JSON.stringify(json);
      logE2eForcedElite("intercept:fulfill-merged", {
        requestUrl: reqUrl,
        injectedScenarioId: scenario.scenarioId,
        injectedHasEliteSetup: Boolean(scenario.eliteSetup),
        responseBodyPreview: bodyOut.length > 800 ? `${bodyOut.slice(0, 800)}…` : bodyOut,
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: bodyOut,
      });
    } catch (e) {
      logE2eForcedElite("intercept:passthrough-parse-error", {
        requestUrl: reqUrl,
        error: e instanceof Error ? e.message : String(e),
        action: "fulfill-original-response",
      });
      await route.fulfill({ response });
    }
  };

  await page.route(SESSION_ROUTER_URL_RE, handler);

  return {
    uninstall: async () => {
      await page.unroute(SESSION_ROUTER_URL_RE);
    },
  };
}
