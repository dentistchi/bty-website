import type { LeadershipState } from "@/features/my-page/logic/types";
import { GlassPanel } from "./GlassPanel";
import { SignalRow } from "./SignalRow";

type Props = {
  state: LeadershipState;
  sectionTitle: string;
  labelTeam: string;
  labelInfluence: string;
  labelAlignment: string;
};

export function InfluencePanel({
  state,
  sectionTitle,
  labelTeam,
  labelInfluence,
  labelAlignment,
}: Props) {
  return (
    <GlassPanel data-testid="my-page-influence-panel" className="p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">{sectionTitle}</div>
      <div className="mt-4 space-y-3">
        <SignalRow
          label={labelTeam}
          value={state.teamSignal}
          valueTestId="my-page-team-signal-label"
        />
        <SignalRow
          label={labelInfluence}
          value={state.influencePattern}
          valueTestId="my-page-influence-pattern-label"
        />
        <SignalRow
          label={labelAlignment}
          value={state.alignmentTrend}
          valueTestId="my-page-alignment-trend-label"
        />
      </div>
    </GlassPanel>
  );
}
