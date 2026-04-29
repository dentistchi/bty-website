/**
 * Opt-in navigation diagnostics for `navigateEliteArenaToActionContractStep`.
 * Enable: `E2E_DEBUG_ELITE_ACTION_NAV=1` (or `true`).
 *
 * POST /api/action-contracts response body logging (Playwright output):
 * `E2E_LOG_ACTION_CONTRACT_POST=1`
 */
import type { Page } from "@playwright/test";

export function isE2eDebugEliteActionNav(): boolean {
  return (
    process.env.E2E_DEBUG_ELITE_ACTION_NAV === "1" || process.env.E2E_DEBUG_ELITE_ACTION_NAV === "true"
  );
}

function isE2eLogActionContractPost(): boolean {
  const v = process.env.E2E_LOG_ACTION_CONTRACT_POST?.trim().toLowerCase();
  return v === "1" || v === "true";
}

/**
 * Registers a listener for POST `/api/action-contracts` (draft create).
 * - **Always** `console.error` with `[e2e-step6-action-contract-post-FAILURE]` when `status >= 400` (Step 6 init triage).
 * - With `E2E_LOG_ACTION_CONTRACT_POST=1`, also `console.log` every response for that POST.
 */
export function installE2eActionContractPostResponseLogger(page: Page): void {
  page.on("response", (response) => {
    const req = response.request();
    if (req.method() !== "POST") return;
    let path: string;
    try {
      path = new URL(req.url()).pathname.replace(/\/$/, "") || "/";
    } catch {
      return;
    }
    if (path !== "/api/action-contracts") return;

    void (async () => {
      const status = response.status();
      const text = await response.text().catch(() => "");
      let body: unknown = text;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text.length > 800 ? `${text.slice(0, 800)}…` : text;
      }
      const payload = { status, path, body, url: req.url() };
      if (status >= 400) {
        console.error(`[e2e-step6-action-contract-post-FAILURE] ${JSON.stringify(payload)}`);
      }
      if (isE2eLogActionContractPost()) {
        console.log(`[e2e-action-contract-post] ${JSON.stringify(payload)}`);
      }
    })();
  });
}

export function logEliteNav(phase: string, data: Record<string, unknown> = {}): void {
  if (!isE2eDebugEliteActionNav()) return;
  console.log(`[e2e-elite-nav] ${JSON.stringify({ phase, ts: new Date().toISOString(), ...data })}`);
}

/** Visible `elite-v2-runtime-error-*` testid, if any (EliteArenaPostChoiceBlock when branches missing/invalid). */
export async function visibleEliteV2RuntimeErrorTestId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const main = document.querySelector('[data-testid="arena-play-main"]');
    const root = main ?? document.body;
    for (const el of root.querySelectorAll("[data-testid]")) {
      const id = el.getAttribute("data-testid");
      if (!id || !id.startsWith("elite-v2-runtime-error-")) continue;
      const html = el as HTMLElement;
      try {
        if (typeof html.checkVisibility === "function") {
          if (!html.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
        } else {
          const r = html.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
        }
        return id;
      } catch {
        continue;
      }
    }
    return null;
  });
}

/**
 * Single-line visibility flags in the order the runner expects the elite flow to progress.
 * `2b` / `3b` legacy testids are forensics only — elite v2 flow uses escalation + forced tradeoff or v2 runtime errors.
 */
