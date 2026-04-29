import type { LeadershipState } from "@/features/my-page/logic/types";
import { GlassPanel } from "./GlassPanel";

type Props = {
  state: LeadershipState;
  eyebrow: string;
  dormantLine: string;
  supportNote?: string;
  showSupportNote?: boolean;
};

export function RecoveryAwarenessPanel({
  state,
  eyebrow,
  dormantLine,
  supportNote,
  showSupportNote,
}: Props) {
  const has = Boolean(state.recoveryAwarenessLabel);

  return (
    <GlassPanel data-testid="my-page-recovery-awareness" className="p-5 sm:p-6">
      <h3 className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">{eyebrow}</h3>
      {!has ? (
        <p className="mt-4 text-sm leading-7 text-slate-500">{dormantLine}</p>
      ) : (
        <div className="mt-5">
          <p className="text-sm font-medium leading-7 text-slate-100">{state.recoveryAwarenessLabel}</p>
          {showSupportNote && supportNote ? (
            <p className="mt-4 text-xs leading-6 text-slate-500">{supportNote}</p>
          ) : null}
        </div>
      )}
    </GlassPanel>
  );
}
