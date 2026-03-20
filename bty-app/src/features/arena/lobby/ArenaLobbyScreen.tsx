"use client";

import type { ArenaScenario } from "@/domain/arena/scenarios";
import { DEFAULT_ARENA_MISSION_TOP_BAR } from "@/domain/arena/scenarios";
import { ArenaTopBar, GlassPanel } from "@/components/arena";

export type ArenaLobbyScreenProps = {
  scenario: ArenaScenario;
  onEnterArena: () => void;
  onResumeScenario: () => void;
};

function StatusCapsule({ label, value }: { label: string; value: string }) {
  return (
    <GlassPanel className="rounded-2xl px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-medium text-white">{value}</div>
    </GlassPanel>
  );
}

/**
 * Mission lobby — `scenario` + flow actions only (Arena UI kit).
 */
export default function ArenaLobbyScreen({
  scenario,
  onEnterArena,
  onResumeScenario,
}: ArenaLobbyScreenProps) {
  return (
    <main
      data-testid="arena-lobby-screen"
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6 py-5 text-white"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <ArenaTopBar
          testId="arena-lobby-top-bar"
          stage={scenario.stage}
          level={DEFAULT_ARENA_MISSION_TOP_BAR.level}
          codename={DEFAULT_ARENA_MISSION_TOP_BAR.codename}
          progress={DEFAULT_ARENA_MISSION_TOP_BAR.progress}
        />

        <GlassPanel data-testid="arena-lobby-hero" className="grid grid-cols-12 gap-6 p-6">
          <div className="col-span-12 lg:col-span-7">
            <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Arena Ready</div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Enter the next decision cycle.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
              Pressure, ambiguity, and responsibility remain active.
            </p>
          </div>

          <div className="col-span-12 flex flex-col justify-center gap-3 lg:col-span-5">
            <button
              type="button"
              data-testid="arena-enter"
              onClick={onEnterArena}
              className="h-12 rounded-2xl bg-[#1E2A38] px-4 text-sm font-medium text-white transition hover:bg-[#243446]"
            >
              Enter Arena
            </button>
            <button
              type="button"
              data-testid="arena-resume"
              onClick={onResumeScenario}
              className="h-12 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:bg-white/[0.07]"
            >
              Resume Scenario
            </button>
          </div>
        </GlassPanel>

        <section className="grid grid-cols-12 gap-6">
          <GlassPanel data-testid="arena-active-scenario" className="col-span-12 p-5 lg:col-span-7">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">Scenario Loaded</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                {scenario.difficulty}
              </span>
            </div>

            <h2 className="text-xl font-semibold text-white">{scenario.title}</h2>

            <button
              type="button"
              onClick={onEnterArena}
              className="mt-5 h-11 rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.08] px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/[0.12]"
            >
              Continue
            </button>
          </GlassPanel>

          <GlassPanel data-testid="arena-lobby-reflection-card" className="col-span-12 p-5 lg:col-span-5">
            <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">Reflection</div>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              One unresolved pattern remains available for review.
            </p>

            <button
              type="button"
              className="mt-5 h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:bg-white/[0.07]"
            >
              Open Reflection
            </button>
          </GlassPanel>
        </section>

        <section data-testid="arena-lobby-status-rail" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatusCapsule label="Core Progress" value="Stable movement" />
          <StatusCapsule label="Weekly Window" value="12 days remaining" />
          <StatusCapsule label="Team Signal" value="Stable" />
        </section>
      </div>
    </main>
  );
}
