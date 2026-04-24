"use client";

import React from "react";
import Link from "next/link";
import {
  ArenaHeader,
  TierMilestoneModal,
  CardSkeleton,
  ArenaRankingSidebar,
  EmptyState,
  LoadingFallback,
  ArenaToast,
  ArenaRunHistory,
  LabUsageStrip,
  ChoiceList,
  EliteArenaStep2Context,
  EliteArenaPostChoiceBlock,
  ArenaPendingContractGate,
  ArenaBlockedSurface,
  ArenaReexposurePanel,
  EliteActionDecisionStep,
  ArenaBindingError,
  ArenaAligningLoader,
  ArenaRuntimeStateBanner,
} from "@/components/bty-arena";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { getMessages } from "@/lib/i18n";
import type { ScenarioChoice } from "@/lib/bty/scenario/types";
import type { ArenaPipelineDefault } from "@/lib/bty/arena/arenaPipelineConfig";
import { arenaEntryHrefForDestination } from "@/lib/bty/arena/arenaRuntimeDestination";
import { isArenaServerEntryShellRuntimeState } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";
import { useArenaSession } from "./hooks/useArenaSession";

/**
 * Canonical Arena session UI — `/[locale]/bty-arena`.
 * **P5:** Snapshot gate order — `BtyArenaRunPageClient.snapshot-gates.test.tsx`.
 *
 * **Elite 3-choice:** primary → forced tradeoff → **action decision** (distinct step) → run complete / server snapshot gates.
 * Snapshot `runtime_state` outranks local step; ACTION_* → My Page contract; FORCED_RESET → Center; REEXPOSURE_DUE → re-exposure panel.
 */
