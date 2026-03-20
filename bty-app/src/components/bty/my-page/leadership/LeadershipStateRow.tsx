import type { LeadershipState } from "@/features/my-page/logic/types";
import { GlassPanel } from "./GlassPanel";

type Props = {
  state: LeadershipState;
  labelAir: string;
  labelTii: string;
  labelRhythm: string;
};

/** Interpreted AIR / TII / Rhythm — no raw metric dump. */
export function LeadershipStateRow({ state, labelAir, labelTii, labelRhythm }: Props) {
  return (
    <section data-testid="my-page-leadership-state-row" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <GlassPanel data-testid="my-page-summary-insight" className="p-5">
        <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">{labelAir}</div>
        <p className="mt-3 text-base font-semibold leading-snug text-white sm:text-lg">{state.airLabel}</p>
      </GlassPanel>
      <GlassPanel data-testid="my-page-summary-influence" className="p-5">
        <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">{labelTii}</div>
        <p className="mt-3 text-base font-semibold leading-snug text-white sm:text-lg">{state.tiiLabel}</p>
      </GlassPanel>
      <GlassPanel data-testid="my-page-summary-rhythm" className="p-5">
        <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">{labelRhythm}</div>
        <p className="mt-3 text-base font-semibold leading-snug text-white sm:text-lg">{state.rhythmLabel}</p>
      </GlassPanel>
    </section>
  );
}
