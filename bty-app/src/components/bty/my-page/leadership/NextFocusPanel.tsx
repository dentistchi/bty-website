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

export function NextFocusPanel({
  nextFocus,
  nextCue,
  sectionTitle,
  nextFocusHeading,
  developmentCueHeading,
  suggestedLine,
  links,
}: Props) {
  return (
    <GlassPanel data-testid="my-page-next-focus" className="p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">{sectionTitle}</div>
      <div className="mt-4 space-y-4">
        <div>
          <div className="text-sm font-semibold text-white">{nextFocusHeading}</div>
          <p className="mt-2 text-sm leading-7 text-slate-300">{nextFocus}</p>
        </div>

        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">{developmentCueHeading}</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{nextCue}</p>
        </div>

        <p className="text-xs text-slate-500">{suggestedLine}</p>
        <div className="flex flex-wrap gap-3 text-xs font-medium">{links}</div>
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
      className="text-cyan-400/90 underline-offset-4 transition-colors hover:text-cyan-300 hover:underline"
    >
      {children}
    </Link>
  );
}
