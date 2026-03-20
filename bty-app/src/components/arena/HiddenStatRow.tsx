import type { HiddenStat } from "@/domain/arena/scenarios";
import { ARENA_HIDDEN_STAT_ORDER } from "@/domain/arena/scenarios";
import { cn } from "@/lib/utils";

export type HiddenStatRowProps = {
  activeStats: readonly HiddenStat[];
  testId?: string;
};

export default function HiddenStatRow({ activeStats, testId = "arena-hidden-stat-row" }: HiddenStatRowProps) {
  return (
    <section data-testid={testId}>
      <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">Signal Trace</div>

      <div className="flex flex-wrap items-center gap-3">
        {ARENA_HIDDEN_STAT_ORDER.map((stat) => {
          const active = activeStats.includes(stat);
          return (
            <div
              key={stat}
              title={stat}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border text-[10px] uppercase tracking-[0.12em] transition-all duration-300",
                active
                  ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.12)]"
                  : "border-white/10 bg-white/5 text-slate-400",
              )}
            >
              {stat.slice(0, 2)}
            </div>
          );
        })}
      </div>
    </section>
  );
}
