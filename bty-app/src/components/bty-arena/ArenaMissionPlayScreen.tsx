"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  clearMissionPayload,
  DEFAULT_ARENA_MISSION_TOP_BAR,
  MOCK_SCENARIO,
  writeMissionPayload,
} from "@/domain/arena/scenarios";
import { ArenaSystemLog, ArenaTopBar, DecisionCard, GlassPanel } from "@/components/arena";
import { ArenaSimulationShell } from "@/components/bty-arena/arena-system";
import { cn } from "@/lib/utils";

const scenario = MOCK_SCENARIO;

/**
 * Premium 1+1 mission play — wired to MOCK_SCENARIO and sessionStorage → Resolve.
 */
export default function ArenaMissionPlayScreen() {
  const params = useParams();
  const router = useRouter();
  const locale = params?.locale === "ko" ? "ko" : "en";
  const base = `/${locale}`;

  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [systemMessage, setSystemMessage] = useState("SYSTEM // Awaiting decision input.");

  useEffect(() => {
    clearMissionPayload();
  }, []);

  function handlePrimary(id: string) {
    if (primaryId !== null) return;
    setPrimaryId(id);
    setSystemMessage("SYSTEM // Primary decision locked.");
  }

  function handleReinforcement(id: string) {
    if (!primaryId) return;
    writeMissionPayload({
      scenarioId: scenario.id,
      selectedPrimaryId: primaryId,
      selectedReinforcementId: id,
      decidedAt: new Date().toISOString(),
    });
    router.push(`${base}/bty-arena/mission/resolve`);
  }

  return (
    <ArenaSimulationShell data-testid="arena-mission-play-screen">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <ArenaTopBar
          testId="arena-mission-play-top-bar"
          stage={scenario.stage}
          level={DEFAULT_ARENA_MISSION_TOP_BAR.level}
          codename={DEFAULT_ARENA_MISSION_TOP_BAR.codename}
          progress={DEFAULT_ARENA_MISSION_TOP_BAR.progress}
        />

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <GlassPanel className="rounded-[2rem] p-6">
              <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">Scenario Active</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                  {scenario.caseTag}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                  {scenario.difficulty}
                </span>
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-white">{scenario.title}</h2>
              <div className="mt-4 space-y-2 text-sm leading-7 text-slate-300">
                {scenario.description.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </GlassPanel>
          </div>

          <div className="lg:col-span-5">
            <GlassPanel className="flex min-h-[640px] flex-col rounded-[2rem] p-5">
              <div className="mb-4 text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">Primary Decision</div>
              <div className="flex flex-col gap-3">
                {scenario.primaryChoices.map((c) => (
                  <DecisionCard
                    key={c.id}
                    testId={`arena-mission-primary-${c.id}`}
                    label={c.label}
                    title={c.title}
                    subtitle={c.subtitle}
                    variant="primary"
                    selected={primaryId === c.id}
                    dimmed={primaryId !== null && primaryId !== c.id}
                    disabled={primaryId !== null}
                    onSelect={() => handlePrimary(c.id)}
                  />
                ))}
              </div>

              <div
                className={cn(
                  "mt-6 flex flex-col gap-3 transition-all duration-300",
                  primaryId ? "translate-y-0 opacity-100" : "pointer-events-none h-0 translate-y-2 overflow-hidden opacity-0",
                )}
              >
                <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">Intent Lock-In</div>
                {scenario.reinforcementChoices.map((c) => (
                  <DecisionCard
                    key={c.id}
                    testId={`arena-mission-reinforcement-${c.id}`}
                    label={c.label}
                    title={c.title}
                    variant="reinforcement"
                    disabled={!primaryId}
                    onSelect={() => handleReinforcement(c.id)}
                  />
                ))}
              </div>
            </GlassPanel>
          </div>
        </section>

        <ArenaSystemLog testId="arena-mission-play-system-log" message={systemMessage} />
      </div>
    </ArenaSimulationShell>
  );
}
