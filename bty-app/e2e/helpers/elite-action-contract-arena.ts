import { expect, type Page } from "@playwright/test";
import { assertOptionalLoadingInvariants, ARENA_STEP6_LOCALE } from "./arena-step6-policy";
import {
  isE2eDebugEliteActionNav,
  logEliteNav,
  logEliteNavFinalDiagnosis,
  logEliteNavPreStep3BranchSnapshot,
  logEliteNavStep3BranchWaitFailure,
  orderedEliteFlowSignals,
  visibleEliteV2RuntimeErrorTestId,
} from "./elite-action-contract-arena-debug";

export { ARENA_STEP6_LOCALE };

/**
 * After mirror (step 5) → step 6, policy allows either:
 * - **`action-contract-form`** — `elite-action-contract` + draft from `POST /api/action-contracts`
 * - **`pattern-threshold-gate`** — `elite-action-contract-pattern-threshold-continue` (no draft; continue → execution gate)
 */
export type EliteStep6PostMirrorOutcome =
  | "action-contract-form"
  | "pattern-threshold-gate"
  /** `ElitePostChoiceFlow` shows `elite-v2-runtime-error-*` (no usable `escalationBranches` — legacy stance UI removed). */
  | "elite-v2-escalation-blocked"
  /** Step 6 draft POST failed; only returned when {@link NavigateEliteArenaToActionContractOptions.treatStep6InitErrorAsOutcome} is set. */
  | "action-contract-init-error";

export type NavigateEliteArenaToActionContractOptions = {
  /**
   * Log URL, `orderedSignals`, visible `data-testid`s under `arena-play-main`, and a text snippet **before** waiting for
   * step 3 (escalation or v2 error). Not gated on `E2E_DEBUG_ELITE_ACTION_NAV`.
   */
  preStep3BranchSnapshot?: boolean;
  /**
   * When true, `elite-action-contract-init-error` after mirror continue returns **`action-contract-init-error`** instead
   * of throwing (for stubbed `POST /api/action-contracts` tests).
   */
  treatStep6InitErrorAsOutcome?: boolean;
};

/**
 * From `/en/bty-arena` with Elite scenario already loaded: complete steps 2→3→4→5→6.
 * Caller must have passed elite gate (`elite-arena-setup` expected).
 *
 * Supports **escalation** (`escalationBranches` + `elite-escalation-step` / `elite-forced-tradeoff-step`). Scenarios
 * without branches no longer render legacy `elite-post-confirm` — `ElitePostChoiceFlow` surfaces
 * `elite-v2-runtime-error-escalation_not_configured` (returns **`elite-v2-escalation-blocked`**).
 *
 * ---
 * **Runtime: Step 6 surfaces** (`EliteActionContractStep.tsx`)
 *
 * - `ElitePostChoiceFlow` renders `EliteActionContractStep` when `step === 6`.
 * - While `POST /api/action-contracts` runs: **`elite-action-contract-loading`**.
 * - Success with contract id: **`elite-action-contract`** form.
 * - `gated: "pattern_threshold"`: **`elite-action-contract-pattern-threshold-continue`** (valid outcome — not the form).
 * - Missing `runId` / `primaryChoice` or POST failure: **`elite-action-contract-init-error`** → throws unless
   *   `treatStep6InitErrorAsOutcome` returns that outcome.
 * - Forced elite fixtures must satisfy **v2 escalation resolution** when using the escalation path (`elite-v2-runtime-error-*` otherwise).
 *
 * Debug: `E2E_DEBUG_ELITE_ACTION_NAV=1 npx playwright test …`
 */
