"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  clearMissionPayload,
  DEFAULT_ARENA_MISSION_TOP_BAR,
  readMissionPayload,
  resolveMissionAgainstScenario,
} from "@/domain/arena/scenarios";
import type { HiddenStat } from "@/domain/arena/scenarios";
import { ArenaSystemLog, ArenaTopBar, GlassPanel, HiddenStatRow, SealedDecisionCard } from "@/components/arena";
import { ArenaSimulationShell, OutcomeVisualPanel } from "@/components/bty-arena/arena-system";
import { cn } from "@/lib/utils";
import { getMessages } from "@/lib/i18n";

export type ResolveActionsProps = {
  show: boolean;
  onContinue?: () => void;
  onReview?: () => void;
  onReturn?: () => void;
};

function ResolveHeader({ title }: { title: string }) {
  return (
    <div className="mb-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Decision Recorded</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
          Post-Decision State
        </span>
      </div>
      <h1 className="text-2xl font-semibold leading-tight text-white">{title}</h1>
    </div>
  );
}

function DecisionRecord({
  primaryTitle,
  primarySubtitle,
  primaryLabel,
  reinforcementTitle,
  reinforcementLabel,
}: {
  primaryTitle: string;
  primarySubtitle?: string;
  primaryLabel: string;
  reinforcementTitle: string;
  reinforcementLabel: string;
}) {
  return (
    <section data-testid="arena-resolve-decision-record" className="space-y-4">
      <div>
        <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">Primary Decision</div>
        <SealedDecisionCard
          variant="primary"
          label={primaryLabel}
          title={primaryTitle}
          subtitle={primarySubtitle}
        />
      </div>
      <div>
        <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">Intent Lock-In</div>
        <SealedDecisionCard variant="reinforcement" label={reinforcementLabel} title={reinforcementTitle} />
      </div>
    </section>
  );
}

function SystemInterpretation({ lines }: { lines: string[] }) {
  return (
    <section
      data-testid="arena-resolve-system-interpretation"
      className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4"
    >
      <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">System Interpretation</div>
      <div className="space-y-2 text-sm leading-6 text-slate-300">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </section>
  );
}