export default function BtyArenaRunPageClient({
  pipelineDefault = "legacy",
}: {
  pipelineDefault?: ArenaPipelineDefault;
}) {
  /** Prop ignored for routing — `useArenaSession` uses `getArenaPipelineDefaultForClient()` only. */
  const s = useArenaSession(pipelineDefault);
  const { locale, t } = s;
  /** Prefer binding overlay; fall back to session snapshot for tests / partial mocks. */
  const gateSnapshot = s.effectiveArenaSnapshot ?? s.arenaServerSnapshot;
  const tLoading = getMessages(locale === "ko" ? "ko" : "en").loading;
  const devRuntimeBannerTestId = process.env.NODE_ENV !== "production";

  if (!s.levelChecked) {
    return (
      <ScreenShell
        locale={locale}
        fullWidth
        contentClassName="pb-24"
        mainAriaLabel={t.runPageLevelCheckMainRegionAria}
      >
        <div
          data-testid="arena-play-loading"
          aria-busy="true"
          aria-label={tLoading.message}
          className="mx-auto max-w-lg px-2"
        >
          <LoadingFallback icon="📋" message={tLoading.message} withSkeleton />
        </div>
      </ScreenShell>
    );
  }

  if (s.requiresBeginnerPath) {
    return (
      <ScreenShell
        locale={locale}
        fullWidth
        contentClassName="pb-24"
        mainAriaLabel={t.runPageBeginnerPathMainRegionAria}
      >
        <div data-testid="arena-play-gate-beginner" aria-busy="true" className="mx-auto max-w-lg px-2">
          <CardSkeleton lines={2} showLabel={true} />
        </div>
      </ScreenShell>
    );
  }

  if (s.scenarioLoading) {
    return (
      <ScreenShell
        locale={locale}
        fullWidth
        contentClassName="pb-24"
        mainAriaLabel={t.runPageLevelCheckMainRegionAria}
      >
        <div data-testid="arena-play-loading-scenario" className="mx-auto max-w-lg px-2">
          <ArenaAligningLoader message={t.arenaAligningLoaderTitle} lead={t.arenaAligningLoaderLead} />
        </div>
      </ScreenShell>
    );
  }

  /** HARD: GET `arenaServerSnapshot` only — binding must not replace `REEXPOSURE_DUE` shell. */
  if (s.arenaServerSnapshot?.runtime_state === "REEXPOSURE_DUE") {
    const shell = s.arenaServerSnapshot;
    const rexId = shell.re_exposure?.scenario_id;
    return (
      <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunPageMainRegionAria}>
        <div data-testid="arena-play-snapshot-reexposure" className="mx-auto max-w-lg px-2">
          <ArenaReexposurePanel
            locale={locale}
            reexposureScenarioId={rexId}
            pendingOutcomeId={shell.re_exposure?.pending_outcome_id}
            onEnterScenario={s.beginReexposurePlay}
            enterLoading={s.reexposureEnterLoading}
          />
        </div>
      </ScreenShell>
    );
  }

  // Snapshot-first (outranks local uiStep): ACTION_* → FORCED_RESET → NEXT_SCENARIO_READY → then elite uiStep.
  if (s.arenaActionBlocking) {
    return (
      <>
        <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunPageMainRegionAria}>
          <div className="bty-arena-page-root mx-auto flex max-w-[1200px] flex-col gap-6 px-4 lg:flex-row lg:gap-6">
            <div
              data-testid="arena-play-main-pending-contract"
              className="flex min-w-0 flex-1 flex-col"
              style={{ maxWidth: 860, margin: "0 auto", width: "100%" }}
            >
              {s.arenaRuntimeBanner ? (
                <ArenaRuntimeStateBanner
                  devTestId={devRuntimeBannerTestId}
                  runtimeState={s.arenaRuntimeBanner.runtimeState}
                  gateLabel={s.arenaRuntimeBanner.gateLabel}
                />
              ) : null}
              <LabUsageStrip locale={locale} />
              <div>
                <ArenaHeader
                  locale={locale}
                  step={s.step}
                  phase={s.phase}
                  runId={s.runId}
                  onPause={s.pause}
                  onReset={s.resetRun}
                  showPause={false}
                  identity={s.arenaIdentity}
                />
                {s.pendingActionContract ? (
                  <ArenaPendingContractGate
                    locale={locale}
                    contract={s.pendingActionContract}
                    onRetry={s.retryArenaSession}
                    retryLoading={s.scenarioLoading}
                  />
                ) : gateSnapshot ? (
                  <ArenaBlockedSurface
                    snapshot={gateSnapshot}
                    locale={locale}
                    pendingContract={null}
                    onRetrySession={s.retryArenaSession}
                    retryLoading={s.scenarioLoading}
                  />
                ) : (
                  <div data-testid="arena-play-action-block-no-contract-payload" className="mt-4">
                    <EmptyState
                      icon="📋"
                      message={t.arenaRunErrorTitle}
                      hint={t.arenaRunErrorDescription}
                    />
                  </div>
                )}
              </div>
              <ArenaRunHistory locale={locale} />
            </div>
            <aside
              aria-label={t.liveRanking}
              style={{ width: 280, flexShrink: 0, paddingTop: 32 }}
              className="hidden lg:block"
            >
              <ArenaRankingSidebar locale={locale} />
            </aside>
          </div>
        </ScreenShell>
        {s.toast && <ArenaToast message={s.toast} />}
      </>
    );
  }

  if (gateSnapshot?.runtime_state === "FORCED_RESET_PENDING") {
    const centerHref = arenaEntryHrefForDestination(locale, "center_forced_reset");
    return (
      <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunErrorMainRegionAria}>
        <div data-testid="arena-play-snapshot-forced-reset" className="mx-auto max-w-lg px-2">
          {s.arenaRuntimeBanner ? (
            <ArenaRuntimeStateBanner
              devTestId={devRuntimeBannerTestId}
              runtimeState={s.arenaRuntimeBanner.runtimeState}
              gateLabel={s.arenaRuntimeBanner.gateLabel}
            />
          ) : null}
          <div
            className="rounded-3xl border border-bty-border/80 bg-bty-surface/95 p-6 shadow-sm ring-1 ring-bty-border/40"
            role="region"
            aria-label={t.arenaForcedResetGateTitle}
          >
            <h2 className="m-0 text-lg font-semibold text-bty-navy">{t.arenaForcedResetGateTitle}</h2>
            <p className="mt-2 m-0 text-sm leading-relaxed text-bty-navy/85">{t.arenaForcedResetGateLead}</p>
            <p className="mt-3 m-0 text-xs text-bty-secondary">{t.arenaSnapshotForcedResetPlaceholder}</p>
            <div className="mt-6">
              <Link
                href={centerHref}
                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                style={{ background: "var(--arena-accent, #5b8fa8)" }}
                data-testid="arena-forced-reset-go-center"
              >
                {t.arenaForcedResetGoCenterCta}
              </Link>
            </div>
          </div>
        </div>
      </ScreenShell>
    );
  }

  if (gateSnapshot?.runtime_state === "NEXT_SCENARIO_READY") {
    /** Binding POST may emit `NEXT_SCENARIO_READY` after non-commit action decision — keep elite wrap-up / run-complete UI. */
    const midRunEliteNextReady =
      Boolean(s.scenario?.eliteSetup) &&
      Boolean(s.runId) &&
      (s.phase === "DONE" || s.phase === "ACTION_DECISION");
    if (!midRunEliteNextReady) {
      return (
        <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunPageMainRegionAria}>
          <div data-testid="arena-play-snapshot-next-scenario-ready" className="mx-auto max-w-lg px-2">
            {s.arenaRuntimeBanner ? (
              <ArenaRuntimeStateBanner
                devTestId={devRuntimeBannerTestId}
                runtimeState={s.arenaRuntimeBanner.runtimeState}
                gateLabel={s.arenaRuntimeBanner.gateLabel}
              />
            ) : null}
            <div className="rounded-2xl border border-bty-border bg-bty-surface p-4 shadow-sm">
              <EmptyState
                icon="📋"
                message={t.arenaSnapshotNextScenarioReadyTitle}
                hint={s.nextScenarioLoading ? t.arenaSnapshotNextScenarioReadyHint : t.arenaSnapshotPlaySurfaceBlockedHint}
              />
              {s.nextScenarioLoading ? (
                <div className="mt-4" aria-busy="true" aria-label={t.preparingNewScenarioAria}>
                  <CardSkeleton lines={2} showLabel={false} />
                </div>
              ) : null}
            </div>
          </div>
        </ScreenShell>
      );
    }
  }

  /**
   * Safety net: valid gate shells may have `scenario == null` without being a catalog miss — never show
   * `scenarioNotFound` for these (aligning / blocked surfaces are handled above when routing is correct).
   */
  if (
    !s.scenario &&
    !s.scenarioLoading &&
    gateSnapshot != null &&
    isArenaServerEntryShellRuntimeState(gateSnapshot.runtime_state)
  ) {
    return (
      <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunPageMainRegionAria}>
        <div data-testid="arena-play-gate-shell-fallback" className="mx-auto max-w-lg px-2">
          <LoadingFallback icon="📋" message={t.arenaSnapshotPlaySurfaceBlockedHint} />
        </div>
      </ScreenShell>
    );
  }

  if (!s.scenario) {
    return (
      <ScreenShell
        locale={locale}
        fullWidth
        contentClassName="pb-24"
        mainAriaLabel={t.runPageNoScenarioMainRegionAria}
      >
        <div data-testid="arena-play-empty-scenario" className="mx-auto max-w-lg px-2">
          <div className="rounded-2xl border border-bty-border bg-bty-surface p-4 shadow-sm">
            <EmptyState
              icon="📋"
              message={s.scenarioInitError ?? t.scenarioNotFound}
              hint={t.scenarioNotFoundHint}
            />
          </div>
        </div>
      </ScreenShell>
    );
  }

  if (!s.scenario.eliteSetup) {
    return (
      <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunPageMainRegionAria}>
        <div data-testid="arena-play-non-elite-scenario" className="mx-auto max-w-lg px-2">
          <EmptyState
            icon="📋"
            message={t.arenaRunErrorTitle}
            hint={t.arenaRunErrorDescription}
          />
        </div>
      </ScreenShell>
    );
  }

  if (!s.canRenderScenarioProgressionUi) {
    return (
      <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.runPageNoScenarioMainRegionAria}>
        <div data-testid="arena-play-snapshot-play-surface-blocked" className="mx-auto max-w-lg px-2">
          {s.arenaRuntimeBanner ? (
            <ArenaRuntimeStateBanner
              devTestId={devRuntimeBannerTestId}
              runtimeState={s.arenaRuntimeBanner.runtimeState}
              gateLabel={s.arenaRuntimeBanner.gateLabel}
            />
          ) : null}
          <EmptyState
            icon="📋"
            message={t.arenaPlaySurfaceBlockedTitle}
            hint={t.arenaSnapshotPlaySurfaceBlockedHint}
          />
        </div>
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunPageMainRegionAria}>
        <div className="bty-arena-page-root mx-auto flex max-w-[1200px] flex-col gap-6 px-4 lg:flex-row lg:gap-6">
          <div
            data-testid="arena-play-main"
            className="flex min-w-0 flex-1 flex-col"
            style={{ maxWidth: 860, margin: "0 auto", width: "100%" }}
          >
            {s.arenaRuntimeBanner ? (
              <ArenaRuntimeStateBanner
                devTestId={devRuntimeBannerTestId}
                runtimeState={s.arenaRuntimeBanner.runtimeState}
                gateLabel={s.arenaRuntimeBanner.gateLabel}
              />
            ) : null}
            <LabUsageStrip locale={locale} />
            <div>
              {s.playUiSegment === "primary_choice" && s.recallPrompt && !s.scenario.eliteSetup && (
                <div
                  data-testid="arena-recall-prompt"
                  role="note"
                  className="mb-4 rounded-xl border border-bty-border/80 bg-bty-soft/60 px-4 py-3 text-sm leading-relaxed"
                  style={{ color: "var(--arena-text-soft)" }}
                >
                  {s.recallPrompt.message}
                </div>
              )}

              <ArenaHeader
                locale={locale}
                step={s.step}
                phase={s.phase}
                runId={s.runId}
                onPause={s.pause}
                onReset={s.resetRun}
                showPause={false}
                identity={s.arenaIdentity}
              />

              {s.resetRunLoading && (
                <div style={{ marginTop: 10 }} aria-busy="true" aria-label={t.preparingNewScenarioAria}>
                  <p
                    style={{
                      margin: 0,
                      padding: "8px 0 6px",
                      fontSize: 13,
                      color: "var(--arena-text-soft)",
                      opacity: 0.9,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                    aria-live="polite"
                  >
                    <span aria-hidden style={{ fontSize: 16 }}>
                      🔄
                    </span>
                    {t.preparingNewScenarioAria}…
                  </p>
                  <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
                </div>
              )}
              {s.completeError && (
                <div
                  role="alert"
                  style={{
                    marginTop: 12,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "#fff7f7",
                    border: "1px solid #f1c0c0",
                    fontSize: 14,
                    color: "#8b2e2e",
                  }}
                >
                  {s.completeError}
                </div>
              )}

              <div
                role="region"
                aria-label={t.scenarioProgressPanelAria}
                className="mt-[18px] rounded-2xl border border-bty-border bg-bty-surface p-3 shadow-sm"
              >
                {(s.playUiSegment === "forced_tradeoff" ||
                  s.playUiSegment === "action_decision" ||
                  s.playUiSegment === "run_complete") && (
                  <h2 className="m-0 mb-2 text-lg font-semibold text-bty-navy">{s.displayTitle}</h2>
                )}

                {s.playUiSegment === "primary_choice" && (
                  <>
                    <EliteArenaStep2Context
                      title={s.displayTitle}
                      contextBody={s.contextForUser}
                      eliteSetup={s.scenario.eliteSetup}
                      locale={locale}
                    />
                    <p className="mb-3 text-sm font-medium leading-snug text-bty-navy/90">{s.t.elitePrimaryPickHint}</p>
                    <ChoiceList
                      locale={locale}
                      variant="elite"
                      choices={s.scenario.choices}
                      selectedChoiceId={null}
                      busy={s.confirmingChoice || !s.primaryChoiceInteractive}
                      onSelect={(id) => void s.commitElitePrimaryChoice(id as ScenarioChoice["choiceId"])}
                    />
                  </>
                )}

                {s.playUiSegment === "action_decision" &&
                  s.selectedChoiceId &&
                  s.scenario.escalationBranches?.[s.selectedChoiceId]?.action_decision != null && (
                    <EliteActionDecisionStep
                      locale={locale}
                      block={s.scenario.escalationBranches[s.selectedChoiceId]!.action_decision!}
                      onChoice={(id) => void s.submitActionDecision(id)}
                      choiceDisabled={s.actionDecisionSubmitting}
                    />
                  )}
                {s.playUiSegment === "action_decision" &&
                  !(
                    s.selectedChoiceId &&
                    s.scenario.escalationBranches?.[s.selectedChoiceId]?.action_decision != null
                  ) && <ArenaBindingError reason={t.eliteBindingIntegrityError} />}

                {(s.playUiSegment === "forced_tradeoff" || s.playUiSegment === "run_complete") && (
                  <EliteArenaPostChoiceBlock
                    key={`${s.scenario.scenarioId}-${s.playUiSegment}-${s.selectedChoiceId ?? "done"}`}
                    locale={locale}
                    step={s.step}
                    phase={s.phase}
                    runCompletePrimary={s.playUiSegment === "run_complete"}
                    scenario={s.scenario}
                    choice={s.choice}
                    selectedChoiceId={s.selectedChoiceId}
                    onSecondChoice={s.submitSecondChoice}
                    secondChoiceSubmitting={s.secondChoiceSubmitting}
                    onContinueNextScenario={s.continueNextScenario}
                    continueLoading={s.nextScenarioLoading}
                  />
                )}
              </div>

              <ArenaRunHistory locale={locale} />
            </div>
          </div>

          <aside
            aria-label={t.liveRanking}
            style={{ width: 280, flexShrink: 0, paddingTop: 32 }}
            className="hidden lg:block"
          >
            <ArenaRankingSidebar locale={locale} />
          </aside>
        </div>
      </ScreenShell>

      {s.milestoneModal && (
        <TierMilestoneModal
          milestone={s.milestoneModal.milestone}
          subName={s.milestoneModal.subName}
          previousSubName={s.milestoneModal.previousSubName}
          subNameRenameAvailable={s.milestoneModal.subNameRenameAvailable}
          onRename={s.milestoneModal.subNameRenameAvailable ? s.onRenameSubName : undefined}
          onClose={s.closeMilestoneModal}
        />
      )}

      {s.toast && <ArenaToast message={s.toast} />}
    </>
  );
}
