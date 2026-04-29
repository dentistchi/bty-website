import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { GlassPanel } from "./GlassPanel";

type Props = {
  locale: string;
  cue?: string;
};

export function DevelopmentCueCard({ locale, cue }: Props) {
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;

  return (
    <GlassPanel className="p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">{t.growthReflectionSectionCue}</div>
      <p className="mt-4 text-sm leading-7 text-slate-300">{cue ?? t.growthReflectionCueEmpty}</p>
    </GlassPanel>
  );
}
