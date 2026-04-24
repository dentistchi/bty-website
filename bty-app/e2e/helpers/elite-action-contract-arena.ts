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
  | "run-complete"
  | "action-contract-form"
  | "pattern-threshold-gate"
  /** `EliteArenaPostChoiceBlock` shows `elite-v2-runtime-error-*` (no usable `escalationBranches`). */
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
 * From `/en/bty-arena` with Elite scenario already loaded: complete steps 2→3→4, then **`elite-run-complete`** (minimal end screen).
 * Caller must have passed elite gate (`elite-step2-context` expected).
 *
 * Supports **escalation** (`escalationBranches`; step 3 API inline → `elite-forced-tradeoff-step`). Scenarios
 * without branches surface `elite-v2-runtime-error-escalation_not_configured` (**`elite-v2-escalation-blocked`**).
 *
 * Returns **`run-complete`** when the minimal post-step-4 UI is shown. Legacy mirror / action-contract / execution-gate
 * steps are no longer in the elite arena client.
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

  logEliteNav("wait:before", { wait: "elite-step2-context", url: page.url() });
  await expect(page.getByTestId("elite-step2-context")).toBeVisible({ timeout: 30_000 });
  await snapshot("wait:after", { wait: "elite-step2-context" });

  const primaryPick = page.getByTestId("elite-arena-primary-pick");
  await snapshot("click:before", { action: "elite-primary-one-tap" });
  await primaryPick.locator("button").first().click();
  await snapshot("click:after", { action: "elite-primary-one-tap" });

  const tradeoff = page.getByTestId("elite-forced-tradeoff-step");
  const v2EscalationNotConfigured = page.getByTestId("elite-v2-runtime-error-escalation_not_configured");
  const v2MissingBranch = page.getByTestId("elite-v2-runtime-error-missing_escalation_branch");
  const v2InvalidCost = page.getByTestId("elite-v2-runtime-error-invalid_second_choice_cost");
  const step4Branch = tradeoff.or(v2EscalationNotConfigured).or(v2MissingBranch).or(v2InvalidCost);

  if (options?.preStep3BranchSnapshot) {
    await logEliteNavPreStep3BranchSnapshot(page);
  }

  logEliteNav("wait:before", {
    wait: "elite-forced-tradeoff-step | elite-v2-runtime-error-*",
    url: page.url(),
    ...(isE2eDebugEliteActionNav() ? { orderedSignals: await orderedEliteFlowSignals(page) } : {}),
  });

  try {
    await expect(step4Branch).toBeVisible({ timeout: 90_000 });
  } catch (e) {
    await logEliteNavStep3BranchWaitFailure(page, "timeout: no second-choice branch (tradeoff or v2 error)");
    throw e;
  }
  await snapshot("wait:after", { wait: "elite-forced-tradeoff-step | elite-v2-runtime-error-*" });

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

  if (!(await tradeoff.isVisible().catch(() => false))) {
    await logEliteNavStep3BranchWaitFailure(page, "elite: expected elite-forced-tradeoff-step (v2 error already ruled out)");
    throw new Error(
      "Elite: expected elite-forced-tradeoff-step after primary one-tap (step 3 API runs inline).",
    );
  }

  logEliteNav("branch", { path: "forced-tradeoff" });
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
    wait: "elite-run-complete",
    url: page.url(),
    ...(isE2eDebugEliteActionNav() ? { orderedSignals: await orderedEliteFlowSignals(page) } : {}),
  });
  await expect(page.getByTestId("elite-run-complete")).toBeVisible({ timeout: 60_000 });
  await snapshot("wait:after", { wait: "elite-run-complete" });

  await assertOptionalLoadingInvariants(page);
  await snapshot("after:assertOptionalLoadingInvariants");

  logEliteNav("done", { outcome: "run-complete", url: page.url() });
  return "run-complete";
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
