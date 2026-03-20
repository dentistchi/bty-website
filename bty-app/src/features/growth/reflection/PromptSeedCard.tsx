import type { ReflectionSeed } from "@/features/growth/logic/buildReflectionSeed";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { GlassPanel } from "./GlassPanel";

type Props = {
  locale: string;
  seed: ReflectionSeed | null;
};

export function PromptSeedCard({ locale, seed }: Props) {
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;

  return (
    <GlassPanel data-testid="growth-reflection-seed-card" className="p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">
        {t.growthReflectionSectionPrompt}
      </div>

      {seed ? (
        <div className="mt-4 space-y-4">
          <div>
            <h2 className="text-xl font-semibold leading-tight text-white sm:text-2xl">{seed.promptTitle}</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">{seed.promptBody}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">
              Primary {seed.primary}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">
              Intent {seed.reinforcement}
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-7 text-slate-400">{t.growthReflectionNoSeed}</p>
      )}
    </GlassPanel>
  );
}
