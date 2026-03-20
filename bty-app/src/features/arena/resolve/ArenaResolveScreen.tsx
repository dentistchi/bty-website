"use client";

import { useEffect, useMemo, useState } from "react";
import type { ArenaScenario, ResolveOutcome } from "@/domain/arena/scenarios";
import { DEFAULT_ARENA_MISSION_TOP_BAR } from "@/domain/arena/scenarios";
import { ArenaSystemLog, ArenaTopBar, GlassPanel, HiddenStatRow, SealedDecisionCard } from "@/components/arena";
import { cn } from "@/lib/utils";

export type ArenaResolveScreenProps = {
  scenario: ArenaScenario;
  selectedPrimary: string | null;
  selectedReinforcement: string | null;
  outcome: ResolveOutcome | null;
  onContinueArena: () => void;
  onReviewReflection: () => void;
  onReturnToArena: () => void;
};

/**
 * Post-decision — sealed cards + `scenario.outcomes` via `outcome` (no hardcoded copy).
 */
export default function ArenaResolveScreen({
  scenario,
  selectedPrimary,
  selectedReinforcement,
  outcome,
  onContinueArena,
  onReviewReflection,
  onReturnToArena,
}: ArenaResolveScreenProps) {
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setShowActions(true), 450);
    return () => window.clearTimeout(t);
  }, []);

  const primary = useMemo(
    () => scenario.primaryChoices.find((c) => c.id === selectedPrimary),
    [scenario.primaryChoices, selectedPrimary],
  );
  const reinforcement = useMemo(
    () => scenario.reinforcementChoices.find((c) => c.id === selectedReinforcement),
    [scenario.reinforcementChoices, selectedReinforcement],
  );

  const interpretationLines =
    outcome?.interpretation?.length
      ? outcome.interpretation
      : [
          "System could not resolve interpretation for this combination.",
          "Decision is still recorded.",
        ];

  if (!primary || !reinforcement) {
    return (
      <main
        data-testid="arena-resolve-screen"
        className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6 py-5 text-white"
      >
        <div className="mx-auto max-w-7xl py-16 text-center text-slate-400">No decision payload.</div>
      </main>
    );
  }

  return (
    <main
      data-testid="arena-resolve-screen"
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6 py-5 text-white"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <ArenaTopBar
          testId="arena-resolve-top-bar"
          stage={scenario.stage}
          level={DEFAULT_ARENA_MISSION_TOP_BAR.level}
          codename={DEFAULT_ARENA_MISSION_TOP_BAR.codename}
          progress={DEFAULT_ARENA_MISSION_TOP_BAR.progress}
        />

        <section className="grid grid-cols-12 gap-6">
          <GlassPanel className="relative col-span-12 h-[min(640px,70vh)] overflow-hidden lg:col-span-7">
            <div className="absolute left-5 top-5 rounded-full border border-cyan-300/20 bg-slate-950/70 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-cyan-100/80 backdrop-blur-md">
              Decision Recorded
            </div>

            <div className="flex h-full items-center justify-center px-6">
              <div className="text-center">
                <div className="text-[11px] uppercase tracking-[0.3em] text-slate-500">post-decision scene placeholder</div>
                <div className="mt-4 text-lg font-medium text-slate-300">Case state stabilized</div>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="col-span-12 flex min-h-[640px] flex-col p-5 lg:col-span-5">
            <div className="mb-5 shrink-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Decision Recorded</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                  Post-Decision State
                </span>
              </div>

              <h1 className="text-2xl font-semibold leading-tight text-white">{scenario.title}</h1>
            </div>

            <div className="flex flex-1 flex-col gap-5">
              <section data-testid="arena-resolve-decision-record" className="space-y-4">
                <div>
                  <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">Primary Decision</div>
                  <SealedDecisionCard
                    variant="primary"
                    label={primary.label}
                    title={primary.title}
                    subtitle={primary.subtitle}
                  />
                </div>

                <div>
                  <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">Intent Lock-In</div>
                  <SealedDecisionCard variant="reinforcement" label={reinforcement.label} title={reinforcement.title} />
                </div>
              </section>

              <section
                data-testid="resolve-interpretation"
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4"
              >
                <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">System Interpretation</div>
                <div className="space-y-2 text-sm leading-6 text-slate-300">
                  {interpretationLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </section>

              <HiddenStatRow activeStats={outcome?.activatedStats ?? []} />

              <div
                data-testid="arena-resolve-actions"
                className={cn(
                  "mt-auto space-y-3 transition-all duration-300",
                  showActions ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
                )}
              >
                <button
                  type="button"
                  data-testid="continue-arena"
                  onClick={onContinueArena}
                  className="h-12 w-full rounded-2xl bg-[#1E2A38] px-4 text-sm font-medium text-white transition hover:bg-[#243446]"
                >
                  Continue Arena
                </button>

                <button
                  type="button"
                  data-testid="review-reflection"
                  onClick={onReviewReflection}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:bg-white/[0.07]"
                >
                  Review Reflection
                </button>

                <button
                  type="button"
                  data-testid="return-arena"
                  onClick={onReturnToArena}
                  className="h-12 w-full rounded-2xl border border-[#D7CFBF]/30 bg-transparent px-4 text-sm font-medium text-slate-400 transition hover:bg-white/[0.03]"
                >
                  Return to Arena
                </button>
              </div>
            </div>
          </GlassPanel>
        </section>

        <ArenaSystemLog
          testId="arena-resolve-bottom-log"
          message={outcome?.systemMessage ?? "SYSTEM // Decision cycle complete."}
        />
      </div>
    </main>
  );
}