export async function orderedEliteFlowSignals(page: Page): Promise<Record<string, boolean>> {
  const choiceGroup = page.getByRole("group", { name: /scenario choices/i });
  const [
    primaryChoices,
    escalation,
    legacyPostConfirm,
    forcedTradeoff,
    legacyPostExplain,
    patternMirror,
    contractLoading,
    contractForm,
    contractInitError,
    patternThreshold,
    executionGate,
    v2EscalationNotConfigured,
    v2MissingBranch,
    v2InvalidCost,
  ] = await Promise.all([
    choiceGroup.isVisible().catch(() => false),
    page.getByTestId("elite-escalation-step").isVisible().catch(() => false),
    page.getByTestId("elite-post-confirm").isVisible().catch(() => false),
    page.getByTestId("elite-forced-tradeoff-step").isVisible().catch(() => false),
    page.getByTestId("elite-post-explain").isVisible().catch(() => false),
    page.getByTestId("elite-pattern-mirror").isVisible().catch(() => false),
    page.getByTestId("elite-action-contract-loading").isVisible().catch(() => false),
    page.getByTestId("elite-action-contract").isVisible().catch(() => false),
    page.getByTestId("elite-action-contract-init-error").isVisible().catch(() => false),
    page.getByTestId("elite-action-contract-pattern-threshold-continue").isVisible().catch(() => false),
    page.getByTestId("elite-execution-gate").isVisible().catch(() => false),
    page.getByTestId("elite-v2-runtime-error-escalation_not_configured").isVisible().catch(() => false),
    page.getByTestId("elite-v2-runtime-error-missing_escalation_branch").isVisible().catch(() => false),
    page.getByTestId("elite-v2-runtime-error-invalid_second_choice_cost").isVisible().catch(() => false),
  ]);

  const v2ErrorVisible = await page
    .locator('[data-testid^="elite-v2-runtime-error-"]')
    .first()
    .isVisible()
    .catch(() => false);

  return {
    "1_primary_choices_group": primaryChoices,
    "2_elite_escalation_step": escalation,
    "2b_elite_post_confirm_legacy": legacyPostConfirm,
    "2c_elite_v2_error_escalation_not_configured": v2EscalationNotConfigured,
    "2d_elite_v2_error_missing_escalation_branch": v2MissingBranch,
    "2e_elite_v2_error_invalid_second_choice_cost": v2InvalidCost,
    "3_elite_forced_tradeoff_step": forcedTradeoff,
    "3b_elite_post_explain_legacy": legacyPostExplain,
    "4_elite_pattern_mirror": patternMirror,
    "5_elite_action_contract_loading": contractLoading,
    "6_elite_action_contract_form": contractForm,
    "alt_elite_action_contract_init_error": contractInitError,
    "alt_pattern_threshold_continue": patternThreshold,
    "alt_elite_execution_gate": executionGate,
    alt_elite_v2_runtime_error: v2ErrorVisible,
  };
}

export async function visibleDataTestIdsUnderArenaMain(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const main = document.querySelector('[data-testid="arena-play-main"]');
    if (!main) return [];
    const out: string[] = [];
    for (const el of main.querySelectorAll("[data-testid]")) {
      const id = el.getAttribute("data-testid");
      if (!id) continue;
      const html = el as HTMLElement;
      try {
        if (typeof html.checkVisibility === "function") {
          if (!html.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
        } else {
          const r = html.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
        }
      } catch {
        continue;
      }
      out.push(id);
    }
    return [...new Set(out)].sort();
  });
}

export async function arenaMainTextSnippet(page: Page, maxChars = 2_800): Promise<string> {
  const raw = await page
    .locator('[data-testid="arena-play-main"]')
    .innerText()
    .catch(() => "");
  const t = raw.replace(/\s+/g, " ").trim();
  return t.length <= maxChars ? t : `${t.slice(0, maxChars)}…[truncated]`;
}

/**
 * Snapshot before waiting for step 3 branch (escalation vs legacy vs v2 error). Not gated on `E2E_DEBUG_ELITE_ACTION_NAV`
 * — used when `navigateEliteArenaToActionContractStep` is called with `preStep3BranchSnapshot: true`.
 */
export async function logEliteNavPreStep3BranchSnapshot(page: Page): Promise<void> {
  const [orderedSignals, visibleDataTestIds, arenaPlayMainTextSnippet] = await Promise.all([
    orderedEliteFlowSignals(page),
    visibleDataTestIdsUnderArenaMain(page),
    arenaMainTextSnippet(page),
  ]);
  console.log(
    `[e2e-elite-nav] pre-step3-branch-snapshot ${JSON.stringify({
      ts: new Date().toISOString(),
      url: page.url(),
      orderedSignals,
      visibleDataTestIdsUnderArenaPlayMain: visibleDataTestIds,
      arenaPlayMainTextSnippet,
    })}`,
  );
}

/** When step 3 branch wait fails, always log what appeared instead (stable prefix). */
export async function logEliteNavStep3BranchWaitFailure(page: Page, reason: string): Promise<void> {
  const [orderedSignals, visibleDataTestIds, arenaPlayMainTextSnippet, v2TestId] = await Promise.all([
    orderedEliteFlowSignals(page),
    visibleDataTestIdsUnderArenaMain(page),
    arenaMainTextSnippet(page),
    visibleEliteV2RuntimeErrorTestId(page),
  ]);
  const payload = {
    reason,
    url: page.url(),
    orderedSignals,
    visibleDataTestIdsUnderArenaPlayMain: visibleDataTestIds,
    arenaPlayMainTextSnippet,
    visibleEliteV2RuntimeErrorTestId: v2TestId,
  };
  console.error(`[e2e-elite-nav] step3-branch-wait-failure ${JSON.stringify(payload)}`);
  if (isE2eDebugEliteActionNav()) {
    logEliteNav("step3-branch-wait-failure-detail", payload);
  }
}

