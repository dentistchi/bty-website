import type { LeadershipState } from "@/features/my-page/logic/types";

type Props = {
  state: LeadershipState;
  eyebrow: string;
  labelDepth: string;
  labelIntegration: string;
  labelRecovery: string;
};

/**
 * Calm identity strip — reflection accumulation as state language (not a journal feed).
 */
export function ReflectionLayerStrip({
  state,
  eyebrow,
  labelDepth,
  labelIntegration,
  labelRecovery,
}: Props) {
  const { reflectionDepthLabel, reflectionIntegrationLabel, recoveryAwarenessLabel } = state;
  if (!reflectionDepthLabel && !reflectionIntegrationLabel && !recoveryAwarenessLabel) {
    return null;
  }

  return (
    <div
      className="rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-slate-900/90 via-slate-950/95 to-slate-950 px-4 py-4 shadow-inner ring-1 ring-white/5"
      data-testid="leadership-reflection-layer-strip"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-100/55">{eyebrow}</p>
      <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-200/95">
        {reflectionDepthLabel ? (
          <li>
            <span className="text-slate-500">{labelDepth}</span>{" "}
            <span className="font-medium text-slate-100">{reflectionDepthLabel}</span>
          </li>
        ) : null}
        {reflectionIntegrationLabel ? (
          <li>
            <span className="text-slate-500">{labelIntegration}</span>{" "}
            <span className="font-medium text-slate-100">{reflectionIntegrationLabel}</span>
          </li>
        ) : null}
        {recoveryAwarenessLabel ? (
          <li>
            <span className="text-slate-500">{labelRecovery}</span>{" "}
            <span className="font-medium text-slate-100">{recoveryAwarenessLabel}</span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
