import { expect, test } from "@playwright/test";

/**
 * Manual-QA automation: JSON-only dev strip on `/en/bty-arena` (no session API).
 * Requires local `npm run dev` (Playwright webServer) with JSON catalog mode:
 * `NODE_ENV=development` or `NEXT_PUBLIC_BTY_DEV_BYPASS_AUTH=true`, and for unauth
 * access to `/en/bty-arena`, middleware bypass: `NEXT_PUBLIC_BTY_DEV_BYPASS_AUTH=true`
 * in non-production.
 *
 * Run without DB seed:
 * `PLAYWRIGHT_SKIP_GLOBAL_SETUP=1 npx playwright test e2e/arena/json-action-contract-draft.public.spec.ts --project=public`
 *
 * If webServer times out: free port **3000** (Playwright `baseURL` must match the dev server) or run
 * `PLAYWRIGHT_NO_WEB_SERVER=1` with `npm run dev` already listening on **3000**.
 */
const CORE_SCENARIOS = [
  "core_01_training_system_exposure",
  "core_02_new_doctor_reexposure_compromise_loop",
  "core_03_training_failure_hidden_as_performance_issue",
  "core_04_manager_neutrality_as_abandonment",
] as const;

test.describe.configure({ mode: "serial" });

test.describe("JSON-only Action Contract Draft (public / dev strip)", () => {
  test("core 01–04 AD1 draft + validation + save; AD2 shows NEXT_SCENARIO_READY only", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/en/bty-arena", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/en\/bty-arena(\/beginner)?$|\/en\/bty\/login/, { timeout: 30_000 });
    test.skip(
      page.url().includes("/bty/login"),
      "Redirected to login — set NEXT_PUBLIC_BTY_DEV_BYPASS_AUTH=true (non-prod) for /en/bty-arena without session.",
    );

    await expect(page.getByTestId("arena-dev-json-only-root")).toBeVisible({ timeout: 60_000 });
    let savedContractCount = 0;
    await page.route("**/api/arena/action-contracts", async (route) => {
      const body = route.request().postDataJSON() as { scenario_id?: string; who?: string; evidence?: string };
      expect(body.scenario_id).toBeTruthy();
      expect(body.who).toBe("Office manager");
      expect(body.evidence).toBe("Error log from past 4 weeks.");
      savedContractCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: `json-contract-${savedContractCount}`, status: "pending" }),
      });
    });

    for (const scenarioId of CORE_SCENARIOS) {
      await page.getByTestId("json-scenario-select").selectOption(scenarioId);
      await expect(page.getByTestId("arena-dev-json-only-root")).toBeVisible({ timeout: 30_000 });

      await expect(page.getByTestId("json-primary-panel")).toBeVisible();
      await page.getByTestId("json-primary-choice-A").click();

      await expect(page.getByTestId("json-tradeoff-panel")).toBeVisible({ timeout: 10_000 });
      await page.getByTestId("json-tradeoff-choice-X").click();

      await expect(page.getByTestId("json-action-decision-panel")).toBeVisible({ timeout: 10_000 });
      await page.getByTestId("json-action-choice-AD1").click();

      await expect(page.getByTestId("json-engine-action-required")).toBeVisible();
      await expect(page.getByTestId("json-engine-action-required")).toHaveAttribute("data-json-engine-state", "ACTION_REQUIRED");

      await page.getByTestId("json-placeholder-create-action-contract").click();
      await expect(page.getByTestId("json-action-contract-draft-panel")).toBeVisible();

      await page.getByTestId("json-contract-save-action").click();
      await expect(page.locator('[role="alert"]')).toHaveCount(4);

      await page.getByTestId("json-contract-who").fill("Office manager");
      await page.getByTestId("json-contract-what").fill("Document gaps and schedule leadership discussion.");
      await page.getByTestId("json-contract-when").fill("Within 48 hours");
      await page.getByTestId("json-contract-evidence").fill("Error log from past 4 weeks.");
      await page.getByTestId("json-contract-save-action").click();

      await expect(page.getByTestId("json-contract-save-success")).toBeVisible();
      await expect(page.getByTestId("json-contract-save-success")).toContainText("Action Contract saved");
      await expect(page.getByTestId("json-contract-save-success")).toContainText(`json-contract-${savedContractCount}`);
    }

    // AD2 path: NEXT_SCENARIO_READY, no contract draft UI.
    await page.getByTestId("json-scenario-select").selectOption("core_04_manager_neutrality_as_abandonment");
    await expect(page.getByTestId("arena-dev-json-only-root")).toBeVisible({ timeout: 30_000 });

    await expect(page.getByTestId("json-primary-panel")).toBeVisible();
    await page.getByTestId("json-primary-choice-A").click();
    await expect(page.getByTestId("json-tradeoff-panel")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("json-tradeoff-choice-X").click();
    await expect(page.getByTestId("json-action-decision-panel")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("json-action-choice-AD2").click();

    await expect(page.getByTestId("json-engine-next-scenario-ready")).toBeVisible();
    await expect(page.getByTestId("json-engine-next-scenario-ready")).toHaveAttribute("data-json-engine-state", "NEXT_SCENARIO_READY");
    await expect(page.getByTestId("json-placeholder-load-next-scenario")).toBeDisabled();
    await expect(page.getByTestId("json-action-contract-draft-panel")).toHaveCount(0);
    await expect(page.getByTestId("json-placeholder-create-action-contract")).toHaveCount(0);
  });
});
