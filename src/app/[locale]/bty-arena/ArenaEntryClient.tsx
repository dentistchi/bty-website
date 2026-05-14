"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArenaReexposurePanel,
  ArenaRuntimeStateBanner,
  CardSkeleton,
  EmptyState,
} from "@/components/bty-arena";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { snapshotQualifiesAsReexposureGate } from "@/lib/bty/arena/arenaSessionRouterClient";
import { useArenaSession } from "./hooks/useArenaSession";

const copy = {
  ko: {
    heading: "어떻게 훈련하겠습니까?",
    fullTitle: "Full Arena",
    fullDesc: "정식 훈련 — 7단계 리더십 플로우, 전체 XP",
    quickTitle: "Quick Decision",
    quickDesc: "빠른 결정 — 단일 시나리오, 즉각 행동",
  },
  en: {
    heading: "How would you like to train?",
    fullTitle: "Full Arena",
    fullDesc: "Full training — 7-step leadership flow, full XP",
    quickTitle: "Quick Decision",
    quickDesc: "Fast decision — single scenario, immediate action",
  },
};

interface Props {
  locale: string;
}

/**
 * Arena Lobby — entry mode-select + NEXT_SCENARIO_READY (D1-b, Stage 2 step 6 sub-phase 2B).
 *
 * Default render: mode-select gate (Full Arena / Quick Decision). Server-snapshot
 * branch: when `runtime_state === "NEXT_SCENARIO_READY"`, render the relocated
 * inter-scenario transition surface (mirrors `BtyArenaRunPageClient` lines 1067-1167
 * verbatim — 3 sub-branches: re-exposure-precedence / contract-blocked / canonical
 * next-CTA).
 *
 * Coexistence: during 2B → 2D, `BtyArenaRunPageClient.tsx:1067-1167` ALSO renders
 * NEXT_SCENARIO_READY on `/bty-arena/play`. Test guardrail (snapshot-gates P5 E,
 * 7 tests) still asserts the Play-side testids. 2C migrates tests to render Lobby
 * with `arena-lobby-snapshot-*` testids; 2D removes the Play-side block.
 *
 * Fresh-state safety: when there is no NEXT_SCENARIO_READY snapshot (the common
 * case — direct Lobby entry, just-cleared localStorage), this component falls
 * through to the mode-select gate gracefully. No undefined access; no crash.
 *
 * Per v1.1.1 §5.6 + Commander D1-b decision: Lobby owns both ARENA_SCENARIO_READY
 * (first entry) and NEXT_SCENARIO_READY (inter-scenario transition). Hub-as-
 * distinct-surface is the v1.1 outlier; 4-doc consensus (CURSOR_MASTER_PROMPT,
 * MASTER_BUILD_V1, VISUAL_BEHAVIOR_SPEC) has no separate Hub layer. v1.1.1 §5.6
 * spec correction lands in 2F closure.
 */
