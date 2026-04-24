/**
 * Deterministic elite path: session router response is intercepted so `scenario.eliteSetup` is always present.
 * **Canonical E2E for Step 7 after contract submit:** real `submit-validation` + `elite-execution-gate` without stubbing
 * (default forced scenario). The policy file (`elite-action-contract.spec.ts`) uses the **real** router where outcomes vary.
 * Complements state-aware tests in `elite-action-contract.spec.ts` (does not replace skip-based coverage).
 *
 * This file does **not** use `test.skip` for elite gating — `expect(gate.proceed).toBe(true)` fails if assignment diverges.
 * **Beginner path** (`gate.reason === "beginner-path"`) fails fast with an explicit fixture message (not an intercept issue).
 *
 * **Step 6 policy:** After mirror, the app may show either **`elite-action-contract`** (draft form) or
 * **`elite-action-contract-pattern-threshold-continue`** (pattern-threshold gate). Both are valid; this suite asserts the
 * branch that actually renders, then either runs the full contract submit flow or continues to **`elite-execution-gate`**.
 *
 * **No-`escalationBranches` fixture:** `EliteArenaPostChoiceBlock` does not render legacy confirm UI; it shows
 * **`elite-v2-runtime-error-escalation_not_configured`**. The legacy test asserts that surface and exits (no mirror/step 6).
 *
 * Debug session-router + gate: `E2E_DEBUG_FORCED_ELITE=1 …`
 * Debug Step 6 navigation: `E2E_DEBUG_ELITE_ACTION_NAV=1 …`
 * Failed POST /api/action-contracts (status ≥ 400) always logs `[e2e-step6-action-contract-post-FAILURE]` with JSON body.
 * Verbose log for all statuses: `E2E_LOG_ACTION_CONTRACT_POST=1`
 * Server: set `BTY_ACTION_CONTRACT_ROUTE_DEBUG=1` on the Next deploy to include `debug` in error JSON bodies.
 *
 * **Post-submit:** Success is **`elite-execution-gate` visible** (Step 7), not submit `aria-busy="false"` first — same model as policy specs.
 * **Parallelism:** Projects **`bty-loop-step6-policy`** / **`bty-loop-step6-forced`** use **separate** contract users; each uses `workers: 1` and (by default) **depends on** **`bty-loop`** + **`chromium`**. Fast local-only:
 * **`npm run test:e2e:bty-step6:isolated`** (`PW_STEP6_ISOLATED=1`; DB must be quiescent).
 */
import { expect, test, type Page } from "@playwright/test";
import { cleanupStaleE2EActionContractsBeforeTest } from "../helpers/cleanup-action-contracts";
import {
  assertAuthCookiesPresentOrThrow,
  prepareFreshArenaSessionElite,
  type Step6ArenaGate,
} from "../helpers/arena-step6-policy";
import {
  assertE2eContractCiPasswordOrThrow,
  E2E_CONTRACT_EMAILS,
  E2E_CONTRACT_USER_IDS,
} from "../helpers/three-contract-users";
import { FORCED_ELITE_SCENARIO_LEGACY_NO_ESCALATION } from "../fixtures/forced-elite-scenario";
import { installForcedEliteSessionRouter } from "../helpers/arena-step6-forced-elite";
import { summarizeStep6GateForLog } from "../helpers/arena-step6-forced-elite-debug";
import {
  fillActionContractFields,
  navigateEliteArenaToActionContractStep,
  type EliteStep6PostMirrorOutcome,
} from "../helpers/elite-action-contract-arena";
import { installE2eActionContractPostResponseLogger } from "../helpers/elite-action-contract-arena-debug";

const SUBMIT_SETTLE_MS = 180_000;

/** Fixture / API state: `requiresBeginnerPath` routes to `/bty-arena/beginner` — session-router intercept never applies there. */
const FORCED_ELITE_BEGINNER_FIXTURE_ERROR =
  "Forced elite test requires an arena-ready, non-beginner fixture account. Current account is routed to beginner path.";

function assertForcedEliteGateNotBeginnerFixture(gate: Step6ArenaGate): void {
  if (!gate.proceed && gate.reason === "beginner-path") {
    throw new Error(FORCED_ELITE_BEGINNER_FIXTURE_ERROR);
  }
}

/** Intercept only merges elite scenario when upstream session GET is 200; otherwise see `session-router-non-ok`. */
function assertForcedEliteGateProceed(gate: Step6ArenaGate): void {
  expect(
    gate.proceed,
    `[forced-elite gate] expected proceed after prepareFreshArenaSessionElite; ${JSON.stringify(summarizeStep6GateForLog(gate))}. With E2E_DEBUG_FORCED_ELITE=1, check logs: prepare:final, reloadFresh:race-winner, gate:evaluate, gate:outcome.`,
  ).toBe(true);
}

async function assertPatternThresholdGateRendered(page: Page): Promise<void> {
  const region = page.getByTestId("elite-action-contract-pattern-threshold-continue");
  await expect(region).toBeVisible();
  await expect(region).toHaveAttribute("role", "region");
  await expect(region.locator("#elite-action-contract-pattern-threshold-heading")).toBeVisible();
  await expect(page.getByTestId("elite-action-contract-pattern-threshold-continue-button")).toBeVisible();
  await expect(page.getByTestId("elite-action-contract")).toHaveCount(0);
  await expect(page.getByTestId("elite-action-contract-submit")).toHaveCount(0);
}

