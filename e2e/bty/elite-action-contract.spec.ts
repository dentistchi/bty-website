/**
 * Arena Step 6 — Action Contract (state-aware policy).
 *
 * Fail fast: missing E2E_EMAIL/E2E_PASSWORD (beforeAll), empty auth cookies, login redirect.
 * Skip (valid routing): beginner path, non-elite scenario, no scenario, elite UI not reached.
 * Loading skeleton is optional; when visible, submit is absent.
 * **Step 6:** After mirror, policy may show the contract form or the pattern-threshold gate — tests that require the form skip when the gate path is taken.
 * **Elite v2 step 3:** Requires non-empty `escalationBranches`; otherwise UI shows `elite-v2-runtime-error-*` (no `elite-post-confirm` / `elite-post-explain`).
 *
 * **Router split:** The **real** session router does **not** guarantee `submit-validation` → `approve`|`escalate`; outcomes are validator-dependent.
 * - **Outcome-dependent policy test** below asserts correct UI for each terminal type (Step 7 vs stay on Step 6).
 * - **Deterministic Step 7 “happy path”** lives in `elite-action-contract.forced-elite.spec.ts` (intercepted router) and in **`stubbed submit-validation approve`** here.
 */
import { expect, test } from "@playwright/test";
import { cleanupStaleE2EActionContractsBeforeTest } from "../helpers/cleanup-action-contracts";
import {
  assertAuthCookiesPresentOrThrow,
  openArenaAndGateEliteStep6,
  prepareFreshArenaSessionElite,
  skipMessageForGate,
  type Step6ArenaGate,
} from "../helpers/arena-step6-policy";
import {
  assertE2eContractCiPasswordOrThrow,
  E2E_CONTRACT_EMAILS,
  E2E_CONTRACT_USER_IDS,
} from "../helpers/three-contract-users";
import {
  fillActionContractFields,
  navigateEliteArenaToActionContractStep,
} from "../helpers/elite-action-contract-arena";
import {
  dumpPolicyStep6HappyPathFailureDiagnostics,
  installE2eActionContractPostResponseLogger,
} from "../helpers/elite-action-contract-arena-debug";

const VALIDATOR_IDLE_MS = 180_000;

function skipUnlessEliteGate(gate: Step6ArenaGate): void {
  if (gate.proceed) return;
  test.skip(true, skipMessageForGate(gate.reason, gate.detail));
}

test.describe.configure({ mode: "serial" });