function ResolveActions({ show, onContinue, onReview, onReturn }: ResolveActionsProps) {
  return (
    <div
      data-testid="arena-resolve-actions"
      className={cn(
        "space-y-3 transition-all duration-300",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <button
        type="button"
        onClick={onContinue}
        className="h-12 w-full rounded-2xl bg-[#1E2A38] px-4 text-sm font-medium text-white transition hover:bg-[#243446]"
      >
        Continue Arena
      </button>
      <button
        type="button"
        onClick={onReview}
        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:bg-white/[0.07]"
      >
        Review Reflection
      </button>
      <button
        type="button"
        onClick={onReturn}
        className="h-12 w-full rounded-2xl border border-[#D7CFBF]/30 bg-transparent px-4 text-sm font-medium text-slate-400 transition hover:bg-white/[0.03]"
      >
        Return to Arena
      </button>
    </div>
  );
}

/**
 * Post-decision chamber — sessionStorage mission payload (legacy /play/resolve route).
 */
export default function ArenaResolveSessionScreen() {
  const params = useParams();
  const router = useRouter();
  const locale = params?.locale === "ko" ? "ko" : "en";
  const base = `/${locale}`;
  const m = getMessages(locale);
  const stub = m.uxPhase1Stub;
  const loadingCopy = m.loading;

  const [ready, setReady] = useState(false);
  const [stageLabel, setStageLabel] = useState("");
  const [systemMessage, setSystemMessage] = useState("SYSTEM // Decision cycle complete.");
  const [activeStats, setActiveStats] = useState<HiddenStat[]>([]);
  const [showResolveActions, setShowResolveActions] = useState(false);

  const [primaryLabel, setPrimaryLabel] = useState("A");
  const [primaryTitle, setPrimaryTitle] = useState("");
  const [primarySubtitle, setPrimarySubtitle] = useState<string | undefined>();
  const [reinforcementLabel, setReinforcementLabel] = useState("X");
  const [reinforcementTitle, setReinforcementTitle] = useState("");
  const [interpretationLines, setInterpretationLines] = useState<string[]>([]);
  const [headerTitle, setHeaderTitle] = useState("");

  useEffect(() => {
    const payload = readMissionPayload();
    const resolved = payload ? resolveMissionAgainstScenario(payload, locale === "ko" ? "ko" : "en") : null;

    if (!resolved) {
      router.replace(`${base}/bty-arena`);
      return;
    }

    const { scenario: resolvedScenario, primary, reinforcement, outcome } = resolved;
    setHeaderTitle(resolvedScenario.title);
    setPrimaryLabel(primary.label);
    setPrimaryTitle(primary.title);
    setPrimarySubtitle(primary.subtitle);
    setReinforcementLabel(reinforcement.label);
    setReinforcementTitle(reinforcement.title);
    setStageLabel(resolvedScenario.stage);

    const lines =
      outcome?.interpretation ?? [
        "System could not resolve interpretation for this combination.",
        "Decision is still recorded.",
      ];
    setInterpretationLines(lines);
    if (outcome?.systemMessage) {
      setSystemMessage(outcome.systemMessage);
    }

    setReady(true);

    const statTimer = window.setTimeout(() => {
      setActiveStats([...(outcome?.activatedStats ?? [])]);
    }, 320);
    const actionTimer = window.setTimeout(() => {
      setShowResolveActions(true);
    }, 520);

    return () => {
      window.clearTimeout(statTimer);
      window.clearTimeout(actionTimer);
    };
  }, [base, router, locale]);

  if (!ready) {
    return (
      <ArenaSimulationShell>
        <main
          className="mx-auto max-w-7xl py-16 text-center text-slate-400"
          aria-busy="true"
          aria-label={stub.arenaResolveSessionLoadingMainRegionAria}
        >
          {loadingCopy.message}
        </main>
      </ArenaSimulationShell>
    );
  }

  return (
    <ArenaSimulationShell data-testid="arena-resolve-screen">
      <main
        className="mx-auto flex max-w-7xl flex-col gap-6"
        aria-label={stub.arenaResolveSessionMainRegionAria}
      >
        <ArenaTopBar
          testId="arena-resolve-top-bar"
          stage={stageLabel}
          level={DEFAULT_ARENA_MISSION_TOP_BAR.level}
          codename={DEFAULT_ARENA_MISSION_TOP_BAR.codename}
          progress={DEFAULT_ARENA_MISSION_TOP_BAR.progress}
        />

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <OutcomeVisualPanel />
          </div>

          <div className="lg:col-span-5">
            <GlassPanel className="flex min-h-[640px] flex-col rounded-[2rem] p-5">
              <ResolveHeader title={headerTitle} />

              <div className="flex flex-1 flex-col gap-5">
                <DecisionRecord
                  primaryLabel={primaryLabel}
                  primaryTitle={primaryTitle}
                  primarySubtitle={primarySubtitle}
                  reinforcementLabel={reinforcementLabel}
                  reinforcementTitle={reinforcementTitle}
                />
                <SystemInterpretation lines={interpretationLines} />
                <HiddenStatRow activeStats={activeStats} />
                <div className="mt-auto">
                  <ResolveActions
                    show={showResolveActions}
                    onContinue={() => {
                      clearMissionPayload();
                      router.push(`${base}/bty-arena`);
                    }}
                    onReview={() => router.push(`${base}/growth/reflection`)}
                    onReturn={() => {
                      clearMissionPayload();
                      router.push(`${base}/bty-arena`);
                    }}
                  />
                </div>
              </div>
            </GlassPanel>
          </div>
        </section>

        <ArenaSystemLog testId="arena-resolve-bottom-log" message={systemMessage} />
      </main>
    </ArenaSimulationShell>
  );
}
