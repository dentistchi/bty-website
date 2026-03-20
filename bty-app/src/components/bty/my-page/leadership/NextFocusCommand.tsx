import Link from "next/link";
import type { ReactNode } from "react";
import { GlassPanel } from "./GlassPanel";

type Props = {
  nextFocus: string;
  nextCue: string;
  sectionTitle: string;
  nextFocusHeading: string;
  developmentCueHeading: string;
  suggestedLine: string;
  links: ReactNode;
};

/**
 * Command-style closure — next move, not passive recommendation list.
 */
export function NextFocusCommand({
  nextFocus,
  nextCue,
  sectionTitle,
  nextFocusHeading,
  developmentCueHeading,
  suggestedLine,
  links,
}: Props) {
  return (
    <GlassPanel data-testid="my-page-next-focus-command" className="border-cyan-400/10 bg-slate-950/80 p-6 sm:p-7">
      <p className="text-[11px] uppercase tracking-[0.26em] text-cyan-100/60">{sectionTitle}</p>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{nextFocusHeading}</h4>
          <p className="mt-3 text-lg font-medium leading-relaxed text-white sm:text-xl">{nextFocus}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5">
          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{developmentCueHeading}</h4>
          <p className="mt-3 text-sm leading-7 text-slate-300">{nextCue}</p>
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">{suggestedLine}</p>
        <div className="flex flex-wrap gap-4 text-sm font-medium">{links}</div>
      </div>
    </GlassPanel>
  );
}

export function LeadershipConsoleLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-cyan-100/90 transition-colors hover:border-cyan-400/20 hover:bg-white/[0.06]"
    >
      {children}
    </Link>
  );
}
