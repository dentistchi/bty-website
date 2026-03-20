import { GlassPanel } from "./GlassPanel";

type Props = {
  codeName: string;
  stage: string;
  headline: string;
  coreTraceLabel: string;
  coreTraceCaption: string;
  eyebrow: string;
  systemNoteTitle: string;
  systemNoteBody: string;
};

/**
 * Top of the leadership console: who you are in BTY terms + observational headline.
 */
export function IdentityHeader({
  codeName,
  stage,
  headline,
  coreTraceLabel,
  coreTraceCaption,
  eyebrow,
  systemNoteTitle,
  systemNoteBody,
}: Props) {
  return (
    <GlassPanel data-testid="my-page-identity-card" className="p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">{eyebrow}</div>
          <h2
            data-testid="my-page-code-name"
            className="mt-3 font-mono text-3xl font-semibold tracking-tight text-white sm:text-4xl"
          >
            {codeName}
          </h2>
          <p data-testid="my-page-stage" className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-400">
            {stage}
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{headline}</p>
        </div>

        <div className="w-full shrink-0 lg:min-w-[200px] lg:max-w-[240px]">
          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">{systemNoteTitle}</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{systemNoteBody}</p>
            <div data-testid="my-page-core-progress" className="mt-4 border-t border-white/5 pt-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{coreTraceCaption}</p>
              <p className="mt-1 text-sm font-medium text-slate-200">{coreTraceLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
