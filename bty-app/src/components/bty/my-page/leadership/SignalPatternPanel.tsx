import type { LeadershipState } from "@/features/my-page/logic/types";
import { GlassPanel } from "./GlassPanel";
import { SignalRow } from "./SignalRow";

type Props = {
  state: LeadershipState;
  sectionTitle: string;
  labelRelational: string;
  labelOperational: string;
  labelEmotional: string;
};

export function SignalPatternPanel({
  state,
  sectionTitle,
  labelRelational,
  labelOperational,
  labelEmotional,
}: Props) {
  return (
    <GlassPanel data-testid="my-page-signal-pattern" className="p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">{sectionTitle}</div>
      <div className="mt-4 space-y-3">
        <SignalRow label={labelRelational} value={state.relationalLabel} />
        <SignalRow label={labelOperational} value={state.operationalLabel} />
        <SignalRow label={labelEmotional} value={state.emotionalLabel} />
      </div>
    </GlassPanel>
  );
}