async function continuePatternThresholdToExecutionGate(page: Page): Promise<void> {
  await page.getByTestId("elite-action-contract-pattern-threshold-continue-button").click();
  await expect(page.getByTestId("elite-execution-gate")).toBeVisible({ timeout: 60_000 });
}

test.describe.configure({ mode: "serial" });

/** Elite arena client no longer includes mirror / action contract / execution gate; superseded by run-complete flow. */
test.describe.skip("Arena Step 6 — forced elite (deterministic)", () => {
  const cleanupUserId = E2E_CONTRACT_USER_IDS.step6Forced;
  const cleanupEmail = E2E_CONTRACT_EMAILS.step6Forced;

  test.beforeAll(() => {
    assertE2eContractCiPasswordOrThrow();
  });

  test.beforeEach(async ({ context, request }) => {
    await cleanupStaleE2EActionContractsBeforeTest(request, {
      userId: cleanupUserId,
      email: cleanupEmail,
      label: "step6-forced:E2E_STEP6_FORCED_USER:before",
    });
    await assertAuthCookiesPresentOrThrow(context);
  });

  test.afterEach(async ({ request }) => {
    await cleanupStaleE2EActionContractsBeforeTest(request, {
      userId: cleanupUserId,
      email: cleanupEmail,
      label: "step6-forced:E2E_STEP6_FORCED_USER:after",
    });
  });

  test("forced session router → Step 6: contract form **or** pattern-threshold; then submit flow **or** execution gate", async ({
    page,
  }) => {
    test.setTimeout(420_000);
    installE2eActionContractPostResponseLogger(page);

    const { uninstall } = await installForcedEliteSessionRouter(page);
    try {
      const gate = await prepareFreshArenaSessionElite(page);
      assertForcedEliteGateNotBeginnerFixture(gate);
      assertForcedEliteGateProceed(gate);

      const step6: EliteStep6PostMirrorOutcome = await navigateEliteArenaToActionContractStep(page);

      if (step6 === "elite-v2-escalation-blocked") {
        throw new Error("Forced default scenario must include escalationBranches (unexpected v2 block)");
      }
      if (step6 === "action-contract-init-error") {
        throw new Error("Unexpected action-contract-init-error without POST stub");
      }

      if (step6 === "pattern-threshold-gate") {
        await assertPatternThresholdGateRendered(page);
        await continuePatternThresholdToExecutionGate(page);
        return;
      }

      const form = page.getByTestId("elite-action-contract");
      await expect(form).toBeVisible();
      const submit = page.getByTestId("elite-action-contract-submit");
      await expect(submit).toBeEnabled();

      await fillActionContractFields(page);

      const patchPromise = page.waitForRequest(
        (req) =>
          req.method() === "PATCH" &&
          req.url().includes("/api/action-contracts/") &&
          !req.url().includes("/commit"),
      );
      const commitPromise = page.waitForRequest(
        (req) =>
          req.method() === "POST" && req.url().includes("/api/action-contracts/") && req.url().includes("/commit"),
      );
      const validationPromise = page.waitForRequest((req) =>
        req.url().includes("/api/bty/action-contract/submit-validation"),
      );

      await submit.click();

      await expect(submit).toHaveAttribute("aria-busy", "true", { timeout: 15_000 });
      await expect(submit).toBeDisabled();

      const reqPatch = await patchPromise;
      const reqCommit = await commitPromise;
      const reqVal = await validationPromise;

      expect(reqPatch.url()).toMatch(/\/api\/action-contracts\/[^/]+$/);
      expect(reqCommit.url()).toContain("/commit");
      expect(reqVal.url()).toContain("/submit-validation");

      await expect(page.getByTestId("elite-execution-gate")).toBeVisible({ timeout: SUBMIT_SETTLE_MS });
    } finally {
      await uninstall();
    }
  });

  test("forced router without escalationBranches → v2 step-3 error (no legacy post-confirm); no Step 6", async ({
    page,
  }) => {
    test.setTimeout(420_000);
    installE2eActionContractPostResponseLogger(page);

    const { uninstall } = await installForcedEliteSessionRouter(page, {
      scenario: FORCED_ELITE_SCENARIO_LEGACY_NO_ESCALATION,
    });
    try {
      const gate = await prepareFreshArenaSessionElite(page);
      assertForcedEliteGateNotBeginnerFixture(gate);
      assertForcedEliteGateProceed(gate);

      const step6 = await navigateEliteArenaToActionContractStep(page, { preStep3BranchSnapshot: true });

      if (step6 === "elite-v2-escalation-blocked") {
        await expect(page.locator('[data-testid^="elite-v2-runtime-error-"]').first()).toBeVisible();
        return;
      }

      if (step6 === "pattern-threshold-gate") {
        await assertPatternThresholdGateRendered(page);
        await continuePatternThresholdToExecutionGate(page);
        return;
      }
      if (step6 === "action-contract-init-error") {
        throw new Error("Unexpected action-contract-init-error without POST stub");
      }

      const form = page.getByTestId("elite-action-contract");
      await expect(form).toBeVisible();
    } finally {
      await uninstall();
    }
  });
});
