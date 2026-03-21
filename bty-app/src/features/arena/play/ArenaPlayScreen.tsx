"use client";

import type { ArenaScenario } from "@/domain/arena/scenarios";
import { DEFAULT_ARENA_MISSION_TOP_BAR } from "@/domain/arena/scenarios";
import { ArenaSystemLog, ArenaTopBar, DecisionCard, GlassPanel } from "@/components/arena";
import { cn } from "@/lib/utils";

export type ArenaPlayScreenProps = {
  scenario: ArenaScenario;
  selectedPrimary: string | null;
  selectedReinforcement: string | null;
  canRevealReinforcement: boolean;
  canResolve: boolean;
  onSelectPrimary: (choiceId: string) => void;
  onSelectReinforcement: (choiceId: string) => void;
  onCommitDecision: () => void;
};

/**
 * 1+1 play — choices from `scenario`; hidden stats / interpretation only after Resolve (`outcome`).
 */
export default function ArenaPlayScreen({
  scenario,
  selectedPrimary,
  selectedReinforcement,
  canRevealReinforcement,
  canResolve,
  onSelectPrimary,
  onSelectReinforcement,
  onCommitDecision,
}: ArenaPlayScreenProps) {
  const systemMessage = selectedReinforcement
    ? "SYSTEM // Ready to confirm decision record."
    : selectedPrimary
      ? "SYSTEM // Primary decision locked."
      : "SYSTEM // Awaiting decision input.";

  const reinforcementLocked = selectedReinforcement !== null;

  return (
    <div
      data-testid="arena-mission-play-screen"
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6 py-5 text-white"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <ArenaTopBar
          testId="arena-mission-play-top-bar"
          stage={scenario.stage}
          level={DEFAULT_ARENA_MISSION_TOP_BAR.level}
          codename={DEFAULT_ARENA_MISSION_TOP_BAR.codename}
          progress={DEFAULT_ARENA_MISSION_TOP_BAR.progress}
        />

        <section className="grid grid-cols-12 gap-6">
          <GlassPanel className="relative col-span-12 h-[min(640px,70vh)] overflow-hidden lg:col-span-7">
            <div className="absolute left-5 top-5 rounded-full border border-cyan-300/20 bg-slate-950/70 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-cyan-100/80 backdrop-blur-md">
              Scenario Active
            </div>

            <div className="flex h-full items-center justify-center px-6">
              <div className="text-center">
                <div className="text-xs uppercase tracking-[0.3em] text-slate-500">visual scene placeholder</div>
                <div className="mt-4 text-lg font-medium text-slate-300">Cinematic illustration area</div>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="col-span-12 flex min-h-[640px] flex-col p-5 lg:col-span-5">
            <div className="mb-4 shrink-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Scenario Active</span>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                    {scenario.caseTag}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                    {scenario.difficulty}
                  </span>
                </div>
              </div>

              <h1 className="text-2xl font-semibold leading-tight text-white">{scenario.title}</h1>

              <div className="mt-4 space-y-2 text-sm leading-7 text-slate-300">
                {scenario.description.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>

            <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">Primary Decision</div>
            <div className="mt-3 space-y-3">
              {scenario.primaryChoices.map((c) => (
                <DecisionCard
                  key={c.id}
                  testId={`primary-${c.id}`}
                  label={c.label}
                  title={c.title}
                  subtitle={c.subtitle}
                  variant="primary"
                  selected={selectedPrimary === c.id}
                  dimmed={selectedPrimary !== null && selectedPrimary !== c.id}
                  disabled={selectedPrimary !== null}
                  onClick={() => onSelectPrimary(c.id)}
                />
              ))}
            </div>

            <div
              className={cn(
                "mt-5 border-t border-white/10 pt-5 transition-all duration-300",
                canRevealReinforcement ? "opacity-100" : "pointer-events-none opacity-30",
              )}
            >
              <div className="mb-3 text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Intent Lock-In</div>

              <div className="space-y-3">
                {scenario.reinforcementChoices.map((c) => (
                  <DecisionCard
                    key={c.id}
                    testId={`reinforce-${c.id}`}
                    label={c.label}
                    title={c.title}
                    size="secondary"
                    variant="reinforcement"
                    selected={selectedReinforcement === c.id}
                    dimmed={reinforcementLocked && selectedReinforcement !== c.id}
                    disabled={!canRevealReinforcement || reinforcementLocked}
                    onClick={() => onSelectReinforcement(c.id)}
                  />
                ))}
              </div>

              {canResolve ? (
                <button
                  type="button"
                  data-testid="resolve-decision"
                  onClick={onCommitDecision}
                  className="mt-5 h-12 w-full rounded-2xl bg-[#1E2A38] px-4 text-sm font-medium text-white transition hover:bg-[#243446]"
                >
                  Resolve decision
                </button>
              ) : null}
            </div>
          </GlassPanel>
        </section>

        <ArenaSystemLog testId="arena-system-log" message={systemMessage} />
      </div>
    </div>
  );
}
