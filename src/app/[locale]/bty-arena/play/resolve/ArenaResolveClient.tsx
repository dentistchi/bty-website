"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  ArenaHeader,
  ArenaActionValidationForm,
  ArenaActionCompleted,
  ArenaPendingContractGate,
  ArenaBlockedSurface,
  ArenaRuntimeStateBanner,
  ArenaToast,
  ArenaRankingSidebar,
  ArenaRunHistory,
} from "@/components/bty-arena";
import { ActionLoopQrPanel } from "@/components/arena/ActionLoopQrPanel";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { arenaEntryHrefForDestination } from "@/lib/bty/arena/arenaRuntimeDestination";
import { useArenaSession } from "../../hooks/useArenaSession";

/**
 * Arena Resolve surface — Action Gate (v1.1 §5.3 / FD-6).
 *
 * Renders ACTION_REQUIRED / ACTION_SUBMITTED / ACTION_AWAITING_VERIFICATION via
 * the existing production gate (`ArenaPendingContractGate` / `ArenaBlockedSurface`)
 * — invocation pattern mirrors `BtyArenaRunPageClient` lines 988–1066 verbatim.
 *
 * Sub-phase 2B scope: production path only. The JSON-engine dev path
 * (`BtyArenaRunPageClient` line 618+) relocates here in sub-phase 2D when
 * `BtyArenaRunPageClient` is touched as part of one coordinated change.
 *
 * Coexistence: during 2B → 2D, `BtyArenaRunPageClient` at `/bty-arena/play` still
 * renders both Play and Resolve states. No in-app navigation reaches this route
 * yet; direct URL entry (bookmark / dev / e2e) is the only entry. Fresh-state
 * safety: if there is no active Resolve runtime state, this component redirects
 * to `/bty-arena/play` rather than crashing.
 */
interface Props {
  locale: string;
}