/**
 * When policy Step 6 happy path fails to show `elite-execution-gate`, attach this to Playwright output.
 * Includes visible testids, main text snippet, `localStorage` arena state, and in-page fetches for
 * `pending-followup` + `by-session` (needs `runId` in saved state).
 */
export async function dumpPolicyStep6HappyPathFailureDiagnostics(page: Page): Promise<string> {
  const [testids, snippet, storageDiag, followupDiag, contractDiag, dialogDiag, signals] = await Promise.all([
    visibleDataTestIdsUnderArenaMain(page),
    arenaMainTextSnippet(page, 4_000),
    page.evaluate(() => {
      try {
        const raw = localStorage.getItem("btyArenaState:v1");
        if (!raw) return { btyArenaState: null as string | null };
        const p = JSON.parse(raw) as Record<string, unknown>;
        return {
          step: p.step,
          phase: p.phase,
          runId: p.runId,
          scenarioId: p.scenarioId,
        };
      } catch (e) {
        return { localStorageParseError: String(e) };
      }
    }),
    page.evaluate(async () => {
      try {
        const raw = localStorage.getItem("btyArenaState:v1");
        const p = raw ? (JSON.parse(raw) as { runId?: string }) : {};
        const rid = typeof p.runId === "string" ? p.runId : "";
        if (!rid) return { pendingFollowup: "skipped_no_runId_in_localStorage" };
        const r = await fetch(
          `/api/bty/action-contract/pending-followup?sessionId=${encodeURIComponent(rid)}`,
          { credentials: "include" },
        );
        const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
        return { status: r.status, body: j };
      } catch (e) {
        return { pendingFollowupError: String(e) };
      }
    }),
    page.evaluate(async () => {
      try {
        const raw = localStorage.getItem("btyArenaState:v1");
        const p = raw ? (JSON.parse(raw) as { runId?: string }) : {};
        const rid = typeof p.runId === "string" ? p.runId : "";
        if (!rid) return { bySession: "skipped_no_runId_in_localStorage" };
        const r = await fetch(`/api/bty/action-contract/by-session?sessionId=${encodeURIComponent(rid)}`, {
          credentials: "include",
        });
        const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
        return { status: r.status, body: j };
      } catch (e) {
        return { bySessionError: String(e) };
      }
    }),
    page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"][aria-modal="true"]');
      const html = dlg as HTMLElement | null;
      let dialogVisible = false;
      if (html) {
        try {
          dialogVisible =
            typeof html.checkVisibility === "function"
              ? html.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
              : html.getBoundingClientRect().width > 0;
        } catch {
          dialogVisible = true;
        }
      }
      return {
        dialogPresent: !!dlg,
        dialogVisible,
        titleText: dlg?.querySelector("h2")?.textContent?.trim()?.slice(0, 120) ?? null,
      };
    }),
    orderedEliteFlowSignals(page),
  ]);

  const payload = {
    ts: new Date().toISOString(),
    url: page.url(),
    visibleDataTestIdsUnderArenaPlayMain: testids,
    arenaPlayMainTextSnippet: snippet,
    localStorageArenaState: storageDiag,
    fetchPendingFollowupInPage: followupDiag,
    fetchBySessionInPage: contractDiag,
    modalFollowupOverlay: dialogDiag,
    orderedSignals: signals,
  };
  return JSON.stringify(payload, null, 2);
}

export async function logEliteNavFinalDiagnosis(page: Page, reason: string): Promise<void> {
  const signals = await orderedEliteFlowSignals(page);
  const url = page.url();

  if (!isE2eDebugEliteActionNav()) {
    console.error(
      `[e2e-elite-nav] final-diagnosis (set E2E_DEBUG_ELITE_ACTION_NAV=1 for full dump) ${JSON.stringify({
        reason,
        url,
        orderedSignals: signals,
      })}`,
    );
    return;
  }

  const testids = await visibleDataTestIdsUnderArenaMain(page);
  const snippet = await arenaMainTextSnippet(page);
  logEliteNav("final-diagnosis", {
    reason,
    url,
    orderedSignals: signals,
    visibleDataTestIdsUnderArenaPlayMain: testids,
    arenaPlayMainTextSnippet: snippet,
  });
}
