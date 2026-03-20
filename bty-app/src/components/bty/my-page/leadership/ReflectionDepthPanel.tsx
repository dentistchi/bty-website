import type { LeadershipState } from "@/features/my-page/logic/types";
import { GlassPanel } from "./GlassPanel";

type Props = {
  state: LeadershipState;
  eyebrow: string;
  labelDepth: string;
  labelRecentFocus: string;
  labelIntegration: string;
  dormantLine: string;
};

/** Growth-aware identity layer — Arena alone reads cold without this. */
export function ReflectionDepthPanel({
  state,
  eyebrow,
  labelDepth,
  labelRecentFocus,
  labelIntegration,
  dormantLine,
}: Props) {
  const has = Boolean(state.reflectionDepthLabel);

  return (
    <GlassPanel data-testid="my-page-reflection-depth-panel" className="p-5 sm:p-6">
      <h3 className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">{eyebrow}</h3>
      {!has ? (
        <p className="mt-4 text-sm leading-7 text-slate-500">{dormantLine}</p>
      ) : (
        <dl className="mt-5 space-y-4">
          <div>
            <dt className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{labelDepth}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-100">{state.reflectionDepthLabel}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{labelRecentFocus}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-100">
              {state.recentFocusLabel ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{labelIntegration}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-100">{state.reflectionIntegrationLabel}</dd>
          </div>
        </dl>
      )}
    </GlassPanel>
  );
}
