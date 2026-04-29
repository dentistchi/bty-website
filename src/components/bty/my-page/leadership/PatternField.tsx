import type { LeadershipState } from "@/features/my-page/logic/types";
import { GlassPanel } from "./GlassPanel";

function FieldLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="group border-b border-white/[0.06] pb-4 last:border-0 last:pb-0">
      <div className="flex items-start gap-3">
        <div className="mt-1.5 h-8 w-1 shrink-0 rounded-full bg-gradient-to-b from-cyan-400/35 via-cyan-300/15 to-transparent" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="mt-1.5 text-sm font-medium leading-6 text-slate-100">{value}</p>
        </div>
      </div>
    </div>
  );
}

type Props = {
  state: LeadershipState;
  title: string;
  labelRelational: string;
  labelOperational: string;
  labelEmotional: string;
};

/** Field reading — not a sparkline dashboard. */
export function PatternField({
  state,
  title,
  labelRelational,
  labelOperational,
  labelEmotional,
}: Props) {
  return (
    <GlassPanel data-testid="my-page-pattern-field" className="p-5 sm:p-6">
      <h3 className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">{title}</h3>
      <div className="mt-5 space-y-5">
        <FieldLine label={labelRelational} value={state.relationalLabel} />
        <FieldLine label={labelOperational} value={state.operationalLabel} />
        <FieldLine label={labelEmotional} value={state.emotionalLabel} />
      </div>
    </GlassPanel>
  );
}
