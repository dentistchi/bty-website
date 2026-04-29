import { IdentityCrest } from "./IdentityCrest";

type Props = {
  codeName: string;
  stage: string;
  headline: string;
  eyebrow: string;
  systemNoteTitle: string;
  systemNoteBody: string;
  coreTraceCaption: string;
  coreTraceLabel: string;
  crestAria: string;
};

/**
 * Leadership identity declaration — not a generic profile header.
 */
export function IdentityHero({
  codeName,
  stage,
  headline,
  eyebrow,
  systemNoteTitle,
  systemNoteBody,
  coreTraceCaption,
  coreTraceLabel,
  crestAria,
}: Props) {
  return (
    <section
      data-testid="my-page-identity-hero"
      className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-slate-950 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-500/[0.06] blur-3xl" />
      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-5">
          <IdentityCrest aria-label={crestAria} />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.26em] text-cyan-100/65">{eyebrow}</p>
            <h2
              data-testid="my-page-code-name"
              className="mt-3 font-mono text-3xl font-semibold tracking-tight text-white sm:text-4xl"
            >
              {codeName}
            </h2>
            <p data-testid="my-page-stage" className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
              {stage}
            </p>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300">{headline}</p>
          </div>
        </div>

        <div className="w-full shrink-0 lg:max-w-sm">
          <div className="rounded-2xl border border-cyan-300/10 bg-slate-950/60 px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-100/55">{systemNoteTitle}</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">{systemNoteBody}</p>
            <div
              data-testid="my-page-core-progress"
              className="mt-4 border-t border-white/5 pt-4"
            >
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{coreTraceCaption}</p>
              <p className="mt-1.5 text-sm font-medium text-slate-200">{coreTraceLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
