import type { LeadershipState } from "@/features/my-page/logic/types";
import { GlassPanel } from "./GlassPanel";

function FieldLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/[0.06] pb-4 last:border-0 last:pb-0">
      <div className="flex items-start gap-3">
        <div className="mt-1.5 h-8 w-1 shrink-0 rounded-full bg-gradient-to-b from-slate-400/30 via-cyan-400/12 to-transparent" />
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
  labelTeam: string;
  labelInfluence: string;
  labelAlignment: string;
};

export function InfluenceField({
  state,
  title,
  labelTeam,
  labelInfluence,
  labelAlignment,
}: Props) {
  return (
    <GlassPanel data-testid="my-page-influence-field" className="p-5 sm:p-6">
      <h3 className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">{title}</h3>
      <div className="mt-5 space-y-5">
        <FieldLine label={labelTeam} value={state.teamSignal} />
        <FieldLine label={labelInfluence} value={state.influencePattern} />
        <FieldLine label={labelAlignment} value={state.alignmentTrend} />
      </div>
    </GlassPanel>
  );
}