export default function ArenaEntryClient({ locale }: Props) {
  const isKo = locale !== "en";
  const tStatic = isKo ? copy.ko : copy.en;
  const router = useRouter();
  const s = useArenaSession();

  const gateSnapshot = s.effectiveArenaSnapshot ?? s.arenaServerSnapshot;
  const runtimeState = gateSnapshot?.runtime_state ?? null;
  const isNextScenarioReady = runtimeState === "NEXT_SCENARIO_READY";

  /**
   * Mirror BtyArenaRunPageClient L124-135 re-exposure status copy derivation,
   * but inline (no useState/useEffect — pure derived value).
   */
  const reexposureInternalStatusCopy = s.lastReexposureTransition?.intervention_sensitivity_up
    ? s.t.arenaReexposureInternalStatusInterventionSensitivityUp
    : null;

  const devRuntimeBannerTestId = process.env.NODE_ENV !== "production";

  const handleContinue = React.useCallback(async () => {
    /**
     * `continueNextScenario` updates session state in place (POST /api/arena/run/complete →
     * setScenario(next) → snapshot transitions out of NEXT_SCENARIO_READY). Lobby's
     * mode-select branch would re-render after that, losing the loaded scenario, so we
     * navigate to /play where the state machine handles ARENA_SCENARIO_READY (primary
     * choice), REEXPOSURE_DUE (re-exposure shell), ACTION_REQUIRED (/play/resolve via
     * 2D-1 nav), or FORCED_RESET_PENDING (middleware → /center via 2C-1).
     */
    await s.continueNextScenario();
    router.push(`/${locale}/bty-arena/play`);
  }, [s, router, locale]);

  function handleFullArena() {
    // Clear persisted run state so the flow always starts from step 2 (primary_choice).
    if (typeof window !== "undefined") {
      localStorage.removeItem("btyArenaState:v1");
    }
    router.push(`/${locale}/bty-arena/play`);
  }

  if (isNextScenarioReady && gateSnapshot != null) {
    const t = s.t;
    const actionStatus = gateSnapshot.action_contract?.status ?? null;
    const actionStatusLc = typeof actionStatus === "string" ? actionStatus.trim().toLowerCase() : "";
    /** Submitted/escalated contracts are not a permanent block on "Load next" (MVP aligns with QR success copy). */
    const hasBlockingContractForNext =
      gateSnapshot.action_contract?.exists === true &&
      actionStatusLc !== "approved" &&
      actionStatusLc !== "completed" &&
      actionStatusLc !== "submitted" &&
      actionStatusLc !== "escalated";
    const hasPendingReexposure =
      gateSnapshot.re_exposure?.due === true &&
      s.playContext !== "next_scenario" &&
      snapshotQualifiesAsReexposureGate(gateSnapshot);

    if (hasPendingReexposure) {
      return (
        <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunPageMainRegionAria}>
          <div data-testid="arena-lobby-snapshot-reexposure" className="mx-auto max-w-lg px-2">
            <ArenaReexposurePanel
              locale={locale}
              reexposureScenarioId={gateSnapshot.re_exposure?.scenario_id}
              pendingOutcomeId={gateSnapshot.re_exposure?.pending_outcome_id}
              onEnterScenario={s.beginReexposurePlay}
              enterLoading={s.reexposureEnterLoading}
            />
            {reexposureInternalStatusCopy ? (
              <p
                data-testid="arena-reexposure-internal-status"
                className="mt-3 rounded-xl border border-bty-border/60 bg-bty-surface/80 px-3 py-2 text-xs text-bty-secondary"
              >
                {reexposureInternalStatusCopy}
              </p>
            ) : null}
          </div>
        </ScreenShell>
      );
    }

    if (hasBlockingContractForNext) {
      return (
        <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunPageMainRegionAria}>
          <div data-testid="arena-lobby-snapshot-next-scenario-blocked" className="mx-auto max-w-lg px-2">
            <EmptyState
              icon="📋"
              message={t.arenaPlaySurfaceBlockedTitle}
              hint={t.arenaSnapshotPlaySurfaceBlockedHint}
            />
          </div>
        </ScreenShell>
      );
    }

    /**
     * Canonical next-CTA: when `gates.next_allowed`, always show the next-ready Continue shell;
     * legacy fall-through to elite mid-run is preserved via `midRunEliteNextReady`.
     */
    const nextUnlocked = gateSnapshot.gates?.next_allowed === true;
    const midRunEliteNextReady =
      Boolean(s.scenario?.eliteSetup) &&
      Boolean(s.runId) &&
      (s.phase === "DONE" || s.phase === "ACTION_DECISION");

    if (nextUnlocked || !midRunEliteNextReady) {
      return (
        <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunPageMainRegionAria}>
          <div data-testid="arena-lobby-snapshot-next-scenario-ready" className="mx-auto max-w-lg px-2">
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
                message={t.arenaPostContractNextScenarioTitle}
                hint={s.nextScenarioLoading ? t.arenaSnapshotNextScenarioReadyHint : t.arenaPostContractNextScenarioHint}
              />
              {s.nextScenarioLoading ? (
                <div className="mt-4" aria-busy="true" aria-label={t.preparingNewScenarioAria}>
                  <CardSkeleton lines={2} showLabel={false} />
                </div>
              ) : (
                <div className="mt-4">
                  <button
                    type="button"
                    data-testid="arena-lobby-next-scenario-continue"
                    onClick={() => void handleContinue()}
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                    style={{ background: "var(--arena-accent, #5b8fa8)" }}
                  >
                    {t.arenaContinueToNextScenarioCta}
                  </button>
                </div>
              )}
            </div>
          </div>
        </ScreenShell>
      );
    }
    /** Mid-run elite without next_allowed → fall through to mode-select (defensive fresh-state). */
  }

  return (
    <div className="min-h-screen bg-[var(--arena-bg)] text-[var(--arena-text)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-lg font-semibold text-center">{tStatic.heading}</h1>

        <div className="flex flex-col gap-3">
          {/* Full Arena */}
          <button
            onClick={handleFullArena}
            className="w-full rounded-2xl border border-[var(--arena-accent)]/40 bg-[var(--arena-accent)]/5 hover:bg-[var(--arena-accent)]/10 px-5 py-4 text-left transition-colors group"
          >
            <p className="font-semibold text-[var(--arena-accent)] group-hover:underline">
              {tStatic.fullTitle}
            </p>
            <p className="text-xs text-[var(--arena-text)]/60 mt-0.5">{tStatic.fullDesc}</p>
          </button>

          {/* Quick Decision */}
          <Link
            href={`/${locale}/bty-arena/quick`}
            className="w-full rounded-2xl border border-[var(--arena-text)]/15 hover:border-[var(--arena-accent)]/30 px-5 py-4 text-left transition-colors group block"
          >
            <p className="font-semibold text-[var(--arena-text)] group-hover:text-[var(--arena-accent)] transition-colors">
              {tStatic.quickTitle}
            </p>
            <p className="text-xs text-[var(--arena-text)]/60 mt-0.5">{tStatic.quickDesc}</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