/** Elite arena client no longer includes mirror / action contract / execution gate; superseded by run-complete flow. */
test.describe.skip("Arena Step 6 — Action Contract (policy)", () => {
  const cleanupUserId = E2E_CONTRACT_USER_IDS.step6Policy;
  const cleanupEmail = E2E_CONTRACT_EMAILS.step6Policy;

  test.beforeAll(() => {
    assertE2eContractCiPasswordOrThrow();
  });

  test.beforeEach(async ({ context, request }) => {
    await cleanupStaleE2EActionContractsBeforeTest(request, {
      userId: cleanupUserId,
      email: cleanupEmail,
      label: "step6-policy:E2E_STEP6_POLICY_USER:before",
    });
    await assertAuthCookiesPresentOrThrow(context);
  });

  test.afterEach(async ({ request }) => {
    await cleanupStaleE2EActionContractsBeforeTest(request, {
      userId: cleanupUserId,
      email: cleanupEmail,
      label: "step6-policy:E2E_STEP6_POLICY_USER:after",
    });
  });

  test("real session router: PATCH → commit → submit-validation; Step 7 only when outcome is approve|escalate", async ({
    page,
  }) => {
    test.setTimeout(360_000);
    installE2eActionContractPostResponseLogger(page);

    const gate = await prepareFreshArenaSessionElite(page);
    skipUnlessEliteGate(gate);

    const step6Outcome = await navigateEliteArenaToActionContractStep(page);
    if (step6Outcome === "pattern-threshold-gate") {
      test.skip(
        true,
        "Step 6 resolved to pattern-threshold gate — this test targets the action-contract form path only",
      );
      return;
    }
    if (step6Outcome === "elite-v2-escalation-blocked") {
      test.skip(
        true,
        "Elite v2 blocked at step 3 — scenario missing valid escalationBranches (no legacy stance path in UI)",
      );
      return;
    }
    if (step6Outcome === "action-contract-init-error") {
      throw new Error("Unexpected action-contract-init-error (no POST stub)");
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
      (req) => req.method() === "POST" && req.url().includes("/api/action-contracts/") && req.url().includes("/commit"),
    );
    const validationResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/api/bty/action-contract/submit-validation") &&
        r.request().method() === "POST",
    );

    await submit.click();

    await expect(submit).toHaveAttribute("aria-busy", "true", { timeout: 15_000 });
    await expect(submit).toBeDisabled();
    await expect(submit).toContainText(/submitting/i);

    const reqPatch = await patchPromise;
    const reqCommit = await commitPromise;
    const valResp = await validationResponsePromise;

    expect(reqPatch.url(), "PATCH should precede commit").toMatch(/\/api\/action-contracts\/[^/]+$/);
    expect(reqCommit.url()).toContain("/commit");
    expect(valResp.url()).toContain("/submit-validation");

    const valJson = (await valResp.json()) as { outcome?: string; layer1_errors?: unknown };
    console.log(`[e2e-policy-step6] submit-validation (real router): ${JSON.stringify(valJson)}`);
    await test.info().attach("policy-submit-validation-response.json", {
      body: Buffer.from(JSON.stringify(valJson, null, 2), "utf-8"),
      contentType: "application/json",
    });
    expect(valResp.ok(), `submit-validation HTTP ${valResp.status()}`).toBeTruthy();

    const outcome = valJson.outcome;
    expect(outcome === "approve" || outcome === "escalate" || outcome === "revise" || outcome === "reject").toBe(true);

    const gateLocator = page.getByTestId("elite-execution-gate");

    if (outcome === "approve" || outcome === "escalate") {
      try {
        await expect(gateLocator).toBeVisible({ timeout: VALIDATOR_IDLE_MS });
      } catch (e) {
        const diag = await dumpPolicyStep6HappyPathFailureDiagnostics(page);
        console.error(`[e2e-policy-step6] terminal outcome but no Step 7:\n${diag}`);
        await test.info().attach("policy-step6-terminal-outcome-diagnostics.json", {
          body: Buffer.from(diag, "utf-8"),
          contentType: "application/json",
        });
        throw e;
      }
      return;
    }

    await expect(form).toBeVisible();
    await expect(gateLocator).toHaveCount(0);
    if (outcome === "revise") {
      await expect(form.getByRole("alert")).toBeVisible({ timeout: 15_000 });
    } else if (outcome === "reject") {
      await expect(form.getByRole("status")).toBeVisible({ timeout: 15_000 });
    }
  });

  test("policy navigation + stubbed submit-validation approve → execution gate (deterministic Step 7)", async ({
    page,
  }) => {
    test.setTimeout(360_000);
    installE2eActionContractPostResponseLogger(page);

    const gate = await prepareFreshArenaSessionElite(page);
    skipUnlessEliteGate(gate);

    const step6Outcome = await navigateEliteArenaToActionContractStep(page);
    if (step6Outcome === "pattern-threshold-gate") {
      test.skip(
        true,
        "Step 6 resolved to pattern-threshold gate — stubbed validation test needs the contract form",
      );
      return;
    }
    if (step6Outcome === "elite-v2-escalation-blocked") {
      test.skip(
        true,
        "Elite v2 blocked at step 3 — stubbed validation test needs escalationBranches",
      );
      return;
    }
    if (step6Outcome === "action-contract-init-error") {
      throw new Error("Unexpected action-contract-init-error (no POST stub)");
    }

    await page.route("**/api/bty/action-contract/submit-validation", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ outcome: "approve" }),
      });
    });

    try {
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
      const validationResponsePromise = page.waitForResponse(
        (r) =>
          r.url().includes("/api/bty/action-contract/submit-validation") &&
          r.request().method() === "POST",
      );

      await submit.click();
      await expect(submit).toHaveAttribute("aria-busy", "true", { timeout: 15_000 });

      await patchPromise;
      await commitPromise;
      const valResp = await validationResponsePromise;
      const valJson = (await valResp.json()) as { outcome?: string };
      expect(valJson.outcome).toBe("approve");

      await expect(page.getByTestId("elite-execution-gate")).toBeVisible({ timeout: VALIDATOR_IDLE_MS });
    } finally {
      await page.unroute("**/api/bty/action-contract/submit-validation");
    }
  });

  test("init failure: POST /api/action-contracts stubbed before mirror continue → init error; no form", async ({
    page,
  }) => {
    test.setTimeout(360_000);

    const gate = await prepareFreshArenaSessionElite(page);
    skipUnlessEliteGate(gate);

    await page.route("**/api/action-contracts", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "service_unavailable" }),
        });
        return;
      }
      await route.continue();
    });

    try {
      const step6Outcome = await navigateEliteArenaToActionContractStep(page, {
        treatStep6InitErrorAsOutcome: true,
      });

      if (step6Outcome === "elite-v2-escalation-blocked") {
        test.skip(true, "Elite v2 blocked at step 3 — init failure test needs escalationBranches-enabled scenario");
        return;
      }
      if (step6Outcome === "pattern-threshold-gate") {
        test.skip(
          true,
          "Step 6 pattern-threshold gate — init failure test asserts POST stub on draft path after mirror",
        );
        return;
      }

      expect(step6Outcome, "stubbed POST /api/action-contracts should surface elite-action-contract-init-error").toBe(
        "action-contract-init-error",
      );

      await expect(page.getByTestId("elite-action-contract-init-error")).toBeVisible();
      await expect(page.getByTestId("elite-action-contract-init-error")).toHaveAttribute("role", "alert");
      await expect(page.getByTestId("elite-action-contract")).toHaveCount(0);
      await expect(page.getByTestId("elite-action-contract-submit")).toHaveCount(0);
    } finally {
      await page.unroute("**/api/action-contracts");
    }
  });

  test("contract_not_found: first PATCH 404 once → recreate POST → succeeds (routes registered before submit)", async ({
    page,
  }) => {
    test.setTimeout(360_000);
    installE2eActionContractPostResponseLogger(page);

    const gate = await prepareFreshArenaSessionElite(page);
    skipUnlessEliteGate(gate);

    const step6Outcome = await navigateEliteArenaToActionContractStep(page);
    if (step6Outcome === "pattern-threshold-gate") {
      test.skip(
        true,
        "Step 6 pattern-threshold gate — contract_not_found test requires the action-contract form",
      );
      return;
    }
    if (step6Outcome === "elite-v2-escalation-blocked") {
      test.skip(
        true,
        "Elite v2 blocked at step 3 — contract_not_found test requires escalationBranches",
      );
      return;
    }
    if (step6Outcome === "action-contract-init-error") {
      throw new Error("Unexpected action-contract-init-error (no POST stub)");
    }
    await fillActionContractFields(page);

    let postCreateDuringSubmit = 0;
    const onRequest = (req: { method(): string; url(): string }) => {
      if (req.method() !== "POST") return;
      const pathname = new URL(req.url()).pathname.replace(/\/$/, "") || "/";
      if (pathname === "/api/action-contracts") {
        postCreateDuringSubmit += 1;
      }
    };
    page.on("request", onRequest);

    let patch404Once = true;
    await page.route("**/api/action-contracts/*", async (route) => {
      const req = route.request();
      if (req.method() !== "PATCH") {
        await route.continue();
        return;
      }
      if (!patch404Once) {
        await route.continue();
        return;
      }
      patch404Once = false;
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "contract_not_found", message: "No action contract for this id and user." }),
      });
    });

    try {
      await page.getByTestId("elite-action-contract-submit").click();
      await page.waitForRequest((req) => req.url().includes("/submit-validation"), { timeout: VALIDATOR_IDLE_MS });
      expect(postCreateDuringSubmit, "one recreate POST after first PATCH 404").toBe(1);
    } finally {
      page.off("request", onRequest);
      await page.unroute("**/api/action-contracts/*");
    }
  });

  test("non-elite: skip elite step 6 assertions when session router does not assign eliteSetup", async ({ page }) => {
    test.setTimeout(180_000);

    const gate = await openArenaAndGateEliteStep6(page);
    if (gate.proceed) {
      test.skip(true, "Session router returned elite scenario — non-elite branch not applicable for this run");
    }

    if (gate.reason === "beginner-path" || gate.reason === "no-scenario") {
      test.skip(true, skipMessageForGate(gate.reason, gate.detail));
    }

    await expect(page.getByTestId("elite-arena-setup")).toHaveCount(0);
    await expect(page.getByTestId("elite-action-contract")).toHaveCount(0);
  });
});