export async function navigateEliteArenaToActionContractStep(
  page: Page,
  options?: NavigateEliteArenaToActionContractOptions,
): Promise<EliteStep6PostMirrorOutcome> {
  async function snapshot(phase: string, extra?: Record<string, unknown>): Promise<void> {
    if (!isE2eDebugEliteActionNav()) return;
    logEliteNav(phase, {
      url: page.url(),
      orderedSignals: await orderedEliteFlowSignals(page),
      ...extra,
    });
  }

  await snapshot("entry");

  logEliteNav("wait:before", { wait: "arena-play-main", url: page.url() });
  await expect(page.getByTestId("arena-play-main")).toBeVisible({ timeout: 120_000 });
  await snapshot("wait:after", { wait: "arena-play-main" });

  logEliteNav("wait:before", { wait: "elite-arena-setup", url: page.url() });
  await expect(page.getByTestId("elite-arena-setup")).toBeVisible({ timeout: 30_000 });
  await snapshot("wait:after", { wait: "elite-arena-setup" });

  const choiceGroup = page.getByRole("group", { name: /scenario choices/i });
  await snapshot("click:before", { action: "first-primary-choice-button" });
  await choiceGroup.locator("button").first().click();
  await snapshot("click:after", { action: "first-primary-choice-button" });

  await snapshot("click:before", { action: "confirm" });
  await page.getByRole("button", { name: /^confirm$/i }).click();
  await snapshot("click:after", { action: "confirm" });

  const escalation = page.getByTestId("elite-escalation-step");
  const v2EscalationNotConfigured = page.getByTestId("elite-v2-runtime-error-escalation_not_configured");
  const v2MissingBranch = page.getByTestId("elite-v2-runtime-error-missing_escalation_branch");
  const v2InvalidCost = page.getByTestId("elite-v2-runtime-error-invalid_second_choice_cost");
  const step3Branch = escalation.or(v2EscalationNotConfigured).or(v2MissingBranch).or(v2InvalidCost);

  if (options?.preStep3BranchSnapshot) {
    await logEliteNavPreStep3BranchSnapshot(page);
  }

  logEliteNav("wait:before", {
    wait: "elite-escalation-step | elite-v2-runtime-error-*",
    url: page.url(),
    ...(isE2eDebugEliteActionNav() ? { orderedSignals: await orderedEliteFlowSignals(page) } : {}),
  });

  try {
    await expect(step3Branch).toBeVisible({ timeout: 60_000 });
  } catch (e) {
    await logEliteNavStep3BranchWaitFailure(page, "timeout: no step-3 branch (escalation or v2 error)");
    throw e;
  }
  await snapshot("wait:after", { wait: "elite-escalation-step | elite-v2-runtime-error-*" });

  const v2VisibleId = await visibleEliteV2RuntimeErrorTestId(page);
  if (v2VisibleId) {
    logEliteNav("branch", {
      path: "elite-v2-runtime-error (no escalation dataset / invalid branch)",
      visibleEliteV2RuntimeErrorTestId: v2VisibleId,
      url: page.url(),
    });
    await snapshot("branch:v2-runtime-error", { testid: v2VisibleId });
    return "elite-v2-escalation-blocked";
  }

  if (!(await escalation.isVisible().catch(() => false))) {
    await logEliteNavStep3BranchWaitFailure(page, "elite step 3: expected elite-escalation-step (v2 error already ruled out)");
    throw new Error(
      "Elite step 3: expected elite-escalation-step after primary confirm. Legacy elite-post-confirm / elite-post-explain are not used for elite v2.",
    );
  }

  logEliteNav("branch", { path: "escalation+forced-tradeoff" });
  await snapshot("click:before", { action: "elite-escalation-continue" });
  await page.getByTestId("elite-escalation-continue").click();
  await snapshot("click:after", { action: "elite-escalation-continue" });

  logEliteNav("wait:before", {
    wait: "elite-forced-tradeoff-step",
    url: page.url(),
    ...(isE2eDebugEliteActionNav() ? { orderedSignals: await orderedEliteFlowSignals(page) } : {}),
  });
  await expect(page.getByTestId("elite-forced-tradeoff-step")).toBeVisible({ timeout: 60_000 });
  await snapshot("wait:after", { wait: "elite-forced-tradeoff-step" });

  await snapshot("click:before", { action: "elite-forced-tradeoff-X" });
  await page.getByTestId("elite-forced-tradeoff-X").click();
  await snapshot("click:after", { action: "elite-forced-tradeoff-X" });

  logEliteNav("wait:before", { wait: "elite-forced-tradeoff-Y disabled", url: page.url() });
  await expect(page.getByTestId("elite-forced-tradeoff-Y")).toBeDisabled();
  await snapshot("wait:after", { wait: "elite-forced-tradeoff-Y disabled" });

  logEliteNav("wait:before", {
    wait: "elite-pattern-mirror",
    url: page.url(),
    ...(isE2eDebugEliteActionNav() ? { orderedSignals: await orderedEliteFlowSignals(page) } : {}),
  });
  await expect(page.getByTestId("elite-pattern-mirror")).toBeVisible({ timeout: 60_000 });
  await snapshot("wait:after", { wait: "elite-pattern-mirror" });

  const mirrorContinue = page.getByTestId("elite-pattern-mirror").getByRole("button", { name: /^continue$/i });
  logEliteNav("wait:before", {
    wait: "mirror continue enabled",
    url: page.url(),
    ...(isE2eDebugEliteActionNav() ? { orderedSignals: await orderedEliteFlowSignals(page) } : {}),
  });
  await expect(mirrorContinue).toBeEnabled({ timeout: 120_000 });
  await snapshot("wait:after", { wait: "mirror continue enabled" });

  await snapshot("click:before", { action: "mirror-continue" });
  await mirrorContinue.click();
  await snapshot("click:after", { action: "mirror-continue" });

  await assertOptionalLoadingInvariants(page);
  await snapshot("after:assertOptionalLoadingInvariants");

  const loading = page.getByTestId("elite-action-contract-loading");
  const form = page.getByTestId("elite-action-contract");
  const patternThreshold = page.getByTestId("elite-action-contract-pattern-threshold-continue");
  const initError = page.getByTestId("elite-action-contract-init-error");

  try {
    logEliteNav("wait:before", {
      wait: "step6: loading | form | pattern-threshold | init-error",
      url: page.url(),
      ...(isE2eDebugEliteActionNav() ? { orderedSignals: await orderedEliteFlowSignals(page) } : {}),
    });
    await expect(loading.or(form).or(patternThreshold).or(initError)).toBeVisible({ timeout: 90_000 });
    await snapshot("wait:after", { wait: "step6: first surface" });
  } catch (e) {
    await logEliteNavFinalDiagnosis(page, "timeout: no step-6 surface after mirror continue");
    throw e;
  }

  if (await loading.isVisible().catch(() => false)) {
    logEliteNav("step6:loading-visible", { url: page.url() });
    try {
      logEliteNav("wait:before", {
        wait: "step6: resolve loading → form | pattern-threshold | init-error",
        url: page.url(),
        ...(isE2eDebugEliteActionNav() ? { orderedSignals: await orderedEliteFlowSignals(page) } : {}),
      });
      await expect(form.or(patternThreshold).or(initError)).toBeVisible({ timeout: 90_000 });
      await snapshot("wait:after", { wait: "step6: resolved from loading" });
    } catch (e) {
      await logEliteNavFinalDiagnosis(page, "timeout: loading did not resolve to form | pattern-threshold | init-error");
      throw e;
    }
  }

  if (await initError.isVisible().catch(() => false)) {
    if (options?.treatStep6InitErrorAsOutcome) {
      logEliteNav("done", { outcome: "action-contract-init-error", url: page.url() });
      await snapshot("step6:outcome-init-error");
      return "action-contract-init-error";
    }
    await logEliteNavFinalDiagnosis(page, "elite-action-contract-init-error visible");
    throw new Error(
      "Step 6 init error (POST /api/action-contracts failed or missing runId/primaryChoice) — see [e2e-elite-nav] final-diagnosis",
    );
  }

  if (await patternThreshold.isVisible().catch(() => false)) {
    logEliteNav("done", { outcome: "pattern-threshold-gate", url: page.url() });
    await snapshot("step6:outcome-pattern-threshold");
    return "pattern-threshold-gate";
  }

  try {
    logEliteNav("wait:before", {
      wait: "elite-action-contract (form)",
      url: page.url(),
      ...(isE2eDebugEliteActionNav() ? { orderedSignals: await orderedEliteFlowSignals(page) } : {}),
    });
    await expect(form).toBeVisible({ timeout: 15_000 });
    await snapshot("wait:after", { wait: "elite-action-contract (form)" });
    logEliteNav("done", { outcome: "action-contract-form", url: page.url() });
    return "action-contract-form";
  } catch (e) {
    await logEliteNavFinalDiagnosis(page, "expected contract form but step 6 surface mismatch");
    throw e;
  }
}

/** Valid Layer 1 sample (see `layer1Rules.ts`). */
export const E2E_ACTION_CONTRACT_FIELDS = {
  who: "Alex Kim",
  what: "schedule a documented review with the regional director",
  how: "in person at the regional office with email confirmation",
  when: "Friday March 15, 2026 at 10:00am",
} as const;

export async function fillActionContractFields(page: Page): Promise<void> {
  const region = page.getByTestId("elite-action-contract");
  const { who, what, how, when } = E2E_ACTION_CONTRACT_FIELDS;
  const textareas = region.locator("textarea");
  await textareas.nth(0).fill(who);
  await textareas.nth(1).fill(what);
  await textareas.nth(2).fill(when);
  await textareas.nth(3).fill(how);
}