export default function ArenaResolveClient({ locale }: Props) {
  const s = useArenaSession();
  const router = useRouter();
  const t = s.t;

  const gateSnapshot = s.effectiveArenaSnapshot ?? s.arenaServerSnapshot;
  const runtimeState = gateSnapshot?.runtime_state ?? null;

  // STAB-08 Scope C: an escalated contract maps to ACTION_SUBMITTED
  // (arenaRuntimeSnapshot.server.ts runtimeStateFromBlockingContract) yet the
  // submit-validation route permits resubmit (route.ts §A-3). Surface the validation
  // form so the user can self-resolve instead of dead-ending in the pending gate.
  // Keyed on the server-emitted snapshot status — no snapshot logic change (inventory §D).
  const escalatedReviseAllowed = gateSnapshot?.action_contract?.status === "escalated";

  // MVP-FIX-ACTION-01 (scope A): on `awaiting_qr` approve, flip from the validation
  // form to the QR gate client-side. No session refetch — it would not re-surface the
  // now-`submitted` contract (blocking-fetch is pending-only, DIAG-07) and would redirect
  // away from this surface.
  // STAB-06-FIX-03 (U2): on `terminal` approve (self-attest auto-approved + verified), the
  // hook-owned `actionTerminalCompletion` renders ArenaActionCompleted; reconcile happens
  // only on the explicit "Next scenario" CTA via clearPendingContractAndReload.
  const [validationApproved, setValidationApproved] = React.useState(false);

  const isResolveState =
    runtimeState === "ACTION_REQUIRED" ||
    runtimeState === "ACTION_SUBMITTED" ||
    runtimeState === "ACTION_ESCALATED" ||
    runtimeState === "ACTION_AWAITING_VERIFICATION";

  // Navigation OUT — when the active state is outside the Resolve domain,
  // redirect to the appropriate surface per v1.1 §4.3 transition table.
  // In-app navigation INTO this route from /bty-arena/play is wired in 2D.
  React.useEffect(() => {
    if (s.scenarioLoading) return; // wait for hydration
    // STAB-06-FIX-03 (U2/5g): while the terminal completion screen is shown, stay put —
    // the user advances only via the explicit "Next scenario" CTA, never an auto-redirect.
    if (s.actionTerminalCompletion) return;
    if (isResolveState) return; // stay on Resolve surface

    if (runtimeState === "FORCED_RESET_PENDING") {
      router.replace(arenaEntryHrefForDestination(locale, "center_forced_reset"));
      return;
    }

    // NEXT_SCENARIO_READY, REEXPOSURE_DUE, or no active gate → return to Play.
    // REEXPOSURE_DUE is a Play-mode flag (v1.1 FD-4), rendered by Play surface.
    // No-gate / unknown state → canonical Play entry as graceful fallback.
    router.replace(`/${locale}/bty-arena/play`);
  }, [s.scenarioLoading, s.actionTerminalCompletion, isResolveState, runtimeState, router, locale]);

  // Initial-hydration loading: render a minimal placeholder until useArenaSession
  // resolves. Avoids flicker between fresh-state and hydrated-state renders.
  if (s.scenarioLoading) {
    return (
      <ScreenShell
        locale={locale}
        fullWidth
        contentClassName="pb-24"
        mainAriaLabel={t.arenaRunPageMainRegionAria}
      >
        <div data-testid="arena-resolve-loading" className="mx-auto max-w-lg px-2" aria-busy="true">
          <p className="m-0 text-sm text-bty-navy/70">…</p>
        </div>
      </ScreenShell>
    );
  }

  // STAB-06-FIX-03 (U2/U3): terminal completion surface (self-attest auto-approved +
  // verified). Rendered from the hook-owned flag — independent of the snapshot, so a
  // background refetch can't short-circuit it. Advances only via the explicit CTA.
  if (s.actionTerminalCompletion) {
    return (
      <ScreenShell
        locale={locale}
        fullWidth
        contentClassName="pb-24"
        mainAriaLabel={t.arenaRunPageMainRegionAria}
      >
        <div className="mx-auto max-w-lg px-2">
          <ArenaActionCompleted
            locale={locale}
            onNext={() => s.clearPendingContractAndReload()}
            nextLoading={s.scenarioLoading}
          />
        </div>
      </ScreenShell>
    );
  }

  // Non-Resolve state → useEffect above will redirect; render null in the meantime.
  if (!gateSnapshot || !isResolveState) {
    return null;
  }

  // Active Resolve state — render the Action Gate.
  // Pattern mirrors BtyArenaRunPageClient lines 990–1064.
  return (
    <>
      <ScreenShell
        locale={locale}
        fullWidth
        contentClassName="pb-24"
        mainAriaLabel={t.arenaRunPageMainRegionAria}
      >
        <div className="bty-arena-page-root mx-auto flex max-w-[1200px] flex-col gap-6 px-4 lg:flex-row lg:gap-6">
          <div
            data-testid="arena-resolve-main-pending-contract"
            className="flex min-w-0 flex-1 flex-col"
            style={{ maxWidth: 860, margin: "0 auto", width: "100%" }}
          >
            {s.arenaRuntimeBanner ? (
              <ArenaRuntimeStateBanner
                runtimeState={s.arenaRuntimeBanner.runtimeState}
                gateLabel={s.arenaRuntimeBanner.gateLabel}
              />
            ) : null}

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
                (runtimeState === "ACTION_REQUIRED" || escalatedReviseAllowed) &&
                !validationApproved ? (
                  // Canonical: action validation precedes the QR gate.
                  // STAB-08 Scope C: escalated contracts (status='escalated' → runtime
                  // ACTION_SUBMITTED) reuse the same validation form to self-resolve via
                  // resubmit, instead of dead-ending in ArenaPendingContractGate.
                  <>
                    {escalatedReviseAllowed ? (
                      <p
                        data-testid="arena-resolve-escalated-revise-notice"
                        role="status"
                        className="mt-[18px] mb-[-6px] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-900"
                      >
                        {locale === "ko"
                          ? "이전 진술이 검증 기준을 통과하지 못했습니다. 수정해 다시 제출해 주세요."
                          : "Your previous statement didn't meet the validation threshold. Revise and resubmit."}
                      </p>
                    ) : null}
                    <ArenaActionValidationForm
                      locale={locale}
                      contractId={s.pendingActionContract.id}
                      onApproved={(info) => {
                        // STAB-06-FIX-03 (U2): terminal → hook-owned completion flag
                        // (single source of truth). awaiting_qr → existing QR-gate flip.
                        if (info?.terminal) {
                          s.setActionTerminalCompletion(true);
                        } else {
                          setValidationApproved(true);
                        }
                      }}
                    />
                  </>
                ) : (
                  <>
                    <ArenaPendingContractGate
                      locale={locale}
                      contract={s.pendingActionContract}
                      runtimeState={
                        validationApproved ? "ACTION_AWAITING_VERIFICATION" : runtimeState
                      }
                      onRetry={s.retryArenaSession}
                      retryLoading={s.scenarioLoading}
                      qrAllowed={gateSnapshot.gates?.qr_allowed === true}
                      onCompleteByQr={s.startPendingContractQrFlow}
                      qrLoading={s.pendingContractQrLoading}
                    />
                    {s.pendingContractQrOpen && s.pendingContractQrUrl ? (
                      <ActionLoopQrPanel
                        url={s.pendingContractQrUrl}
                        onDismiss={() => s.setPendingContractQrOpen(false)}
                        locale={locale}
                      />
                    ) : null}
                  </>
                )
              ) : (
                <ArenaBlockedSurface
                  snapshot={gateSnapshot}
                  locale={locale}
                  pendingContract={null}
                  onRetrySession={s.retryArenaSession}
                  retryLoading={s.scenarioLoading}
                />
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
      {s.toast ? <ArenaToast message={s.toast} /> : null}
    </>
  );
}
